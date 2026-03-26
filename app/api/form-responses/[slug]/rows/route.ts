import { NextRequest, NextResponse } from 'next/server';
import { loadFormResponsesPage } from '@/lib/form-responses-data';
import { parseFormResponsesDateRange, parseTitleCursor } from '@/lib/form-responses-query';
import { getFormPageConfigBySlug, isQuestionnaireAllowed } from '@/lib/form-pages-config';
import { staffSessionOk } from '@/lib/form-staff-cookie';
import { shouldExposeFormsPgErrors } from '@/lib/forms-pg-dialect';
import { formatFormsPgError, isFormsPgConfigured } from '@/lib/forms-pg';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function GET(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;
  if (!staffSessionOk(request, slug)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const config = await getFormPageConfigBySlug(slug);
  if (!config?.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const questionnaireId = parseInt(request.nextUrl.searchParams.get('questionnaireId') || '', 10);
  if (Number.isNaN(questionnaireId)) {
    return NextResponse.json({ error: 'questionnaireId required' }, { status: 400 });
  }
  if (!isQuestionnaireAllowed(config, questionnaireId)) {
    return NextResponse.json({ error: 'Form not allowed' }, { status: 403 });
  }

  if (!isFormsPgConfigured()) {
    return NextResponse.json({ error: 'Form database not configured' }, { status: 503 });
  }

  let from: Date;
  let to: Date;
  try {
    ({ from, to } = parseFormResponsesDateRange(request.nextUrl.searchParams, config));
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Invalid date range' },
      { status: 400 }
    );
  }

  const cursor = parseTitleCursor(request.nextUrl.searchParams);

  try {
    const data = await loadFormResponsesPage(config, {
      questionnaireId,
      from,
      to,
      cursor,
    });
    return NextResponse.json({ data });
  } catch (e) {
    console.error('[form-responses/rows]', e);
    const pgError = shouldExposeFormsPgErrors() ? formatFormsPgError(e) : undefined;
    return NextResponse.json(
      {
        error: 'Failed to load responses',
        hint: 'Set FORMS_PG_EXPOSE_ERRORS=1 on the deployment to include pgError with the Postgres message.',
        ...(pgError ? { pgError } : {}),
      },
      { status: 500 }
    );
  }
}
