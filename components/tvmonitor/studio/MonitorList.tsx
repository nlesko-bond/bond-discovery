'use client';

import { useCallback, useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { ExternalLink, MonitorPlay, Pencil, Plus, Trash2 } from 'lucide-react';
import { normalizeTvMonitorSlug } from '@/lib/tvmonitor-config';
import { TV_MONITOR_TEMPLATES } from '@/lib/tvmonitor-templates';
import { Field, NumberInput, SectionCard, Select, TextInput } from '@/components/tvmonitor/studio/fields';
import type { ITvMonitorPage, TvMonitorTemplateKey } from '@/types/tvmonitor';

/** Mini wireframe drawn per template so the picker reads at a glance. */
function TemplateThumb({ templateKey }: { templateKey: TvMonitorTemplateKey }) {
  const bar = 'rounded-sm bg-slate-300';
  const accent = 'rounded-sm bg-amber-300';
  const body = (
    <div className="flex flex-1 gap-1">
      <div className="flex-1 space-y-1">
        <div className={`${bar} h-1.5 w-full`} />
        <div className={`${bar} h-4 w-full`} />
        <div className={`${bar} h-4 w-full`} />
      </div>
      <div className="flex-1 space-y-1">
        <div className={`${bar} h-1.5 w-full`} />
        <div className={`${bar} h-4 w-full`} />
      </div>
    </div>
  );
  return (
    <div className="flex h-24 w-full flex-col gap-1 rounded-md bg-slate-800 p-2">
      {templateKey !== 'custom' && <div className={`${bar} h-2 w-full opacity-80`} />}
      <div className="flex flex-1 gap-1">
        {templateKey === 'sponsor-spotlight' && <div className={`${accent} w-1/4`} />}
        {body}
      </div>
      {templateKey === 'promo-banner' && <div className={`${accent} h-3 w-full`} />}
    </div>
  );
}

/**
 * Monitor pages list + creation wizard. Shared by the Bond admin and the
 * external studio; the studio restricts organization choice to granted orgs.
 */
export default function MonitorList({
  apiBase,
  editorBasePath,
  allowedOrgIds,
}: {
  apiBase: string;
  editorBasePath: string;
  /** null = any org (Bond admin); array = restrict to these org IDs. */
  allowedOrgIds: number[] | null;
}) {
  const router = useRouter();
  const [pages, setPages] = useState<ITvMonitorPage[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [form, setForm] = useState({
    template: 'rink-classic' as TvMonitorTemplateKey,
    name: '',
    slug: '',
    slugTouched: false,
    organization_id: allowedOrgIds?.[0] ?? 0,
    facility_id: 0,
    resource_ids: '',
  });

  const fetchPages = useCallback(async () => {
    try {
      const res = await fetch(apiBase, { cache: 'no-store' });
      const data = await res.json();
      setPages(data.pages || []);
    } catch (error) {
      console.error('Failed to fetch TV monitor pages:', error);
    } finally {
      setLoading(false);
    }
  }, [apiBase]);

  useEffect(() => {
    void fetchPages();
  }, [fetchPages]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setCreating(true);
    setCreateError(null);
    try {
      const resourceIds = form.resource_ids
        .split(/[,\s]+/)
        .map((s) => parseInt(s.trim(), 10))
        .filter((n) => Number.isFinite(n) && n > 0);
      const res = await fetch(apiBase, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: form.name,
          slug: form.slug,
          organization_id: form.organization_id,
          facility_id: form.facility_id,
          template: form.template,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Create failed');
      // Stamp initial resources into the template config in one follow-up save.
      if (resourceIds.length) {
        await fetch(`${apiBase}/${data.page.slug}`, {
          method: 'PATCH',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            config: { ...data.page.config, schedule: { ...data.page.config.schedule, resourceIds } },
          }),
        });
      }
      router.push(`${editorBasePath}/${data.page.slug}`);
    } catch (error) {
      setCreateError(error instanceof Error ? error.message : 'Create failed');
      setCreating(false);
    }
  }

  async function handleDelete(slug: string) {
    if (!confirm(`Delete TV monitor "${slug}"? Any TV showing it will go dark.`)) return;
    await fetch(`${apiBase}/${slug}`, { method: 'DELETE' });
    void fetchPages();
  }

  if (loading) {
    return (
      <div className="animate-pulse space-y-4">
        {[1, 2, 3].map((i) => (
          <div key={i} className="h-20 rounded-lg bg-gray-200" />
        ))}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <p className="text-sm text-gray-600">
          {pages.length} monitor {pages.length === 1 ? 'page' : 'pages'}
        </p>
        <button
          onClick={() => setShowCreate((v) => !v)}
          className="flex items-center gap-2 rounded-lg bg-toca-navy px-4 py-2 text-sm font-semibold text-white hover:bg-toca-purple"
        >
          <Plus size={16} /> New TV monitor
        </button>
      </div>

      {showCreate && (
        <SectionCard title="Create a TV monitor" subtitle="Pick a starting template — everything is editable afterwards.">
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
              {TV_MONITOR_TEMPLATES.map((template) => (
                <button
                  type="button"
                  key={template.key}
                  onClick={() => setForm((f) => ({ ...f, template: template.key }))}
                  className={`rounded-xl border-2 p-3 text-left transition-colors ${
                    form.template === template.key ? 'border-toca-navy bg-blue-50/50' : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <TemplateThumb templateKey={template.key} />
                  <div className="mt-2 text-sm font-semibold text-gray-900">{template.name}</div>
                  <div className="mt-0.5 text-xs leading-snug text-gray-500">{template.description}</div>
                </button>
              ))}
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Name" hint="Shown in this list, not on the TV.">
                <TextInput
                  value={form.name}
                  required
                  onChange={(e) =>
                    setForm((f) => ({
                      ...f,
                      name: e.target.value,
                      slug: f.slugTouched ? f.slug : normalizeTvMonitorSlug(e.target.value),
                    }))
                  }
                  placeholder="Hatfield Ice — Lobby TV"
                />
              </Field>
              <Field label="Page URL name" hint={`Page will live at /tvmonitor/${form.slug || '…'}`}>
                <TextInput
                  value={form.slug}
                  required
                  onChange={(e) => setForm((f) => ({ ...f, slug: normalizeTvMonitorSlug(e.target.value), slugTouched: true }))}
                  placeholder="hatfield-lobby"
                />
              </Field>
              <Field label="Organization ID">
                {allowedOrgIds && allowedOrgIds.length > 0 ? (
                  <Select
                    value={String(form.organization_id)}
                    onChange={(v) => setForm((f) => ({ ...f, organization_id: Number(v) }))}
                    options={allowedOrgIds.map((id) => ({ value: String(id), label: `Organization #${id}` }))}
                  />
                ) : (
                  <NumberInput value={form.organization_id} min={1} onChange={(n) => setForm((f) => ({ ...f, organization_id: n }))} />
                )}
              </Field>
              <Field label="Facility ID">
                <NumberInput value={form.facility_id} min={1} onChange={(n) => setForm((f) => ({ ...f, facility_id: n }))} />
              </Field>
              <Field label="Resource (space) IDs" hint="Optional now — comma separated, up to 6.">
                <TextInput
                  value={form.resource_ids}
                  onChange={(e) => setForm((f) => ({ ...f, resource_ids: e.target.value }))}
                  placeholder="2191, 2192"
                />
              </Field>
            </div>

            {createError && <p className="text-sm text-red-600">{createError}</p>}
            <div className="flex gap-2">
              <button
                type="submit"
                disabled={creating || !form.name || !form.slug || !form.organization_id || !form.facility_id}
                className="rounded-lg bg-toca-navy px-5 py-2 text-sm font-semibold text-white hover:bg-toca-purple disabled:opacity-50"
              >
                {creating ? 'Creating…' : 'Create & open builder'}
              </button>
              <button type="button" onClick={() => setShowCreate(false)} className="rounded-lg border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50">
                Cancel
              </button>
            </div>
          </form>
        </SectionCard>
      )}

      {pages.length === 0 && !showCreate ? (
        <div className="rounded-xl border border-dashed border-gray-300 p-10 text-center">
          <MonitorPlay className="mx-auto mb-3 text-gray-400" size={36} />
          <p className="font-medium text-gray-700">No TV monitors yet</p>
          <p className="mt-1 text-sm text-gray-500">Create one from a template and put it on a lobby screen in minutes.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {pages.map((page) => (
            <div key={page.id} className="flex items-center justify-between gap-4 rounded-xl border border-gray-200 bg-white p-4 shadow-sm">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <span className="truncate font-semibold text-gray-900">{page.name}</span>
                  <span className={`rounded-full px-2 py-0.5 text-xs font-medium ${page.is_active ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'}`}>
                    {page.is_active ? 'Live' : 'Off'}
                  </span>
                </div>
                <div className="mt-0.5 truncate text-sm text-gray-500">
                  /tvmonitor/{page.slug} · org #{page.organization_id} · facility #{page.facility_id} ·{' '}
                  {page.config.schedule.resourceIds.length} resource{page.config.schedule.resourceIds.length === 1 ? '' : 's'}
                </div>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <a
                  href={`/tvmonitor/${page.slug}`}
                  target="_blank"
                  rel="noreferrer"
                  className="rounded-lg border border-gray-300 p-2 text-gray-600 hover:bg-gray-50"
                  title="Open live page"
                >
                  <ExternalLink size={16} />
                </a>
                <button
                  onClick={() => router.push(`${editorBasePath}/${page.slug}`)}
                  className="flex items-center gap-1 rounded-lg bg-toca-navy px-3 py-2 text-sm font-medium text-white hover:bg-toca-purple"
                >
                  <Pencil size={14} /> Edit
                </button>
                <button
                  onClick={() => handleDelete(page.slug)}
                  className="rounded-lg border border-gray-300 p-2 text-gray-400 hover:bg-red-50 hover:text-red-500"
                  title="Delete"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
