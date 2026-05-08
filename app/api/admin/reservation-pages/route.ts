import { NextRequest, NextResponse } from 'next/server';
import { getAllReservationPageConfigs, createReservationPageConfig } from '@/lib/reservation-pages-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const configs = await getAllReservationPageConfigs();
    return NextResponse.json({ configs });
  } catch (error) {
    console.error('[Admin/ReservationPages] GET error:', error);
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const config = await createReservationPageConfig(body);
    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    console.error('[Admin/ReservationPages] POST error:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create config' },
      { status: 500 },
    );
  }
}
