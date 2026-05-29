'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import {
  CANONICAL_ONBOARDING_TEMPLATE_META,
  CANONICAL_ONBOARDING_TEMPLATE_STEPS,
} from '@/lib/onboarding/default-onboarding-template';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

function err(msg: string): never {
  redirect(`${ONBOARDING_BASE}/templates?error=${encodeURIComponent(msg)}`);
}

export async function saveTemplate(formData: FormData): Promise<void> {
  const admin = getSupabaseAdmin();
  const id = String(formData.get('id') ?? '').trim();
  const name = String(formData.get('name') ?? '').trim();
  const raw = String(formData.get('steps_json') ?? '');
  const isDefault = formData.has('is_default');

  if (!name) {
    err('Template name is required.');
  }

  let steps: TemplateStep[];
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      err('Steps must be a JSON array.');
    }
    steps = parsed as TemplateStep[];
  } catch {
    err('Invalid JSON for steps.');
  }

  if (isDefault) {
    const { data: ids } = await admin.from('templates').select('id');
    for (const row of ids ?? []) {
      await admin.from('templates').update({ is_default: false }).eq('id', row.id);
    }
  }

  if (id) {
    const { error } = await admin
      .from('templates')
      .update({
        name,
        steps: steps as unknown as Record<string, unknown>,
        is_default: isDefault,
      })
      .eq('id', id);
    if (error) err(error.message);
  } else {
    const { error } = await admin.from('templates').insert({
      name,
      steps: steps as unknown as Record<string, unknown>,
      is_default: isDefault,
    });
    if (error) err(error.message);
  }

  revalidatePath(`${ONBOARDING_BASE}/templates`, 'page');
  revalidatePath(`${ONBOARDING_BASE}`, 'layout');
  redirect(`${ONBOARDING_BASE}/templates?saved=1`);
}

export async function deleteTemplate(templateId: string): Promise<void> {
  const admin = getSupabaseAdmin();

  const { data: template } = await admin
    .from('templates')
    .select('id, name, is_default')
    .eq('id', templateId)
    .maybeSingle();

  if (!template) {
    redirect(`${ONBOARDING_BASE}/templates?error=${encodeURIComponent('Template not found.')}`);
  }

  if (template.is_default) {
    redirect(
      `${ONBOARDING_BASE}/templates?error=${encodeURIComponent(
        'Cannot delete the default template. Set another template as default first.',
      )}`,
    );
  }

  const { count, error: countError } = await admin
    .from('orgs')
    .select('id', { count: 'exact', head: true })
    .eq('template_id', templateId);

  if (countError) {
    redirect(`${ONBOARDING_BASE}/templates?error=${encodeURIComponent(countError.message)}`);
  }

  if ((count ?? 0) > 0) {
    redirect(
      `${ONBOARDING_BASE}/templates?error=${encodeURIComponent(
        `Cannot delete "${template.name}" — ${count} organization(s) still use this template. Reassign them in Organization settings first.`,
      )}`,
    );
  }

  const { error } = await admin.from('templates').delete().eq('id', templateId);
  if (error) {
    redirect(`${ONBOARDING_BASE}/templates?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`${ONBOARDING_BASE}/templates`, 'page');
  revalidatePath(`${ONBOARDING_BASE}`, 'layout');
  redirect(`${ONBOARDING_BASE}/templates?deleted=1`);
}

export async function applyCanonicalTemplateSteps(templateId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { data: template } = await admin.from('templates').select('id').eq('id', templateId).maybeSingle();

  if (!template) {
    redirect(`${ONBOARDING_BASE}/templates?error=${encodeURIComponent('Template not found.')}`);
  }

  const { error } = await admin
    .from('templates')
    .update({
      steps: CANONICAL_ONBOARDING_TEMPLATE_STEPS as unknown as Record<string, unknown>,
      meta: CANONICAL_ONBOARDING_TEMPLATE_META as unknown as Record<string, unknown>,
    })
    .eq('id', templateId);

  if (error) {
    redirect(`${ONBOARDING_BASE}/templates?error=${encodeURIComponent(error.message)}`);
  }

  revalidatePath(`${ONBOARDING_BASE}/templates`, 'page');
  revalidatePath(`${ONBOARDING_BASE}`, 'layout');
  redirect(`${ONBOARDING_BASE}/templates?saved=1`);
}
