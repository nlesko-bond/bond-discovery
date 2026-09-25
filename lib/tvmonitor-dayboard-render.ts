/**
 * HTML for the 'dayboard' schedule view, as a plain string.
 *
 * One renderer serves both paths: the legacy zero-JS page splices it straight
 * into its response, and the React view (TvScheduleDayboard) injects it with
 * dangerouslySetInnerHTML. That keeps a board identical on an old LG webOS
 * display and a modern TV, and it means this file carries the legacy path's
 * CSS rules (see lib/tvmonitor-legacy-render.ts): flexbox + vh + longhand
 * only, no grid / flex gap / inset / min() / max(), and no calc()'d height
 * on a flex item — every region that fills space is position:absolute with
 * plain offsets, and rows are percentage heights of that region.
 *
 * Sizing is in vh so the board fits any screen resolution with no JS
 * measuring: rows split their section's height evenly, and font sizes scale
 * with how many rows a page holds (see eventFontVh / gameFontVh).
 *
 * All Bond- or admin-sourced text goes through escapeHtml.
 */

import {
  buildDayboardModel,
  dayboardPageTick,
  type DayboardLockerRoom,
  type DayboardModel,
  type DayboardRow,
  type DayboardSection,
  type DayboardSpaceTag,
} from '@/lib/tvmonitor-dayboard';
import { escapeHtml } from '@/lib/tvmonitor-legacy';
import { resourceColorFor } from '@/lib/tvmonitor-schedule-format';
import type { TvMonitorDesign, TvMonitorScheduleBlock, TvMonitorSpace } from '@/types/tvmonitor';

// Rough share of the screen the section rows get once the page header, the
// date heading and the section titles take theirs. Only font sizes depend on
// it — row heights are percentages of the real space — so a wrong guess
// means slightly large or small text, never overlap between rows.
const ROWS_AREA_VH = 62;
const HEADING_KICKER_VH = 3.2;
const HEADING_DATE_VH = 6.4;
const SECTION_TITLE_VH = 6;

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Event name size for a page of `slots` rows. */
export function eventFontVh(slots: number): number {
  return round(clamp((ROWS_AREA_VH / slots) * 0.32, 1.7, 3.6));
}

/** Team name size for a page of `slots` game cards (each card is three lines). */
export function gameFontVh(slots: number): number {
  return round(clamp((ROWS_AREA_VH / slots) * 0.24, 1.6, 3));
}

function parseHex(color: string): [number, number, number] | null {
  const hex = color.trim().replace(/^#/, '');
  if (/^[0-9a-f]{3}$/i.test(hex)) {
    return [0, 1, 2].map((i) => parseInt(hex[i] + hex[i], 16)) as [number, number, number];
  }
  if (/^[0-9a-f]{6}$/i.test(hex)) {
    return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)) as [number, number, number];
  }
  return null;
}

/** Dark or white text, whichever reads on `background`. Non-hex colors get white. */
export function readableTextOn(background: string): string {
  const rgb = parseHex(background);
  if (!rgb) return '#ffffff';
  const [r, g, b] = rgb.map((c) => {
    const s = c / 255;
    return s <= 0.03928 ? s / 12.92 : Math.pow((s + 0.055) / 1.055, 2.4);
  });
  const luminance = 0.2126 * r + 0.7152 * g + 0.0722 * b;
  return luminance > 0.4 ? '#0b1220' : '#ffffff';
}

function withAlpha(color: string, alpha: number, fallback: string): string {
  const rgb = parseHex(color);
  return rgb ? `rgba(${rgb[0]}, ${rgb[1]}, ${rgb[2]}, ${alpha})` : fallback;
}

interface Palette {
  font: string;
  secondary: string;
  accent: string;
  onAccent: string;
  border: string;
  liveBg: string;
}

/**
 * Colors are free text in the page config (studio users can set them) and
 * this HTML is injected with dangerouslySetInnerHTML on the React path, so
 * every color is escaped before it lands in a style attribute — otherwise a
 * value like `red"><img onerror=…>` would break out of it.
 */
