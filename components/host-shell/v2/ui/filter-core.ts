import type { DiscoveryFilters, Gender, Program, ProgramType, Session } from '@/types';
import { filterProgramsForPortalSessions } from '@/lib/host-shell/portal-session-filters';
import { getPortalAgeBucketById } from '@/lib/host-shell/portal-age-buckets';

/**
 * Pure selection/count logic behind the v2 filter system (pill triggers +
 * inline-expanding panels). Kept free of React so it is directly unit-testable.
 */

export type V2FacetDimension =
  | 'ageBucketIds'
  | 'genders'
  | 'facilityIds'
  | 'programTypes';

export const V2_FACET_DIMENSIONS: V2FacetDimension[] = [
  'ageBucketIds',
  'genders',
  'facilityIds',
  'programTypes',
];

const GENDER_LABELS: Record<string, string> = {
  male: 'Boys',
  female: 'Girls',
};

/** Immutable multi-select toggle: adds the id when absent, removes it when present. */
export function toggleSelection(selected: readonly string[], id: string): string[] {
  return selected.includes(id)
    ? selected.filter((existing) => existing !== id)
    : [...selected, id];
}

export function getFacetSelection(
  filters: DiscoveryFilters,
  dimension: V2FacetDimension,
): string[] {
  const value = filters[dimension];
  return Array.isArray(value) ? (value as string[]) : [];
}

/**
 * Applies a facet selection immutably. Also resets the paired legacy
 * single-value fields (gender / ageRange) so the multi-select is the single
 * source of truth for its dimension.
 */
export function applyFacetSelection(
  filters: DiscoveryFilters,
  dimension: V2FacetDimension,
  selectedIds: string[],
): DiscoveryFilters {
  const normalized = selectedIds.length > 0 ? selectedIds : undefined;
  switch (dimension) {
    case 'ageBucketIds':
      return { ...filters, ageBucketIds: normalized, ageRange: {} };
    case 'genders':
      return {
        ...filters,
        genders: normalized as Array<Exclude<Gender, 'all'>> | undefined,
        gender: 'all',
      };
    case 'facilityIds':
      return { ...filters, facilityIds: normalized };
    case 'programTypes':
      return { ...filters, programTypes: normalized as ProgramType[] | undefined };
  }
}

function getSessionsFromProgram(program: Program): Session[] {
  const sessions = program.sessions;
  if (!sessions) {
    return [];
  }
  if (Array.isArray(sessions)) {
    return sessions;
  }
  if (typeof sessions === 'object' && 'data' in sessions) {
    const nested = sessions as { data?: Session[] };
    return nested.data ?? [];
  }
  return [];
}

function countSessions(programs: Program[]): number {
  return programs.reduce(
    (total, program) => total + getSessionsFromProgram(program).length,
    0,
  );
}

/**
 * Result count (session cards) for a candidate filter state — same pipeline the
 * grid uses (one card per session surviving `filterProgramsForPortalSessions`).
 */
export function countFilteredSessions(
  programs: Program[],
  filters: DiscoveryFilters,
): number {
  return countSessions(filterProgramsForPortalSessions(programs, filters));
}

/**
 * Faceted per-option result counts: for each option of `dimension`, the number
 * of session cards the page would show if that option were the dimension's only
 * selection while every OTHER active filter stays applied. This is what makes
 * the option counts "live" instead of static dataset counts.
 */
export function computeFacetCounts(
  programs: Program[],
  filters: DiscoveryFilters,
  dimension: V2FacetDimension,
  optionIds: readonly string[],
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const optionId of optionIds) {
    counts[optionId] = countFilteredSessions(
      programs,
      applyFacetSelection(filters, dimension, [optionId]),
    );
  }
  return counts;
}

function hasDateRange(filters: DiscoveryFilters): boolean {
  return Boolean(filters.dateRange?.start || filters.dateRange?.end);
}

