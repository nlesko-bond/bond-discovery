import { describe, it, expect } from 'vitest';
import { renderTvMonitorLegacyHtml } from '@/lib/tvmonitor-legacy-render';
import { normalizeTvMonitorConfig } from '@/lib/tvmonitor-config';
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

  it('gives every auto-scrolling region an explicit height instead of flex-grow — old Blink (Chromium 38) never resolves a definite height for a `position:absolute;top/right/bottom/left:0` child of a flex-grow-sized ancestor, which otherwise clips the schedule to nothing or lets it scroll over the header', () => {
    const html = render({ schedule: { viewMode: 'columns', resourceIds: [1, 2], autoScroll: true } });
    // Every scrolling wrapper (marqueeWrap) must set an explicit height (not
    // flex-grow) on the element that contains the abs-pos scroll layer.
    expect(html).toMatch(/height:[^"]+;min-height:0;overflow:hidden;"><div style="position:absolute;top:0;right:0;bottom:0;left:0;/);
    // The old buggy pattern — a flex-grow ancestor feeding an abs-pos child —
    // must not reappear anywhere in the vertical layout chain.
    expect(html).not.toMatch(/flex:1 1 0;min-height:0;overflow:hidden;"><div style="position:absolute/);
  });

  it('sizes the header-to-ticker layout chain with calc() instead of flex-grow so it holds for any header/ad/ticker configuration', () => {
    const html = render({
      header: { enabled: true, layout: 'inline', showTitle: true, showClock: true },
      ticker: { enabled: true, label: 'UPDATES', messages: ['Hello world'], scrollSpeed: 3 },
      schedule: { viewMode: 'columns', resourceIds: [1, 2] },
    });
    expect(html).toMatch(/height:calc\(100% - \d+px\);flex-shrink:0;min-height:0;/); // outer row minus ticker
    expect(html).not.toMatch(/<div style="display:flex;flex:1 1 0;min-height:0;">/); // mainRow no longer flex-grows
    expect(html).not.toMatch(/<div style="position:relative;display:flex;flex:1 1 0;min-height:0;">/); // outer row no longer flex-grows
  });

  it('renders the feed view chronologically without throwing', () => {
    const html = render({ schedule: { viewMode: 'feed', resourceIds: [1, 2] } });
    expect(html).toContain('Stick N Puck');
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
