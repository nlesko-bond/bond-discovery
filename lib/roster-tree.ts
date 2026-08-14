/**
 * Turns Bond's flat group list into the division → team hierarchy the browse
 * view renders.
 *
 * The groups endpoint returns every group in one paginated call, each carrying
 * `parentId`, so the whole tree is built locally with no extra requests.
 */

import type { BondGroup, RosterGroupNode } from '@/types/rosters';

/** Groups whose parent is missing from the payload, so they still render. */
export const ORPHAN_GROUP_LABEL = 'Other';

function toNode(group: BondGroup): RosterGroupNode {
  return {
    id: group.id,
    name: group.name,
    groupType: group.groupType,
    isTeam: group.isTeam,
    playerCount: group.playerCount ?? 0,
    logoUrl: group.teamIdentity?.logoUrl || group.mainMediaUrl || undefined,
    children: [],
  };
}

function sortNodes(nodes: RosterGroupNode[]): RosterGroupNode[] {
  return nodes.sort((a, b) => a.name.localeCompare(b.name, undefined, { numeric: true }));
}

/**
 * Build the tree. Soft-deleted groups are dropped. Any group whose `parentId`
 * points at a group not present in the list is surfaced under an "Other"
 * bucket rather than silently disappearing — the same rule the TV monitor
 * config uses for unassigned resources.
 */
export function buildGroupTree(groups: BondGroup[]): RosterGroupNode[] {
  const live = groups.filter((g) => !g.deletedAt);
  const byId = new Map<number, RosterGroupNode>();
  for (const group of live) {
    byId.set(group.id, toNode(group));
  }

  const roots: RosterGroupNode[] = [];
  const orphans: RosterGroupNode[] = [];

  for (const group of live) {
    const node = byId.get(group.id)!;
    if (group.parentId == null) {
      roots.push(node);
      continue;
    }
    const parent = byId.get(group.parentId);
    if (parent) {
      parent.children.push(node);
    } else {
      orphans.push(node);
    }
  }

  for (const node of byId.values()) {
    sortNodes(node.children);
  }
  sortNodes(roots);

  if (orphans.length > 0) {
    roots.push({
      id: -1,
      name: ORPHAN_GROUP_LABEL,
      groupType: 'group',
      isTeam: false,
      playerCount: 0,
      children: sortNodes(orphans),
    });
  }

  return roots;
}

/** Every team node in the tree, depth-first, in render order. */
export function flattenTeams(nodes: RosterGroupNode[]): RosterGroupNode[] {
  const teams: RosterGroupNode[] = [];
  const walk = (list: RosterGroupNode[]) => {
    for (const node of list) {
      if (node.isTeam) teams.push(node);
      if (node.children.length) walk(node.children);
    }
  };
  walk(nodes);
  return teams;
}

/** Find one node anywhere in the tree. */
export function findGroupNode(nodes: RosterGroupNode[], id: number): RosterGroupNode | undefined {
  for (const node of nodes) {
    if (node.id === id) return node;
    const hit = findGroupNode(node.children, id);
    if (hit) return hit;
  }
  return undefined;
}

/**
 * Breadcrumb trail to a node, root first, including the node itself.
 * Empty when the id is not in the tree.
 */
export function groupPath(nodes: RosterGroupNode[], id: number): RosterGroupNode[] {
  for (const node of nodes) {
    if (node.id === id) return [node];
    const childPath = groupPath(node.children, id);
    if (childPath.length) return [node, ...childPath];
  }
  return [];
}

/**
 * Roll child player counts up into parents. Bond's `playerCount` is direct
 * members only, so a division reports 0 even when its teams are full.
 */
export function totalPlayerCount(node: RosterGroupNode): number {
  return node.playerCount + node.children.reduce((sum, child) => sum + totalPlayerCount(child), 0);
}
