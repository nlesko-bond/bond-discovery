import type { DiscoveryFilters, Program, Session } from '@/types';
import { programIdsFilterMatches } from '@/lib/program-ids-filter';

const ALMOST_FULL_SPOTS_THRESHOLD = 5;

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

function programMatchesSearch(program: Program, query: string): boolean {
  const lower = query.toLowerCase();
  if (program.name.toLowerCase().includes(lower)) {
    return true;
  }
  if (program.description?.toLowerCase().includes(lower)) {
    return true;
  }
  if (program.sport?.toLowerCase().includes(lower)) {
    return true;
  }
  return getSessionsFromProgram(program).some(
    (session) =>
      session.name?.toLowerCase().includes(lower) ||
      session.description?.toLowerCase().includes(lower),
  );
}

/**
 * Filters programs before session cards are built (same dimensions as DiscoveryPage program filters).
 */
export function filterProgramsForPortalSessions(
  programs: Program[],
  filters: DiscoveryFilters,
): Program[] {
  let result = [...programs];

  if (filters.search?.trim()) {
    const query = filters.search.trim();
    result = result.filter((program) => programMatchesSearch(program, query));
  }

  if (filters.programIds && filters.programIds.length > 0) {
    result = result.filter((program) => programIdsFilterMatches(filters.programIds, program.id));
  }

  if (filters.facilityIds && filters.facilityIds.length > 0) {
    result = result.filter((program) => {
      if (program.facilityId && filters.facilityIds!.includes(program.facilityId)) {
        return true;
      }
      return getSessionsFromProgram(program).some(
        (session) =>
          session.facility && filters.facilityIds!.includes(String(session.facility.id)),
      );
    });
  }

  if (filters.programTypes && filters.programTypes.length > 0) {
    result = result.filter(
      (program) => program.type && filters.programTypes!.includes(program.type),
    );
  }

  if (filters.sports && filters.sports.length > 0) {
    result = result.filter((program) => program.sport && filters.sports!.includes(program.sport));
  }

  if (filters.ageRange?.min !== undefined || filters.ageRange?.max !== undefined) {
    result = result.filter((program) => {
      if (filters.ageRange?.min !== undefined && program.ageMax !== undefined) {
        if (program.ageMax < filters.ageRange.min) {
          return false;
        }
      }
      if (filters.ageRange?.max !== undefined && program.ageMin !== undefined) {
        if (program.ageMin > filters.ageRange.max) {
          return false;
        }
      }
      return true;
    });
  }

  if (filters.gender && filters.gender !== 'all') {
    result = result.filter(
      (program) => !program.gender || program.gender === 'all' || program.gender === filters.gender,
    );
  }

  if (filters.availability && filters.availability !== 'all') {
    result = result.filter((program) => {
      const sessions = getSessionsFromProgram(program);
      if (filters.availability === 'available') {
        return sessions.some((session) => !session.isFull);
      }
      if (filters.availability === 'almost_full') {
        return sessions.some(
          (session) =>
            session.spotsRemaining !== undefined &&
            session.spotsRemaining > 0 &&
            session.spotsRemaining <= ALMOST_FULL_SPOTS_THRESHOLD,
        );
      }
      return true;
    });
  }

  if (filters.dateRange?.start || filters.dateRange?.end) {
    result = result.filter((program) => {
      const sessions = getSessionsFromProgram(program);
      if (sessions.length === 0) {
        return true;
      }
      return sessions.some((session) => {
        const sessionStart = session.startDate ? new Date(session.startDate) : null;
        const sessionEnd = session.endDate ? new Date(session.endDate) : null;
        const filterStart = filters.dateRange?.start ? new Date(filters.dateRange.start) : null;
        const filterEnd = filters.dateRange?.end ? new Date(filters.dateRange.end) : null;
        if (filterStart && sessionEnd && sessionEnd < filterStart) {
          return false;
        }
        if (filterEnd && sessionStart && sessionStart > filterEnd) {
          return false;
        }
        return true;
      });
    });
  }

  if (filters.sessionIds && filters.sessionIds.length > 0) {
    result = result.reduce<Program[]>((accumulator, program) => {
      const sessions = getSessionsFromProgram(program).filter((session) =>
        filters.sessionIds!.includes(session.id),
      );
      if (sessions.length === 0) {
        return accumulator;
      }
      accumulator.push({ ...program, sessions });
      return accumulator;
    }, []);
  }

  return result;
}
