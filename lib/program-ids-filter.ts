/**
 * Returns true when `id` is included in `programIds`, comparing as strings so URL
 * query params match numeric API ids.
 */
export function programIdsFilterMatches(programIds: string[] | undefined, id: unknown): boolean {
  if (!programIds || programIds.length === 0) return false;
  const sid = String(id);
  return programIds.some((pid) => String(pid) === sid);
}
