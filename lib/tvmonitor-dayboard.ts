/**
 * Data model for the 'dayboard' schedule view: a still, non-scrolling board
 * of everything left in today, modelled on the printed daily sheets rinks tape
 * up in the lobby ("3:30pm Stick and Puck → Under 18: LR 6 / Over 18: LR 8 /
 * NORTH RINK").
 *
 * Pure functions only — shared by the React view and the zero-JS legacy
 * renderer via lib/tvmonitor-dayboard-render.ts, so both paths agree on what
 * a row is.
 *
 * Pipeline:
 *   1. filter  — show/hide settings (private, maintenance), top-level slots only,
 *                trimmed to today in the facility's wall clock, ended events dropped
 *   2. clean   — strip Bond's session suffix ("Learn To Skate - July - Aug - Fri - 04:00 pm")
 *   3. dedupe  — same cleaned name + same time → one row, spaces unioned
 *                (a booking on both rinks, or Bond's doubled session rows)
 *   4. collapse — repeat sessions of the same event, rink and notes → one row
 *                listing every start time (the "4:45 / 5:30 / 6:15 Learn To Skate" row)
 *   5. split   — names matching a games keyword ("Aviators vs Baja") go to the games section
 *   6. parse   — "LR 2 Aviators\nLR 6 Baja" notes → locker-room chips, matched to teams
 */

import { formatEventTime, groupScheduleSlots, isSlotHappeningNow, slotStartTimestamp } from '@/lib/tvmonitor-schedule-format';
import type { TvMonitorScheduleBlock, TvMonitorSlot, TvMonitorSpace } from '@/types/tvmonitor';

/** One locker-room assignment parsed from a notes line. */
export interface DayboardLockerRoom {
  /** Who it's for ("Aviators", "Under 18"), or null for a bare "LR 5 & 7". */
  label: string | null;
  /** Room number(s) as displayed, e.g. "5" or "5 & 7". */
  rooms: string;
  /** Extra detail after the room when a label comes first — the jersey color in "Slothful LR 2 - Black". */
  detail?: string;
}

export interface DayboardSpaceTag {
  id: number;
  label: string;
  /** Position in the page's resourceIds — drives the tag's styling. */
  index: number;
}

export interface DayboardTeam {
  name: string;
  lockerRooms: DayboardLockerRoom[];
}

export interface DayboardRow {
  key: string;
  kind: 'event' | 'game';
  title: string;
  /** Formatted start times; several when repeat sessions were collapsed into one row. */
  times: string[];
  startTimestamp: number;
  live: boolean;
  spaces: DayboardSpaceTag[];
  /** Locker rooms not attached to a team (every chip, for 'event' rows). */
  lockerRooms: DayboardLockerRoom[];
  /** 'game' rows only: the two sides, each with its own rooms. */
  teams: DayboardTeam[];
  /** Notes text that wasn't parsed into locker rooms (only when showNotes is on). */
  notes: string | null;
}

export interface DayboardSection {
  title: string;
  rows: DayboardRow[];
  /** Rows on screen at once — rows are sized to this so a page never scrolls. */
  slotsPerPage: number;
  pageIndex: number;
  pageCount: number;
}

export interface DayboardModel {
  primary: DayboardSection;
  games: DayboardSection | null;
  /** Largest page count across sections — > 1 means the board flips pages. */
  pageCount: number;
}

// Readability limits for a 1080p lobby TV. Past these a section paginates
// instead of shrinking text further. The minimums stop a quiet day from
// blowing three rows up to billboard size.
export const DAYBOARD_MAX_EVENT_ROWS = 12;
export const DAYBOARD_MIN_EVENT_ROWS = 6;
export const DAYBOARD_MAX_GAME_ROWS = 8;
export const DAYBOARD_MIN_GAME_ROWS = 5;

// -- Name cleaning -----------------------------------------------------------

const DAY_RE = '(?:monday|tuesday|wednesday|thursday|friday|saturday|sunday|mon|tues?|wed|thurs?|thu|fri|sat|sun)';
const TIME_RE = '\\d{1,2}:\\d{2}\\s*[ap]\\.?m\\.?';
const MONTH_RE =
  '(?:jan(?:uary)?|feb(?:ruary)?|mar(?:ch)?|apr(?:il)?|may|june?|july?|aug(?:ust)?|sept?(?:ember)?|oct(?:ober)?|nov(?:ember)?|dec(?:ember)?)\\.?';
const SESSION_SUFFIX = new RegExp(`\\s+-\\s+${DAY_RE}\\s+-\\s+${TIME_RE}$`, 'i');
const MONTH_SEGMENT = new RegExp(`\\s+-\\s+${MONTH_RE}(?:\\s*[-/–]\\s*${MONTH_RE})?$`, 'i');

