/**
 * Supabase CRUD + config normalization for tvmonitor_pages.
 *
 * The `config` jsonb blob is normalized on every read (normalizeTvMonitorConfig)
 * so the display and builder can trust every field to exist with a sane value,
 * even for rows written by older versions of the builder.
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import { buildTvMonitorTemplateConfig, TV_DESIGN_PRESETS } from '@/lib/tvmonitor-templates';
import type {
  ITvMonitorPage,
  TvMonitorAdAsset,
  TvMonitorAdSlot,
  TvMonitorConfig,
  TvMonitorScreenRatio,
  TvMonitorTemplateKey,
} from '@/types/tvmonitor';

const TEMPLATE_KEYS: TvMonitorTemplateKey[] = ['rink-classic', 'sponsor-spotlight', 'promo-banner', 'custom'];
const SCREEN_RATIOS: TvMonitorScreenRatio[] = ['fill', '16:9', '4:3', '21:9', '9:16'];
const AD_PLACEMENTS = ['left', 'right', 'top', 'bottom', 'header'] as const;

export const MAX_TV_RESOURCES = 6;
export const MIN_TV_REFRESH_SECONDS = 30;

function asString(value: unknown, fallback: string): string {
  return typeof value === 'string' && value.length > 0 ? value : fallback;
}

function asNullableString(value: unknown): string | null {
  return typeof value === 'string' && value.trim().length > 0 ? value : null;
}

function asBool(value: unknown, fallback: boolean): boolean {
  return typeof value === 'boolean' ? value : fallback;
}

function asNumber(value: unknown, fallback: number, min: number, max: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function asIdArray(value: unknown): number[] {
  if (!Array.isArray(value)) return [];
  return value.map((n) => Number(n)).filter((n) => Number.isFinite(n) && n > 0);
}

function normalizeAdAsset(raw: unknown, index: number): TvMonitorAdAsset | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const src = asNullableString(rec.src);
  if (!src) return null;
  return {
    id: asString(rec.id, `asset-${index}`),
    type: rec.type === 'video' ? 'video' : 'image',
    src,
    durationSeconds: asNumber(rec.durationSeconds, 12, 3, 600),
    fit: rec.fit === 'contain' ? 'contain' : 'cover',
  };
}

function normalizeAdSlot(raw: unknown, index: number): TvMonitorAdSlot | null {
  if (!raw || typeof raw !== 'object') return null;
  const rec = raw as Record<string, unknown>;
  const placement = AD_PLACEMENTS.includes(rec.placement as (typeof AD_PLACEMENTS)[number])
    ? (rec.placement as TvMonitorAdSlot['placement'])
    : 'bottom';
  const rawAssets = Array.isArray(rec.assets) ? rec.assets : [];
  return {
    id: asString(rec.id, `ad-${index}`),
    enabled: asBool(rec.enabled, true),
    placement,
    sizeMode: rec.sizeMode === 'ratio' ? 'ratio' : 'pixels',
    sizePx: asNumber(rec.sizePx, 150, 40, 1200),
    sizePercent: asNumber(rec.sizePercent, 20, 5, 60),
    fullHeight: asBool(rec.fullHeight, false) && (placement === 'left' || placement === 'right'),
    backgroundColor: asString(rec.backgroundColor, 'transparent'),
    assets: rawAssets
      .map((asset, i) => normalizeAdAsset(asset, i))
      .filter((asset): asset is TvMonitorAdAsset => asset !== null),
  };
}

/**
 * Deep-normalizes an arbitrary jsonb blob into a complete TvMonitorConfig.
 */
