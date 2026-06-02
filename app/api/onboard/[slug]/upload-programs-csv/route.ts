import { cookies } from 'next/headers';
import { NextRequest, NextResponse } from 'next/server';
import type { Org } from '@/lib/onboarding/types';
import { pushKeyDatesSnapshotSafe } from '@/lib/onboarding/key-dates-webhook';
import { markOnboardingStartedIfNeeded } from '@/lib/onboarding/onboarding-started';
import {
  getOrgNotifyContext,
  postOnboardingSlackNotification,
  slackEscape,
} from '@/lib/onboarding/slack-onboarding';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const BUCKET_ONBOARDING_UPLOADS = 'onboarding-uploads';

const ALLOWED_EXTENSIONS = /\.csv$/i;

const MIME_ALLOWLIST = new Set([
  'text/csv',
  'application/csv',
  'text/plain',
  'application/vnd.ms-excel',
]);

const MAX_PROGRAMS_UPLOAD_BYTES = 5 * 1024 * 1024;

const SLACK_FILENAME_DISPLAY_MAX = 200;

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

  let formData: FormData;
  try {
    formData = await req.formData();
  } catch {
    return NextResponse.json({ error: 'Expected multipart form data' }, { status: 400 });
  }

  const raw = formData.get('file');
  if (!(raw instanceof Blob)) {
    return NextResponse.json({ error: 'Missing file field' }, { status: 400 });
  }

  if (raw.size > MAX_PROGRAMS_UPLOAD_BYTES) {
    return NextResponse.json({ error: 'File too large (max 5 MB)' }, { status: 400 });
  }

  const fileRecord = raw as File;
  const fileNameRaw = typeof fileRecord.name === 'string' ? fileRecord.name : 'upcoming-programs.csv';
  if (!ALLOWED_EXTENSIONS.test(fileNameRaw)) {
    return NextResponse.json({ error: 'CSV files only (.csv)' }, { status: 400 });
  }

  const mimeRaw = typeof fileRecord.type === 'string' ? fileRecord.type.toLowerCase() : '';
  if (mimeRaw && !MIME_ALLOWLIST.has(mimeRaw)) {
    return NextResponse.json({ error: 'Use a CSV file' }, { status: 400 });
  }

  const admin = getSupabaseAdmin();

  const arrayBuffer = await raw.arrayBuffer();
  const buf = Buffer.from(arrayBuffer);

  const storageRelPath = `${org.id}/upcoming-programs-${Date.now()}.csv`;

  const { error: uploadError } = await admin.storage
    .from(BUCKET_ONBOARDING_UPLOADS)
    .upload(storageRelPath, buf, {
      contentType: 'text/csv',
      upsert: true,
      cacheControl: '3600',
    });

  if (uploadError) {
    console.error('upload-programs-csv: storage error', uploadError);
    return NextResponse.json({ error: 'Could not store file — try again later' }, { status: 502 });
  }

  const uploadedAtIso = new Date().toISOString();

  await admin
    .from('orgs')
    .update({
      programs_upload_storage_path: storageRelPath,
      programs_upload_original_filename: fileNameRaw.slice(0, 500),
      programs_uploaded_at: uploadedAtIso,
    })
    .eq('id', org.id);

  await admin.from('activity_log').insert({
    org_id: org.id,
    action: 'programs_csv_uploaded',
    actor: 'org',
    metadata: { filename: fileNameRaw, storage_path: storageRelPath },
  });

  await markOnboardingStartedIfNeeded(org.id, uploadedAtIso);
  await pushKeyDatesSnapshotSafe(org.id);

  try {
    if (process.env.SLACK_ONBOARDING_WEBHOOK_URL) {
      const notifyCtx = await getOrgNotifyContext(org.id);
      if (notifyCtx) {
        await postOnboardingSlackNotification({
          headline: 'Upcoming programs uploaded',
          ctx: notifyCtx,
          bodyMarkdown:
            `*Org contact*\n${formatBullets(notifyCtx.org.contact_name, notifyCtx.org.contact_email)}\n\n*Details*\n• File name: ${slackEscape(fileNameRaw.slice(0, SLACK_FILENAME_DISPLAY_MAX))}`,
          footerNote: 'Triggered when upcoming-programs CSV is uploaded from the onboarding checklist.',
          fallbackSuffix: 'Programs CSV uploaded',
        });
      }
    }
  } catch (e) {
    console.error('upload-programs-csv: Slack failed', e);
  }

  return NextResponse.json({ ok: true, uploadedAt: uploadedAtIso });
}

function formatBullets(name: string | null, email: string | null): string {
  const n = name?.trim() ? `• ${slackEscape(name.trim())}` : '';
  const e = email?.trim() ? `• ${slackEscape(email.trim())}` : '';
  if (!n && !e) return '• —';
  return [n, e].filter(Boolean).join('\n');
}
