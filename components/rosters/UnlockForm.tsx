'use client';

import { useState } from 'react';
import { Lock } from 'lucide-react';

interface Props {
  slug: string;
  scope: 'viewer' | 'staff';
  title: string;
  description: string;
  onUnlocked: () => void;
}

export function UnlockForm({ slug, scope, title, description, onUnlocked }: Props) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setSubmitting(true);
    setError(null);

    try {
      const response = await fetch(`/api/rosters/${slug}/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ password, scope }),
      });

      if (!response.ok) {
        // Deliberately generic: the response does not distinguish "wrong
        // password" from "this page has no password for that scope".
        setError('Incorrect password.');
        setPassword('');
        return;
      }

      onUnlocked();
    } catch {
      setError('Could not reach the server. Try again.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="mx-auto flex min-h-[60vh] max-w-md flex-col justify-center px-4">
      <div className="rounded-xl border border-gray-200 bg-white p-6 shadow-sm">
        <div className="mb-4 flex items-center gap-3">
          <span
            className="flex h-10 w-10 items-center justify-center rounded-full"
            style={{ backgroundColor: 'var(--roster-accent-light, #e2e8f0)' }}
          >
            <Lock size={18} style={{ color: 'var(--roster-primary, #0f172a)' }} />
          </span>
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{title}</h1>
            <p className="text-sm text-gray-600">{description}</p>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <label htmlFor={`roster-password-${scope}`} className="sr-only">
            Password
          </label>
          <input
            id={`roster-password-${scope}`}
            type="password"
            autoComplete="current-password"
            autoFocus
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="w-full rounded-lg border border-gray-300 px-3 py-2 text-sm focus:border-gray-400 focus:outline-none focus:ring-2 focus:ring-gray-200"
          />

          {error && (
            <p role="alert" className="text-sm text-red-600">
              {error}
            </p>
          )}

          <button
            type="submit"
            disabled={submitting || password.length === 0}
            className="w-full rounded-lg px-3 py-2 text-sm font-medium text-white transition-opacity disabled:opacity-50"
            style={{ backgroundColor: 'var(--roster-primary, #0f172a)' }}
          >
            {submitting ? 'Checking…' : 'Unlock'}
          </button>
        </form>
      </div>
    </div>
  );
}
