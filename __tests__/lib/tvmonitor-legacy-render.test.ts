import { describe, it, expect } from 'vitest';
import { renderTvMonitorLegacyHtml } from '@/lib/tvmonitor-legacy-render';
import { normalizeTvMonitorConfig } from '@/lib/tvmonitor-config';
import { buildMansfieldSchedule, MANSFIELD_RESOURCE_IDS } from '@/__tests__/fixtures/tvmonitor-mansfield';
import type { TvMonitorSchedulePayload, TvMonitorWeatherPayload } from '@/types/tvmonitor';

const NOW = new Date('2026-01-15T16:30:00Z');

const SCHEDULE: TvMonitorSchedulePayload = {
  facilityId: 1,
  facilityName: 'Test Facility',
  spaces: [
    {
      id: 1,
      name: 'East Rink',
      slots: [
        {
          slotId: 1,
          parentSlotId: null,
          reservationId: 10,
          reservationName: 'Stick N Puck',
          date: '2026-01-15',
          endDate: '2026-01-15',
          startTime: '16:00:00',
          endTime: '17:00:00',
          notes: 'Locker room: 108A\nBring your own stick',
          spaceId: 1,
          slotType: 'internal',
          isPrivate: false,
        },
      ],
    },
    { id: 2, name: 'West Rink', slots: [] },
  ],
  fetchedAt: NOW.toISOString(),
};

const WEATHER: TvMonitorWeatherPayload = {
  location: 'Elk Grove Village, Illinois, US',
  temperatureF: 42,
  weatherCode: 3,
  condition: 'Overcast',
  icon: '☁️',
  fetchedAt: NOW.toISOString(),
};

function render(
  configOverrides: Record<string, unknown> = {},
  schedule: TvMonitorSchedulePayload | null = SCHEDULE,
  weather: TvMonitorWeatherPayload | null = WEATHER,
) {
  const config = normalizeTvMonitorConfig({ legacyBrowserMode: true, ...configOverrides });
  return renderTvMonitorLegacyHtml({ config, schedule, weather, now: NOW, pageName: 'Test Page <script>' });
}

