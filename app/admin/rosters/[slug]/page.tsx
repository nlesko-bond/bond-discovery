'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { AlertTriangle, ChevronLeft } from 'lucide-react';
import {
  ROSTER_NAME_MODE_LABELS,
  ROSTER_NAME_MODES,
  type RosterNameMode,
  type RosterPageConfig,
} from '@/types/rosters';

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

export default function AdminRosterEditor() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [config, setConfig] = useState<RosterPageConfig | null>(null);
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [error, setError] = useState<string | null>(null);
  const [viewerPassword, setViewerPassword] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  useEffect(() => {
    (async () => {
      const response = await fetch(`/api/admin/rosters/${slug}`);
      if (!response.ok) {
        setError('Could not load this page.');
        return;
      }
      const data = await response.json();
      setConfig(data.page);
    })();
  }, [slug]);

  const patch = useCallback((updates: Partial<RosterPageConfig>) => {
    setConfig((current) => (current ? { ...current, ...updates } : current));
    setSaveState('dirty');
  }, []);

  async function save() {
    if (!config) return;
    setSaveState('saving');
    setError(null);

    const body: Record<string, unknown> = {
      name: config.name,
      isActive: config.isActive,
      organizationIds: config.organizationIds,
      programFilter: config.programFilter,
      sessionWindow: config.sessionWindow,
      branding: config.branding,
      pageAccess: config.pageAccess,
      fieldVisibility: config.fieldVisibility,
      allowIndexing: config.allowIndexing,
      allowPrint: config.allowPrint,
      isYouth: config.isYouth,
      apiKey: config.apiKey ?? null,
    };
    if (viewerPassword) body.viewerPassword = viewerPassword;
    if (staffPassword) body.staffPassword = staffPassword;

    const response = await fetch(`/api/admin/rosters/${slug}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(body),
    });
    const data = await response.json();

    if (!response.ok) {
      setError(data.error || 'Save failed.');
      setSaveState('error');
      return;
    }
    setConfig(data.page);
    setViewerPassword('');
    setStaffPassword('');
    setSaveState('saved');
  }

  async function remove() {
    if (!confirm(`Delete the roster page "${slug}"? This cannot be undone.`)) return;
    const response = await fetch(`/api/admin/rosters/${slug}`, { method: 'DELETE' });
    if (response.ok) router.push('/admin/rosters');
  }

  if (error && !config) {
    return <p className="text-sm text-red-700">{error}</p>;
  }
  if (!config) {
    return <p className="text-sm text-gray-500">Loading…</p>;
  }

  const fv = config.fieldVisibility;
  const namesArePublic = config.pageAccess === 'public' && fv.nameMode !== 'numberOnly';

  return (
    <div className="max-w-3xl space-y-6">
      <header className="flex flex-wrap items-center gap-3">
        <Link href="/admin/rosters" className="inline-flex items-center gap-1 text-sm text-gray-600">
          <ChevronLeft size={16} aria-hidden />
          Rosters
        </Link>
        <h1 className="flex-1 text-xl font-semibold text-gray-900">{config.name}</h1>
        <span className="text-sm text-gray-500">
          {saveState === 'saving' ? 'Saving…' : saveState === 'saved' ? 'Saved' : saveState === 'dirty' ? 'Unsaved changes' : ''}
        </span>
        <button type="button" onClick={save} disabled={saveState === 'saving'} className="btn-primary">
          Save changes
        </button>
      </header>

      {error && (
        <p role="alert" className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      {/* --- Page & scope --- */}
      <section className="card p-4">
        <h2 className="mb-3 font-medium text-gray-900">Page &amp; scope</h2>

        <label className="label" htmlFor="name">Name</label>
        <input id="name" className="input mb-3" value={config.name} onChange={(e) => patch({ name: e.target.value })} />

        <label className="label" htmlFor="orgs">Organization IDs (comma separated)</label>
        <input
          id="orgs"
          className="input mb-3"
          value={config.organizationIds.join(', ')}
          onChange={(e) =>
            patch({
              organizationIds: e.target.value
                .split(',')
                .map((v) => Number.parseInt(v.trim(), 10))
                .filter((n) => Number.isFinite(n)),
            })
          }
        />

        <div className="mb-3 grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="past">Include sessions started within (days)</label>
            <input
              id="past"
              type="number"
              className="input"
              value={config.sessionWindow.pastDays}
              onChange={(e) =>
                patch({ sessionWindow: { ...config.sessionWindow, pastDays: Number(e.target.value) } })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="future">…and starting within (days)</label>
            <input
              id="future"
              type="number"
              className="input"
              value={config.sessionWindow.futureDays}
              onChange={(e) =>
                patch({ sessionWindow: { ...config.sessionWindow, futureDays: Number(e.target.value) } })
              }
            />
          </div>
        </div>
        <p className="mb-3 text-xs text-gray-500">
          A rolling window, so new seasons appear without editing this page.
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.isActive}
            onChange={(e) => patch({ isActive: e.target.checked })}
          />
          Published — live at /rosters/{config.slug}
        </label>
      </section>

      {/* --- Privacy & fields --- */}
      <section className="card p-4">
        <h2 className="mb-1 font-medium text-gray-900">Privacy &amp; fields</h2>
        <p className="mb-3 text-xs text-gray-500">
          These control what leaves the server. Hidden fields are never sent to the browser, not
          merely hidden in the page.
        </p>

        <label className="flex items-center gap-2 pb-3 text-sm">
          <input
            type="checkbox"
            checked={config.isYouth}
            onChange={(e) => patch({ isYouth: e.target.checked })}
          />
          This page covers participants under 18
        </label>

        <label className="label" htmlFor="nameMode">Names shown publicly</label>
        <select
          id="nameMode"
          className="input mb-2"
          value={fv.nameMode}
          onChange={(e) => patch({ fieldVisibility: { ...fv, nameMode: e.target.value as RosterNameMode } })}
        >
          {ROSTER_NAME_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {ROSTER_NAME_MODE_LABELS[mode]}
            </option>
          ))}
        </select>

        {namesArePublic && (
          <p className="mb-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              This page will show participant names to anyone with the link.
              {config.isYouth && (
                <>
                  {' '}
                  For under-18 participants, publishing names normally requires written consent from
                  a parent or guardian.
                </>
              )}{' '}
              No comparable platform publishes full names by default.
            </span>
          </p>
        )}

        <div className="mb-3 space-y-1.5 text-sm">
          {([
            ['showPhoto', 'Show participant photos'],
            ['showJerseyNumber', 'Show jersey numbers'],
            ['showPosition', 'Show positions'],
            ['showTeamRole', 'Show team roles'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fv[key]}
                onChange={(e) => patch({ fieldVisibility: { ...fv, [key]: e.target.checked } })}
              />
              {label}
            </label>
          ))}
        </div>

        <h3 className="mb-1 mt-4 text-sm font-medium text-gray-900">Staff view only</h3>
        <p className="mb-2 text-xs text-gray-500">
          Shown only to someone who has entered the staff password.
        </p>
        <div className="space-y-1.5 text-sm">
          {([
            ['staffShowContact', 'Contact details'],
            ['staffShowBirthDate', 'Date of birth and age'],
            ['staffShowGender', 'Gender'],
            ['staffShowWaiver', 'Waiver status'],
            ['staffShowRegistration', 'Registration date and products'],
            ['staffShowGuardian', 'Guardian name'],
          ] as const).map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={fv[key]}
                onChange={(e) => patch({ fieldVisibility: { ...fv, [key]: e.target.checked } })}
              />
              {label}
            </label>
          ))}
        </div>

        {config.isYouth ? (
          <p className="mt-3 text-xs text-gray-500">
            Contact details will show the guardian&rsquo;s, not the participant&rsquo;s — enforced for
            youth pages regardless of this setting.
          </p>
        ) : (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fv.contactSource === 'primary'}
              onChange={(e) =>
                patch({ fieldVisibility: { ...fv, contactSource: e.target.checked ? 'primary' : 'participant' } })
              }
            />
            Show the guardian&rsquo;s contact details rather than the participant&rsquo;s
          </label>
        )}
      </section>

      {/* --- Access & export --- */}
      <section className="card p-4">
        <h2 className="mb-3 font-medium text-gray-900">Access &amp; export</h2>

        <label className="label" htmlFor="access">Who can open this page</label>
        <select
          id="access"
          className="input mb-3"
          value={config.pageAccess}
          onChange={(e) => patch({ pageAccess: e.target.value as RosterPageConfig['pageAccess'] })}
        >
          <option value="public">Anyone with the link</option>
          <option value="password">Anyone with the viewer password</option>
          <option value="staff">Staff only</option>
        </select>

        <label className="label" htmlFor="vpw">
          Viewer password {config.hasViewerPassword && <span className="text-gray-400">(set — type to replace)</span>}
        </label>
        <input id="vpw" type="password" className="input mb-3" value={viewerPassword} onChange={(e) => setViewerPassword(e.target.value)} />

        <label className="label" htmlFor="spw">
          Staff password {config.hasStaffPassword && <span className="text-gray-400">(set — type to replace)</span>}
        </label>
        <input id="spw" type="password" className="input mb-3" value={staffPassword} onChange={(e) => setStaffPassword(e.target.value)} />

        <label className="mb-2 flex items-center gap-2 text-sm">
          <input type="checkbox" checked={config.allowPrint} onChange={(e) => patch({ allowPrint: e.target.checked })} />
          Allow printing and export
        </label>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.allowIndexing}
            onChange={(e) => patch({ allowIndexing: e.target.checked })}
          />
          Allow search engines to index this page
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Off by default. Once a page carrying names is indexed, removing it from search results is
          slow and unreliable.
        </p>
      </section>

      <section className="card border-red-200 p-4">
        <h2 className="mb-2 font-medium text-red-900">Delete</h2>
        <button type="button" onClick={remove} className="btn-secondary text-red-700">
          Delete this roster page
        </button>
      </section>
    </div>
  );
}
