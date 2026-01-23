'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { useRouter, useSearchParams, usePathname } from 'next/navigation';
import { 
  LayoutGrid, 
  Calendar, 
  SlidersHorizontal, 
  X,
  Share2,
  Check,
  Link as LinkIcon
} from 'lucide-react';
import { Program, DiscoveryConfig, DiscoveryFilters, ViewMode } from '@/types';
import { ProgramGrid } from './ProgramGrid';
import { ScheduleView } from './ScheduleView';
import { HorizontalFilterBar } from './HorizontalFilterBar';
import { MobileFilters } from './MobileFilters';
import { programsToCalendarEvents, buildWeekSchedules } from '@/lib/transformers';
import { buildUrl, getSportGradient } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { ProgramGridSkeleton, ScheduleViewSkeleton } from '@/components/ui/Skeleton';

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
  const pathname = usePathname();
  const urlSearchParams = useSearchParams();
  
  // Generate localStorage key based on page slug
  const storageKey = `discovery-filters-${config.slug}`;
  
  // Initialize filters from URL params first, then localStorage, then defaults
  const getInitialFilters = (): DiscoveryFilters => {
    // URL params always take priority
    if (Object.keys(searchParams).length > 0) {
      return {
        search: (searchParams.search as string) || '',
        programIds: searchParams.programIds 
          ? (searchParams.programIds as string).split('_') 
          : [],
        sessionIds: searchParams.sessionIds 
          ? (searchParams.sessionIds as string).split('_') 
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
      };
    }
    
    // Try localStorage
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem(storageKey);
      if (saved) {
        try {
          return JSON.parse(saved);
        } catch {
          // Invalid JSON, ignore
        }
      }
    }
    
    // Return defaults
    return {
      search: '',
      programIds: [],
      sessionIds: [],
      facilityIds: [],
      programTypes: [],
      sports: [],
      dateRange: {},
      ageRange: {},
      gender: 'all',
      availability: 'all',
      membershipRequired: null,
    };
  };

  const [viewMode, setViewMode] = useState<ViewMode>(initialViewMode);
  const [showMobileFilters, setShowMobileFilters] = useState(false);
  const [filters, setFilters] = useState<DiscoveryFilters>(getInitialFilters);
  const [showCopied, setShowCopied] = useState(false);
  
  // Copy current URL to clipboard
  const handleShare = useCallback(async () => {
    const url = window.location.href;
    try {
      await navigator.clipboard.writeText(url);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    } catch {
      // Fallback for older browsers
      const textarea = document.createElement('textarea');
      textarea.value = url;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setShowCopied(true);
      setTimeout(() => setShowCopied(false), 2000);
    }
  }, []);
  
  // Sync viewMode with URL params on navigation
  useEffect(() => {
    const urlViewMode = urlSearchParams.get('viewMode') as ViewMode | null;
    if (urlViewMode && urlViewMode !== viewMode) {
      setViewMode(urlViewMode);
    }
  }, [urlSearchParams]);
  
  // Load Google Font if custom font is specified
  useEffect(() => {
    if (config.branding.fontFamily) {
      // Extract font name from the fontFamily string (e.g., "'Inter', sans-serif" -> "Inter")
      const fontName = config.branding.fontFamily.split(',')[0].replace(/['"]/g, '').trim();
      if (fontName && fontName !== 'inherit') {
        const link = document.createElement('link');
        link.href = `https://fonts.googleapis.com/css2?family=${fontName.replace(/\s+/g, '+')}:wght@400;500;600;700;800&display=swap`;
        link.rel = 'stylesheet';
        document.head.appendChild(link);
        
        return () => {
          document.head.removeChild(link);
        };
      }
    }
  }, [config.branding.fontFamily]);
  
  // Sync filters with URL params on navigation
  useEffect(() => {
    const urlProgramIds = urlSearchParams.get('programIds');
    const urlSessionIds = urlSearchParams.get('sessionIds');
    const urlFacilityIds = urlSearchParams.get('facilityIds');
    
    // Only update if URL params present and different
    const newProgramIds = urlProgramIds ? urlProgramIds.split('_') : [];
    const newSessionIds = urlSessionIds ? urlSessionIds.split('_') : [];
    const newFacilityIds = urlFacilityIds ? urlFacilityIds.split('_') : [];
    
    const filtersChanged = 
      JSON.stringify(newProgramIds) !== JSON.stringify(filters.programIds || []) ||
      JSON.stringify(newSessionIds) !== JSON.stringify(filters.sessionIds || []) ||
      JSON.stringify(newFacilityIds) !== JSON.stringify(filters.facilityIds || []);
    
    if (filtersChanged) {
      setFilters(prev => ({
        ...prev,
        programIds: newProgramIds.length > 0 ? newProgramIds : undefined,
        sessionIds: newSessionIds.length > 0 ? newSessionIds : undefined,
        facilityIds: newFacilityIds.length > 0 ? newFacilityIds : undefined,
      }));
    }
  }, [urlSearchParams]);
  
  // Save filters to localStorage when they change
  useEffect(() => {
    if (typeof window !== 'undefined') {
      localStorage.setItem(storageKey, JSON.stringify(filters));
    }
  }, [filters, storageKey]);

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

    // Program ID filter (deep link to specific programs)
    if (filters.programIds && filters.programIds.length > 0) {
      result = result.filter(p => filters.programIds!.includes(p.id));
    }

    // Facility filter
    if (filters.facilityIds && filters.facilityIds.length > 0) {
      result = result.filter(p => {
        // Check program-level facility
        if (p.facilityId && filters.facilityIds!.includes(p.facilityId)) {
          return true;
        }
        // Check session-level facilities
        if (p.sessions) {
          return p.sessions.some(s => 
            s.facility && filters.facilityIds!.includes(String(s.facility.id))
          );
        }
        return false;
      });
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

  // State for real events from API
  const [apiEvents, setApiEvents] = useState<any[]>([]);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsFetched, setEventsFetched] = useState(false);
  
  // Reset events when config changes (different page)
  useEffect(() => {
    setEventsFetched(false);
    setApiEvents([]);
  }, [config.organizationIds.join(',')]);
  
  // Fetch events from API when schedule view is selected
  useEffect(() => {
    if (viewMode === 'schedule' && !eventsFetched && !eventsLoading) {
      setEventsLoading(true);
      setEventsError(null);
      
      // Build URL with slug to let API look up config
      const params = new URLSearchParams();
      params.set('slug', config.slug);
      const url = `/api/events?${params.toString()}`;
      
      fetch(url)
        .then(res => res.json())
        .then(data => {
          if (data.data) {
            setApiEvents(data.data);
            setEventsFetched(true);
          }
        })
        .catch(err => {
          console.error('Error fetching events:', err);
          setEventsError('Failed to load events');
        })
        .finally(() => {
          setEventsLoading(false);
        });
    }
  }, [viewMode, eventsFetched, eventsLoading, config.slug]);
  
  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    let result = [...apiEvents];
    
    // Filter by program - match by ID first, then fallback to name
    if (filters.programIds && filters.programIds.length > 0) {
      // Get program names for the selected IDs from initialPrograms
      const selectedPrograms = initialPrograms.filter(p => 
        filters.programIds!.includes(p.id)
      );
      const selectedProgramNames = selectedPrograms.map(p => p.name.toLowerCase().trim());
      
      result = result.filter(event => {
        // First try to match by program ID directly
        if (filters.programIds!.includes(event.programId)) {
          return true;
        }
        
        // Fallback to matching by program name
        const eventProgramName = (event.programName || '').toLowerCase().trim();
        return selectedProgramNames.some(name => name === eventProgramName);
      });
    }
    
    // Filter by session - match by ID first, then fallback to name
    if (filters.sessionIds && filters.sessionIds.length > 0) {
      // Get session names from initialPrograms
      const allSessions: { id: string; name: string }[] = [];
      initialPrograms.forEach(p => {
        p.sessions?.forEach(s => {
          allSessions.push({ id: s.id, name: s.name || `Session ${s.id}` });
        });
      });
      
      const selectedSessions = allSessions.filter(s =>
        filters.sessionIds!.includes(s.id)
      );
      const selectedSessionNames = selectedSessions.map(s => s.name.toLowerCase().trim());
      
      result = result.filter(event => {
        // First try to match by session ID directly
        if (filters.sessionIds!.includes(event.sessionId)) {
          return true;
        }
        
        // Fallback to matching by session name
        const eventSessionName = (event.sessionName || '').toLowerCase().trim();
        return selectedSessionNames.some(name => eventSessionName.includes(name) || name.includes(eventSessionName));
      });
    }
    
    // Filter by facility
    if (filters.facilityIds && filters.facilityIds.length > 0) {
      result = result.filter(event => {
        // Match facility name or ID
        return filters.facilityIds!.some(id => {
          const facilityName = event.facilityName?.toLowerCase() || '';
          return facilityName.includes(id.toLowerCase()) || 
                 String(event.facilityId) === id ||
                 event.facilityId === id;
        });
      });
    }
    
    // Filter by search term - searches event name, program name, session name, and facility
    if (filters.search) {
      const search = filters.search.toLowerCase();
      result = result.filter(event => 
        event.title?.toLowerCase().includes(search) ||
        event.programName?.toLowerCase().includes(search) ||
        event.sessionName?.toLowerCase().includes(search) ||
        event.facilityName?.toLowerCase().includes(search)
      );
    }
    
    // Filter by program type
    if (filters.programTypes && filters.programTypes.length > 0) {
      result = result.filter(event => 
        filters.programTypes!.includes(event.type)
      );
    }
    
    // Filter by sport
    if (filters.sports && filters.sports.length > 0) {
      result = result.filter(event => 
        filters.sports!.includes(event.sport)
      );
    }
    
    return result;
  }, [apiEvents, filters, initialPrograms]);
  
  // Generate schedule data for calendar view from real API events
  const scheduleData = useMemo(() => {
    if (viewMode !== 'schedule') return null;
    
    // Convert filtered API events to CalendarEvent format
    const calendarEvents = filteredEvents.map(event => ({
      id: event.id,
      programId: event.programId || '',
      programName: event.programName || event.title,
      sessionId: event.sessionId || '',
      sessionName: event.sessionName || '',
      title: event.title || event.sessionName || event.programName, // Event-specific title
      date: event.startDate?.split('T')[0] || '',
      startTime: event.startDate || '',
      endTime: event.endDate || '',
      facilityId: '',
      facilityName: event.facilityName || '',
      spaceName: event.spaceName || '',  // Resource/court/field
      sport: event.sport,
      type: event.type,
      linkSEO: event.linkSEO,
      color: getSportGradient(event.sport || ''),
      maxParticipants: event.maxParticipants,
      currentParticipants: event.currentParticipants,
      startingPrice: event.startingPrice,
      memberPrice: event.memberPrice,
    }));
    
    return buildWeekSchedules(calendarEvents, 8);
  }, [filteredEvents, viewMode]);

  // Extract filter options from programs
  const filterOptions = useMemo(() => {
    const facilities = new Map<string, { id: string; name: string; count: number }>();
    const sports = new Map<string, number>();
    const programTypes = new Map<string, number>();
    const programs: { id: string; name: string }[] = [];
    const sessions: { id: string; name: string; programId: string }[] = [];

    initialPrograms.forEach(p => {
      // Add program to list
      programs.push({ id: p.id, name: p.name });
      
      // Add sessions from this program
      if (p.sessions) {
        p.sessions.forEach(s => {
          sessions.push({
            id: s.id,
            name: s.name || `Session ${s.id}`,
            programId: p.id,
          });
        });
      }
      
      // Get facility from program level or from sessions
      let facilityId = p.facilityId;
      let facilityName = p.facilityName;
      
      // If not on program, check sessions
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
      sessions: sessions.sort((a, b) => a.name.localeCompare(b.name)),
    };
  }, [initialPrograms]);

  // Update URL when filters or view mode change
  const updateUrl = useCallback((newFilters: DiscoveryFilters, newViewMode: ViewMode) => {
    const params: Record<string, any> = {
      viewMode: newViewMode,
    };

    if (newFilters.search) params.search = newFilters.search;
    if (newFilters.programIds?.length) params.programIds = newFilters.programIds.join('_');
    if (newFilters.sessionIds?.length) params.sessionIds = newFilters.sessionIds.join('_');
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

    const url = buildUrl(pathname, params);
    router.replace(url, { scroll: false });
  }, [router, pathname]);

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
    <div 
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: config.branding.fontFamily || 'inherit' }}
    >
      {/* Header */}
      <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
        <div className="w-full px-3 py-3 sm:px-4 lg:px-6">
          <div className="flex items-center justify-between">
            {/* Logo & Tagline */}
            <div className="flex items-center gap-4">
              <BrandLogo config={config} size="md" />
              {config.branding.tagline && (
                <div 
                  className="hidden sm:flex items-center border-l-2 pl-4"
                  style={{ borderColor: config.branding.primaryColor }}
                >
                  <span 
                    className="text-base tracking-tight"
                    style={{ 
                      color: config.branding.primaryColor,
                      fontWeight: 700,
                      fontFamily: config.branding.fontFamily || 'inherit'
                    }}
                  >
                    {config.branding.tagline}
                  </span>
                </div>
              )}
            </div>

            {/* View Toggle & Share */}
            <div className="flex items-center gap-2">
              {/* Share Button */}
              <button
                onClick={handleShare}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
                title="Copy link to clipboard"
              >
                {showCopied ? (
                  <>
                    <Check size={16} className="text-green-600" />
                    <span className="hidden sm:inline text-green-600">Copied!</span>
                  </>
                ) : (
                  <>
                    <LinkIcon size={16} />
                    <span className="hidden sm:inline">Share</span>
                  </>
                )}
              </button>
              
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

              {/* Mobile Filter Button - Only shown on very small screens if needed */}
              {/* Filters are now inline on all screen sizes */}
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

      {/* Horizontal Filter Bar - visible on all screen sizes, sticky below header */}
      <div className="w-full px-3 sm:px-4 lg:px-6 py-2 bg-gray-50 sticky top-[57px] z-30">
        <div className="overflow-x-auto sm:overflow-visible">
          <HorizontalFilterBar
            filters={filters}
            onFilterChange={handleFiltersChange}
            filterOptions={{
              // Use cascading counts based on filtered programs
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
              sessions: filterOptions.sessions,
              ages: [],
            }}
            config={config}
          />
        </div>
      </div>

      {/* Main Content */}
      <div className="w-full px-3 sm:px-4 lg:px-6">
        {/* Main Content Area */}
        <main>
          {viewMode === 'programs' ? (
            <ProgramGrid 
              programs={filteredPrograms} 
              config={config}
            />
          ) : (
            <ScheduleView 
              schedule={scheduleData || []} 
              config={config}
              isLoading={eventsLoading}
              error={eventsError}
              totalEvents={filteredEvents.length}
            />
          )}
        </main>
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
      <footer className="bg-white border-t border-gray-200 mt-8">
        <div className="w-full px-3 py-4 sm:px-4 lg:px-6">
          <div className="flex flex-col sm:flex-row items-center justify-between gap-2">
            <p className="text-xs text-gray-500">
              © {new Date().getFullYear()} {config.branding.companyName}
            </p>
            <div className="flex items-center gap-4 text-xs text-gray-400">
              <span>Powered by Bond Sports</span>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
