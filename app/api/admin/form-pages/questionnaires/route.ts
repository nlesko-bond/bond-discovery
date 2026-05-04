import { NextRequest, NextResponse } from 'next/server';
import { formatFormsPgError, isFormsPgConfigured, listQuestionnaires } from '@/lib/forms-pg';
import { shouldExposeFormsPgErrors } from '@/lib/forms-pg-dialect';

export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  const organizationId = Number(request.nextUrl.searchParams.get('organizationId'));
  if (!Number.isFinite(organizationId)) {
    return NextResponse.json({ error: 'organizationId required' }, { status: 400 });
  }

  if (!isFormsPgConfigured()) {
    return NextResponse.json(
      { error: 'Form database is not configured (BOND_FORMS_DATABASE_URL).' },
      { status: 503 }
    );
  }

  try {
    const questionnaires = await listQuestionnaires(organizationId);
    return NextResponse.json({ questionnaires });
  } catch (e) {
    console.error('[admin/form-pages/questionnaires]', e);
    const pgError = shouldExposeFormsPgErrors() ? formatFormsPgError(e) : undefined;
    return NextResponse.json(
      {
        error: 'Failed to load questionnaires',
        ...(pgError ? { pgError } : {}),
      },
      { status: 500 }
    );
  }
}
