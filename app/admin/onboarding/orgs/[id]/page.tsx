import Link from 'next/link';
import { notFound } from 'next/navigation';
import { OnboardingLinkCard } from '@/app/admin/onboarding/components/OnboardingLinkCard';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { TemplateStep } from '@/lib/onboarding/types';
import { getSupabaseAdmin } from '@/lib/supabase';
import { OrgActions } from './OrgActions';
import { OrgRealtimeRefresh } from './OrgRealtimeRefresh';

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

  const requiredIndices = steps.map((s, i) => (!s.optional ? i : -1)).filter((i) => i >= 0);
  const requiredDone = requiredIndices.filter((i) =>
    progress?.find((p) => p.step_index === i && p.completed),
  ).length;
  const pct =
    requiredIndices.length === 0 ? 100 : Math.round((requiredDone / requiredIndices.length) * 100);

  return (
    <div className="space-y-8">
      <OrgRealtimeRefresh orgId={org.id} />

      {sp.new === '1' ? (
        <div className="rounded-lg border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          <strong>Organization created.</strong> Copy the link below and send it to your contact — they don’t need a
          Bond login.
        </div>
      ) : null}

      <OnboardingLinkCard url={onboardUrl} slug={org.slug} celebrate={sp.new === '1'} />

      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <Link href={`${ONBOARDING_BASE}/orgs`} className="text-sm text-primary hover:underline">
            ← Organizations
          </Link>
          <h1 className="mt-2 text-2xl font-semibold text-gray-900">{org.name}</h1>
          <p className="mt-1 text-sm text-gray-600">
            Slug: <code className="font-mono text-xs">{org.slug}</code>
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${
              org.status === 'active' ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-700'
            }`}
          >
            {org.status}
          </span>
          <Link
            href={`${ONBOARDING_BASE}/orgs/${org.id}/settings`}
            className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
          >
            Settings
          </Link>
        </div>
      </div>

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

      <div>
        <h2 className="text-lg font-semibold text-gray-900">Progress</h2>
        <div className="mt-3 h-4 w-full max-w-md overflow-hidden rounded-full bg-gray-200">
          <div className="h-full rounded-full bg-green-500 transition-[width]" style={{ width: `${pct}%` }} />
        </div>
        <p className="mt-2 text-sm text-gray-600">
          {requiredDone} of {requiredIndices.length} required steps complete
        </p>
        <ul className="mt-4 space-y-2">
          {steps.map((step, idx) => {
            const p = progress?.find((x) => x.step_index === idx);
            return (
              <li
                key={idx}
                className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm"
              >
                <span className={p?.completed ? 'text-green-700' : 'text-gray-900'}>
                  {step.optional ? '(Optional) ' : ''}
                  {step.title}
                </span>
                <span className="text-gray-600">
                  {p?.completed
                    ? `Done ${p.completed_at ? new Date(p.completed_at).toLocaleString() : ''} (${p.completed_by ?? 'org'})`
                    : 'Not done'}
                </span>
              </li>
            );
          })}
        </ul>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900">Actions</h2>
        <div className="mt-3">
          <OrgActions orgId={org.id} currentStatus={org.status} />
        </div>
      </div>

      <div>
        <h2 className="text-lg font-semibold text-gray-900">Activity</h2>
        <ul className="mt-3 space-y-2">
          {(activity ?? []).map((a) => (
            <li
              key={a.id}
              className="flex flex-wrap gap-2 rounded-lg border border-gray-200 bg-white px-3 py-2 text-sm shadow-sm"
            >
              <span className="text-gray-600">{new Date(a.created_at).toLocaleString()}</span>
              <span className="text-gray-900">
                {a.action}
                {a.step_index != null
                  ? ` (${steps[a.step_index]?.title ?? `Step ${a.step_index + 1}`})`
                  : ''}
                {a.actor ? ` — ${a.actor}` : ''}
              </span>
            </li>
          ))}
        </ul>
      </div>
    </div>
  );
}
