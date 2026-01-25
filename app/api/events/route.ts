import { NextResponse } from 'next/server';
import { createBondClient, DEFAULT_API_KEY, DEFAULT_ORG_IDS } from '@/lib/bond-client';
import { getConfigBySlug } from '@/lib/config';
import { transformProgram } from '@/lib/transformers';
import { Program, Session, SessionEvent } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

// Default timezone for events (US Eastern)
const DEFAULT_TIMEZONE = 'America/New_York';

/**
 * Get today's date in a specific timezone (YYYY-MM-DD format)
 */
function getTodayInTimezone(timezone: string = DEFAULT_TIMEZONE): string {
  try {
    return new Date().toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    // Fallback to UTC if timezone is invalid
    return new Date().toISOString().split('T')[0];
  }
}

/**
 * Get the local date (YYYY-MM-DD) from an ISO date string in a specific timezone
 */
function getLocalDate(isoDateStr: string, timezone: string = DEFAULT_TIMEZONE): string {
  try {
    const date = new Date(isoDateStr);
    return date.toLocaleDateString('en-CA', { timeZone: timezone });
  } catch {
    // Fallback to simple split
    return isoDateStr.split('T')[0];
  }
}

/**
 * Calculate registration status from session dates
 * This is more accurate than the event's registrationWindowStatus
 */
function calculateSessionRegistrationStatus(
  registrationStartDate?: string,
  registrationEndDate?: string,
  timezone: string = DEFAULT_TIMEZONE
): string {
  const today = getTodayInTimezone(timezone);
  
  // If registration hasn't started yet
  if (registrationStartDate && registrationStartDate > today) {
    return 'not_opened_yet';
  }
  
  // If registration has ended
  if (registrationEndDate && registrationEndDate < today) {
    return 'closed';
  }
  
  // Registration is open (or no dates specified)
  return 'open';
}

interface TransformedEvent {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  timezone?: string;
  programId: string;
  programName: string;
  sessionId: string;
  sessionName: string;
  facilityName?: string;
  spaceName?: string;  // Resource/court/field name
  sport?: string;
  type?: string;
  linkSEO?: string;
  registrationWindowStatus?: string;
  maxParticipants?: number;
  currentParticipants?: number;
  // Pricing
  startingPrice?: number;
  memberPrice?: number;
  // Waitlist
  isWaitlistEnabled?: boolean;
  waitlistCount?: number;
  // Segment info (for segmented sessions)
  segmentId?: string;
  segmentName?: string;
  isSegmented?: boolean;
}

