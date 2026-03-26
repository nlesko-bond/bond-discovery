'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { getServerSession } from 'next-auth';
import slugify from 'slugify';
import { authOptions } from '@/lib/auth';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

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
  const contactName = String(formData.get('contact_name') ?? '').trim() || null;
  const contactEmail = String(formData.get('contact_email') ?? '').trim() || null;
  const templateId = String(formData.get('template_id') ?? '');
  let assignedRep = String(formData.get('assigned_rep') ?? '').trim();
  const pinRaw = String(formData.get('pin') ?? '').trim();

  if (!name) {
    errRedirect('Organization name is required.');
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

  const { data: org, error: orgError } = await admin
    .from('orgs')
    .insert({
      name,
      slug,
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
  const contactName = String(formData.get('contact_name') ?? '').trim() || null;
  const contactEmail = String(formData.get('contact_email') ?? '').trim() || null;
  const templateId = String(formData.get('template_id') ?? '');
  const assignedRep = String(formData.get('assigned_rep') ?? '');
  const pinRaw = String(formData.get('pin') ?? '').trim();
  const status = String(formData.get('status') ?? 'active');

  if (!name || !slug) {
    return { success: false, error: 'Name and slug are required.' };
  }

  const { data: existing } = await admin.from('orgs').select('pin').eq('id', orgId).single();

  const pin = pinRaw === '' ? existing?.pin ?? null : pinRaw;

  const { error } = await admin
    .from('orgs')
    .update({
      name,
      slug,
      contact_name: contactName,
      contact_email: contactEmail,
      template_id: templateId || null,
      assigned_rep: assignedRep || null,
      pin,
      status,
    })
    .eq('id', orgId);

  if (error) {
    return { success: false, error: error.message };
  }

  revalidatePath(`${ONBOARDING_BASE}/orgs/${orgId}`);
  revalidatePath(`${ONBOARDING_BASE}/orgs`);
  revalidatePath(`${ONBOARDING_BASE}/dashboard`);

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
  return { success: true };
}
