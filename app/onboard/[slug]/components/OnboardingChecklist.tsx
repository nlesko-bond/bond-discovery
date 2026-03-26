'use client';

import { useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import type { StepProgress, TemplateStep } from '@/lib/onboarding/types';
import { fireOnboardingConfetti, getStepEncouragement } from '@/lib/onboarding/encouragements';
import { getOnboardingBrowserClient } from '@/lib/onboarding/supabase-browser';
import { toggleStep } from '../actions';

const GOALS = [
  'Payments and banking are connected so you can collect revenue.',
  'Staff roles reflect who does what in your facility.',
  'Taxes and accounting codes are configured before products go live.',
  'Rentals and bookable inventory are set up for customers.',
  'Programs and registrations are ready for classes and leagues.',
  'Forms and waivers protect your organization and participants.',
];

type Props = {
  orgId: string;
  orgName: string;
  steps: TemplateStep[];
  initialProgress: StepProgress[];
};

function CheckIcon() {
  return (
    <svg
      width="14"
      height="14"
      viewBox="0 0 14 14"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden
    >
      <path
        d="M11.5 3.5L5.25 9.75L2.5 7"
        stroke="white"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}

export function OnboardingChecklist({
  orgId,
  orgName,
  steps,
  initialProgress,
}: Props) {
  const byIndex = useMemo(() => {
    const m = new Map<number, StepProgress>();
    initialProgress.forEach((p) => m.set(p.step_index, p));
    for (let i = 0; i < steps.length; i++) {
      if (!m.has(i)) {
        m.set(i, {
          id: '',
          org_id: orgId,
          step_index: i,
          completed: false,
          completed_at: null,
          completed_by: null,
          notes: null,
        });
      }
    }
    return m;
  }, [initialProgress, steps, orgId]);

  const [progressMap, setProgressMap] = useState<Map<number, StepProgress>>(() => byIndex);
  const [expanded, setExpanded] = useState<Set<number>>(() => {
    const firstIncomplete = steps.findIndex((_, i) => !byIndex.get(i)?.completed);
    return new Set([firstIncomplete >= 0 ? firstIncomplete : 0]);
  });
  const [pending, startTransition] = useTransition();
  const [encouragement, setEncouragement] = useState<string | null>(null);

  useEffect(() => {
    setProgressMap(byIndex);
  }, [byIndex]);

  useEffect(() => {
    if (!encouragement) return;
    const t = window.setTimeout(() => setEncouragement(null), 5200);
    return () => window.clearTimeout(t);
  }, [encouragement]);

  const supabase = useMemo(() => getOnboardingBrowserClient(), []);

  useEffect(() => {
    const channel = supabase
      .channel(`step_progress:${orgId}`)
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'step_progress',
          filter: `org_id=eq.${orgId}`,
        },
        (payload) => {
          const row = payload.new as StepProgress | null;
          if (!row) return;
          setProgressMap((prev) => {
            const next = new Map(prev);
            next.set(row.step_index, row);
            return next;
          });
        },
      )
      .subscribe();

    return () => {
      void supabase.removeChannel(channel);
    };
  }, [orgId, supabase]);

  const requiredIndices = useMemo(
    () => steps.map((s, i) => (!s.optional ? i : -1)).filter((i) => i >= 0),
    [steps],
  );

  const requiredDone = useMemo(() => {
    return requiredIndices.filter((i) => progressMap.get(i)?.completed).length;
  }, [progressMap, requiredIndices]);

  const totalDone = useMemo(() => {
    return steps.filter((_, i) => progressMap.get(i)?.completed).length;
  }, [progressMap, steps]);

  const requiredComplete =
    requiredIndices.length > 0 && requiredDone === requiredIndices.length;

  const pct =
    requiredIndices.length === 0
      ? 100
      : Math.round((requiredDone / requiredIndices.length) * 100);

  const estimatedTotal = '~25 min';

  const toggleExpanded = (idx: number) => {
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(idx)) next.delete(idx);
      else next.add(idx);
      return next;
    });
  };

  const onCheck = useCallback(
    (stepIndex: number, nextVal: boolean) => {
      const prev = progressMap.get(stepIndex);
      if (!prev) return;

      const oldRequiredDone = requiredIndices.filter((i) => progressMap.get(i)?.completed).length;

      const optimistic: StepProgress = {
        ...prev,
        completed: nextVal,
        completed_at: nextVal ? new Date().toISOString() : null,
        completed_by: nextVal ? prev.completed_by ?? 'org' : null,
      };

      const nextMap = new Map(progressMap);
      nextMap.set(stepIndex, optimistic);
      const newRequiredDone = requiredIndices.filter((i) => nextMap.get(i)?.completed).length;

      if (nextVal) {
        const step = steps[stepIndex];
        setEncouragement(getStepEncouragement(stepIndex, Boolean(step?.optional)));
        const justFinishedAllRequired =
          requiredIndices.length > 0 &&
          oldRequiredDone < requiredIndices.length &&
          newRequiredDone === requiredIndices.length;
        if (justFinishedAllRequired) {
          queueMicrotask(() => {
            void fireOnboardingConfetti();
          });
        }

        let nextOpen: number | null = null;
        for (let j = stepIndex + 1; j < steps.length; j++) {
          if (!nextMap.get(j)?.completed) {
            nextOpen = j;
            break;
          }
        }
        setExpanded((prev) => {
          const s = new Set(prev);
          s.delete(stepIndex);
          if (nextOpen !== null) s.add(nextOpen);
          return s;
        });
        if (nextOpen !== null) {
          queueMicrotask(() => {
            document
              .getElementById(`onboard-step-${nextOpen}`)
              ?.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          });
        }
      }

      setProgressMap(nextMap);

      startTransition(async () => {
        try {
          await toggleStep(orgId, stepIndex, nextVal, null);
        } catch {
          setProgressMap((m) => {
            const n = new Map(m);
            n.set(stepIndex, prev);
            return n;
          });
        }
      });
    },
    [orgId, progressMap, requiredIndices, steps],
  );

  return (
    <div className="relative mx-auto max-w-[min(100%,760px)] px-4 pb-16 pt-8 sm:px-6">
      <header className="mb-8 text-center">
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-bond-orange">BOND SPORTS</p>
        <h1 className="text-[1.65rem] font-semibold leading-tight text-bond-text sm:text-[1.85rem]">
          Welcome to Bond Sports 🎉
        </h1>
        <p className="mt-3 text-base leading-relaxed text-bond-muted-dark sm:text-[17px]">
          Hi {orgName} — this checklist walks through the core setup steps so you can go live with confidence.
          Work through each section in order; your Bond team sees your progress in real time.
        </p>
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[15px] text-bond-muted-dark sm:text-base">
          <span>⏱ Total time: {estimatedTotal}</span>
          <span className="text-bond-border">|</span>
          <span>
            ✅ {totalDone} of {steps.length} steps complete
          </span>
        </div>
        <div className="mt-4 h-[6px] w-full overflow-hidden rounded-[99px] bg-[#e5e4e0]">
          <div
            className="h-full rounded-[99px] bg-bond-green transition-[width] duration-300 ease-out"
            style={{ width: `${pct}%` }}
          />
        </div>
      </header>

      <section className="mb-10 rounded-[12px] border border-bond-border bg-white p-5 sm:p-6">
        <h2 className="text-[15px] font-semibold text-bond-text">Goals for this setup</h2>
        <ul className="mt-3 space-y-2 text-[15px] leading-relaxed text-bond-muted-dark sm:text-base">
          {GOALS.map((g) => (
            <li key={g} className="flex gap-2">
              <span className="text-bond-green-dark">✓</span>
              <span>{g}</span>
            </li>
          ))}
        </ul>
      </section>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const p = progressMap.get(idx);
          const done = Boolean(p?.completed);
          const isOpen = expanded.has(idx);
          const showOptional = step.optional;

          return (
            <div
              key={idx}
              id={`onboard-step-${idx}`}
              className={`scroll-mt-4 overflow-hidden rounded-[12px] border bg-white transition-colors ${
                done ? 'border-bond-green-light' : 'border-[0.5px] border-bond-border'
              }`}
            >
              <div className="flex items-start gap-3 p-4 sm:p-5">
                <button
                  type="button"
                  className={`mt-0.5 flex h-[22px] w-[22px] shrink-0 items-center justify-center rounded-[6px] border-[1.5px] border-[#d0cec8] transition-colors ${
                    done ? 'border-bond-green bg-bond-green' : 'bg-white'
                  }`}
                  onClick={() => onCheck(idx, !done)}
                  disabled={pending}
                  aria-label={done ? 'Mark incomplete' : 'Mark complete'}
                  aria-checked={done}
                  role="checkbox"
                >
                  {done ? <CheckIcon /> : null}
                </button>
                <button type="button" onClick={() => toggleExpanded(idx)} className="min-w-0 flex-1 text-left">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="rounded-[999px] bg-bond-orange px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
                      Step {idx + 1}
                    </span>
                    {showOptional ? (
                      <span className="rounded-[999px] bg-bond-optional-bg px-2 py-0.5 text-[10px] font-medium text-bond-optional-text">
                        Optional
                      </span>
                    ) : null}
                    <span className="rounded-[999px] bg-bond-badge-bg px-2 py-0.5 text-[11px] text-bond-badge-text">
                      {step.time}
                    </span>
                  </div>
                  <h3
                    className={`mt-1 text-[1.05rem] font-semibold leading-snug sm:text-[1.125rem] ${
                      done ? 'text-bond-green-dark' : 'text-bond-text'
                    }`}
                  >
                    {step.title}
                  </h3>
                </button>
              </div>

              {isOpen ? (
                <div className="border-t border-bond-border px-4 pb-4 pt-0 pl-[52px] sm:px-5 sm:pb-5">
                  <p className="mt-3 text-base leading-relaxed text-bond-muted-dark sm:text-[17px]">
                    {step.description}
                  </p>

                  {step.note ? (
                    <div className="mt-4 border-l-[3px] border-bond-note-border bg-bond-note-bg px-3 py-2 text-[15px] text-bond-note-text sm:text-base">
                      {step.note}
                    </div>
                  ) : null}

                  {step.checklist?.length ? (
                    <ul className="mt-4 list-disc space-y-1 pl-5 text-[15px] text-bond-muted-dark sm:text-base">
                      {step.checklist.map((c) => (
                        <li key={c}>{c}</li>
                      ))}
                    </ul>
                  ) : null}

                  <div className="mt-4 flex flex-col gap-2">
                    {step.links.map((link) => (
                      <a
                        key={link.url}
                        href={link.url}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-2 rounded-[7px] bg-bond-blue-bg px-3 py-2 text-[15px] font-medium text-bond-blue transition hover:opacity-90 sm:text-base"
                      >
                        <span>{link.icon}</span>
                        {link.label}
                      </a>
                    ))}
                  </div>

                  <div className="mt-4 rounded-[8px] bg-bond-green-bg px-3 py-2 text-[15px] text-bond-green-dark sm:text-base">
                    <strong className="font-semibold">Done when:</strong> {step.doneWhen}
                  </div>
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      {requiredComplete ? (
        <section className="mt-10 rounded-[12px] border border-bond-green-light bg-bond-green-bg p-6 text-center sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bond-green-dark">Congratulations</p>
          <h2 className="mt-2 text-xl font-semibold text-bond-green-dark">You&apos;re all set</h2>
          <p className="mt-2 text-[15px] text-bond-muted-dark sm:text-base">
            Required onboarding is complete — confetti deserved. Your Bond team has been notified. Optional steps are
            still above if you want to polish further.
          </p>
        </section>
      ) : null}

      {encouragement ? (
        <div
          className="pointer-events-none fixed bottom-4 left-4 right-4 z-[100] flex justify-center sm:pointer-events-auto sm:bottom-6 sm:left-auto sm:right-6 sm:justify-end"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto w-full max-w-[min(100%,22rem)] animate-slide-up rounded-[12px] border border-bond-border bg-white px-4 py-3.5 text-[15px] leading-snug text-bond-text shadow-lg motion-reduce:animate-none sm:max-w-[20rem] sm:text-base">
            <span className="mr-1.5 inline-block text-lg leading-none" aria-hidden>
              ✨
            </span>
            <span className="text-bond-muted-dark">{encouragement}</span>
          </div>
        </div>
      ) : null}

      <footer className="mt-12 border-t border-bond-border pt-8 text-center text-[13px] text-bond-muted sm:text-sm">
        <p>Questions? Reach out to your Bond onboarding contact or visit</p>
        <a
          href="https://help.bondsports.co"
          className="mt-1 inline-block text-bond-blue underline"
          target="_blank"
          rel="noopener noreferrer"
        >
          help.bondsports.co
        </a>
      </footer>
    </div>
  );
}
