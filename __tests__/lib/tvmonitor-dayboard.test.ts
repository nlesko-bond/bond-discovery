import { describe, it, expect } from 'vitest';
import {
  assignLockerRoomsToTeams,
  buildDayboardModel,
  buildDayboardRows,
  buildSpaceLabels,
  cleanEventName,
  formatTimeList,
  paginateRows,
  parseLockerRoomLine,
  parseLockerRoomNotes,
  secondsUntilNextDayboardPage,
  splitTeams,
  type DayboardRow,
} from '@/lib/tvmonitor-dayboard';
import { readableTextOn, renderDayboardHtml } from '@/lib/tvmonitor-dayboard-render';
import { normalizeTvMonitorConfig } from '@/lib/tvmonitor-config';
import { renderTvMonitorLegacyHtml } from '@/lib/tvmonitor-legacy-render';
import { scheduleFetchHours } from '@/lib/tvmonitor-schedule-format';
import type { TvMonitorSlot, TvMonitorSpace } from '@/types/tvmonitor';

let nextSlotId = 1;
function slot(overrides: Partial<TvMonitorSlot>): TvMonitorSlot {
  const slotId = nextSlotId++;
  return {
    slotId,
    parentSlotId: null,
    reservationId: 1000 + slotId,
    reservationName: 'Event',
    date: '2026-09-24',
    endDate: '2026-09-24',
    startTime: '19:00:00',
    endTime: '20:00:00',
    notes: null,
    spaceId: 7245,
    slotType: 'internal',
    isPrivate: false,
    ...overrides,
  };
}

// Shapes taken from Utah Mammoth Ice Center's real slots-schedule response
// (facility 636, spaces 7245/7246), including Bond's quirks: trailing spaces
// in space names, ice-cut child slots, doubled session rows, and a
// "Session - Month - Month - Day - time" name suffix.
function utahSpaces(): TvMonitorSpace[] {
  return [
    {
      id: 7245,
      name: 'North Rink ',
      slots: [
        slot({ reservationName: 'Morning Freestyle', startTime: '06:00:00', endTime: '07:00:00' }), // already over
        slot({ reservationName: 'Copper Hills High School Practice', startTime: '19:15:00', endTime: '20:15:00', notes: 'LR 5 & 7', slotType: 'external' }),
        slot({ reservationName: 'Ice Cut', startTime: '20:15:00', endTime: '20:30:00', slotType: 'maintenance', parentSlotId: 2 }),
        slot({ reservationName: 'Aviators vs Baja', startTime: '20:30:00', endTime: '21:30:00', notes: 'LR 2 Aviators\nLR 6 Baja' }),
        slot({ reservationName: 'Salties vs Zombonis', startTime: '23:00:00', endTime: '00:00:00', endDate: '2026-09-25', notes: 'LR 3 Salties\nLR 6 Zombonis' }),
        slot({ reservationName: 'Private Event', date: '2026-09-25', endDate: '2026-09-25', startTime: '06:00:00', endTime: '15:30:00' }), // tomorrow
      ],
    },
    {
      id: 7246,
      name: 'South Rink ',
      slots: [
        slot({ spaceId: 7246, reservationName: '12U Rookie League Practice', startTime: '18:15:00', endTime: '19:15:00', notes: 'LR 6 & 8' }),
        slot({ spaceId: 7246, reservationName: 'Stick & Puck', startTime: '19:30:00', endTime: '20:30:00', notes: 'Under 18 LR 5\nOver 18 LR 6' }),
        slot({ spaceId: 7246, reservationName: 'Learn To Skate - July - Aug - Thu - 08:00 pm', startTime: '20:00:00', endTime: '20:45:00' }),
        slot({ spaceId: 7246, reservationName: 'Learn To Skate - July - Aug - Thu - 08:45 pm', startTime: '20:45:00', endTime: '21:30:00' }),
        slot({ spaceId: 7246, reservationName: 'Season Ticket Holder Skate - Thu - 09:30 pm', startTime: '21:30:00', endTime: '22:00:00' }),
        slot({ spaceId: 7246, reservationName: 'Season Ticket Holder Skate', startTime: '21:30:00', endTime: '22:00:00' }),
        slot({ spaceId: 7246, reservationName: 'Lost boys vs Golden Eagles', startTime: '22:00:00', endTime: '23:00:00', notes: 'LR 1 - Lost Boys\nRinkside Room - Golden Eagles' }),
      ],
    },
  ];
}

