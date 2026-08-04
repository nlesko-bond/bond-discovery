import { describe, it, expect } from 'vitest';
import {
  isReservedTvMonitorSlug,
  MAX_TV_RESOURCES_COLUMNS,
  MAX_TV_RESOURCES_FEED,
  normalizeTvMonitorConfig,
  normalizeTvMonitorSlug,
  resourceIdCapFor,
} from '@/lib/tvmonitor-config';
import { buildTvMonitorTemplateConfig, TV_DESIGN_PRESETS, TV_MONITOR_TEMPLATES } from '@/lib/tvmonitor-templates';

describe('normalizeTvMonitorConfig', () => {
  it('produces a complete config from an empty blob', () => {
    const config = normalizeTvMonitorConfig({});
    expect(config.template).toBe('custom');
    expect(config.screenRatio).toBe('fill');
    expect(config.design.theme).toBe('dark');
    expect(config.design.fontFamily).toBe('Plus Jakarta Sans');
    expect(config.header.enabled).toBe(true);
    expect(config.schedule.enabled).toBe(true);
    expect(config.schedule.resourceIds).toEqual([]);
    expect(config.schedule.viewMode).toBe('columns');
    expect(config.schedule.scrollMode).toBe('synchronized');
    expect(config.ads).toEqual([]);
    expect(config.refreshSeconds).toBe(60);
  });

  it('handles null/garbage input', () => {
    expect(normalizeTvMonitorConfig(null).template).toBe('custom');
    expect(normalizeTvMonitorConfig('junk').template).toBe('custom');
    expect(normalizeTvMonitorConfig(42).schedule.futureHoursLimit).toBe(9);
  });

  it('clamps out-of-range values', () => {
    const config = normalizeTvMonitorConfig({
      refreshSeconds: 1,
      schedule: {
        resourceIds: Array.from({ length: 20 }, (_, i) => i + 1),
        futureHoursLimit: 99,
        scrollSpeed: 42,
        scrollPauseSeconds: -5,
      },
    });
    expect(config.refreshSeconds).toBe(30);
    expect(config.schedule.resourceIds).toEqual(Array.from({ length: 12 }, (_, i) => i + 1));
    expect(config.schedule.futureHoursLimit).toBe(24);
    expect(config.schedule.scrollSpeed).toBe(5);
    expect(config.schedule.scrollPauseSeconds).toBe(0);
  });

  it('defaults viewMode to columns and accepts feed', () => {
    expect(normalizeTvMonitorConfig({ schedule: {} }).schedule.viewMode).toBe('columns');
    expect(normalizeTvMonitorConfig({ schedule: { viewMode: 'feed' } }).schedule.viewMode).toBe('feed');
    expect(normalizeTvMonitorConfig({ schedule: { viewMode: 'bogus' } }).schedule.viewMode).toBe('columns');
  });

  it('resourceIdCapFor returns the per-mode cap', () => {
    expect(resourceIdCapFor('columns')).toBe(MAX_TV_RESOURCES_COLUMNS);
    expect(resourceIdCapFor('feed')).toBe(MAX_TV_RESOURCES_FEED);
    expect(MAX_TV_RESOURCES_FEED).toBeGreaterThan(MAX_TV_RESOURCES_COLUMNS);
  });

  it('regression: feed view keeps far more than the 12-column cap (a real 36-ID page was silently truncated to 12 by a shared cap)', () => {
    const ids = Array.from({ length: 36 }, (_, i) => 7581 + i);
    const feedConfig = normalizeTvMonitorConfig({ schedule: { viewMode: 'feed', resourceIds: ids } });
    expect(feedConfig.schedule.resourceIds).toEqual(ids);

    // Columns mode still enforces its own, smaller display-driven cap.
    const columnsConfig = normalizeTvMonitorConfig({ schedule: { viewMode: 'columns', resourceIds: ids } });
    expect(columnsConfig.schedule.resourceIds).toHaveLength(MAX_TV_RESOURCES_COLUMNS);
  });

  it('feed view still clamps at its own (much higher) cap', () => {
    const tooMany = Array.from({ length: 100 }, (_, i) => i + 1);
    const config = normalizeTvMonitorConfig({ schedule: { viewMode: 'feed', resourceIds: tooMany } });
    expect(config.schedule.resourceIds).toHaveLength(MAX_TV_RESOURCES_FEED);
  });

  it('drops ad assets without a src and defaults bad placements', () => {
    const config = normalizeTvMonitorConfig({
      ads: [
        {
          id: 'a1',
          placement: 'sideways',
          assets: [{ src: '' }, { src: 'https://cdn.example.com/poster.png', type: 'video' }],
        },
      ],
    });
    expect(config.ads).toHaveLength(1);
    expect(config.ads[0].placement).toBe('bottom');
    expect(config.ads[0].assets).toHaveLength(1);
    expect(config.ads[0].assets[0].type).toBe('video');
  });

  it('only side rails can be full height', () => {
    const config = normalizeTvMonitorConfig({
      ads: [
        { id: 'rail', placement: 'left', fullHeight: true, assets: [] },
        { id: 'banner', placement: 'bottom', fullHeight: true, assets: [] },
      ],
    });
    expect(config.ads.find((s) => s.id === 'rail')?.fullHeight).toBe(true);
    expect(config.ads.find((s) => s.id === 'banner')?.fullHeight).toBe(false);
  });

  it('clears sponsorAdId when it points at a missing ad slot', () => {
    const kept = normalizeTvMonitorConfig({
      header: { sponsorAdId: 'ad-1' },
      ads: [{ id: 'ad-1', placement: 'header', assets: [] }],
    });
    expect(kept.header.sponsorAdId).toBe('ad-1');

    const dropped = normalizeTvMonitorConfig({ header: { sponsorAdId: 'ghost' }, ads: [] });
    expect(dropped.header.sponsorAdId).toBeNull();
  });

  it('defaults titleSizePx and logoPosition, and clamps/validates them', () => {
    expect(normalizeTvMonitorConfig({}).header.titleSizePx).toBe(40);
    expect(normalizeTvMonitorConfig({}).header.logoPosition).toBe('left');
    expect(normalizeTvMonitorConfig({ header: { titleSizePx: 500 } }).header.titleSizePx).toBe(96);
    expect(normalizeTvMonitorConfig({ header: { titleSizePx: 2 } }).header.titleSizePx).toBe(16);
    expect(normalizeTvMonitorConfig({ header: { logoPosition: 'right' } }).header.logoPosition).toBe('right');
    expect(normalizeTvMonitorConfig({ header: { logoPosition: 'bogus' } }).header.logoPosition).toBe('left');
  });

  it('defaults weather to disabled with no location', () => {
    const config = normalizeTvMonitorConfig({});
    expect(config.header.weather).toEqual({ enabled: false, location: null });
  });

  it('normalizes weather settings', () => {
    const config = normalizeTvMonitorConfig({ header: { weather: { enabled: true, location: '  60007  ' } } });
    expect(config.header.weather).toEqual({ enabled: true, location: '  60007  ' });
  });

  it('clears primaryResourceId when it is not one of the schedule resourceIds', () => {
    const kept = normalizeTvMonitorConfig({ schedule: { resourceIds: [1, 2, 3], primaryResourceId: 2 } });
    expect(kept.schedule.primaryResourceId).toBe(2);

    const dropped = normalizeTvMonitorConfig({ schedule: { resourceIds: [1, 2, 3], primaryResourceId: 99 } });
    expect(dropped.schedule.primaryResourceId).toBeNull();

    const noResources = normalizeTvMonitorConfig({ schedule: { resourceIds: [], primaryResourceId: 1 } });
    expect(noResources.schedule.primaryResourceId).toBeNull();
  });

  it('defaults wayfindingLabel and cardStyle, and validates cardStyle', () => {
    expect(normalizeTvMonitorConfig({}).schedule.wayfindingLabel).toBe('YOU ARE HERE');
    expect(normalizeTvMonitorConfig({}).schedule.cardStyle).toBe('cards');
    expect(normalizeTvMonitorConfig({ schedule: { cardStyle: 'plain' } }).schedule.cardStyle).toBe('plain');
    expect(normalizeTvMonitorConfig({ schedule: { cardStyle: 'bogus' } }).schedule.cardStyle).toBe('cards');
  });

  it('normalizes the ticker block, capping messages at 20 and dropping blanks', () => {
    const empty = normalizeTvMonitorConfig({});
    expect(empty.ticker).toEqual({ enabled: false, label: 'UPDATES', messages: [], scrollSpeed: 3 });

    const withMessages = normalizeTvMonitorConfig({
      ticker: { enabled: true, label: 'NEWS', messages: ['Open skate 6pm', '', '  ', 'Pro shop sale'], scrollSpeed: 9 },
    });
    expect(withMessages.ticker.enabled).toBe(true);
    expect(withMessages.ticker.label).toBe('NEWS');
    expect(withMessages.ticker.messages).toEqual(['Open skate 6pm', 'Pro shop sale']);
    expect(withMessages.ticker.scrollSpeed).toBe(5);

    const tooMany = normalizeTvMonitorConfig({ ticker: { messages: Array.from({ length: 30 }, (_, i) => `msg ${i}`) } });
    expect(tooMany.ticker.messages).toHaveLength(20);
  });

  it('respects light theme presets for missing colors', () => {
    const config = normalizeTvMonitorConfig({ design: { theme: 'light' } });
    expect(config.design.bgColor1).toBe(TV_DESIGN_PRESETS.light.bgColor1);
    expect(config.design.fontColor).toBe(TV_DESIGN_PRESETS.light.fontColor);
  });

  it('round-trips every template config unchanged in shape', () => {
    for (const template of TV_MONITOR_TEMPLATES) {
      const built = buildTvMonitorTemplateConfig(template.key);
      const normalized = normalizeTvMonitorConfig(JSON.parse(JSON.stringify(built)));
      expect(normalized).toEqual(built);
    }
  });
});

