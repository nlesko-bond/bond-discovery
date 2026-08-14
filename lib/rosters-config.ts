/**
 * Supabase CRUD for roster_pages, plus the normalizer.
 *
 * `normalizeRosterConfig` runs on every read and deep-defaults everything, so
 * rows written before a field existed keep working — the same rule the TV
 * monitor config follows.
 *
 * Password hashes never leave this module: callers get `hasViewerPassword` /
 * `hasStaffPassword` booleans instead. The Bond `apiKey` *is* on the config
 * object, because the admin editor has to display and update it — the same
 * arrangement as lib/config.ts. It is therefore admin-gated, and must never be
 * passed to a client component on the public surface.
 */

import { cache as reactCache } from 'react';
import { getSupabaseAdmin } from '@/lib/supabase';

// React's `cache` exists in Next.js' server runtime but not in the plain React
// build the test environment uses -- fall back to identity, as lib/config.ts does.
const cache: typeof reactCache =
  typeof reactCache === 'function' ? reactCache : (fn) => fn;
import { isBondEnv } from '@/lib/bond-env';
import { hashViewerPassword } from '@/lib/reservation-page-password';
import {
  DEFAULT_ROSTER_FIELD_VISIBILITY,
  ROSTER_NAME_MODES,
  type RosterBranding,
  type RosterFieldVisibility,
  type RosterNameMode,
  type RosterPageAccess,
  type RosterPageConfig,
  type RosterProgramFilter,
  type RosterSessionWindow,
} from '@/types/rosters';

const TABLE = 'roster_pages';

/** Same join lib/config.ts uses; partner_groups is RLS-blocked for anon. */
const SELECT_WITH_GROUP = '*, partner_group:partner_groups(id, name, api_key)';

/** Reserved because they would collide with routes under /rosters. */
const RESERVED_SLUGS = new Set(['api', 'admin', 'new', 'studio']);

export const DEFAULT_ROSTER_BRANDING: RosterBranding = {
  primaryColor: '#1A1A1A',
  // Darker than the reservation-page accent it was copied from: this one is
  // rendered behind white text, and #C47B2B gives 3.38:1 -- below the 4.5:1
  // WCAG AA threshold. #9A5B18 gives 5.41:1.
  accentColor: '#9A5B18',
  accentColorLight: '#E8A84C',
  bgColor: '#F7F7F5',
  fontHeading: 'Bebas Neue',
  fontBody: 'Open Sans',
  logoUrl: null,
  heroTitle: null,
  heroSubtitle: null,
};

export const DEFAULT_SESSION_WINDOW: RosterSessionWindow = { pastDays: 90, futureDays: 180 };

// --- coercers -------------------------------------------------------------

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

/**
 * A hex colour, or the fallback. Branding is DB-supplied and reaches CSS custom
 * properties; a malformed value makes the declaration invalid at computed-value
 * time, which renders as white text on a transparent background.
 */
