import { NextRequest, NextResponse } from 'next/server';
import { getFormPageConfigBySlug, isQuestionnaireAllowed } from '@/lib/form-pages-config';
import { staffSessionOk } from '@/lib/form-staff-cookie';
import { shouldExposeFormsPgErrors } from '@/lib/forms-pg-dialect';
import { formatFormsPgError, isFormsPgConfigured, listQuestionnaires } from '@/lib/forms-pg';

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

  if (!isFormsPgConfigured()) {
    return NextResponse.json(
      { error: 'Form database is not configured (BOND_FORMS_DATABASE_URL).' },
      { status: 503 }
    );
  }

  try {
    let list = await listQuestionnaires(config.organization_id);
    const allowed = config.allowed_questionnaire_ids;
    if (allowed && allowed.length > 0) {
      const set = new Set(allowed);
      list = list.filter((q) => set.has(q.id));
    }
    list = list.filter((q) => isQuestionnaireAllowed(config, q.id));
    return NextResponse.json({ questionnaires: list });
  } catch (e) {
    console.error('[form-responses/questionnaires]', e);
    const pgError = shouldExposeFormsPgErrors() ? formatFormsPgError(e) : undefined;
    return NextResponse.json(
      {
        error: 'Failed to load questionnaires',
        hint: 'Postgres: identifiers in lib/forms-pg.ts; BOND_FORMS_PG_SCHEMA if not public. TLS errors (e.g. UNABLE_TO_GET_ISSUER_CERT_LOCALLY): BOND_FORMS_PG_SSL_CA or BOND_FORMS_PG_SSL_NO_VERIFY=1 on Vercel. FORMS_PG_EXPOSE_ERRORS=1 for pgError.',
        ...(pgError ? { pgError } : {}),
      },
      { status: 500 }
    );
  }
}
