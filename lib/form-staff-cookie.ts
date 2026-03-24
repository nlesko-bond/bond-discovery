import type { NextRequest } from 'next/server';
import { COOKIE_NAME, verifyStaffSessionToken } from '@/lib/form-staff-session';

export function staffSessionOk(request: NextRequest, slug: string): boolean {
  const token = request.cookies.get(COOKIE_NAME)?.value;
  return verifyStaffSessionToken(token, slug);
}
