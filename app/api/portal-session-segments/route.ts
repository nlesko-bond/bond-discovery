import { NextResponse } from 'next/server';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { getConfigBySlug } from '@/lib/config';
import { fetchEnrichedPortalSessionSegments } from '@/lib/host-shell/portal-session-segment-detail';

export const dynamic = 'force-dynamic';

function readOptionalBooleanParam(value: string | null): boolean | undefined {
  if (value === 'true') {
    return true;
  }
  if (value === 'false') {
    return false;
  }
  return undefined;
}

function resolveCandidateOrganizationIds(
  organizationId: string | null,
  pageOrganizationIds: string[],
): string[] {
  const configuredOrgIds = pageOrganizationIds.filter(Boolean);
  if (configuredOrgIds.length === 0) {
    return organizationId ? [organizationId] : [];
  }
  if (!organizationId) {
    return configuredOrgIds;
  }
  if (configuredOrgIds.includes(organizationId)) {
    return [organizationId, ...configuredOrgIds.filter((orgId) => orgId !== organizationId)];
  }
  return [organizationId, ...configuredOrgIds];
}

async function fetchSegmentsForOrganization(
  client: ReturnType<typeof createBondClient>,
  orgId: string,
  programId: string,
  sessionId: string,
  context: Parameters<typeof fetchEnrichedPortalSessionSegments>[4],
) {
  return fetchEnrichedPortalSessionSegments(client, orgId, programId, sessionId, context);
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const programId = searchParams.get('programId');
  const sessionId = searchParams.get('sessionId');
  const organizationId = searchParams.get('organizationId');
  const sessionName = searchParams.get('sessionName') ?? '';
  const programName = searchParams.get('programName') ?? '';
  const facilityName = searchParams.get('facilityName') ?? undefined;
  const registrationWindowStatus = searchParams.get('registrationWindowStatus') ?? undefined;
  const waitlistEnabled = readOptionalBooleanParam(searchParams.get('waitlistEnabled'));
  const priceLabel = searchParams.get('priceLabel') ?? undefined;

  if (!slug || !programId || !sessionId) {
    return NextResponse.json({ error: 'Missing slug, programId, or sessionId' }, { status: 400 });
  }

  const pageConfig = await getConfigBySlug(slug);
  if (!pageConfig) {
    return NextResponse.json({ error: 'Page not found' }, { status: 404 });
  }

  const orgId =
    organizationId ||
    (pageConfig.organizationIds.length > 0 ? pageConfig.organizationIds[0] : undefined);

  if (!orgId && pageConfig.organizationIds.length === 0) {
    return NextResponse.json({ error: 'Organization not configured' }, { status: 400 });
  }

  const candidateOrgIds = resolveCandidateOrganizationIds(
    organizationId,
    pageConfig.organizationIds,
  );

  try {
    const client = createBondClient(pageConfig.apiKey || DEFAULT_API_KEY, pageConfig.features.bondEnv);
    const context = {
      name: sessionName,
      programName,
      facilityName,
      registrationWindowStatus,
      waitlistEnabled,
      priceLabel,
    };

    let lastError: unknown;
    for (const candidateOrgId of candidateOrgIds) {
      try {
        const data = await fetchSegmentsForOrganization(
          client,
          candidateOrgId,
          programId,
          sessionId,
          context,
        );
        return NextResponse.json({ data });
      } catch (error) {
        lastError = error;
        console.error('[portal-session-segments] org candidate failed', {
          slug,
          programId,
          sessionId,
          candidateOrgId,
          error,
        });
      }
    }

    throw lastError ?? new Error('Failed to load segments for all configured organizations');
  } catch (error) {
    console.error('[portal-session-segments]', { slug, programId, sessionId, error });
    return NextResponse.json({ error: 'Failed to load segments' }, { status: 500 });
  }
}
