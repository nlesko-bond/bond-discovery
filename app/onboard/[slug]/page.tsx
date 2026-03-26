import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { OnboardingChecklist } from './components/OnboardingChecklist';
import { PinGate } from './components/PinGate';

type Props = { params: Promise<{ slug: string }> };

export default async function OnboardSlugPage({ params }: Props) {
  const { slug } = await params;
  const admin = getSupabaseAdmin();

  const { data: org, error: orgError } = await admin
    .from('orgs')
    .select('*')
    .eq('slug', slug)
    .maybeSingle();

  if (orgError || !org) {
    notFound();
  }

  if (org.template_id == null) {
    notFound();
  }

  const { data: template, error: templateError } = await admin
    .from('templates')
    .select('*')
    .eq('id', org.template_id)
    .single();

  if (templateError || !template) {
    notFound();
  }

  const { data: progressRows } = await admin
    .from('step_progress')
    .select('*')
    .eq('org_id', org.id)
    .order('step_index');

  const cookieStore = await cookies();
  const pinCookie = cookieStore.get(`bond_pin_${slug}`)?.value;
  const pinOk = !org.pin || pinCookie === org.id;

  if (!pinOk) {
    return <PinGate slug={slug} />;
  }

  const steps = template.steps as TemplateStep[];

  const logoUrl = (org as { logo_url?: string | null }).logo_url ?? null;

  return (
    <OnboardingChecklist
      orgId={org.id}
      orgName={org.name}
      logoUrl={logoUrl}
      steps={steps}
      initialProgress={progressRows ?? []}
    />
  );
}
