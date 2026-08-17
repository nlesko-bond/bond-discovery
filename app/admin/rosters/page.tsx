'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { AlertTriangle, ExternalLink, Plus } from 'lucide-react';
import type { RosterPageConfig } from '@/types/rosters';

interface PartnerGroup {
  id: string;
  name: string;
  hasApiKey: boolean;
}

const UNGROUPED = 'Not assigned to a customer';

export default function AdminRostersPage() {
  const [pages, setPages] = useState<RosterPageConfig[] | null>(null);
  const [groups, setGroups] = useState<PartnerGroup[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [name, setName] = useState('');
  const [slug, setSlug] = useState('');
  const [partnerGroupId, setPartnerGroupId] = useState('');

  const load = useCallback(async () => {
    try {
      const response = await fetch('/api/admin/rosters');
      if (!response.ok) throw new Error('load');
      const data = await response.json();
      setPages(data.pages);
      setGroups(data.partnerGroups ?? []);
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
        body: JSON.stringify({ name, slug, partnerGroupId: partnerGroupId || null }),
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

  /** Grouped by customer, so a slug is never floating on its own. */
  const grouped = useMemo(() => {
    const byGroup = new Map<string, RosterPageConfig[]>();
    for (const page of pages ?? []) {
      const key = page.partnerGroupName || UNGROUPED;
      byGroup.set(key, [...(byGroup.get(key) ?? []), page]);
    }
    return [...byGroup.entries()].sort(([a], [b]) =>
      a === UNGROUPED ? 1 : b === UNGROUPED ? -1 : a.localeCompare(b)
    );
  }, [pages]);

  const selectedGroup = groups.find((g) => g.id === partnerGroupId);

  return (
    <div className="max-w-4xl">
      <header className="mb-6">
        <h1 className="text-2xl font-semibold text-gray-900">Rosters</h1>
        <p className="mt-1 text-sm text-gray-600">
          League roster pages and staff check-in sheets, at <code>/rosters/&#123;slug&#125;</code>.
          A customer can have as many as they like; they share that customer&rsquo;s Bond API key.
        </p>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <form
        onSubmit={handleCreate}
        className="mb-6 flex flex-wrap items-end gap-3 rounded-xl border border-gray-200 bg-white p-4"
      >
        <div className="min-w-[11rem] flex-1">
          <label htmlFor="roster-group" className="label">
            Customer
          </label>
          <select
            id="roster-group"
            className="input"
            value={partnerGroupId}
            onChange={(e) => setPartnerGroupId(e.target.value)}
          >
            <option value="">— none —</option>
            {groups.map((group) => (
              <option key={group.id} value={group.id}>
                {group.name}
                {group.hasApiKey ? '' : ' (no API key)'}
              </option>
            ))}
          </select>
        </div>

        <div className="min-w-[11rem] flex-1">
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
            placeholder="Fall Leagues"
          />
        </div>

        <div className="min-w-[11rem] flex-1">
          <label htmlFor="roster-slug" className="label">
            Slug
          </label>
          <input
            id="roster-slug"
            className="input"
            value={slug}
            onChange={(e) => setSlug(e.target.value)}
            placeholder="coppermine-fall"
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

        {partnerGroupId && !selectedGroup?.hasApiKey && (
          <p className="flex w-full items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            {selectedGroup?.name} has no Bond API key, so pages under it can&rsquo;t load data. Add
            one to the partner group, or set a key on the page itself.
          </p>
        )}
      </form>

      {pages === null && <p className="text-sm text-gray-500">Loading…</p>}

      {pages?.length === 0 && (
        <div className="rounded-xl border border-dashed border-gray-300 px-6 py-10 text-center">
          <h2 className="text-base font-medium text-gray-900">No roster pages yet</h2>
          <p className="mx-auto mt-1 max-w-md text-sm text-gray-600">
            Pick a customer above and create one. It inherits their Bond API key, so there is
            nothing else to configure before you can point it at an organization.
          </p>
        </div>
      )}

      <div className="space-y-6">
        {grouped.map(([groupName, groupPages]) => (
          <section key={groupName}>
            <h2 className="mb-2 flex items-baseline justify-between border-b border-gray-200 pb-1 text-sm font-semibold uppercase tracking-wide text-gray-700">
              {groupName}
              <span className="text-xs font-normal normal-case text-gray-500">
                {groupPages.length} page{groupPages.length === 1 ? '' : 's'}
              </span>
            </h2>

            <ul className="divide-y divide-gray-100 rounded-xl border border-gray-200 bg-white">
              {groupPages.map((page) => (
                <li key={page.id} className="flex flex-wrap items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
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
                      {!page.apiKey && (
                        <span className="badge bg-red-100 text-red-800">No API key</span>
                      )}
                    </div>
                    <p className="truncate text-xs text-gray-500">
                      /rosters/{page.slug} · orgs {page.organizationIds.join(', ') || '—'} · names:{' '}
                      {page.fieldVisibility.nameMode}
                      {page.apiKeyInherited && ' · key inherited'}
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
                    Public
                    <ExternalLink size={14} aria-hidden />
                  </a>
                  <a
                    href={`/rosters/${page.slug}/staff`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900"
                  >
                    Staff
                    <ExternalLink size={14} aria-hidden />
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}
