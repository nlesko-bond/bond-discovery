'use client';

import Image from 'next/image';
import { Fragment, useCallback, useEffect, useMemo, useState, useTransition } from 'react';
import { BOND_LOGO_URL } from '@/lib/onboarding/bond-brand';
import type { StepProgress, TemplateStep } from '@/lib/onboarding/types';
import { fireOnboardingConfetti, getStepEncouragement } from '@/lib/onboarding/encouragements';
import { getOnboardingBrowserClient } from '@/lib/onboarding/supabase-browser';
import { SpacesCsvUploader } from './SpacesCsvUploader';
import { GlCodesCsvUploader } from './GlCodesCsvUploader';
import { toggleStep } from '../actions';

const BONDY_CELEBRATION = '/images/onboarding/bondy-celebration.png';

/** Responsive content width scale (was capped at ~780px). */
const CONTENT_MAX_CLASSES =
  'w-full max-w-3xl sm:max-w-4xl md:max-w-5xl lg:max-w-6xl xl:max-w-7xl';
const PAGE_HORIZONTAL_PAD = 'px-4 sm:px-8 lg:px-12 xl:px-14';
const BLEED_NEGATIVE_PAD = '-mx-4 sm:-mx-8 lg:-mx-12 xl:-mx-14';
const BLEED_POSITIVE_PAD = 'px-4 sm:px-8 lg:px-12 xl:px-14';

