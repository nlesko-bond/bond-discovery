'use client';

import { useState, useMemo, useCallback } from 'react';
import { ProgramGrid } from '@/components/discovery/ProgramGrid';
import { ScheduleView } from '@/components/discovery/ScheduleView';
import { HorizontalFilterBar } from '@/components/discovery/HorizontalFilterBar';
import { Program, DiscoveryConfig, DiscoveryFilters, ViewMode, CalendarEvent } from '@/types';
import { Calendar, Grid3X3, Filter } from 'lucide-react';

interface EmbedDiscoveryPageProps {
  initialPrograms: Program[];
  config: DiscoveryConfig;
  initialViewMode?: ViewMode;
  searchParams: { [key: string]: string | string[] | undefined };
}

export function EmbedDiscoveryPage({
  initialPrograms,
  config,
  initialViewMode = 'programs',
  searchParams,
}: EmbedDiscoveryPageProps) {
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [filters, setFilters] = useState<DiscoveryFilters>({
    search: (searchParams.search as string) || '',
    programIds: searchParams.programIds 
      ? (searchParams.programIds as string).split('_') 
      : [],
    facilityIds: searchParams.facilityIds 
      ? (searchParams.facilityIds as string).split('_') 
      : [],
    programTypes: searchParams.programTypes 
      ? (searchParams.programTypes as string).split('_') as any[]
      : [],
    sports: searchParams.sports 
      ? (searchParams.sports as string).split('_') 
      : [],
  });

  // Filter programs
  const filteredPrograms = useMemo(() => {
    let result = [...initialPrograms];

    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query)
      );
    }

    if (filters.programIds && filters.programIds.length > 0) {
      result = result.filter(p => filters.programIds!.includes(p.id));
    }

    if (filters.facilityIds && filters.facilityIds.length > 0) {
      result = result.filter(p => {
        if (p.facilityId && filters.facilityIds!.includes(p.facilityId)) {
          return true;
        }
        if (p.sessions) {
          return p.sessions.some(s => 
            s.facility && filters.facilityIds!.includes(String(s.facility.id))
          );
        }
        return false;
      });
    }

    if (filters.programTypes && filters.programTypes.length > 0) {
      result = result.filter(p =>
        p.type && filters.programTypes!.includes(p.type as any)
      );
    }

    if (filters.sports && filters.sports.length > 0) {
      result = result.filter(p =>
        p.sport && filters.sports!.includes(p.sport)
      );
    }

    return result;
  }, [initialPrograms, filters]);

  // Extract filter options
  const filterOptions = useMemo(() => {
    const facilities = new Map<string, { id: string; name: string; count: number }>();
    const sports = new Map<string, number>();
    const programTypes = new Map<string, number>();
    const programs: { id: string; name: string }[] = [];

    initialPrograms.forEach(p => {
      programs.push({ id: p.id, name: p.name });
      
      let facilityId = p.facilityId;
      let facilityName = p.facilityName;
      
      if (!facilityId && p.sessions && p.sessions.length > 0) {
        const sessionWithFacility = p.sessions.find(s => s.facility);
        if (sessionWithFacility?.facility) {
          facilityId = String(sessionWithFacility.facility.id);
          facilityName = sessionWithFacility.facility.name;
        }
      }
      
      if (facilityId) {
        const existing = facilities.get(facilityId);
        if (existing) {
          existing.count++;
        } else {
          facilities.set(facilityId, {
            id: facilityId,
            name: facilityName || facilityId,
            count: 1,
          });
        }
      }
      if (p.sport) {
        sports.set(p.sport, (sports.get(p.sport) || 0) + 1);
      }
      if (p.type) {
        programTypes.set(p.type, (programTypes.get(p.type) || 0) + 1);
      }
    });

    return {
      facilities: Array.from(facilities.values()).sort((a, b) => a.name.localeCompare(b.name)),
      sports: Array.from(sports.entries())
        .map(([id, count]) => ({ id, label: id, count }))
        .sort((a, b) => b.count - a.count),
      programTypes: Array.from(programTypes.entries())
        .map(([id, count]) => ({ id, label: id, count }))
        .sort((a, b) => b.count - a.count),
      programs: programs.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [initialPrograms]);

  const handleFiltersChange = useCallback((newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Compact Header for Embed */}
      <header className="sticky top-0 z-40 w-full bg-white border-b border-gray-200">
        <div className="px-4 py-2 flex items-center justify-between">
          {/* View Toggle */}
          {config.features.allowViewToggle && (
            <div className="flex items-center gap-1 p-1 bg-gray-100 rounded-lg">
              <button
                onClick={() => setViewMode('programs')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'programs'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Grid3X3 size={14} />
                Programs
              </button>
              <button
                onClick={() => setViewMode('schedule')}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'schedule'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar size={14} />
                Schedule
              </button>
            </div>
          )}
          
          <span className="text-sm text-gray-500">
            {filteredPrograms.length} programs
          </span>
        </div>
      </header>

      {/* Filters */}
      <div className="px-4 py-3 bg-white border-b border-gray-200">
        <HorizontalFilterBar
          filters={filters}
          onFilterChange={handleFiltersChange}
          filterOptions={{
            facilities: filterOptions.facilities.map(f => ({ 
              id: f.id, 
              name: f.name, 
              count: filteredPrograms.filter(p => 
                p.facilityId === f.id || 
                p.sessions?.some(s => String(s.facility?.id) === f.id)
              ).length 
            })),
            programTypes: filterOptions.programTypes.map(t => ({ 
              id: t.id, 
              name: t.label, 
              count: filteredPrograms.filter(p => p.type === t.id).length 
            })),
            sports: filterOptions.sports.map(s => ({ 
              id: s.id, 
              name: s.label, 
              count: filteredPrograms.filter(p => p.sport === s.id).length 
            })),
            programs: filterOptions.programs.filter(p => 
              filteredPrograms.some(fp => fp.id === p.id)
            ),
            ages: [],
          }}
          config={config}
        />
      </div>

      {/* Content */}
      <main className="px-4">
        {viewMode === 'programs' ? (
          <ProgramGrid
            programs={filteredPrograms}
            config={config}
          />
        ) : (
          <ScheduleView
            schedule={[]}
            config={config}
            isLoading={false}
            error={null}
            totalEvents={0}
          />
        )}
      </main>
    </div>
  );
}
