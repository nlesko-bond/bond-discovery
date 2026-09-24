import { programIdsFilterMatches } from '@/lib/program-ids-filter';
import type { DiscoveryConfig, Program, ProgramType } from '@/types';

export const PROGRAMS_DISCOVERY_EXPAND =
  'sessions,sessions.products,sessions.products.prices';

function normalizeProgramIdList(ids: string[] | undefined): string[] {
  if (!ids?.length) {
    return [];
  }
  return ids.map((id) => String(id).trim()).filter(Boolean);
}

/**
 * Included program IDs from page config (root mirrors features after rowToConfig).
 */
export function getDiscoveryIncludedProgramIds(config: DiscoveryConfig): string[] {
  const root = normalizeProgramIdList(config.includedProgramIds);
  if (root.length > 0) {
    return root;
  }
  return normalizeProgramIdList(config.features.includedProgramIds);
}

/**
 * Excluded program IDs from page config.
 */
export function getDiscoveryExcludedProgramIds(config: DiscoveryConfig): string[] {
  const root = normalizeProgramIdList(config.excludedProgramIds);
  if (root.length > 0) {
    return root;
  }
  return normalizeProgramIdList(config.features.excludedProgramIds);
}

/**
 * Whether a program should be omitted from discovery fetches (events pipeline).
 */
export function shouldSkipProgramByPageConfig(
  programId: unknown,
  config: DiscoveryConfig,
): boolean {
  const mode = config.features.programFilterMode || 'all';
  const included = getDiscoveryIncludedProgramIds(config);
  const excluded = getDiscoveryExcludedProgramIds(config);

  if (mode === 'include' && included.length > 0) {
    return !programIdsFilterMatches(included, programId);
  }
  if (mode === 'exclude' && excluded.length > 0) {
    return programIdsFilterMatches(excluded, programId);
  }
  return false;
}

/**
 * Page-level program type scope (lowercased, deduped). Empty = every type.
 */
export function getProgramTypeScope(config: DiscoveryConfig): string[] {
  const scope = config.features.programTypeScope;
  if (!Array.isArray(scope) || scope.length === 0) {
    return [];
  }
  return Array.from(
    new Set(scope.map((type) => String(type).trim().toLowerCase()).filter(Boolean)),
  );
}

function matchesProgramTypeScope(type: unknown, scope: string[]): boolean {
  return typeof type === 'string' && scope.includes(type.toLowerCase());
}

/**
 * Drops events outside the page's program type scope. Events carry the
 * program type as `programType` (falling back to `type`, as elsewhere).
 * Returns the input array untouched when no scope is set.
 */
export function filterDiscoveryEventsByProgramTypeScope<
  T extends { programType?: unknown; type?: unknown },
>(events: T[], config: DiscoveryConfig): T[] {
  const scope = getProgramTypeScope(config);
  if (scope.length === 0) {
    return events;
  }
  return events.filter((event) =>
    matchesProgramTypeScope(event.programType ?? event.type, scope),
  );
}

/**
 * Drops schedule events whose program is filtered out by page config
 * (program IDs, then program type scope). Applied when serving precomputed
 * KV payloads, which are warmed unscoped and may predate filter changes.
 */
export function filterDiscoveryEventsByPageConfig<
  T extends { programId?: unknown; programType?: unknown; type?: unknown },
>(events: T[], config: DiscoveryConfig): T[] {
  const mode = config.features.programFilterMode || 'all';
  const byId =
    mode === 'all'
      ? events
      : events.filter((event) => !shouldSkipProgramByPageConfig(event.programId, config));
  return filterDiscoveryEventsByProgramTypeScope(byId, config);
}

/**
 * Apply admin program include / exclude / all modes (string-safe ID matching).
 */
export function filterProgramsByPageConfig(
  programs: Program[],
  config: DiscoveryConfig,
): Program[] {
  return filterProgramsByTypeScope(filterProgramsByIds(programs, config), config);
}

function filterProgramsByIds(programs: Program[], config: DiscoveryConfig): Program[] {
  const mode = config.features.programFilterMode || 'all';
  const included = getDiscoveryIncludedProgramIds(config);
  const excluded = getDiscoveryExcludedProgramIds(config);

  if (mode === 'include' && included.length > 0) {
    return programs.filter((program) => programIdsFilterMatches(included, program.id));
  }
  if (mode === 'exclude' && excluded.length > 0) {
    return programs.filter((program) => !programIdsFilterMatches(excluded, program.id));
  }
  return programs;
}

function filterProgramsByTypeScope(programs: Program[], config: DiscoveryConfig): Program[] {
  const scope = getProgramTypeScope(config);
  if (scope.length === 0) {
    return programs;
  }
  return programs.filter((program) => matchesProgramTypeScope(program.type, scope));
}

/** Program types the admin can scope a page to (Bond's programTypes enum). */
export const SCOPABLE_PROGRAM_TYPES: ProgramType[] = [
  'league',
  'tournament',
  'club_team',
  'class',
  'clinic',
  'camp',
  'lesson',
];

/**
 * Compare session end dates using the calendar day (YYYY-MM-DD), not full ISO strings.
 */
export function sessionEndDateOnOrAfterToday(
  sessionEndDate: string | undefined,
  todayYmd: string,
): boolean {
  if (!sessionEndDate) {
    return true;
  }
  const sessionDay = sessionEndDate.slice(0, 10);
  return sessionDay >= todayYmd;
}

/**
 * Drops past sessions and programs that have no remaining sessions.
 */
export function filterProgramsWithActiveSessions(
  programs: Program[],
  todayYmd?: string,
): Program[] {
  const today = todayYmd ?? new Date().toISOString().split('T')[0];

  const withSessions = programs.map((program) => {
    if (!program.sessions) {
      return program;
    }
    const sessions = program.sessions.filter((session) =>
      sessionEndDateOnOrAfterToday(session.endDate, today),
    );
    return { ...program, sessions };
  });

  return withSessions.filter((program) => !program.sessions || program.sessions.length > 0);
}
