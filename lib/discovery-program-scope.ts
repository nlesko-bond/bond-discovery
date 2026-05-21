import { programIdsFilterMatches } from '@/lib/program-ids-filter';
import type { DiscoveryConfig, Program } from '@/types';

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
  return normalizeProgramIdList(config.excludedProgramIds);
}

/**
 * Apply admin program include / exclude / all modes (string-safe ID matching).
 */
export function filterProgramsByPageConfig(
  programs: Program[],
  config: DiscoveryConfig,
): Program[] {
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
