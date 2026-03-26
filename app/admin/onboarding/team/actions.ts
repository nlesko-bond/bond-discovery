'use server';

import { revalidatePath } from 'next/cache';
import { redirect } from 'next/navigation';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import { getSupabaseAdmin } from '@/lib/supabase';

function err(msg: string): never {
  redirect(`${ONBOARDING_BASE}/team?error=${encodeURIComponent(msg)}`);
}

export async function addStaff(formData: FormData): Promise<void> {
  const admin = getSupabaseAdmin();
  const name = String(formData.get('name') ?? '').trim();
  const email = String(formData.get('email') ?? '')
    .trim()
    .toLowerCase();
  const role = String(formData.get('role') ?? 'cs_rep') as 'admin' | 'cs_rep';
  const slackMemberId = String(formData.get('slack_member_id') ?? '').trim() || null;

  if (!name || !email) {
    err('Name and email are required.');
  }

  const { error } = await admin.from('staff').insert({
    name,
    email,
    role: role === 'admin' ? 'admin' : 'cs_rep',
    notify_email: true,
    slack_member_id: slackMemberId,
  });

  if (error) {
    err(error.message);
  }

  revalidatePath(`${ONBOARDING_BASE}/team`);
  redirect(`${ONBOARDING_BASE}/team`);
}

export async function updateStaffSlackMemberId(staffId: string, formData: FormData): Promise<void> {
  const admin = getSupabaseAdmin();
  const raw = String(formData.get('slack_member_id') ?? '').trim();
  const slack_member_id = raw || null;
  const { error } = await admin.from('staff').update({ slack_member_id }).eq('id', staffId);
  if (error) err(error.message);
  revalidatePath(`${ONBOARDING_BASE}/team`);
}

export async function updateStaffNotify(staffId: string, notifyEmail: boolean): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('staff').update({ notify_email: notifyEmail }).eq('id', staffId);
  if (error) err(error.message);
  revalidatePath(`${ONBOARDING_BASE}/team`);
}

export async function deleteStaff(staffId: string): Promise<void> {
  const admin = getSupabaseAdmin();
  const { error } = await admin.from('staff').delete().eq('id', staffId);
  if (error) err(error.message);
  revalidatePath(`${ONBOARDING_BASE}/team`);
  redirect(`${ONBOARDING_BASE}/team`);
}
