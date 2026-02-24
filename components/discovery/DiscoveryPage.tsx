'use client';

import { useState, useMemo, useCallback, useEffect, useRef } from 'react';
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
import { buildUrl, getSportGradient, cn } from '@/lib/utils';
import { BrandLogo } from '@/components/ui/BrandLogo';
import { ProgramGridSkeleton, ScheduleViewSkeleton } from '@/components/ui/Skeleton';
import { GoogleTagManager, gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';

interface DiscoveryPageProps {
  initialPrograms: Program[];
  initialScheduleEvents?: any[];
  initialEventsFetched?: boolean;
  config: DiscoveryConfig;
  initialViewMode: ViewMode;
  searchParams: { [key: string]: string | string[] | undefined };
}

export function DiscoveryPage({ 
  initialPrograms, 
  initialScheduleEvents = [],
  initialEventsFetched = false,
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
  
  // Link target based on config setting
  // new_tab = _blank (default), same_window = _top, in_frame = _self
  const linkBehavior = config.features.linkBehavior || 'new_tab';
  const linkTarget = linkBehavior === 'same_window' ? '_top' 
                   : linkBehavior === 'in_frame' ? '_self' 
                   : '_blank';
  
  // Tab visibility - which tabs are enabled
  const enabledTabs = config.features.enabledTabs || ['programs', 'schedule'];
  const showProgramsTab = enabledTabs.includes('programs');
  const showScheduleTab = enabledTabs.includes('schedule');
  const showTabToggle = config.features.allowViewToggle && showProgramsTab && showScheduleTab;
  
  // Refs for measuring header height for sticky positioning
  const containerRef = useRef<HTMLDivElement>(null);
  const headerRef = useRef<HTMLElement>(null);
  
  // Measure header height and set CSS variable for sticky positioning
  useEffect(() => {
    const header = headerRef.current;
    
    // Determine if our header is sticky
    const headerIsSticky = config.features.headerDisplay !== 'hidden' && 
                           config.features.headerDisplay !== 'minimal' && 
                           !config.features.disableStickyHeader;
    
    const updateStickyOffset = () => {
      let offset = 0;
      
      // Add our own header height if it's sticky
      if (headerIsSticky && header) {
        offset = header.getBoundingClientRect().height;
      }
      
      document.documentElement.style.setProperty('--sticky-offset', `${offset}px`);
    };
    
    // Initial measurement
    updateStickyOffset();
    
    // Use ResizeObserver to track header size changes
    if (header && headerIsSticky) {
      const resizeObserver = new ResizeObserver(updateStickyOffset);
      resizeObserver.observe(header);
      return () => {
        resizeObserver.disconnect();
        document.documentElement.style.removeProperty('--sticky-offset');
      };
    }
    
    return () => {
      document.documentElement.style.removeProperty('--sticky-offset');
    };
  }, [config.features.headerDisplay, config.features.disableStickyHeader]);
  
  // Iframe auto-resize: Send height to parent window for seamless embedding
  // This allows parent pages (like Webflow) to resize the iframe to fit content
  useEffect(() => {
    // Only run if we're in an iframe
    if (typeof window === 'undefined' || window.self === window.top) return;
    
    let resizeTimeout: NodeJS.Timeout;
    
    const sendHeight = () => {
      // Debounce to avoid too many messages during rapid changes
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(() => {
        const height = document.documentElement.scrollHeight;
        window.parent.postMessage({
          type: 'discovery-resize',
          height: height,
          slug: config.slug
        }, '*'); // '*' allows any parent origin - safe because we're only sending, not receiving sensitive data
      }, 100);
    };
    
    // Send initial height after page settles
    setTimeout(sendHeight, 500);
    
    // Observe body for size changes (content loads, filters applied, view changes, etc.)
    const resizeObserver = new ResizeObserver(sendHeight);
    resizeObserver.observe(document.body);
    
    // Also send on window resize
    window.addEventListener('resize', sendHeight);
    
    return () => {
      clearTimeout(resizeTimeout);
      resizeObserver.disconnect();
      window.removeEventListener('resize', sendHeight);
    };
  }, [config.slug]);
  
  // Copy current URL to clipboard
  const handleShare = useCallback(async () => {
    const url = window.location.href;
    // Track share event (GTM + Bond Analytics)
    gtmEvent.shareLink(config.slug, url);
    bondAnalytics.shareLink(config.slug, url);
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
  }, [config.slug]);
  
  // Sync viewMode with URL params on navigation
  useEffect(() => {
    const urlViewMode = urlSearchParams.get('viewMode') as ViewMode | null;
    if (!urlViewMode) return;

    // During rapid tab switches, ignore stale URL updates until the latest
    // user-selected mode appears in the URL.
    if (pendingViewModeRef.current) {
      if (urlViewMode === pendingViewModeRef.current) {
        pendingViewModeRef.current = null;
      } else {
        return;
      }
    }

    if (urlViewMode !== viewMode) {
      setViewMode(urlViewMode);
    }
  }, [urlSearchParams, viewMode]);
  
  // Track page view on mount (Bond Analytics)
  useEffect(() => {
    bondAnalytics.pageView({
      pageSlug: config.slug,
      viewMode,
    });
  }, [config.slug]); // Only track once on mount
  
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
  const [apiEvents, setApiEvents] = useState<any[]>(initialScheduleEvents);
  const [eventsLoading, setEventsLoading] = useState(false);
  const [eventsError, setEventsError] = useState<string | null>(null);
  const [eventsFetched, setEventsFetched] = useState(initialEventsFetched);
  const cacheV2Enabled = config.features.discoveryCacheEnabled === true;
  
  // Ref to track the current fetch request for cancellation
  const abortControllerRef = useRef<AbortController | null>(null);
  // Tracks the latest user-initiated tab target to avoid URL/state races
  const pendingViewModeRef = useRef<ViewMode | null>(null);
  const pendingViewModeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  
  // Reset events when config changes (different page)
  useEffect(() => {
    // Cancel any in-flight request when config changes
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }
    setEventsFetched(initialEventsFetched);
    setEventsLoading(false);
    setApiEvents(initialScheduleEvents);
    setEventsError(null);
  }, [config.slug, config.organizationIds.join(','), initialEventsFetched, initialScheduleEvents]);
  
  // Fetch events from API when schedule view is selected
  useEffect(() => {
    // Only fetch if we're in schedule view and haven't fetched yet
    if (viewMode !== 'schedule' || eventsFetched) {
      return;
    }
    
    // Cancel any existing request before starting a new one
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }
    
    // Create new abort controller for this request
    const abortController = new AbortController();
    abortControllerRef.current = abortController;
    
    setEventsLoading(true);
    setEventsError(null);
    
    // Build URL with slug to let API look up config
    const params = new URLSearchParams();
    params.set('slug', config.slug);
    const url = `/api/events?${params.toString()}`;
    
    fetch(url, { signal: abortController.signal })
      .then(res => {
        // Check if request was successful
        if (!res.ok) {
          throw new Error(`API error: ${res.status} ${res.statusText}`);
        }
        return res.json();
      })
      .then(data => {
        // Don't update state if this request was aborted
        if (abortController.signal.aborted) return;
        
        // Handle successful response - data.data can be an empty array which is valid
        if (data && Array.isArray(data.data)) {
          setApiEvents(data.data);
          setEventsFetched(true);
        } else {
          // Unexpected response format
          console.error('Unexpected API response format:', data);
          setEventsError('Unexpected response from server');
          setEventsFetched(true); // Mark as fetched to prevent infinite retries
        }
      })
      .catch(err => {
        // Don't update state if this request was aborted
        if (abortController.signal.aborted) return;
        
        // Handle AbortError silently (user navigated away)
        if (err.name === 'AbortError') {
          return;
        }
        
        console.error('Error fetching events:', err);
        setEventsError('Failed to load events');
        setEventsFetched(true); // Mark as fetched to prevent infinite retries
      })
      .finally(() => {
        // Don't update loading state if this request was aborted
        if (abortController.signal.aborted) return;
        setEventsLoading(false);
      });
    
    // Cleanup: abort request if component unmounts or dependencies change
    return () => {
      abortController.abort();
    };
  }, [viewMode, eventsFetched, config.slug]);

  // Keep waitlist/spots data fresher with a lightweight availability overlay.
  useEffect(() => {
    if (!cacheV2Enabled || apiEvents.length === 0) {
      return;
    }

    const controller = new AbortController();
    const params = new URLSearchParams();
    params.set('slug', config.slug);
    params.set('mode', 'availability');

    fetch(`/api/events?${params.toString()}`, { signal: controller.signal })
      .then((res) => {
        if (!res.ok) throw new Error(`Availability API error: ${res.status}`);
        return res.json();
      })
      .then((payload) => {
        if (!payload?.data || !Array.isArray(payload.data)) return;
        const availabilityById = new Map<string, any>();
        payload.data.forEach((item: any) => {
          availabilityById.set(String(item.id), item);
        });

        setApiEvents((prev) =>
          prev.map((event) => {
            const availability = availabilityById.get(String(event.id));
            if (!availability) return event;
            return {
              ...event,
              spotsRemaining: availability.spotsRemaining,
              maxParticipants: availability.maxParticipants,
              currentParticipants: availability.currentParticipants,
              isWaitlistEnabled: availability.isWaitlistEnabled,
              waitlistCount: availability.waitlistCount,
            };
          })
        );
      })
      .catch((error) => {
        if (controller.signal.aborted || error?.name === 'AbortError') return;
        console.error('Availability refresh error:', error);
      });

    return () => controller.abort();
  }, [cacheV2Enabled, config.slug, viewMode, apiEvents.length]);
  
  // Filter events based on current filters
  const filteredEvents = useMemo(() => {
    let result = [...apiEvents];
    
    // Filter by program - match by ID first, then fallback to name+facility
    if (filters.programIds && filters.programIds.length > 0) {
      // Get selected programs with their facility info
      const selectedPrograms = initialPrograms.filter(p => 
        filters.programIds!.includes(p.id)
      );
      
      result = result.filter(event => {
        // First try to match by program ID directly
        if (filters.programIds!.includes(event.programId)) {
          return true;
        }
        
        // Fallback to matching by program name + facility
        // This ensures we don't show events from other facilities with the same program name
        const eventProgramName = (event.programName || '').toLowerCase().trim();
        const eventFacilityName = (event.facilityName || '').toLowerCase().trim();
        
        return selectedPrograms.some(p => {
          const programName = p.name.toLowerCase().trim();
          
          // Program name must match first
          if (programName !== eventProgramName) {
            return false;
          }
          
          // Get facility info from the program (from initialPrograms which has facilityName from transformer)
          const programFacilityName = (p.facilityName || '').toLowerCase().trim();
          
          // If both have facility names, they must match
          if (programFacilityName && eventFacilityName) {
            // Extract the location part after the first dash (e.g., "toca - denver, co" -> "denver, co")
            const getPrimaryLocation = (name: string) => {
              const parts = name.split('-');
              // Get the most specific part (usually after the brand name like "TOCA")
              return parts.length > 1 ? parts.slice(1).join('-').trim() : parts[0].trim();
            };
            
            const programLocation = getPrimaryLocation(programFacilityName);
            const eventLocation = getPrimaryLocation(eventFacilityName);
            
            // Locations must match (e.g., "denver, co" === "denver, co")
            // Allow partial matching for cases like "denver, co" vs "denver"
            const facilityMatch = programLocation === eventLocation ||
                                  programLocation.startsWith(eventLocation) ||
                                  eventLocation.startsWith(programLocation);
            return facilityMatch;
          }
          
          // If event has no facility name but program does, don't match
          // (prevents matching events from unknown facilities)
          if (programFacilityName && !eventFacilityName) {
            return false;
          }
          
          // If program has no facility name (shouldn't happen after transformer fix), 
          // match by name only as last resort
          return true;
        });
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
      // Build a mapping of facility ID → name from initialPrograms
      // This handles the case where events have facilityName but not facilityId
      const facilityIdToName = new Map<string, string>();
      initialPrograms.forEach(p => {
        let facilityId = p.facilityId;
        let facilityName = p.facilityName;
        if (!facilityId && p.sessions && p.sessions.length > 0) {
          const sessionWithFacility = p.sessions.find(s => s.facility);
          if (sessionWithFacility?.facility) {
            facilityId = String(sessionWithFacility.facility.id);
            facilityName = sessionWithFacility.facility.name;
          }
        }
        if (facilityId && facilityName) {
          facilityIdToName.set(facilityId, facilityName.toLowerCase());
        }
      });
      
      // Build list of facility names to match
      const selectedFacilityNames = filters.facilityIds
        .map(id => facilityIdToName.get(id) || id.toLowerCase())
        .filter(Boolean);
      
      result = result.filter(event => {
        const eventFacilityName = event.facilityName?.toLowerCase() || '';
        const eventFacilityId = event.facilityId ? String(event.facilityId) : '';
        
        return filters.facilityIds!.some(id => {
          // Direct ID match
          if (eventFacilityId === id) return true;
          
          // Match event facility name against selected facility names
          return selectedFacilityNames.some(name => 
            eventFacilityName === name || 
            eventFacilityName.includes(name) ||
            name.includes(eventFacilityName)
          );
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
    
    // Helper to convert UTC date to local date string (YYYY-MM-DD) and time string (ISO)
    const getLocalDateTime = (utcDateStr: string, timezone?: string) => {
      if (!utcDateStr) return { date: '', startTime: '' };
      
      try {
        const utcDate = new Date(utcDateStr);
        // Use the provided timezone or default to America/New_York
        const tz = timezone || 'America/New_York';
        
        // Get local date components
        const localDate = utcDate.toLocaleDateString('en-CA', { timeZone: tz }); // en-CA gives YYYY-MM-DD format
        
        // Return the original ISO string for startTime (used for sorting and display)
        return { date: localDate, startTime: utcDateStr };
      } catch {
        // Fallback to simple split if timezone conversion fails
        return { date: utcDateStr.split('T')[0], startTime: utcDateStr };
      }
    };
    
    // Convert filtered API events to CalendarEvent format
    const calendarEvents = filteredEvents.map(event => {
      const { date, startTime } = getLocalDateTime(event.startDate, event.timezone);
      const { startTime: endTime } = getLocalDateTime(event.endDate, event.timezone);
      
      return {
        id: event.id,
        programId: event.programId || '',
        programName: event.programName || event.title,
        sessionId: event.sessionId || '',
        sessionName: event.sessionName || '',
        title: event.title || event.sessionName || event.programName, // Event-specific title
        date,
        startTime,
        endTime,
        timezone: event.timezone,  // Pass through timezone from Bond API
        facilityId: '',
        facilityName: event.facilityName || '',
        spaceName: event.spaceName || '',  // Resource/court/field
        sport: event.sport,
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
        // Segment info
        segmentId: event.segmentId,
        segmentName: event.segmentName,
        isSegmented: event.isSegmented,
      };
    });
    
    return buildWeekSchedules(calendarEvents, 8);
  }, [filteredEvents, viewMode]);

  // Extract filter options from programs
  const filterOptions = useMemo(() => {
    const facilities = new Map<string, { id: string; name: string; count: number }>();
    const sports = new Map<string, number>();
    const programTypes = new Map<string, number>();
    const programs: { id: string; name: string; facilityId?: string; facilityName?: string }[] = [];
    const sessions: { id: string; name: string; programId: string }[] = [];

    initialPrograms.forEach(p => {
      // Get facility from program level or from sessions
      let facilityId = p.facilityId;
      let facilityName = p.facilityName;
      
      // If facility info not on program, check sessions
      if ((!facilityId || !facilityName) && p.sessions && p.sessions.length > 0) {
        const sessionWithFacility = p.sessions.find(s => s.facility);
        if (sessionWithFacility?.facility) {
          facilityId = facilityId || String(sessionWithFacility.facility.id);
          facilityName = facilityName || sessionWithFacility.facility.name;
        }
      }
      
      // Add program to list with facility info
      programs.push({ 
        id: p.id, 
        name: p.name,
        facilityId,
        facilityName,
      });
      
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

    const facilitiesList = Array.from(facilities.values()).sort((a, b) => a.name.localeCompare(b.name));
    
    return {
      facilities: facilitiesList,
      hasMultipleFacilities: facilitiesList.length > 1,
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
    if (newMode === viewMode) return;

    // Track view mode change (GTM + Bond Analytics)
    gtmEvent.viewModeChanged(viewMode, newMode);
    bondAnalytics.viewModeChanged(config.slug, viewMode, newMode);
    pendingViewModeRef.current = newMode;
    if (pendingViewModeTimeoutRef.current) {
      clearTimeout(pendingViewModeTimeoutRef.current);
    }
    pendingViewModeTimeoutRef.current = setTimeout(() => {
      pendingViewModeRef.current = null;
      pendingViewModeTimeoutRef.current = null;
    }, 1500);
    setViewMode(newMode);
    updateUrl(filters, newMode);

    // Keep tab switches feeling intentional by anchoring at page top.
    // Without this, large content-height differences can feel jumpy.
    if (typeof window !== 'undefined') {
      requestAnimationFrame(() => {
        window.scrollTo({ top: 0, left: 0, behavior: 'auto' });
      });
    }
  }, [config.slug, filters, updateUrl, viewMode]);

  useEffect(() => {
    return () => {
      if (pendingViewModeTimeoutRef.current) {
        clearTimeout(pendingViewModeTimeoutRef.current);
      }
    };
  }, []);

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
      ref={containerRef}
      className="min-h-screen bg-gray-50"
      style={{ fontFamily: config.branding.fontFamily || 'inherit' }}
    >
      {/* Google Tag Manager - System GTM (Bond) + Partner GTM */}
      <GoogleTagManager gtmId={config.gtmId} pageSlug={config.slug} />
      
      {/* Header - Conditional based on headerDisplay setting */}
      {config.features.headerDisplay !== 'hidden' && (
        <header 
          ref={headerRef}
          className={cn(
            "bg-white border-b border-gray-200 z-40",
            // Only sticky if not disabled AND not minimal mode
            !config.features.disableStickyHeader && config.features.headerDisplay !== 'minimal' && 'sticky top-0'
          )}
        >
          <div className="w-full px-3 py-3 sm:px-4 lg:px-6">
            <div className="flex items-center justify-between">
              {/* Logo & Tagline - Only shown in full mode */}
              {config.features.headerDisplay !== 'minimal' && (
                <div className="flex items-center gap-4">
                  <BrandLogo config={config} size="md" />
                  {config.branding.tagline && (
                    <div 
                      className={cn(
                        "items-center border-l-2 pl-4",
                        config.branding.showTaglineOnMobile ? "flex" : "hidden sm:flex"
                      )}
                      style={{ borderColor: config.branding.primaryColor }}
                    >
                      <span 
                        className="text-sm sm:text-base tracking-tight"
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
              )}

              {/* View Toggle & Share */}
              <div className={cn(
                "flex items-center gap-2",
                config.features.headerDisplay === 'minimal' && 'w-full justify-between'
              )}>
                {/* Desktop View Toggle - shown in header for full/minimal modes */}
                {showTabToggle && (
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

                {/* Share Button */}
                {config.features.showShareButton !== false && (
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
                )}
              </div>
            </div>

            {/* Mobile View Toggle */}
            {showTabToggle && (
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
      )}

      {/* Horizontal Filter Bar - visible on all screen sizes */}
      <div className="w-full px-3 sm:px-4 lg:px-6 py-2 bg-gray-50 border-b border-gray-200">
        <div className="flex items-center gap-3">
          {/* View Toggle - shown here when header is hidden */}
          {config.features.headerDisplay === 'hidden' && showTabToggle && (
            <div className="flex items-center bg-white rounded-lg p-1 border border-gray-200 flex-shrink-0">
              <button
                onClick={() => handleViewModeChange('programs')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'programs'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <LayoutGrid size={14} />
                <span className="hidden sm:inline">Programs</span>
              </button>
              <button
                onClick={() => handleViewModeChange('schedule')}
                className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-md text-sm font-medium transition-all ${
                  viewMode === 'schedule'
                    ? 'bg-gray-100 text-gray-900'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                <Calendar size={14} />
                <span className="hidden sm:inline">Schedule</span>
              </button>
            </div>
          )}
          
          <div className="overflow-x-auto sm:overflow-visible flex-1 min-w-0">
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
                hasMultipleFacilities: filterOptions.hasMultipleFacilities,
              }}
              config={config}
              isScheduleView={viewMode === 'schedule'}
            />
          </div>
          
          {/* Share Button - shown here when header is hidden */}
          {config.features.headerDisplay === 'hidden' && config.features.showShareButton !== false && (
            <button
              onClick={handleShare}
              className="flex items-center gap-1.5 px-2.5 py-1.5 text-sm text-gray-600 hover:text-gray-900 hover:bg-white rounded-lg transition-colors border border-transparent hover:border-gray-200 flex-shrink-0"
              title="Copy link to clipboard"
            >
              {showCopied ? (
                <>
                  <Check size={14} className="text-green-600" />
                  <span className="hidden sm:inline text-green-600">Copied!</span>
                </>
              ) : (
                <>
                  <LinkIcon size={14} />
                  <span className="hidden sm:inline">Share</span>
                </>
              )}
            </button>
          )}
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
              hasMultipleFacilities={filterOptions.hasMultipleFacilities}
              linkTarget={linkTarget}
              hideRegistrationLinks={config.features.hideRegistrationLinks}
              customRegistrationUrl={config.features.customRegistrationUrl}
            />
          ) : (
            <ScheduleView 
              schedule={scheduleData || []} 
              config={config}
              isLoading={eventsLoading}
              error={eventsError}
              totalEvents={filteredEvents.length}
              hasMultipleFacilities={filterOptions.hasMultipleFacilities}
              linkTarget={linkTarget}
              hideRegistrationLinks={config.features.hideRegistrationLinks}
              customRegistrationUrl={config.features.customRegistrationUrl}
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
        showSearch={config.features.showSearch !== false}
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
