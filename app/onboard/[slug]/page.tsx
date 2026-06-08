import { cookies } from 'next/headers';
import { notFound } from 'next/navigation';
import type { Org, TemplateMeta, TemplateStep } from '@/lib/onboarding/types';
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
  const templateMetaRaw = template.meta as TemplateMeta | undefined | null;
  const kickoffDividerAfterStepIndex =
    typeof templateMetaRaw?.kickoffDividerAfterStepIndex === 'number'
      ? templateMetaRaw.kickoffDividerAfterStepIndex
      : null;

  const o = org as Org;

  return (
    <OnboardingChecklist
      orgId={org.id}
      slug={org.slug}
      orgName={org.name}
      logoUrl={o.logo_url ?? null}
      steps={steps}
      initialProgress={progressRows ?? []}
      kickoffDividerAfterStepIndex={kickoffDividerAfterStepIndex}
      spacesUploadedAt={o.spaces_uploaded_at ?? null}
      spacesUploadOriginalFilename={o.spaces_upload_original_filename ?? null}
      glCodesUploadedAt={o.gl_codes_uploaded_at ?? null}
      glCodesUploadOriginalFilename={o.gl_codes_upload_original_filename ?? null}
      programsUploadedAt={o.programs_uploaded_at ?? null}
      programsUploadOriginalFilename={o.programs_upload_original_filename ?? null}
      posDevicesRequested={o.pos_devices_requested ?? null}
      posDevicesRequestedAt={o.pos_devices_requested_at ?? null}
    />
  );
}
