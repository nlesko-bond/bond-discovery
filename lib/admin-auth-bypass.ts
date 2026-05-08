/**
 * When true, `/admin` skips Google sign-in in local development only.
 * Requires `NEXT_PUBLIC_ADMIN_AUTH_BYPASS=true` in `.env.local` while running `next dev`.
 * Production builds set `NODE_ENV` to `production`, so this never enables there.
 */
export function isAdminAuthBypassEnabled(): boolean {
  if (process.env.NODE_ENV !== 'development') {
    return false;
  }
  const flag = process.env.NEXT_PUBLIC_ADMIN_AUTH_BYPASS;
  return flag === 'true' || flag === '1';
}
