import { NextResponse } from 'next/server';
import { createBondClient, DEFAULT_API_KEY, DEFAULT_ORG_IDS } from '@/lib/bond-client';
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
}

/**
 * GET /api/events
 * Fetches all events for all sessions across organizations
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const orgIds = searchParams.get('orgIds') 
    ? searchParams.get('orgIds')!.split(/[_,]/).filter(Boolean) 
    : DEFAULT_ORG_IDS;
  const facilityId = searchParams.get('facilityId') || undefined;
  const startDate = searchParams.get('startDate') || undefined;
  const endDate = searchParams.get('endDate') || undefined;
  
  try {
    const client = createBondClient(DEFAULT_API_KEY);
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
            try {
              // Fetch events with resources expand for court/field names
              const eventsResponse = await client.getEvents(orgId, program.id, session.id, {
                expand: 'resources'
              });
              const events = eventsResponse.data || [];
              
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
