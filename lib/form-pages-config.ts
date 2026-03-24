/**
 * Supabase CRUD for form_pages (staff form responses viewer config)
 */

import { getSupabaseAdmin } from './supabase';
import { hashStaffPassword } from './forms-password';
import type { FormPageBranding, FormPageConfig, FormPageConfigAdmin } from '@/types/form-pages';

const DEFAULT_BRANDING: FormPageBranding = {
  companyName: 'Organization',
  primaryColor: '#1E2761',
  secondaryColor: '#6366F1',
  accentColor: '#8B5CF6',
  logo: null,
};

function toAdminDtoFixed(row: FormPageConfig): FormPageConfigAdmin {
  const has_staff_password = !!row.staff_password_hash;
  const { staff_password_hash: _h, ...rest } = row;
  return { ...rest, has_staff_password };
}

export async function getAllFormPageConfigs(): Promise<FormPageConfigAdmin[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('form_pages').select('*').order('name');
  if (error) {
    console.error('[FormPagesConfig] list error:', error);
    return [];
  }
  return (data || []).map((r) => toAdminDtoFixed(r as FormPageConfig));
}

export async function getFormPageConfigBySlug(slug: string): Promise<FormPageConfig | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('form_pages').select('*').eq('slug', slug).single();
  if (error || !data) {
    console.error('[FormPagesConfig] by slug:', error);
    return null;
  }
  return data as FormPageConfig;
}

export async function getFormPageConfigBySlugAdmin(slug: string): Promise<FormPageConfigAdmin | null> {
  const row = await getFormPageConfigBySlug(slug);
  return row ? toAdminDtoFixed(row) : null;
}

export async function createFormPageConfig(input: {
  name: string;
  slug: string;
  organization_id: number;
  default_questionnaire_id: number;
  allowed_questionnaire_ids?: number[] | null;
  branding?: Partial<FormPageBranding>;
  staff_password?: string;
  default_range_days?: number;
  max_range_days_cap?: number;
  titles_per_page?: number;
  is_active?: boolean;
}): Promise<FormPageConfigAdmin> {
  const db = getSupabaseAdmin();
  const normalizedSlug = input.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  let staff_password_hash: string | null = null;
  let staff_password_updated_at: string | null = null;
  if (input.staff_password && input.staff_password.length > 0) {
    staff_password_hash = await hashStaffPassword(input.staff_password);
    staff_password_updated_at = new Date().toISOString();
  }

  const { data, error } = await db
    .from('form_pages')
    .insert({
      name: input.name,
      slug: normalizedSlug,
      organization_id: input.organization_id,
      default_questionnaire_id: input.default_questionnaire_id,
      allowed_questionnaire_ids: input.allowed_questionnaire_ids ?? null,
      branding: { ...DEFAULT_BRANDING, ...input.branding },
      staff_password_hash,
      staff_password_updated_at,
      default_range_days: input.default_range_days ?? 60,
      max_range_days_cap: input.max_range_days_cap ?? 90,
      titles_per_page: input.titles_per_page ?? 25,
      is_active: input.is_active ?? true,
    })
    .select()
    .single();

  if (error) {
    console.error('[FormPagesConfig] create:', error);
    throw new Error(error.message);
  }
  return toAdminDtoFixed(data as FormPageConfig);
}

export async function updateFormPageConfig(
  slug: string,
  updates: Partial<Omit<FormPageConfig, 'staff_password_hash'>> & { staff_password?: string }
): Promise<FormPageConfigAdmin> {
  const db = getSupabaseAdmin();
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.slug !== undefined)
    updateData.slug = updates.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-');
  if (updates.is_active !== undefined) updateData.is_active = updates.is_active;
  if (updates.organization_id !== undefined) updateData.organization_id = updates.organization_id;
  if (updates.default_questionnaire_id !== undefined)
    updateData.default_questionnaire_id = updates.default_questionnaire_id;
  if (updates.allowed_questionnaire_ids !== undefined)
    updateData.allowed_questionnaire_ids = updates.allowed_questionnaire_ids;
  if (updates.branding !== undefined) updateData.branding = updates.branding;
  if (updates.default_range_days !== undefined) updateData.default_range_days = updates.default_range_days;
  if (updates.max_range_days_cap !== undefined) updateData.max_range_days_cap = updates.max_range_days_cap;
  if (updates.titles_per_page !== undefined) updateData.titles_per_page = updates.titles_per_page;

  if (updates.staff_password !== undefined) {
    if (updates.staff_password.length > 0) {
      updateData.staff_password_hash = await hashStaffPassword(updates.staff_password);
      updateData.staff_password_updated_at = new Date().toISOString();
    }
  }

  const { error: updateError } = await db.from('form_pages').update(updateData).eq('slug', slug);
  if (updateError) {
    console.error('[FormPagesConfig] update:', updateError);
    throw new Error(updateError.message);
  }

  const fetchSlug = (updateData.slug as string) || slug;
  const { data, error: fetchError } = await db.from('form_pages').select('*').eq('slug', fetchSlug).single();
  if (fetchError || !data) throw new Error(fetchError?.message || 'Not found after update');
  return toAdminDtoFixed(data as FormPageConfig);
}

export async function deleteFormPageConfig(slug: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('form_pages').delete().eq('slug', slug);
  if (error) {
    console.error('[FormPagesConfig] delete:', error);
    return false;
  }
  return true;
}

/** Validate questionnaire id is allowed for this org page config */
export function isQuestionnaireAllowed(config: FormPageConfig, questionnaireId: number): boolean {
  const allowed = config.allowed_questionnaire_ids;
  if (!allowed || allowed.length === 0) return true;
  return allowed.includes(questionnaireId);
}
