'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import slugify from 'slugify';
import { authOptions } from '@/lib/auth';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import { pushKeyDatesSnapshotSafe } from '@/lib/onboarding/key-dates-webhook';
import {
  parseBondOrganizationId,
  parseFacilityIdsList,
} from '@/lib/onboarding/parse-org-ids';
import { parseOptionalIsoDate } from '@/lib/onboarding/parse-iso-date';
import { purgeOrgOnboardingStorage } from '@/lib/onboarding/purge-org-storage';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

async function assertUniqueBondOrganizationId(
  admin: ReturnType<typeof getSupabaseAdmin>,
  bondOrganizationId: number,
  excludeOrgId?: string,
): Promise<string | null> {
  let query = admin.from('orgs').select('id').eq('bond_organization_id', bondOrganizationId);
  if (excludeOrgId) {
    query = query.neq('id', excludeOrgId);
  }
  const { data } = await query.maybeSingle();
  if (data) {
    return `Bond organization ID ${bondOrganizationId} is already linked to another onboarding org.`;
  }
  return null;
}

async function uniqueSlug(base: string): Promise<string> {
  const admin = getSupabaseAdmin();
  let slug = base;
  for (let i = 0; i < 20; i++) {
    const { data } = await admin.from('orgs').select('id').eq('slug', slug).maybeSingle();
    if (!data) return slug;
    slug = `${base}-${Math.random().toString(36).slice(2, 6)}`;
  }
  return `${base}-${Date.now()}`;
}

function errRedirect(msg: string): never {
  redirect(`${ONBOARDING_BASE}/orgs/new?error=${encodeURIComponent(msg)}`);
}

export async function createOrg(formData: FormData): Promise<void> {
  const admin = getSupabaseAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const slugInput = String(formData.get('slug') ?? '').trim();
  const bondOrganizationIdRaw = String(formData.get('bond_organization_id') ?? '').trim();
  const facilityIdsRaw = String(formData.get('facility_ids') ?? '').trim();
  const launchDateRaw = String(formData.get('expected_launch_date') ?? '').trim();
  const contactName = String(formData.get('contact_name') ?? '').trim() || null;
  const contactEmail = String(formData.get('contact_email') ?? '').trim() || null;
  const templateId = String(formData.get('template_id') ?? '');
  let assignedRep = String(formData.get('assigned_rep') ?? '').trim();
  const pinRaw = String(formData.get('pin') ?? '').trim();

  if (!name) {
    errRedirect('Organization name is required.');
  }

  const bondOrganizationId = parseBondOrganizationId(bondOrganizationIdRaw);
  if (bondOrganizationId === null) {
    errRedirect('Bond organization ID is required and must be a positive number.');
  }

  const duplicateBondOrgError = await assertUniqueBondOrganizationId(admin, bondOrganizationId);
  if (duplicateBondOrgError) {
    errRedirect(duplicateBondOrgError);
  }

  const launchDateResult = parseOptionalIsoDate(launchDateRaw);
  if (launchDateResult.error) {
    errRedirect(launchDateResult.error);
  }

  if (!templateId) {
    errRedirect('Template is required.');
  }

  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email;

  if (!assignedRep && userEmail) {
    const { data: me } = await admin.from('staff').select('id').eq('email', userEmail).maybeSingle();
    if (me) assignedRep = me.id;
  }

  const baseSlug = slugInput || slugify(name, { lower: true, strict: true });
  const slug = await uniqueSlug(baseSlug);
  const facilityIds = parseFacilityIdsList(facilityIdsRaw);

  const { data: org, error: orgError } = await admin
    .from('orgs')
    .insert({
      name,
      slug,
      bond_organization_id: bondOrganizationId,
      facility_ids: facilityIds,
      expected_launch_date: launchDateResult.value,
      contact_name: contactName,
      contact_email: contactEmail,
      template_id: templateId || null,
      assigned_rep: assignedRep || null,
      pin: pinRaw || null,
      status: 'active',
    })
    .select('id')
    .single();

  if (orgError || !org) {
    errRedirect(orgError?.message ?? 'Could not create org.');
  }

  const { data: template } = await admin.from('templates').select('steps').eq('id', templateId).single();

  const steps = (template?.steps as TemplateStep[] | undefined) ?? [];
  const progressRows = steps.map((_, stepIndex) => ({
    org_id: org.id,
    step_index: stepIndex,
    completed: false,
  }));

  if (progressRows.length > 0) {
    const { error: progError } = await admin.from('step_progress').insert(progressRows);
    if (progError) {
      await admin.from('orgs').delete().eq('id', org.id);
      errRedirect(progError.message);
    }
  }

  await admin.from('activity_log').insert({
    org_id: org.id,
    action: 'org_created',
    actor: userEmail ?? 'staff',
  });

  await pushKeyDatesSnapshotSafe(org.id);

  revalidatePath(`${ONBOARDING_BASE}/orgs`);
  revalidatePath(`${ONBOARDING_BASE}/dashboard`);

  redirect(`${ONBOARDING_BASE}/orgs/${org.id}?new=1`);
}

