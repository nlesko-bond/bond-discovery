import { NextResponse } from 'next/server';
import { createBondClient, DEFAULT_API_KEY, DEFAULT_ORG_IDS } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { cached, programsCacheKey } from '@/lib/cache';
import { Program } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Get org IDs from query params or use defaults
  const orgIdsParam = searchParams.get('orgIds');
  const orgIds = orgIdsParam 
    ? orgIdsParam.split(/[_,]/).filter(Boolean)
    : DEFAULT_ORG_IDS;
  
  const facilityId = searchParams.get('facilityId') || undefined;
  const expand = searchParams.get('expand') || 'sessions,sessions.products,sessions.products.prices';
  const includePast = searchParams.get('includePast') === 'true';
  
  // Today's date for filtering past sessions
  const today = new Date().toISOString().split('T')[0];

  try {
    const client = createBondClient(DEFAULT_API_KEY);
    const allPrograms: Program[] = [];

    // Fetch programs from all organizations in parallel
    const promises = orgIds.map(async (orgId) => {
      try {
        console.log(`Fetching programs for org ${orgId}...`);
        
        // Fetch directly without caching for now to debug
        const response = await client.getPrograms(orgId, { expand, facilityId });
        console.log(`Got ${response?.data?.length || 0} programs for org ${orgId}`);

        // Transform and add org ID
        const programs = (response.data || []).map(raw => ({
          ...transformProgram(raw),
          organizationId: orgId,
        }));

        // Filter out past sessions unless includePast is true
        if (!includePast) {
          programs.forEach(program => {
            if (program.sessions) {
              program.sessions = program.sessions.filter(session => {
                if (!session.endDate) return true; // Keep sessions without end date
                return session.endDate >= today;
              });
            }
          });
          
          // Remove programs with no active sessions
          return programs.filter(p => !p.sessions || p.sessions.length > 0);
        }

        return programs;
      } catch (error) {
        console.error(`Error fetching programs for org ${orgId}:`, error);
        return [];
      }
    });

    const results = await Promise.all(promises);
    results.forEach(programs => allPrograms.push(...programs));

    return NextResponse.json({
      data: allPrograms,
      meta: {
        totalOrganizations: orgIds.length,
        totalPrograms: allPrograms.length,
        cachedAt: new Date().toISOString(),
      }
    }, {
      headers: {
        'Cache-Control': 's-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (error) {
    console.error('Error fetching programs:', error);
    return NextResponse.json(
      { error: 'Failed to fetch programs' },
      { status: 500 }
    );
  }
}
