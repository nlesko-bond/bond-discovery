import type { DiscoveryConfig, DiscoveryFilters, Program, ProgramType } from '@/types';
import { programIdsFilterMatches } from '@/lib/program-ids-filter';
import {
  eventMatchesDateRange,
  eventMatchesDaysOfWeek,
  eventMatchesSpaceNames,
} from '@/lib/schedule-event-filters';
import { buildWeekSchedules } from '@/lib/transformers';
import { getSportGradient } from '@/lib/utils';

const ALMOST_FULL_SPOTS_THRESHOLD = 5;

export interface IDiscoveryApiEvent {
  id: string;
  programId?: string;
  programName?: string;
  sessionId?: string;
  sessionName?: string;
  title?: string;
  startDate?: string;
  endDate?: string;
  timezone?: string;
  facilityName?: string;
  facilityId?: string;
  spaceName?: string;
  sport?: string;
  type?: string;
  linkSEO?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  spotsRemaining?: number;
  startingPrice?: number;
  memberPrice?: number;
  registrationWindowStatus?: string;
  isWaitlistEnabled?: boolean;
  waitlistCount?: number;
  segmentId?: string;
  segmentName?: string;
  isSegmented?: boolean;
  hasPunchPassProduct?: boolean;
}

function getLocalDateTime(utcDateStr: string, timezone?: string): { date: string; startTime: string } {
  if (!utcDateStr) {
    return { date: '', startTime: '' };
  }
  try {
    const utcDate = new Date(utcDateStr);
    const tz = timezone || 'America/New_York';
    const localDate = utcDate.toLocaleDateString('en-CA', { timeZone: tz });
    return { date: localDate, startTime: utcDateStr };
  } catch {
    return { date: utcDateStr.split('T')[0], startTime: utcDateStr };
  }
}

export function filterPortalScheduleEvents(
  apiEvents: IDiscoveryApiEvent[],
  filters: DiscoveryFilters,
  programs: Program[],
  showScheduleTableDateFilters: boolean,
): IDiscoveryApiEvent[] {
  let result = [...apiEvents];

  if (filters.programIds && filters.programIds.length > 0) {
    const selectedPrograms = programs.filter((program) =>
      programIdsFilterMatches(filters.programIds, program.id),
    );
    result = result.filter((event) => {
      if (programIdsFilterMatches(filters.programIds, event.programId)) {
        return true;
      }
      const eventProgramName = (event.programName || '').toLowerCase().trim();
      const eventFacilityName = (event.facilityName || '').toLowerCase().trim();
      return selectedPrograms.some((program) => {
        const programName = program.name.toLowerCase().trim();
        if (programName !== eventProgramName) {
          return false;
        }
        const programFacilityName = (program.facilityName || '').toLowerCase().trim();
        if (programFacilityName && eventFacilityName) {
          return programFacilityName === eventFacilityName;
        }
        return !programFacilityName || !eventFacilityName;
      });
    });
  }

  if (filters.sessionIds && filters.sessionIds.length > 0) {
    const sessionIdSet = new Set(filters.sessionIds.map(String));
    result = result.filter(
      (event) => event.sessionId && sessionIdSet.has(String(event.sessionId)),
    );
  }

  if (filters.facilityIds && filters.facilityIds.length > 0) {
    const facilityIdToName = new Map<string, string>();
    programs.forEach((program) => {
      if (program.facilityId && program.facilityName) {
        facilityIdToName.set(program.facilityId, program.facilityName.toLowerCase());
      }
    });
    const selectedFacilityNames = filters.facilityIds
      .map((id) => facilityIdToName.get(id) || id.toLowerCase())
      .filter(Boolean);

    result = result.filter((event) => {
      const eventFacilityName = event.facilityName?.toLowerCase() || '';
      const eventFacilityId = event.facilityId ? String(event.facilityId) : '';
      return filters.facilityIds!.some((id) => {
        if (eventFacilityId === id) {
          return true;
        }
        return selectedFacilityNames.some(
          (name) => eventFacilityName === name || eventFacilityName.includes(name),
        );
      });
    });
  }

  if (filters.search) {
    const search = filters.search.toLowerCase();
    result = result.filter(
      (event) =>
        event.title?.toLowerCase().includes(search) ||
        event.programName?.toLowerCase().includes(search) ||
        event.sessionName?.toLowerCase().includes(search) ||
        event.facilityName?.toLowerCase().includes(search) ||
        (event.spaceName && event.spaceName.toLowerCase().includes(search)),
    );
  }

  if (filters.spaceNames && filters.spaceNames.length > 0) {
    result = result.filter((event) => eventMatchesSpaceNames(event, filters.spaceNames));
  }

  if (filters.programTypes && filters.programTypes.length > 0) {
    result = result.filter((event) => filters.programTypes!.includes(event.type as ProgramType));
  }

  if (filters.sports && filters.sports.length > 0) {
    result = result.filter((event) => event.sport && filters.sports!.includes(event.sport));
  }

  if (filters.genders && filters.genders.length > 0) {
    const programGenderMap = new Map<string, string>();
    programs.forEach((program) => {
      programGenderMap.set(program.id, program.gender || 'all');
    });
    result = result.filter((event) => {
      const gender = programGenderMap.get(event.programId || '') || 'all';
      if (gender === 'all' || gender === 'coed') {
        return true;
      }
      return filters.genders!.includes(gender as (typeof filters.genders)[number]);
    });
  } else if (filters.gender && filters.gender !== 'all') {
    const programGenderMap = new Map<string, string>();
    programs.forEach((program) => {
      programGenderMap.set(program.id, program.gender || 'all');
    });
    result = result.filter((event) => {
      const gender = programGenderMap.get(event.programId || '') || 'all';
      return gender === 'all' || gender === filters.gender;
    });
  }

  if (filters.availabilityModes && filters.availabilityModes.length > 0) {
    result = result.filter((event) =>
      filters.availabilityModes!.some((mode) => {
        if (mode === 'available') {
          return event.spotsRemaining === undefined || event.spotsRemaining > 0;
        }
        if (mode === 'almost_full') {
          return (
            event.spotsRemaining !== undefined &&
            event.spotsRemaining > 0 &&
            event.spotsRemaining <= ALMOST_FULL_SPOTS_THRESHOLD
          );
        }
        return false;
      }),
    );
  } else if (filters.availability && filters.availability !== 'all') {
    if (filters.availability === 'available') {
      result = result.filter(
        (event) => event.spotsRemaining === undefined || event.spotsRemaining > 0,
      );
    } else if (filters.availability === 'almost_full') {
      result = result.filter(
        (event) =>
          event.spotsRemaining !== undefined &&
          event.spotsRemaining > 0 &&
          event.spotsRemaining <= ALMOST_FULL_SPOTS_THRESHOLD,
      );
    }
  }

  if (showScheduleTableDateFilters) {
    if (filters.dateRange?.start || filters.dateRange?.end) {
      result = result.filter(
        (event) =>
          Boolean(event.startDate) &&
          eventMatchesDateRange(
            { startDate: event.startDate as string, timezone: event.timezone },
            filters.dateRange,
          ),
      );
    }
    if (filters.daysOfWeek && filters.daysOfWeek.length > 0) {
      result = result.filter(
        (event) =>
          Boolean(event.startDate) &&
          eventMatchesDaysOfWeek(
            { startDate: event.startDate as string, timezone: event.timezone },
            filters.daysOfWeek,
          ),
      );
    }
  }

  return result;
}

