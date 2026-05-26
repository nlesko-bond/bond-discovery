import { NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { isAdminAuthBypassEnabled } from '@/lib/admin-auth-bypass';
import { getSupabaseAdmin } from '@/lib/supabase';

const HTTP_UNAUTHORIZED_STATUS = 401;
const HTTP_FORBIDDEN_STATUS = 403;

type AdminApiAccessResult =
  | {
      ok: true;
      email: string;
    }
  | {
      ok: false;
      response: NextResponse;
    };

export async function requireAdminApiAccess(): Promise<AdminApiAccessResult> {
  if (isAdminAuthBypassEnabled()) {
    return {
      ok: true,
      email: 'local-dev@bondsports.co',
    };
  }

  const session = await getServerSession(authOptions);
  const email = session?.user?.email?.trim();

  if (!email) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Unauthorized' }, { status: HTTP_UNAUTHORIZED_STATUS }),
    };
  }

  const admin = getSupabaseAdmin();
  const { data: staff } = await admin.from('staff').select('id').eq('email', email).maybeSingle();

  if (!staff) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'Forbidden' }, { status: HTTP_FORBIDDEN_STATUS }),
    };
  }

  return {
    ok: true,
    email,
  };
}