function paletteFor(design: TvMonitorDesign): Palette {
  return {
    font: escapeHtml(design.fontColor),
    secondary: escapeHtml(design.secondaryFontColor),
    accent: escapeHtml(design.accentColor),
    onAccent: readableTextOn(design.accentColor),
    // cardBorder is tuned for faint card outlines; row dividers need a bit more.
    border: escapeHtml(withAlpha(design.fontColor, 0.14, design.cardBorder)),
    liveBg: escapeHtml(withAlpha(design.accentColor, 0.16, design.cardBg)),
  };
}

/**
 * Resource tag: the first resource is a solid accent tag, the second an
 * outline, any others solid palette colors. The text always names the
 * resource, so the styling is a second cue, never the only one.
 */
function spaceTagHtml(tag: DayboardSpaceTag, fontVh: number, p: Palette): string {
  const base =
    `display:inline-block;margin-left:0.8vh;padding:0.35vh 1vh;border-radius:0.8vh;white-space:nowrap;` +
    `font-size:${fontVh}vh;font-weight:800;letter-spacing:0.1em;text-transform:uppercase;`;
  if (tag.index === 1) {
    return `<span style="${base}border:0.25vh solid ${p.font};color:${p.font};">${escapeHtml(tag.label)}</span>`;
  }
  const fill = tag.index === 0 ? p.accent : resourceColorFor(tag.index);
  return (
    `<span style="${base}border:0.25vh solid ${fill};background:${fill};color:${readableTextOn(fill)};">` +
    `${escapeHtml(tag.label)}</span>`
  );
}

function lockerChipHtml(room: DayboardLockerRoom, fontVh: number, p: Palette): string {
  const label = room.label
    ? `<span style="color:${p.secondary};font-weight:700;margin-right:0.6vh;">${escapeHtml(room.label)}</span>`
    : '';
  return (
    `<span style="display:inline-block;margin-left:0.8vh;padding:0.3vh 0.9vh;border-radius:0.8vh;white-space:nowrap;` +
    `border:0.2vh solid ${p.secondary};font-size:${fontVh}vh;font-weight:800;">` +
    `${label}LR ${escapeHtml(room.rooms)}</span>`
  );
}

function liveChipHtml(fontVh: number, p: Palette): string {
  return (
    `<span style="display:inline-block;margin-left:1vh;padding:0.3vh 0.8vh;border-radius:0.6vh;vertical-align:middle;` +
    `font-size:${fontVh}vh;font-weight:900;letter-spacing:0.12em;background:${p.accent};color:${p.onAccent};">NOW</span>`
  );
}

function liveBarHtml(p: Palette): string {
  return `<div style="position:absolute;left:0;top:18%;bottom:18%;width:0.6vh;border-radius:0.3vh;background:${p.accent};"></div>`;
}

function rowBoxStyle(slots: number, live: boolean, p: Palette): string {
  return (
    `position:relative;height:${round(100 / slots)}%;overflow:hidden;border-top:1px solid ${live ? 'transparent' : p.border};` +
    (live ? `background:${p.liveBg};border-radius:1vh;` : '')
  );
}

