import { NextRequest, NextResponse } from 'next/server';
import {
  isValidStaffInquiryStatus,
  upsertAnswerTitleStatus,
} from '@/lib/form-response-statuses';
import { getFormPageConfigBySlug } from '@/lib/form-pages-config';
import { staffSessionOk } from '@/lib/form-staff-cookie';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function POST(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;
  if (!staffSessionOk(request, slug)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getFormPageConfigBySlug(slug);
  if (!config?.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const answerTitleId = Number((body as { answerTitleId?: unknown }).answerTitleId);
  const status = (body as { status?: unknown }).status;

  if (!Number.isFinite(answerTitleId)) {
    return NextResponse.json({ error: 'answerTitleId required' }, { status: 400 });
  }
  if (!isValidStaffInquiryStatus(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 });
  }

  try {
    await upsertAnswerTitleStatus(config.id, answerTitleId, status);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error('[form-responses/status]', e);
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Failed to save status' },
      { status: 500 }
    );
  }
}
