import { useState, useEffect, useMemo } from 'react';
import { bondClient } from '../api/bondClient';
import { 
  Program, 
  Session, 
  DiscoveryFilters, 
  ScheduleItem, 
  DaySchedule,
  WeekSchedule 
} from '../types/bond';
import { 
  format, 
  parseISO, 
  startOfWeek, 
  endOfWeek, 
  eachDayOfInterval, 
  isToday, 
  isPast,
  addWeeks
} from 'date-fns';

// Helper to safely extract sessions array from a program
// API might return sessions as { data: [], meta: {} } or as a direct array
function getSessions(program: Program): Session[] {
  let sessions = program.sessions;
  if (!sessions) return [];
  if (Array.isArray(sessions)) return sessions;
  if (typeof sessions === 'object' && 'data' in sessions) {
    return (sessions as any).data || [];
  }
  return [];
}

export function usePrograms(orgIds: string[]) {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchPrograms = async () => {
      setLoading(true);
      setError(null);
      try {
        const allPrograms: Program[] = [];
        
        // Fetch in parallel for better performance
        const promises = orgIds.map(async (orgId) => {
          try {
            const orgPrograms = await bondClient.getPrograms(orgId);
            return (orgPrograms || []).map(p => ({ ...p, org_id: orgId }));
          } catch (err) {
            console.error(`Error fetching programs for org ${orgId}:`, err);
            return [];
          }
        });
        
        const results = await Promise.all(promises);
        results.forEach(progs => allPrograms.push(...progs));
        
        setPrograms(allPrograms);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch programs');
      } finally {
        setLoading(false);
      }
    };

    if (orgIds.length > 0) {
      fetchPrograms();
    }
  }, [orgIds.join(',')]);

  return { programs, loading, error };
}

export function useSessions(orgId: string, programId: string) {
  const [sessions, setSessions] = useState<Session[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orgId || !programId) return;

    const fetchSessions = async () => {
      setLoading(true);
      setError(null);
      try {
        const data = await bondClient.getSessions(orgId, programId);
        setSessions(data || []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to fetch sessions');
      } finally {
        setLoading(false);
      }
    };

    fetchSessions();
  }, [orgId, programId]);

  return { sessions, loading, error };
}

export function useFilteredPrograms(
  programs: Program[],
  filters: DiscoveryFilters
): Program[] {
  return useMemo(() => {
    let result = [...programs];

    // Filter by program name
    if (filters.program_name) {
      const query = filters.program_name.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    // Filter by program types
    if (filters.program_types && filters.program_types.length > 0) {
      result = result.filter(p =>
        filters.program_types!.includes(p.type || '')
      );
    }

    // Filter by sports
    if (filters.sports && filters.sports.length > 0) {
      result = result.filter(p =>
        filters.sports!.includes(p.sport || '')
      );
    }

    // Filter by facility
    if (filters.facility_ids && filters.facility_ids.length > 0) {
      result = result.filter(p =>
        filters.facility_ids!.includes(p.facility_id || '')
      );
    }

    // Filter by date range (session-based)
    if (filters.start_date || filters.end_date) {
      result = result.filter(p => {
        const sessions = getSessions(p);
        if (sessions.length === 0) return true; // Include programs without sessions
        
        return sessions.some(s => {
          const sessionStart = s.start_date ? new Date(s.start_date) : null;
          const sessionEnd = s.end_date ? new Date(s.end_date) : null;
          
          const filterStart = filters.start_date ? new Date(filters.start_date) : null;
          const filterEnd = filters.end_date ? new Date(filters.end_date) : null;

          if (filterStart && sessionEnd && sessionEnd < filterStart) return false;
          if (filterEnd && sessionStart && sessionStart > filterEnd) return false;
          
          return true;
        });
      });
    }

    return result;
  }, [programs, filters]);
}

// Schedule view hook - transforms programs into calendar format
export function useSchedule(
  programs: Program[],
  filters: DiscoveryFilters,
  weeksToShow: number = 4
): { schedule: WeekSchedule[]; loading: boolean } {
  const schedule = useMemo(() => {
    const filteredPrograms = programs.filter(p => {
      // Apply same filters as program view
      if (filters.program_name) {
        const query = filters.program_name.toLowerCase();
        if (!p.name?.toLowerCase().includes(query)) return false;
      }
      if (filters.program_types?.length && !filters.program_types.includes(p.type || '')) {
        return false;
      }
      if (filters.sports?.length && !filters.sports.includes(p.sport || '')) {
        return false;
      }
      if (filters.facility_ids?.length && !filters.facility_ids.includes(p.facility_id || '')) {
        return false;
      }
      return true;
    });

    // Generate schedule items from sessions
    const scheduleItems: ScheduleItem[] = [];
    
    filteredPrograms.forEach(program => {
      const sessions = getSessions(program);
      
      sessions.forEach(session => {
        if (!session.start_date) return;
        
        const spotsRemaining = session.capacity 
          ? session.capacity - (session.current_enrollment || 0)
          : undefined;
        
        scheduleItems.push({
          id: `${program.id}-${session.id}`,
          date: session.start_date.split('T')[0],
          time_start: session.start_time,
          time_end: session.end_time,
          program,
          session,
          type: 'session_start',
          spots_remaining: spotsRemaining,
          is_full: spotsRemaining !== undefined && spotsRemaining <= 0,
        });
      });
    });

    // Build week schedules
    const today = new Date();
    const weeks: WeekSchedule[] = [];
    
    for (let i = 0; i < weeksToShow; i++) {
      const weekDate = addWeeks(today, i);
      const weekStart = startOfWeek(weekDate, { weekStartsOn: 0 });
      const weekEnd = endOfWeek(weekDate, { weekStartsOn: 0 });
      
      const days = eachDayOfInterval({ start: weekStart, end: weekEnd });
      
      const daySchedules: DaySchedule[] = days.map(day => {
        const dateStr = format(day, 'yyyy-MM-dd');
        const dayItems = scheduleItems.filter(item => item.date === dateStr);
        
        // Sort by time
        dayItems.sort((a, b) => {
          if (!a.time_start) return 1;
          if (!b.time_start) return -1;
          return a.time_start.localeCompare(b.time_start);
        });
        
        return {
          date: dateStr,
          dayOfWeek: format(day, 'EEE'),
          items: dayItems,
          isToday: isToday(day),
          isPast: isPast(day) && !isToday(day),
        };
      });
      
      weeks.push({
        weekStart: format(weekStart, 'yyyy-MM-dd'),
        weekEnd: format(weekEnd, 'yyyy-MM-dd'),
        days: daySchedules,
      });
    }
    
    return weeks;
  }, [programs, filters, weeksToShow]);

  return { schedule, loading: false };
}

// Get unique values from programs for filter options
export function useProgramFilters(programs: Program[]) {
  return useMemo(() => {
    const facilities = new Map<string, string>();
    const programTypes = new Set<string>();
    const sports = new Set<string>();
    
    programs.forEach(p => {
      if (p.facility_id) {
        facilities.set(p.facility_id, p.facility_name || p.facility_id);
      }
      if (p.type) programTypes.add(p.type);
      if (p.sport) sports.add(p.sport);
    });
    
    return {
      facilities: Array.from(facilities.entries()).map(([id, name]) => ({ id, name })),
      programTypes: Array.from(programTypes).sort(),
      sports: Array.from(sports).sort(),
    };
  }, [programs]);
}
