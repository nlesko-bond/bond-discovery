'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { ChevronLeft, ExternalLink } from 'lucide-react';
import type { RosterPageConfig } from '@/types/rosters';
import { RosterEditorSectionNav } from './components/RosterEditorSectionNav';
import { RosterAccessSection } from './sections/RosterAccessSection';
import { RosterAppearanceSection } from './sections/RosterAppearanceSection';
import { RosterPageSection } from './sections/RosterPageSection';
import { RosterPrivacySection } from './sections/RosterPrivacySection';
import { RosterProgramsSection } from './sections/RosterProgramsSection';
import type { PartnerGroupOption, RosterEditorSectionId } from './roster-editor-types';

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

/** `programId:sessionId` per line — the shape the pinned-sessions textarea uses. */
function parsePinned(text: string): Array<{ programId: number; sessionId: number }> {
  return text
    .split('\n')
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [p, s] = line.split(':').map((v) => Number.parseInt(v.trim(), 10));
      return { programId: p, sessionId: s };
    })
    .filter((p) => Number.isFinite(p.programId) && Number.isFinite(p.sessionId));
}

function formatPinned(pins: Array<{ programId: number; sessionId: number }>): string {
  return pins.map((p) => `${p.programId}:${p.sessionId}`).join('\n');
}

function parseIds(text: string): number[] {
  return text
    .split(',')
    .map((v) => Number.parseInt(v.trim(), 10))
    .filter((n) => Number.isFinite(n));
}

