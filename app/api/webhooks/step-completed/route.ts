import { NextRequest, NextResponse } from 'next/server';
import { mergeOnboardingNotifyState, parseOnboardingNotifyState } from '@/lib/onboarding/notify-state';
import {
  getKickoffDividerAfterIndex,
  getOrgNotifyContext,
  isBankAccountSetupStep,
  isPreKickoffComplete,
  postOnboardingSlackNotification,
  slackEscape,
} from '@/lib/onboarding/slack-onboarding';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
};

export async function POST(req: NextRequest) {
  let payload: WebhookPayload;
  try {
    payload = (await req.json()) as WebhookPayload;
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const record = payload.record as
    | {
        org_id?: string;
        step_index?: number;
        completed?: boolean;
      }
    | undefined;

  if (!record?.org_id || record.step_index == null) {
    return NextResponse.json({ skipped: true, reason: 'no record' });
  }

  if (record.completed !== true) {
    return NextResponse.json({ skipped: true, reason: 'not completed' });
  }

  const oldRecord = payload.old_record as { completed?: boolean } | undefined;
  if (oldRecord?.completed === true) {
    return NextResponse.json({ skipped: true, reason: 'already completed' });
  }

  if (!process.env.SLACK_ONBOARDING_WEBHOOK_URL) {
    return NextResponse.json({
      skipped: true,
      reason: 'SLACK_ONBOARDING_WEBHOOK_URL not configured',
    });
  }

  const ctx = await getOrgNotifyContext(record.org_id);
  if (!ctx) {
    return NextResponse.json({ skipped: true, reason: 'no rep or notifications disabled' });
  }

  const admin = getSupabaseAdmin();

  const { data: orgRow } = await admin
    .from('orgs')
    .select('onboarding_notify_state')
    .eq('id', record.org_id)
    .maybeSingle();

  let steps: TemplateStep[] = [];
  let meta: Record<string, unknown> | null = null;
  if (ctx.org.template_id) {
    const { data: tpl } = await admin
      .from('templates')
      .select('steps, meta')
      .eq('id', ctx.org.template_id)
      .maybeSingle();
    steps = (tpl?.steps as TemplateStep[] | undefined) ?? [];
    meta = tpl?.meta !== null && tpl?.meta !== undefined ? (tpl.meta as Record<string, unknown>) : null;
  }

  const currentStep = steps[record.step_index];
  if (!currentStep) {
    return NextResponse.json({ skipped: true, reason: 'missing step definition' });
  }

  try {
    if (isBankAccountSetupStep(currentStep)) {
      await postOnboardingSlackNotification({
        headline: 'Bank account connected',
        ctx,
        bodyMarkdown:
          `*Org contact*\n${formatContactBullets(ctx.org.contact_name, ctx.org.contact_email)}\n\n*Details*\nBank onboarding step marked complete.`,
        footerNote: 'Triggered when Connect Your Bank Account is checked complete.',
        fallbackSuffix: 'Bank account connected',
      });
    }
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Slack failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const dividerAfter = getKickoffDividerAfterIndex(meta);
  if (dividerAfter != null && steps.length > 0) {
    const { data: progressRows } = await admin
      .from('step_progress')
      .select('step_index, completed')
      .eq('org_id', record.org_id);

    const byIndex = new Map((progressRows ?? []).map((p) => [p.step_index, p.completed]));
    const preDone = isPreKickoffComplete({
      steps,
      dividerAfterIndex: dividerAfter,
      completedByStepIndex: byIndex,
    });

    const notifyState = parseOnboardingNotifyState(orgRow?.onboarding_notify_state);
    if (
      preDone &&
      !notifyState.preKickoffCompleteSentAt
    ) {
      try {
        await postOnboardingSlackNotification({
          headline: 'Finished all pre-kickoff tasks',
          ctx,
          bodyMarkdown:
            '*Org contact*\n' +
            formatContactBullets(ctx.org.contact_name, ctx.org.contact_email) +
            '\n\n*Details*\n• All checklist items required before the kickoff call are complete.',
          footerNote: 'Pre-kickoff scope is configured on the onboarding template.',
          fallbackSuffix: 'Pre-kickoff complete',
        });
        await mergeOnboardingNotifyState(record.org_id, {
          preKickoffCompleteSentAt: new Date().toISOString(),
        });
      } catch (e) {
        console.error('step-completed: pre-kickoff Slack failed', e);
      }
    }
  }

  return NextResponse.json({ sent: true });
}

function formatContactBullets(name: string | null, email: string | null): string {
  const n = name?.trim() ? slackEscape(name.trim()) : '';
  const e = email?.trim() ? slackEscape(email.trim()) : '';
  const parts = [];
  if (n) parts.push(`• ${n}`);
  if (e) parts.push(`• ${e}`);
  return parts.length ? parts.join('\n') : '• —';
}