/**
 * GET /api/events
 * Fetches all events for all sessions across organizations
 * By default, only fetches events from today onwards (excludes past events)
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Get slug to look up config (for API key inheritance)
  const slug = searchParams.get('slug');
  let apiKey = searchParams.get('apiKey') || DEFAULT_API_KEY;
  let orgIds = searchParams.get('orgIds') 
    ? searchParams.get('orgIds')!.split(/[_,]/).filter(Boolean) 
    : DEFAULT_ORG_IDS;
  
  // Excluded program IDs from config
  let excludedProgramIds: string[] = [];
  
  // If slug is provided, look up config to get API key, org IDs, and excluded programs
  if (slug) {
    const config = await getConfigBySlug(slug);
    if (config) {
      apiKey = config.apiKey || apiKey;
      if (config.organizationIds.length > 0) {
        orgIds = config.organizationIds;
      }
      excludedProgramIds = config.excludedProgramIds || [];
      // Using config API key for this slug
    }
  } else if (orgIds.length > 0) {
    // Fallback: Look up config by orgIds if no slug provided
    // This is for backwards compatibility with old client code
    const { getAllPageConfigs } = await import('@/lib/config');
    const allConfigs = await getAllPageConfigs();
    const matchingConfig = allConfigs.find(c => 
      c.organizationIds.length === orgIds.length &&
      c.organizationIds.every(id => orgIds.includes(id))
    );
    if (matchingConfig?.apiKey) {
      apiKey = matchingConfig.apiKey;
      // Using inherited API key from config for orgIds
    }
  }
  
  const facilityId = searchParams.get('facilityId') || undefined;
  
  // Get today's date in the default timezone (used for filtering)
  // We use DEFAULT_TIMEZONE since most events are in US Eastern
  const todayLocal = getTodayInTimezone(DEFAULT_TIMEZONE);
  const startDateFilter = searchParams.get('startDate') || todayLocal;
  const endDateFilter = searchParams.get('endDate') || undefined;
  const includePast = searchParams.get('includePast') === 'true';
  
  try {
    const client = createBondClient(apiKey);
    const allEvents: TransformedEvent[] = [];
    
    // First, get all programs with sessions
    for (const orgId of orgIds) {
      try {
        console.log(`Fetching programs for org ${orgId}...`);
        const programsResponse = await client.getPrograms(orgId, {
          expand: 'sessions',
          facilityId,
        });
        
        const programs = (programsResponse.data || []).map(raw => ({
          ...transformProgram(raw),
          organizationId: orgId,
        }));
        
        // For each program's sessions, fetch events
        for (const program of programs) {
          // Skip excluded programs
          if (excludedProgramIds.includes(program.id)) {
            continue;
          }
          
          const sessions = program.sessions || [];
          
          for (const session of sessions) {
            // Skip sessions that have already ended (unless includePast is true)
            // Compare using local dates in the default timezone
            if (!includePast && session.endDate) {
              const sessionEndLocalDate = getLocalDate(session.endDate, DEFAULT_TIMEZONE);
              if (sessionEndLocalDate < todayLocal) {
                continue; // Skip past sessions
              }
            }
            
            // Get pricing from session products
            const products = session.products || [];
            let startingPrice: number | undefined;
            let memberPrice: number | undefined;
            
            for (const product of products) {
              const prices = product.prices || [];
              for (const price of prices) {
                const amount = price.price || price.amount || 0;
                if (product.membershipRequired || product.isMemberProduct) {
                  if (memberPrice === undefined || amount < memberPrice) {
                    memberPrice = amount;
                  }
                } else {
                  if (startingPrice === undefined || amount < startingPrice) {
                    startingPrice = amount;
                  }
                }
              }
            }
            
            // Calculate registration status from SESSION dates (more accurate than event status)
            const sessionRegistrationStatus = calculateSessionRegistrationStatus(
              session.registrationStartDate,
              session.registrationEndDate,
              DEFAULT_TIMEZONE
            );
            
            // Helper to transform an event
            const transformEvent = (event: any, segmentId?: string, segmentName?: string): TransformedEvent | null => {
              // Use event's timezone or fall back to default
              const eventTimezone = event.timezone || DEFAULT_TIMEZONE;
              
              // Extract resource names (court/field) from resources array
              const resourceNames = event.resources && Array.isArray(event.resources) 
                ? event.resources.map((r: any) => r.name).filter(Boolean).join(', ')
                : undefined;
              
              const transformedEvent: TransformedEvent = {
                id: String(event.id),
                title: event.title || segmentName || session.name || program.name,
                startDate: event.startDate,
                endDate: event.endDate,
                timezone: eventTimezone,
                programId: program.id,
                programName: program.name,
                sessionId: session.id,
                sessionName: segmentName || session.name || '',
                facilityName: session.facility?.name || program.facilityName,
                spaceName: resourceNames,  // Resource/court/field from expand=resources
                sport: program.sport,
                type: program.type,
                linkSEO: session.linkSEO || program.linkSEO,
                registrationWindowStatus: sessionRegistrationStatus,
                maxParticipants: event.maxParticipants,
                currentParticipants: event.currentParticipants,
                startingPrice,
                memberPrice,
                // Waitlist - get from session or event
                isWaitlistEnabled: session.isWaitlistEnabled || session.waitlistEnabled || event.isWaitlistEnabled,
                waitlistCount: session.waitlistCount || event.waitlistCount,
                // Segment info
                segmentId,
                segmentName,
                isSegmented: !!segmentId,
              };
              
              // Apply date filtering using local dates in event's timezone
              if (startDateFilter || endDateFilter) {
                const eventLocalDate = getLocalDate(event.startDate, eventTimezone);
                if (startDateFilter && eventLocalDate < startDateFilter) return null;
                if (endDateFilter && eventLocalDate > endDateFilter) return null;
              }
              
              return transformedEvent;
            };
            
            try {
              // Check if session uses segments
              if (session.isSegmented) {
                console.log(`Session ${session.id} is segmented, fetching segments...`);
                
                // Fetch segments for this session
                const segmentsResponse = await client.getSegments(orgId, program.id, session.id);
                const segments = segmentsResponse.data || [];
                
                console.log(`Found ${segments.length} segments for session ${session.id}`);
                
                // For each segment, fetch events
                for (const segment of segments) {
                  try {
                    const segmentEventsResponse = await client.getSegmentEvents(
                      orgId, 
                      program.id, 
                      session.id, 
                      segment.id,
                      { expand: 'resources' }
                    );
                    const segmentEvents = segmentEventsResponse.data || [];
                    
                    console.log(`Segment ${segment.id} (${segment.name}): ${segmentEvents.length} events`);
                    
                    // Transform and add segment events
                    segmentEvents.forEach((event: any) => {
                      const transformed = transformEvent(event, segment.id, segment.name);
                      if (transformed) {
                        allEvents.push(transformed);
                      }
                    });
                  } catch (err) {
                    console.error(`Error fetching events for segment ${segment.id}:`, err);
                  }
                }
              } else {
                // Non-segmented session - fetch events directly
                const eventsResponse = await client.getEvents(orgId, program.id, session.id, {
                  expand: 'resources'
                });
                const events = eventsResponse.data || [];
                
                // Transform and add events
                events.forEach((event: any) => {
                  const transformed = transformEvent(event);
                  if (transformed) {
                    allEvents.push(transformed);
                  }
                });
              }
            } catch (err) {
              console.error(`Error fetching events for session ${session.id}:`, err);
            }
          }
        }
      } catch (err) {
        console.error(`Error fetching programs for org ${orgId}:`, err);
      }
    }
    
    // Sort events by start date
    allEvents.sort((a, b) => new Date(a.startDate).getTime() - new Date(b.startDate).getTime());
    
    console.log(`Total events fetched: ${allEvents.length}`);
    
    return NextResponse.json({
      data: allEvents,
      meta: {
        totalEvents: allEvents.length,
        organizations: orgIds.length,
        timezone: DEFAULT_TIMEZONE,
        cachedAt: new Date().toISOString(),
      }
    }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      }
    });
    
  } catch (error) {
    console.error('Error fetching events:', error);
    return NextResponse.json(
      { error: 'Failed to fetch events' },
      { status: 500 }
    );
  }
}