/**
 * Total active selections across the secondary filters (everything inside the
 * mobile "Filters" sheet): facet selections + 1 for an active date range.
 */
export function countActiveSecondaryFilters(filters: DiscoveryFilters): number {
  const facetCount = V2_FACET_DIMENSIONS.reduce(
    (total, dimension) => total + getFacetSelection(filters, dimension).length,
    0,
  );
  return facetCount + (hasDateRange(filters) ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Active filter summary chips (removable "Ages 6–8 ×" row under the bar)
// ---------------------------------------------------------------------------

export interface IActiveFilterChip {
  /** Stable key for rendering + removal. */
  key: string;
  /** Visible chip label, e.g. "Ages 6–8". */
  label: string;
  dimension: V2FacetDimension | 'dateRange' | 'search';
  /** Option id for facet chips; absent for search / dateRange. */
  id?: string;
}

export interface IActiveFilterChipContext {
  /** facility id → display name */
  facilityNames: Map<string, string>;
  /** program type id → display label */
  programTypeLabel: (id: string) => string;
}

function formatChipDate(iso: string): string {
  const [year, month, day] = iso.split('-').map(Number);
  if (!year || !month || !day) {
    return iso;
  }
  return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    timeZone: 'UTC',
  });
}

function dateRangeChipLabel(filters: DiscoveryFilters): string {
  const start = filters.dateRange?.start;
  const end = filters.dateRange?.end;
  if (start && end) {
    return `${formatChipDate(start)} – ${formatChipDate(end)}`;
  }
  if (start) {
    return `From ${formatChipDate(start)}`;
  }
  return `Until ${formatChipDate(end as string)}`;
}

/**
 * Removable summary chips for every active SECONDARY filter (+ search + dates).
 * Activity (sport) selections are deliberately excluded — they are already
 * visible and directly toggleable in the hero chip row.
 */
export function buildActiveFilterChips(
  filters: DiscoveryFilters,
  context: IActiveFilterChipContext,
): IActiveFilterChip[] {
  const chips: IActiveFilterChip[] = [];

  if (filters.search?.trim()) {
    chips.push({
      key: 'search',
      label: `“${filters.search.trim()}”`,
      dimension: 'search',
    });
  }

  for (const id of getFacetSelection(filters, 'ageBucketIds')) {
    chips.push({
      key: `age:${id}`,
      label: getPortalAgeBucketById(id)?.label ?? id,
      dimension: 'ageBucketIds',
      id,
    });
  }

  for (const id of getFacetSelection(filters, 'genders')) {
    chips.push({
      key: `gender:${id}`,
      label: GENDER_LABELS[id] ?? id,
      dimension: 'genders',
      id,
    });
  }

  for (const id of getFacetSelection(filters, 'facilityIds')) {
    chips.push({
      key: `facility:${id}`,
      label: context.facilityNames.get(id) ?? id,
      dimension: 'facilityIds',
      id,
    });
  }

  for (const id of getFacetSelection(filters, 'programTypes')) {
    chips.push({
      key: `type:${id}`,
      label: context.programTypeLabel(id),
      dimension: 'programTypes',
      id,
    });
  }

  if (hasDateRange(filters)) {
    chips.push({
      key: 'dateRange',
      label: dateRangeChipLabel(filters),
      dimension: 'dateRange',
    });
  }

  return chips;
}

/** Next filter state after the user removes one summary chip. */
export function removeFilterChip(
  filters: DiscoveryFilters,
  chip: IActiveFilterChip,
): DiscoveryFilters {
  if (chip.dimension === 'search') {
    return { ...filters, search: '' };
  }
  if (chip.dimension === 'dateRange') {
    return { ...filters, dateRange: {} };
  }
  const next = getFacetSelection(filters, chip.dimension).filter(
    (id) => id !== chip.id,
  );
  return applyFacetSelection(filters, chip.dimension, next);
}
