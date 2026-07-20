'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogOut, MonitorPlay } from 'lucide-react';

type AuthState =
  | { status: 'checking' }
  | { status: 'denied'; message: string }
  | { status: 'ok'; organizationIds: number[] };

/**
 * Auth + chrome for the external TV Monitor studio (/tvmonitor/studio).
 * Exchanges a ?key= access-link token for the httpOnly studio cookie, then
 * renders children with the granted org IDs.
 */
export default function StudioShell({
  children,
}: {
  children: (organizationIds: number[]) => React.ReactNode;
}) {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const me = await fetch('/api/tvmonitor/studio/me', { cache: 'no-store' });
      if (me.ok) {
        const data = await me.json();
        if (!cancelled) setAuth({ status: 'ok', organizationIds: data.organizationIds || [] });
        return;
      }
      const key = searchParams.get('key');
      if (key) {
        const res = await fetch('/api/tvmonitor/studio/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ key }),
        });
        const data = await res.json().catch(() => ({}));
        if (!cancelled) {
          if (res.ok) {
            setAuth({ status: 'ok', organizationIds: data.organizationIds || [] });
            // Drop the token from the address bar/history once exchanged.
            router.replace('/tvmonitor/studio');
          } else {
            setAuth({ status: 'denied', message: data.error || 'This access link is invalid or has been revoked.' });
          }
        }
        return;
      }
      if (!cancelled) {
        setAuth({
          status: 'denied',
          message: 'You need an access link to use the TV Monitor studio. Ask your Bond Sports contact for one.',
        });
      }
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function signOut() {
    await fetch('/api/tvmonitor/studio/session', { method: 'DELETE' });
    setAuth({ status: 'denied', message: 'Signed out. Open your access link to sign back in.' });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <header className="border-b border-gray-200 bg-white">
        <div className="mx-auto flex max-w-[1600px] items-center justify-between px-6 py-3">
          <div className="flex items-center gap-2">
            <MonitorPlay className="text-toca-navy" size={22} />
            <span className="font-bold text-gray-900">TV Monitor Studio</span>
            <span className="ml-1 rounded-full bg-gray-100 px-2 py-0.5 text-xs text-gray-500">by Bond Sports</span>
          </div>
          {auth.status === 'ok' && (
            <button onClick={signOut} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
              <LogOut size={15} /> Sign out
            </button>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        {auth.status === 'checking' && <div className="h-96 animate-pulse rounded-xl bg-gray-200" />}
        {auth.status === 'denied' && (
          <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 text-center shadow-sm">
            <MonitorPlay className="mx-auto mb-3 text-gray-300" size={40} />
            <h1 className="text-lg font-semibold text-gray-900">TV Monitor Studio</h1>
            <p className="mt-2 text-sm text-gray-600">{auth.message}</p>
          </div>
        )}
        {auth.status === 'ok' && children(auth.organizationIds)}
      </main>
    </div>
  );
}