export async function updateOrg(
  orgId: string,
  formData: FormData,
): Promise<{ success: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const slug = String(formData.get('slug') ?? '').trim();
  const bondOrganizationIdRaw = String(formData.get('bond_organization_id') ?? '').trim();
  const facilityIdsRaw = String(formData.get('facility_ids') ?? '').trim();
  const contactName = String(formData.get('contact_name') ?? '').trim() || null;
  const contactEmail = String(formData.get('contact_email') ?? '').trim() || null;
  const templateId = String(formData.get('template_id') ?? '');
  const assignedRep = String(formData.get('assigned_rep') ?? '');
  const pinRaw = String(formData.get('pin') ?? '').trim();
  const status = String(formData.get('status') ?? 'active');
  const logoUrlRaw = String(formData.get('logo_url') ?? '').trim();
  const launchDateRaw = String(formData.get('expected_launch_date') ?? '').trim();
  const actualLaunchDateRaw = String(formData.get('actual_launch_date') ?? '').trim();

  if (!name || !slug) {
    return { success: false, error: 'Name and slug are required.' };
  }

  const bondOrganizationId = parseBondOrganizationId(bondOrganizationIdRaw);
  if (bondOrganizationId === null) {
    return { success: false, error: 'Bond organization ID is required and must be a positive number.' };
  }

  const duplicateBondOrgError = await assertUniqueBondOrganizationId(admin, bondOrganizationId, orgId);
  if (duplicateBondOrgError) {
    return { success: false, error: duplicateBondOrgError };
  }

  const launchDateResult = parseOptionalIsoDate(launchDateRaw);
  if (launchDateResult.error) {
    return { success: false, error: launchDateResult.error };
  }

  const actualLaunchDateResult = parseOptionalIsoDate(actualLaunchDateRaw);
  if (actualLaunchDateResult.error) {
    return { success: false, error: actualLaunchDateResult.error };
  }

  let logo_url: string | null = null;
  if (logoUrlRaw) {
    let parsed: URL;
    try {
      parsed = new URL(logoUrlRaw);
    } catch {
      return { success: false, error: 'Logo URL must be a valid URL.' };
    }
    if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
      return { success: false, error: 'Logo URL must use http:// or https://' };
    }
    logo_url = parsed.toString();
  }

  const { data: existing } = await admin
    .from('orgs')
    .select('pin, slug')
    .eq('id', orgId)
    .single();

  const pin = pinRaw === '' ? existing?.pin ?? null : pinRaw;
  const facilityIds = parseFacilityIdsList(facilityIdsRaw);

  const { error } = await admin
    .from('orgs')
    .update({
      name,
      slug,
      bond_organization_id: bondOrganizationId,
      facility_ids: facilityIds,
      contact_name: contactName,
      contact_email: contactEmail,
      template_id: templateId || null,
      assigned_rep: assignedRep || null,
      pin,
      status,
      logo_url,
      expected_launch_date: launchDateResult.value,
      actual_launch_date: actualLaunchDateResult.value,
    })
    .eq('id', orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  await pushKeyDatesSnapshotSafe(orgId);

  revalidatePath(`${ONBOARDING_BASE}/orgs/${orgId}`);
  revalidatePath(`${ONBOARDING_BASE}/orgs`);
  revalidatePath(`${ONBOARDING_BASE}/dashboard`);
  if (existing?.slug) {
    revalidatePath(`/onboard/${existing.slug}`);
  }
  if (slug !== existing?.slug) {
    revalidatePath(`/onboard/${slug}`);
  }

  return { success: true };
}

export async function saveOrgSettings(orgId: string, formData: FormData): Promise<void> {
  const result = await updateOrg(orgId, formData);
  if (!result.success) {
    redirect(
      `${ONBOARDING_BASE}/orgs/${orgId}/settings?error=${encodeURIComponent(result.error ?? 'Save failed')}`,
    );
  }
  redirect(`${ONBOARDING_BASE}/orgs/${orgId}`);
}

export async function setOrgStatus(
  orgId: string,
  status: 'active' | 'completed' | 'paused' | 'archived',
): Promise<{ success: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('orgs').update({ status }).eq('id', orgId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`${ONBOARDING_BASE}/orgs/${orgId}`);
  revalidatePath(`${ONBOARDING_BASE}/orgs`);
  revalidatePath(`${ONBOARDING_BASE}/dashboard`);
  return { success: true };
}

export async function deleteOrg(
  orgId: string,
): Promise<{ success: boolean; error?: string }> {
  const session = await getServerSession(authOptions);
  const userEmail = session?.user?.email?.trim();
  if (!userEmail) {
    return { success: false, error: 'You must be signed in to delete an organization.' };
  }

  const admin = getSupabaseAdmin();
  const { data: staff } = await admin.from('staff').select('id').eq('email', userEmail).maybeSingle();
  if (!staff) {
    return { success: false, error: 'Only Bond staff can delete onboarding organizations.' };
  }

  const { data: org } = await admin
    .from('orgs')
    .select(
      'slug, spaces_upload_storage_path, gl_codes_upload_storage_path, programs_upload_storage_path',
    )
    .eq('id', orgId)
    .maybeSingle();

  if (!org) {
    return { success: false, error: 'Organization not found.' };
  }

  await purgeOrgOnboardingStorage(orgId, {
    spaces_upload_storage_path: org.spaces_upload_storage_path,
    gl_codes_upload_storage_path: org.gl_codes_upload_storage_path,
    programs_upload_storage_path: org.programs_upload_storage_path,
  });

  const { error } = await admin.from('orgs').delete().eq('id', orgId);
  if (error) return { success: false, error: error.message };
  revalidatePath(`${ONBOARDING_BASE}/orgs`);
  revalidatePath(`${ONBOARDING_BASE}/dashboard`);
  if (org.slug) {
    revalidatePath(`/onboard/${org.slug}`);
  }
  return { success: true };
}
