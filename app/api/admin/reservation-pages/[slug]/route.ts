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

export async function PATCH(request: NextRequest, context: RouteContext) {
  const { slug } = await context.params;
  try {
    const body = await request.json();
    const config = await updateReservationPageConfig(slug, body);
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
