import { notFound } from 'next/navigation';
import { OnboardingLinkCard } from '@/app/admin/onboarding/components/OnboardingLinkCard';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  OrgActivitySection,
  OrgDetailLiveProvider,
  OrgDetailTitleRow,
  OrgProgressSection,
} from './OrgDetailLive';
import { OrgActions } from './OrgActions';

export const dynamic = 'force-dynamic';

type Props = {
  params: Promise<{ id: string }>;
  searchParams: Promise<{ new?: string }>;
};

export default async function OnboardingOrgDetailPage({ params, searchParams }: Props) {
  const { id } = await params;
  const sp = await searchParams;
  const admin = getSupabaseAdmin();

  const { data: org, error: orgError } = await admin.from('orgs').select('*').eq('id', id).maybeSingle();

  if (orgError || !org) {
    notFound();
  }

  let rep: { name: string; email: string } | null = null;
  if (org.assigned_rep) {
    const { data } = await admin.from('staff').select('name, email').eq('id', org.assigned_rep).single();
    rep = data;
  }

  const { data: template } = await admin
    .from('templates')
    .select('steps')
    .eq('id', org.template_id ?? '')
    .maybeSingle();

  const steps = (template?.steps as TemplateStep[] | undefined) ?? [];

  const { data: progress } = await admin
    .from('step_progress')
    .select('*')
    .eq('org_id', org.id)
    .order('step_index');

  const { data: activity } = await admin
    .from('activity_log')
    .select('*')
    .eq('org_id', org.id)
    .order('created_at', { ascending: false })
    .limit(50);

  const baseUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  const onboardUrl = `${baseUrl.replace(/\/$/, '')}/onboard/${org.slug}`;

  return (
    <div className="space-y-8">
      {sp.new === '1' ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <strong>Organization created.</strong> Copy the link below and send it to your contact — they don’t need a
          Bond login.
        </div>
      ) : null}

      <OnboardingLinkCard url={onboardUrl} slug={org.slug} celebrate={sp.new === '1'} />

      <OrgDetailLiveProvider
        orgId={org.id}
        initialProgress={progress ?? []}
        initialStatus={org.status}
        initialActivity={activity ?? []}
      >
        <OrgDetailTitleRow orgName={org.name} slug={org.slug} orgId={org.id} />

        <div className="grid gap-4 rounded-lg border border-gray-200 bg-white p-5 shadow-sm sm:grid-cols-2">
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Assigned rep</p>
            <p className="mt-1 text-gray-900">{rep?.name ?? '—'}</p>
            <p className="text-sm text-gray-600">{rep?.email}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Contact</p>
            <p className="mt-1 text-gray-900">{org.contact_name ?? '—'}</p>
            <p className="text-sm text-gray-600">{org.contact_email ?? '—'}</p>
          </div>
        </div>

        <OrgProgressSection steps={steps} />

        <div>
          <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
          <div className="mt-3">
            <OrgActions orgId={org.id} currentStatus={org.status} />
          </div>
        </div>

        <OrgActivitySection steps={steps} />
      </OrgDetailLiveProvider>
    </div>
  );
}
