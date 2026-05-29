import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

const SLACK_HEADER_MAX = 150;

/** Slack Incoming Webhooks max practical text block — keep messages short */
const SLACK_PLAIN_TRUNCATE = 2500;

export function slackEscape(text: string): string {
  return text.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
}

export function slackHeaderPlain(text: string): string {
  const t = text.trim();
  if (t.length <= SLACK_HEADER_MAX) return t;
  return `${t.slice(0, SLACK_HEADER_MAX - 1)}…`;
}

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

async function postSlack(webhookUrl: string, text: string, blocks: unknown[]): Promise<void> {
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

export interface IOrgSlackContext {
  org: {
    id: string;
    name: string;
    slug: string;
    bond_organization_id?: number | null;
    contact_name: string | null;
    contact_email: string | null;
    assigned_rep: string | null;
    template_id: string | null;
  };
  rep: {
    name: string;
    notify_email: boolean;
    slack_member_id?: string | null;
  };
  adminLink: string;
}

/** Loads org + rep for Slack; returns null when notifications should not fire (no rep or notify off). */
export async function getOrgNotifyContext(orgId: string): Promise<IOrgSlackContext | null> {
  const admin = getSupabaseAdmin();
  const base = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const { data: org } = await admin
    .from('orgs')
    .select('id, name, slug, bond_organization_id, contact_name, contact_email, assigned_rep, template_id')
    .eq('id', orgId)
    .maybeSingle();

  if (!org?.assigned_rep) return null;

  const { data: rep } = await admin
    .from('staff')
    .select('name, notify_email, slack_member_id')
    .eq('id', org.assigned_rep)
    .maybeSingle();

  if (!rep?.notify_email) return null;

  const slackMemberId =
    rep.slack_member_id && typeof rep.slack_member_id === 'string' ? rep.slack_member_id : null;

  const adminLink = `${base.replace(/\/$/, '')}${ONBOARDING_BASE}/orgs/${org.id}`;

  return {
    org: {
      id: org.id,
      name: org.name,
      slug: org.slug,
      bond_organization_id:
        typeof org.bond_organization_id === 'number' ? org.bond_organization_id : null,
      contact_name: org.contact_name,
      contact_email: org.contact_email,
      assigned_rep: org.assigned_rep,
      template_id: org.template_id,
    },
    rep: {
      name: rep.name,
      notify_email: rep.notify_email,
      slack_member_id: slackMemberId,
    },
    adminLink,
  };
}

export function buildOnboardingSlackBlocks(params: {
  ctx: IOrgSlackContext;
  headerLine: string;
  bodyMarkdown: string;
  footerNote?: string;
}): unknown[] {
  const { ctx, headerLine, bodyMarkdown, footerNote } = params;
  const slackMemberId =
    ctx.rep.slack_member_id && typeof ctx.rep.slack_member_id === 'string'
      ? ctx.rep.slack_member_id
      : null;

  const body = bodyMarkdown.trim().slice(0, SLACK_PLAIN_TRUNCATE);

  const bondOrgId =
    ctx.org.bond_organization_id != null ? String(ctx.org.bond_organization_id) : null;
  const orgCorrelationParts = [
    `Discovery org:\`${slackEscape(ctx.org.id)}\``,
    bondOrgId ? `Bond org:\`${slackEscape(bondOrgId)}\`` : null,
    `slug:\`${slackEscape(ctx.org.slug)}\``,
  ].filter(Boolean);
  const orgCorrelation = orgCorrelationParts.join(' · ');

  return [
    {
      type: 'header',
      text: { type: 'plain_text', text: slackHeaderPlain(headerLine), emoji: false },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Discovery org ID*\n\`${slackEscape(ctx.org.id)}\``,
        },
        {
          type: 'mrkdwn',
          text: bondOrgId
            ? `*Bond org ID*\n\`${slackEscape(bondOrgId)}\``
            : `*Onboarding slug*\n\`${slackEscape(ctx.org.slug)}\``,
        },
      ],
    },
    {
      type: 'section',
      fields: [
        { type: 'mrkdwn', text: `*Rep*\n${repLine(ctx.rep.name, slackMemberId)}` },
        { type: 'mrkdwn', text: `*Organization*\n${slackEscape(ctx.org.name)}` },
      ],
    },
    {
      type: 'section',
      text: { type: 'mrkdwn', text: body },
    },
    { type: 'divider' },
    {
      type: 'context',
      elements: [
        {
          type: 'mrkdwn',
          text: slackEscape(orgCorrelation),
        },
        {
          type: 'mrkdwn',
          text: slackEscape(
            footerNote ?? 'If the org has questions, reply in thread or use the contact above.',
          ),
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `<${ctx.adminLink}|Open in admin →>`,
      },
    },
  ];
}

export async function postOnboardingSlackNotification(params: {
  headline: string;
  ctx: IOrgSlackContext;
  bodyMarkdown: string;
  footerNote?: string;
  fallbackSuffix?: string;
}): Promise<void> {
  const webhookUrl = process.env.SLACK_ONBOARDING_WEBHOOK_URL;
  if (!webhookUrl) {
    throw new Error('SLACK_ONBOARDING_WEBHOOK_URL not configured');
  }
  const suffix = params.fallbackSuffix?.trim() ? ` — ${params.fallbackSuffix.trim()}` : '';
  const bondOrgId =
    params.ctx.org.bond_organization_id != null ? String(params.ctx.org.bond_organization_id) : null;
  const fallbackCore = [
    params.ctx.org.name + suffix,
    bondOrgId ? `bond_org_id:${bondOrgId}` : null,
    `org_id:${params.ctx.org.id}`,
    `slug:${params.ctx.org.slug}`,
  ]
    .filter(Boolean)
    .join(' · ');
  const fallbackText = fallbackCore.slice(0, SLACK_PLAIN_TRUNCATE);
  const blocks = buildOnboardingSlackBlocks({
    ctx: params.ctx,
    headerLine: params.headline,
    bodyMarkdown: params.bodyMarkdown,
    footerNote: params.footerNote,
  });
  await postSlack(webhookUrl, fallbackText, blocks);
}

export function isBankAccountSetupStep(step: TemplateStep): boolean {
  return step.title.toLowerCase().includes('bank account');
}

export function getKickoffDividerAfterIndex(meta: Record<string, unknown> | null | undefined): number | null {
  if (!meta || typeof meta !== 'object') return null;
  const raw = (meta as { kickoffDividerAfterStepIndex?: unknown }).kickoffDividerAfterStepIndex;
  if (typeof raw !== 'number' || raw < 0 || !Number.isInteger(raw)) return null;
  return raw;
}

export function isPreKickoffComplete(params: {
  steps: TemplateStep[];
  dividerAfterIndex: number;
  completedByStepIndex: Map<number, boolean>;
}): boolean {
  const { steps, dividerAfterIndex, completedByStepIndex } = params;
  for (let i = 0; i <= dividerAfterIndex && i < steps.length; i++) {
    if (steps[i]?.optional) continue;
    if (!completedByStepIndex.get(i)) return false;
  }
  return true;
}
