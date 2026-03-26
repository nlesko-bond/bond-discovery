'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
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
  const { error } = await admin.from('templates').delete().eq('id', templateId);
  if (error) {
    redirect(`${ONBOARDING_BASE}/templates?error=${encodeURIComponent(error.message)}`);
  }
  revalidatePath(`${ONBOARDING_BASE}/templates`, 'page');
  revalidatePath(`${ONBOARDING_BASE}`, 'layout');
  redirect(`${ONBOARDING_BASE}/templates?deleted=1`);
}
