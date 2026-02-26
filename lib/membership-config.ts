/**
 * Supabase CRUD for membership_pages table
 */

import { getSupabaseAdmin } from './supabase';
import { MembershipPageConfig, MembershipBranding, CategoryOverride } from '@/types/membership';

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

export async function getAllMembershipConfigs(): Promise<MembershipPageConfig[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('membership_pages')
    .select('*')
    .order('name');

  if (error) {
    console.error('[MembershipConfig] Error fetching all configs:', error);
    return [];
  }

  return data || [];
}

export async function getActiveMembershipConfigs(): Promise<MembershipPageConfig[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('membership_pages')
    .select('*')
    .eq('is_active', true)
    .order('name');

  if (error) {
    console.error('[MembershipConfig] Error fetching active configs:', error);
    return [];
  }

  return data || [];
}

export async function getMembershipConfigBySlug(
  slug: string
): Promise<MembershipPageConfig | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('membership_pages')
    .select('*')
    .eq('slug', slug)
    .single();

  if (error || !data) {
    console.error('[MembershipConfig] Error fetching by slug:', error);
    return null;
  }

  return data;
}

export async function createMembershipConfig(config: {
  name: string;
  slug: string;
  organization_id: number;
  organization_name?: string;
  organization_slug?: string;
  facility_id?: number;
  branding?: Partial<MembershipBranding>;
  membership_ids_include?: number[];
  membership_ids_exclude?: number[];
  include_not_open_for_registration?: boolean;
  registration_link_template?: string;
  category_overrides?: CategoryOverride[];
  nav_links?: { label: string; url: string }[];
  footer_info?: { address?: string; email?: string; phone?: string };
  cache_ttl?: number;
  is_active?: boolean;
}): Promise<MembershipPageConfig> {
  const db = getSupabaseAdmin();
  const normalizedSlug = config.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');

  const { data, error } = await db
    .from('membership_pages')
    .insert({
      name: config.name,
      slug: normalizedSlug,
      organization_id: config.organization_id,
      organization_name: config.organization_name || null,
      organization_slug: config.organization_slug || null,
      facility_id: config.facility_id || null,
      branding: { ...DEFAULT_BRANDING, ...config.branding },
      membership_ids_include: config.membership_ids_include || null,
      membership_ids_exclude: config.membership_ids_exclude || null,
      include_not_open_for_registration: config.include_not_open_for_registration ?? false,
      registration_link_template:
        config.registration_link_template ||
        'https://bondsports.co/{orgSlug}/memberships/{membershipSlug}/{membershipId}',
      category_overrides: config.category_overrides || null,
      nav_links: config.nav_links || null,
      footer_info: config.footer_info || null,
      cache_ttl: config.cache_ttl || 900,
      is_active: config.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('[MembershipConfig] Error creating config:', error);
    throw new Error(error.message);
  }

  return data;
}

export async function updateMembershipConfig(
  slug: string,
  updates: Partial<MembershipPageConfig>
): Promise<MembershipPageConfig> {
  const db = getSupabaseAdmin();

  const updateData: Record<string, any> = {};
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.slug !== undefined) updateData.slug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
  if (updates.organization_id !== undefined) updateData.organization_id = updates.organization_id;
  if (updates.organization_name !== undefined) updateData.organization_name = updates.organization_name;
  if (updates.organization_slug !== undefined) updateData.organization_slug = updates.organization_slug;
  if (updates.facility_id !== undefined) updateData.facility_id = updates.facility_id;
  if (updates.branding !== undefined) updateData.branding = updates.branding;
  if (updates.membership_ids_include !== undefined) updateData.membership_ids_include = updates.membership_ids_include;
  if (updates.membership_ids_exclude !== undefined) updateData.membership_ids_exclude = updates.membership_ids_exclude;
  if (updates.include_not_open_for_registration !== undefined) updateData.include_not_open_for_registration = updates.include_not_open_for_registration;
  if (updates.registration_link_template !== undefined) updateData.registration_link_template = updates.registration_link_template;
  if (updates.category_overrides !== undefined) updateData.category_overrides = updates.category_overrides;
  if (updates.nav_links !== undefined) updateData.nav_links = updates.nav_links;
  if (updates.footer_info !== undefined) updateData.footer_info = updates.footer_info;
  if (updates.cache_ttl !== undefined) updateData.cache_ttl = updates.cache_ttl;

  const { error: updateError } = await db
    .from('membership_pages')
    .update(updateData)
    .eq('slug', slug);

  if (updateError) {
    console.error('[MembershipConfig] Error updating config:', updateError);
    throw new Error(updateError.message);
  }

  const fetchSlug = updateData.slug || slug;
  const { data, error: fetchError } = await db
    .from('membership_pages')
    .select('*')
    .eq('slug', fetchSlug)
    .single();

  if (fetchError || !data) {
    throw new Error(fetchError?.message || 'Config not found after update');
  }

  return data;
}

export async function deleteMembershipConfig(slug: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db
    .from('membership_pages')
    .delete()
    .eq('slug', slug);

  if (error) {
    console.error('[MembershipConfig] Error deleting config:', error);
    return false;
  }

  return true;
}
