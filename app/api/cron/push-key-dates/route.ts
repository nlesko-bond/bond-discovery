import { NextRequest, NextResponse } from 'next/server';

import { pushKeyDatesSnapshot } from '@/lib/onboarding/key-dates-webhook';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.KEY_DATES_WEBHOOK_SECRET?.trim()) {
    return NextResponse.json({
      skipped: true,
      reason: 'KEY_DATES_WEBHOOK_SECRET not configured',
    });
  }

  const admin = getSupabaseAdmin();
  const { data: orgRows } = await admin
    .from('orgs')
    .select('id')
    .not('bond_organization_id', 'is', null);

  let sent = 0;
  let orgNotFound = 0;
  let skipped = 0;
  let errors = 0;

  for (const row of orgRows ?? []) {
    if (!row?.id || typeof row.id !== 'string') {
      continue;
    }
    const result = await pushKeyDatesSnapshot(row.id);
    if (result.status === 'skipped') {
      skipped += 1;
    } else if (result.status === 'error') {
      errors += 1;
      console.error('[key-dates cron]', row.id, result.message);
    } else if (result.httpStatus === 202) {
      orgNotFound += 1;
    } else {
      sent += 1;
    }
  }

  return NextResponse.json({
    ok: true,
    total: (orgRows ?? []).length,
    sent,
    org_not_found: orgNotFound,
    skipped,
    errors,
  });
}
