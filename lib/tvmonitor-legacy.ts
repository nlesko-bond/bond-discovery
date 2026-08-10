/**
 * Helpers for the "legacy browser" render path
 * (lib/tvmonitor-legacy-render.ts + app/tvmonitor/[slug]/legacy/route.ts) —
 * see docs/tvmonitor.md for why that path exists at all (short version: old
 * signage Chromium can't survive React hydration, so the fix is a separate
 * zero-client-JS page, not polyfills). Everything here returns plain strings,
 * not JSX — react-dom/server (needed to turn JSX into a string) can't be
 * imported from anything reachable by a file under app/, which rules out
 * JSX for this whole render path.
 */

import type { TvMonitorAdAsset } from '@/types/tvmonitor';

const CLOUDINARY_HOST = 'res.cloudinary.com';

/** Escapes text for safe use as HTML content or inside a double-quoted attribute. */
export function escapeHtml(input: string): string {
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * AVIF/WebP decoding requires a modern Chromium (85+ for AVIF); on old
 * signage hardware an AVIF logo/ad image just renders as a broken-image
 * icon. For our own Cloudinary-hosted uploads we can force a universally
 * decodable format by inserting an `f_png` delivery transformation into the
 * URL — no re-upload needed, Cloudinary transcodes on the fly. Externally
 * pasted URLs (not our Cloudinary account) pass through unchanged; there's
 * no way to transform a format we don't control the delivery of.
 */
export function toLegacyImageUrl(url: string | null | undefined): string | null {
  if (!url) return null;
  try {
    const parsed = new URL(url);
    if (parsed.hostname !== CLOUDINARY_HOST) return url;
    const marker = '/image/upload/';
    const idx = parsed.pathname.indexOf(marker);
    if (idx === -1) return url;
    const before = parsed.pathname.slice(0, idx + marker.length);
    const after = parsed.pathname.slice(idx + marker.length);
    if (/^f_png(?:[,/]|$)/.test(after)) return url; // already forced
    parsed.pathname = `${before}f_png/${after}`;
    return parsed.toString();
  } catch {
    return url;
  }
}

/**
 * Legacy pages have no client JS to rotate ad assets on a timer. Each
 * meta-refresh reload picks a slot in a duration-weighted wall-clock cycle,
 * so across reloads the assets appear roughly in proportion to their
 * configured duration instead of always showing only the first one.
 */
export function pickRotatingAsset(assets: TvMonitorAdAsset[], now: Date): TvMonitorAdAsset | null {
  if (assets.length === 0) return null;
  if (assets.length === 1) return assets[0];
  const durations = assets.map((a) => Math.max(1, a.durationSeconds));
  const totalSeconds = durations.reduce((sum, d) => sum + d, 0);
  const elapsed = (now.getTime() / 1000) % totalSeconds;
  let acc = 0;
  for (let i = 0; i < assets.length; i += 1) {
    acc += durations[i];
    if (elapsed < acc) return assets[i];
  }
  return assets[assets.length - 1];
}

/**
 * Simple stroke-based weather icons as inline SVG markup. Signage displays
 * have no emoji font, so an emoji glyph (the modern view's `weather.icon`)
 * renders as an empty box; SVG has no font dependency at all.
 */
export function legacyWeatherIconSvg(weatherCode: number, size = 32): string {
  const open = (extra = '') =>
    `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" ` +
    `stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"${extra}>`;

  if (weatherCode === 0) {
    return (
      `${open()}` +
      `<circle cx="12" cy="12" r="4.5" />` +
      `<path d="M12 2v3M12 19v3M4.2 4.2l2.1 2.1M17.7 17.7l2.1 2.1M2 12h3M19 12h3M4.2 19.8l2.1-2.1M17.7 6.3l2.1-2.1" />` +
      `</svg>`
    );
  }
  if (weatherCode <= 2) {
    return (
      `${open()}` +
      `<circle cx="9" cy="9" r="3.5" />` +
      `<path d="M9 2.5v2M9 15.5v0M2.5 9h2M15.5 9h0M4.5 4.5l1.4 1.4M13.1 13.1l0 0" />` +
      `<path d="M9.5 18.5a5 5 0 0 1 .3-9.9 6 6 0 0 1 11 3A4.5 4.5 0 0 1 19.5 20H10a4 4 0 0 1-.5-8" />` +
      `</svg>`
    );
  }
  if (weatherCode === 3 || weatherCode === 45 || weatherCode === 48) {
    return (
      `${open()}` +
      `<path d="M7 17a4.5 4.5 0 0 1 .5-9 6 6 0 0 1 11.3 2.7A4.2 4.2 0 0 1 18 17H7Z" />` +
      (weatherCode !== 3 ? `<path d="M4 20h16M6 22.5h12" />` : '') +
      `</svg>`
    );
  }
  if (weatherCode >= 95) {
    return (
      `${open()}` +
      `<path d="M7 15a4.5 4.5 0 0 1 .5-9 6 6 0 0 1 11.3 2.7A4.2 4.2 0 0 1 18 15H7Z" />` +
      `<path d="M13 14l-3 5h3l-2 4" />` +
      `</svg>`
    );
  }
  if ((weatherCode >= 71 && weatherCode <= 77) || weatherCode === 85 || weatherCode === 86) {
    return (
      `${open()}` +
      `<path d="M7 13a4.5 4.5 0 0 1 .5-9 6 6 0 0 1 11.3 2.7A4.2 4.2 0 0 1 18 13H7Z" />` +
      `<path d="M8 17v5M8 18.5l-2 1.2M8 18.5l2 1.2M14 17v5M14 18.5l-2 1.2M14 18.5l2 1.2" />` +
      `</svg>`
    );
  }
  if (weatherCode >= 51) {
    return (
      `${open()}` +
      `<path d="M7 13a4.5 4.5 0 0 1 .5-9 6 6 0 0 1 11.3 2.7A4.2 4.2 0 0 1 18 13H7Z" />` +
      `<path d="M8 17l-1.2 3M13 17l-1.2 3M18 17l-1.2 3" />` +
      `</svg>`
    );
  }
  // Fallback — generic gauge/thermometer
  return `${open()}<rect x="10" y="3" width="4" height="12" rx="2" /><circle cx="12" cy="18" r="3" /></svg>`;
}
