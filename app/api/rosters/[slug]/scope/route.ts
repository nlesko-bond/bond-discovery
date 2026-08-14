import { NextRequest, NextResponse } from 'next/server';
import { loadRosterScope } from '@/lib/roster-data';
import { resolveRosterRequest } from '@/lib/roster-request';

export const dynamic = 'force-dynamic';

/** Varies by cookie and can describe a gated page's structure. */
const NO_STORE = {
  'Cache-Control': 'private, no-store',
  Vary: 'Cookie',
};

interface Ctx {
  params: Promise<{ slug: string }>;
}

/** The sessions a viewer of this page may browse. */
export async function GET(_request: NextRequest, context: Ctx) {
  const { slug } = await context.params;

  const resolved = await resolveRosterRequest(slug);
  if (!resolved.ok) return resolved.response;

  const { config, mode } = resolved.context;

  try {
    const sessions = await loadRosterScope(config);
    return NextResponse.json({
      sessions,
      mode,
      page: {
        name: config.name,
        branding: config.branding,
        allowPrint: config.allowPrint,
        isYouth: config.isYouth,
        hasStaffPassword: config.hasStaffPassword,
      },
    }, { headers: NO_STORE });
  } catch (error) {
    console.error(`[rosters/${slug}/scope]`, error);
    return NextResponse.json({ error: 'Failed to load sessions' }, { status: 502 });
  }
}