/**
 * Strips the session suffix Bond appends to program session names:
 * "Learn To Skate - July - Aug - Fri - 04:00 pm" → "Learn To Skate".
 *
 * Month segments are only stripped once a day+time suffix was found, so a
 * genuine name like "Summer Camp - May" is left alone.
 */
export function cleanEventName(name: string): string {
  const original = name.trim();
  if (!SESSION_SUFFIX.test(original)) return original;
  let out = original.replace(SESSION_SUFFIX, '');
  while (MONTH_SEGMENT.test(out)) out = out.replace(MONTH_SEGMENT, '');
  return out.trim() || original;
}

// -- Games -------------------------------------------------------------------

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/** "Aviators vs Baja" → ["Aviators", "Baja"], or null when no keyword splits the name. */
export function splitTeams(title: string, keywords: string[]): [string, string] | null {
  for (const keyword of keywords) {
    const re = new RegExp(`^(.+?)\\s+${escapeRegExp(keyword)}\\.?\\s+(.+)$`, 'i');
    const match = title.match(re);
    if (match && match[1].trim() && match[2].trim()) return [match[1].trim(), match[2].trim()];
  }
  return null;
}

// -- Locker rooms ------------------------------------------------------------

const LR_WORD = '(?:lr|locker\\s*rooms?|lockers?)';
const ROOM_NUM = '#?\\s*\\d+[a-z]?';
const ROOM_LIST = `(${ROOM_NUM}(?:\\s*(?:&|and|,|/|\\+)\\s*${ROOM_NUM})*)`;
// The room can sit anywhere in the line: text before it, after it, or both.
const LR_ANYWHERE = new RegExp(
  `^(.*?)\\s*[-–:]?\\s*\\b${LR_WORD}\\.?\\s*:?\\s*${ROOM_LIST}(?![0-9a-z])\\s*(?:[-–:]\\s*)?(.*)$`,
  'i',
);