function asHexColor(value: unknown, fallback: string): string {
  return typeof value === 'string' && /^#([0-9a-fA-F]{3}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(value)
    ? value
    : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.length > 0 ? value : null;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asCount(value: unknown, fallback: number): number {
  const n = Number(value);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

/**
 * Numeric ids from a JSONB array.
 *
 * Guards against `Number()`'s coercions: null, '', [] and false all become 0,
 * which would otherwise turn a stray null into a real id 0 and send a bogus
 * lookup to Bond. Only numbers and numeric strings are accepted.
 */
function asIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value
    .map((v) => {
      if (typeof v === 'number') return v;
      if (typeof v === 'string' && v.trim() !== '') return Number(v);
      return Number.NaN;
    })
    .filter((n) => Number.isFinite(n));
}

function asRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

// --- normalizers ----------------------------------------------------------

export function normalizeBranding(value: unknown): RosterBranding {
  const raw = asRecord(value);
  return {
    primaryColor: asHexColor(raw.primaryColor, DEFAULT_ROSTER_BRANDING.primaryColor),
    accentColor: asHexColor(raw.accentColor, DEFAULT_ROSTER_BRANDING.accentColor),
    accentColorLight: asHexColor(raw.accentColorLight, DEFAULT_ROSTER_BRANDING.accentColorLight),
    bgColor: asHexColor(raw.bgColor, DEFAULT_ROSTER_BRANDING.bgColor),
    fontHeading: asString(raw.fontHeading, DEFAULT_ROSTER_BRANDING.fontHeading),
    fontBody: asString(raw.fontBody, DEFAULT_ROSTER_BRANDING.fontBody),
    logoUrl: asNullableString(raw.logoUrl),
    heroTitle: asNullableString(raw.heroTitle),
    heroSubtitle: asNullableString(raw.heroSubtitle),
  };
}

export function normalizeProgramFilter(value: unknown): RosterProgramFilter {
  const raw = asRecord(value);
  const mode = raw.mode;
  return {
    mode: mode === 'include' || mode === 'exclude' ? mode : 'all',
    programIds: asIdArray(raw.programIds),
  };
}

export function normalizeSessionWindow(value: unknown): RosterSessionWindow {
  const raw = asRecord(value);
  return {
    pastDays: asCount(raw.pastDays, DEFAULT_SESSION_WINDOW.pastDays),
    futureDays: asCount(raw.futureDays, DEFAULT_SESSION_WINDOW.futureDays),
  };
}

export function normalizePinnedSessions(value: unknown): Array<{ programId: number; sessionId: number }> {
  if (!Array.isArray(value)) return [];
  return value
    .map((entry) => {
      const raw = asRecord(entry);
      return { programId: Number(raw.programId), sessionId: Number(raw.sessionId) };
    })
    .filter((p) => Number.isFinite(p.programId) && Number.isFinite(p.sessionId));
}

/**
 * Unknown values fall back to the most private setting rather than the most
 * permissive one — a typo in the database must never widen exposure.
 */
export function normalizeFieldVisibility(value: unknown, isYouth = false): RosterFieldVisibility {
  const raw = asRecord(value);
  const d = DEFAULT_ROSTER_FIELD_VISIBILITY;

  const nameMode: RosterNameMode = ROSTER_NAME_MODES.includes(raw.nameMode as RosterNameMode)
    ? (raw.nameMode as RosterNameMode)
    : d.nameMode;

  const contactSource = raw.contactSource === 'participant' ? 'participant' : 'primary';

  return {
    nameMode,
    showPhoto: asBool(raw.showPhoto, d.showPhoto),
    showJerseyNumber: asBool(raw.showJerseyNumber, d.showJerseyNumber),
    showPosition: asBool(raw.showPosition, d.showPosition),
    showTeamRole: asBool(raw.showTeamRole, d.showTeamRole),
    staffShowContact: asBool(raw.staffShowContact, d.staffShowContact),
    staffShowBirthDate: asBool(raw.staffShowBirthDate, d.staffShowBirthDate),
    staffShowGender: asBool(raw.staffShowGender, d.staffShowGender),
    staffShowWaiver: asBool(raw.staffShowWaiver, d.staffShowWaiver),
    staffShowRegistration: asBool(raw.staffShowRegistration, d.staffShowRegistration),
    staffShowGuardian: asBool(raw.staffShowGuardian, d.staffShowGuardian),
    // Youth pages always read contact from the guardian account, whatever the
    // stored value says. Little League policy is explicit that a child's own
    // contact details do not belong on a website, and this is the one place
    // that rule can be enforced for every caller at once.
    contactSource: isYouth ? 'primary' : contactSource,
  };
}

export function normalizeRosterConfig(row: Record<string, unknown>): RosterPageConfig {
  const isYouth = asBool(row.is_youth, false);

  // Key resolution mirrors discovery pages: the page's own key wins, else the
  // partner group's. A page normally carries no key of its own at all.
  const group = asRecord(row.partner_group);
  const ownKey = asNullableString(row.api_key);
  const groupKey = asNullableString(group.api_key);
  const apiKey = ownKey ?? groupKey ?? undefined;
  const access = row.page_access;
  const pageAccess: RosterPageAccess =
    access === 'password' || access === 'staff' ? access : 'public';

  return {
    id: String(row.id),
    slug: String(row.slug),
    name: asString(row.name, 'Rosters'),
    isActive: asBool(row.is_active, false),
    organizationIds: asIdArray(row.organization_ids),
    programFilter: normalizeProgramFilter(row.program_filter),
    pinnedSessions: normalizePinnedSessions(row.pinned_sessions),
    sessionWindow: normalizeSessionWindow(row.session_window),
    branding: normalizeBranding(row.branding),
    pageAccess,
    fieldVisibility: normalizeFieldVisibility(row.field_visibility, isYouth),
    allowIndexing: asBool(row.allow_indexing, false),
    allowPrint: asBool(row.allow_print, true),
    isYouth,
    hasViewerPassword: typeof row.viewer_password_hash === 'string' && row.viewer_password_hash.length > 0,
    hasStaffPassword: typeof row.staff_password_hash === 'string' && row.staff_password_hash.length > 0,
    partnerGroupId: asNullableString(row.partner_group_id) ?? undefined,
    partnerGroupName: asNullableString(group.name) ?? undefined,
    apiKey,
    apiKeyInherited: !ownKey && Boolean(groupKey),
    // Normalized through the env union rather than kept as a bare string: an
    // unrecognized value would otherwise reach getBondBaseUrl and produce an
    // `undefined/organization/...` request URL.
    bondEnv: isBondEnv(row.bond_env) ? row.bond_env : undefined,
    createdAt: String(row.created_at ?? ''),
    updatedAt: String(row.updated_at ?? ''),
  };
}

export function normalizeSlug(slug: string): string {
  return slug.toLowerCase().trim().replace(/[^a-z0-9-]/g, '-').replace(/-+/g, '-').replace(/^-|-$/g, '');
}

export function isReservedRosterSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(normalizeSlug(slug));
}

