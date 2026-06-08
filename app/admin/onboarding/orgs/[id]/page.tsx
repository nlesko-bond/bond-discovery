import { notFound } from 'next/navigation';
import { OnboardingLinkCard } from '@/app/admin/onboarding/components/OnboardingLinkCard';
import type { Org, TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';
import {
  OrgActivitySection,
  OrgDetailLiveProvider,
  OrgDetailTitleRow,
  OrgProgressSection,
} from './OrgDetailLive';
import { DeleteOrgButton } from './DeleteOrgButton';
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
  const baseTrim = baseUrl.replace(/\/$/, '');
  const onboardUrl = `${baseTrim}/onboard/${org.slug}`;
  const oo = org as Org;

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
            <p className="text-xs font-medium uppercase text-gray-500">Bond organization ID</p>
            <p className="mt-1 font-mono text-gray-900">{oo.bond_organization_id ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Facility IDs</p>
            <p className="mt-1 font-mono text-sm text-gray-900">
              {oo.facility_ids?.length ? oo.facility_ids.join(', ') : '—'}
            </p>
          </div>
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
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">POS devices requested</p>
            {oo.pos_devices_requested != null ? (
              <>
                <p className="mt-1 text-gray-900">
                  {oo.pos_devices_requested} device{oo.pos_devices_requested === 1 ? '' : 's'}
                </p>
                {oo.pos_devices_requested_at ? (
                  <p className="text-xs text-gray-500">
                    Saved{' '}
                    <time dateTime={oo.pos_devices_requested_at}>
                      {new Date(oo.pos_devices_requested_at).toLocaleString()}
                    </time>
                  </p>
                ) : null}
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-600">Not entered on the onboarding checklist yet.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Current planned launch</p>
            <p className="mt-1 text-gray-900">{oo.expected_launch_date ?? '—'}</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Actual launch</p>
            <p className="mt-1 text-gray-900">{oo.actual_launch_date ?? '—'}</p>
            <p className="mt-2 text-xs text-gray-500">Editable in Organization settings.</p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Onboarding started</p>
            <p className="mt-1 text-gray-900">
              {oo.onboarding_started_at ? (
                <time dateTime={oo.onboarding_started_at}>
                  {new Date(oo.onboarding_started_at).toLocaleString()}
                </time>
              ) : (
                '—'
              )}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Onboarding completed</p>
            <p className="mt-1 text-gray-900">
              {oo.completed_at ? (
                <time dateTime={oo.completed_at}>{new Date(oo.completed_at).toLocaleString()}</time>
              ) : (
                '—'
              )}
            </p>
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Upcoming programs CSV</p>
            {oo.programs_uploaded_at ? (
              <>
                <p className="mt-1 text-sm text-gray-900">{oo.programs_upload_original_filename ?? 'uploaded CSV'}</p>
                <p className="text-xs text-gray-500">
                  Last upload{' '}
                  <time dateTime={oo.programs_uploaded_at}>
                    {new Date(oo.programs_uploaded_at).toLocaleString()}
                  </time>
                </p>
                <a
                  href={`${baseTrim}/api/admin/onboarding/orgs/${org.id}/programs-file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-blue-700 hover:underline"
                >
                  Open secure download link
                </a>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-600">Waiting for CSV from the onboarding checklist.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Accounting codes CSV</p>
            {oo.gl_codes_uploaded_at ? (
              <>
                <p className="mt-1 text-sm text-gray-900">{oo.gl_codes_upload_original_filename ?? 'uploaded CSV'}</p>
                <p className="text-xs text-gray-500">
                  Last upload{' '}
                  <time dateTime={oo.gl_codes_uploaded_at}>
                    {new Date(oo.gl_codes_uploaded_at).toLocaleString()}
                  </time>
                </p>
                <a
                  href={`${baseTrim}/api/admin/onboarding/orgs/${org.id}/gl-codes-file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-blue-700 hover:underline"
                >
                  Open secure download link
                </a>
              </>
            ) : (
              <p className="mt-1 text-sm text-gray-600">Waiting for CSV from the onboarding checklist.</p>
            )}
          </div>
          <div>
            <p className="text-xs font-medium uppercase text-gray-500">Rentable spaces CSV</p>
            {oo.spaces_uploaded_at ? (
              <>
                <p className="mt-1 text-sm text-gray-900">{oo.spaces_upload_original_filename ?? 'uploaded CSV'}</p>
                <p className="text-xs text-gray-500">
                  Last upload{' '}
                  <time dateTime={oo.spaces_uploaded_at}>
                    {new Date(oo.spaces_uploaded_at).toLocaleString()}
                  </time>
                </p>
                <a
                  href={`${baseTrim}/api/admin/onboarding/orgs/${org.id}/spaces-file`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex text-sm font-medium text-blue-700 hover:underline"
                >
                  Open secure download link
                </a>
              </>
            ) : (
              <>
                <p className="mt-1 text-sm text-gray-600">Waiting for CSV from the onboarding checklist.</p>
                <p className="mt-1 text-xs text-gray-500">
                  Files live in Supabase Storage bucket <span className="font-mono">onboarding-uploads</span>.
                </p>
              </>
            )}
          </div>
        </div>

        <OrgProgressSection steps={steps} />

        <div>
          <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
          <div className="mt-3">
            <OrgActions orgId={org.id} currentStatus={org.status} />
          </div>
        </div>

        <div className="rounded-lg border border-red-200 bg-red-50/50 p-4">
          <h2 className="text-sm font-semibold text-red-900">Danger zone</h2>
          <p className="mt-1 text-sm text-red-800/90">
            Permanently remove this organization and all related onboarding data (checklist progress,
            uploads, and captured answers). Use <strong>New org</strong> afterward to start the same
            customer fresh. There is no undo.
          </p>
          <div className="mt-3">
            <DeleteOrgButton orgId={org.id} orgName={org.name} />
          </div>
        </div>

        <OrgActivitySection steps={steps} />
      </OrgDetailLiveProvider>
    </div>
  );
}
