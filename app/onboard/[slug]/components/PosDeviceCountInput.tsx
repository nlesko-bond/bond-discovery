'use client';

import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import {
  MAX_POS_DEVICES_ORDERED,
  MIN_POS_DEVICES_ORDERED,
} from '@/lib/onboarding/parse-pos-device-count';

type Props = {
  slug: string;
  savedCount: number | null;
  savedAt: string | null;
};

export function PosDeviceCountInput({ slug, savedCount, savedAt }: Props) {
  const router = useRouter();
  const [pending, setPending] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [draft, setDraft] = useState(savedCount != null ? String(savedCount) : '');

  useEffect(() => {
    setDraft(savedCount != null ? String(savedCount) : '');
  }, [savedCount, savedAt]);

  const save = useCallback(async () => {
    setErrorMsg(null);
    setPending(true);
    try {
      const res = await fetch(`/api/onboard/${encodeURIComponent(slug)}/save-pos-devices`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ count: draft }),
      });
      let body: unknown;
      try {
        body = await res.json();
      } catch {
        body = {};
      }
      const err =
        typeof body === 'object' && body !== null && 'error' in body
          ? String((body as { error?: unknown }).error ?? '')
          : '';
      if (!res.ok) {
        setErrorMsg(err || `Save failed (${res.status})`);
        return;
      }
      router.refresh();
    } finally {
      setPending(false);
    }
  }, [draft, router, slug]);

  return (
    <div className="mt-4 rounded-[8px] border border-dashed border-bond-border bg-bond-bg px-4 py-4">
      <p className="text-[15px] font-medium text-bond-text">POS devices to order</p>
      <p className="mt-2 text-[15px] leading-relaxed text-bond-muted-dark sm:text-[16px]">
        How many Bond-supported POS devices does your facility need? Enter{' '}
        <span className="font-medium text-bond-text">0</span> if you will not take in-person payments.
      </p>
      <div className="mt-3 flex flex-wrap items-end gap-3">
        <label className="block">
          <span className="sr-only">Number of POS devices</span>
          <input
            type="number"
            name="pos_devices_requested"
            inputMode="numeric"
            min={MIN_POS_DEVICES_ORDERED}
            max={MAX_POS_DEVICES_ORDERED}
            step={1}
            value={draft}
            disabled={pending}
            onChange={(e) => setDraft(e.target.value)}
            className="w-28 rounded-[7px] border border-bond-border bg-white px-3 py-2 text-[15px] text-bond-text"
          />
        </label>
        <button
          type="button"
          disabled={pending}
          onClick={() => void save()}
          className="inline-flex rounded-[7px] bg-bond-brand px-3 py-2 text-[14px] font-medium text-white hover:opacity-90 disabled:opacity-50"
        >
          {pending ? 'Saving…' : 'Save'}
        </button>
      </div>
      {errorMsg ? <p className="mt-3 text-[14px] text-red-700">{errorMsg}</p> : null}
      {savedCount != null && savedAt ? (
        <p className="mt-3 text-[14px] text-bond-green-dark">
          Saved: <strong>{savedCount}</strong> device{savedCount === 1 ? '' : 's'}{' '}
          <time dateTime={savedAt}>
            (
            {new Date(savedAt).toLocaleString(undefined, {
              dateStyle: 'medium',
              timeStyle: 'short',
            })}
            )
          </time>
        </p>
      ) : (
        <p className="mt-3 text-[14px] text-bond-muted-dark">Not saved yet.</p>
      )}
    </div>
  );
}
