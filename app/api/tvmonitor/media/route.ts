import { NextRequest, NextResponse } from 'next/server';
import { cookies } from 'next/headers';
import { requireAdmin } from '@/lib/admin-auth';
import { requireStudioSession, TV_STUDIO_COOKIE_NAME } from '@/lib/tvmonitor-access';
import { getSupabaseAdmin } from '@/lib/supabase';

export const dynamic = 'force-dynamic';

const BUCKET = 'tvmonitor-media';

const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp', 'image/gif', 'image/svg+xml']);
const VIDEO_TYPES = new Set(['video/mp4', 'video/webm', 'video/quicktime']);
const MAX_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_VIDEO_BYTES = 50 * 1024 * 1024; // matches the bucket's file_size_limit

/**
 * Issues a signed Supabase Storage upload URL so the browser uploads media
 * directly (bypassing Vercel's request-body limit). Auth: Bond admin session
 * or a studio session; studio uploads are namespaced under their org.
 */
export async function POST(request: NextRequest) {
  let orgScope = 'bond';
  const adminDenied = await requireAdmin();
  if (adminDenied) {
    const session = await requireStudioSession(cookies().get(TV_STUDIO_COOKIE_NAME)?.value);
    if (!session) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    orgScope = `org-${session.organizationIds[0] ?? 'unknown'}`;
  }

  try {
    const body = (await request.json()) as { filename?: string; contentType?: string; sizeBytes?: number };
    const contentType = body.contentType ?? '';
    const sizeBytes = Number(body.sizeBytes) || 0;

    const isImage = IMAGE_TYPES.has(contentType);
    const isVideo = VIDEO_TYPES.has(contentType);
    if (!isImage && !isVideo) {
      return NextResponse.json(
        { error: 'Unsupported file type. Use JPG, PNG, WebP, GIF, SVG, MP4, WebM, or MOV.' },
        { status: 400 },
      );
    }
    const maxBytes = isVideo ? MAX_VIDEO_BYTES : MAX_IMAGE_BYTES;
    if (sizeBytes <= 0 || sizeBytes > maxBytes) {
      return NextResponse.json(
        { error: `File too large — max ${Math.round(maxBytes / 1024 / 1024)} MB for ${isVideo ? 'videos' : 'images'}.` },
        { status: 400 },
      );
    }

    const safeName = (body.filename ?? 'file')
      .toLowerCase()
      .replace(/[^a-z0-9._-]+/g, '-')
      .replace(/-+/g, '-')
      .slice(-80);
    const path = `${orgScope}/${Date.now()}-${safeName}`;

    const storage = getSupabaseAdmin().storage.from(BUCKET);
    const { data, error } = await storage.createSignedUploadUrl(path);
    if (error || !data) {
      console.error('[TvMonitor/Media] sign error:', error);
      return NextResponse.json(
        { error: 'Could not prepare the upload. Has migration 015 (tvmonitor-media bucket) been applied?' },
        { status: 500 },
      );
    }

    const { data: publicData } = storage.getPublicUrl(path);
    return NextResponse.json({
      uploadUrl: data.signedUrl,
      publicUrl: publicData.publicUrl,
      kind: isVideo ? 'video' : 'image',
    });
  } catch (error) {
    console.error('[TvMonitor/Media] POST error:', error);
    return NextResponse.json({ error: 'Upload preparation failed' }, { status: 500 });
  }
}
