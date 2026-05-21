import { NextResponse } from 'next/server';
import { createBondClient, DEFAULT_API_KEY } from '@/lib/bond-client';
import { getConfigBySlug } from '@/lib/config';
import { mapSegmentRows } from '@/lib/host-shell/session-card-model';
import { transformSegment } from '@/lib/transformers';
import type { Segment } from '@/types';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const slug = searchParams.get('slug');
  const programId = searchParams.get('programId');
  const sessionId = searchParams.get('sessionId');
  const organizationId = searchParams.get('organizationId');

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

  if (!orgId) {
    return NextResponse.json({ error: 'Organization not configured' }, { status: 400 });
  }

  try {
    const client = createBondClient(pageConfig.apiKey || DEFAULT_API_KEY, pageConfig.features.bondEnv);
    const response = await client.getSegments(orgId, programId, sessionId);
    const segments = (response.data || []).map((raw) => transformSegment(raw) as Segment);

    return NextResponse.json({
      data: mapSegmentRows(segments),
    });
  } catch (error) {
    console.error('[portal-session-segments]', { slug, programId, sessionId, error });
    return NextResponse.json({ error: 'Failed to load segments' }, { status: 500 });
  }
}