describe('template presets', () => {
  it('sponsor-spotlight wires the header sponsor slot to a real ad', () => {
    const config = buildTvMonitorTemplateConfig('sponsor-spotlight');
    expect(config.header.sponsorAdId).toBe('ad-header-sponsor');
    expect(config.ads.some((slot) => slot.id === 'ad-header-sponsor' && slot.placement === 'header')).toBe(true);
    expect(config.ads.some((slot) => slot.placement === 'left' && slot.sizeMode === 'ratio')).toBe(true);
  });

  it('promo-banner is light-themed with a bottom pixel banner', () => {
    const config = buildTvMonitorTemplateConfig('promo-banner');
    expect(config.design.theme).toBe('light');
    expect(config.ads).toHaveLength(1);
    expect(config.ads[0].placement).toBe('bottom');
    expect(config.ads[0].sizeMode).toBe('pixels');
  });

  it('rink-classic has no ads', () => {
    expect(buildTvMonitorTemplateConfig('rink-classic').ads).toEqual([]);
  });
});

describe('slug helpers', () => {
  it('normalizes slugs', () => {
    expect(normalizeTvMonitorSlug('Hatfield Ice — Lobby TV!')).toBe('hatfield-ice-lobby-tv');
    expect(normalizeTvMonitorSlug('--already-clean--')).toBe('already-clean');
  });

  it('reserves the studio route', () => {
    expect(isReservedTvMonitorSlug('studio')).toBe(true);
    expect(isReservedTvMonitorSlug('hatfield')).toBe(false);
  });
});
