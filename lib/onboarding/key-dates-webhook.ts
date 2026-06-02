import { createHmac } from 'node:crypto';

import type { Org } from '@/lib/onboarding/types';
import { toIsoDateOnly } from '@/lib/onboarding/parse-iso-date';
import { getSupabaseAdmin } from '@/lib/supabase';

const DEFAULT_KEY_DATES_WEBHOOK_URL = 'https://cs.bondsports.co/api/webhooks/key-dates';

const HTTP_RETRY_DELAY_MS = 1000;

export type KeyDatePayloadRow = {
  source_key: string;
  label: string;
  date: string;
  type: 'planned_launch' | 'go_live' | 'milestone';
  notes?: string;
};

export type KeyDatesPushResult =
  | { status: 'skipped'; reason: string }
  | { status: 'sent'; httpStatus: number; body: unknown }
  | { status: 'error'; message: string };

type OrgKeyDateRow = Pick<
  Org,
  | 'id'
  | 'bond_organization_id'
  | 'expected_launch_date'
  | 'actual_launch_date'
  | 'onboarding_started_at'
  | 'completed_at'
  | 'spaces_uploaded_at'
  | 'gl_codes_uploaded_at'
>;

/**
 * Builds the full key-dates snapshot pushed to Customer Health (four milestones max).
 */
export async function buildKeyDatesSnapshot(orgId: string): Promise<{
  bond_org_id: string;
  dates: KeyDatePayloadRow[];
} | null> {
  const admin = getSupabaseAdmin();
  const { data: orgRow } = await admin
    .from('orgs')
    .select(
      'id, bond_organization_id, expected_launch_date, actual_launch_date, onboarding_started_at, completed_at, spaces_uploaded_at, gl_codes_uploaded_at',
    )
    .eq('id', orgId)
    .maybeSingle();

  if (!orgRow) {
    return null;
  }

  const org = orgRow as OrgKeyDateRow;
  if (org.bond_organization_id == null) {
    return null;
  }

  const startedAt = await resolveOnboardingStartedAt(org);
  const dates: KeyDatePayloadRow[] = [];

  const plannedLaunch = toIsoDateOnly(org.expected_launch_date ?? null);
  if (plannedLaunch) {
    dates.push({
      source_key: 'planned_launch',
      label: 'Current planned launch',
      date: plannedLaunch,
      type: 'planned_launch',
    });
  }

  const actualLaunch = toIsoDateOnly(org.actual_launch_date ?? null);
  if (actualLaunch) {
    dates.push({
      source_key: 'actual_launch',
      label: 'Actual launch',
      date: actualLaunch,
      type: 'go_live',
    });
  }

  const startedDate = toIsoDateOnly(startedAt);
  if (startedDate) {
    dates.push({
      source_key: 'onboarding_started',
      label: 'Onboarding started',
      date: startedDate,
      type: 'milestone',
    });
  }

  const completedDate = toIsoDateOnly(org.completed_at ?? null);
  if (completedDate) {
    dates.push({
      source_key: 'onboarding_completed',
      label: 'Onboarding completed',
      date: completedDate,
      type: 'milestone',
    });
  }

  return {
    bond_org_id: String(org.bond_organization_id),
    dates,
  };
}

async function resolveOnboardingStartedAt(org: OrgKeyDateRow): Promise<string | null> {
  if (org.onboarding_started_at) {
    return org.onboarding_started_at;
  }

  const admin = getSupabaseAdmin();
  const candidates: string[] = [];

  const { data: firstStep } = await admin
    .from('step_progress')
    .select('completed_at')
    .eq('org_id', org.id)
    .eq('completed', true)
    .not('completed_at', 'is', null)
    .order('completed_at', { ascending: true })
    .limit(1)
    .maybeSingle();

  if (firstStep?.completed_at && typeof firstStep.completed_at === 'string') {
    candidates.push(firstStep.completed_at);
  }

  if (org.spaces_uploaded_at) {
    candidates.push(org.spaces_uploaded_at);
  }
  if (org.gl_codes_uploaded_at) {
    candidates.push(org.gl_codes_uploaded_at);
  }

  if (candidates.length === 0) {
    return null;
  }

  candidates.sort();
  return candidates[0] ?? null;
}

function getWebhookUrl(): string {
  const configured = process.env.KEY_DATES_WEBHOOK_URL?.trim();
  return configured || DEFAULT_KEY_DATES_WEBHOOK_URL;
}

async function postKeyDatesPayload(body: string): Promise<Response> {
  const secret = process.env.KEY_DATES_WEBHOOK_SECRET?.trim();
  if (!secret) {
    throw new Error('KEY_DATES_WEBHOOK_SECRET not configured');
  }

  const signature = createHmac('sha256', secret).update(body).digest('hex');

  const url = getWebhookUrl();
  const res = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Signature': `sha256=${signature}`,
    },
    body,
  });

  if (res.status >= 500) {
    await sleep(HTTP_RETRY_DELAY_MS);
    return fetch(url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-Signature': `sha256=${signature}`,
      },
      body,
    });
  }

  return res;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => {
    setTimeout(resolve, ms);
  });
}

export async function pushKeyDatesSnapshot(orgId: string): Promise<KeyDatesPushResult> {
  if (!process.env.KEY_DATES_WEBHOOK_SECRET?.trim()) {
    return { status: 'skipped', reason: 'KEY_DATES_WEBHOOK_SECRET not configured' };
  }

  const snapshot = await buildKeyDatesSnapshot(orgId);
  if (!snapshot) {
    return { status: 'skipped', reason: 'missing org or bond_organization_id' };
  }

  const body = JSON.stringify(snapshot);

  try {
    const res = await postKeyDatesPayload(body);
    let parsed: unknown = null;
    try {
      parsed = await res.json();
    } catch {
      parsed = null;
    }

    if (res.status === 401) {
      return { status: 'error', message: 'Customer Health rejected signature (401)' };
    }

    if (res.status >= 400 && res.status !== 202) {
      return {
        status: 'error',
        message: `Customer Health returned ${res.status}`,
      };
    }

    return { status: 'sent', httpStatus: res.status, body: parsed };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'key-dates push failed';
    return { status: 'error', message };
  }
}

/**
 * Pushes key dates without failing the caller (org save, checklist toggle, etc.).
 */
export async function pushKeyDatesSnapshotSafe(orgId: string): Promise<void> {
  const result = await pushKeyDatesSnapshot(orgId);
  if (result.status === 'error') {
    console.error('[key-dates] push failed', { orgId, message: result.message });
  }
  if (result.status === 'sent' && result.httpStatus === 202) {
    console.info('[key-dates] org not found in Customer Health yet', { orgId });
  }
}
