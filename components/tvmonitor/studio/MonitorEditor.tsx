'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Copy, ExternalLink, Plus, Trash2 } from 'lucide-react';
import MonitorPreview, { BASE_SIZES } from '@/components/tvmonitor/studio/MonitorPreview';
import MediaInput from '@/components/tvmonitor/studio/MediaInput';
import { ColorInput, Field, NumberInput, SectionCard, Select, TextInput, Toggle } from '@/components/tvmonitor/studio/fields';
import { TV_DESIGN_PRESETS } from '@/lib/tvmonitor-templates';
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

  switch (slot.placement) {
    case 'left':
    case 'right':
      return { w: Math.round(railWidth(slot)), h: Math.round(base.h - headerH - topH - bottomH) };
    case 'top':
    case 'bottom':
      return { w: base.w, h: Math.round(bannerHeight(slot)) };
    case 'header':
    default:
      return { w: Math.round(slot.sizePx * 2.5), h: slot.sizePx };
  }
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
}: {
  page: ITvMonitorPage;
  apiBase: string;
  backHref: string;
}) {
  const [page, setPage] = useState(initialPage);
  const [config, setConfig] = useState<TvMonitorConfig>(initialPage.config);
  const [name, setName] = useState(initialPage.name);
  const [isActive, setIsActive] = useState(initialPage.is_active);
  const [facilityId, setFacilityId] = useState(initialPage.facility_id);
  const [saveState, setSaveState] = useState<SaveState>('clean');
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [testResult, setTestResult] = useState<{ facilityName: string; spaces: TvMonitorSpace[] } | null>(null);
  const [resourceInput, setResourceInput] = useState('');
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

  async function handleSave() {
    setSaveState('saving');
    setErrorMessage(null);
    try {
      const res = await fetch(`${apiBase}/${page.slug}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, is_active: isActive, facility_id: facilityId, config }),
      });
      const data = await res.json();
      if (!res.ok) throw new Error(data.error || 'Save failed');
      setPage(data.page);
      setConfig(data.page.config);
      setSaveState('saved');
      setTimeout(() => setSaveState((s) => (s === 'saved' ? 'clean' : s)), 2000);
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
    const merged = Array.from(new Set([...config.schedule.resourceIds, ...ids])).slice(0, 6);
    patchSchedule({ resourceIds: merged });
    setResourceInput('');
  }

  const headerAdOptions = useMemo(
    () => [
      { value: '', label: 'None' },
      ...config.ads.filter((a) => a.placement === 'header').map((a) => ({ value: a.id, label: `Ad slot ${a.id}` })),
    ],
    [config.ads],
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
          <SectionCard title="Page">
            <Field label="Name">
              <TextInput value={name} onChange={(e) => { setName(e.target.value); setSaveState('dirty'); }} />
            </Field>
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
            subtitle={`Organization #${page.organization_id} — resources are the spaces whose schedules show on screen.`}
          >
            <Field label="Facility ID">
              <NumberInput value={facilityId} min={1} onChange={(n) => { setFacilityId(n); setSaveState('dirty'); }} />
            </Field>
            <Field label="Resources (space IDs)" hint="Up to 6 — one schedule column each, in this order.">
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

          <SectionCard title="Header block">
            <Toggle label="Show header" checked={config.header.enabled} onChange={(v) => patchHeader({ enabled: v })} />
            {config.header.enabled && (
              <>
                <Toggle label="Show title" checked={config.header.showTitle} onChange={(v) => patchHeader({ showTitle: v })} />
                {config.header.showTitle && (
                  <Field label="Title">
                    <TextInput value={config.header.title} onChange={(e) => patchHeader({ title: e.target.value })} />
                  </Field>
                )}
                <Toggle label="Show logo" checked={config.header.showLogo} onChange={(v) => patchHeader({ showLogo: v })} />
                {config.header.showLogo && (
                  <Field label="Logo" hint="Upload a file or paste a URL — PNG with transparency looks best.">
                    <MediaInput
                      value={config.header.logoUrl ?? ''}
                      onChange={(url) => patchHeader({ logoUrl: url || null })}
                      accept="image"
                      placeholder="https://…/logo.png"
                    />
                  </Field>
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
              </>
            )}
          </SectionCard>

          <SectionCard title="Schedule block" subtitle="The resource schedule at the center of the display.">
            <Toggle label="Show schedule" checked={config.schedule.enabled} onChange={(v) => patchSchedule({ enabled: v })} />
            {config.schedule.enabled && (
              <>
                <Field label="Hours ahead to show (1–24)">
                  <NumberInput value={config.schedule.futureHoursLimit} min={1} max={24} onChange={(n) => patchSchedule({ futureHoursLimit: n })} />
                </Field>
                <Toggle label="Show event notes" checked={config.schedule.showNotes} onChange={(v) => patchSchedule({ showNotes: v })} />
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
                    <Field label="Pause at top (seconds)">
                      <NumberInput value={config.schedule.scrollPauseSeconds} min={0} max={30} onChange={(n) => patchSchedule({ scrollPauseSeconds: n })} />
                    </Field>
                  </>
                )}
              </>
            )}
          </SectionCard>

          <SectionCard title="Ad placements" subtitle="Fixed image or video placements. JS ad tags are on the roadmap.">
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
                  {(() => {
                    const px = estimateAdPixels(slot, config);
                    return (
                      <p className="text-xs text-gray-500">
                        Renders at ≈ <strong>{px.w} × {px.h} px</strong> on a{' '}
                        {config.screenRatio === '9:16' ? 'portrait' : '1080p'} TV
                        {slot.placement === 'header' ? ' (width flexes to the media)' : ''} — size your artwork
                        accordingly.
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

          <SectionCard title="Design">
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