function eventRowHtml(row: DayboardRow, slots: number, p: Palette): string {
  const font = eventFontVh(slots);
  const small = round(font * 0.62);
  const multiTime = row.times.length > 1;
  // Collapsed sessions list their times in a smaller stacked block.
  const timeFont = multiTime ? round(font * 0.66) : round(font * 0.92);
  const timesHtml = multiTime
    ? row.times.map((t) => `<div>${escapeHtml(t)}</div>`).join('')
    : escapeHtml(row.times[0] ?? '');
  const notesHtml = row.notes
    ? `<div style="font-size:${small}vh;font-weight:600;color:${p.secondary};white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:0.3vh;">${escapeHtml(row.notes)}</div>`
    : '';
  return (
    `<div style="${rowBoxStyle(slots, row.live, p)}">` +
    (row.live ? liveBarHtml(p) : '') +
    `<div style="position:absolute;top:0;bottom:0;left:1.6vh;right:1.2vh;display:flex;align-items:center;">` +
    `<div style="width:${round(font * 5.2)}vh;flex-shrink:0;font-size:${timeFont}vh;font-weight:800;line-height:1.15;">${timesHtml}</div>` +
    `<div style="flex:1 1 0;min-width:0;">` +
    `<div style="font-size:${font}vh;font-weight:800;line-height:1.12;max-height:2.3em;overflow:hidden;">` +
    `${escapeHtml(row.title)}${row.live ? liveChipHtml(round(font * 0.45), p) : ''}</div>` +
    `${notesHtml}</div>` +
    `<div style="flex-shrink:0;display:flex;align-items:center;">` +
    row.lockerRooms.map((room) => lockerChipHtml(room, small, p)).join('') +
    row.spaces.map((tag) => spaceTagHtml(tag, round(font * 0.55), p)).join('') +
    `</div></div></div>`
  );
}

function gameRowHtml(row: DayboardRow, slots: number, p: Palette): string {
  const font = gameFontVh(slots);
  const small = round(font * 0.66);
  const teamLine = (index: number) => {
    const team = row.teams[index];
    if (!team) return '';
    const vs = index === 1 ? `<span style="color:${p.secondary};font-weight:700;margin-right:0.8vh;">vs</span>` : '';
    return (
      `<div style="display:flex;align-items:center;font-size:${font}vh;font-weight:800;line-height:1.3;">` +
      `<div style="flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${vs}${escapeHtml(team.name)}</div>` +
      `<div style="flex-shrink:0;">${team.lockerRooms.map((room) => lockerChipHtml(room, small, p)).join('')}</div></div>`
    );
  };
  const extras =
    row.lockerRooms.length > 0 || row.notes
      ? `<div style="display:flex;align-items:center;font-size:${small}vh;color:${p.secondary};font-weight:600;line-height:1.3;">` +
        `<div style="flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;">${escapeHtml(row.notes ?? '')}</div>` +
        `<div style="flex-shrink:0;color:${p.font};">${row.lockerRooms.map((room) => lockerChipHtml(room, small, p)).join('')}</div></div>`
      : '';
  return (
    `<div style="${rowBoxStyle(slots, row.live, p)}">` +
    (row.live ? liveBarHtml(p) : '') +
    `<div style="position:absolute;top:0;bottom:0;left:1.6vh;right:0.6vh;display:flex;flex-direction:column;justify-content:center;">` +
    `<div style="display:flex;align-items:center;margin-bottom:0.4vh;">` +
    `<div style="flex:1 1 0;min-width:0;font-size:${round(font * 0.9)}vh;font-weight:900;color:${p.accent};">` +
    `${escapeHtml(row.times[0] ?? '')}${row.live ? liveChipHtml(round(font * 0.5), p) : ''}</div>` +
    `<div style="flex-shrink:0;">${row.spaces.map((tag) => spaceTagHtml(tag, round(font * 0.6), p)).join('')}</div></div>` +
    teamLine(0) +
    teamLine(1) +
    extras +
    `</div></div>`
  );
}

function sectionHtml(section: DayboardSection, p: Palette, style: string): string {
  const pager =
    section.pageCount > 1
      ? `<div style="flex-shrink:0;font-size:1.8vh;font-weight:800;letter-spacing:0.14em;text-transform:uppercase;color:${p.accent};">` +
        `Page ${section.pageIndex + 1} of ${section.pageCount}</div>`
      : '';
  const rowsHtml =
    section.rows.length === 0
      ? `<div style="padding-top:3vh;font-size:2.6vh;color:${p.secondary};">Nothing else scheduled today</div>`
      : section.rows
          .map((row) =>
            row.kind === 'game' ? gameRowHtml(row, section.slotsPerPage, p) : eventRowHtml(row, section.slotsPerPage, p),
          )
          .join('');
  return (
    `<div style="position:relative;${style}">` +
    `<div style="position:absolute;top:0;left:0;right:0;height:${SECTION_TITLE_VH}vh;display:flex;align-items:center;` +
    `border-bottom:0.4vh solid ${p.accent};">` +
    `<div style="flex:1 1 0;min-width:0;white-space:nowrap;overflow:hidden;text-overflow:ellipsis;font-size:3.6vh;font-weight:900;` +
    `letter-spacing:0.05em;text-transform:uppercase;">${escapeHtml(section.title)}</div>${pager}</div>` +
    `<div style="position:absolute;top:${SECTION_TITLE_VH + 0.8}vh;left:0;right:0;bottom:0;">${rowsHtml}</div>` +
    `</div>`
  );
}

