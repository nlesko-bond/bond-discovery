import { NextResponse } from 'next/server';
import { getFormPageConfigBySlug } from '@/lib/form-pages-config';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function GET(_request: Request, context: Ctx) {
  const { slug } = await context.params;
  const config = await getFormPageConfigBySlug(slug);
  if (!config || !config.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  return NextResponse.json({
    slug: config.slug,
    name: config.name,
    branding: config.branding,
    default_questionnaire_id: config.default_questionnaire_id,
    default_range_days: config.default_range_days,
    max_range_days_cap: config.max_range_days_cap,
    requires_password: !!config.staff_password_hash,
  });
}
