'use client';

import { useState } from 'react';

type Props = {
  url: string;
  /** Shown in secondary “Open” link */
  slug: string;
  /** Extra emphasis after creating a new org */
  celebrate?: boolean;
};

export function OnboardingLinkCard({ url, slug, celebrate }: Props) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(url);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      /* ignore */
    }
  }

  return (
    <div
      className={`rounded-xl border-2 p-5 shadow-sm ${
        celebrate
          ? 'border-orange-400 bg-gradient-to-br from-orange-50 to-amber-50'
          : 'border-primary/30 bg-gradient-to-br from-white to-orange-50/40'
      }`}
    >
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0 flex-1">
          <p className="text-xs font-semibold uppercase tracking-wide text-orange-800">Onboarding link</p>
          <p className="mt-1 text-sm text-gray-700">
            Share this URL with the organization. They complete steps on this page — no admin login required.
          </p>
          <p className="mt-3 break-all rounded-lg bg-white/80 px-3 py-2 font-mono text-sm text-gray-900 ring-1 ring-gray-200">
            {url}
          </p>
        </div>
        <div className="flex shrink-0 flex-col gap-2 sm:items-end">
          <button
            type="button"
            onClick={() => void copy()}
            className="w-full rounded-lg bg-orange-600 px-5 py-3 text-center text-sm font-semibold text-white shadow-sm hover:bg-orange-700 sm:w-auto"
          >
            {copied ? 'Copied to clipboard' : 'Copy onboarding link'}
          </button>
          <a
            href={url}
            target="_blank"
            rel="noopener noreferrer"
            className="text-center text-sm font-medium text-primary hover:underline sm:text-right"
          >
            Open preview ({slug}) ↗
          </a>
        </div>
      </div>
    </div>
  );
}