export interface DayboardRenderInput {
  spaces: TvMonitorSpace[];
  settings: TvMonitorScheduleBlock;
  design: TvMonitorDesign;
  /** Reads the facility's wall clock (zonedWallClockDate on the server path). */
  now: Date;
  /** Real epoch ms — drives which page is showing. */
  epochMs: number;
}

export function dayboardDateHeading(now: Date): string {
  const weekday = now.toLocaleDateString('en-US', { weekday: 'long' });
  const monthDay = now.toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  return `${weekday} · ${monthDay}`;
}

export function renderDayboardHtml(input: DayboardRenderInput): { html: string; model: DayboardModel } {
  const { spaces, settings, design, now, epochMs } = input;
  const { dayboard } = settings;
  const p = paletteFor(design);
  const model = buildDayboardModel(spaces, settings, now, dayboardPageTick(epochMs, dayboard.pageSeconds));

  const kicker = dayboard.heading.trim();
  const headingVh = (kicker ? HEADING_KICKER_VH : 0) + (dayboard.showDateHeading ? HEADING_DATE_VH : 0);
  const headingHtml =
    headingVh > 0
      ? `<div style="position:absolute;top:0;left:0;right:0;height:${headingVh}vh;text-align:center;overflow:hidden;">` +
        (kicker
          ? `<div style="height:${HEADING_KICKER_VH}vh;line-height:${HEADING_KICKER_VH}vh;font-size:2.1vh;font-weight:800;` +
            `letter-spacing:0.3em;text-transform:uppercase;color:${p.accent};">${escapeHtml(kicker)}</div>`
          : '') +
        (dayboard.showDateHeading
          ? `<div style="height:${HEADING_DATE_VH}vh;line-height:${HEADING_DATE_VH}vh;font-size:5.2vh;font-weight:900;` +
            `letter-spacing:0.02em;text-transform:uppercase;">${escapeHtml(dayboardDateHeading(now))}</div>`
          : '') +
        `</div>`
      : '';
  const bodyTop = headingVh > 0 ? `${round(headingVh + 1.6)}vh` : '0';

  let bodyHtml: string;
  if (model.empty) {
    bodyHtml =
      `<div style="position:absolute;top:${bodyTop};left:0;right:0;bottom:0;display:flex;align-items:center;justify-content:center;` +
      `font-size:3.4vh;font-weight:700;color:${p.secondary};text-align:center;">Nothing else scheduled today</div>`;
  } else {
    const both = model.primary && model.games;
    const primaryHtml = model.primary
      ? sectionHtml(model.primary, p, both ? 'flex:1.25 1 0;min-width:0;margin-right:3vh;' : 'flex:1 1 0;min-width:0;')
      : '';
    const divider = both ? `<div style="width:0.3vh;flex-shrink:0;background:${escapeHtml(withAlpha(design.accentColor, 0.4, p.border))};margin-right:3vh;"></div>` : '';
    const gamesHtml = model.games ? sectionHtml(model.games, p, 'flex:1 1 0;min-width:0;') : '';
    bodyHtml =
      `<div style="position:absolute;top:${bodyTop};left:0;right:0;bottom:0;display:flex;">` +
      `${primaryHtml}${divider}${gamesHtml}</div>`;
  }

  return {
    html: `<div style="position:relative;height:100%;color:${p.font};">${headingHtml}${bodyHtml}</div>`,
    model,
  };
}
