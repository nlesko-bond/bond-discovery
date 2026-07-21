/**
 * Named TV Monitor studio users with email magic-link sign-in (Phase 1 auth).
 *
 * A Bond admin adds an email + org list; the person signs in at
 * /tvmonitor/studio by requesting a single-use login link. Tokens are stored
 * hashed. Designed so a Bond-platform SSO identity can replace the login
 * mechanism later without touching the org-permission model.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { generateAccessToken, hashAccessToken } from '@/lib/tvmonitor-access';

export interface ITvMonitorUser {
  id: string;
  email: string;
  organization_ids: number[];
  role: string;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
  last_login_at: string | null;
}

const LOGIN_TOKEN_TTL_MINUTES = 15;
const INVITE_TOKEN_TTL_DAYS = 7;

export function normalizeStudioEmail(email: string): string {
  return email.trim().toLowerCase();
}

function isPlausibleEmail(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
}

function rowToUser(row: Record<string, unknown>): ITvMonitorUser {
  return {
    id: String(row.id),
    email: String(row.email),
    organization_ids: Array.isArray(row.organization_ids)
      ? row.organization_ids.map((n) => Number(n)).filter((n) => Number.isFinite(n))
      : [],
    role: String(row.role ?? 'editor'),
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at),
    revoked_at: row.revoked_at != null ? String(row.revoked_at) : null,
    last_login_at: row.last_login_at != null ? String(row.last_login_at) : null,
  };
}

export async function listTvMonitorUsers(): Promise<ITvMonitorUser[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('tvmonitor_users').select('*').order('created_at', { ascending: false });
  if (error) {
    console.error('[TvMonitorUsers] list error:', error);
    return [];
  }
  return (data || []).map((row) => rowToUser(row as Record<string, unknown>));
}

export async function createTvMonitorUser(input: {
  email: string;
  organization_ids: number[] | string;
  created_by?: string | null;
}): Promise<ITvMonitorUser> {
  const email = normalizeStudioEmail(input.email ?? '');
  if (!isPlausibleEmail(email)) throw new Error('A valid email address is required');

  const raw = input.organization_ids;
  const organizationIds =
    typeof raw === 'string'
      ? raw
          .split(/[,\s]+/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n) && n > 0)
      : Array.isArray(raw)
        ? raw.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0)
        : [];
  if (!organizationIds.length) throw new Error('At least one organization ID is required');

  const db = getSupabaseAdmin();
  // Re-adding a previously revoked email reactivates it with the new orgs.
  const { data, error } = await db
    .from('tvmonitor_users')
    .upsert(
      {
        email,
        organization_ids: organizationIds,
        created_by: input.created_by ?? null,
        revoked_at: null,
      },
      { onConflict: 'email' },
    )
    .select()
    .single();

  if (error || !data) {
    console.error('[TvMonitorUsers] create error:', error);
    throw new Error(error?.message || 'Create failed');
  }
  return rowToUser(data as Record<string, unknown>);
}

export async function updateTvMonitorUserOrgs(id: string, organizationIds: number[]): Promise<boolean> {
  const ids = organizationIds.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
  if (!ids.length) throw new Error('At least one organization ID is required');
  const db = getSupabaseAdmin();
  const { error } = await db.from('tvmonitor_users').update({ organization_ids: ids }).eq('id', id);
  if (error) {
    console.error('[TvMonitorUsers] update orgs error:', error);
    return false;
  }
  return true;
}

export async function revokeTvMonitorUser(id: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('tvmonitor_users').update({ revoked_at: new Date().toISOString() }).eq('id', id);
  if (error) {
    console.error('[TvMonitorUsers] revoke error:', error);
    return false;
  }
  return true;
}

export async function getTvMonitorUserByEmail(email: string): Promise<ITvMonitorUser | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('tvmonitor_users')
    .select('*')
    .eq('email', normalizeStudioEmail(email))
    .maybeSingle();
  if (error || !data) return null;
  return rowToUser(data as Record<string, unknown>);
}

// ---------------------------------------------------------------------------
// Login tokens (single-use, hashed)
// ---------------------------------------------------------------------------

/**
 * Mints a single-use login token for a user. `invite` tokens live 7 days
 * (admin hands the link over); self-requested login tokens live 15 minutes.
 * Returns the RAW token — embed in a /tvmonitor/studio?login={token} URL.
 */
export async function createLoginToken(userId: string, kind: 'login' | 'invite'): Promise<string> {
  const token = generateAccessToken();
  const ttlMs = kind === 'invite' ? INVITE_TOKEN_TTL_DAYS * 24 * 60 * 60 * 1000 : LOGIN_TOKEN_TTL_MINUTES * 60 * 1000;
  const db = getSupabaseAdmin();
  const { error } = await db.from('tvmonitor_login_tokens').insert({
    user_id: userId,
    token_hash: hashAccessToken(token),
    expires_at: new Date(Date.now() + ttlMs).toISOString(),
  });
  if (error) {
    console.error('[TvMonitorUsers] login token error:', error);
    throw new Error('Could not create sign-in link');
  }
  return token;
}

/**
 * Verifies + consumes a login token. Single-use: the token is marked used
 * atomically, so a replayed link fails. Returns the (active) user or null.
 */
export async function consumeLoginToken(token: string): Promise<ITvMonitorUser | null> {
  if (!token || token.length < 20) return null;
  const db = getSupabaseAdmin();

  // Atomic claim: only one request can flip used_at from NULL.
  const { data: claimed, error: claimError } = await db
    .from('tvmonitor_login_tokens')
    .update({ used_at: new Date().toISOString() })
    .eq('token_hash', hashAccessToken(token))
    .is('used_at', null)
    .gt('expires_at', new Date().toISOString())
    .select('user_id')
    .maybeSingle();

  if (claimError || !claimed) return null;

  const { data: userRow, error: userError } = await db
    .from('tvmonitor_users')
    .select('*')
    .eq('id', (claimed as Record<string, unknown>).user_id as string)
    .maybeSingle();
  if (userError || !userRow) return null;

  const user = rowToUser(userRow as Record<string, unknown>);
  if (user.revoked_at) return null;

  const { error: stampError } = await db
    .from('tvmonitor_users')
    .update({ last_login_at: new Date().toISOString() })
    .eq('id', user.id);
  if (stampError) console.error('[TvMonitorUsers] last_login stamp error:', stampError);

  return user;
}