function formatRooms(raw: string): string {
  return raw
    .replace(/#/g, '')
    .split(/\s*(?:&|and|,|\/|\+)\s*/i)
    .map((part) => part.trim())
    .filter(Boolean)
    .join(' & ');
}

/**
 * Parses one notes line, or null. Handles the room with text before it, after
 * it, or both:
 *   "LR 2 Aviators" / "LR 1 - Lost Boys"  → label after
 *   "Under 18 LR 5"                        → label before
 *   "Slothful LR 2 - Black"                → label before, detail (jersey color) after
 *   "LR 5 & 7"                             → no label
 */
export function parseLockerRoomLine(line: string): DayboardLockerRoom | null {
  const match = line.trim().match(LR_ANYWHERE);
  if (!match) return null;
  const before = match[1].trim().replace(/[-–:]$/, '').trim();
  const after = match[3].trim();
  const rooms = formatRooms(match[2]);
  if (before && after) return { rooms, label: before, detail: after };
  return { rooms, label: before || after || null };
}

/** Splits notes into parsed locker rooms and whatever lines didn't parse. */
export function parseLockerRoomNotes(notes: string | null): { lockerRooms: DayboardLockerRoom[]; leftover: string | null } {
  if (!notes) return { lockerRooms: [], leftover: null };
  const lockerRooms: DayboardLockerRoom[] = [];
  const leftover: string[] = [];
  notes
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
    .forEach((line) => {
      const parsed = parseLockerRoomLine(line);
      if (parsed) lockerRooms.push(parsed);
      else leftover.push(line);
    });
  return { lockerRooms, leftover: leftover.length > 0 ? leftover.join(' · ') : null };
}

function normalizeForMatch(value: string): string {
  return value.toLowerCase().replace(/[^a-z0-9]/g, '');
}

function firstWord(value: string): string {
  return normalizeForMatch(value.trim().split(/\s+/)[0] ?? '');
}

function labelMatchesTeam(label: string, team: string): boolean {
  const a = normalizeForMatch(label);
  const b = normalizeForMatch(team);
  if (!a || !b) return false;
  if (a.includes(b) || b.includes(a)) return true;
  // "Free Agents" vs "Free Agent Team" — same first word is good enough once
  // it's specific (3+ chars), and it's only ever compared within one game.
  const wordA = firstWord(label);
  return wordA.length >= 3 && wordA === firstWord(team);
}

/** Hands each team the rooms whose label names it; unmatched rooms stay on the game. */
export function assignLockerRoomsToTeams(
  teams: [string, string],
  lockerRooms: DayboardLockerRoom[],
): { teams: DayboardTeam[]; unassigned: DayboardLockerRoom[] } {
  const result: DayboardTeam[] = teams.map((name) => ({ name, lockerRooms: [] }));
  const unassigned: DayboardLockerRoom[] = [];
  lockerRooms.forEach((room) => {
    const owner = room.label ? result.find((team) => labelMatchesTeam(room.label as string, team.name)) : undefined;
    if (owner) owner.lockerRooms.push({ ...room, label: null });
    else unassigned.push(room);
  });
  return { teams: result, unassigned };
}

// -- Space labels --------------------------------------------------------------

/**
 * Tag text for each space. When every space shares a trailing word
 * ("North Rink", "South Rink") it's dropped — the tags read NORTH / SOUTH and
 * stay narrow. A single space keeps its full name.
 */
export function buildSpaceLabels(spaces: TvMonitorSpace[]): Map<number, string> {
  const names = spaces.map((space) => space.name.trim());
  const lastWords = names.map((name) => name.split(/\s+/));
  const shared =
    names.length > 1 &&
    lastWords.every((words) => words.length > 1) &&
    lastWords.every((words) => words[words.length - 1].toLowerCase() === lastWords[0][lastWords[0].length - 1].toLowerCase());
  return new Map(
    spaces.map((space, i) => [space.id, shared ? lastWords[i].slice(0, -1).join(' ') : names[i]]),
  );
}

// -- Rows --------------------------------------------------------------------

function localDateKey(date: Date): string {
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

function slotEndTimestamp(slot: TvMonitorSlot): number {
  const t = new Date(`${slot.endDate || slot.date}T${slot.endTime}`).getTime();
  return Number.isNaN(t) ? Number.POSITIVE_INFINITY : t;
}

interface WorkingRow {
  title: string;
  slot: TvMonitorSlot;
  spaceIds: number[];
  notes: string | null;
  startTimestamps: number[];
  startTimes: string[];
  live: boolean;
}

/**
 * Start times as the board shows them. A run of same-meridiem times only
 * labels the last one: ["4:45 PM", "5:30 PM"] → ["4:45", "5:30 PM"].
 */
export function formatTimeList(times: string[]): string[] {
  const formatted = times.map((time) => formatEventTime(time));
  return formatted.map((label, i) => {
    const next = formatted[i + 1];
    const suffix = label.match(/\s?[AP]M$/i)?.[0];
    if (!next || !suffix) return label;
    return next.endsWith(suffix.trim()) ? label.slice(0, -suffix.length) : label;
  });
}

/**
 * Builds every row left in today, split into the two sections, before
 * pagination.
 *
 * `now` must read the facility's wall clock (see zonedWallClockDate for the
 * server-rendered path); Bond slot times are bare local times.
 */
export function buildDayboardRows(
  spaces: TvMonitorSpace[],
  settings: TvMonitorScheduleBlock,
  now: Date,
): { events: DayboardRow[]; games: DayboardRow[] } {
  const today = localDateKey(now);
  const nowMs = now.getTime();
  const { dayboard } = settings;
  const spaceIndex = new Map(spaces.map((space, i) => [space.id, i]));
  const spaceLabels = buildSpaceLabels(spaces);

  // 1–3: filter, clean, dedupe. Children (ice cuts, locker-room slots) are
  // dropped — the board is one line per event.
  const byKey = new Map<string, WorkingRow>();
  const working: WorkingRow[] = [];
  spaces.forEach((space) => {
    groupScheduleSlots(space.slots, settings).forEach((slot) => {
      const live = isSlotHappeningNow(slot, now);
      if (!live && slot.date !== today) return;
      if (slotEndTimestamp(slot) <= nowMs) return;

      const title = slot.isPrivate
        ? settings.privateEventLabel
        : slot.slotType === 'maintenance'
          ? settings.maintenanceLabel
          : cleanEventName(slot.reservationName);
      const notes = slot.isPrivate ? null : slot.notes;
      const key = [title.toLowerCase(), slot.date, slot.startTime, slot.endTime].join('|');
      const existing = byKey.get(key);
      if (existing) {
        if (!existing.spaceIds.includes(space.id)) existing.spaceIds.push(space.id);
        if (existing.notes == null && notes != null) existing.notes = notes;
        return;
      }
      const row: WorkingRow = {
        title,
        slot,
        spaceIds: [space.id],
        notes,
        startTimestamps: [slotStartTimestamp(slot)],
        startTimes: [slot.startTime],
        live,
      };
      byKey.set(key, row);
      working.push(row);
    });
  });
  working.sort((a, b) => a.startTimestamps[0] - b.startTimestamps[0]);

  const events: DayboardRow[] = [];
  const games: DayboardRow[] = [];
  // 4: repeat sessions collapse into the first one still on the board.
  const sessionRows = new Map<string, WorkingRow>();
  const eventWorking: WorkingRow[] = [];

  working.forEach((row) => {
    const teamNames = dayboard.gamesEnabled ? splitTeams(row.title, dayboard.gamesKeywords) : null;
    if (teamNames) {
      games.push(toRow(row, 'game', teamNames));
      return;
    }
    const sessionKey = [row.title.toLowerCase(), [...row.spaceIds].sort().join(','), row.notes ?? ''].join('|');
    const first = sessionRows.get(sessionKey);
    if (first) {
      first.startTimestamps.push(row.startTimestamps[0]);
      first.startTimes.push(row.startTimes[0]);
      first.live = first.live || row.live;
      return;
    }
    sessionRows.set(sessionKey, row);
    eventWorking.push(row);
  });
  eventWorking.forEach((row) => events.push(toRow(row, 'event', null)));

  return { events, games };

  function toRow(row: WorkingRow, kind: DayboardRow['kind'], teamNames: [string, string] | null): DayboardRow {
    const parsed = dayboard.parseLockerRooms
      ? parseLockerRoomNotes(row.notes)
      : { lockerRooms: [] as DayboardLockerRoom[], leftover: row.notes };
    let lockerRooms = parsed.lockerRooms;
    let teams: DayboardTeam[] = [];
    if (teamNames) {
      const assigned = assignLockerRoomsToTeams(teamNames, lockerRooms);
      teams = assigned.teams;
      lockerRooms = assigned.unassigned;
    } else {
      // "LR 4 Wasatch Wild" on "Wasatch Wild Practice": the label just repeats
      // the event name, so the chip only needs the room.
      const titleKey = normalizeForMatch(row.title);
      lockerRooms = lockerRooms.map((room) =>
        room.label && titleKey.includes(normalizeForMatch(room.label)) ? { ...room, label: null } : room,
      );
    }
    const orderedSpaceIds = [...row.spaceIds].sort((a, b) => (spaceIndex.get(a) ?? 0) - (spaceIndex.get(b) ?? 0));
    return {
      key: `${kind}:${row.slot.slotId}`,
      kind,
      title: row.title,
      times: formatTimeList(row.startTimes),
      startTimestamp: row.startTimestamps[0],
      live: row.live,
      spaces: orderedSpaceIds.map((id) => ({ id, label: spaceLabels.get(id) ?? '', index: spaceIndex.get(id) ?? 0 })),
      lockerRooms,
      teams,
      notes: settings.showNotes ? parsed.leftover : null,
    };
  }
}

// -- Pagination --------------------------------------------------------------

/**
 * Splits rows into evenly-sized pages (16 rows at a max of 12 → 8 + 8, not
 * 12 + 4) and returns the one for `pageTick`. Every TV derives pageTick from
 * the wall clock, so boards showing the same page stay in step.
 */
export function paginateRows(
  rows: DayboardRow[],
  maxPerPage: number,
  minSlots: number,
  pageTick: number,
): { rows: DayboardRow[]; slotsPerPage: number; pageIndex: number; pageCount: number } {
  const pageCount = Math.max(1, Math.ceil(rows.length / maxPerPage));
  const perPage = Math.max(1, Math.ceil(rows.length / pageCount));
  const pageIndex = ((pageTick % pageCount) + pageCount) % pageCount;
  return {
    rows: rows.slice(pageIndex * perPage, (pageIndex + 1) * perPage),
    slotsPerPage: Math.max(perPage, minSlots),
    pageIndex,
    pageCount,
  };
}

/** Which page-flip interval `epochMs` falls in. */
export function dayboardPageTick(epochMs: number, pageSeconds: number): number {
  return Math.floor(epochMs / 1000 / pageSeconds);
}

/** Seconds until the next page flip — the legacy page reloads exactly then. */
export function secondsUntilNextDayboardPage(epochMs: number, pageSeconds: number): number {
  const elapsed = (epochMs / 1000) % pageSeconds;
  return Math.max(1, Math.ceil(pageSeconds - elapsed));
}

export function buildDayboardModel(
  spaces: TvMonitorSpace[],
  settings: TvMonitorScheduleBlock,
  now: Date,
  pageTick: number,
): DayboardModel {
  const { events, games } = buildDayboardRows(spaces, settings, now);
  // Both sections stay on screen all day, even when one has nothing left, so
  // the layout never shifts under people who glance at it every day.
  const primary = {
    title: settings.dayboard.primaryTitle,
    ...paginateRows(events, DAYBOARD_MAX_EVENT_ROWS, DAYBOARD_MIN_EVENT_ROWS, pageTick),
  };
  const gameSection = settings.dayboard.gamesEnabled
    ? { title: settings.dayboard.gamesTitle, ...paginateRows(games, DAYBOARD_MAX_GAME_ROWS, DAYBOARD_MIN_GAME_ROWS, pageTick) }
    : null;
  return {
    primary,
    games: gameSection,
    pageCount: Math.max(primary.pageCount, gameSection?.pageCount ?? 1),
  };
}