const SCHEDULE_WEEK_COUNT = 8;

export function buildPortalScheduleWeeks(filteredEvents: IDiscoveryApiEvent[]) {
  const calendarEvents = filteredEvents.map((event) => {
    const { date, startTime } = getLocalDateTime(event.startDate ?? '', event.timezone);
    const { startTime: endTime } = getLocalDateTime(event.endDate ?? '', event.timezone);

    return {
      id: event.id,
      programId: event.programId || '',
      programName: event.programName || event.title || '',
      sessionId: event.sessionId || '',
      sessionName: event.sessionName || '',
      title: event.title || event.sessionName || event.programName,
      date,
      startTime,
      endTime,
      timezone: event.timezone,
      facilityId: '',
      facilityName: event.facilityName || '',
      spaceName: event.spaceName || '',
      sport: event.sport,
      programType: event.type as ProgramType | undefined,
      type: event.type,
      linkSEO: event.linkSEO,
      color: getSportGradient(event.sport || ''),
      maxParticipants: event.maxParticipants,
      currentParticipants: event.currentParticipants,
      spotsRemaining: event.spotsRemaining,
      startingPrice: event.startingPrice,
      memberPrice: event.memberPrice,
      registrationWindowStatus: event.registrationWindowStatus,
      isWaitlistEnabled: event.isWaitlistEnabled,
      waitlistCount: event.waitlistCount,
      segmentId: event.segmentId,
      segmentName: event.segmentName,
      isSegmented: event.isSegmented,
      hasPunchPassProduct: Boolean(event.hasPunchPassProduct),
    };
  });

  return buildWeekSchedules(calendarEvents, SCHEDULE_WEEK_COUNT);
}

export function resolvePortalScheduleLinkTarget(
  config: DiscoveryConfig,
): '_blank' | '_top' | '_self' {
  const linkBehavior = config.features.linkBehavior || 'new_tab';
  if (linkBehavior === 'same_window') {
    return '_top';
  }
  if (linkBehavior === 'in_frame') {
    return '_self';
  }
  return '_blank';
}