function settings(overrides: Record<string, unknown> = {}) {
  return normalizeTvMonitorConfig({
    schedule: {
      viewMode: 'dayboard',
      resourceIds: [7245, 7246],
      showPrivateEvents: false,
      showMaintenance: true,
      ...overrides,
      dayboard: { gamesTitle: 'Adult League', ...((overrides.dayboard as object) ?? {}) },
    },
  }).schedule;
}

// Naive local time, the same way slot times are parsed.
const NOW = new Date('2026-09-24T19:05:00');

describe('cleanEventName', () => {
  it("strips Bond's session suffix, including month segments", () => {
    expect(cleanEventName('Learn To Skate - July - Aug - Fri - 04:00 pm')).toBe('Learn To Skate');
    expect(cleanEventName('Season Ticket Holder Skate - Fri - 03:45 pm')).toBe('Season Ticket Holder Skate');
  });

  it('leaves ordinary names alone', () => {
    expect(cleanEventName('5 & Under - Public Skate')).toBe('5 & Under - Public Skate');
    expect(cleanEventName('Summer Camp - May')).toBe('Summer Camp - May');
    expect(cleanEventName('Hockey - Marines')).toBe('Hockey - Marines');
  });
});

describe('splitTeams', () => {
  it('splits on a whole-word keyword, case-insensitively, with an optional period', () => {
    expect(splitTeams('Aviators vs Baja', ['vs'])).toEqual(['Aviators', 'Baja']);
    expect(splitTeams('Night Owls VS. Blue Devils', ['vs'])).toEqual(['Night Owls', 'Blue Devils']);
    expect(splitTeams('Wildcats @ Bears', ['vs', '@'])).toEqual(['Wildcats', 'Bears']);
  });

  it('does not match inside a word', () => {
    expect(splitTeams('Canvas Painting', ['vs'])).toBeNull();
    expect(splitTeams('Girls Game # 1 Rookie League', ['vs'])).toBeNull();
  });
});

describe('locker room parsing', () => {
  it.each([
    ['LR 2 Aviators', { rooms: '2', label: 'Aviators' }],
    ['LR 1 - Lost Boys', { rooms: '1', label: 'Lost Boys' }],
    ['LR 5 & 7', { rooms: '5 & 7', label: null }],
    ['LR 4 and 9', { rooms: '4 & 9', label: null }],
    ['Under 18 LR 5', { rooms: '5', label: 'Under 18' }],
    ['Locker rooms 5 & 7', { rooms: '5 & 7', label: null }],
    ['Locker room: 108A', { rooms: '108A', label: null }],
  ])('parses %s', (line, expected) => {
    expect(parseLockerRoomLine(line)).toEqual(expected);
  });

  it('keeps lines it cannot parse as leftover notes', () => {
    expect(parseLockerRoomNotes('LR 1 - Lost Boys\nRinkside Room - Golden Eagles')).toEqual({
      lockerRooms: [{ rooms: '1', label: 'Lost Boys' }],
      leftover: 'Rinkside Room - Golden Eagles',
    });
    expect(parseLockerRoomLine('Bring your own stick')).toBeNull();
  });

  it('hands rooms to the team they name, tolerating case and near-miss names', () => {
    const { teams, unassigned } = assignLockerRoomsToTeams(
      ['Free Agent Team', 'SLC Holy Spirits'],
      [
        { rooms: '5', label: 'Free Agents' },
        { rooms: '7', label: 'slc holy spirits' },
        { rooms: '9', label: 'Referees' },
      ],
    );
    expect(teams).toEqual([
      { name: 'Free Agent Team', lockerRooms: [{ rooms: '5', label: null }] },
      { name: 'SLC Holy Spirits', lockerRooms: [{ rooms: '7', label: null }] },
    ]);
    expect(unassigned).toEqual([{ rooms: '9', label: 'Referees' }]);
  });
});