export function normalizeTvMonitorConfig(raw: unknown): TvMonitorConfig {
  const rec = raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const template = TEMPLATE_KEYS.includes(rec.template as TvMonitorTemplateKey)
    ? (rec.template as TvMonitorTemplateKey)
    : 'custom';
  const defaults = buildTvMonitorTemplateConfig(template);

  const design = rec.design && typeof rec.design === 'object' ? (rec.design as Record<string, unknown>) : {};
  const themeKey = design.theme === 'light' ? 'light' : design.theme === 'dark' ? 'dark' : defaults.design.theme;
  const themePreset = TV_DESIGN_PRESETS[themeKey];

  const header = rec.header && typeof rec.header === 'object' ? (rec.header as Record<string, unknown>) : {};
  const scheduleQr =
    header.scheduleQr && typeof header.scheduleQr === 'object' ? (header.scheduleQr as Record<string, unknown>) : {};
  const waiverQr =
    header.waiverQr && typeof header.waiverQr === 'object' ? (header.waiverQr as Record<string, unknown>) : {};

  const schedule = rec.schedule && typeof rec.schedule === 'object' ? (rec.schedule as Record<string, unknown>) : {};

  const rawAds = Array.isArray(rec.ads) ? rec.ads : defaults.ads;
  const ads = rawAds.map((slot, i) => normalizeAdSlot(slot, i)).filter((slot): slot is TvMonitorAdSlot => slot !== null);

  const sponsorAdId = asNullableString(header.sponsorAdId);

  return {
    template,
    screenRatio: SCREEN_RATIOS.includes(rec.screenRatio as TvMonitorScreenRatio)
      ? (rec.screenRatio as TvMonitorScreenRatio)
      : defaults.screenRatio,
    design: {
      theme: themeKey,
      fontFamily: asString(design.fontFamily, defaults.design.fontFamily),
      fontColor: asString(design.fontColor, themePreset.fontColor),
      secondaryFontColor: asString(design.secondaryFontColor, themePreset.secondaryFontColor),
      accentColor: asString(design.accentColor, themePreset.accentColor),
      bgColor1: asString(design.bgColor1, themePreset.bgColor1),
      bgColor2: asString(design.bgColor2, themePreset.bgColor2),
      bgImageUrl: asNullableString(design.bgImageUrl),
      bgImageOverlayOpacity: asNumber(design.bgImageOverlayOpacity, 80, 0, 100),
      cardBg: asString(design.cardBg, themePreset.cardBg),
      cardBorder: asString(design.cardBorder, themePreset.cardBorder),
    },
    header: {
      enabled: asBool(header.enabled, defaults.header.enabled),
      layout: header.layout === 'centered' ? 'centered' : header.layout === 'inline' ? 'inline' : defaults.header.layout,
      showLogo: asBool(header.showLogo, defaults.header.showLogo),
      logoUrl: asNullableString(header.logoUrl),
      logoHeightPx: asNumber(header.logoHeightPx, defaults.header.logoHeightPx, 32, 200),
      title: asString(header.title, defaults.header.title),
      showTitle: asBool(header.showTitle, defaults.header.showTitle),
      showClock: asBool(header.showClock, defaults.header.showClock),
      showDate: asBool(header.showDate, defaults.header.showDate),
      scheduleQr: {
        enabled: asBool(scheduleQr.enabled, defaults.header.scheduleQr.enabled),
        url: asNullableString(scheduleQr.url),
        label: asString(scheduleQr.label, defaults.header.scheduleQr.label),
      },
      waiverQr: {
        enabled: asBool(waiverQr.enabled, defaults.header.waiverQr.enabled),
        url: asNullableString(waiverQr.url),
        label: asString(waiverQr.label, defaults.header.waiverQr.label),
      },
      // Keep the pointer only if the slot actually exists.
      sponsorAdId: sponsorAdId && ads.some((slot) => slot.id === sponsorAdId) ? sponsorAdId : null,
    },
    schedule: {
      enabled: asBool(schedule.enabled, defaults.schedule.enabled),
      resourceIds: asIdArray(schedule.resourceIds).slice(0, MAX_TV_RESOURCES),
      futureHoursLimit: asNumber(schedule.futureHoursLimit, defaults.schedule.futureHoursLimit, 1, 24),
      showNotes: asBool(schedule.showNotes, defaults.schedule.showNotes),
      showMaintenance: asBool(schedule.showMaintenance, defaults.schedule.showMaintenance),
      showPrivateEvents: asBool(schedule.showPrivateEvents, defaults.schedule.showPrivateEvents),
      privateEventLabel: asString(schedule.privateEventLabel, defaults.schedule.privateEventLabel),
      maintenanceLabel: asString(schedule.maintenanceLabel, defaults.schedule.maintenanceLabel),
      autoScroll: asBool(schedule.autoScroll, defaults.schedule.autoScroll),
      scrollSpeed: asNumber(schedule.scrollSpeed, defaults.schedule.scrollSpeed, 1, 5),
      scrollMode: schedule.scrollMode === 'independent' ? 'independent' : 'synchronized',
      scrollPauseSeconds: asNumber(schedule.scrollPauseSeconds, defaults.schedule.scrollPauseSeconds, 0, 30),
    },
    ads,
    refreshSeconds: asNumber(rec.refreshSeconds, defaults.refreshSeconds, MIN_TV_REFRESH_SECONDS, 3600),
  };
}

/** Slugs that collide with static routes under /tvmonitor. */
const RESERVED_SLUGS = new Set(['studio', 'api']);

export function isReservedTvMonitorSlug(slug: string): boolean {
  return RESERVED_SLUGS.has(slug);
}

export function normalizeTvMonitorSlug(slug: string): string {
  return slug
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9-]+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');
}

