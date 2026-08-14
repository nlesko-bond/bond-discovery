'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ExternalLink, Plus } from 'lucide-react';
import type { RosterPageConfig } from '@/types/rosters';

export default function AdminRostersPage() {
  const [pages, setPages] = useState<RosterPageConfig[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/rosters');
      if (!response.ok) throw new Error('load');
      const data = await response.json();
      setPages(data.pages);
    } catch {
      setError('Could not load roster pages.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  async function handleCreate(event: React.FormEvent) {
    event.preventDefault();
    setCreating(true);
    setError(null);
    try {
      const response = await fetch('/api/admin/rosters', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, slug }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error || 'Could not create the page.');
        return;
      }
      setName('');
      setSlug('');
      await load();
    } finally {
      setCreating(false);
    }
  }

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Rosters</h1>
        <p className="mt-1 text-sm text-gray-600">
          League roster pages and staff check-in sheets, at <code>/rosters/&#123;slug&#125;</code>.
          New pages start unpublished and show no participant names until you choose to.
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form onSubmit={handleCreate} className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4">
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="roster-name" className="label">
            Name
          </label>
          <input
            id="roster-name"
            className="input"
            value={name}
            onChange={(e) => {
              setName(e.target.value);
              if (!slug) {
                setSlug(e.target.value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, ''));
              }
            }}
            placeholder="Coppermine Rosters"
          />
        </div>
        <div className="min-w-[12rem] flex-1">
          <label htmlFor="roster-slug" className="label">
            Slug
          </label>
          <input
            id="roster-slug"
            className="input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="coppermine"
          />
        </div>
        <button
          type="submit"
          disabled={creating || !name || !slug}
          className="btn-primary inline-flex items-center gap-2"
        >
          <Plus size={16} aria-hidden />
          {creating ? 'Creating…' : 'Create'}
        </button>
      </form>

      {pages === null && <p className="text-sm text-gray-500">Loading…</p>}

      {pages?.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center">
          <h2 className="text-base font-medium text-gray-900">No roster pages yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
            Create one above, point it at an organization, then publish it when the field settings
            look right.
          </p>
        </div>
      )}

      {pages && pages.length > 0 && (
        <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
          {pages.map((page) => (
            <li key={page.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2">
                  <span className="font-medium text-gray-900">{page.name}</span>
                  <span
                    className={`badge ${page.isActive ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-600'}`}
                  >
                    {page.isActive ? 'Published' : 'Draft'}
                  </span>
                  {page.isYouth && <span className="badge bg-amber-100 text-amber-800">Youth</span>}
                  {page.pageAccess !== 'public' && (
                    <span className="badge bg-blue-100 text-blue-800">
                      {page.pageAccess === 'staff' ? 'Staff only' : 'Password'}
                    </span>
                  )}
                </div>
                <p className="truncate text-xs text-gray-500">
                  /rosters/{page.slug} · orgs {page.organizationIds.join(', ') || '—'} ·{' '}
                  names: {page.fieldVisibility.nameMode}
                </p>
              </div>

              <Link href={`/admin/rosters/${page.slug}`} className="btn-secondary text-sm">
                Edit
              </Link>
              <a
                href={`/rosters/${page.slug}`}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
              >
                View
                <ExternalLink size={14} aria-hidden />
              </a>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
