import { NextResponse } from 'next/server';
import { createBondClient, DEFAULT_API_KEY, DEFAULT_ORG_IDS } from '@/lib/bond-client';
import { getConfigBySlug } from '@/lib/config';
import { transformProgram } from '@/lib/transformers';
import { Program, Session, SessionEvent } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 300;

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
  
  // If slug is provided, look up config to get API key and org IDs
  if (slug) {
    const config = await getConfigBySlug(slug);
    if (config) {
      apiKey = config.apiKey || apiKey;
      if (config.organizationIds.length > 0) {
        orgIds = config.organizationIds;
      }
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
  
  // Default to today if no startDate specified (don't fetch past events)
  const today = new Date().toISOString().split('T')[0];
  const startDate = searchParams.get('startDate') || today;
  const endDate = searchParams.get('endDate') || undefined;
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
          const sessions = program.sessions || [];
          
          for (const session of sessions) {
            // Skip sessions that have already ended (unless includePast is true)
            if (!includePast && session.endDate) {
              const sessionEndDate = new Date(session.endDate);
              const todayDate = new Date(today);
              if (sessionEndDate < todayDate) {
                continue; // Skip past sessions
              }
            }
            
            try {
              // Fetch events with resources expand for court/field names
              const eventsResponse = await client.getEvents(orgId, program.id, session.id, {
                expand: 'resources'
              });
              const events = eventsResponse.data || [];
              
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
              
              // Transform and add events
              events.forEach((event: any) => {
                // Extract resource names (court/field) from resources array
                const resourceNames = event.resources && Array.isArray(event.resources) 
                  ? event.resources.map((r: any) => r.name).filter(Boolean).join(', ')
                  : undefined;
                
                const transformedEvent: TransformedEvent = {
                  id: String(event.id),
                  title: event.title || session.name || program.name,
                  startDate: event.startDate,
                  endDate: event.endDate,
                  timezone: event.timezone,
                  programId: program.id,
                  programName: program.name,
                  sessionId: session.id,
                  sessionName: session.name || '',
                  facilityName: session.facility?.name || program.facilityName,
                  spaceName: resourceNames,  // Resource/court/field from expand=resources
                  sport: program.sport,
                  type: program.type,
                  linkSEO: session.linkSEO || program.linkSEO,
                  registrationWindowStatus: event.registrationWindowStatus,
                  maxParticipants: event.maxParticipants,
                  currentParticipants: event.currentParticipants,
                  startingPrice,
                  memberPrice,
                };
                
                // Apply date filtering if provided
                if (startDate || endDate) {
                  const eventStart = new Date(event.startDate);
                  if (startDate && eventStart < new Date(startDate)) return;
                  if (endDate && eventStart > new Date(endDate)) return;
                }
                
                allEvents.push(transformedEvent);
              });
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