describe('renderTvMonitorLegacyHtml', () => {
  it('renders a complete static document with no client script tags or emoji weather icon', () => {
    const html = render();
    expect(html).toMatch(/^<!DOCTYPE html><html/);
    expect(html).toContain('<meta http-equiv="refresh" content="60" />');
    expect(html).not.toContain('<script');
    expect(html).not.toContain('☁️');
    expect(html).toContain('Stick N Puck');
    expect(html).toContain('East Rink');
    expect(html).toContain('42°F');
  });

  it('escapes dynamic text so it cannot break out of HTML (e.g. a page name containing a tag)', () => {
    const html = render();
    expect(html).not.toContain('<script>');
    expect(html).toContain('Test Page &lt;script&gt;');
  });

  it('never uses CSS grid, dvh, flex gap, or the inset shorthand', () => {
    const html = render({ schedule: { viewMode: 'columns' } });
    expect(html).not.toMatch(/display:\s*grid/);
    expect(html).not.toMatch(/\ddvh/);
    expect(html).not.toMatch(/gap:/);
    expect(html).not.toMatch(/inset:/);
  });

  it('gives every auto-scrolling region an absolute-positioned wrapper instead of a flex-grow or calc()\'d height — old Blink (Chromium 38) resolves neither reliably as a flex item\'s height, which otherwise clips the schedule to nothing or lets it scroll over the header', () => {
    const html = render({ schedule: { viewMode: 'columns', resourceIds: [1, 2], autoScroll: true } });
    // Every scrolling wrapper (marqueeWrap) must be position:absolute with
    // plain top/left/right/bottom offsets (not a flex-grow or calc() height)
    // around the abs-pos scroll layer.
    expect(html).toMatch(/position:absolute;top:[^;]+;left:0;right:0;bottom:0;overflow:hidden;"><div style="position:absolute;top:0;right:0;bottom:0;left:0;/);
    // Neither of the old buggy patterns — a flex-grow height, or a calc()'d
    // height on a flex item — feeding an abs-pos child may reappear.
    expect(html).not.toMatch(/flex:1 1 0;min-height:0;overflow:hidden;"><div style="position:absolute/);
    expect(html).not.toMatch(/height:calc\([^)]+\);[^"]*"><div style="position:absolute/);
  });

  it('sizes the header-to-ticker layout chain with position:absolute offsets instead of flex-grow or calc() height so it holds for any header/ad/ticker configuration', () => {
    const html = render({
      header: { enabled: true, layout: 'inline', showTitle: true, showClock: true },
      ticker: { enabled: true, label: 'UPDATES', messages: ['Hello world'], scrollSpeed: 3 },
      schedule: { viewMode: 'columns', resourceIds: [1, 2] },
    });
    expect(html).toMatch(/position:absolute;top:0;left:0;right:0;bottom:52px;display:flex;/); // outer row minus ticker
    expect(html).toMatch(/position:absolute;top:\d+px;left:0;right:0;bottom:0;display:flex;/); // mainRow offset from header
    expect(html).not.toMatch(/<div style="display:flex;flex:1 1 0;min-height:0;">/); // mainRow no longer flex-grows
    expect(html).not.toMatch(/<div style="position:relative;display:flex;flex:1 1 0;min-height:0;">/); // outer row no longer flex-grows
    expect(html).not.toMatch(/height:calc\(100% - \d+px\)/); // no calc()'d flex-item height anywhere
  });

  it('renders the feed view chronologically without throwing', () => {
    const html = render({ schedule: { viewMode: 'feed', resourceIds: [1, 2] } });
    expect(html).toContain('Stick N Puck');
  });

  it('renders the grouped view as one labelled column per group, each a feed', () => {
    const html = render({
      schedule: {
        viewMode: 'grouped',
        resourceIds: [1, 2],
        groups: [
          { id: 'east', label: 'East Side', resourceIds: [1] },
          { id: 'west', label: 'West Side', resourceIds: [2] },
        ],
      },
    });
    expect(html).toContain('East Side');
    expect(html).toContain('West Side');
    // Feed cards keep the resource pill, so a merged column stays readable.
    expect(html).toContain('East Rink');
    expect(html).toContain('Stick N Puck');
    // Empty group still renders its column rather than collapsing the layout.
    expect(html).toContain('No events scheduled');
    // Same absolute-positioned column geometry as the columns view — a
    // calc()'d flex height here would collapse the scroll region on the
    // Chromium 38 hardware this whole path exists for.
    expect(html).not.toMatch(/height:calc\(100% - \d+px\)/);
    expect(html).toMatch(/position:absolute;top:\d+px;left:0;right:0;bottom:0;overflow:hidden;/);
  });

  it('renders unassigned resources in an "Other" column instead of dropping them', () => {
    // Give the ungrouped resource an event of its own — a resource with no
    // events produces no feed cards at all, so its name would never appear
    // and the assertion couldn't tell "rendered empty" from "dropped".
    const scheduleWithWestEvent: TvMonitorSchedulePayload = {
      ...SCHEDULE,
      spaces: [
        SCHEDULE.spaces[0],
        {
          ...SCHEDULE.spaces[1],
          slots: [{ ...SCHEDULE.spaces[0].slots[0], slotId: 99, reservationName: 'Open Skate', spaceId: 2 }],
        },
      ],
    };
    const html = render(
      {
        schedule: {
          viewMode: 'grouped',
          resourceIds: [1, 2],
          groups: [{ id: 'east', label: 'East Side', resourceIds: [1] }],
        },
      },
      scheduleWithWestEvent,
    );
    expect(html).toContain('East Side');
    expect(html).toContain('>Other<');
    expect(html).toContain('West Rink');
    expect(html).toContain('Open Skate');
  });

  describe('mergeDuplicateBookings', () => {
    // End-to-end through the real renderer: counts how many times the duplicated
    // reservation actually reaches the HTML. Covers the shared merge layer AND
    // legacy presentation in one pure-string assertion, with no DOM.
    function countTav(viewMode: string, merge: boolean, groups: unknown[] = []) {
      const config = normalizeTvMonitorConfig({
        legacyBrowserMode: true,
        schedule: {
          viewMode,
          resourceIds: MANSFIELD_RESOURCE_IDS,
          mergeDuplicateBookings: merge,
          groups,
          autoScroll: false, // marqueeWrap duplicates content when scrolling
        },
      });
      const html = renderTvMonitorLegacyHtml({
        config,
        schedule: buildMansfieldSchedule(),
        weather: null,
        now: NOW,
        pageName: 'Mansfield',
      });
      return (html.match(/TAV Volleyball/g) ?? []).length;
    }

    it('collapses the feed to a single card', () => {
      expect(countTav('feed', false)).toBe(6);
      expect(countTav('feed', true)).toBe(1);
    });

    it('collapses within each column but keeps the booking in every column it occupies', () => {
      // Court 6 x1 + Court 7 x4 + Court 8 x1 -> one card in each of the 3 columns.
      expect(countTav('columns', false)).toBe(6);
      expect(countTav('columns', true)).toBe(3);
    });

    it('renders one card per group column', () => {
      const groups = [
        { id: 'low', label: 'Courts 1-6', resourceIds: [8009, 8010, 8013, 8014] },
        { id: 'high', label: 'Courts 7-8', resourceIds: [8015, 8016] },
      ];
      expect(countTav('grouped', false, groups)).toBe(6);
      expect(countTav('grouped', true, groups)).toBe(2);
    });

    it('annotates a merged columns card with the other resources it occupies', () => {
      const config = normalizeTvMonitorConfig({
        legacyBrowserMode: true,
        schedule: {
          viewMode: 'columns',
          resourceIds: MANSFIELD_RESOURCE_IDS,
          mergeDuplicateBookings: true,
          autoScroll: false,
        },
      });
      const html = renderTvMonitorLegacyHtml({
        config,
        schedule: buildMansfieldSchedule(),
        weather: null,
        now: NOW,
        pageName: 'Mansfield',
      });
      expect(html).toContain('also on');
      // Still a zero-JS page with no calc()'d flex height.
      expect(html).not.toContain('<script');
      expect(html).not.toMatch(/height:calc\(100% - \d+px\)/);
    });
  });

  it('renders the wayfinding banner only for a resolvable primaryResourceId', () => {
    const html = render({ schedule: { resourceIds: [1, 2], primaryResourceId: 1, wayfindingLabel: 'YOU ARE HERE' } });
    expect(html).toContain('YOU ARE HERE');
  });

  it('renders the ticker as duplicated marquee text, not a live component', () => {
    const html = render({ ticker: { enabled: true, label: 'UPDATES', messages: ['Hello world'], scrollSpeed: 3 } });
    expect(html.match(/Hello world/g)?.length).toBe(2);
    expect(html).toContain('UPDATES');
  });

  it('handles no schedule data and no weather without throwing', () => {
    const html = render({}, null, null);
    expect(html).toContain('Test Page');
  });

  it('handles zero resources without throwing', () => {
    const html = render({ schedule: { resourceIds: [] } }, { ...SCHEDULE, spaces: [] });
    expect(html).toContain('Add resources');
  });

  it('distinguishes a failed Bond fetch from zero configured resources — both would otherwise look like "no data"', () => {
    const config = normalizeTvMonitorConfig({ legacyBrowserMode: true, schedule: { resourceIds: [1, 2] } });

    const configuredButNoData = renderTvMonitorLegacyHtml({
      config,
      schedule: { facilityId: 1, facilityName: 'Test', spaces: [], fetchedAt: NOW.toISOString() },
      scheduleFetchFailed: false,
      weather: null,
      now: NOW,
      pageName: 'Test Page',
    });
    expect(configuredButNoData).toContain('No events returned for the configured resources');
    expect(configuredButNoData).not.toContain('Add resources');

    const fetchFailed = renderTvMonitorLegacyHtml({
      config,
      schedule: null,
      scheduleFetchFailed: true,
      weather: null,
      now: NOW,
      pageName: 'Test Page',
    });
    expect(fetchFailed).toContain('Could not reach the Bond schedule API');
    expect(fetchFailed).not.toContain('Add resources');
  });

  it('uses the configured facility timezone for the clock and the "Now" highlight, not the server clock', () => {
    // 23:30 UTC is 4:30 PM in Denver (MST, UTC-7, no DST in January) — right
    // in the middle of the fixture's 16:00-17:00 slot. A server defaulting
    // to its own (UTC) clock would show 11:30 PM and miss the "Now" state
    // entirely (23:30 is outside 16:00-17:00).
    const now = new Date('2026-01-15T23:30:00Z');
    const config = normalizeTvMonitorConfig({
      legacyBrowserMode: true,
      schedule: { resourceIds: [1], timezone: 'America/Denver' },
    });
    const html = renderTvMonitorLegacyHtml({ config, schedule: SCHEDULE, weather: null, now, pageName: 'Test Page' });
    expect(html).toContain('4:30 PM');
    expect(html).not.toContain('11:30 PM');
    expect(html).toContain('>Now<');
  });
});
