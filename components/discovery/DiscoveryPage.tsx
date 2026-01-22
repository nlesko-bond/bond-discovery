'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { 
  LayoutGrid, 
  Calendar, 
  SlidersHorizontal, 
  X 
} from 'lucide-react';
import { Program, DiscoveryConfig, DiscoveryFilters, ViewMode } from '@/types';
import { ProgramGrid } from './ProgramGrid';
import { ScheduleView } from './ScheduleView';
import { FilterBar } from './FilterBar';
import { MobileFilters } from './MobileFilters';
import { programsToCalendarEvents, buildWeekSchedules } from '@/lib/transformers';
import { buildUrl } from '@/lib/utils';

interface DiscoveryPageProps {
  initialPrograms: Program[];
  config: DiscoveryConfig;
  initialViewMode: ViewMode;
  searchParams: { [key: string]: string | string[] | undefined };
}

export function DiscoveryPage({ 
  initialPrograms, 
  config, 
  initialViewMode,
  searchParams 
}: DiscoveryPageProps) {
  const router = useRouter();
  const urlSearchParams = useSearchParams();
  
  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  
  const [filters, setFilters] = useState<DiscoveryFilters>({
    search: (searchParams.search as string) || '',
    facilityIds: searchParams.facilityIds 
      ? (searchParams.facilityIds as string).split('_') 
      : [],
    programTypes: searchParams.programTypes 
      ? (searchParams.programTypes as string).split('_') as any[]
      : [],
    sports: searchParams.sports 
      ? (searchParams.sports as string).split('_') 
      : [],
    dateRange: {
      start: searchParams.startDate as string,
      end: searchParams.endDate as string,
    },
    ageRange: {
      min: searchParams.ageMin ? parseInt(searchParams.ageMin as string) : undefined,
      max: searchParams.ageMax ? parseInt(searchParams.ageMax as string) : undefined,
    },
    gender: (searchParams.gender as any) || 'all',
    availability: (searchParams.availability as any) || 'all',
    membershipRequired: searchParams.membershipRequired === 'true' 
      ? true 
      : searchParams.membershipRequired === 'false' 
        ? false 
        : null,
  });

  // Filter programs based on current filters
  const filteredPrograms = useMemo(() => {
    let result = [...initialPrograms];

    // Search filter
    if (filters.search) {
      const query = filters.search.toLowerCase();
      result = result.filter(p =>
        p.name.toLowerCase().includes(query) ||
        p.description?.toLowerCase().includes(query) ||
        p.sport?.toLowerCase().includes(query)
      );
    }

    // Facility filter
    if (filters.facilityIds && filters.facilityIds.length > 0) {
      result = result.filter(p =>
        p.facilityId && filters.facilityIds!.includes(p.facilityId)
      );
    }

    // Program type filter
    if (filters.programTypes && filters.programTypes.length > 0) {
      result = result.filter(p =>
        p.type && filters.programTypes!.includes(p.type as any)
      );
    }

    // Sport filter
    if (filters.sports && filters.sports.length > 0) {
      result = result.filter(p =>
        p.sport && filters.sports!.includes(p.sport)
      );
    }

    // Age filter
    if (filters.ageRange?.min !== undefined || filters.ageRange?.max !== undefined) {
      result = result.filter(p => {
        if (filters.ageRange?.min !== undefined && p.ageMax !== undefined) {
          if (p.ageMax < filters.ageRange.min) return false;
        }
        if (filters.ageRange?.max !== undefined && p.ageMin !== undefined) {
          if (p.ageMin > filters.ageRange.max) return false;
        }
        return true;
      });
    }

    // Gender filter
    if (filters.gender && filters.gender !== 'all') {
      result = result.filter(p =>
        !p.gender || p.gender === 'all' || p.gender === filters.gender
      );
    }

    // Availability filter
    if (filters.availability && filters.availability !== 'all') {
      result = result.filter(p => {
        const sessions = p.sessions || [];
        if (filters.availability === 'available') {
          return sessions.some(s => !s.isFull);
        }
        if (filters.availability === 'almost_full') {
          return sessions.some(s => 
            s.spotsRemaining !== undefined && 
            s.spotsRemaining > 0 && 
            s.spotsRemaining <= 5
          );
        }
        return true;
      });
    }

    // Date range filter
    if (filters.dateRange?.start || filters.dateRange?.end) {
      result = result.filter(p => {
        const sessions = p.sessions || [];
        if (sessions.length === 0) return true;

        return sessions.some(s => {
          const sessionStart = s.startDate ? new Date(s.startDate) : null;
          const sessionEnd = s.endDate ? new Date(s.endDate) : null;
          const filterStart = filters.dateRange?.start ? new Date(filters.dateRange.start) : null;
          const filterEnd = filters.dateRange?.end ? new Date(filters.dateRange.end) : null;

          if (filterStart && sessionEnd && sessionEnd < filterStart) return false;
          if (filterEnd && sessionStart && sessionStart > filterEnd) return false;
          return true;
        });
      });
    }

    return result;
  }, [initialPrograms, filters]);

  // Generate schedule data for calendar view
  const scheduleData = useMemo(() => {
    if (viewMode !== 'schedule') return null;
    const events = programsToCalendarEvents(filteredPrograms);
    return buildWeekSchedules(events, 8);
  }, [filteredPrograms, viewMode]);

  // Extract filter options from programs
  const filterOptions = useMemo(() => {
    const facilities = new Map<string, { id: string; name: string; count: number }>();
    const sports = new Map<string, number>();
    const programTypes = new Map<string, number>();

    initialPrograms.forEach(p => {
      if (p.facilityId) {
        const existing = facilities.get(p.facilityId);
        if (existing) {
          existing.count++;
        } else {
          facilities.set(p.facilityId, {
            id: p.facilityId,
            name: p.facilityName || p.facilityId,
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
    };
  }, [initialPrograms]);

  // Update URL when filters or view mode change
  const updateUrl = useCallback((newFilters: DiscoveryFilters, newViewMode: ViewMode) => {
    const params: Record<string, any> = {
      viewMode: newViewMode,
    };

    if (newFilters.search) params.search = newFilters.search;
    if (newFilters.facilityIds?.length) params.facilityIds = newFilters.facilityIds.join('_');
    if (newFilters.programTypes?.length) params.programTypes = newFilters.programTypes.join('_');
    if (newFilters.sports?.length) params.sports = newFilters.sports.join('_');
    if (newFilters.dateRange?.start) params.startDate = newFilters.dateRange.start;
    if (newFilters.dateRange?.end) params.endDate = newFilters.dateRange.end;
    if (newFilters.ageRange?.min) params.ageMin = newFilters.ageRange.min;
    if (newFilters.ageRange?.max) params.ageMax = newFilters.ageRange.max;
    if (newFilters.gender && newFilters.gender !== 'all') params.gender = newFilters.gender;
    if (newFilters.availability && newFilters.availability !== 'all') params.availability = newFilters.availability;
    if (newFilters.membershipRequired !== null) params.membershipRequired = newFilters.membershipRequired;

    const url = buildUrl('/', params);
    router.replace(url, { scroll: false });
  }, [router]);

  // Handle filter changes
  const handleFiltersChange = useCallback((newFilters: DiscoveryFilters) => {
    setFilters(newFilters);
    updateUrl(newFilters, viewMode);
  }, [viewMode, updateUrl]);

  // Handle view mode change
  const handleViewModeChange = useCallback((newMode: ViewMode) => {
    setViewMode(newMode);
    updateUrl(filters, newMode);
  }, [filters, updateUrl]);

  // Count active filters
  const activeFilterCount = useMemo(() => {
    let count = 0;
    if (filters.search) count++;
    if (filters.facilityIds?.length) count++;
    if (filters.programTypes?.length) count++;
    if (filters.sports?.length) count++;
    if (filters.dateRange?.start || filters.dateRange?.end) count++;
    if (filters.ageRange?.min || filters.ageRange?.max) count++;
    if (filters.gender && filters.gender !== 'all') count++;
    if (filters.availability && filters.availability !== 'all') count++;
    return count;
  }, [filters]);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="max-w-7xl mx-auto px-4 py-4 sm:px-6 lg:px-8">
          <div className="flex items-center justify-between">
            {/* Logo & Title */}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">
                <span className="text-bond-gold">{config.branding.companyName.split(' ')[0]}</span>{' '}
                {config.branding.companyName.split(' ').slice(1).join(' ') || 'Discovery'}
              </h1>
              <p className="text-xs text-gray-500 hidden sm:block">
                {config.branding.tagline}
              </p>
            </div>

            {/* View Toggle & Mobile Filter */}
            <div className="flex items-center gap-2">
              {/* Desktop View Toggle */}
              {config.features.allowViewToggle && (
                <div className="hidden sm:flex items-center bg-gray-100 rounded-lg p-1">
                  <button
                    onClick={() => handleViewModeChange('programs')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'programs'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <LayoutGrid size={16} />
                    Programs
                  </button>
                  <button
                    onClick={() => handleViewModeChange('schedule')}
                    className={`flex items-center gap-2 px-3 py-1.5 rounded-md text-sm font-medium transition-all ${
                      viewMode === 'schedule'
                        ? 'bg-white text-gray-900 shadow-sm'
                        : 'text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    <Calendar size={16} />
                    Schedule
                  </button>
                </div>
              )}

              {/* Mobile Filter Button */}
              <button
                onClick={() => setShowMobileFilters(true)}
                className="md:hidden flex items-center gap-2 px-3 py-2 bg-gray-100 text-gray-700 rounded-lg font-medium hover:bg-gray-200 transition-colors relative"
              >
                <SlidersHorizontal size={18} />
                <span className="sr-only sm:not-sr-only">Filters</span>
                {activeFilterCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-bond-gold text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {activeFilterCount}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Mobile View Toggle */}
          {config.features.allowViewToggle && (
            <div className="sm:hidden mt-3 flex items-center bg-gray-100 rounded-lg p-1">
              <button
                onClick={() => handleViewModeChange('programs')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'programs'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                <LayoutGrid size={16} />
                Programs
              </button>
              <button
                onClick={() => handleViewModeChange('schedule')}
                className={`flex-1 flex items-center justify-center gap-2 px-3 py-2 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'schedule'
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600'
                }`}
              >
                <Calendar size={16} />
                Schedule
              </button>
            </div>
          )}
        </div>
      </header>

      {/* Main Content */}
      <div className="max-w-7xl mx-auto">
        <div className="flex">
          {/* Desktop Sidebar Filters */}
          <aside className="hidden md:block w-64 lg:w-72 flex-shrink-0 sticky top-[73px] h-[calc(100vh-73px)] overflow-y-auto border-r border-gray-200 bg-white">
            <FilterBar
              filters={filters}
              onFiltersChange={handleFiltersChange}
              options={filterOptions}
              enabledFilters={config.features.enableFilters}
            />
          </aside>

          {/* Main Content Area */}
          <main className="flex-1 min-w-0">
            {viewMode === 'programs' ? (
              <ProgramGrid 
                programs={filteredPrograms} 
                config={config}
              />
            ) : (
              <ScheduleView 
                schedule={scheduleData || []} 
                config={config}
              />
            )}
          </main>
        </div>
      </div>

      {/* Mobile Filter Drawer */}
      <MobileFilters
        isOpen={showMobileFilters}
        onClose={() => setShowMobileFilters(false)}
        filters={filters}
        onFiltersChange={handleFiltersChange}
        options={filterOptions}
        enabledFilters={config.features.enableFilters}
        resultCount={filteredPrograms.length}
      />

      {/* Footer */}
      <footer className="bg-white border-t border-gray-200 mt-12">
        <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-4">
            <p className="text-sm text-gray-600">
              © {new Date().getFullYear()} {config.branding.companyName}. All rights reserved.
            </p>
            <div className="flex items-center gap-4 text-sm text-gray-500">
              <span>Powered by Bond Sports API</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
