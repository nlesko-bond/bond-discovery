import { useState, useEffect } from 'react';
import { bondClient } from '../api/bondClient';
import { Program, Session, DiscoveryFilters } from '../types/bond';

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
        
        for (const orgId of orgIds) {
          try {
            const orgPrograms = await bondClient.getPrograms(orgId);
            allPrograms.push(...(orgPrograms || []));
          } catch (err) {
            console.error(`Error fetching programs for org ${orgId}:`, err);
          }
        }
        
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
) {
  const [filtered, setFiltered] = useState<Program[]>(programs);

  useEffect(() => {
    let result = [...programs];

    // Filter by program name
    if (filters.program_name) {
      const query = filters.program_name.toLowerCase();
      result = result.filter(p =>
        p.name?.toLowerCase().includes(query)
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
        if (!p.sessions || p.sessions.length === 0) return false;
        
        return p.sessions.some(s => {
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

    setFiltered(result);
  }, [programs, filters]);

  return filtered;
}
