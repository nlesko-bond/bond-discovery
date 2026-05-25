import { NextRequest, NextResponse } from 'next/server';
import type { OnboardingNotifyState } from '@/lib/onboarding/notify-state';
import { mergeOnboardingNotifyState, parseOnboardingNotifyState } from '@/lib/onboarding/notify-state';
import {
  getOrgNotifyContext,
  postOnboardingSlackNotification,
  slackEscape,
} from '@/lib/onboarding/slack-onboarding';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 120;

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

const STALL_ALERT_DAY_THRESHOLD_5 = 5;

const STALL_ALERT_DAY_THRESHOLD_7 = 7;

export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization');
  const cronSecret = process.env.CRON_SECRET;
  if (cronSecret && authHeader !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  if (!process.env.SLACK_ONBOARDING_WEBHOOK_URL) {
    return NextResponse.json({
      skipped: true,
      reason: 'SLACK_ONBOARDING_WEBHOOK_URL not configured',
    });
  }

  const admin = getSupabaseAdmin();

  const { data: activeOrgs } = await admin
    .from('orgs')
    .select(
      `id,
      created_at,
      spaces_uploaded_at,
      onboarding_notify_state`,
    )
    .eq('status', 'active');

  let sent5 = 0;
  let sent7 = 0;
  let skippedWarm = 0;
  let slackSkip = 0;

  const rows = activeOrgs ?? [];

  for (const raw of rows as Array<{
    id: string;
    created_at: string;
    spaces_uploaded_at?: string | null;
    onboarding_notify_state: unknown;
  }>) {
    const orgId = raw.id;

    const { data: progress } = await admin
      .from('step_progress')
      .select('completed_at')
      .eq('org_id', orgId)
      .eq('completed', true)
      .not('completed_at', 'is', null);

    const times: number[] = [new Date(raw.created_at).getTime()];
    if (raw.spaces_uploaded_at) times.push(new Date(raw.spaces_uploaded_at).getTime());

    for (const p of progress ?? []) {
      const t =
        typeof p.completed_at === 'string' ? new Date(p.completed_at).getTime() : 0;
      if (t > 0) times.push(t);
    }

    const lastActivityMs = Math.max(...times, 0);
    const inactiveDays = Math.floor((Date.now() - lastActivityMs) / MILLISECONDS_PER_DAY);

    if (inactiveDays < STALL_ALERT_DAY_THRESHOLD_5) {
      skippedWarm++;
      continue;
    }

    const state = parseOnboardingNotifyState(raw.onboarding_notify_state);
    let patchPayload: Partial<OnboardingNotifyState> = {};

    try {
      const ctx = await getOrgNotifyContext(orgId);
      if (!ctx) {
        slackSkip++;
        continue;
      }

      const buildBody = (dayLabel: number) =>
        `*Org contact*\n${formatBullets(ctx.org.contact_name, ctx.org.contact_email)}\n\n*Details*\n• No onboarding activity detected for at least ${dayLabel} days (based on checklist updates, uploads, and org creation).\n• Consider reaching out via email or Slack.`;

      if (inactiveDays >= STALL_ALERT_DAY_THRESHOLD_5 && !state.stall5SentAt) {
        await postOnboardingSlackNotification({
          headline: `Onboarding stall (${STALL_ALERT_DAY_THRESHOLD_5}-day threshold)`,
          ctx,
          bodyMarkdown: buildBody(STALL_ALERT_DAY_THRESHOLD_5),
          footerNote: 'Triggered by Bond Discovery onboarding stall cron.',
          fallbackSuffix: `stall ${STALL_ALERT_DAY_THRESHOLD_5}d`,
        });
        patchPayload = { ...patchPayload, stall5SentAt: new Date().toISOString() };
        sent5++;
      }

      if (inactiveDays >= STALL_ALERT_DAY_THRESHOLD_7 && !state.stall7SentAt) {
        await postOnboardingSlackNotification({
          headline: `Onboarding stall (${STALL_ALERT_DAY_THRESHOLD_7}-day threshold)`,
          ctx,
          bodyMarkdown: buildBody(STALL_ALERT_DAY_THRESHOLD_7),
          footerNote: 'Triggered by Bond Discovery onboarding stall cron.',
          fallbackSuffix: `stall ${STALL_ALERT_DAY_THRESHOLD_7}d`,
        });
        patchPayload = { ...patchPayload, stall7SentAt: new Date().toISOString() };
        sent7++;
      }

      if (
        patchPayload.stall5SentAt !== undefined ||
        patchPayload.stall7SentAt !== undefined
      ) {
        await mergeOnboardingNotifyState(orgId, patchPayload);
      }
    } catch (e) {
      console.error('onboarding-stall-alerts:', orgId, e);
      slackSkip++;
    }
  }

  return NextResponse.json({
    scanned: rows.length,
    sentDay5: sent5,
    sentDay7: sent7,
    skippedWarm,
    slackSkip,
  });
}

function formatBullets(name: string | null, email: string | null): string {
  const n = name?.trim() ? `• ${slackEscape(name.trim())}` : '';
  const e = email?.trim() ? `• ${slackEscape(email.trim())}` : '';
  if (!n && !e) return '• —';
  return [n, e].filter(Boolean).join('\n');
}
