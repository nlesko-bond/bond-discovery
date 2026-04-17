import type { DiscoveryConfig, DiscoveryFilters, Program } from '@/types';

/**
 * League-specific schedule table + CSV export only when the admin feature is on
 * and the visitor has narrowed to league programs (type filter = league only,
 * or one-or-more selected programs that are all leagues).
 */
export function isLeagueScheduleTableContext(
  config: DiscoveryConfig,
  filters: DiscoveryFilters,
  programs: Program[],
): boolean {
  if (config.features.showLeagueScheduleTableAndExport !== true) {
    return false;
  }

  if (filters.programTypes?.length === 1 && filters.programTypes[0] === 'league') {
    return true;
  }

  if (filters.programIds && filters.programIds.length > 0) {
    const selected = programs.filter((p) => filters.programIds!.includes(p.id));
    if (selected.length === 0) return false;
    return selected.every((p) => p.type === 'league');
  }

  return false;
}
