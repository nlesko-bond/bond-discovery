import { NextRequest, NextResponse } from 'next/server';
import { staffSessionOk } from '@/lib/form-staff-cookie';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;
  return NextResponse.json({ authenticated: staffSessionOk(request, slug) });
}