type Props = {
  orgId: string;
  slug: string;
  orgName: string;
  logoUrl?: string | null;
  steps: TemplateStep[];
  initialProgress: StepProgress[];
  kickoffDividerAfterStepIndex?: number | null;
  spacesUploadedAt?: string | null;
  spacesUploadOriginalFilename?: string | null;
  glCodesUploadedAt?: string | null;
  glCodesUploadOriginalFilename?: string | null;
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
  slug,
  orgName,
  logoUrl,
  steps,
  initialProgress,
  kickoffDividerAfterStepIndex = null,
  spacesUploadedAt = null,
  spacesUploadOriginalFilename = null,
  glCodesUploadedAt = null,
  glCodesUploadOriginalFilename = null,
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

      const optimistic: StepProgress = {
        ...prev,
        completed: nextVal,
        completed_at: nextVal ? new Date().toISOString() : null,
        completed_by: nextVal ? prev.completed_by ?? 'org' : null,
      };

      const nextMap = new Map(progressMap);
      nextMap.set(stepIndex, optimistic);

      const oldRequiredDone = requiredIndices.filter((i) => progressMap.get(i)?.completed).length;
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

  const logoPair = (
    <>
      <div className="flex h-14 max-w-[200px] items-center justify-center sm:h-16 sm:max-w-[220px]">
        <Image
          src={BOND_LOGO_URL}
          alt="Bond Sports"
          width={220}
          height={64}
          className="h-full w-auto max-w-full object-contain object-center"
          unoptimized
        />
      </div>
      {logoUrl ? (
        <>
          <span className="text-lg font-light text-bond-border sm:text-xl" aria-hidden>
            ·
          </span>
          <div className="relative h-14 w-14 shrink-0 overflow-hidden rounded-2xl border border-bond-border bg-white shadow-sm sm:h-16 sm:w-16">
            <Image
              src={logoUrl}
              alt={`${orgName} logo`}
              width={64}
              height={64}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
        </>
      ) : null}
    </>
  );

  const logoPairSticky = (
    <div className="flex shrink-0 items-center gap-2 sm:gap-2.5">
      <div className="flex h-9 max-w-[100px] items-center sm:h-10 sm:max-w-[110px]">
        <Image
          src={BOND_LOGO_URL}
          alt=""
          width={110}
          height={32}
          className="h-full w-auto max-w-full object-contain"
          unoptimized
        />
      </div>
      {logoUrl ? (
        <>
          <span className="text-bond-border/70" aria-hidden>
            ·
          </span>
          <div className="relative h-9 w-9 shrink-0 overflow-hidden rounded-lg border border-bond-border/80 bg-white shadow-sm sm:h-10 sm:w-10">
            <Image
              src={logoUrl}
              alt={`${orgName} logo`}
              width={40}
              height={40}
              className="h-full w-full object-cover"
              unoptimized
            />
          </div>
        </>
      ) : null}
    </div>
  );

  const requiredTotal = requiredIndices.length;

  return (
    <div
      className={`relative mx-auto ${CONTENT_MAX_CLASSES} ${PAGE_HORIZONTAL_PAD} pb-16 pt-8`}
    >
      <header className="mb-6 text-center sm:mb-8">
        <div className="mb-5 flex flex-wrap items-center justify-center gap-3 sm:mb-6 sm:gap-5">{logoPair}</div>
        <p className="mb-4 text-xs font-semibold uppercase tracking-[0.2em] text-bond-brand">BOND SPORTS</p>
        <h1 className="text-[1.65rem] font-semibold leading-tight text-bond-text sm:text-[1.85rem]">
          Welcome to Bond Sports
        </h1>
        <p className="mt-3 text-base leading-relaxed text-bond-muted-dark sm:text-[17px]">
          Hi {orgName} — this checklist walks through the core setup steps so you can go live with confidence.
          Work through each section in order; your Bond team sees your progress in real time.
        </p>
        {kickoffDividerAfterStepIndex != null ? (
          <p className="mt-3 rounded-[10px] border border-bond-border bg-white px-4 py-3 text-left text-[15px] leading-relaxed text-bond-muted-dark shadow-sm sm:text-[16px]">
            Part 1 highlights everything needed before your kickoff call with Bond. Sections marked{' '}
            <span className="font-semibold text-bond-text">Before kickoff</span> are in that bucket; afterward you will
            see <span className="font-semibold text-bond-text">After kickoff</span> guidance.
          </p>
        ) : null}
        <div className="mt-4 flex flex-wrap items-center justify-center gap-3 text-[15px] text-bond-muted-dark sm:text-base">
          <span>Total time: {estimatedTotal}</span>
          <span className="text-bond-border">|</span>
          <span>
            Steps: {totalDone} of {steps.length} complete
          </span>
        </div>
      </header>

      <div
        className={`sticky top-0 z-40 ${BLEED_NEGATIVE_PAD} mb-8 border-b border-bond-border/90 border-t-[3px] border-t-bond-accent bg-bond-bg/95 py-3.5 shadow-[0_4px_24px_-8px_rgba(0,0,0,0.08)] backdrop-blur-md sm:mb-10 sm:py-4 ${BLEED_POSITIVE_PAD}`}
      >
        <div className="mx-auto flex w-full items-center gap-3 sm:gap-4">
          {logoPairSticky}
          <div className="min-w-0 flex-1">
            <div className="flex items-baseline justify-between gap-2">
              <span className="truncate text-[15px] font-semibold text-bond-text sm:text-base">Your progress</span>
              <span className="shrink-0 tabular-nums text-xl font-bold tracking-tight text-bond-accent sm:text-2xl">
                {pct}%
              </span>
            </div>
            <div className="mt-2.5 h-2.5 w-full overflow-hidden rounded-full bg-[#e5e4e0] shadow-[inset_0_1px_2px_rgba(0,0,0,0.06)]">
              <div
                className="h-full rounded-full bg-gradient-to-r from-[#0a3558] via-bond-brand to-[#135a8a] transition-[width] duration-300 ease-out"
                style={{ width: `${pct}%` }}
              />
            </div>
            <p className="mt-2 text-[13px] text-bond-muted-dark sm:text-sm">
              {requiredTotal > 0 ? (
                <>
                  {requiredDone} of {requiredTotal} required steps
                </>
              ) : (
                <>No required steps in this template</>
              )}
            </p>
          </div>
        </div>
      </div>

      <div className="space-y-3">
        {steps.map((step, idx) => {
          const p = progressMap.get(idx);
          const done = Boolean(p?.completed);
          const isOpen = expanded.has(idx);
          const showOptional = step.optional;
          const showKickoffDivider =
            kickoffDividerAfterStepIndex != null && kickoffDividerAfterStepIndex === idx;

          return (
            <Fragment key={idx}>
              <div
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
                      <span className="rounded-[999px] bg-bond-brand px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-white">
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
                      {kickoffDividerAfterStepIndex !== null &&
                      idx <= kickoffDividerAfterStepIndex ? (
                        <span className="rounded-[999px] bg-bond-brand-light px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-bond-brand">
                          Before kickoff
                        </span>
                      ) : null}
                      {kickoffDividerAfterStepIndex !== null &&
                      idx > kickoffDividerAfterStepIndex ? (
                        <span className="rounded-[999px] bg-gray-100 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-gray-700">
                          After kickoff
                        </span>
                      ) : null}
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
                          className="inline-flex items-center gap-2 rounded-[7px] bg-bond-brand-light px-3 py-2 text-[15px] font-medium text-bond-brand transition hover:opacity-90 sm:text-base"
                        >
                          <span>{link.icon}</span>
                          {link.label}
                        </a>
                      ))}
                    </div>

                    {step.spacesCsvUpload ? (
                      <SpacesCsvUploader
                        slug={slug}
                        uploadedAt={spacesUploadedAt}
                        originalFilename={spacesUploadOriginalFilename}
                      />
                    ) : null}

                    {step.glCodesCsvUpload ? (
                      <GlCodesCsvUploader
                        slug={slug}
                        uploadedAt={glCodesUploadedAt}
                        originalFilename={glCodesUploadOriginalFilename}
                      />
                    ) : null}

                    <div className="mt-4 rounded-[8px] bg-bond-green-bg px-3 py-2 text-[15px] text-bond-green-dark sm:text-base">
                      <strong className="font-semibold">Done when:</strong> {step.doneWhen}
                    </div>
                  </div>
                ) : null}
              </div>

              {showKickoffDivider ? (
                <section
                  className="my-10 rounded-[12px] border border-bond-accent bg-bond-brand-light/30 px-5 py-8 text-center shadow-sm sm:px-8"
                  aria-label="Part two"
                >
                  <div className="mx-auto mb-4 flex items-center gap-4">
                    <div className="h-px flex-1 bg-bond-border" aria-hidden />
                    <span className="text-[11px] font-bold uppercase tracking-[0.28em] text-bond-muted-dark">
                      Part 2
                    </span>
                    <div className="h-px flex-1 bg-bond-border" aria-hidden />
                  </div>
                  <p className="text-[16px] font-semibold text-bond-text sm:text-[17px]">After kickoff</p>
                  <p className="mx-auto mt-3 max-w-prose text-[15px] leading-relaxed text-bond-muted-dark sm:max-w-none sm:text-[16px] lg:text-[17px]">
                    The rest can wait until after our kickoff call, but feel free to take a look and get started if you
                    feel up for it!
                  </p>
                </section>
              ) : null}
            </Fragment>
          );
        })}
      </div>

      {requiredComplete ? (
        <section className="mt-10 rounded-[12px] border border-bond-green-light bg-bond-green-bg p-6 text-center sm:p-8">
          <div className="mx-auto mb-4 flex justify-center">
            <Image
              src={BONDY_CELEBRATION}
              alt=""
              width={200}
              height={200}
              className="h-40 w-auto max-w-full object-contain sm:h-48"
              priority
            />
          </div>
          <p className="text-xs font-semibold uppercase tracking-[0.12em] text-bond-green-dark">Congratulations</p>
          <h2 className="mt-2 text-xl font-semibold text-bond-green-dark">You&apos;re all set</h2>
          <p className="mt-2 text-[15px] text-bond-muted-dark sm:text-base">
            Every required onboarding task is marked complete — amazing work. Your Bond onboarding lead can monitor
            progress in real time, and optional steps above are still available if you want extras.
          </p>
        </section>
      ) : null}

      {encouragement ? (
        <div
          className="pointer-events-none fixed bottom-4 left-4 right-4 z-[100] flex justify-center sm:pointer-events-auto sm:bottom-6 sm:left-auto sm:right-6 sm:justify-end"
          role="status"
          aria-live="polite"
        >
          <div className="pointer-events-auto flex w-full max-w-[min(100%,24rem)] animate-slide-up gap-3 rounded-[12px] border border-bond-border border-l-[4px] border-l-bond-accent bg-white px-3 py-3 text-[15px] leading-snug text-bond-text shadow-lg motion-reduce:animate-none sm:max-w-[22rem] sm:gap-3.5 sm:px-4 sm:py-3.5 sm:text-base">
            <div className="relative h-16 w-16 shrink-0 sm:h-[4.5rem] sm:w-[4.5rem]">
              <Image
                src={BONDY_CELEBRATION}
                alt=""
                fill
                className="object-contain object-bottom"
                sizes="(max-width: 640px) 64px, 72px"
              />
            </div>
            <p className="min-w-0 flex-1 self-center text-bond-muted-dark">{encouragement}</p>
          </div>
        </div>
      ) : null}

      <footer className="mt-12 border-t border-bond-border pt-8 text-center text-[13px] text-bond-muted sm:text-sm">
        <p>For questions email</p>
        <a
          href="mailto:customersuccess@bondsports.co"
          className="mt-2 inline-block text-[15px] font-semibold text-bond-brand underline decoration-bond-accent underline-offset-2"
        >
          customersuccess@bondsports.co
        </a>
        <div className="mt-6 text-[13px] text-bond-muted">
          Help center:{' '}
          <a
            href="https://help.bondsports.co"
            className="font-medium text-bond-brand underline decoration-bond-accent underline-offset-2"
            target="_blank"
            rel="noopener noreferrer"
          >
            help.bondsports.co
          </a>
        </div>
      </footer>
    </div>
  );
}