describe('buildSpaceLabels', () => {
  it('drops a shared trailing word so tags stay short', () => {
    const labels = buildSpaceLabels(utahSpaces());
    expect(labels.get(7245)).toBe('North');
    expect(labels.get(7246)).toBe('South');
  });

  it('keeps full names when they do not share one', () => {
    const labels = buildSpaceLabels([
      { id: 1, name: 'Court 1', slots: [] },
      { id: 2, name: 'Pool', slots: [] },
    ]);
    expect([labels.get(1), labels.get(2)]).toEqual(['Court 1', 'Pool']);
  });
});

describe('formatTimeList', () => {
  it('only labels the last of a same-meridiem run', () => {
    expect(formatTimeList(['16:45:00', '17:30:00', '18:15:00']).map((t) => t.replace(/\s/g, ' '))).toEqual([
      '4:45',
      '5:30',
      '6:15 PM',
    ]);
    expect(formatTimeList(['11:30:00', '12:15:00']).map((t) => t.replace(/\s/g, ' '))).toEqual(['11:30 AM', '12:15 PM']);
  });
});

describe('buildDayboardRows', () => {
  const { events, games } = buildDayboardRows(utahSpaces(), settings(), NOW);

  it('keeps only what is left of today, including the event on now', () => {
    const titles = [...events, ...games].map((row) => row.title);
    expect(titles).not.toContain('Morning Freestyle');
    expect(titles).not.toContain('Private Event');
    expect(events[0]).toMatchObject({ title: '12U Rookie League Practice', live: true });
  });

  it('drops child slots like ice cuts', () => {
    expect(events.map((row) => row.title)).not.toContain('Ice Cut');
  });

  it('splits "vs" events into the games section with rooms by team', () => {
    expect(games.map((row) => row.title)).toEqual([
      'Aviators vs Baja',
      'Lost boys vs Golden Eagles',
      'Salties vs Zombonis',
    ]);
    expect(games[0].teams).toEqual([
      { name: 'Aviators', lockerRooms: [{ rooms: '2', label: null }] },
      { name: 'Baja', lockerRooms: [{ rooms: '6', label: null }] },
    ]);
    expect(games[1].teams[0].lockerRooms).toEqual([{ rooms: '1', label: null }]);
    expect(games[1].notes).toBe('Rinkside Room - Golden Eagles');
    expect(games[0].spaces).toEqual([{ id: 7245, label: 'North', index: 0 }]);
  });

  it('keeps a game that runs past midnight', () => {
    expect(games.map((row) => row.title)).toContain('Salties vs Zombonis');
  });

  it('collapses repeat sessions into one row listing each time', () => {
    const lts = events.filter((row) => row.title === 'Learn To Skate');
    expect(lts).toHaveLength(1);
    expect(lts[0].times.map((t) => t.replace(/\s/g, ' '))).toEqual(['8:00', '8:45 PM']);
  });

  it("merges Bond's doubled rows for the same session", () => {
    expect(events.filter((row) => row.title === 'Season Ticket Holder Skate')).toHaveLength(1);
  });

  it('labels locker-room chips, dropping a label that repeats the event name', () => {
    expect(events.find((row) => row.title === 'Stick & Puck')?.lockerRooms).toEqual([
      { rooms: '5', label: 'Under 18' },
      { rooms: '6', label: 'Over 18' },
    ]);
    expect(events.find((row) => row.title === 'Copper Hills High School Practice')?.lockerRooms).toEqual([
      { rooms: '5 & 7', label: null },
    ]);
  });

  it('merges the same booking on two rinks into one row with both tags', () => {
    const spaces = utahSpaces();
    spaces[1].slots.push(slot({ spaceId: 7246, reservationName: 'Public Skate', startTime: '21:00:00', endTime: '22:00:00' }));
    spaces[0].slots.push(slot({ reservationName: 'Public Skate', startTime: '21:00:00', endTime: '22:00:00' }));
    const row = buildDayboardRows(spaces, settings(), NOW).events.find((r) => r.title === 'Public Skate');
    expect(row?.spaces.map((tag) => tag.label)).toEqual(['North', 'South']);
  });

  it('keeps everything in one section when games are turned off', () => {
    const split = buildDayboardRows(utahSpaces(), settings({ dayboard: { gamesEnabled: false } }), NOW);
    expect(split.games).toHaveLength(0);
    expect(split.events.map((row) => row.title)).toContain('Aviators vs Baja');
  });

  it('shows raw notes when locker-room parsing is off', () => {
    const rows = buildDayboardRows(utahSpaces(), settings({ dayboard: { parseLockerRooms: false } }), NOW).events;
    const stick = rows.find((row) => row.title === 'Stick & Puck');
    expect(stick?.lockerRooms).toEqual([]);
    expect(stick?.notes).toBe('Under 18 LR 5\nOver 18 LR 6');
  });
});

