'use server';

import { revalidatePath } from 'next/cache';
import { cookies } from 'next/headers';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';

export async function toggleStep(
  orgId: string,
  stepIndex: number,
  completed: boolean,
  completedBy?: string | null,
) {
  const admin = getSupabaseAdmin();
  const now = completed ? new Date().toISOString() : null;

  const { error } = await admin.from('step_progress').upsert(
    {
      org_id: orgId,
      step_index: stepIndex,
      completed,
      completed_at: now,
      completed_by: completed ? completedBy ?? 'org' : null,
    },
    { onConflict: 'org_id,step_index' },
  );

  if (error) throw new Error(error.message);

  await admin.from('activity_log').insert({
    org_id: orgId,
    action: completed ? 'step_completed' : 'step_unchecked',
    step_index: stepIndex,
    actor: completed ? completedBy ?? 'org' : 'org',
  });

  const { data: orgRow } = await admin
    .from('orgs')
    .select('template_id, status, slug')
    .eq('id', orgId)
    .single();

  const { data: templateRow } = await admin
    .from('templates')
    .select('steps')
    .eq('id', orgRow?.template_id ?? '')
    .maybeSingle();

  const steps = (templateRow?.steps as TemplateStep[] | undefined) ?? [];

  const { data: progress } = await admin
    .from('step_progress')
    .select('step_index, completed')
    .eq('org_id', orgId);

  const byIndex = new Map((progress ?? []).map((p) => [p.step_index, p.completed]));

  const requiredComplete =
    steps.length > 0 &&
    steps.every((step, idx) => {
      if (step.optional) return true;
      return Boolean(byIndex.get(idx));
    });

  if (requiredComplete) {
    await admin
      .from('orgs')
      .update({
        status: 'completed',
        completed_at: new Date().toISOString(),
      })
      .eq('id', orgId);
  } else if (orgRow?.status === 'completed') {
    await admin
      .from('orgs')
      .update({
        status: 'active',
        completed_at: null,
      })
      .eq('id', orgId);
  }

  revalidatePath(`${ONBOARDING_BASE}/dashboard`);
  revalidatePath(`${ONBOARDING_BASE}/orgs`);
  revalidatePath(`${ONBOARDING_BASE}/orgs/${orgId}`);
  if (orgRow?.slug) {
    revalidatePath(`/onboard/${orgRow.slug}`);
  }

  return { success: true as const, allRequiredDone: requiredComplete };
}

export async function verifyOrgPin(
  slug: string,
  pin: string,
): Promise<{ success: boolean; error?: string }> {
  const admin = getSupabaseAdmin();
  const { data: org, error } = await admin
    .from('orgs')
    .select('id, pin')
    .eq('slug', slug)
    .single();

  if (error || !org) {
    return { success: false, error: 'Organization not found.' };
  }

  if (!org.pin) {
    return { success: true };
  }

  if (org.pin !== pin.trim()) {
    return { success: false, error: 'Incorrect PIN.' };
  }

  const cookieStore = await cookies();
  cookieStore.set(`bond_pin_${slug}`, org.id, {
    httpOnly: true,
    sameSite: 'lax',
    secure: process.env.NODE_ENV === 'production',
    path: '/',
    maxAge: 60 * 60 * 24 * 30,
  });

  return { success: true };
}
