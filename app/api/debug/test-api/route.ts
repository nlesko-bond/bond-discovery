import { NextResponse } from 'next/server';
import { createBondClient } from '@/lib/bond-client';
import { getConfigBySlug } from '@/lib/config';

export const dynamic = 'force-dynamic';

/**
 * Test Bond API directly
 * Usage: GET /api/debug/test-api?slug=toca-allen-adult-pickup-soccer
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  
  if (!slug) {
    return NextResponse.json({ error: 'slug parameter required' }, { status: 400 });
  }
  
  try {
    const config = await getConfigBySlug(slug);
    
    if (!config) {
      return NextResponse.json({ error: 'Config not found' }, { status: 404 });
    }
    
    const client = createBondClient(config.apiKey);
    const orgId = config.organizationIds[0];
    const programId = config.includedProgramIds?.[0] || config.features?.includedProgramIds?.[0];
    
    // Test 1: Get all programs for the org
    console.log(`Testing API for org ${orgId} with program filter ${programId}`);
    
    const programsResponse = await client.getPrograms(orgId, {
      expand: 'sessions,sessions.events',
    });
    
    const allPrograms = programsResponse.data || [];
    
    // Test 2: Find the specific program
    const targetProgram = allPrograms.find((p: any) => String(p.id) === String(programId));
    
    // Test 3: Count sessions and events
    let totalSessions = 0;
    let totalEvents = 0;
    
    if (targetProgram?.sessions) {
      totalSessions = targetProgram.sessions.length;
      targetProgram.sessions.forEach((s: any) => {
        if (s.events) totalEvents += s.events.length;
      });
    }
    
    return NextResponse.json({
      config: {
        slug: config.slug,
        apiKeyPreview: config.apiKey ? `${config.apiKey.substring(0, 8)}...` : 'NONE',
        orgId,
        programId,
      },
      api: {
        totalProgramsInOrg: allPrograms.length,
        programIds: allPrograms.map((p: any) => ({ id: p.id, name: p.name })).slice(0, 20),
        targetProgramFound: !!targetProgram,
        targetProgram: targetProgram ? {
          id: targetProgram.id,
          name: targetProgram.name,
          sessionsCount: totalSessions,
          eventsCount: totalEvents,
          sessions: targetProgram.sessions?.map((s: any) => ({
            id: s.id,
            name: s.name,
            eventsCount: s.events?.length || 0,
            sampleEvents: s.events?.slice(0, 3).map((e: any) => ({
              id: e.id,
              startTime: e.startTime,
              endTime: e.endTime,
            })),
          })).slice(0, 5),
        } : 'NOT FOUND - check if program ID exists in this org',
      },
    });
  } catch (error) {
    console.error('API test error:', error);
    return NextResponse.json({ 
      error: 'API call failed',
      details: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 });
  }
}