/** Partner groups an admin can attach a roster page to. */
export async function getRosterPartnerGroups(): Promise<
  Array<{ id: string; name: string; hasApiKey: boolean }>
> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('partner_groups')
    .select('id, name, api_key, is_active')
    .order('name');

  if (error) {
    console.error('[rosters-config] partner groups:', error);
    return [];
  }
  return (data || [])
    .filter((g) => (g as Record<string, unknown>).is_active !== false)
    .map((g) => {
      const row = g as Record<string, unknown>;
      return {
        id: String(row.id),
        name: String(row.name ?? ''),
        hasApiKey: Boolean(asNullableString(row.api_key)),
      };
    });
}

/** Does this page have a usable key once inheritance is applied? */
async function resolvesToAKey(
  ownKey: string | null | undefined,
  partnerGroupId: string | null | undefined
): Promise<boolean> {
  if (ownKey) return true;
  if (!partnerGroupId) return false;
  const groups = await getRosterPartnerGroups();
  return groups.find((g) => g.id === partnerGroupId)?.hasApiKey ?? false;
}

// --- reads ----------------------------------------------------------------

/**
 * Request-memoized: the page route reads this twice (generateMetadata and the
 * page body), and lib/config.ts sets the same precedent for discovery pages.
 */
export const getRosterPageBySlug = cache(async (slug: string): Promise<RosterPageConfig | null> => {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from(TABLE).select(SELECT_WITH_GROUP).eq('slug', slug).maybeSingle();

  if (error || !data) {
    if (error) console.error('[rosters-config] by slug:', error);
    return null;
  }
  return normalizeRosterConfig(data as Record<string, unknown>);
});

export async function getAllRosterPages(): Promise<RosterPageConfig[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from(TABLE).select(SELECT_WITH_GROUP).order('name');

  if (error) {
    console.error('[rosters-config] list error:', error);
    return [];
  }
  return (data || []).map((row) => normalizeRosterConfig(row as Record<string, unknown>));
}

// --- writes ---------------------------------------------------------------

/** Fields an admin may set. Passwords come in plain and are hashed here. */
export interface RosterPageInput {
  name?: string;
  slug?: string;
  isActive?: boolean;
  organizationIds?: number[];
  programFilter?: unknown;
  pinnedSessions?: unknown;
  sessionWindow?: unknown;
  branding?: unknown;
  pageAccess?: RosterPageAccess;
  fieldVisibility?: unknown;
  allowIndexing?: boolean;
  allowPrint?: boolean;
  isYouth?: boolean;
  partnerGroupId?: string | null;
  apiKey?: string | null;
  bondEnv?: string | null;
  /** Empty string clears the password; undefined leaves it unchanged. */
  viewerPassword?: string;
  staffPassword?: string;
}

/**
 * Map input onto database columns. Only keys actually present are written, so
 * a PATCH never blanks a field the caller did not mention.
 */