function rowToPage(row: Record<string, unknown>): ITvMonitorPage {
  return {
    id: String(row.id),
    slug: String(row.slug),
    name: String(row.name),
    is_active: Boolean(row.is_active),
    organization_id: Number(row.organization_id),
    facility_id: Number(row.facility_id),
    config: normalizeTvMonitorConfig(row.config),
    created_by: row.created_by != null ? String(row.created_by) : null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

export async function getAllTvMonitorPages(): Promise<ITvMonitorPage[]> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('tvmonitor_pages').select('*').order('name');
  if (error) {
    console.error('[TvMonitorConfig] list error:', error);
    return [];
  }
  return (data || []).map((row) => rowToPage(row as Record<string, unknown>));
}

export async function getTvMonitorPagesByOrgs(organizationIds: number[]): Promise<ITvMonitorPage[]> {
  if (!organizationIds.length) return [];
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('tvmonitor_pages')
    .select('*')
    .in('organization_id', organizationIds)
    .order('name');
  if (error) {
    console.error('[TvMonitorConfig] org list error:', error);
    return [];
  }
  return (data || []).map((row) => rowToPage(row as Record<string, unknown>));
}

export async function getTvMonitorPageBySlug(slug: string): Promise<ITvMonitorPage | null> {
  const db = getSupabaseAdmin();
  const { data, error } = await db.from('tvmonitor_pages').select('*').eq('slug', slug).maybeSingle();
  if (error || !data) {
    if (error) console.error('[TvMonitorConfig] by slug error:', error);
    return null;
  }
  return rowToPage(data as Record<string, unknown>);
}

export async function createTvMonitorPage(input: {
  name: string;
  slug: string;
  organization_id: number;
  facility_id: number;
  template?: TvMonitorTemplateKey;
  config?: unknown;
  created_by?: string | null;
}): Promise<ITvMonitorPage> {
  const db = getSupabaseAdmin();
  const slug = normalizeTvMonitorSlug(input.slug);
  if (!slug) throw new Error('A URL name (slug) is required');
  if (isReservedTvMonitorSlug(slug)) throw new Error(`"${slug}" is a reserved name — pick another URL name`);
  if (!input.name?.trim()) throw new Error('A page name is required');

  const organizationId = Number(input.organization_id);
  const facilityId = Number(input.facility_id);
  if (!Number.isFinite(organizationId) || organizationId <= 0) throw new Error('A valid organization ID is required');
  if (!Number.isFinite(facilityId) || facilityId <= 0) throw new Error('A valid facility ID is required');

  const config = input.config
    ? normalizeTvMonitorConfig(input.config)
    : buildTvMonitorTemplateConfig(input.template ?? 'custom');

  const { data, error } = await db
    .from('tvmonitor_pages')
    .insert({
      name: input.name.trim(),
      slug,
      organization_id: organizationId,
      facility_id: facilityId,
      config,
      created_by: input.created_by ?? null,
    })
    .select()
    .single();

  if (error || !data) {
    console.error('[TvMonitorConfig] create error:', error);
    if (error?.code === '23505') throw new Error(`A TV monitor page named "${slug}" already exists`);
    throw new Error(error?.message || 'Create failed');
  }
  return rowToPage(data as Record<string, unknown>);
}

export async function updateTvMonitorPage(
  slug: string,
  updates: {
    name?: string;
    slug?: string;
    is_active?: boolean;
    facility_id?: number;
    config?: unknown;
  },
): Promise<ITvMonitorPage> {
  const db = getSupabaseAdmin();
  const updateData: Record<string, unknown> = {};

  if (updates.name !== undefined) {
    if (!updates.name.trim()) throw new Error('A page name is required');
    updateData.name = updates.name.trim();
  }
  if (updates.slug !== undefined) {
    const next = normalizeTvMonitorSlug(updates.slug);
    if (!next) throw new Error('A URL name (slug) is required');
    if (isReservedTvMonitorSlug(next)) throw new Error(`"${next}" is a reserved name — pick another URL name`);
    updateData.slug = next;
  }
  if (updates.is_active !== undefined) updateData.is_active = Boolean(updates.is_active);
  if (updates.facility_id !== undefined) {
    const facilityId = Number(updates.facility_id);
    if (!Number.isFinite(facilityId) || facilityId <= 0) throw new Error('A valid facility ID is required');
    updateData.facility_id = facilityId;
  }
  if (updates.config !== undefined) updateData.config = normalizeTvMonitorConfig(updates.config);

  const { error: updateError } = await db.from('tvmonitor_pages').update(updateData).eq('slug', slug);
  if (updateError) {
    console.error('[TvMonitorConfig] update error:', updateError);
    if (updateError.code === '23505') throw new Error('That URL name is already taken');
    throw new Error(updateError.message);
  }

  const fetchSlug = typeof updateData.slug === 'string' ? updateData.slug : slug;
  const { data, error: fetchError } = await db.from('tvmonitor_pages').select('*').eq('slug', fetchSlug).single();
  if (fetchError || !data) {
    throw new Error(fetchError?.message || 'Not found after update');
  }
  return rowToPage(data as Record<string, unknown>);
}

export async function deleteTvMonitorPage(slug: string): Promise<boolean> {
  const db = getSupabaseAdmin();
  const { error } = await db.from('tvmonitor_pages').delete().eq('slug', slug);
  if (error) {
    console.error('[TvMonitorConfig] delete error:', error);
    return false;
  }
  return true;
}