describe('pagination', () => {
  const rows = Array.from({ length: 16 }, (_, i) => ({ key: String(i) }) as DayboardRow);

  it('splits into even pages rather than a full page and a stub', () => {
    const first = paginateRows(rows, 12, 6, 0);
    expect(first).toMatchObject({ pageCount: 2, pageIndex: 0, slotsPerPage: 8 });
    expect(first.rows.map((r) => r.key)).toEqual(['0', '1', '2', '3', '4', '5', '6', '7']);
    expect(paginateRows(rows, 12, 6, 1).rows[0].key).toBe('8');
    expect(paginateRows(rows, 12, 6, 2).pageIndex).toBe(0);
  });

  it('never sizes rows larger than the minimum slot count allows', () => {
    expect(paginateRows(rows.slice(0, 3), 12, 6, 0)).toMatchObject({ pageCount: 1, slotsPerPage: 6 });
  });

  it('reloads the legacy page exactly on the next flip', () => {
    expect(secondsUntilNextDayboardPage(Date.UTC(2026, 0, 1, 0, 0, 10), 15)).toBe(5);
    expect(secondsUntilNextDayboardPage(Date.UTC(2026, 0, 1, 0, 0, 15), 15)).toBe(15);
  });

  it('flips pages on a busy day', () => {
    const busy: TvMonitorSpace[] = [
      {
        id: 7245,
        name: 'North Rink',
        slots: Array.from({ length: 20 }, (_, i) =>
          slot({ reservationName: `Practice ${i}`, startTime: `${String(19 + Math.floor(i / 6)).padStart(2, '0')}:${String((i % 6) * 10).padStart(2, '0')}:00`, endTime: '23:59:00' }),
        ),
      },
    ];
    const model = buildDayboardModel(busy, settings(), NOW, 0);
    expect(model.pageCount).toBe(2);
    expect(model.primary?.rows).toHaveLength(10);
    expect(model.games?.rows).toHaveLength(0);
  });
});

