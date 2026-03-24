import { NextRequest, NextResponse } from 'next/server';
import { getFormPageConfigBySlug } from '@/lib/form-pages-config';
import { verifyStaffPassword } from '@/lib/forms-password';
import {
  COOKIE_NAME,
  createStaffSessionToken,
  staffSessionCookieOptions,
} from '@/lib/form-staff-session';

export const dynamic = 'force-dynamic';

interface Ctx {
  params: Promise<{ slug: string }>;
}

export async function POST(request: NextRequest, context: Ctx) {
  const { slug } = await context.params;
  const config = await getFormPageConfigBySlug(slug);
  if (!config?.is_active) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }
  if (!config.staff_password_hash) {
    return NextResponse.json(
      { error: 'Staff access is not configured for this page yet.' },
      { status: 403 }
    );
  }

  const body = await request.json().catch(() => ({}));
  const password = typeof body.password === 'string' ? body.password : '';
  const ok = await verifyStaffPassword(password, config.staff_password_hash);
  if (!ok) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 401 });
  }

  let token: string;
  try {
    token = createStaffSessionToken(slug);
  } catch {
    return NextResponse.json(
      { error: 'Server misconfigured (session secret missing)' },
      { status: 500 }
    );
  }

  const res = NextResponse.json({ ok: true });
  res.cookies.set(COOKIE_NAME, token, staffSessionCookieOptions());
  return res;
}
