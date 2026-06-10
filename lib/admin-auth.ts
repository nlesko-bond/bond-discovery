import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminAuthBypassEnabled } from '@/lib/admin-auth-bypass';

/**
 * Guard for admin-only API mutations.
 *
 * Returns `null` when the request is authorized; a 401/403 `Response`
 * otherwise. Fails closed: if auth config is missing in production,
 * mutations return 401 — never silently allow.
 */
export async function requireAdmin(): Promise<Response | null> {
  // Local development bypass — never active in production builds.
  if (isAdminAuthBypassEnabled()) {
    return null;
  }
  if (process.env.ADMIN_AUTH_BYPASS === 'true' && process.env.NODE_ENV !== 'production') {
    return null;
  }

  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const allowed = (process.env.ADMIN_ALLOWED_EMAILS || '')
    .split(',')
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);
  if (allowed.length > 0 && !allowed.includes(session.user.email.toLowerCase())) {
    return Response.json({ error: 'Forbidden' }, { status: 403 });
  }

  return null;
}
