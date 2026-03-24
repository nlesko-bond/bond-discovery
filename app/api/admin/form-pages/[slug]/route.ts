import { NextRequest, NextResponse } from 'next/server';
import {
  deleteFormPageConfig,
  getFormPageConfigBySlugAdmin,
  updateFormPageConfig,
} from '@/lib/form-pages-config';
import type { FormPageBranding } from '@/types/form-pages';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

function parseAllowedIds(raw: unknown): number[] | null | undefined {
  if (raw === undefined) return undefined;
  if (raw == null || raw === '') return null;
  if (Array.isArray(raw)) {
    const nums = raw.map((x) => Number(x)).filter((n) => Number.isFinite(n));
    return nums.length ? nums : null;
  }
  if (typeof raw === 'string') {
    const nums = raw
      .split(/[\s,]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => !Number.isNaN(n));
    return nums.length ? nums : null;
  }
  return null;
}

export async function GET(_request: NextRequest, context: Ctx) {
  const { slug } = await context.params;
  try {
    const config = await getFormPageConfigBySlugAdmin(slug);
    if (!config) return NextResponse.json({ error: 'Not found' }, { status: 404 });
    return NextResponse.json({ config });
  } catch {
    return NextResponse.json({ error: 'Failed to fetch' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;
  try {
    const body = await request.json();

    const updates: Parameters<typeof updateFormPageConfig>[1] = {};

    if (body.name !== undefined) updates.name = String(body.name);
    if (body.slug !== undefined) updates.slug = String(body.slug);
    if (body.is_active !== undefined) updates.is_active = Boolean(body.is_active);
    if (body.organization_id !== undefined) updates.organization_id = Number(body.organization_id);
    if (body.default_questionnaire_id !== undefined) {
      updates.default_questionnaire_id = Number(body.default_questionnaire_id);
    }
    if (body.allowed_questionnaire_ids !== undefined) {
      updates.allowed_questionnaire_ids = parseAllowedIds(body.allowed_questionnaire_ids) ?? null;
    }
    if (body.branding !== undefined) updates.branding = body.branding as FormPageBranding;
    if (body.default_range_days !== undefined) {
      updates.default_range_days = Number(body.default_range_days);
    }
    if (body.max_range_days_cap !== undefined) {
      updates.max_range_days_cap = Number(body.max_range_days_cap);
    }
    if (body.titles_per_page !== undefined) {
      updates.titles_per_page = Number(body.titles_per_page);
    }
    if (typeof body.staff_password === 'string' && body.staff_password.length > 0) {
      updates.staff_password = body.staff_password;
    }

    const config = await updateFormPageConfig(slug, updates);
    return NextResponse.json({ config });
  } catch (error) {
    console.error('[Admin/FormPages] PATCH:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to update' },
      { status: 500 }
    );
  }
}

export async function DELETE(_request: NextRequest, context: Ctx) {
  const { slug } = await context.params;
  try {
    const ok = await deleteFormPageConfig(slug);
    if (!ok) return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
    return NextResponse.json({ success: true });
  } catch {
    return NextResponse.json({ error: 'Failed to delete' }, { status: 500 });
  }
}
