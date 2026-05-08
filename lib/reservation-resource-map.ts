/**
 * Rental reservation payloads include `resources: [{ id, name }]` on series (and elsewhere).
 * Slot rows carry `spaceId` matching resource `id`; map ids to display names from the tree.
 */

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

/**
 * Walks the reservation JSON and collects `{ id -> name }` from every `resources` / `Resources` array.
 */
export function collectResourceIdToDisplayName(root: unknown): Record<number, string> {
  const out: Record<number, string> = {};

  const visit = (node: unknown): void => {
    if (node === null || node === undefined) {
      return;
    }
    if (Array.isArray(node)) {
      for (const item of node) {
        visit(item);
      }
      return;
    }
    if (!isRecord(node)) {
      return;
    }
    const resources = node.resources ?? node.Resources;
    if (Array.isArray(resources)) {
      for (const r of resources) {
        if (!isRecord(r)) {
          continue;
        }
        const id =
          typeof r.id === 'number'
            ? r.id
            : typeof r.Id === 'number'
              ? r.Id
              : typeof r.resourceId === 'number'
                ? r.resourceId
                : typeof r.ResourceId === 'number'
                  ? r.ResourceId
                  : null;
        const nameRaw = r.name ?? r.Name;
        if (id != null && typeof nameRaw === 'string' && nameRaw.trim()) {
          out[id] = nameRaw.trim();
        }
      }
    }
    for (const v of Object.values(node)) {
      if (v !== null && typeof v === 'object') {
        visit(v);
      }
    }
  };

  visit(root);
  return out;
}
