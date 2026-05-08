/**
 * Supabase CRUD for reservation_pages (rental schedule reports per org).
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { hashViewerPassword } from '@/lib/reservation-page-password';
import type { IReservationPageConfig, ReservationPageBranding } from '@/types/reservation-pages';
import type { MembershipBranding } from '@/types/membership';

const DEFAULT_BRANDING: MembershipBranding = {
  primaryColor: '#1A1A1A',
  accentColor: '#C47B2B',
  accentColorLight: '#E8A84C',
  bgColor: '#F7F7F5',
  fontHeading: 'Bebas Neue',
  fontBody: 'Open Sans',
  logoUrl: null,
  heroTitle: null,
  heroSubtitle: null,
};

function rowToConfig(row: Record<string, unknown>): IReservationPageConfig {
  const rawOrgIds = row.organization_ids;
  const organization_ids = Array.isArray(rawOrgIds)
    ? rawOrgIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))
    : [];

  const rawHash = row.viewer_password_hash;
  const hasViewerPassword = typeof rawHash === 'string' && rawHash.length > 0;

  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    is_active: Boolean(row.is_active),
    organization_ids,
    branding: { ...(row.branding as ReservationPageBranding) },
    page_title: row.page_title != null ? String(row.page_title) : null,
    page_subtitle: row.page_subtitle != null ? String(row.page_subtitle) : null,
    hasViewerPassword,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getReservationPageUnlockContext(slug: string): Promise<{
  found: boolean;
  is_active: boolean;
  passwordHash: string | null;
}> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('reservation_pages')
    .select('viewer_password_hash, is_active')
    .eq('slug', slug)
    .maybeSingle();

  if (error || !data) {
    return { found: false, is_active: false, passwordHash: null };
  }
  const row = data as Record<string, unknown>;
  const h = row.viewer_password_hash;
  const passwordHash = typeof h === 'string' && h.length > 0 ? h : null;
  return {
    found: true,
    is_active: Boolean(row.is_active),
    passwordHash,
  };
}

export async function getActiveReservationPageConfigs(): Promise<IReservationPageConfig[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('reservation_pages')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('[ReservationPagesConfig] active list error:', error);
    return [];
  }

  return (data || []).map((row) => rowToConfig(row as Record<string, unknown>));
}

export async function getAllReservationPageConfigs(): Promise<IReservationPageConfig[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('reservation_pages').select('*').order('name');

  if (error) {
    console.error('[ReservationPagesConfig] list error:', error);
    return [];
  }

  return (data || []).map((row) => rowToConfig(row as Record<string, unknown>));
}

export async function getReservationPageConfigBySlug(slug: string): Promise<IReservationPageConfig | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('reservation_pages').select('*').eq('slug', slug).single();

  if (error || !data) {
    console.error('[ReservationPagesConfig] by slug error:', error);
    return null;
  }

  return rowToConfig(data as Record<string, unknown>);
}

export async function createReservationPageConfig(input: {
  name: string;
  slug: string;
  organization_ids: number[] | string;
  branding?: Partial<ReservationPageBranding>;
  page_title?: string | null;
  page_subtitle?: string | null;
  is_active?: boolean;
  viewer_password_new?: string | null;
}): Promise<IReservationPageConfig> {
  const db = getSupabaseAdmin();
  const normalizedSlug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const rawIds = input.organization_ids;
  const organizationIds =
    typeof rawIds === 'string'
      ? rawIds
          .split(/[,\s]+/)
          .map((s) => parseInt(s.trim(), 10))
          .filter((n) => Number.isFinite(n))
      : Array.isArray(rawIds)
        ? rawIds.map((n) => Number(n)).filter((n) => Number.isFinite(n))
        : [];

  if (!organizationIds.length) {
    throw new Error('At least one organization ID is required');
  }

  let viewer_password_hash: string | null = null;
  if (typeof input.viewer_password_new === 'string' && input.viewer_password_new.trim()) {
    viewer_password_hash = hashViewerPassword(input.viewer_password_new.trim());
  }

  const { data, error } = await db
    .from('reservation_pages')
    .insert({
      name: input.name,
      slug: normalizedSlug,
      organization_ids: organizationIds,
      branding: { ...DEFAULT_BRANDING, ...input.branding },
      page_title: input.page_title ?? null,
      page_subtitle: input.page_subtitle ?? null,
      is_active: input.is_active ?? true,
      viewer_password_hash,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[ReservationPagesConfig] create error:', error);
    throw new Error(error?.message || 'Create failed');
  }

  return rowToConfig(data as Record<string, unknown>);
}

export async function updateReservationPageConfig(
  slug: string,
  updates: Partial<
    Pick<IReservationPageConfig, 'name' | 'slug' | 'is_active' | 'branding' | 'page_title' | 'page_subtitle'>
  > & {
    organization_ids?: number[] | string;
    viewer_password_new?: string | null;
    viewer_password_clear?: boolean;
  },
): Promise<IReservationPageConfig> {
  const db = getSupabaseAdmin();
  const updateData: Record<string, unknown> = {};

  const passwordClear = updates.viewer_password_clear === true;
  const passwordNew =
    typeof updates.viewer_password_new === 'string' && updates.viewer_password_new.trim()
      ? updates.viewer_password_new.trim()
      : null;

  if (passwordClear) {
    updateData.viewer_password_hash = null;
  } else if (passwordNew) {
    updateData.viewer_password_hash = hashViewerPassword(passwordNew);
  }

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.slug !== undefined) {
    updateData.slug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  }
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
  if (updates.organization_ids !== undefined) {
    const raw = updates.organization_ids;
    const ids =
      typeof raw === 'string'
        ? raw
            .split(/[,\s]+/)
            .map((s) => parseInt(s.trim(), 10))
            .filter((n) => Number.isFinite(n))
        : raw.filter((n) => Number.isFinite(n));
    if (!ids.length) {
      throw new Error('At least one organization ID is required');
    }
    updateData.organization_ids = ids;
  }
  if (updates.branding !== undefined) updateData.branding = updates.branding;
  if (updates.page_title !== undefined) updateData.page_title = updates.page_title;
  if (updates.page_subtitle !== undefined) updateData.page_subtitle = updates.page_subtitle;

  const { error: updateError } = await db.from('reservation_pages').update(updateData).eq('slug', slug);

  if (updateError) {
    console.error('[ReservationPagesConfig] update error:', updateError);
    throw new Error(updateError.message);
  }

  const fetchSlug = typeof updateData.slug === 'string' ? updateData.slug : slug;
  const { data, error: fetchError } = await db.from('reservation_pages').select('*').eq('slug', fetchSlug).single();

  if (fetchError || !data) {
    throw new Error(fetchError?.message || 'Not found after update');
  }

  return rowToConfig(data as Record<string, unknown>);
}

export async function deleteReservationPageConfig(slug: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('reservation_pages').delete().eq('slug', slug);

  if (error) {
    console.error('[ReservationPagesConfig] delete error:', error);
    return false;
  }

  return true;
}