export default function AdminRosterEditor() {
  const params = useParams<{ slug: string }>();
  const router = useRouter();
  const slug = params.slug;

  const [config, setConfig] = useState<RosterPageConfig | null>(null);
  const [partnerGroups, setPartnerGroups] = useState<PartnerGroupOption[]>([]);
  const [section, setSection] = useState<RosterEditorSectionId>('page');
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [error, setError] = useState<string | null>(null);

  // Free-text mirrors: editing a comma or colon list character by character
  // would otherwise destroy what you are half-way through typing.
  const [slugInput, setSlugInput] = useState('');
  const [organizationIdsInput, setOrganizationIdsInput] = useState('');
  const [programIdsInput, setProgramIdsInput] = useState('');
  const [pinnedInput, setPinnedInput] = useState('');
  const [viewerPassword, setViewerPassword] = useState('');
  const [staffPassword, setStaffPassword] = useState('');

  const hydrate = useCallback((page: RosterPageConfig) => {
    setConfig(page);
    setSlugInput(page.slug);
    setOrganizationIdsInput(page.organizationIds.join(', '));
    setProgramIdsInput(page.programFilter.programIds.join(', '));
    setPinnedInput(formatPinned(page.pinnedSessions));
  }, []);

  useEffect(() => {
    (async () => {
      const response = await fetch(`/api/admin/rosters/${slug}`);
      if (!response.ok) {
        setError('Could not load this page.');
        return;
      }
      hydrate((await response.json()).page);

      const list = await fetch('/api/admin/rosters');
      if (list.ok) setPartnerGroups((await list.json()).partnerGroups ?? []);
    })();
  }, [slug, hydrate]);

  const patch = useCallback((updates: Partial<RosterPageConfig>) => {
    setConfig((current) => (current ? { ...current, ...updates } : current));
    setSaveState('dirty');
  }, []);

  // Mirror the free-text fields back into config as they are edited.
  useEffect(() => {
    if (!config) return;
    const ids = parseIds(organizationIdsInput);
    if (ids.join(',') !== config.organizationIds.join(',')) patch({ organizationIds: ids });
  }, [organizationIdsInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!config) return;
    const ids = parseIds(programIdsInput);
    if (ids.join(',') !== config.programFilter.programIds.join(',')) {
      patch({ programFilter: { ...config.programFilter, programIds: ids } });
    }
  }, [programIdsInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (!config) return;
    const pins = parsePinned(pinnedInput);
    if (formatPinned(pins) !== formatPinned(config.pinnedSessions)) patch({ pinnedSessions: pins });
  }, [pinnedInput]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    if (config && slugInput !== config.slug) setSaveState('dirty');
  }, [slugInput, config]);

  // Guard against losing password and privacy edits to a stray navigation.
  useEffect(() => {
    if (saveState !== 'dirty') return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', onBeforeUnload);
    return () => window.removeEventListener('beforeunload', onBeforeUnload);
  }, [saveState]);

  async function save() {
    if (!config) return;
    setSaveState('saving');
    setError(null);

    const body: Record<string, unknown> = {
      name: config.name,
      slug: slugInput,
      isActive: config.isActive,
      organizationIds: config.organizationIds,
      programFilter: config.programFilter,
      pinnedSessions: config.pinnedSessions,
      sessionWindow: config.sessionWindow,
      branding: config.branding,
      pageAccess: config.pageAccess,
      fieldVisibility: config.fieldVisibility,
      allowIndexing: config.allowIndexing,
      allowPrint: config.allowPrint,
      isYouth: config.isYouth,
      partnerGroupId: config.partnerGroupId ?? null,
      // Only send a key that is genuinely this page's own override.
      ...(config.apiKeyInherited ? {} : { apiKey: config.apiKey ?? null }),
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

    hydrate(data.page);
    setViewerPassword('');
    setStaffPassword('');
    setSaveState('saved');

    // The slug is the URL, so a rename has to move the editor with it.
    if (data.page.slug !== slug) router.replace(`/admin/rosters/${data.page.slug}`);
  }

  async function remove() {
    if (!confirm(`Delete the roster page "${slug}"? This cannot be undone.`)) return;
    const response = await fetch(`/api/admin/rosters/${slug}`, { method: 'DELETE' });
    if (response.ok) router.push('/admin/rosters');
  }

  if (error && !config) return <p className="text-sm text-red-700">{error}</p>;
  if (!config) return <p className="text-sm text-gray-500">Loading…</p>;

  const sectionProps = { config, patch };

  return (
    <div className="max-w-5xl">
      <header className="mb-6 flex flex-wrap items-center gap-3">
        <Link href="/admin/rosters" className="inline-flex items-center gap-1 text-sm text-gray-600">
          <ChevronLeft size={16} aria-hidden />
          Rosters
        </Link>

        <div className="min-w-0 flex-1">
          <h1 className="truncate text-xl font-semibold text-gray-900">{config.name}</h1>
          <p className="truncate text-xs text-gray-500">
            {config.partnerGroupName ? `${config.partnerGroupName} · ` : ''}
            /rosters/{config.slug}
          </p>
        </div>

        <a
          href={`/rosters/${config.slug}`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Public page
          <ExternalLink size={14} aria-hidden />
        </a>
        <a
          href={`/rosters/${config.slug}/staff`}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 px-3 py-1.5 text-sm text-gray-700 hover:bg-gray-50"
        >
          Staff tool
          <ExternalLink size={14} aria-hidden />
        </a>

        <span className="text-sm text-gray-500" role="status">
          {saveState === 'saving'
            ? 'Saving…'
            : saveState === 'saved'
              ? 'Saved'
              : saveState === 'dirty'
                ? 'Unsaved changes'
                : ''}
        </span>

        <button
          type="button"
          onClick={save}
          disabled={saveState === 'saving'}
          className="btn-primary"
        >
          Save changes
        </button>
      </header>

      {error && (
        <p role="alert" className="mb-4 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">
          {error}
        </p>
      )}

      <div className="flex flex-col gap-6 md:flex-row">
        <aside className="md:w-64 md:shrink-0">
          <RosterEditorSectionNav activeSection={section} onSectionChange={setSection} />

          <div className="mt-6 rounded-xl border border-red-200 p-3">
            <button type="button" onClick={remove} className="text-sm text-red-700 hover:underline">
              Delete this page
            </button>
          </div>
        </aside>

        <div className="min-w-0 flex-1 rounded-xl border border-gray-200 bg-white p-5">
          {section === 'page' && (
            <RosterPageSection
              {...sectionProps}
              partnerGroups={partnerGroups}
              organizationIdsInput={organizationIdsInput}
              setOrganizationIdsInput={setOrganizationIdsInput}
              slugInput={slugInput}
              setSlugInput={setSlugInput}
            />
          )}
          {section === 'programs' && (
            <RosterProgramsSection
              {...sectionProps}
              programIdsInput={programIdsInput}
              setProgramIdsInput={setProgramIdsInput}
              pinnedInput={pinnedInput}
              setPinnedInput={setPinnedInput}
            />
          )}
          {section === 'appearance' && <RosterAppearanceSection {...sectionProps} />}
          {section === 'privacy' && <RosterPrivacySection {...sectionProps} />}
          {section === 'access' && (
            <RosterAccessSection
              {...sectionProps}
              viewerPassword={viewerPassword}
              setViewerPassword={setViewerPassword}
              staffPassword={staffPassword}
              setStaffPassword={setStaffPassword}
            />
          )}
        </div>
      </div>
    </div>
  );
}
