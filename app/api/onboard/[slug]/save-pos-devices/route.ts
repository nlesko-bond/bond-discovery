import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import { parsePosDeviceCount } from '@/lib/onboarding/parse-pos-device-count';
import type { Org } from '@/lib/onboarding/types';
import {
  getOrgNotifyContext,
  postOnboardingSlackNotification,
  slackEscape,
} from '@/lib/onboarding/slack-onboarding';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

async function loadOrgAuthorizedPin(slug: string): Promise<Org | null> {
  const admin = getSupabaseAdmin();
  const { data: orgRow } = await admin.from('orgs').select('*').eq('slug', slug).maybeSingle();
  if (!orgRow) return null;
  const org = orgRow as Org;

  if (!org.pin) {
    return org;
  }

  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(`bond_pin_${slug}`)?.value;
  if (pinCookie !== org.id) return null;
  return org;
}

export async function POST(
  req: NextRequest,
  routeContext: { params: Promise<{ slug: string }> },
) {
  const { slug } = await routeContext.params;
  const slugTrim = slug.trim();

  const org = await loadOrgAuthorizedPin(slugTrim);
  if (!org) {
    return NextResponse.json({ error: 'Unauthorized or organization not found' }, { status: 403 });
  }

  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Expected JSON body' }, { status: 400 });
  }

  const countRaw =
    typeof body === 'object' && body !== null && 'count' in body
      ? (body as { count?: unknown }).count
      : undefined;

  const parsed = parsePosDeviceCount(countRaw);
  if (parsed.error) {
    return NextResponse.json({ error: parsed.error }, { status: 400 });
  }

  const admin = getSupabaseAdmin();
  const savedAtIso = new Date().toISOString();

  await admin
    .from('orgs')
    .update({
      pos_devices_requested: parsed.value,
      pos_devices_requested_at: savedAtIso,
    })
    .eq('id', org.id);

  await admin.from('activity_log').insert({
    org_id: org.id,
    action: 'pos_devices_requested',
    actor: 'org',
    metadata: { count: parsed.value },
  });

  try {
    if (process.env.SLACK_ONBOARDING_WEBHOOK_URL) {
      const notifyCtx = await getOrgNotifyContext(org.id);
      if (notifyCtx) {
        await postOnboardingSlackNotification({
          headline: 'POS device count saved',
          ctx: notifyCtx,
          bodyMarkdown:
            `*Org contact*\n${formatBullets(notifyCtx.org.contact_name, notifyCtx.org.contact_email)}\n\n*Details*\n• Devices requested: ${slackEscape(String(parsed.value))}`,
          footerNote: 'Triggered when POS device count is saved from the onboarding checklist.',
          fallbackSuffix: 'POS devices requested',
        });
      }
    }
  } catch (e) {
    console.error('save-pos-devices: Slack failed', e);
  }

  return NextResponse.json({ ok: true, count: parsed.value, savedAt: savedAtIso });
}

function formatBullets(name: string | null, email: string | null): string {
  const n = name?.trim() ? `• ${slackEscape(name.trim())}` : '';
  const e = email?.trim() ? `• ${slackEscape(email.trim())}` : '';
  if (!n && !e) return '• —';
  return [n, e].filter(Boolean).join('\n');
}
