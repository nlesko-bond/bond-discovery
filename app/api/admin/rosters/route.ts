import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import {
  createRosterPage,
  getAllRosterPages,
  getRosterPageBySlug,
  isReservedRosterSlug,
  normalizeSlug,
  type RosterPageInput,
} from '@/lib/rosters-config';

export const dynamic = 'force-dynamic';

export async function GET() {
  const denied = await requireAdmin();
  if (denied) return denied;

  return NextResponse.json({ pages: await getAllRosterPages() });
}

export async function POST(request: NextRequest) {
  const denied = await requireAdmin();
  if (denied) return denied;

  let body: RosterPageInput & { name?: string; slug?: string };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const name = body.name?.trim();
  const slug = body.slug ? normalizeSlug(body.slug) : '';

  if (!name || !slug) {
    return NextResponse.json({ error: 'name and slug are required' }, { status: 400 });
  }
  if (isReservedRosterSlug(slug)) {
    return NextResponse.json(
      { error: `"${slug}" is reserved and would collide with an app route` },
      { status: 400 }
    );
  }
  if (await getRosterPageBySlug(slug)) {
    return NextResponse.json({ error: `A roster page with slug "${slug}" already exists` }, { status: 409 });
  }

  try {
    // is_active defaults to false in the schema: publication is an explicit act.
    const page = await createRosterPage({ ...body, name, slug });
    return NextResponse.json({ page }, { status: 201 });
  } catch (error) {
    console.error('[admin/rosters] create failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create roster page' },
      { status: 500 }
    );
  }
}
