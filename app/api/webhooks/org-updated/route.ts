import { NextRequest, NextResponse } from 'next/server';
import {
  getOrgNotifyContext,
  postOnboardingSlackNotification,
  slackEscape,
} from '@/lib/onboarding/slack-onboarding';
import { getSupabaseAdmin } from '@/lib/supabase';

type OrgWebhookPayload = {
  type?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  let payload: OrgWebhookPayload;
  try {
    payload = (await req.json()) as OrgWebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const record = payload.record;
  const oldRecord = payload.old_record;

  if (!record?.id || typeof record.id !== 'string') {
    return NextResponse.json({ skipped: true, reason: 'missing org id' });
  }

  const orgId = record.id;

  const nextLaunch = stringifyDate(record.expected_launch_date);
  const prevLaunch =
    oldRecord !== undefined ? stringifyDate(oldRecord.expected_launch_date) : undefined;

  if (nextLaunch === undefined && prevLaunch === undefined) {
    return NextResponse.json({ skipped: true, reason: 'no launch field' });
  }

  const changed = prevLaunch !== nextLaunch;
  if (!changed) {
    return NextResponse.json({ skipped: true, reason: 'launch date unchanged' });
  }

  if (!process.env.SLACK_ONBOARDING_WEBHOOK_URL) {
    return NextResponse.json({
      skipped: true,
      reason: 'SLACK_ONBOARDING_WEBHOOK_URL not configured',
    });
  }

  const ctx = await getOrgNotifyContext(orgId);
  if (!ctx) {
    return NextResponse.json({ skipped: true, reason: 'no rep or notifications disabled' });
  }

  const displayPrev = prevLaunch ?? 'none';
  const displayNext = nextLaunch ?? 'cleared';

  try {
    await postOnboardingSlackNotification({
      headline: 'Expected launch date updated',
      ctx,
      bodyMarkdown:
        `*Org contact*\n${formatBullets(ctx.org.contact_name, ctx.org.contact_email)}\n\n*Details*\n• Previous: ${slackEscape(displayPrev)}\n• New: ${slackEscape(displayNext)}`,
      footerNote: 'Triggered when expected launch date is edited in Bond Discovery onboarding admin.',
      fallbackSuffix: 'Launch date updated',
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : 'Slack failed';
    return NextResponse.json({ error: msg }, { status: 502 });
  }

  return NextResponse.json({ sent: true });
}

function stringifyDate(v: unknown): string | undefined {
  if (v === null || v === undefined || v === '') return undefined;
  if (typeof v === 'string') {
    const t = v.trim();
    if (!t) return undefined;
    if (/^\d{4}-\d{2}-\d{2}/.test(t)) return t.slice(0, 10);
    return t;
  }
  return undefined;
}

function formatBullets(name: string | null, email: string | null): string {
  const n = name?.trim() ? `• ${slackEscape(name.trim())}` : '';
  const e = email?.trim() ? `• ${slackEscape(email.trim())}` : '';
  if (!n && !e) return '• —';
  return [n, e].filter(Boolean).join('\n');
}
