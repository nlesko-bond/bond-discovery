'use client';

import { useState, useTransition } from 'react';
import { verifyOrgPin } from '../actions';

type Props = {
  slug: string;
};

export function PinGate({ slug }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    startTransition(async () => {
      const res = await verifyOrgPin(slug, pin);
      if (!res.success) {
        setError(res.error ?? 'Could not verify PIN.');
        return;
      }
      window.location.reload();
    });
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-[680px] flex-col justify-center px-4 py-12">
      <div className="rounded-[12px] border border-bond-border bg-white p-8 shadow-sm">
        <h1 className="text-xl font-semibold text-bond-text">Enter PIN</h1>
        <p className="mt-2 text-sm text-bond-muted-dark">
          This onboarding link is protected. Enter the PIN your Bond contact shared with you.
        </p>
        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <input
            type="password"
            autoComplete="one-time-code"
            value={pin}
            onChange={(e) => setPin(e.target.value)}
            className="w-full rounded-[8px] border border-bond-border px-3 py-2 text-bond-text outline-none focus:border-bond-blue"
            placeholder="PIN"
          />
          {error ? (
            <p className="text-sm text-red-600" role="alert">
              {error}
            </p>
          ) : null}
          <button
            type="submit"
            disabled={pending || !pin.trim()}
            className="rounded-[8px] bg-bond-orange px-4 py-2 text-sm font-medium text-white disabled:opacity-50"
          >
            {pending ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
