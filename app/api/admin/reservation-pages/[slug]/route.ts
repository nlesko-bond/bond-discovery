import { NextRequest, NextResponse } from 'next/server';
import {
  getReservationPageConfigBySlug,
  updateReservationPageConfig,
  deleteReservationPageConfig,
} from '@/lib/reservation-pages-config';

export const dynamic = 'force-dynamic';

interface RouteContext {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  try {
    const config = await getReservationPageConfigBySlug(slug);
    if (!config) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }
    return NextResponse.json({ config });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to fetch config' }, { status: 500 });
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  try {
    const body: unknown = await request.json();
    if (!isRecord(body)) {
      return NextResponse.json({ error: 'Invalid body' }, { status: 400 });
    }
    const viewer_password_new = typeof body.viewer_password_new === 'string' ? body.viewer_password_new : undefined;
    const viewer_password_clear = body.viewer_password_clear === true;
    const safe = { ...body };
    delete safe.viewer_password_new;
    delete safe.viewer_password_clear;
    delete safe.viewer_password_hash;
    delete safe.hasViewerPassword;
    const config = await updateReservationPageConfig(slug, {
      ...(safe as Parameters<typeof updateReservationPageConfig>[1]),
      viewer_password_new,
      viewer_password_clear,
    });
    return NextResponse.json({ config });
  } catch (error) {
    console.error('[Admin/ReservationPages] PATCH error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 500 },
    );
  }
}

export async function DELETE(_request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  try {
    const success = await deleteReservationPageConfig(slug);
    if (!success) {
      return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    }
    return NextResponse.json({ success: true });
  } catch (error) {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
