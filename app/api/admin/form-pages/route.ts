import { NextRequest, NextResponse } from 'next/server';
import { createFormPageConfig, getAllFormPageConfigs } from '@/lib/form-pages-config';
import { parseStaffLockBoolean } from '@/lib/parse-staff-lock';

export const dynamic = 'force-dynamic';

function parseAllowedIds(raw: unknown): number[] | null {
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

export async function GET() {
  try {
    const configs = await getAllFormPageConfigs();
    return NextResponse.json({ configs });
  } catch (error) {
    console.error('[Admin/FormPages] GET:', error);
    return NextResponse.json({ error: 'Failed to fetch configs' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const staff_password = typeof body.staff_password === 'string' ? body.staff_password : '';
    if (!staff_password) {
      return NextResponse.json({ error: 'staff_password is required' }, { status: 400 });
    }
    const organization_id = Number(body.organization_id);
    const default_questionnaire_id = Number(body.default_questionnaire_id);
    if (!Number.isFinite(organization_id) || !Number.isFinite(default_questionnaire_id)) {
      return NextResponse.json(
        { error: 'organization_id and default_questionnaire_id are required' },
        { status: 400 }
      );
    }

    const config = await createFormPageConfig({
      name: String(body.name || ''),
      slug: String(body.slug || ''),
      organization_id,
      default_questionnaire_id,
      allowed_questionnaire_ids: parseAllowedIds(body.allowed_questionnaire_ids),
      staff_lock_to_default_questionnaire:
        body.staff_lock_to_default_questionnaire !== undefined
          ? parseStaffLockBoolean(body.staff_lock_to_default_questionnaire)
          : undefined,
      branding: body.branding,
      staff_password,
      default_range_days: body.default_range_days != null ? Number(body.default_range_days) : undefined,
      max_range_days_cap: body.max_range_days_cap != null ? Number(body.max_range_days_cap) : undefined,
      titles_per_page: body.titles_per_page != null ? Number(body.titles_per_page) : undefined,
      is_active: body.is_active,
    });
    return NextResponse.json({ config }, { status: 201 });
  } catch (error) {
    console.error('[Admin/FormPages] POST:', error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Failed to create' },
      { status: 500 }
    );
  }
}
