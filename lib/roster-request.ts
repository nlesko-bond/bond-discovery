/**
 * Shared request preamble for every public roster route.
 *
 * Collapses the four checks that must happen, in order, before any Bond call:
 * the page exists, it is published, the viewer may see it, and — separately —
 * whether this request is entitled to staff fields.
 *
 * Routes should never assemble these themselves; a route that forgets the
 * `resolveViewerMode` step would default to whatever the caller asked for.
 */

import { NextResponse } from 'next/server';
import { canViewRosterPage, resolveViewerMode } from '@/lib/roster-access';
import { getRosterPageBySlug } from '@/lib/rosters-config';
import type { RosterPageConfig, RosterViewerMode } from '@/types/rosters';

export interface RosterRequestContext {
  config: RosterPageConfig;
  mode: RosterViewerMode;
}

type RosterRequestResult =
  | { ok: true; context: RosterRequestContext }
  | { ok: false; response: NextResponse };

export async function resolveRosterRequest(slug: string): Promise<RosterRequestResult> {
  const config = await getRosterPageBySlug(slug);

  // An unpublished page is indistinguishable from a missing one, so an
  // in-progress page cannot be probed for existence.
  if (!config || !config.isActive) {
    return { ok: false, response: NextResponse.json({ error: 'Not found' }, { status: 404 }) };
  }

  const allowed = await canViewRosterPage(
    slug,
    config.pageAccess,
    config.hasViewerPassword,
    config.hasStaffPassword
  );
  if (!allowed) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Password required', locked: true }, { status: 401 }),
    };
  }

  // The only source of 'staff'. Never taken from a query param or header.
  const mode = await resolveViewerMode(slug, config.hasStaffPassword);

  return { ok: true, context: { config, mode } };
}

/** Parse and validate a positive integer query parameter. */
export function numericParam(value: string | null): number | undefined {
  if (!value) return undefined;
  const n = Number.parseInt(value, 10);
  return Number.isFinite(n) && n > 0 ? n : undefined;
}
