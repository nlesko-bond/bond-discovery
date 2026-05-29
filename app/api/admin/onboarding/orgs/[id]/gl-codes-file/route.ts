import { NextRequest, NextResponse } from 'next/server';
import { getServerSession } from 'next-auth';
import { authOptions } from '@/lib/auth';
import { getSupabaseAdmin } from '@/lib/supabase';

export const runtime = 'nodejs';

const BUCKET_ONBOARDING_UPLOADS = 'onboarding-uploads';

const SIGNED_SECONDS = 3600;

export async function GET(
  _request: NextRequest,
  routeContext: { params: Promise<{ id: string }> },
) {
  const session = await getServerSession(authOptions);
  if (!session?.user?.email) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const admin = getSupabaseAdmin();

  const { data: staff } = await admin
    .from('staff')
    .select('id')
    .eq('email', session.user.email.trim())
    .maybeSingle();

  if (!staff) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
  }

  const { id: orgId } = await routeContext.params;

  const { data: org } = await admin
    .from('orgs')
    .select('gl_codes_upload_storage_path,gl_codes_uploaded_at')
    .eq('id', orgId)
    .maybeSingle();

  const pathRaw =
    typeof org?.gl_codes_upload_storage_path === 'string' ? org.gl_codes_upload_storage_path : '';
  const uploadedAt = org?.gl_codes_uploaded_at ?? null;

  if (!uploadedAt || !pathRaw) {
    return new NextResponse(
      'No accounting-codes CSV has been uploaded for this organization yet.',
      { status: 404, headers: { 'Content-Type': 'text/plain; charset=utf-8' } },
    );
  }

  const { data: signed, error } = await admin.storage
    .from(BUCKET_ONBOARDING_UPLOADS)
    .createSignedUrl(pathRaw, SIGNED_SECONDS);

  if (error || !signed?.signedUrl) {
    console.error('gl-codes-file signed url:', error?.message ?? 'unknown');
    return new NextResponse('Unable to generate a download link.', {
      status: 502,
      headers: { 'Content-Type': 'text/plain; charset=utf-8' },
    });
  }

  return NextResponse.redirect(signed.signedUrl, 302);
}
