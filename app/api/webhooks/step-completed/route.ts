import { NextRequest, NextResponse } from 'next/server';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

type WebhookPayload = {
  type?: string;
  table?: string;
  record?: Record<string, unknown>;
  old_record?: Record<string, unknown>;
};

/** Slack header `plain_text` max length */
const SLACK_HEADER_MAX = 150;

function slackEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

function slackHeaderPlain(text: string): string {
  const t = text.trim();
  if (t.length <= SLACK_HEADER_MAX) return t;
  return `${t.slice(0, SLACK_HEADER_MAX - 1)}…`;
}

/** Slack user IDs start with U or W (e.g. U01ABC…). Returns normalized id or null. */
function normalizeSlackMemberId(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const t = raw.trim();
  const m = t.match(/\b([UW][A-Z0-9]{8,})\b/i);
  return m ? m[1].toUpperCase() : null;
}

function repLine(name: string, slackMemberId: string | null): string {
  const id = normalizeSlackMemberId(slackMemberId);
  if (id) return `<@${id}> (${slackEscape(name)})`;
  return slackEscape(name);
}

function orgContactLine(contactName: string | null, contactEmail: string | null): string {
  const parts: string[] = [];
  if (contactName?.trim()) parts.push(slackEscape(contactName.trim()));
  if (contactEmail?.trim()) parts.push(slackEscape(contactEmail.trim()));
  return parts.length ? parts.join(' · ') : '—';
}

async function postSlack(webhookUrl: string, text: string, blocks: unknown[]) {
  const res = await fetch(webhookUrl, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text, blocks }),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Slack webhook failed: ${res.status} ${errBody}`);
  }
}

function buildStepCompletedBlocks(params: {
  repName: string;
  slackMemberId: string | null;
  orgName: string;
  contactName: string | null;
  contactEmail: string | null;
  stepTitle: string;
  completedBy: string | null;
  adminLink: string;
}): unknown[] {
  const {
    repName,
    slackMemberId,
    orgName,
    contactName,
    contactEmail,
    stepTitle,
    completedBy,
    adminLink,
  } = params;

  const headerLine = slackHeaderPlain(`✅ ${orgName} · ${stepTitle}`);

  const blocks: unknown[] = [
    {
      type: 'header',
      text: { type: 'plain_text', text: headerLine, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Rep*\n${repLine(repName, slackMemberId)}` },
        { type: 'mrkdwn', text: `*Organization*\n${slackEscape(orgName)}` },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Org contact*\n${orgContactLine(contactName, contactEmail)}` },
        { type: 'mrkdwn', text: `*Step completed*\n${slackEscape(stepTitle)}` },
      ],
    },
  ];

  if (completedBy) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Completed by:* ${slackEscape(completedBy)}`,
      },
    });
  }

  blocks.push(
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_If the org has questions, reply in thread or use the contact above._',
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${adminLink}|Open in admin →>`,
      },
    },
  );

  return blocks;
}

function buildAllRequiredDoneBlocks(params: {
  repName: string;
  slackMemberId: string | null;
  orgName: string;
  contactName: string | null;
  contactEmail: string | null;
  adminLink: string;
}): unknown[] {
  const { repName, slackMemberId, orgName, contactName, contactEmail, adminLink } = params;

  const headerLine = slackHeaderPlain(`🎉 ${orgName} · all required steps complete`);

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: headerLine, emoji: true },
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Rep*\n${repLine(repName, slackMemberId)}` },
        { type: 'mrkdwn', text: `*Organization*\n${slackEscape(orgName)}` },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Org contact*\n${orgContactLine(contactName, contactEmail)}` },
        { type: 'mrkdwn', text: `*Status*\nAll required steps done` },
      ],
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: '_If the org has follow-up questions, reply in thread or use the contact above._',
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${adminLink}|Open in admin →>`,
      },
    },
  ];
}

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
        completed_by?: string | null;
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

  const slackUrl = process.env.SLACK_ONBOARDING_WEBHOOK_URL;
  if (!slackUrl) {
    return NextResponse.json({
      skipped: true,
      reason: 'SLACK_ONBOARDING_WEBHOOK_URL not configured',
    });
  }

  const admin = getSupabaseAdmin();

  const { data: org } = await admin
    .from('orgs')
    .select('id, name, slug, contact_name, contact_email, assigned_rep, template_id')
    .eq('id', record.org_id)
    .maybeSingle();

  if (!org?.assigned_rep) {
    return NextResponse.json({ skipped: true, reason: 'no rep' });
  }

  const { data: rep } = await admin
    .from('staff')
    .select('name, notify_email, slack_member_id')
    .eq('id', org.assigned_rep)
    .maybeSingle();

  if (!rep?.notify_email) {
    return NextResponse.json({ skipped: true, reason: 'notifications off' });
  }

  let stepTitle = `Step ${record.step_index + 1}`;
  if (org.template_id) {
    const { data: tpl } = await admin
      .from('templates')
      .select('steps')
      .eq('id', org.template_id)
      .maybeSingle();
    const steps = (tpl?.steps as TemplateStep[] | undefined) ?? [];
    stepTitle = steps[record.step_index]?.title ?? stepTitle;
  }

  const base = process.env.NEXT_PUBLIC_APP_URL ?? 'http://localhost:3000';
  const link = `${base.replace(/\/$/, '')}${ONBOARDING_BASE}/orgs/${org.id}`;
  const safeName = org.name;

  const completedBy =
    typeof record.completed_by === 'string' && record.completed_by.trim()
      ? record.completed_by.trim()
      : null;

  const slackMemberId =
    rep.slack_member_id && typeof rep.slack_member_id === 'string'
      ? rep.slack_member_id
      : null;

  const stepBlocks = buildStepCompletedBlocks({
    repName: rep.name,
    slackMemberId,
    orgName: org.name,
    contactName: org.contact_name,
    contactEmail: org.contact_email,
    stepTitle,
    completedBy,
    adminLink: link,
  });

  const fallbackText = `${safeName} — ${stepTitle}`;

  try {
    await postSlack(slackUrl, fallbackText, stepBlocks);
  } catch (e) {
    const message = e instanceof Error ? e.message : 'Slack request failed';
    return NextResponse.json({ error: message }, { status: 502 });
  }

  const { data: progress } = await admin
    .from('step_progress')
    .select('step_index, completed')
    .eq('org_id', org.id);

  const { data: tpl2 } = org.template_id
    ? await admin.from('templates').select('steps').eq('id', org.template_id).maybeSingle()
    : { data: null };

  const steps = (tpl2?.steps as TemplateStep[] | undefined) ?? [];
  const byIndex = new Map((progress ?? []).map((p) => [p.step_index, p.completed]));
  const allRequiredDone =
    steps.length > 0 &&
    steps.every((step, idx) => {
      if (step.optional) return true;
      return Boolean(byIndex.get(idx));
    });

  if (allRequiredDone) {
    const doneBlocks = buildAllRequiredDoneBlocks({
      repName: rep.name,
      slackMemberId,
      orgName: org.name,
      contactName: org.contact_name,
      contactEmail: org.contact_email,
      adminLink: link,
    });
    try {
      await postSlack(slackUrl, `${safeName} — all required steps complete`, doneBlocks);
    } catch (e) {
      console.error('step-completed: Slack completion message failed', e);
    }
  }

  return NextResponse.json({ sent: true });
}
