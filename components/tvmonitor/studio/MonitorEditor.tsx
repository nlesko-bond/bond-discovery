'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { ArrowLeft, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import MonitorPreview, { BASE_SIZES } from '@/components/tvmonitor/studio/MonitorPreview';
import MediaInput from '@/components/tvmonitor/studio/MediaInput';
import { ColorInput, Field, NumberInput, SectionCard, Select, TextInput, Toggle } from '@/components/tvmonitor/studio/fields';
import { TV_DESIGN_PRESETS } from '@/lib/tvmonitor-templates';
import { resourceIdCapFor } from '@/lib/tvmonitor-config';
import type {
  ITvMonitorPage,
  TvMonitorAdAsset,
  TvMonitorAdSlot,
  TvMonitorConfig,
  TvMonitorSpace,
} from '@/types/tvmonitor';

const FONT_OPTIONS = [
  'Plus Jakarta Sans',
  'Montserrat',
  'Inter',
  'Bebas Neue',
  'Oswald',
  'Roboto Condensed',
  'Open Sans',
  'Poppins',
  'Lato',
  'Anton',
].map((f) => ({ value: f, label: f }));

const RATIO_OPTIONS = [
  { value: 'fill', label: 'Fill the screen (recommended)' },
  { value: '16:9', label: '16:9 — standard TV' },
  { value: '4:3', label: '4:3' },
  { value: '21:9', label: '21:9 — ultrawide' },
  { value: '9:16', label: '9:16 — portrait / vertical TV' },
];

const PLACEMENT_OPTIONS = [
  { value: 'left', label: 'Left rail' },
  { value: 'right', label: 'Right rail' },
  { value: 'top', label: 'Top banner' },
  { value: 'bottom', label: 'Bottom banner' },
  { value: 'header', label: 'Inside header' },
];

function newAdSlot(): TvMonitorAdSlot {
  return {
    id: `ad-${Math.random().toString(36).slice(2, 9)}`,
    enabled: true,
    placement: 'bottom',
    sizeMode: 'pixels',
    sizePx: 150,
    sizePercent: 20,
    fullHeight: false,
    backgroundColor: 'transparent',
    assets: [],
  };
}

function newAdAsset(): TvMonitorAdAsset {
  return {
    id: `asset-${Math.random().toString(36).slice(2, 9)}`,
    type: 'image',
    src: '',
    durationSeconds: 12,
    fit: 'cover',
  };
}

type SaveState = 'clean' | 'dirty' | 'saving' | 'saved' | 'error';

/**
 * Estimated on-screen pixels for an ad slot at the page's TV resolution —
 * shown next to each slot so people size their artwork correctly.
 */
function estimateAdPixels(slot: TvMonitorAdSlot, config: TvMonitorConfig): { w: number; h: number } {
  const base = BASE_SIZES[config.screenRatio] ?? BASE_SIZES.fill;
  const bannerHeight = (s: TvMonitorAdSlot) =>
    s.sizeMode === 'ratio' ? (base.h * s.sizePercent) / 100 : s.sizePx;
  const railWidth = (s: TvMonitorAdSlot) =>
    s.sizeMode === 'ratio' ? (base.w * s.sizePercent) / 100 : s.sizePx;

  const headerH = config.header.enabled ? 130 : 0;
  const others = config.ads.filter((s) => s.enabled && s.id !== slot.id);
  const topH = others.filter((s) => s.placement === 'top').reduce((sum, s) => sum + bannerHeight(s), 0);
  const bottomH = others.filter((s) => s.placement === 'bottom').reduce((sum, s) => sum + bannerHeight(s), 0);
  // Full-height rails carve width off the header/banner column.
  const fullRailW = config.ads
    .filter((s) => s.enabled && s.fullHeight && (s.placement === 'left' || s.placement === 'right') && s.id !== slot.id)
    .reduce((sum, s) => sum + railWidth(s), 0);

  switch (slot.placement) {
    case 'left':
    case 'right':
      return {
        w: Math.round(railWidth(slot)),
        h: slot.fullHeight ? base.h : Math.round(base.h - headerH - topH - bottomH),
      };
    case 'top':
    case 'bottom':
      return { w: Math.round(base.w - fullRailW), h: Math.round(bannerHeight(slot)) };
    case 'header':
    default:
      return { w: Math.round(slot.sizePx * 2.5), h: slot.sizePx };
  }
}

/** Human-friendly aspect ratio, e.g. 640×960 → "2:3 (portrait)". */
function friendlyRatio(w: number, h: number): string {
  if (w <= 0 || h <= 0) return '';
  const target = w / h;
  const candidates: [number, number][] = [
    [1, 1], [4, 3], [3, 4], [3, 2], [2, 3], [16, 9], [9, 16], [21, 9], [2, 1], [1, 2], [3, 1], [4, 1], [5, 1], [6, 1], [8, 1], [10, 1],
  ];
  let best = candidates[0];
  let bestDiff = Infinity;
  for (const [cw, ch] of candidates) {
    const diff = Math.abs(cw / ch - target);
    if (diff < bestDiff) {
      bestDiff = diff;
      best = [cw, ch];
    }
  }
  const shape = target < 0.95 ? ', portrait' : target > 1.05 ? ', landscape' : '';
  const approx = bestDiff / target > 0.05 ? '~' : '';
  return `${approx}${best[0]}:${best[1]}${shape}`;
}

/**
 * The full TV Monitor builder: block settings on the left, a live to-scale
 * preview on the right. Used by both the Bond admin (/admin/tvmonitor) and
 * the org-scoped external studio (/tvmonitor/studio).
 */
