/**
 * Pre-built TV Monitor templates + the blank DIY starting point.
 *
 * A template is just a fully-populated TvMonitorConfig; after creation the
 * page is edited freely, so templates are starting points, not constraints.
 */

import type { TvMonitorConfig, TvMonitorDesign, TvMonitorTemplateKey } from '@/types/tvmonitor';

export const TV_DESIGN_PRESETS: Record<'dark' | 'light', TvMonitorDesign> = {
  dark: {
    theme: 'dark',
    fontFamily: 'Plus Jakarta Sans',
    fontColor: '#ffffff',
    secondaryFontColor: '#9fb3c8',
    accentColor: '#d4a853',
    bgColor1: '#092d4a',
    bgColor2: '#0a1626',
    cardBg: 'rgba(255, 255, 255, 0.06)',
    cardBorder: 'rgba(255, 255, 255, 0.12)',
  },
  light: {
    theme: 'light',
    fontFamily: 'Plus Jakarta Sans',
    fontColor: '#0b1220',
    secondaryFontColor: '#4b5563',
    accentColor: '#0d4774',
    bgColor1: '#f7f7f5',
    bgColor2: '#eef2f6',
    cardBg: '#ffffff',
    cardBorder: 'rgba(0, 0, 0, 0.08)',
  },
};

export interface TvMonitorTemplateMeta {
  key: TvMonitorTemplateKey;
  name: string;
  description: string;
  hasAds: boolean;
}

export const TV_MONITOR_TEMPLATES: TvMonitorTemplateMeta[] = [
  {
    key: 'rink-classic',
    name: 'Classic Board',
    description:
      'Clean, full-width schedule board. Header with your logo, live clock, and a scan-for-schedule QR code. No ads — all schedule.',
    hasAds: false,
  },
  {
    key: 'sponsor-spotlight',
    name: 'Sponsor Spotlight',
    description:
      'A tall sponsor poster on the left (image or video), sponsor logo slot in the header, and the schedule filling the rest of the screen.',
    hasAds: true,
  },
  {
    key: 'promo-banner',
    name: 'Promo Banner',
    description:
      'Bright, light-theme board with a rotating promo banner across the bottom — ideal for pro-shop specials, upcoming programs, or sponsors.',
    hasAds: true,
  },
  {
    key: 'custom',
    name: 'Build your own',
    description:
      'Start from a bare schedule and add the blocks you want: header, QR codes, ad rails and banners, colors, and fonts.',
    hasAds: false,
  },
];

function baseConfig(): TvMonitorConfig {
  return {
    template: 'custom',
    screenRatio: 'fill',
    design: { ...TV_DESIGN_PRESETS.dark },
    header: {
      enabled: true,
      showLogo: true,
      logoUrl: null,
      title: 'Facility Schedule',
      showTitle: true,
      showClock: true,
      showDate: true,
      scheduleQr: { enabled: false, url: null, label: 'Full schedule' },
      waiverQr: { enabled: false, url: null, label: 'Scan for waiver' },
      sponsorAdId: null,
    },
    schedule: {
      enabled: true,
      resourceIds: [],
      futureHoursLimit: 9,
      showNotes: true,
      showMaintenance: true,
      showPrivateEvents: true,
      privateEventLabel: 'Private event',
      maintenanceLabel: 'Maintenance',
      autoScroll: true,
      scrollSpeed: 2,
      scrollMode: 'synchronized',
      scrollPauseSeconds: 3,
    },
    ads: [],
    refreshSeconds: 60,
  };
}

/**
 * Returns a fresh, fully-populated config for a template key.
 */
export function buildTvMonitorTemplateConfig(key: TvMonitorTemplateKey): TvMonitorConfig {
  const config = baseConfig();
  config.template = key;

  switch (key) {
    case 'rink-classic': {
      config.header.scheduleQr.enabled = true;
      return config;
    }

    case 'sponsor-spotlight': {
      config.header.scheduleQr.enabled = true;
      config.header.sponsorAdId = 'ad-header-sponsor';
      config.ads = [
        {
          id: 'ad-left-rail',
          enabled: true,
          placement: 'left',
          sizeMode: 'ratio',
          sizePx: 480,
          sizePercent: 28,
          backgroundColor: 'transparent',
          assets: [],
        },
        {
          id: 'ad-header-sponsor',
          enabled: true,
          placement: 'header',
          sizeMode: 'pixels',
          sizePx: 90,
          sizePercent: 10,
          backgroundColor: 'transparent',
          assets: [],
        },
      ];
      return config;
    }

    case 'promo-banner': {
      config.design = { ...TV_DESIGN_PRESETS.light };
      config.header.scheduleQr.enabled = true;
      config.ads = [
        {
          id: 'ad-bottom-banner',
          enabled: true,
          placement: 'bottom',
          sizeMode: 'pixels',
          sizePx: 150,
          sizePercent: 14,
          backgroundColor: 'transparent',
          assets: [],
        },
      ];
      return config;
    }

    case 'custom':
    default: {
      config.header.showClock = true;
      return config;
    }
  }
}