describe('renderDayboardHtml', () => {
  const design = normalizeTvMonitorConfig({}).design;

  it('escapes Bond text and sticks to CSS the legacy hardware supports', () => {
    const spaces = utahSpaces();
    spaces[0].slots.push(slot({ reservationName: '<img src=x onerror=alert(1)> vs Baja', startTime: '21:00:00', endTime: '22:00:00' }));
    const { html } = renderDayboardHtml({ spaces, settings: settings(), design, now: NOW, epochMs: NOW.getTime() });
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;img');
    expect(html).not.toMatch(/display:\s*grid|[^-]gap:|inset:|calc\(|min\(|max\(/);
    expect(html).toContain('Adult League');
    expect(html).toContain('Thursday · Sep 24');
  });

  it('cannot be broken out of through a design color', () => {
    const hostile = normalizeTvMonitorConfig({
      design: { accentColor: 'red"><img src=x onerror=alert(1)>', fontColor: '#fff"><script>alert(1)</script>' },
    }).design;
    const { html } = renderDayboardHtml({ spaces: utahSpaces(), settings: settings(), design: hostile, now: NOW, epochMs: NOW.getTime() });
    expect(html).not.toContain('<img');
    expect(html).not.toContain('<script');
  });

  it('puts the heading logo on both sides, escaped', () => {
    const withLogo = settings({ dayboard: { headingLogoUrl: 'https://example.com/logo.png" onerror="x' } });
    const { html } = renderDayboardHtml({ spaces: utahSpaces(), settings: withLogo, design, now: NOW, epochMs: NOW.getTime() });
    expect(html.match(/<img /g)).toHaveLength(2);
    expect(html).toContain('logo.png&quot; onerror=&quot;x');
  });

  it('uses a separate right logo when one is set', () => {
    const both = settings({ dayboard: { headingLogoUrl: 'https://example.com/left.png', headingLogoRightUrl: 'https://example.com/right.png' } });
    const { html } = renderDayboardHtml({ spaces: utahSpaces(), settings: both, design, now: NOW, epochMs: NOW.getTime() });
    expect(html).toContain('left.png');
    expect(html).toContain('right.png');
    expect(html.match(/<img /g)).toHaveLength(2);
  });

  it('sizes in container units for the React view', () => {
    const { html } = renderDayboardHtml({ spaces: utahSpaces(), settings: settings(), design, now: NOW, epochMs: NOW.getTime(), unit: 'cqh' });
    expect(html).toContain('cqh');
    expect(html).not.toMatch(/\dvh/);
  });

  it('keeps the main section on screen once only games are left', () => {
    const evening = new Date('2026-09-24T22:05:00');
    const { html, model } = renderDayboardHtml({ spaces: utahSpaces(), settings: settings(), design, now: evening, epochMs: evening.getTime() });
    expect(model.primary.rows).toHaveLength(0);
    expect(model.games?.rows.length).toBeGreaterThan(0);
    expect(html).toContain('No events scheduled');
  });

  it('shows an empty state once the day is over', () => {
    const late = new Date('2026-09-24T23:59:30');
    const { html, model } = renderDayboardHtml({
      spaces: [{ id: 1, name: 'North Rink', slots: [] }],
      settings: settings(),
      design,
      now: late,
      epochMs: late.getTime(),
    });
    expect(model.primary.rows).toHaveLength(0);
    expect(model.games?.rows).toHaveLength(0);
    // Both sections stay up, each saying it's empty.
    expect(html).toContain('Adult League');
    expect(html.match(/No events scheduled/g)).toHaveLength(2);
  });

  it('picks readable text for filled tags in light and dark themes', () => {
    expect(readableTextOn('#7ab2e0')).toBe('#0b1220');
    expect(readableTextOn('#0d4774')).toBe('#ffffff');
    expect(readableTextOn('rgba(0,0,0,0.5)')).toBe('#ffffff');
  });
});

describe('dayboard config + legacy wiring', () => {
  it('round-trips through normalization with defaults filled in', () => {
    const schedule = normalizeTvMonitorConfig({ schedule: { viewMode: 'dayboard', dayboard: { heading: '', pageSeconds: 2 } } }).schedule;
    expect(schedule.viewMode).toBe('dayboard');
    expect(schedule.dayboard).toMatchObject({ heading: '', pageSeconds: 5, gamesKeywords: ['vs'], parseLockerRooms: true });
  });

  it('always fetches the full day', () => {
    expect(scheduleFetchHours(settings({ futureHoursLimit: 3 }))).toBe(24);
    expect(scheduleFetchHours({ viewMode: 'feed', futureHoursLimit: 3 })).toBe(3);
  });

  it('renders inside the legacy page and reloads on the page flip when paginated', () => {
    const config = normalizeTvMonitorConfig({
      legacyBrowserMode: true,
      schedule: { viewMode: 'dayboard', resourceIds: [7245], timezone: 'UTC', dayboard: { pageSeconds: 15 } },
    });
    const busy: TvMonitorSpace[] = [
      {
        id: 7245,
        name: 'North Rink',
        slots: Array.from({ length: 20 }, (_, i) => slot({ reservationName: `Practice ${i}`, endTime: '23:59:00' })),
      },
    ];
    const now = new Date(Date.UTC(2026, 8, 24, 19, 5, 10));
    const html = renderTvMonitorLegacyHtml({
      config,
      schedule: { facilityId: 636, facilityName: 'Utah', spaces: busy, fetchedAt: now.toISOString() },
      weather: null,
      now,
      pageName: 'Utah',
    });
    expect(html).toContain('<meta http-equiv="refresh" content="5" />');
    expect(html).toContain('PAGE 1 OF 2');
    expect(html).not.toContain('<script');
  });
});
