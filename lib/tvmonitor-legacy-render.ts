/**
 * Renders a TV Monitor page as a single, complete, framework-free HTML
 * string for old/embedded signage browsers (e.g. webOS Chromium 53-68) that
 * cannot survive this app's normal React hydration at all — see
 * docs/tvmonitor.md for the full story. Consumed only by
 * app/tvmonitor/[slug]/legacy/route.ts.
 *
 * This is plain string building, not JSX: react-dom/server (needed to turn
 * JSX into a string) cannot be imported from anything reachable by a file
 * under app/ — Next's App Router build rejects it outright, regardless of
 * how many modules deep the import is. That's not a limitation to work
 * around; it's consistent with the whole point of this file, which is to
 * ship a page with NO framework runtime dependency whatsoever.
 *
 * Consequences of "no client JS, ever" that show up throughout this file:
 * - Data freshness comes from `<meta http-equiv="refresh">` (full reload),
 *   not fetch polling.
 * - The clock/date are plain text computed from the `now` passed in at
 *   request time — not ticking.
 * - Auto-scroll and the ticker are CSS `@keyframes` loops (duplicated content
 *   + a translate loop), not the JS seamless-scroll engine.
 *   scrollPauseSeconds isn't replicated (continuous linear scroll only), and
 *   a column that doesn't actually overflow will still gently loop (no DOM
 *   measurement is possible without JS) — cosmetic differences, not bugs.
 * - Ad assets "rotate" only across meta-refresh reloads (pickRotatingAsset),
 *   not on an in-page timer.
 * - No CSS Grid, `dvh`, flex `gap`, `inset` shorthand, or CSS `min()/max()`
 *   (screenRatio letterboxing is skipped — always fills the viewport): all
 *   either missing or landed later than Chrome 53. Flexbox + `vh` + explicit
 *   longhand + margins for spacing only — nothing here depends on the
 *   Tailwind stylesheet, which isn't loaded on this path either.
 * - No custom Google Font — a generic system stack only, to drop an external
 *   network dependency this render path doesn't need.
 * - All dynamic text (event/title/notes/weather/ticker content, all of which
 *   ultimately comes from Bond data or admin-entered config) goes through
 *   escapeHtml before being concatenated into the response.
 */

import {
  formatEventDuration,
  formatEventTime,
  groupScheduleSlots,
  isSlotHappeningNow,
  resourceColorFor,
  slotStartTimestamp,
  type GroupedScheduleSlot,
} from '@/lib/tvmonitor-schedule-format';
import {
  escapeHtml,
  legacyWeatherIconSvg,
  pickRotatingAsset,
  toLegacyImageUrl,
  zonedWallClockDate,
} from '@/lib/tvmonitor-legacy';
import type {
  TvMonitorAdSlot,
  TvMonitorConfig,
  TvMonitorSchedulePayload,
  TvMonitorWeatherPayload,
} from '@/types/tvmonitor';

const FONT_STACK = 'Arial, Helvetica, sans-serif';

function qrSrc(url: string): string {
  return `https://api.qrserver.com/v1/create-qr-code/?size=160x160&data=${encodeURIComponent(url)}`;
}

function legacyScrollDurationSeconds(itemCount: number, scrollSpeed: number): number {
  const base = Math.max(3, itemCount) * 6;
  const speedFactor = Math.max(0.4, scrollSpeed / 3);
  return Math.max(10, Math.round(base / speedFactor));
}

interface Props {
  config: TvMonitorConfig;
  schedule: TvMonitorSchedulePayload | null;
  weather: TvMonitorWeatherPayload | null;
  now: Date;
  pageName: string;
}

