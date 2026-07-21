/**
 * TV Monitor pages — full-screen facility schedule displays at /tvmonitor/{slug}.
 *
 * A page belongs to one org + facility and renders building blocks:
 * header (logo/title/clock/QR/sponsor ad), resource schedule columns, and
 * fixed ad placements (image/video today; JS ad tags are a future block type).
 */

export type TvMonitorTemplateKey = 'rink-classic' | 'sponsor-spotlight' | 'promo-banner' | 'custom';

/** 'fill' stretches to the viewport; fixed ratios letterbox on mismatched screens. */
export type TvMonitorScreenRatio = 'fill' | '16:9' | '4:3' | '21:9' | '9:16';

export type TvMonitorScrollMode = 'synchronized' | 'independent';

export type TvMonitorThemeKey = 'dark' | 'light';

export interface TvMonitorDesign {
  theme: TvMonitorThemeKey;
  /** Google Font family name, e.g. "Plus Jakarta Sans". */
  fontFamily: string;
  /** Primary text color. */
  fontColor: string;
  /** Secondary text color (times, durations, muted labels). */
  secondaryFontColor: string;
  /** Highlight color (maintenance markers, accents, section headers). */
  accentColor: string;
  /** Page background gradient start (use the same value as bgColor2 for a solid). */
  bgColor1: string;
  /** Page background gradient end. */
  bgColor2: string;
  /** Optional full-screen background image (e.g. arena photo); gradient overlays it. */
  bgImageUrl: string | null;
  /** How strongly the color gradient covers the background image (0–100, higher = darker/more color). */
  bgImageOverlayOpacity: number;
  /** Event card background. */
  cardBg: string;
  /** Event card border. */
  cardBorder: string;
}

export interface TvMonitorQrConfig {
  enabled: boolean;
  url: string | null;
  label: string;
}

/**
 * 'inline'   — logo + title on the left, sponsor center, QRs + clock right.
 * 'centered' — sponsor + QRs left, big clock/date center, logo right;
 *              the title renders as a banner bar on top of the schedule
 *              (the classic rink-TV look).
 */
export type TvMonitorHeaderLayout = 'inline' | 'centered';

export interface TvMonitorHeaderBlock {
  enabled: boolean;
  layout: TvMonitorHeaderLayout;
  showLogo: boolean;
  logoUrl: string | null;
  /** Rendered logo height in px (width scales to fit). */
  logoHeightPx: number;
  title: string;
  showTitle: boolean;
  showClock: boolean;
  showDate: boolean;
  scheduleQr: TvMonitorQrConfig;
  waiverQr: TvMonitorQrConfig;
  /** Optional sponsor ad slot rendered inside the header bar. */
  sponsorAdId: string | null;
}

export interface TvMonitorScheduleBlock {
  enabled: boolean;
  /** Bond space/resource IDs to display — one column per resource. */
  resourceIds: number[];
  /** How many hours ahead of now to pull slots for (1–24). */
  futureHoursLimit: number;
  showNotes: boolean;
  /** Size of event notes text on screen. */
  notesSize: 'small' | 'medium' | 'large';
  showMaintenance: boolean;
  showPrivateEvents: boolean;
  privateEventLabel: string;
  /** Label used for maintenance child slots (e.g. "Ice Cut", "Maintenance"). */
  maintenanceLabel: string;
  autoScroll: boolean;
  /** 1 (slow) – 5 (fast). */
  scrollSpeed: number;
  /** Whether all resource columns scroll in lock-step or each on its own. */
  scrollMode: TvMonitorScrollMode;
  /** Seconds to hold at the top/bottom before the scroll loop continues. */
  scrollPauseSeconds: number;
}

export type TvMonitorAdAssetType = 'image' | 'video';

export interface TvMonitorAdAsset {
  id: string;
  type: TvMonitorAdAssetType;
  /** https URL to the image or video file. */
  src: string;
  /** Seconds this asset stays on screen before rotating (videos loop within it). */
  durationSeconds: number;
  fit: 'cover' | 'contain';
}

export type TvMonitorAdPlacement = 'left' | 'right' | 'top' | 'bottom' | 'header';

export type TvMonitorAdSizeMode = 'pixels' | 'ratio';

export interface TvMonitorAdSlot {
  id: string;
  enabled: boolean;
  /** left/right = vertical rail, top/bottom = horizontal banner, header = inline in header bar. */
  placement: TvMonitorAdPlacement;
  /** Fixed placement sized in absolute pixels or as a % of the screen axis. */
  sizeMode: TvMonitorAdSizeMode;
  /** Rail width / banner height in px when sizeMode = 'pixels'. */
  sizePx: number;
  /** Rail width / banner height as % of the screen when sizeMode = 'ratio' (5–60). */
  sizePercent: number;
  /** Left/right rails only: span the full screen height, pushing the header/banners beside the rail (like a full-height sponsor poster). */
  fullHeight: boolean;
  backgroundColor: string;
  /** Rotation pool; a single asset just stays on screen. */
  assets: TvMonitorAdAsset[];
}

export interface TvMonitorConfig {
  template: TvMonitorTemplateKey;
  screenRatio: TvMonitorScreenRatio;
  design: TvMonitorDesign;
  header: TvMonitorHeaderBlock;
  schedule: TvMonitorScheduleBlock;
  ads: TvMonitorAdSlot[];
  /** How often the TV re-polls /api/tvmonitor/{slug}/schedule (seconds, min 30). */
  refreshSeconds: number;
}

export interface ITvMonitorPage {
  id: string;
  slug: string;
  name: string;
  is_active: boolean;
  organization_id: number;
  facility_id: number;
  config: TvMonitorConfig;
  created_by: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Org-scoped builder access link. The raw token is stored (admin-gated,
 * service-role-only table) so Bond admins can re-copy the link; sign-in
 * lookups still go through the sha256 hash. Grants created before token
 * storage have token = null.
 */
export interface ITvMonitorAccessGrant {
  id: string;
  organization_id: number;
  label: string;
  token: string | null;
  created_by: string | null;
  created_at: string;
  revoked_at: string | null;
  last_used_at: string | null;
}

// ---------------------------------------------------------------------------
// Bond slots-schedule payload (v4 public endpoint), normalized for the display
// ---------------------------------------------------------------------------

export interface TvMonitorSlot {
  slotId: number;
  parentSlotId: number | null;
  reservationId: number | null;
  reservationName: string;
  date: string;
  endDate: string;
  startTime: string;
  endTime: string;
  notes: string | null;
  spaceId: number;
  slotType: string;
  isPrivate: boolean;
}

export interface TvMonitorSpace {
  id: number;
  name: string;
  slots: TvMonitorSlot[];
}

export interface TvMonitorSchedulePayload {
  facilityId: number;
  facilityName: string;
  spaces: TvMonitorSpace[];
  fetchedAt: string;
}
