import { DiscoveryConfig, BrandingConfig, FeatureConfig, FilterType } from '@/types';
import { cacheGet, cacheSet, configCacheKey } from './cache';

// In-memory store for page configs (in production, use Vercel KV or database)
const pageConfigs: Map<string, DiscoveryConfig> = new Map();

/**
 * Default TOCA configuration
 */
export const defaultConfig: DiscoveryConfig = {
  id: 'toca-default',
  name: 'TOCA Soccer',
  slug: 'toca',
  
  organizationIds: ['516', '512', '513', '519', '518', '521', '514', '515', '510', '520', '522', '511'],
  facilityIds: [],
  
  branding: {
    primaryColor: '#1E2761',
    secondaryColor: '#6366F1',
    accentColor: '#A5B4FC',
    companyName: 'TOCA Soccer',
    tagline: 'Find soccer programs at your local TOCA centers',
  },
  
  features: {
    showPricing: true,
    showAvailability: true,
    showMembershipBadges: true,
    showAgeGender: true,
    enableFilters: ['search', 'facility', 'program', 'sport', 'programType', 'dateRange', 'age', 'availability'],
    defaultView: 'programs',
    allowViewToggle: true,
  },
  
  allowedParams: ['orgIds', 'facilityIds', 'programIds', 'viewMode', 'search', 'sport', 'programType', 'programTypes'],
  defaultParams: {},
  
  cacheTtl: 300,
  
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

// Initialize with default config
pageConfigs.set('toca', defaultConfig);

/**
 * Get all page configurations
 */
export async function getAllPageConfigs(): Promise<DiscoveryConfig[]> {
  // Try to get from cache first
  const cacheKey = 'all-page-configs';
  const cached = await cacheGet<DiscoveryConfig[]>(cacheKey);
  if (cached && cached.length > 0) {
    return cached;
  }
  
  // Return all configs from memory (in production, fetch from database)
  const configs = Array.from(pageConfigs.values()).filter(c => c.isActive !== false);
  
  // Cache the list
  await cacheSet(cacheKey, configs, { ttl: 60 });
  
  return configs;
}

/**
 * Get configuration by slug
 */
export async function getConfigBySlug(slug: string): Promise<DiscoveryConfig | null> {
  const cacheKey = `config-slug:${slug}`;
  
  // Try cache first
  const cached = await cacheGet<DiscoveryConfig>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Look up in memory store
  const config = pageConfigs.get(slug);
  
  if (config) {
    await cacheSet(cacheKey, config, { ttl: 300 });
    return config;
  }
  
  return null;
}

/**
 * Get configuration by ID (for admin)
 */
export async function getConfig(configId: string = 'default'): Promise<DiscoveryConfig> {
  const cacheKey = configCacheKey(configId);
  
  // Try to get from cache
  const cached = await cacheGet<DiscoveryConfig>(cacheKey);
  if (cached) {
    return cached;
  }
  
  // Look up by ID
  for (const config of pageConfigs.values()) {
    if (config.id === configId) {
      await cacheSet(cacheKey, config, { ttl: 3600 });
      return config;
    }
  }
  
  // Return default config
  return defaultConfig;
}

/**
 * Create a new page configuration
 */
export async function createPageConfig(config: Omit<DiscoveryConfig, 'id' | 'createdAt' | 'updatedAt'>): Promise<DiscoveryConfig> {
  const id = `page-${Date.now()}`;
  
  const newConfig: DiscoveryConfig = {
    ...config,
    id,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
  };
  
  // Validate slug is unique
  if (pageConfigs.has(newConfig.slug)) {
    throw new Error(`Slug "${newConfig.slug}" already exists`);
  }
  
  // Save to memory store
  pageConfigs.set(newConfig.slug, newConfig);
  
  // Invalidate cache
  await cacheSet(`config-slug:${newConfig.slug}`, newConfig, { ttl: 300 });
  await cacheSet('all-page-configs', Array.from(pageConfigs.values()), { ttl: 60 });
  
  return newConfig;
}

/**
 * Update an existing page configuration
 */
export async function updatePageConfig(slug: string, updates: Partial<DiscoveryConfig>): Promise<DiscoveryConfig> {
  const existing = pageConfigs.get(slug);
  
  if (!existing) {
    throw new Error(`Config with slug "${slug}" not found`);
  }
  
  // If slug is being changed, handle the rename
  if (updates.slug && updates.slug !== slug) {
    if (pageConfigs.has(updates.slug)) {
      throw new Error(`Slug "${updates.slug}" already exists`);
    }
    pageConfigs.delete(slug);
  }
  
  const updatedConfig: DiscoveryConfig = {
    ...existing,
    ...updates,
    updatedAt: new Date().toISOString(),
  };
  
  // Save to memory store
  pageConfigs.set(updatedConfig.slug, updatedConfig);
  
  // Update cache
  await cacheSet(`config-slug:${updatedConfig.slug}`, updatedConfig, { ttl: 300 });
  await cacheSet(configCacheKey(updatedConfig.id), updatedConfig, { ttl: 3600 });
  await cacheSet('all-page-configs', Array.from(pageConfigs.values()), { ttl: 60 });
  
  return updatedConfig;
}

/**
 * Delete a page configuration
 */
export async function deletePageConfig(slug: string): Promise<boolean> {
  if (slug === 'toca') {
    throw new Error('Cannot delete the default TOCA configuration');
  }
  
  const deleted = pageConfigs.delete(slug);
  
  if (deleted) {
    // Invalidate caches
    await cacheSet('all-page-configs', Array.from(pageConfigs.values()), { ttl: 60 });
  }
  
  return deleted;
}

/**
 * Save configuration (legacy support)
 */
export async function saveConfig(config: DiscoveryConfig): Promise<void> {
  await updatePageConfig(config.slug, config);
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