function toRow(input: RosterPageInput, isYouth: boolean): Record<string, unknown> {
  const row: Record<string, unknown> = {};

  if (input.name !== undefined) row.name = input.name;
  if (input.slug !== undefined) row.slug = normalizeSlug(input.slug);
  if (input.isActive !== undefined) row.is_active = input.isActive;
  if (input.organizationIds !== undefined) row.organization_ids = asIdArray(input.organizationIds);
  if (input.programFilter !== undefined) row.program_filter = normalizeProgramFilter(input.programFilter);
  if (input.pinnedSessions !== undefined) row.pinned_sessions = normalizePinnedSessions(input.pinnedSessions);
  if (input.sessionWindow !== undefined) row.session_window = normalizeSessionWindow(input.sessionWindow);
  if (input.branding !== undefined) row.branding = normalizeBranding(input.branding);
  if (input.pageAccess !== undefined) row.page_access = input.pageAccess;
  if (input.fieldVisibility !== undefined) {
    row.field_visibility = normalizeFieldVisibility(input.fieldVisibility, isYouth);
  }
  if (input.allowIndexing !== undefined) row.allow_indexing = input.allowIndexing;
  if (input.allowPrint !== undefined) row.allow_print = input.allowPrint;
  if (input.isYouth !== undefined) row.is_youth = input.isYouth;
  if (input.partnerGroupId !== undefined) row.partner_group_id = input.partnerGroupId || null;
  if (input.apiKey !== undefined) row.api_key = input.apiKey || null;
  if (input.bondEnv !== undefined) row.bond_env = input.bondEnv || null;

  if (input.viewerPassword !== undefined) {
    row.viewer_password_hash = input.viewerPassword ? hashViewerPassword(input.viewerPassword) : null;
  }
  if (input.staffPassword !== undefined) {
    row.staff_password_hash = input.staffPassword ? hashViewerPassword(input.staffPassword) : null;
    row.staff_password_updated_at = input.staffPassword ? new Date().toISOString() : null;
  }

  return row;
}

export async function createRosterPage(input: RosterPageInput & { name: string; slug: string }): Promise<RosterPageConfig> {
  const db = getSupabaseAdmin();

  if (input.isActive && !(await resolvesToAKey(input.apiKey, input.partnerGroupId))) {
    throw new Error(
      'Cannot publish a roster page with no Bond API key: pick a partner group that has one, or set a key on the page.'
    );
  }

  const row = toRow(input, input.isYouth ?? false);

  const { data, error } = await db.from(TABLE).insert(row).select(SELECT_WITH_GROUP).single();
  if (error || !data) {
    throw new Error(error?.message || 'Failed to create roster page');
  }
  return normalizeRosterConfig(data as Record<string, unknown>);
}

export async function updateRosterPage(
  slug: string,
  input: RosterPageInput
): Promise<RosterPageConfig | null> {
  const db = getSupabaseAdmin();

  // Read isYouth first: the youth guardian-contact rule has to be applied
  // against the value the row will *end up* with, not the one it had.
  const existing = await getRosterPageBySlug(slug);
  if (!existing) return null;
  const isYouth = input.isYouth ?? existing.isYouth;

  // Enforced here, not only in the editor: a direct PATCH could otherwise
  // publish a keyless page that errors on every view. Evaluated against the
  // row's resulting state, so clearing the key on a live page is also caught.
  const nextActive = input.isActive ?? existing.isActive;
  const nextOwnKey =
    input.apiKey !== undefined ? input.apiKey : existing.apiKeyInherited ? null : existing.apiKey;
  const nextGroup =
    input.partnerGroupId !== undefined ? input.partnerGroupId : existing.partnerGroupId;
  if (nextActive && !(await resolvesToAKey(nextOwnKey, nextGroup))) {
    throw new Error(
      'Cannot publish a roster page with no Bond API key: pick a partner group that has one, or set a key on the page.'
    );
  }

  const row = toRow(input, isYouth);
  if (Object.keys(row).length === 0) return existing;

  const { data, error } = await db.from(TABLE).update(row).eq('slug', slug).select(SELECT_WITH_GROUP).single();
  if (error || !data) {
    throw new Error(error?.message || 'Failed to update roster page');
  }
  return normalizeRosterConfig(data as Record<string, unknown>);
}

export async function deleteRosterPage(slug: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db.from(TABLE).delete().eq('slug', slug);
  if (error) {
    console.error('[rosters-config] delete error:', error);
    return false;
  }
  return true;
}

/**
 * Password hashes for the access gate. Kept separate from the config read so
 * hashes never ride along on an object that might be serialized to a client.
 */
export async function getRosterPageSecrets(slug: string): Promise<{
  found: boolean;
  isActive: boolean;
  pageAccess: RosterPageAccess;
  viewerPasswordHash: string | null;
  staffPasswordHash: string | null;
}> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from(TABLE)
    .select('is_active, page_access, viewer_password_hash, staff_password_hash')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    return {
      found: false,
      isActive: false,
      pageAccess: 'public',
      viewerPasswordHash: null,
      staffPasswordHash: null,
    };
  }

  const row = data as Record<string, unknown>;
  const access = row.page_access;
  return {
    found: true,
    isActive: Boolean(row.is_active),
    pageAccess: access === 'password' || access === 'staff' ? access : 'public',
    viewerPasswordHash: asNullableString(row.viewer_password_hash),
    staffPasswordHash: asNullableString(row.staff_password_hash),
  };
}
