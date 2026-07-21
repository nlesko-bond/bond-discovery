'use client';

import { useEffect, useState } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { LogOut, Mail, MonitorPlay } from 'lucide-react';
import { TextInput } from '@/components/tvmonitor/studio/fields';

type AuthState =
  | { status: 'checking' }
  | { status: 'signed-out'; notice: string | null }
  | { status: 'ok'; organizationIds: number[]; email: string | null };

/**
 * Auth + chrome for the external TV Monitor studio (/tvmonitor/studio).
 *
 * Sign-in paths, in priority order:
 * 1. ?login={token} — single-use magic-link/invite token for a named user
 * 2. ?key={token}   — legacy org access link
 * 3. An existing httpOnly session cookie
 * Otherwise an email form requests a magic link.
 */
export default function StudioShell({
  children,
}: {
  children: (organizationIds: number[]) => React.ReactNode;
}) {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });
  const [email, setEmail] = useState('');
  const [requesting, setRequesting] = useState(false);
  const [requestNotice, setRequestNotice] = useState<string | null>(null);
  const searchParams = useSearchParams();
  const router = useRouter();

  useEffect(() => {
    let cancelled = false;
    (async () => {
      // A credential in the URL always wins over any existing session, so a
      // link for a different user/org switches the studio — never silently
      // falls back to whoever was signed in before.
      const login = searchParams.get('login');
      const key = searchParams.get('key');
      if (login || key) {
        const res = await fetch('/api/tvmonitor/studio/session', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(login ? { login } : { key }),
        });
        const data = await res.json().catch(() => ({}));
        if (cancelled) return;
        if (res.ok) {
          setAuth({ status: 'ok', organizationIds: data.organizationIds || [], email: data.email ?? null });
          // Drop the token from the address bar/history once exchanged.
          router.replace('/tvmonitor/studio');
        } else {
          setAuth({ status: 'signed-out', notice: data.error || 'That link is invalid or has expired.' });
        }
        return;
      }
      const me = await fetch('/api/tvmonitor/studio/me', { cache: 'no-store' });
      if (cancelled) return;
      if (me.ok) {
        const data = await me.json();
        setAuth({ status: 'ok', organizationIds: data.organizationIds || [], email: data.email ?? null });
        return;
      }
      setAuth({ status: 'signed-out', notice: null });
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  async function requestLoginLink(e: React.FormEvent) {
    e.preventDefault();
    setRequesting(true);
    setRequestNotice(null);
    try {
      const res = await fetch('/api/tvmonitor/studio/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email }),
      });
      const data = await res.json().catch(() => ({}));
      if (data.emailConfigured === false) {
        setRequestNotice(
          'Email sign-in is not set up yet — ask your Bond Sports contact for an invite link instead.',
        );
      } else {
        setRequestNotice(`If ${email.trim()} has studio access, a sign-in link is on its way. It expires in 15 minutes.`);
      }
    } catch {
      setRequestNotice('Something went wrong — please try again.');
    } finally {
      setRequesting(false);
    }
  }

  async function signOut() {
    await fetch('/api/tvmonitor/studio/session', { method: 'DELETE' });
    setAuth({ status: 'signed-out', notice: 'Signed out.' });
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
            <div className="flex items-center gap-3">
              <span className="rounded-full bg-blue-50 px-3 py-1 text-xs font-medium text-toca-navy">
                {auth.email ? auth.email : 'Guest link'} · org{auth.organizationIds.length === 1 ? '' : 's'}{' '}
                {auth.organizationIds.map((id) => `#${id}`).join(', ')}
              </span>
              <button onClick={signOut} className="flex items-center gap-1 text-sm text-gray-500 hover:text-gray-800">
                <LogOut size={15} /> Sign out
              </button>
            </div>
          )}
        </div>
      </header>

      <main className="mx-auto max-w-[1600px] px-6 py-8">
        {auth.status === 'checking' && <div className="h-96 animate-pulse rounded-xl bg-gray-200" />}
        {auth.status === 'signed-out' && (
          <div className="mx-auto max-w-md rounded-xl border border-gray-200 bg-white p-8 shadow-sm">
            <MonitorPlay className="mx-auto mb-3 block text-gray-300" size={40} />
            <h1 className="text-center text-lg font-semibold text-gray-900">Sign in to TV Monitor Studio</h1>
            <p className="mt-1 text-center text-sm text-gray-600">
              Enter your email and we&apos;ll send you a one-time sign-in link.
            </p>
            {auth.notice && (
              <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-center text-sm text-amber-800">{auth.notice}</p>
            )}
            <form onSubmit={requestLoginLink} className="mt-5 space-y-3">
              <TextInput
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@yourfacility.com"
              />
              <button
                type="submit"
                disabled={requesting || !email.trim()}
                className="flex w-full items-center justify-center gap-2 rounded-lg bg-toca-navy px-4 py-2.5 text-sm font-semibold text-white hover:bg-toca-purple disabled:opacity-50"
              >
                <Mail size={15} /> {requesting ? 'Sending…' : 'Email me a sign-in link'}
              </button>
            </form>
            {requestNotice && <p className="mt-3 text-center text-sm text-gray-600">{requestNotice}</p>}
            <p className="mt-5 text-center text-xs text-gray-400">
              No access yet? Ask your Bond Sports contact to add your email.
            </p>
          </div>
        )}
        {auth.status === 'ok' && children(auth.organizationIds)}
      </main>
    </div>
  );
}
