'use client';

import Link from 'next/link';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react';
import { ONBOARDING_BASE } from '@/lib/onboarding/paths';
import type { ActivityLogEntry, StepProgress, TemplateStep } from '@/lib/onboarding/types';
import { getOnboardingBrowserClient } from '@/lib/onboarding/supabase-browser';

type LiveCtx = {
  progress: StepProgress[];
  status: string;
  activity: ActivityLogEntry[];
};

const OrgDetailLiveContext = createContext<LiveCtx | null>(null);

export function useOrgDetailLive(): LiveCtx {
  const v = useContext(OrgDetailLiveContext);
  if (!v) throw new Error('useOrgDetailLive must be used within OrgDetailLiveProvider');
  return v;
}

/** For OrgActions when wrapped in provider — falls back to prop when absent */
export function useOptionalOrgDetailLive(): LiveCtx | null {
  return useContext(OrgDetailLiveContext);
}

export function OrgDetailLiveProvider({
  orgId,
  initialProgress,
  initialStatus,
  initialActivity,
  children,
}: {
  orgId: string;
  initialProgress: StepProgress[];
  initialStatus: string;
  initialActivity: ActivityLogEntry[];
  children: ReactNode;
}) {
  const [progress, setProgress] = useState(initialProgress);
  const [status, setStatus] = useState(initialStatus);
  const [activity, setActivity] = useState(initialActivity);

  const loadAll = useCallback(async () => {
    const supabase = getOnboardingBrowserClient();
    const [prog, orgRow, act] = await Promise.all([
      supabase.from('step_progress').select('*').eq('org_id', orgId).order('step_index'),
      supabase.from('orgs').select('status').eq('id', orgId).maybeSingle(),
      supabase
        .from('activity_log')
        .select('*')
        .eq('org_id', orgId)
        .order('created_at', { ascending: false })
        .limit(50),
    ]);
    if (prog.data) setProgress(prog.data as StepProgress[]);
    if (orgRow.data?.status) setStatus(orgRow.data.status);
    if (act.data) setActivity(act.data as ActivityLogEntry[]);
  }, [orgId]);

  useEffect(() => {
    void loadAll();
  }, [loadAll]);

  useEffect(() => {
    const supabase = getOnboardingBrowserClient();
    const run = () => void loadAll();
    const channel = supabase
      .channel(`org_detail_sync:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'step_progress',
          filter: `org_id=eq.${orgId}`,
        },
        run,
      )
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'orgs',
          filter: `id=eq.${orgId}`,
        },
        run,
      )
      .subscribe();

    const interval = window.setInterval(() => {
      if (document.visibilityState === 'visible') void loadAll();
    }, 5000);

    return () => {
      window.clearInterval(interval);
      void supabase.removeChannel(channel);
    };
  }, [orgId, loadAll]);

  const value = useMemo(() => ({ progress, status, activity }), [progress, status, activity]);

  return <OrgDetailLiveContext.Provider value={value}>{children}</OrgDetailLiveContext.Provider>;
}

function statusBadgeClass(status: string): string {
  const colors: Record<string, string> = {
    active: 'bg-green-100 text-green-800',
    completed: 'bg-blue-100 text-blue-800',
    paused: 'bg-amber-100 text-amber-900',
    archived: 'bg-gray-100 text-gray-600',
  };
  return colors[status] ?? 'bg-gray-100 text-gray-700';
}

export function OrgDetailTitleRow({
  orgName,
  slug,
  orgId,
}: {
  orgName: string;
  slug: string;
  orgId: string;
}) {
  const { status } = useOrgDetailLive();

  return (
    <div className="flex flex-wrap items-start justify-between gap-4">
      <div>
        <Link href={`${ONBOARDING_BASE}/orgs`} className="text-sm text-primary hover:underline">
          ← Organizations
        </Link>
        <h1 className="mt-2 text-2xl font-semibold text-gray-900">{orgName}</h1>
        <p className="mt-1 text-sm text-gray-600">
          Slug: <code className="font-mono text-xs">{slug}</code>
        </p>
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <span
          className={`rounded-full px-2 py-0.5 text-xs font-medium capitalize ${statusBadgeClass(status)}`}
        >
          {status}
        </span>
        <Link
          href={`${ONBOARDING_BASE}/orgs/${orgId}/settings`}
          className="rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-900"
        >
          Settings
        </Link>
      </div>
    </div>
  );
}

export function OrgProgressSection({ steps }: { steps: TemplateStep[] }) {
  const { progress } = useOrgDetailLive();

  const requiredIndices = steps.map((s, i) => (!s.optional ? i : -1)).filter((i) => i >= 0);
  const requiredDone = requiredIndices.filter((i) =>
    progress.find((p) => p.step_index === i && p.completed),
  ).length;
  const pct =
    requiredIndices.length === 0 ? 100 : Math.round((requiredDone / requiredIndices.length) * 100);

  return (
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
          const p = progress.find((x) => x.step_index === idx);
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
  );
}

export function OrgActivitySection({ steps }: { steps: TemplateStep[] }) {
  const { activity } = useOrgDetailLive();

  return (
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
  );
}
