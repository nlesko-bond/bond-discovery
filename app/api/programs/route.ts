import { NextResponse } from 'next/server';
import { createBondClient, DEFAULT_API_KEY, DEFAULT_ORG_IDS } from '@/lib/bond-client';
import { transformProgram } from '@/lib/transformers';
import { getConfigBySlug } from '@/lib/config';
import { Program } from '@/types';

export const dynamic = 'force-dynamic';
export const revalidate = 300; // 5 minutes

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  
  // Get slug to look up page config for program filtering
  const slug = searchParams.get('slug');
  const pageConfig = slug ? await getConfigBySlug(slug) : null;
  const apiKey = pageConfig?.apiKey || searchParams.get('apiKey') || DEFAULT_API_KEY;
  
  // Program filtering: determine mode and IDs
  const programFilterMode = pageConfig?.features?.programFilterMode || 'all';
  const excludedProgramIds = pageConfig?.excludedProgramIds || [];
  const includedProgramIds = pageConfig?.includedProgramIds || [];
  
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
    const client = createBondClient(apiKey);
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

    // Filter programs based on mode
    let filteredPrograms = allPrograms;
    
    if (programFilterMode === 'include' && includedProgramIds.length > 0) {
      // Include mode: only show specified programs
      filteredPrograms = allPrograms.filter(p => includedProgramIds.includes(p.id));
    } else if (programFilterMode === 'exclude' && excludedProgramIds.length > 0) {
      // Exclude mode: hide specified programs
      filteredPrograms = allPrograms.filter(p => !excludedProgramIds.includes(p.id));
    }
    // 'all' mode: no filtering needed

    return NextResponse.json({
      data: filteredPrograms,
      meta: {
        totalOrganizations: orgIds.length,
        totalPrograms: filteredPrograms.length,
        programFilterMode,
        excludedPrograms: programFilterMode === 'exclude' ? excludedProgramIds.length : 0,
        includedPrograms: programFilterMode === 'include' ? includedProgramIds.length : 0,
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
