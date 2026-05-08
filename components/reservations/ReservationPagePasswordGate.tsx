'use client';

import { useState, type FormEvent } from 'react';
import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { CalendarDays } from 'lucide-react';
import type { ReservationPageBranding } from '@/types/reservation-pages';

const ICON_MEDIUM = 18;

interface IReservationPagePasswordGateProps {
  slug: string;
  title: string;
  branding: ReservationPageBranding;
}

/**
 * Collects the viewer password for a gated reservation schedule page and sets the access cookie via API.
 */
export function ReservationPagePasswordGate({ slug, title, branding }: IReservationPagePasswordGateProps) {
  const router = useRouter();
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const cssVars = {
    '--rs-black': branding.primaryColor,
    '--rs-accent': branding.accentColor,
    '--rs-bg': branding.bgColor,
  } as React.CSSProperties;

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const res = await fetch(`/api/reservation-pages/${encodeURIComponent(slug)}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password }),
      });
      const data: unknown = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg =
          typeof data === 'object' &&
          data !== null &&
          'error' in data &&
          typeof (data as { error: unknown }).error === 'string'
            ? (data as { error: string }).error
            : 'Could not unlock';
        setError(msg);
        return;
      }
      router.refresh();
    } catch {
      setError('Request failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div style={cssVars} className="min-h-screen bg-[var(--rs-bg)] text-[var(--rs-black)]">
      <div className="mx-auto flex min-h-screen max-w-md flex-col justify-center px-4 py-12">
        <div className="mb-8 flex items-center gap-3">
          {branding.logoUrl ? (
            <Image
              src={branding.logoUrl}
              alt=""
              width={160}
              height={40}
              className="h-10 w-auto object-contain"
              unoptimized
            />
          ) : (
            <div
              className="flex h-10 w-10 items-center justify-center rounded-lg text-sm font-bold text-white"
              style={{ background: 'var(--rs-accent)' }}
            >
              <CalendarDays size={ICON_MEDIUM} />
            </div>
          )}
        </div>
        <h1 className="text-2xl font-bold tracking-tight">{title}</h1>
        <p className="mt-2 text-sm text-gray-600">This page is password protected.</p>
        <form onSubmit={(e) => void handleSubmit(e)} className="mt-6 space-y-4">
          <label className="block">
            <span className="mb-1 block text-sm font-medium text-gray-700">Password</span>
            <input
              type="password"
              autoComplete="current-password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm"
            />
          </label>
          {error ? <p className="text-sm text-red-600">{error}</p> : null}
          <button
            type="submit"
            disabled={submitting || !password.trim()}
            className="w-full rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
            style={{ background: 'var(--rs-black)' }}
          >
            {submitting ? 'Checking…' : 'Continue'}
          </button>
        </form>
      </div>
    </div>
  );
}
