/**
 * Org-scoped builder access for TV Monitor studio users outside Bond Sports.
 *
 * Bond admins create an access grant per person/org in /admin/tvmonitor. The
 * grant is a random token embedded in a link (shown once); only its sha256
 * hash is stored. Opening /tvmonitor/studio?key={token} exchanges the token
 * for an httpOnly signed cookie, mirroring the reservation-page access-cookie
 * pattern (lib/reservation-page-access-cookie.ts).
 */

import { createHmac, createHash, randomBytes, timingSafeEqual } from 'crypto';
import { getSupabaseAdmin } from '@/lib/supabase';
import type { ITvMonitorAccessGrant } from '@/types/tvmonitor';

export const TV_STUDIO_COOKIE_NAME = 'bond_tvstudio';
const COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 30;
const DEV_FALLBACK_SECRET = 'dev-only-tvmonitor-access-set-TVMONITOR_ACCESS_SECRET';

function getTvMonitorAccessSecret(): string {
  const s = process.env.TVMONITOR_ACCESS_SECRET || process.env.RESERVATION_PAGE_ACCESS_SECRET;
  if (s && s.length > 0) return s;
  if (process.env.NODE_ENV === 'development') return DEV_FALLBACK_SECRET;
  throw new Error('TVMONITOR_ACCESS_SECRET is required for TV Monitor studio access links');
}

/** Generates a new raw access token (shown once, never stored). */
export function generateAccessToken(): string {
  return randomBytes(32).toString('base64url');
}

export function hashAccessToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}

// ---------------------------------------------------------------------------
// Signed studio session cookie
// ---------------------------------------------------------------------------

export interface TvStudioSession {
  grantId: string;
  organizationIds: number[];
}

function signSession(secret: string, grantId: string, orgIds: number[], expSeconds: number): string {
  return createHmac('sha256', secret).update(`${grantId}:${orgIds.join(',')}:${expSeconds}`).digest('hex');
}

export function createStudioCookieValue(session: TvStudioSession): { value: string; maxAgeSeconds: number } {
  const secret = getTvMonitorAccessSecret();
  const exp = Math.floor(Date.now() / 1000) + COOKIE_MAX_AGE_SECONDS;
  const sig = signSession(secret, session.grantId, session.organizationIds, exp);
  const payload = JSON.stringify({ g: session.grantId, o: session.organizationIds, exp, sig });
  return {
    value: Buffer.from(payload, 'utf8').toString('base64url'),
    maxAgeSeconds: COOKIE_MAX_AGE_SECONDS,
  };
}

export function verifyStudioCookie(raw: string | undefined): TvStudioSession | null {
  if (!raw) return null;
  let secret: string;
  try {
    secret = getTvMonitorAccessSecret();
  } catch {
    return null;
  }
  try {
    const json = Buffer.from(raw, 'base64url').toString('utf8');
    const parsed: unknown = JSON.parse(json);
    if (!parsed || typeof parsed !== 'object') return null;
    const rec = parsed as Record<string, unknown>;
    if (typeof rec.g !== 'string' || !Array.isArray(rec.o) || typeof rec.exp !== 'number' || typeof rec.sig !== 'string') {
      return null;
    }
    if (rec.exp < Math.floor(Date.now() / 1000)) return null;
    const orgIds = rec.o.map((n) => Number(n)).filter((n) => Number.isFinite(n));
    const expectedHex = signSession(secret, rec.g, orgIds, rec.exp);
    const a = Buffer.from(rec.sig, 'hex');
    const b = Buffer.from(expectedHex, 'hex');
    if (a.length !== b.length || !timingSafeEqual(a, b)) return null;
    return { grantId: rec.g, organizationIds: orgIds };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Grant CRUD (service role)
// ---------------------------------------------------------------------------

function rowToGrant(row: Record<string, unknown>): ITvMonitorAccessGrant {
  return {
    id: String(row.id),
    organization_id: Number(row.organization_id),
    label: String(row.label),
    token: typeof row.token === 'string' && row.token.length > 0 ? row.token : null,
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at),
    revoked_at: row.revoked_at != null ? String(row.revoked_at) : null,
    last_used_at: row.last_used_at != null ? String(row.last_used_at) : null,
  };
}

export async function listTvMonitorAccessGrants(): Promise<ITvMonitorAccessGrant[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('tvmonitor_access').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('[TvMonitorAccess] list error:', error);
    return [];
  }
  return (data || []).map((row) => rowToGrant(row as Record<string, unknown>));
}

export async function createTvMonitorAccessGrant(input: {
  organization_id: number;
  label: string;
  created_by?: string | null;
}): Promise<{ grant: ITvMonitorAccessGrant; token: string }> {
  const organizationId = Number(input.organization_id);
  if (!Number.isFinite(organizationId) || organizationId <= 0) throw new Error('A valid organization ID is required');
  if (!input.label?.trim()) throw new Error('A label is required (who is this link for?)');

  const token = generateAccessToken();
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('tvmonitor_access')
    .insert({
      organization_id: organizationId,
      label: input.label.trim(),
      token_hash: hashAccessToken(token),
      // Raw token kept so admins can re-copy the link (admin-gated table).
      token,
      created_by: input.created_by ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[TvMonitorAccess] create error:', error);
    throw new Error(error?.message || 'Create failed');
  }
  return { grant: rowToGrant(data as Record<string, unknown>), token };
}

export async function revokeTvMonitorAccessGrant(id: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('tvmonitor_access').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    console.error('[TvMonitorAccess] revoke error:', error);
    return false;
  }
  return true;
}

/**
 * Exchanges a raw token for its grant. Returns null for unknown/revoked tokens.
 * All non-revoked grants for the same org are merged into the session's org list
 * (one link = access to that org's monitors).
 */
export async function resolveAccessToken(token: string): Promise<ITvMonitorAccessGrant | null> {
  if (!token || token.length < 20) return null;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('tvmonitor_access')
    .select('*')
    .eq('token_hash', hashAccessToken(token))
    .maybeSingle();
  if (error || !data) return null;
  const grant = rowToGrant(data as Record<string, unknown>);
  if (grant.revoked_at) return null;

  // Best-effort usage stamp (awaited — Vercel reaps detached promises); never fail access on it.
  const { error: stampError } = await db
    .from('tvmonitor_access')
    .update({ last_used_at: new Date().toISOString() })
    .eq('id', grant.id);
  if (stampError) console.error('[TvMonitorAccess] last_used stamp error:', stampError);

  return grant;
}

/**
 * Re-validates a cookie session against the database (grant still exists and
 * is not revoked). Used by studio API routes so revocation takes effect
 * without waiting for cookie expiry.
 */
export async function requireStudioSession(rawCookie: string | undefined): Promise<TvStudioSession | null> {
  const session = verifyStudioCookie(rawCookie);
  if (!session) return null;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('tvmonitor_access')
    .select('id, revoked_at')
    .eq('id', session.grantId)
    .maybeSingle();
  if (error || !data) return null;
  if ((data as Record<string, unknown>).revoked_at != null) return null;
  return session;
}