export function renderTvMonitorLegacyHtml(props: Props): string {
  const { config, schedule, weather, now, pageName } = props;
  const { design, header, schedule: scheduleBlock, ads, ticker } = config;
  const spaces = schedule?.spaces ?? [];

  const enabledAds = ads.filter((slot) => slot.enabled);
  const headerAd = header.sponsorAdId ? enabledAds.find((slot) => slot.id === header.sponsorAdId) : undefined;
  const zoneAds = (placement: TvMonitorAdSlot['placement'], fullHeight?: boolean) =>
    enabledAds.filter(
      (slot) =>
        slot.placement === placement &&
        slot.id !== header.sponsorAdId &&
        (placement === 'left' || placement === 'right' ? slot.fullHeight === Boolean(fullHeight) : true),
    );

  const gradient = `linear-gradient(160deg, ${design.bgColor1} 0%, ${design.bgColor2} 100%)`;
  const bgImage = toLegacyImageUrl(design.bgImageUrl);
  const cardBorder = design.cardBorder;
  const cardBg = design.cardBg;
  const accent = design.accentColor;
  const secondary = design.secondaryFontColor;

  // Bond's slot times carry no timezone marker (see zonedWallClockDate) — the
  // clock/date and "happening now" state need the facility's real timezone
  // to be correct on this server-rendered path. Falls back to the server's
  // own timezone (usually UTC on Vercel) if it isn't configured, which is
  // wrong for basically every real facility; the editor warns when this is
  // missing with legacy mode on.
  const facilityTimeZone = scheduleBlock.timezone ?? undefined;
  const nowForLiveCheck = scheduleBlock.timezone ? zonedWallClockDate(now, scheduleBlock.timezone) : now;

  const clockText = header.showClock
    ? now.toLocaleTimeString([], { hour: 'numeric', minute: '2-digit', hour12: true, timeZone: facilityTimeZone })
    : null;
  const dateText = header.showDate
    ? now.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', timeZone: facilityTimeZone })
    : null;

  function adSlotSizeCss(slot: TvMonitorAdSlot, axis: 'width' | 'height'): string {
    const value = slot.sizeMode === 'ratio' ? `${slot.sizePercent}%` : `${slot.sizePx}px`;
    return `${axis}:${value};flex-shrink:0;`;
  }

  function renderAdSlot(slot: TvMonitorAdSlot, axis: 'width' | 'height', headerMode = false): string {
    const asset = pickRotatingAsset(slot.assets, now);
    const crossAxis = axis === 'width' ? 'height:100%;' : 'width:100%;';
    const bg = slot.backgroundColor !== 'transparent' ? `background:${escapeHtml(slot.backgroundColor)};` : '';
    let inner = '';
    if (asset) {
      if (asset.type === 'video') {
        inner =
          `<video src="${escapeHtml(asset.src)}" autoplay muted loop playsinline ` +
          `style="width:${headerMode ? 'auto' : '100%'};height:100%;object-fit:${asset.fit};"></video>`;
      } else {
        const src = toLegacyImageUrl(asset.src) ?? asset.src;
        inner =
          `<img src="${escapeHtml(src)}" alt="" ` +
          `style="width:${headerMode ? 'auto' : '100%'};height:100%;max-width:100%;object-fit:${asset.fit};" />`;
      }
    }
    return (
      `<div style="${adSlotSizeCss(slot, axis)}${crossAxis}${bg}overflow:hidden;display:flex;align-items:center;justify-content:center;">` +
      `${inner}</div>`
    );
  }

  // -- Header -----------------------------------------------------------
  const logoUrl = header.showLogo && header.logoUrl ? toLegacyImageUrl(header.logoUrl) ?? header.logoUrl : null;
  const logoHtml = logoUrl
    ? `<img src="${escapeHtml(logoUrl)}" alt="" style="height:${header.logoHeightPx}px;max-width:${header.logoHeightPx * 3.5}px;object-fit:contain;flex-shrink:0;" />`
    : '';
  const titleHtml = header.showTitle
    ? `<h1 style="margin:0;font-size:${header.titleSizePx}px;font-weight:800;letter-spacing:-0.02em;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(header.title)}</h1>`
    : '';

  const weatherChipHtml = weather
    ? `<div style="display:flex;flex-direction:column;align-items:center;line-height:1.2;">` +
      `<div style="color:${accent};">${legacyWeatherIconSvg(weather.weatherCode, header.layout === 'centered' ? 40 : 32)}</div>` +
      `<div style="font-weight:700;font-size:20px;">${weather.temperatureF}°F</div>` +
      `<div style="font-size:12px;color:${secondary};max-width:140px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">` +
      `${escapeHtml(weather.location.split(',')[0]?.trim() || weather.location)}</div>` +
      `</div>`
    : '';

  function qrHtml(url: string | null, label: string): string {
    if (!url) return '';
    return (
      `<div style="display:flex;flex-direction:column;align-items:center;">` +
      `<img src="${escapeHtml(qrSrc(url))}" alt="${escapeHtml(label)}" style="height:64px;width:64px;border-radius:6px;background:#fff;padding:4px;margin-bottom:4px;" />` +
      `<span style="font-size:11px;color:${secondary};text-align:center;max-width:100px;display:block;">${escapeHtml(label)}</span>` +
      `</div>`
    );
  }

  let headerHtml = '';
  if (header.enabled && header.layout === 'inline') {
    const leftGroup =
      header.logoPosition === 'right'
        ? `<span style="margin-right:16px;">${titleHtml}</span>${logoHtml}`
        : `${logoHtml}<span style="margin-left:${logoHtml ? '16px' : '0'};">${titleHtml}</span>`;
    const rightGroup =
      `<span style="margin-right:32px;">${qrHtml(header.scheduleQr.enabled ? header.scheduleQr.url : null, header.scheduleQr.label)}</span>` +
      `<span style="margin-right:32px;">${qrHtml(header.waiverQr.enabled ? header.waiverQr.url : null, header.waiverQr.label)}</span>` +
      (weatherChipHtml ? `<span style="margin-right:32px;">${weatherChipHtml}</span>` : '') +
      `<div style="text-align:right;">` +
      (clockText ? `<div style="font-size:44px;font-weight:700;">${escapeHtml(clockText)}</div>` : '') +
      (dateText
        ? `<div style="font-size:13px;text-transform:uppercase;letter-spacing:0.08em;color:${secondary};">${escapeHtml(dateText)}</div>`
        : '') +
      `</div>`;
    headerHtml =
      `<header style="display:flex;flex-wrap:wrap;align-items:center;justify-content:space-between;border-bottom:1px solid ${cardBorder};padding:16px 32px;">` +
      `<div style="display:flex;align-items:center;min-width:14rem;flex:1 1 0;">${leftGroup}</div>` +
      (headerAd ? renderAdSlot(headerAd, 'height', true) : '') +
      `<div style="display:flex;align-items:center;">${rightGroup}</div>` +
      `</header>`;
  } else if (header.enabled && header.layout === 'centered') {
    headerHtml =
      `<header style="display:flex;align-items:center;justify-content:space-between;padding:16px 32px;">` +
      `<div style="display:flex;align-items:center;flex:1 1 0;">` +
      (headerAd ? `<span style="margin-right:24px;">${renderAdSlot(headerAd, 'height', true)}</span>` : '') +
      `<span style="margin-right:24px;">${qrHtml(header.scheduleQr.enabled ? header.scheduleQr.url : null, header.scheduleQr.label)}</span>` +
      `${qrHtml(header.waiverQr.enabled ? header.waiverQr.url : null, header.waiverQr.label)}` +
      `</div>` +
      `<div style="display:flex;align-items:center;justify-content:center;">` +
      (weatherChipHtml ? `<span style="margin-right:24px;">${weatherChipHtml}</span>` : '') +
      `<div style="text-align:center;">` +
      (clockText ? `<div style="font-size:44px;font-weight:700;color:${accent};">${escapeHtml(clockText)}</div>` : '') +
      (dateText
        ? `<div style="font-size:13px;font-style:italic;font-weight:600;text-transform:uppercase;letter-spacing:0.08em;">${escapeHtml(dateText)}</div>`
        : '') +
      `</div></div>` +
      `<div style="display:flex;flex:1 1 0;justify-content:flex-end;">${logoHtml}</div>` +
      `</header>`;
  }

  const centeredTitleBannerHtml =
    header.enabled && header.layout === 'centered' && header.showTitle
      ? `<div style="margin-bottom:16px;flex-shrink:0;border-radius:6px;padding:8px 16px;text-align:center;` +
        `text-transform:uppercase;letter-spacing:0.02em;font-weight:800;font-size:${header.titleSizePx}px;` +
        `background:${accent};color:${design.fontColor};">${escapeHtml(header.title)}</div>`
      : '';

  const hideSpaceNames = Boolean(header.enabled && header.layout === 'centered' && header.showTitle && spaces.length <= 1);

  // -- Schedule -----------------------------------------------------------
  const notesFontSize = scheduleBlock.notesSize === 'large' ? 22 : scheduleBlock.notesSize === 'medium' ? 18 : 14;
  const plain = scheduleBlock.cardStyle === 'plain';

  function renderEventCard(event: GroupedScheduleSlot): string {
    const live = isSlotHappeningNow(event, nowForLiveCheck);
    const isMaintenance = event.slotType === 'maintenance';
    const title = event.isPrivate
      ? scheduleBlock.privateEventLabel
      : isMaintenance
        ? scheduleBlock.maintenanceLabel
        : event.reservationName;
    const notesHtml =
      scheduleBlock.showNotes && event.notes && !event.isPrivate
        ? `<div style="margin-top:4px;font-size:${notesFontSize}px;white-space:pre-line;color:${scheduleBlock.notesColor || accent};` +
          `font-style:${scheduleBlock.notesItalic ? 'italic' : 'normal'};font-weight:${scheduleBlock.notesBold ? 700 : 400};">` +
          `${escapeHtml(event.notes.replace(/\n{2,}/g, '\n').trim())}</div>`
        : '';
    const timeRowHtml = `<span style="font-weight:600;color:${secondary};">${escapeHtml(formatEventTime(event.startTime))} – ${escapeHtml(formatEventTime(event.endTime))}</span>`;
    const durationChipHtml =
      `<span style="margin-left:8px;padding:2px 8px;border-radius:999px;font-size:12px;background:${cardBorder};color:${secondary};">` +
      `${escapeHtml(formatEventDuration(event.startTime, event.endTime))}</span>`;
    const nowChipHtml = live
      ? `<span style="margin-left:8px;padding:2px 8px;border-radius:999px;font-size:11px;font-weight:700;text-transform:uppercase;background:${accent};color:${design.bgColor1};">Now</span>`
      : '';

    if (plain) {
      return (
        `<div style="margin-bottom:20px;padding-bottom:16px;border-bottom:1px solid ${cardBorder};text-align:center;">` +
        `<div>${timeRowHtml}${nowChipHtml}</div>` +
        `<div style="margin-top:4px;font-size:20px;font-weight:700;">${escapeHtml(title)}</div>` +
        `${notesHtml}</div>`
      );
    }
    return (
      `<div style="margin-bottom:16px;border-radius:12px;border:1px solid ${live ? accent : cardBorder};background:${cardBg};padding:16px;">` +
      `<div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:4px;">` +
      `<div>${timeRowHtml}</div><div>${nowChipHtml}${durationChipHtml}</div></div>` +
      `<div style="font-size:20px;font-weight:700;">${escapeHtml(title)}</div>` +
      `${notesHtml}</div>`
    );
  }

  function marqueeWrap(contentHtml: string, itemCount: number): string {
    if (!scheduleBlock.autoScroll || itemCount === 0) {
      return `<div style="flex:1 1 0;min-height:0;overflow:hidden;">${contentHtml}</div>`;
    }
    const durationSeconds = legacyScrollDurationSeconds(itemCount, scheduleBlock.scrollSpeed);
    return (
      `<div style="position:relative;flex:1 1 0;min-height:0;overflow:hidden;">` +
      `<div style="position:absolute;top:0;right:0;bottom:0;left:0;-webkit-animation:tvLegacyColScroll ${durationSeconds}s linear infinite;animation:tvLegacyColScroll ${durationSeconds}s linear infinite;">` +
      `${contentHtml}${contentHtml}</div></div>`
    );
  }

  let scheduleAreaHtml = '';
  if (!scheduleBlock.enabled) {
    scheduleAreaHtml = '';
  } else if (spaces.length === 0) {
    scheduleAreaHtml = `<div style="display:flex;height:100%;align-items:center;justify-content:center;font-size:24px;color:${secondary};">Add resources to this schedule to see events.</div>`;
  } else if (scheduleBlock.viewMode === 'feed') {
    const items: Array<GroupedScheduleSlot & { spaceName: string; spaceColor: string }> = [];
    spaces.forEach((space, index) => {
      groupScheduleSlots(space.slots, scheduleBlock).forEach((event) => {
        items.push({ ...event, spaceName: space.name, spaceColor: resourceColorFor(index) });
      });
    });
    items.sort((a, b) => slotStartTimestamp(a) - slotStartTimestamp(b));
    const listHtml = items
      .map(
        (event) =>
          `<div style="margin-bottom:16px;display:flex;">` +
          `<div style="width:6px;border-radius:999px;background:${event.spaceColor};flex-shrink:0;margin-right:16px;"></div>` +
          `<div style="flex:1 1 0;min-width:0;">` +
          `<span style="display:inline-flex;align-items:center;padding:4px 12px;border-radius:999px;border:1px solid ${cardBorder};font-weight:600;">` +
          `<span style="width:10px;height:10px;border-radius:999px;background:${event.spaceColor};margin-right:8px;display:inline-block;"></span>` +
          `${escapeHtml(event.spaceName)}</span>` +
          `${renderEventCard(event)}</div></div>`,
      )
      .join('');
    scheduleAreaHtml = marqueeWrap(`<div>${listHtml}</div>`, items.length);
  } else {
    const hasWayfinding =
      spaces.length > 1 &&
      scheduleBlock.primaryResourceId != null &&
      spaces.some((s) => s.id === scheduleBlock.primaryResourceId);

    const wayfindingRowHtml = hasWayfinding
      ? `<div style="display:flex;margin-bottom:8px;flex-shrink:0;">` +
        spaces
          .map(
            (space) =>
              `<div style="flex:1 1 0;display:flex;justify-content:center;margin-left:12px;margin-right:12px;">` +
              (space.id === scheduleBlock.primaryResourceId
                ? `<div style="text-align:center;">` +
                  `<div style="border-radius:6px 6px 0 0;padding:6px 16px;font-size:13px;font-weight:800;text-transform:uppercase;` +
                  `letter-spacing:0.08em;background:${accent};color:${design.bgColor1};">${escapeHtml(scheduleBlock.wayfindingLabel)}</div>` +
                  `<div style="width:0;height:0;margin:0 auto;border-left:8px solid transparent;border-right:8px solid transparent;border-top:8px solid ${accent};"></div>` +
                  `</div>`
                : '') +
              `</div>`,
          )
          .join('') +
        `</div>`
      : '';

    const columnsHtml = spaces
      .map((space) => {
        const events = groupScheduleSlots(space.slots, scheduleBlock);
        const muted = hasWayfinding && space.id !== scheduleBlock.primaryResourceId;
        const listHtml =
          events.length === 0
            ? `<div style="padding:24px 0;color:${secondary};">No upcoming events</div>`
            : `<div>${events.map((event) => renderEventCard(event)).join('')}</div>`;
        const nameHtml = !hideSpaceNames
          ? `<div style="margin-bottom:12px;padding-bottom:8px;border-bottom:2px solid ${accent};">` +
            `<h2 style="margin:0;font-size:26px;font-weight:700;text-align:${plain ? 'center' : 'left'};">${escapeHtml(space.name)}</h2></div>`
          : '';
        return (
          `<div style="flex:1 1 0;min-width:0;display:flex;flex-direction:column;margin-left:12px;margin-right:12px;opacity:${muted ? 0.55 : 1};">` +
          `${nameHtml}${marqueeWrap(listHtml, events.length)}</div>`
        );
      })
      .join('');

    scheduleAreaHtml =
      `<div style="display:flex;flex-direction:column;height:100%;min-height:0;">` +
      `${wayfindingRowHtml}<div style="display:flex;flex:1 1 0;min-height:0;">${columnsHtml}</div></div>`;
  }

  // -- Ticker ---------------------------------------------------------------
  const tickerTextRaw = ticker.enabled && ticker.messages.length > 0 ? ticker.messages.join('     •     ') : null;
  const tickerHtml = tickerTextRaw
    ? (() => {
        const durationSeconds = Math.max(8, tickerTextRaw.length / (ticker.scrollSpeed * 2.5));
        const escapedText = escapeHtml(tickerTextRaw);
        const labelHtml = ticker.label
          ? `<div style="flex-shrink:0;display:flex;align-items:center;padding:12px 20px;font-size:18px;font-weight:700;` +
            `text-transform:uppercase;letter-spacing:0.08em;background:${accent};color:${design.bgColor1};">${escapeHtml(ticker.label)}</div>`
          : '';
        return (
          `<div style="position:relative;display:flex;flex-shrink:0;border-top:1px solid ${cardBorder};background:${cardBg};overflow:hidden;">` +
          `${labelHtml}` +
          `<div style="position:relative;flex:1 1 0;min-width:0;overflow:hidden;">` +
          `<div style="display:flex;width:max-content;align-items:center;white-space:nowrap;padding:12px 0;font-size:18px;` +
          `-webkit-animation:tvLegacyTicker ${durationSeconds}s linear infinite;animation:tvLegacyTicker ${durationSeconds}s linear infinite;">` +
          `<span style="padding-right:64px;">${escapedText}</span><span style="padding-right:64px;">${escapedText}</span>` +
          `</div></div></div>`
        );
      })()
    : '';

  // -- Ad zones ---------------------------------------------------------------
  const leftFullAds = zoneAds('left', true).map((s) => renderAdSlot(s, 'width')).join('');
  const rightFullAds = zoneAds('right', true).map((s) => renderAdSlot(s, 'width')).join('');
  const topAds = zoneAds('top').map((s) => renderAdSlot(s, 'height')).join('');
  const bottomAds = zoneAds('bottom').map((s) => renderAdSlot(s, 'height')).join('');
  const leftAds = zoneAds('left').map((s) => renderAdSlot(s, 'width')).join('');
  const rightAds = zoneAds('right').map((s) => renderAdSlot(s, 'width')).join('');

  const bodyBackground = bgImage ? design.bgColor2 : gradient;
  const bgLayerHtml = bgImage
    ? `<div style="position:absolute;top:0;right:0;bottom:0;left:0;background-image:url(${escapeHtml(bgImage)});background-size:cover;background-position:center;"></div>` +
      `<div style="position:absolute;top:0;right:0;bottom:0;left:0;background:${gradient};opacity:${design.bgImageOverlayOpacity / 100};"></div>`
    : '';

  const bodyHtml =
    `<body style="font-family:${FONT_STACK};color:${design.fontColor};background:${bodyBackground};position:relative;` +
    `min-height:100vh;height:100vh;overflow:hidden;display:flex;flex-direction:column;margin:0;padding:0;">` +
    bgLayerHtml +
    `<div style="position:relative;display:flex;flex:1 1 0;min-height:0;">` +
    leftFullAds +
    `<div style="display:flex;flex-direction:column;flex:1 1 0;min-width:0;min-height:0;">` +
    topAds +
    headerHtml +
    `<div style="display:flex;flex:1 1 0;min-height:0;">` +
    leftAds +
    `<main style="display:flex;flex-direction:column;flex:1 1 0;min-width:0;min-height:0;padding:16px 32px;">` +
    centeredTitleBannerHtml +
    `<div style="flex:1 1 0;min-height:0;">${scheduleAreaHtml}</div>` +
    `</main>` +
    rightAds +
    `</div>` +
    bottomAds +
    `</div>` +
    rightFullAds +
    `</div>` +
    tickerHtml +
    `</body>`;

  const headHtml =
    `<head>` +
    `<meta charset="utf-8" />` +
    `<meta name="viewport" content="width=device-width, initial-scale=1" />` +
    `<meta http-equiv="refresh" content="${config.refreshSeconds}" />` +
    `<title>${escapeHtml(pageName)} — TV Monitor</title>` +
    `<meta name="robots" content="noindex, nofollow" />` +
    `<style>` +
    `html, body { margin: 0; padding: 0; height: 100%; }` +
    `* { box-sizing: border-box; }` +
    // Unprefixed @keyframes/animation only landed in Chrome 43 — the actual
    // target hardware for this render path (webOS 3.x, Chromium 38) needs
    // the -webkit- prefix. Both are declared; unrecognized rules are
    // ignored, so having both is always safe.
    `@-webkit-keyframes tvLegacyColScroll { from { -webkit-transform: translateY(0); } to { -webkit-transform: translateY(-50%); } }` +
    `@keyframes tvLegacyColScroll { from { transform: translateY(0); } to { transform: translateY(-50%); } }` +
    `@-webkit-keyframes tvLegacyTicker { from { -webkit-transform: translateX(0); } to { -webkit-transform: translateX(-50%); } }` +
    `@keyframes tvLegacyTicker { from { transform: translateX(0); } to { transform: translateX(-50%); } }` +
    `</style>` +
    `</head>`;

  return `<!DOCTYPE html><html lang="en">${headHtml}${bodyHtml}</html>`;
}
