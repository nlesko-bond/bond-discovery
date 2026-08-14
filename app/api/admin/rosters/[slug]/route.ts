import { NextRequest, NextResponse } from 'next/server';
import { requireAdmin } from '@/lib/admin-auth';
import { invalidateRosterCache } from '@/lib/cache';
import {
  deleteRosterPage,
  getRosterPageBySlug,
  isReservedRosterSlug,
  normalizeSlug,
  updateRosterPage,
  type RosterPageInput,
} from '@/lib/rosters-config';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: NextRequest, context: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { slug } = await context.params;
  const page = await getRosterPageBySlug(slug);
  if (!page) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  return NextResponse.json({ page });
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { slug } = await context.params;

  let body: RosterPageInput;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  if (body.slug !== undefined) {
    const nextSlug = normalizeSlug(body.slug);
    if (!nextSlug) {
      return NextResponse.json({ error: 'slug cannot be empty' }, { status: 400 });
    }
    if (isReservedRosterSlug(nextSlug)) {
      return NextResponse.json(
        { error: `"${nextSlug}" is reserved and would collide with an app route` },
        { status: 400 }
      );
    }
    if (nextSlug !== slug && (await getRosterPageBySlug(nextSlug))) {
      return NextResponse.json({ error: `A roster page with slug "${nextSlug}" already exists` }, { status: 409 });
    }
  }

  try {
    const page = await updateRosterPage(slug, body);
    if (!page) {
      return NextResponse.json({ error: 'Not found' }, { status: 404 });
    }

    // Scope, visibility and branding all change what a viewer should get back,
    // so drop the cached payloads for both the old and new slug.
    await invalidateRosterCache(slug);
    if (page.slug !== slug) {
      await invalidateRosterCache(page.slug);
    }

    return NextResponse.json({ page });
  } catch (error) {
    console.error('[admin/rosters] update failed:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update roster page' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  const denied = await requireAdmin();
  if (denied) return denied;

  const { slug } = await context.params;
  if (!(await getRosterPageBySlug(slug))) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const ok = await deleteRosterPage(slug);
  if (!ok) {
    return NextResponse.json({ error: 'Failed to delete roster page' }, { status: 500 });
  }

  await invalidateRosterCache(slug);
  return NextResponse.json({ ok: true });
}
