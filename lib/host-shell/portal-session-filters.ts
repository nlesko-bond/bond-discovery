import type { DiscoveryFilters, Gender, Program, Session } from '@/types';
import { programIdsFilterMatches } from '@/lib/program-ids-filter';
import { getPortalAgeBucketById } from '@/lib/host-shell/portal-age-buckets';

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

function sessionMatchesAgeRange(
  session: Session,
  program: Program,
  ageRange?: DiscoveryFilters['ageRange'],
): boolean {
  if (ageRange?.min === undefined && ageRange?.max === undefined) {
    return true;
  }
  const ageMin = session.minAge ?? session.ageMin ?? program.ageMin;
  const ageMax = session.maxAge ?? session.ageMax ?? program.ageMax;
  if (ageRange?.min !== undefined && ageMax !== undefined && ageMax < ageRange.min) {
    return false;
  }
  if (ageRange?.max !== undefined && ageMin !== undefined && ageMin > ageRange.max) {
    return false;
  }
  return true;
}

function sessionMatchesGender(
  session: Session,
  program: Program,
  gender: Gender,
): boolean {
  const sessionGender = session.gender ?? program.gender;
  if (!sessionGender || sessionGender === 'all' || sessionGender === 'coed') {
    return true;
  }
  return sessionGender === gender;
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

  if (filters.ageBucketIds && filters.ageBucketIds.length > 0) {
    result = result.reduce<Program[]>((accumulator, program) => {
      const sessions = getSessionsFromProgram(program).filter((session) =>
        filters.ageBucketIds!.some((bucketId) => {
          const bucket = getPortalAgeBucketById(bucketId);
          if (!bucket) {
            return false;
          }
          return sessionMatchesAgeRange(session, program, {
            min: bucket.min,
            max: bucket.max,
          });
        }),
      );
      if (sessions.length === 0) {
        return accumulator;
      }
      accumulator.push({ ...program, sessions });
      return accumulator;
    }, []);
  } else if (filters.ageRange?.min !== undefined || filters.ageRange?.max !== undefined) {
    result = result.reduce<Program[]>((accumulator, program) => {
      const sessions = getSessionsFromProgram(program).filter((session) =>
        sessionMatchesAgeRange(session, program, filters.ageRange),
      );
      if (sessions.length === 0) {
        return accumulator;
      }
      accumulator.push({ ...program, sessions });
      return accumulator;
    }, []);
  }

  if (filters.genders && filters.genders.length > 0) {
    result = result.reduce<Program[]>((accumulator, program) => {
      const sessions = getSessionsFromProgram(program).filter((session) =>
        filters.genders!.some((gender) => sessionMatchesGender(session, program, gender)),
      );
      if (sessions.length === 0) {
        return accumulator;
      }
      accumulator.push({ ...program, sessions });
      return accumulator;
    }, []);
  } else if (filters.gender && filters.gender !== 'all') {
    result = result.reduce<Program[]>((accumulator, program) => {
      const sessions = getSessionsFromProgram(program).filter((session) =>
        sessionMatchesGender(session, program, filters.gender!),
      );
      if (sessions.length === 0) {
        return accumulator;
      }
      accumulator.push({ ...program, sessions });
      return accumulator;
    }, []);
  }

  if (filters.availabilityModes && filters.availabilityModes.length > 0) {
    result = result.filter((program) => {
      const sessions = getSessionsFromProgram(program);
      return filters.availabilityModes!.some((mode) => {
        if (mode === 'available') {
          return sessions.some((session) => !session.isFull);
        }
        if (mode === 'almost_full') {
          return sessions.some(
            (session) =>
              session.spotsRemaining !== undefined &&
              session.spotsRemaining > 0 &&
              session.spotsRemaining <= ALMOST_FULL_SPOTS_THRESHOLD,
          );
        }
        return false;
      });
    });
  } else if (filters.availability && filters.availability !== 'all') {
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