export default function MonitorEditor({
  page: initialPage,
  apiBase,
  backHref,
  allowOrgChange = false,
}: {
  page: ITvMonitorPage;
  apiBase: string;
  backHref: string;
  /** Bond admin only — studio users stay org-locked (cannot re-home a page). */
  allowOrgChange?: boolean;
}) {
  const router = useRouter();
  const [page, setPage] = useState(initialPage);
  const [config, setConfig] = useState<TvMonitorConfig>(initialPage.config);
  const [name, setName] = useState(initialPage.name);
  const [slug, setSlug] = useState(initialPage.slug);
  const [isActive, setIsActive] = useState(initialPage.is_active);
  const [organizationId, setOrganizationId] = useState(initialPage.organization_id);
  const [facilityId, setFacilityId] = useState(initialPage.facility_id);
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ facilityName: string; spaces: TvMonitorSpace[] } | null>(null);
  const [resourceInput, setResourceInput] = useState('');
  const [tickerMessageInput, setTickerMessageInput] = useState('');
  const [copied, setCopied] = useState(false);

  const liveUrl = `/tvmonitor/${page.slug}`;
  const fullLiveUrl = `${typeof window !== 'undefined' ? window.location.origin : ''}${liveUrl}`;

  async function copyLiveUrl() {
    await navigator.clipboard.writeText(fullLiveUrl);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }

  function patchConfig(updates: Partial<TvMonitorConfig>) {
    setConfig((prev) => ({ ...prev, ...updates }));
    setSaveState('dirty');
  }
  function patchHeader(updates: Partial<TvMonitorConfig['header']>) {
    patchConfig({ header: { ...config.header, ...updates } });
  }
  function patchSchedule(updates: Partial<TvMonitorConfig['schedule']>) {
    patchConfig({ schedule: { ...config.schedule, ...updates } });
  }
  function patchDesign(updates: Partial<TvMonitorConfig['design']>) {
    patchConfig({ design: { ...config.design, ...updates } });
  }
  function patchAd(id: string, updates: Partial<TvMonitorAdSlot>) {
    patchConfig({ ads: config.ads.map((slot) => (slot.id === id ? { ...slot, ...updates } : slot)) });
  }
  function patchTicker(updates: Partial<TvMonitorConfig['ticker']>) {
    patchConfig({ ticker: { ...config.ticker, ...updates } });
  }

  // Facility IDs and resource/space IDs only mean something within their own
  // org — carrying them over to a different org would silently point the
  // page at facilities/resources that don't exist there (or worse, exist but
  // belong to someone else). Force a conscious re-pick instead.
  function handleOrgIdChange(nextOrgId: number) {
    setOrganizationId(nextOrgId);
    setFacilityId(0);
    patchSchedule({ resourceIds: [], primaryResourceId: null });
    setTestResult(null);
    setSaveState('dirty');
  }

  async function handleSave() {
    setSaveState('saving');
    setErrorMessage(null);
    const previousSlug = page.slug;
    try {
      const res = await fetch(`${apiBase}/${page.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          slug,
          is_active: isActive,
          organization_id: organizationId,
          facility_id: facilityId,
          config,
        }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setPage(data.page);
      setConfig(data.page.config);
      setSlug(data.page.slug);
      setOrganizationId(data.page.organization_id);
      setFacilityId(data.page.facility_id);
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'clean' : s)), 2000);
      // The URL name just changed — this route is keyed by slug, so jump to
      // the new address (replace, not push: the old URL is dead, no reason
      // to leave it in back-button history).
      if (data.page.slug !== previousSlug) {
        router.replace(`${backHref}/${data.page.slug}`);
      }
    } catch (error) {
      setSaveState('error');
      setErrorMessage(error instanceof Error ? error.message : 'Save failed');
    }
  }

  async function handleTestConnection() {
    setTestResult(null);
    setErrorMessage(null);
    const params = new URLSearchParams({
      orgId: String(page.organization_id),
      facilityId: String(facilityId),
      spaceIds: config.schedule.resourceIds.join(','),
      hours: String(config.schedule.futureHoursLimit),
    });
    const res = await fetch(`/api/tvmonitor/preview-schedule?${params}`, { cache: 'no-store' });
    const data = await res.json();
    if (res.ok && data.schedule) {
      setTestResult({ facilityName: data.schedule.facilityName, spaces: data.schedule.spaces });
    } else {
      setErrorMessage(data.error || 'Connection test failed');
    }
  }

  function addResource() {
    const ids = resourceInput
      .split(/[,\s]+/)
      .map((s) => parseInt(s.trim(), 10))
      .filter((n) => Number.isFinite(n) && n > 0);
    if (!ids.length) return;
    const cap = resourceIdCapFor(config.schedule.viewMode);
    const combined = Array.from(new Set([...config.schedule.resourceIds, ...ids]));
    const merged = combined.slice(0, cap);
    if (combined.length > cap) {
      // Never truncate silently — this exact bug shipped once already (a
      // 36-ID paste in feed mode quietly became 12, with no signal to the
      // person editing, and they lost hours chasing a "no events" ghost).
      alert(
        `Only the first ${cap} resources are kept in ${config.schedule.viewMode} view — ` +
          `${combined.length - cap} of the ${combined.length} you now have were NOT added. ` +
          `Remove some existing resources first if you need the later ones.`,
      );
    }
    patchSchedule({ resourceIds: merged });
    setResourceInput('');
  }

  function addTickerMessage() {
    const msg = tickerMessageInput.trim();
    if (!msg) return;
    if (config.ticker.messages.length >= 20) {
      alert('Up to 20 ticker messages — remove one before adding another.');
      return;
    }
    patchTicker({ messages: [...config.ticker.messages, msg] });
    setTickerMessageInput('');
  }

  function handleViewModeChange(nextViewMode: 'columns' | 'feed') {
    const cap = resourceIdCapFor(nextViewMode);
    const current = config.schedule.resourceIds;
    if (current.length > cap) {
      alert(
        `Switching to ${nextViewMode} view keeps only the first ${cap} of your ${current.length} resources — ` +
          `the rest will be dropped. Re-add them if you switch back.`,
      );
      patchSchedule({ viewMode: nextViewMode, resourceIds: current.slice(0, cap) });
      return;
    }
    patchSchedule({ viewMode: nextViewMode });
  }

  // Status chips for the collapsed section headers — neutral for state,
  // amber for actionable gaps.
  const enabledAdSlots = config.ads.filter((slot) => slot.enabled);
  const totalAdAssets = enabledAdSlots.reduce((sum, slot) => sum + slot.assets.length, 0);
  const emptyAdSlots = enabledAdSlots.filter((slot) => slot.assets.length === 0).length;
  const missingQrUrl =
    (config.header.scheduleQr.enabled && !config.header.scheduleQr.url) ||
    (config.header.waiverQr.enabled && !config.header.waiverQr.url);
  const missingLogo = config.header.showLogo && !config.header.logoUrl;
  const missingWeatherLocation = config.header.weather.enabled && !config.header.weather.location;
  const headerBits = [
    config.header.showLogo && 'logo',
    config.header.showTitle && 'title',
    config.header.showClock && 'clock',
    (config.header.scheduleQr.enabled || config.header.waiverQr.enabled) && 'QR',
    config.header.sponsorAdId && 'sponsor',
    config.header.weather.enabled && 'weather',
  ].filter(Boolean);

  const summaries = {
    page: `${isActive ? 'Live' : 'Off'} · ${config.screenRatio === 'fill' ? 'fills screen' : config.screenRatio}`,
    data:
      config.schedule.resourceIds.length === 0
        ? 'No resources yet'
        : `Facility #${facilityId} · ${config.schedule.resourceIds.length} resource${config.schedule.resourceIds.length === 1 ? '' : 's'}`,
    header: !config.header.enabled
      ? 'Hidden'
      : missingLogo || missingQrUrl || missingWeatherLocation
        ? 'Missing a logo/QR/weather location'
        : headerBits.join(' · ') || 'Empty',
    schedule: !config.schedule.enabled
      ? 'Hidden'
      : `${config.schedule.viewMode === 'feed' ? 'Feed' : 'Columns'} · Next ${config.schedule.futureHoursLimit}h${config.schedule.autoScroll ? ` · ${config.schedule.viewMode === 'columns' ? (config.schedule.scrollMode === 'synchronized' ? 'synced' : 'independent') + ' scroll' : 'scrolling'}` : ''}`,
    ads:
      enabledAdSlots.length === 0
        ? 'None'
        : emptyAdSlots > 0
          ? `${enabledAdSlots.length} slot${enabledAdSlots.length === 1 ? '' : 's'} · ${emptyAdSlots} missing media`
          : `${enabledAdSlots.length} slot${enabledAdSlots.length === 1 ? '' : 's'} · ${totalAdAssets} media`,
    design: `${config.design.theme === 'dark' ? 'Dark' : 'Light'} · ${config.design.fontFamily}${config.design.bgImageUrl ? ' · bg photo' : ''}`,
    ticker: !config.ticker.enabled
      ? 'Off'
      : config.ticker.messages.length === 0
        ? 'On · no messages yet'
        : `${config.ticker.messages.length} message${config.ticker.messages.length === 1 ? '' : 's'}`,
  };

  const headerAdOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...config.ads.filter((a) => a.placement === 'header').map((a) => ({ value: a.id, label: `Ad slot ${a.id}` })),
    ],
    [config.ads],
  );

  const primaryResourceOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...config.schedule.resourceIds.map((id) => ({
        value: String(id),
        label: testResult?.spaces.find((s) => s.id === id)?.name ?? `#${id}`,
      })),
    ],
    [config.schedule.resourceIds, testResult],
  );

  return (
    <div className="mx-auto max-w-[1600px]">
      {/* Top bar */}
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <Link href={backHref} className="flex items-center gap-1 text-sm text-gray-600 hover:text-gray-900">
            <ArrowLeft size={16} /> All monitors
          </Link>
          <h1 className="text-xl font-bold text-gray-900">{name}</h1>
        </div>
        <div className="flex items-center gap-3">
          {saveState === 'dirty' && <span className="text-sm text-amber-600">Unsaved changes</span>}
          {saveState === 'saved' && <span className="text-sm text-green-600">Saved</span>}
          {saveState === 'error' && <span className="text-sm text-red-600">{errorMessage}</span>}
          <a
            href={liveUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1.5 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
          >
            <ExternalLink size={14} /> Open live page
          </a>
          <button
            onClick={handleSave}
            disabled={saveState === 'saving' || saveState === 'clean'}
            className="rounded-lg bg-toca-navy px-5 py-2 text-sm font-semibold text-white transition-colors hover:bg-toca-purple disabled:opacity-50"
          >
            {saveState === 'saving' ? 'Saving…' : 'Save'}
          </button>
        </div>
      </div>

      <div className="grid gap-6 xl:grid-cols-[420px_minmax(0,1fr)]">
        {/* Settings column */}
        <div className="space-y-4">
          <SectionCard title="Page" collapsible defaultOpen={false} summary={summaries.page}>
            <Field label="Name">
              <TextInput value={name} onChange={(e) => { setName(e.target.value); setSaveState('dirty'); }} />
            </Field>
            <Field label="URL name (slug)" hint={`Becomes the live address: …/tvmonitor/${slug || '…'}`}>
              <TextInput
                value={slug}
                onChange={(e) => { setSlug(e.target.value); setSaveState('dirty'); }}
                placeholder="e.g. elk-grove-east-rink"
              />
            </Field>
            {slug !== page.slug && (
              <p
                className={`rounded-md px-3 py-2 text-xs font-medium ${
                  isActive ? 'bg-red-50 text-red-800' : 'bg-amber-50 text-amber-800'
                }`}
              >
                ⚠️ Changing the URL breaks any existing link, QR code, or bookmark pointed at{' '}
                <code className="rounded bg-black/5 px-1">/tvmonitor/{page.slug}</code> — anyone still using the old
                address will hit a 404. {isActive && 'This page is live right now. '}Only save this change if you're
                100% sure nobody needs the old link anymore.
              </p>
            )}
            <Field label="Page URL" hint="Share this URL — open it fullscreen on the TV's browser.">
              <div className="flex gap-2">
                <TextInput value={fullLiveUrl} readOnly />
                <button
                  type="button"
                  onClick={copyLiveUrl}
                  className="flex shrink-0 items-center gap-1 rounded-lg border border-gray-300 px-3 text-sm text-gray-700 hover:bg-gray-50"
                >
                  <Copy size={14} /> {copied ? 'Copied' : 'Copy'}
                </button>
              </div>
            </Field>
            <Toggle label="Page is live" checked={isActive} onChange={(v) => { setIsActive(v); setSaveState('dirty'); }} />
            <Field label="Screen shape">
              <Select value={config.screenRatio} onChange={(v) => patchConfig({ screenRatio: v as TvMonitorConfig['screenRatio'] })} options={RATIO_OPTIONS} />
            </Field>
            <Field label="Data refresh (seconds)" hint="How often the TV re-checks the schedule and your edits.">
              <NumberInput value={config.refreshSeconds} min={30} max={3600} onChange={(n) => patchConfig({ refreshSeconds: n })} />
            </Field>
          </SectionCard>

          <SectionCard
            title="Data source"
            subtitle={
              allowOrgChange
                ? 'Resources are the spaces whose schedules show on screen.'
                : `Organization #${page.organization_id} — resources are the spaces whose schedules show on screen.`
            }
            collapsible
            defaultOpen={false}
            summary={summaries.data}
            warning={config.schedule.resourceIds.length === 0}
          >
            {allowOrgChange && (
              <>
                <Field label="Organization ID">
                  <NumberInput value={organizationId} min={1} onChange={handleOrgIdChange} />
                </Field>
                {organizationId !== page.organization_id && (
                  <p className="rounded-md bg-red-50 px-3 py-2 text-xs font-medium text-red-800">
                    ⚠️ Changing the organization cleared Facility ID and Resources below — facility/space IDs only
                    mean something within their own org. Re-enter them for org #{organizationId} before saving.
                  </p>
                )}
              </>
            )}
            <Field label="Facility ID">
              <NumberInput value={facilityId} min={1} onChange={(n) => { setFacilityId(n); setSaveState('dirty'); }} />
            </Field>
            <Field
              label="Resources (space IDs)"
              hint={
                config.schedule.viewMode === 'feed'
                  ? `Up to ${resourceIdCapFor('feed')} — merged into one scrolling feed, each event tagged with its resource.`
                  : `Up to ${resourceIdCapFor('columns')} — one schedule column each, in this order.`
              }
            >
              <div className="flex flex-wrap gap-2">
                {config.schedule.resourceIds.map((id) => (
                  <span key={id} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm">
                    {testResult?.spaces.find((s) => s.id === id)?.name ?? `#${id}`}
                    <button
                      onClick={() => patchSchedule({ resourceIds: config.schedule.resourceIds.filter((r) => r !== id) })}
                      className="text-gray-400 hover:text-red-500"
                      aria-label={`Remove resource ${id}`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
              <div className="mt-2 flex gap-2">
                <TextInput
                  value={resourceInput}
                  onChange={(e) => setResourceInput(e.target.value)}
                  placeholder="e.g. 2191, 2192"
                  onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addResource(); } }}
                />
                <button onClick={addResource} className="rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-50">
                  Add
                </button>
              </div>
            </Field>
            <button onClick={handleTestConnection} className="rounded-lg border border-toca-navy px-3 py-1.5 text-sm font-medium text-toca-navy hover:bg-toca-navy hover:text-white">
              Test connection
            </button>
            {testResult && (
              <p className="text-sm text-green-700">
                Connected to <strong>{testResult.facilityName || `facility #${facilityId}`}</strong>
                {testResult.spaces.length > 0 && <> — {testResult.spaces.map((s) => s.name).join(', ')}</>}
              </p>
            )}
            {errorMessage && saveState !== 'error' && <p className="text-sm text-red-600">{errorMessage}</p>}
          </SectionCard>

          <SectionCard title="Header block" collapsible defaultOpen={false} summary={summaries.header} warning={config.header.enabled && (missingLogo || missingQrUrl || missingWeatherLocation)}>
            <Toggle label="Show header" checked={config.header.enabled} onChange={(v) => patchHeader({ enabled: v })} />
            {config.header.enabled && (
              <>
                <Field
                  label="Arrangement"
                  hint={
                    config.header.layout === 'centered'
                      ? 'Sponsor left, clock center, logo right — the title becomes a banner bar on top of the schedule.'
                      : 'Logo and title on the left, sponsor and clock on the right.'
                  }
                >
                  <Select
                    value={config.header.layout}
                    onChange={(v) => patchHeader({ layout: v as 'inline' | 'centered' })}
                    options={[
                      { value: 'centered', label: 'Rink board — sponsor / clock / logo, title on the schedule' },
                      { value: 'inline', label: 'Classic — logo + title left, clock right' },
                    ]}
                  />
                </Field>
                <Toggle label="Show title" checked={config.header.showTitle} onChange={(v) => patchHeader({ showTitle: v })} />
                {config.header.showTitle && (
                  <>
                    <Field label="Title">
                      <TextInput value={config.header.title} onChange={(e) => patchHeader({ title: e.target.value })} />
                    </Field>
                    <Field label={`Title size: ${config.header.titleSizePx}px`}>
                      <input
                        type="range"
                        min={16}
                        max={96}
                        step={2}
                        value={config.header.titleSizePx}
                        onChange={(e) => patchHeader({ titleSizePx: Number(e.target.value) })}
                        className="w-full accent-toca-navy"
                      />
                    </Field>
                  </>
                )}
                <Toggle label="Show logo" checked={config.header.showLogo} onChange={(v) => patchHeader({ showLogo: v })} />
                {config.header.showLogo && (
                  <>
                    <Field label="Logo" hint="Upload a file or paste a URL — PNG with transparency looks best.">
                      <MediaInput
                        value={config.header.logoUrl ?? ''}
                        onChange={(url) => patchHeader({ logoUrl: url || null })}
                        accept="image"
                        placeholder="https://…/logo.png"
                      />
                    </Field>
                    <Field label={`Logo size: ${config.header.logoHeightPx}px tall`}>
                      <input
                        type="range"
                        min={32}
                        max={200}
                        step={4}
                        value={config.header.logoHeightPx}
                        onChange={(e) => patchHeader({ logoHeightPx: Number(e.target.value) })}
                        className="w-full accent-toca-navy"
                      />
                    </Field>
                    {config.header.layout === 'inline' && config.header.showTitle && (
                      <Field label="Logo position" hint="Only applies with the Classic arrangement — where the logo sits relative to the title.">
                        <Select
                          value={config.header.logoPosition}
                          onChange={(v) => patchHeader({ logoPosition: v as 'left' | 'right' })}
                          options={[
                            { value: 'left', label: 'Left of title' },
                            { value: 'right', label: 'Right of title' },
                          ]}
                        />
                      </Field>
                    )}
                  </>
                )}
                <Toggle label="Show clock" checked={config.header.showClock} onChange={(v) => patchHeader({ showClock: v })} />
                <Toggle label="Show date" checked={config.header.showDate} onChange={(v) => patchHeader({ showDate: v })} />
                <Toggle
                  label="Schedule QR code"
                  checked={config.header.scheduleQr.enabled}
                  onChange={(v) => patchHeader({ scheduleQr: { ...config.header.scheduleQr, enabled: v } })}
                />
                {config.header.scheduleQr.enabled && (
                  <div className="ml-3 space-y-2 border-l-2 border-gray-100 pl-3">
                    <Field label="QR links to">
                      <TextInput
                        value={config.header.scheduleQr.url ?? ''}
                        onChange={(e) => patchHeader({ scheduleQr: { ...config.header.scheduleQr, url: e.target.value || null } })}
                        placeholder="https://bondsports.co/facility/…/schedule"
                      />
                    </Field>
                    <Field label="Caption">
                      <TextInput
                        value={config.header.scheduleQr.label}
                        onChange={(e) => patchHeader({ scheduleQr: { ...config.header.scheduleQr, label: e.target.value } })}
                      />
                    </Field>
                  </div>
                )}
                <Toggle
                  label="Waiver QR code"
                  checked={config.header.waiverQr.enabled}
                  onChange={(v) => patchHeader({ waiverQr: { ...config.header.waiverQr, enabled: v } })}
                />
                {config.header.waiverQr.enabled && (
                  <div className="ml-3 space-y-2 border-l-2 border-gray-100 pl-3">
                    <Field label="QR links to">
                      <TextInput
                        value={config.header.waiverQr.url ?? ''}
                        onChange={(e) => patchHeader({ waiverQr: { ...config.header.waiverQr, url: e.target.value || null } })}
                        placeholder="https://bondsports.co/…/general_waiver"
                      />
                    </Field>
                    <Field label="Caption">
                      <TextInput
                        value={config.header.waiverQr.label}
                        onChange={(e) => patchHeader({ waiverQr: { ...config.header.waiverQr, label: e.target.value } })}
                      />
                    </Field>
                  </div>
                )}
                {headerAdOptions.length > 1 && (
                  <Field label="Sponsor ad in header" hint='Uses an ad slot with placement "Inside header".'>
                    <Select
                      value={config.header.sponsorAdId ?? ''}
                      onChange={(v) => patchHeader({ sponsorAdId: v || null })}
                      options={headerAdOptions}
                    />
                  </Field>
                )}
                <Toggle
                  label="Weather"
                  checked={config.header.weather.enabled}
                  onChange={(v) => patchHeader({ weather: { ...config.header.weather, enabled: v } })}
                />
                {config.header.weather.enabled && (
                  <div className="ml-3 space-y-2 border-l-2 border-gray-100 pl-3">
                    <Field label="City or ZIP" hint="Free-text location — geocoded automatically (no API key needed).">
                      <TextInput
                        value={config.header.weather.location ?? ''}
                        onChange={(e) => patchHeader({ weather: { ...config.header.weather, location: e.target.value || null } })}
                        placeholder="e.g. Elk Grove Village, IL or 60007"
                      />
                    </Field>
                  </div>
                )}
              </>
            )}
          </SectionCard>

          <SectionCard title="Schedule block" subtitle="The resource schedule at the center of the display." collapsible defaultOpen={false} summary={summaries.schedule}>
            <Toggle label="Show schedule" checked={config.schedule.enabled} onChange={(v) => patchSchedule({ enabled: v })} />
            {config.schedule.enabled && (
              <>
                <Field
                  label="View"
                  hint={
                    config.schedule.viewMode === 'feed'
                      ? 'All resources merged into one scrolling list, sorted by time, with the location shown on each event.'
                      : 'One column per resource, side by side.'
                  }
                >
                  <Select
                    value={config.schedule.viewMode}
                    onChange={(v) => handleViewModeChange(v as 'columns' | 'feed')}
                    options={[
                      { value: 'columns', label: 'Columns — one per resource' },
                      { value: 'feed', label: "Feed — everything today, one scrolling list" },
                    ]}
                  />
                </Field>
                <Field label="Hours ahead to show (1–24)">
                  <NumberInput value={config.schedule.futureHoursLimit} min={1} max={24} onChange={(n) => patchSchedule({ futureHoursLimit: n })} />
                </Field>
                <Field label="Event card style">
                  <Select
                    value={config.schedule.cardStyle}
                    onChange={(v) => patchSchedule({ cardStyle: v as 'cards' | 'plain' })}
                    options={[
                      { value: 'cards', label: 'Cards — bordered boxes (default)' },
                      { value: 'plain', label: 'Plain text — centered, no card chrome' },
                    ]}
                  />
                </Field>
                {config.schedule.viewMode === 'columns' && config.schedule.resourceIds.length > 1 && (
                  <>
                    <Field
                      label='Highlight "you are here"'
                      hint="Adds a banner above one column and mutes the others — e.g. pointing at the rink nearest this TV."
                    >
                      <Select
                        value={config.schedule.primaryResourceId != null ? String(config.schedule.primaryResourceId) : ''}
                        onChange={(v) => patchSchedule({ primaryResourceId: v ? Number(v) : null })}
                        options={primaryResourceOptions}
                      />
                    </Field>
                    {config.schedule.primaryResourceId != null && (
                      <Field label="Banner label">
                        <TextInput
                          value={config.schedule.wayfindingLabel}
                          onChange={(e) => patchSchedule({ wayfindingLabel: e.target.value })}
                        />
                      </Field>
                    )}
                  </>
                )}
                <Toggle label="Show event notes" checked={config.schedule.showNotes} onChange={(v) => patchSchedule({ showNotes: v })} />
                {config.schedule.showNotes && (
                  <div className="ml-3 space-y-2 border-l-2 border-gray-100 pl-3">
                    <Field label="Notes size">
                      <Select
                        value={config.schedule.notesSize}
                        onChange={(v) => patchSchedule({ notesSize: v as 'small' | 'medium' | 'large' })}
                        options={[
                          { value: 'small', label: 'Small' },
                          { value: 'medium', label: 'Medium (default)' },
                          { value: 'large', label: 'Large' },
                        ]}
                      />
                    </Field>
                    <Field label="Notes color" hint="Clear the field to use the accent color.">
                      <ColorInput
                        value={config.schedule.notesColor ?? ''}
                        onChange={(v) => patchSchedule({ notesColor: v || null })}
                      />
                    </Field>
                    <Toggle
                      label="Italic"
                      checked={config.schedule.notesItalic}
                      onChange={(v) => patchSchedule({ notesItalic: v })}
                    />
                    <Toggle
                      label="Bold"
                      checked={config.schedule.notesBold}
                      onChange={(v) => patchSchedule({ notesBold: v })}
                    />
                  </div>
                )}
                <Toggle label="Show maintenance" checked={config.schedule.showMaintenance} onChange={(v) => patchSchedule({ showMaintenance: v })} />
                {config.schedule.showMaintenance && (
                  <Field label="Maintenance label" hint='e.g. "Ice Cut" for rinks.'>
                    <TextInput value={config.schedule.maintenanceLabel} onChange={(e) => patchSchedule({ maintenanceLabel: e.target.value })} />
                  </Field>
                )}
                <Toggle label="Show private events" checked={config.schedule.showPrivateEvents} onChange={(v) => patchSchedule({ showPrivateEvents: v })} />
                {config.schedule.showPrivateEvents && (
                  <Field label="Private event label">
                    <TextInput value={config.schedule.privateEventLabel} onChange={(e) => patchSchedule({ privateEventLabel: e.target.value })} />
                  </Field>
                )}
                <Toggle label="Auto-scroll" checked={config.schedule.autoScroll} onChange={(v) => patchSchedule({ autoScroll: v })} />
                {config.schedule.autoScroll && (
                  <>
                    <Field label={`Scroll speed: ${config.schedule.scrollSpeed}`}>
                      <input
                        type="range"
                        min={1}
                        max={5}
                        step={1}
                        value={config.schedule.scrollSpeed}
                        onChange={(e) => patchSchedule({ scrollSpeed: Number(e.target.value) })}
                        className="w-full accent-toca-navy"
                      />
                    </Field>
                    {config.schedule.viewMode === 'columns' && (
                      <Field label="Scroll style">
                        <Select
                          value={config.schedule.scrollMode}
                          onChange={(v) => patchSchedule({ scrollMode: v as 'synchronized' | 'independent' })}
                          options={[
                            { value: 'synchronized', label: 'Synchronized — all columns together' },
                            { value: 'independent', label: 'Independent — each column on its own' },
                          ]}
                        />
                      </Field>
                    )}
                    <Field label="Pause at top (seconds)">
                      <NumberInput value={config.schedule.scrollPauseSeconds} min={0} max={30} onChange={(n) => patchSchedule({ scrollPauseSeconds: n })} />
                    </Field>
                  </>
                )}
              </>
            )}
          </SectionCard>

          <SectionCard title="Ad placements" subtitle="Fixed image or video placements. JS ad tags are on the roadmap." collapsible defaultOpen={false} summary={summaries.ads} warning={emptyAdSlots > 0}>
            {config.ads.map((slot, index) => (
              <div key={slot.id} className="rounded-lg border border-gray-200 p-3">
                <div className="mb-2 flex items-center justify-between">
                  <span className="text-sm font-semibold text-gray-800">Ad slot {index + 1}</span>
                  <div className="flex items-center gap-2">
                    <Toggle label="" checked={slot.enabled} onChange={(v) => patchAd(slot.id, { enabled: v })} />
                    <button
                      onClick={() => {
                        patchConfig({
                          ads: config.ads.filter((a) => a.id !== slot.id),
                          header: config.header.sponsorAdId === slot.id ? { ...config.header, sponsorAdId: null } : config.header,
                        });
                      }}
                      className="text-gray-400 hover:text-red-500"
                      aria-label="Remove ad slot"
                    >
                      <Trash2 size={16} />
                    </button>
                  </div>
                </div>
                <div className="space-y-2">
                  <Field label="Placement">
                    <Select value={slot.placement} onChange={(v) => patchAd(slot.id, { placement: v as TvMonitorAdSlot['placement'] })} options={PLACEMENT_OPTIONS} />
                  </Field>
                  <div className="grid grid-cols-2 gap-2">
                    <Field label="Size by">
                      <Select
                        value={slot.sizeMode}
                        onChange={(v) => patchAd(slot.id, { sizeMode: v as 'pixels' | 'ratio' })}
                        options={[
                          { value: 'pixels', label: 'Pixels' },
                          { value: 'ratio', label: '% of screen' },
                        ]}
                      />
                    </Field>
                    {slot.sizeMode === 'pixels' ? (
                      <Field label="Size (px)">
                        <NumberInput value={slot.sizePx} min={40} max={1200} onChange={(n) => patchAd(slot.id, { sizePx: n })} />
                      </Field>
                    ) : (
                      <Field label="Size (%)">
                        <NumberInput value={slot.sizePercent} min={5} max={60} onChange={(n) => patchAd(slot.id, { sizePercent: n })} />
                      </Field>
                    )}
                  </div>
                  {(slot.placement === 'left' || slot.placement === 'right') && (
                    <Toggle
                      label="Full height — span the whole screen, header beside it"
                      checked={slot.fullHeight}
                      onChange={(v) => patchAd(slot.id, { fullHeight: v })}
                    />
                  )}
                  {(() => {
                    const px = estimateAdPixels(slot, config);
                    return (
                      <p className="rounded-md bg-blue-50 px-2 py-1.5 text-xs text-gray-600">
                        Design artwork at <strong>{px.w} × {px.h} px</strong> (aspect {friendlyRatio(px.w, px.h)})
                        {slot.placement === 'header' ? ' — width flexes to the media' : ''}. That size or larger is
                        ideal; “Fill” crops other shapes to cover the slot, “Fit” shows the whole image with empty
                        edges.
                      </p>
                    );
                  })()}
                  {slot.assets.map((asset, assetIndex) => (
                    <div key={asset.id} className="rounded-md bg-gray-50 p-2">
                      <div className="mb-1 flex items-center justify-between">
                        <span className="text-xs font-medium text-gray-600">Media {assetIndex + 1}</span>
                        <button
                          onClick={() => patchAd(slot.id, { assets: slot.assets.filter((a) => a.id !== asset.id) })}
                          className="text-gray-400 hover:text-red-500"
                          aria-label="Remove media"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                      <div className="space-y-2">
                        <MediaInput
                          value={asset.src}
                          accept="media"
                          placeholder="https://…/poster.png or …/promo.mp4 — or upload"
                          onChange={(url, kind) =>
                            patchAd(slot.id, {
                              assets: slot.assets.map((a) =>
                                a.id === asset.id ? { ...a, src: url, type: kind ?? a.type } : a,
                              ),
                            })
                          }
                        />
                        <div className="grid grid-cols-3 gap-2">
                          <Select
                            value={asset.type}
                            onChange={(v) =>
                              patchAd(slot.id, {
                                assets: slot.assets.map((a) => (a.id === asset.id ? { ...a, type: v as 'image' | 'video' } : a)),
                              })
                            }
                            options={[
                              { value: 'image', label: 'Image' },
                              { value: 'video', label: 'Video' },
                            ]}
                          />
                          <Select
                            value={asset.fit}
                            onChange={(v) =>
                              patchAd(slot.id, {
                                assets: slot.assets.map((a) => (a.id === asset.id ? { ...a, fit: v as 'cover' | 'contain' } : a)),
                              })
                            }
                            options={[
                              { value: 'cover', label: 'Fill' },
                              { value: 'contain', label: 'Fit' },
                            ]}
                          />
                          <NumberInput
                            value={asset.durationSeconds}
                            min={3}
                            max={600}
                            onChange={(n) =>
                              patchAd(slot.id, {
                                assets: slot.assets.map((a) => (a.id === asset.id ? { ...a, durationSeconds: n } : a)),
                              })
                            }
                          />
                        </div>
                        <p className="text-[11px] text-gray-400">Seconds on screen before rotating to the next media.</p>
                      </div>
                    </div>
                  ))}
                  <button
                    onClick={() => patchAd(slot.id, { assets: [...slot.assets, newAdAsset()] })}
                    className="flex items-center gap-1 text-sm text-toca-navy hover:underline"
                  >
                    <Plus size={14} /> Add image or video
                  </button>
                </div>
              </div>
            ))}
            <button
              onClick={() => patchConfig({ ads: [...config.ads, newAdSlot()] })}
              className="flex items-center gap-1 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-600 hover:border-toca-navy hover:text-toca-navy"
            >
              <Plus size={14} /> Add ad placement
            </button>
          </SectionCard>

          <SectionCard
            title="Ticker"
            subtitle="A scrolling text bar across the bottom of the screen — announcements, not ads."
            collapsible
            defaultOpen={false}
            summary={summaries.ticker}
            warning={config.ticker.enabled && config.ticker.messages.length === 0}
          >
            <Toggle label="Show ticker" checked={config.ticker.enabled} onChange={(v) => patchTicker({ enabled: v })} />
            {config.ticker.enabled && (
              <>
                <Field label="Label" hint='Short leading chip, e.g. "UPDATES".'>
                  <TextInput value={config.ticker.label} onChange={(e) => patchTicker({ label: e.target.value })} />
                </Field>
                <Field label="Messages" hint="Up to 20 — they scroll together, separated by a bullet.">
                  <div className="flex flex-wrap gap-2">
                    {config.ticker.messages.map((msg, i) => (
                      <span key={i} className="flex items-center gap-1 rounded-full bg-gray-100 px-3 py-1 text-sm">
                        {msg}
                        <button
                          onClick={() => patchTicker({ messages: config.ticker.messages.filter((_, idx) => idx !== i) })}
                          className="text-gray-400 hover:text-red-500"
                          aria-label={`Remove message ${i + 1}`}
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                  <div className="mt-2 flex gap-2">
                    <TextInput
                      value={tickerMessageInput}
                      onChange={(e) => setTickerMessageInput(e.target.value)}
                      placeholder="e.g. Open skate 6-8pm tonight"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTickerMessage(); } }}
                    />
                    <button onClick={addTickerMessage} className="rounded-lg border border-gray-300 px-3 text-sm hover:bg-gray-50">
                      Add
                    </button>
                  </div>
                </Field>
                <Field label={`Scroll speed: ${config.ticker.scrollSpeed}`}>
                  <input
                    type="range"
                    min={1}
                    max={5}
                    step={1}
                    value={config.ticker.scrollSpeed}
                    onChange={(e) => patchTicker({ scrollSpeed: Number(e.target.value) })}
                    className="w-full accent-toca-navy"
                  />
                </Field>
              </>
            )}
          </SectionCard>

          <SectionCard title="Design" collapsible defaultOpen={false} summary={summaries.design}>
            <div className="flex gap-2">
              {(['dark', 'light'] as const).map((theme) => (
                <button
                  key={theme}
                  onClick={() => patchDesign({ ...TV_DESIGN_PRESETS[theme] })}
                  className={`flex-1 rounded-lg border px-3 py-2 text-sm font-medium capitalize ${
                    config.design.theme === theme ? 'border-toca-navy bg-toca-navy text-white' : 'border-gray-300 text-gray-700 hover:bg-gray-50'
                  }`}
                >
                  {theme} theme
                </button>
              ))}
            </div>
            <Field label="Font">
              <Select value={config.design.fontFamily} onChange={(v) => patchDesign({ fontFamily: v })} options={FONT_OPTIONS} />
            </Field>
            <Field label="Font color">
              <ColorInput value={config.design.fontColor} onChange={(v) => patchDesign({ fontColor: v })} />
            </Field>
            <Field label="Secondary font color">
              <ColorInput value={config.design.secondaryFontColor} onChange={(v) => patchDesign({ secondaryFontColor: v })} />
            </Field>
            <Field label="Accent color">
              <ColorInput value={config.design.accentColor} onChange={(v) => patchDesign({ accentColor: v })} />
            </Field>
            <Field label="Background color 1">
              <ColorInput value={config.design.bgColor1} onChange={(v) => patchDesign({ bgColor1: v })} />
            </Field>
            <Field label="Background color 2" hint="Same as color 1 for a solid background; different for a gradient.">
              <ColorInput value={config.design.bgColor2} onChange={(v) => patchDesign({ bgColor2: v })} />
            </Field>
            <Field label="Background image (optional)" hint="E.g. an arena photo. The colors above overlay it to keep text readable.">
              <MediaInput
                value={config.design.bgImageUrl ?? ''}
                onChange={(url) => patchDesign({ bgImageUrl: url || null })}
                accept="image"
                placeholder="https://…/arena.jpg — or upload"
              />
            </Field>
            {config.design.bgImageUrl && (
              <Field label={`Color overlay strength: ${config.design.bgImageOverlayOpacity}%`} hint="Lower shows more photo; higher keeps text crisper.">
                <input
                  type="range"
                  min={0}
                  max={100}
                  step={5}
                  value={config.design.bgImageOverlayOpacity}
                  onChange={(e) => patchDesign({ bgImageOverlayOpacity: Number(e.target.value) })}
                  className="w-full accent-toca-navy"
                />
              </Field>
            )}
            <Field label="Event card background">
              <ColorInput value={config.design.cardBg} onChange={(v) => patchDesign({ cardBg: v })} />
            </Field>
            <Field label="Event card border">
              <ColorInput value={config.design.cardBorder} onChange={(v) => patchDesign({ cardBorder: v })} />
            </Field>
          </SectionCard>
        </div>

        {/* Preview column */}
        <div className="xl:sticky xl:top-6 xl:self-start">
          <h2 className="mb-2 text-sm font-semibold uppercase tracking-wide text-gray-500">Live preview</h2>
          <MonitorPreview config={config} organizationId={page.organization_id} facilityId={facilityId} />
        </div>
      </div>
    </div>
  );
}
