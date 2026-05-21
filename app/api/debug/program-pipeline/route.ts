import { NextResponse } from 'next/server';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { getConfigBySlug } from '@/lib/config';
import { transformProgram } from '@/lib/transformers';
import {
  filterProgramsByPageConfig,
  filterProgramsWithActiveSessions,
  getDiscoveryIncludedProgramIds,
  PROGRAMS_DISCOVERY_EXPAND,
} from '@/lib/discovery-program-scope';

export const dynamic = 'force-dynamic';

/**
 * Diagnose why a discovery page has zero programs after filters.
 * GET /api/debug/program-pipeline?slug=your-page-slug
 */
export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');

  if (!slug) {
    return NextResponse.json({ error: 'slug query parameter required' }, { status: 400 });
  }

  const config = await getConfigBySlug(slug);
  if (!config) {
    return NextResponse.json({ error: 'Config not found' }, { status: 404 });
  }

  const today = new Date().toISOString().split('T')[0];
  const apiKey = config.apiKey || DEFAULT_API_KEY;
  const client = createBondClient(apiKey, config.features.bondEnv);
  const orgId = config.organizationIds[0];

  if (!orgId) {
    return NextResponse.json({ error: 'No organizationIds on page config' }, { status: 400 });
  }

  try {
    const response = await client.getPrograms(orgId, { expand: PROGRAMS_DISCOVERY_EXPAND });
    const rawCount = (response.data || []).length;
    const transformed = (response.data || []).map((raw) => ({
      ...transformProgram(raw),
      organizationId: orgId,
    }));

    const afterSessionDateFilter = filterProgramsWithActiveSessions(transformed, today);
    const afterFacility =
      config.facilityIds && config.facilityIds.length > 0
        ? afterSessionDateFilter.filter(
            (program) =>
              program.facilityId && config.facilityIds!.includes(program.facilityId),
          )
        : afterSessionDateFilter;

    const afterProgramFilter = filterProgramsByPageConfig(afterFacility, config);

    const includedIds = getDiscoveryIncludedProgramIds(config);
    const targetIncluded = includedIds[0];
    const sampleProgram = targetIncluded
      ? transformed.find((program) => String(program.id) === String(targetIncluded))
      : transformed[0];

    return NextResponse.json({
      slug,
      orgId,
      today,
      expand: PROGRAMS_DISCOVERY_EXPAND,
      programFilterMode: config.features.programFilterMode || 'all',
      includedProgramIds: includedIds,
      facilityIds: config.facilityIds || [],
      counts: {
        rawFromApi: rawCount,
        afterSessionEndDateFilter: afterSessionDateFilter.length,
        afterFacilityFilter: afterFacility.length,
        afterProgramIncludeExclude: afterProgramFilter.length,
      },
      sampleProgram: sampleProgram
        ? {
            id: sampleProgram.id,
            name: sampleProgram.name,
            sessionsTotal: sampleProgram.sessions?.length ?? 0,
            sessionEndDates: sampleProgram.sessions?.slice(0, 5).map((session) => ({
              id: session.id,
              name: session.name,
              endDate: session.endDate,
              keptByDateFilter: session.endDate
                ? session.endDate.slice(0, 10) >= today
                : true,
            })),
          }
        : null,
      hint:
        afterProgramFilter.length === 0 && afterSessionDateFilter.length > 0
          ? 'Program include/exclude IDs may not match API program ids (check admin Settings).'
          : afterSessionDateFilter.length === 0 && rawCount > 0
            ? 'All sessions may be past endDate; Bond API still returns them but discovery hides ended sessions.'
            : rawCount === 0
              ? 'Bond API returned no programs for this org/key/env.'
              : 'Pipeline OK — check client URL filters (programIds, facilityIds in query string).',
    });
  } catch (error) {
    console.error('[debug/program-pipeline]', error);
    return NextResponse.json(
      {
        error: 'Bond API fetch failed',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 },
    );
  }
}
