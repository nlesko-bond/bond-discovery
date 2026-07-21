import { describe, it, expect } from 'vitest';
import {
  isReservedTvMonitorSlug,
  normalizeTvMonitorConfig,
  normalizeTvMonitorSlug,
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
        resourceIds: [1, 2, 3, 4, 5, 6, 7, 8],
        futureHoursLimit: 99,
        scrollSpeed: 42,
        scrollPauseSeconds: -5,
      },
    });
    expect(config.refreshSeconds).toBe(30);
    expect(config.schedule.resourceIds).toEqual([1, 2, 3, 4, 5, 6]);
    expect(config.schedule.futureHoursLimit).toBe(24);
    expect(config.schedule.scrollSpeed).toBe(5);
    expect(config.schedule.scrollPauseSeconds).toBe(0);
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

  it('clears sponsorAdId when it points at a missing ad slot', () => {
    const kept = normalizeTvMonitorConfig({
      header: { sponsorAdId: 'ad-1' },
      ads: [{ id: 'ad-1', placement: 'header', assets: [] }],
    });
    expect(kept.header.sponsorAdId).toBe('ad-1');

    const dropped = normalizeTvMonitorConfig({ header: { sponsorAdId: 'ghost' }, ads: [] });
    expect(dropped.header.sponsorAdId).toBeNull();
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
