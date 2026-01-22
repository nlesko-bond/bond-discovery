import { DiscoveryConfig, BrandingConfig, FeatureConfig, FilterType } from '@/types';
import { cacheGet, cacheSet, configCacheKey } from './cache';

/**
 * Default configuration
 */
export const defaultConfig: DiscoveryConfig = {
  id: 'default',
  name: 'Bond Discovery',
  slug: 'default',
  
  organizationIds: ['516', '512', '513', '519', '518', '521', '514', '515', '510', '520', '522', '511'],
  facilityIds: [],
  
  branding: {
    primaryColor: '#c4ad7d',
    secondaryColor: '#1f2937',
    companyName: 'Bond Sports',
    tagline: 'Find programs at your local sports facilities',
  },
  
  features: {
    showPricing: true,
    showAvailability: true,
    showMembershipBadges: true,
    showAgeGender: true,
    enableFilters: ['search', 'facility', 'sport', 'programType', 'dateRange', 'age', 'availability'],
    defaultView: 'programs',
    allowViewToggle: true,
  },
  
  allowedParams: ['orgIds', 'facilityIds', 'viewMode', 'search', 'sport', 'programType'],
  defaultParams: {},
  
  cacheTtl: 300, // 5 minutes
  
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Get configuration by ID
 */
export async function getConfig(configId: string = 'default'): Promise<DiscoveryConfig> {
  const cacheKey = configCacheKey(configId);
  
  // Try to get from cache
  const cached = await cacheGet<DiscoveryConfig>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // TODO: Load from database/KV storage
  // For now, return default config
  const config = configId === 'default' ? defaultConfig : {
    ...defaultConfig,
    id: configId,
  };
  
  // Cache the config
  await cacheSet(cacheKey, config, { ttl: 3600 }); // Cache for 1 hour
  
  return config;
}

/**
 * Save configuration
 */
export async function saveConfig(config: DiscoveryConfig): Promise<void> {
  const cacheKey = configCacheKey(config.id);
  
  const updatedConfig = {
    ...config,
    updatedAt: new Date().toISOString(),
  };
  
  // Save to cache (in production, also save to database)
  await cacheSet(cacheKey, updatedConfig, { ttl: 3600 });
}

/**
 * Get CSS variables from branding config
 */
export function getBrandingCssVars(branding: BrandingConfig): Record<string, string> {
  return {
    '--color-primary': branding.primaryColor,
    '--color-primary-dark': darkenColor(branding.primaryColor, 20),
    '--color-primary-light': lightenColor(branding.primaryColor, 20),
    '--color-secondary': branding.secondaryColor,
  };
}

/**
 * Check if a filter type is enabled
 */
export function isFilterEnabled(features: FeatureConfig, filter: FilterType): boolean {
  return features.enableFilters.includes(filter);
}

/**
 * Parse URL parameters with config defaults
 */
export function parseUrlParams(
  searchParams: URLSearchParams, 
  config: DiscoveryConfig
): Record<string, string> {
  const params: Record<string, string> = {};
  
  // Apply defaults first
  Object.entries(config.defaultParams).forEach(([key, value]) => {
    params[key] = value;
  });
  
  // Override with URL params (only allowed ones)
  config.allowedParams.forEach(key => {
    const value = searchParams.get(key);
    if (value) {
      params[key] = value;
    }
  });
  
  return params;
}

// Color manipulation helpers

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
  return result ? {
    r: parseInt(result[1], 16),
    g: parseInt(result[2], 16),
    b: parseInt(result[3], 16),
  } : null;
}

function rgbToHex(r: number, g: number, b: number): string {
  return '#' + [r, g, b].map(x => {
    const hex = Math.max(0, Math.min(255, Math.round(x))).toString(16);
    return hex.length === 1 ? '0' + hex : hex;
  }).join('');
}

function darkenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const factor = 1 - percent / 100;
  return rgbToHex(
    rgb.r * factor,
    rgb.g * factor,
    rgb.b * factor
  );
}

function lightenColor(hex: string, percent: number): string {
  const rgb = hexToRgb(hex);
  if (!rgb) return hex;
  
  const factor = percent / 100;
  return rgbToHex(
    rgb.r + (255 - rgb.r) * factor,
    rgb.g + (255 - rgb.g) * factor,
    rgb.b + (255 - rgb.b) * factor
  );
}
