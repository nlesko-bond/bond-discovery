import type { Program } from '@/types';
import type { Session } from '@/types';

export interface IPortalFilterFacility {
  id: string;
  name: string;
  count: number;
}

export interface IPortalFilterOption {
  id: string;
  label: string;
  count: number;
}

export interface IPortalProgramFilterOption {
  id: string;
  name: string;
  facilityId?: string;
  facilityName?: string;
}

export interface IPortalSessionFilterOption {
  id: string;
  name: string;
  programId: string;
}

export interface IPortalFilterOptions {
  facilities: IPortalFilterFacility[];
  hasMultipleFacilities: boolean;
  sports: IPortalFilterOption[];
  programTypes: IPortalFilterOption[];
  programs: IPortalProgramFilterOption[];
  sessions: IPortalSessionFilterOption[];
}

function getSessions(program: Program): Session[] {
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

function resolveSessionFacility(
  session: Session,
  program: Program,
): { id: string; name: string } | null {
  if (session.facility?.id !== undefined && session.facility.id !== null) {
    const id = String(session.facility.id);
    return {
      id,
      name: session.facility.name || id,
    };
  }
  if (program.facilityId !== undefined && program.facilityId !== null) {
    const id = String(program.facilityId);
    return {
      id,
      name: program.facilityName || id,
    };
  }
  return null;
}

/**
 * Builds filter option counts from sessions (session.facility, session.sport), not program-level only.
 */
export function buildPortalFilterOptions(programs: Program[]): IPortalFilterOptions {
  const facilities = new Map<string, IPortalFilterFacility>();
  const sports = new Map<string, number>();
  const programTypes = new Map<string, number>();
  const programList: IPortalProgramFilterOption[] = [];
  const sessionList: IPortalSessionFilterOption[] = [];

  programs.forEach((program) => {
    const sessions = getSessions(program);
    const firstFacility = sessions.map((s) => resolveSessionFacility(s, program)).find(Boolean);

    programList.push({
      id: program.id,
      name: program.name,
      facilityId: firstFacility?.id,
      facilityName: firstFacility?.name,
    });

    sessions.forEach((session) => {
      sessionList.push({
        id: session.id,
        name: session.name || `Session ${session.id}`,
        programId: program.id,
      });

      const facility = resolveSessionFacility(session, program);
      if (facility) {
        const existing = facilities.get(facility.id);
        if (existing) {
          existing.count += 1;
        } else {
          facilities.set(facility.id, {
            id: facility.id,
            name: facility.name,
            count: 1,
          });
        }
      }

      const sportKey = session.sport ?? program.sport;
      if (sportKey) {
        sports.set(sportKey, (sports.get(sportKey) || 0) + 1);
      }
    });

    if (program.type) {
      programTypes.set(program.type, (programTypes.get(program.type) || 0) + sessions.length);
    }
  });

  const facilitiesList = Array.from(facilities.values()).sort((a, b) =>
    a.name.localeCompare(b.name),
  );

  return {
    facilities: facilitiesList,
    hasMultipleFacilities: facilitiesList.length > 1,
    sports: Array.from(sports.entries())
      .map(([id, count]) => ({ id, label: id, count }))
      .sort((a, b) => b.count - a.count),
    programTypes: Array.from(programTypes.entries())
      .map(([id, count]) => ({ id, label: id, count }))
      .sort((a, b) => b.count - a.count),
    programs: programList,
    sessions: sessionList,
  };
}
