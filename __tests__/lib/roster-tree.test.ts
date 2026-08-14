import { describe, expect, it } from 'vitest';
import {
  buildGroupTree,
  findGroupNode,
  flattenTeams,
  groupPath,
  ORPHAN_GROUP_LABEL,
  totalPlayerCount,
} from '@/lib/roster-tree';
import type { BondGroup } from '@/types/rosters';

function group(over: Partial<BondGroup> & { id: number; name: string }): BondGroup {
  return {
    organizationId: 1,
    groupType: 'team',
    isTeam: true,
    parentId: null,
    parentName: null,
    registrationAccess: 'open',
    hasPlayers: true,
    playerCount: 0,
    hasGroups: false,
    groupCount: 0,
    mainMediaUrl: null,
    organizationName: 'Org',
    facilityId: null,
    sessionId: 100,
    sessionName: 'Fall',
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    deletedAt: null,
    ...over,
  };
}

const DIVISION_A = group({
  id: 10,
  name: 'Division A',
  groupType: 'division',
  isTeam: false,
  hasGroups: true,
  groupCount: 2,
});
const BLUE = group({ id: 11, name: 'Blue', parentId: 10, playerCount: 12 });
const AMBER = group({ id: 12, name: 'Amber', parentId: 10, playerCount: 11 });
const DIVISION_B = group({ id: 20, name: 'Division B', groupType: 'division', isTeam: false });
const GOLD = group({ id: 21, name: 'Gold', parentId: 20, playerCount: 9 });

describe('buildGroupTree', () => {
  it('nests teams under their division', () => {
    const tree = buildGroupTree([BLUE, DIVISION_A, AMBER]);
    expect(tree).toHaveLength(1);
    expect(tree[0].name).toBe('Division A');
    expect(tree[0].children.map((c) => c.name)).toEqual(['Amber', 'Blue']);
  });

  it('sorts siblings naturally, so Division 10 follows Division 2', () => {
    const tree = buildGroupTree([
      group({ id: 1, name: 'Division 10', isTeam: false }),
      group({ id: 2, name: 'Division 2', isTeam: false }),
    ]);
    expect(tree.map((n) => n.name)).toEqual(['Division 2', 'Division 10']);
  });

  it('drops soft-deleted groups', () => {
    const deleted = group({ id: 13, name: 'Ghost', parentId: 10, deletedAt: '2026-02-01T00:00:00Z' });
    const tree = buildGroupTree([DIVISION_A, BLUE, deleted]);
    expect(tree[0].children.map((c) => c.name)).toEqual(['Blue']);
  });

  it('surfaces groups whose parent is absent under an Other bucket', () => {
    const stray = group({ id: 99, name: 'Stray', parentId: 555 });
    const tree = buildGroupTree([DIVISION_A, BLUE, stray]);

    expect(tree.map((n) => n.name)).toEqual(['Division A', ORPHAN_GROUP_LABEL]);
    const other = tree.find((n) => n.name === ORPHAN_GROUP_LABEL)!;
    expect(other.children.map((c) => c.name)).toEqual(['Stray']);
    // The bucket is additive: groups with a resolvable parent still nest.
    expect(tree[0].children.map((c) => c.name)).toEqual(['Blue']);
  });

  it('adds no Other bucket when every parent resolves', () => {
    const tree = buildGroupTree([DIVISION_A, BLUE]);
    expect(tree.find((n) => n.name === ORPHAN_GROUP_LABEL)).toBeUndefined();
  });

  it('carries the team logo, preferring teamIdentity over mainMedia', () => {
    const withLogo = group({
      id: 30,
      name: 'Logo Team',
      mainMediaUrl: 'https://example.com/main.png',
      teamIdentity: { id: 1, name: 'Logo Team', sport: 'soccer', logoUrl: 'https://example.com/logo.png' },
    });
    expect(buildGroupTree([withLogo])[0].logoUrl).toBe('https://example.com/logo.png');
  });

  it('returns an empty tree for no groups', () => {
    expect(buildGroupTree([])).toEqual([]);
  });
});

describe('tree traversal', () => {
  const tree = buildGroupTree([DIVISION_A, BLUE, AMBER, DIVISION_B, GOLD]);

  it('flattens teams in render order, excluding divisions', () => {
    expect(flattenTeams(tree).map((t) => t.name)).toEqual(['Amber', 'Blue', 'Gold']);
  });

  it('finds a nested node', () => {
    expect(findGroupNode(tree, 21)?.name).toBe('Gold');
    expect(findGroupNode(tree, 4242)).toBeUndefined();
  });

  it('builds a breadcrumb trail root-first', () => {
    expect(groupPath(tree, 11).map((n) => n.name)).toEqual(['Division A', 'Blue']);
    expect(groupPath(tree, 4242)).toEqual([]);
  });

  it('rolls child player counts up, since Bond counts direct members only', () => {
    const divisionA = findGroupNode(tree, 10)!;
    expect(divisionA.playerCount).toBe(0);
    expect(totalPlayerCount(divisionA)).toBe(23);
  });
});
