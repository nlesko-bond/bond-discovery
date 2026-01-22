import { DiscoveryConfig, BrandingConfig, FeatureConfig, FilterType } from '@/types';
import { supabase, DiscoveryPageRow } from './supabase';

/**
 * Convert database row to DiscoveryConfig
 */
function rowToConfig(row: DiscoveryPageRow): DiscoveryConfig {
  return {
    id: row.id,
    name: row.name,
    slug: row.slug,
    organizationIds: row.organization_ids.map(String),
    facilityIds: row.facility_ids?.map(String) || [],
    apiKey: row.api_key || undefined,
    branding: row.branding,
    features: {
      ...row.features,
      enableFilters: row.features.enableFilters as FilterType[],
    },
    allowedParams: row.allowed_params || [],
    defaultParams: row.default_params || {},
    cacheTtl: row.cache_ttl || 300,
    isActive: row.is_active,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/**
 * Default configuration (used as fallback)
 */
export const defaultConfig: DiscoveryConfig = {
  id: 'default',
  name: 'Discovery',
  slug: 'default',
  organizationIds: [],
  facilityIds: [],
  branding: {
    primaryColor: '#1E2761',
    secondaryColor: '#6366F1',
    accentColor: '#8B5CF6',
    companyName: 'Discovery',
    tagline: 'Find your perfect program',
  },
  features: {
    showPricing: true,
    showAvailability: true,
    showMembershipBadges: true,
    showAgeGender: true,
    enableFilters: ['facility', 'programType', 'sport', 'age', 'dateRange', 'program'] as FilterType[],
    defaultView: 'programs',
    allowViewToggle: true,
  },
  allowedParams: ['viewMode', 'facilityIds', 'programIds', 'programTypes', 'search'],
  defaultParams: {},
  cacheTtl: 300,
  isActive: true,
  createdAt: new Date().toISOString(),
  updatedAt: new Date().toISOString(),
};

/**
 * Get all page configurations from Supabase
 */
export async function getAllPageConfigs(): Promise<DiscoveryConfig[]> {
  const { data, error } = await supabase
    .from('discovery_pages')
    .select('*')
    .eq('is_active', true)
    .order('name');
  
  if (error) {
    console.error('Error fetching page configs:', error);
    return [];
  }
  
  return (data || []).map(rowToConfig);
}

/**
 * Get configuration by slug from Supabase
 */
export async function getConfigBySlug(slug: string): Promise<DiscoveryConfig | null> {
  const { data, error } = await supabase
    .from('discovery_pages')
    .select('*')
    .eq('slug', slug)
    .single();
  
  if (error || !data) {
    console.error('Error fetching config by slug:', error);
    return null;
  }
  
  return rowToConfig(data);
}

/**
 * Get configuration by ID
 */
export async function getConfig(configId: string = 'default'): Promise<DiscoveryConfig> {
  const { data, error } = await supabase
    .from('discovery_pages')
    .select('*')
    .eq('id', configId)
    .single();
  
  if (error || !data) {
    return defaultConfig;
  }
  
  return rowToConfig(data);
}

/**
 * Create a new page configuration
 */
export async function createPageConfig(config: {
  name: string;
  slug: string;
  organizationIds: string[];
  facilityIds?: string[];
  apiKey?: string;
  branding?: Partial<BrandingConfig>;
  features?: Partial<FeatureConfig>;
  allowedParams?: string[];
  defaultParams?: Record<string, string>;
  cacheTtl?: number;
  isActive?: boolean;
}): Promise<DiscoveryConfig> {
  const { data, error } = await supabase
    .from('discovery_pages')
    .insert({
      name: config.name,
      slug: config.slug.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
      organization_ids: config.organizationIds.map(Number),
      facility_ids: config.facilityIds?.map(Number) || [],
      api_key: config.apiKey || null,
      branding: {
        companyName: config.branding?.companyName || config.name,
        primaryColor: config.branding?.primaryColor || '#1E2761',
        secondaryColor: config.branding?.secondaryColor || '#6366F1',
        accentColor: config.branding?.accentColor || '#8B5CF6',
        logo: config.branding?.logo || null,
        tagline: config.branding?.tagline || null,
      },
      features: {
        showPricing: config.features?.showPricing ?? true,
        showAvailability: config.features?.showAvailability ?? true,
        showMembershipBadges: config.features?.showMembershipBadges ?? true,
        showAgeGender: config.features?.showAgeGender ?? true,
        enableFilters: config.features?.enableFilters || ['facility', 'programType', 'sport', 'age', 'date'],
        defaultView: config.features?.defaultView || 'programs',
        allowViewToggle: config.features?.allowViewToggle ?? true,
      },
      allowed_params: config.allowedParams || ['viewMode', 'facilityIds', 'programIds', 'programTypes', 'search'],
      default_params: config.defaultParams || {},
      cache_ttl: config.cacheTtl || 300,
      is_active: config.isActive ?? true,
    })
    .select()
    .single();
  
  if (error) {
    console.error('Error creating page config:', error);
    throw new Error(error.message);
  }
  
  return rowToConfig(data);
}

/**
 * Update an existing page configuration
 */
export async function updatePageConfig(slug: string, updates: Partial<DiscoveryConfig>): Promise<DiscoveryConfig> {
  // Build the update object
  const updateData: any = {};
  
  if (updates.name !== undefined) updateData.name = updates.name;
  if (updates.organizationIds !== undefined) updateData.organization_ids = updates.organizationIds.map(Number);
  if (updates.facilityIds !== undefined) updateData.facility_ids = updates.facilityIds.map(Number);
  if (updates.apiKey !== undefined) updateData.api_key = updates.apiKey;
  if (updates.branding !== undefined) updateData.branding = updates.branding;
  if (updates.features !== undefined) updateData.features = updates.features;
  if (updates.allowedParams !== undefined) updateData.allowed_params = updates.allowedParams;
  if (updates.defaultParams !== undefined) updateData.default_params = updates.defaultParams;
  if (updates.cacheTtl !== undefined) updateData.cache_ttl = updates.cacheTtl;
  if (updates.isActive !== undefined) updateData.is_active = updates.isActive;
  
  const { data, error } = await supabase
    .from('discovery_pages')
    .update(updateData)
    .eq('slug', slug)
    .select()
    .single();
  
  if (error) {
    console.error('Error updating page config:', error);
    throw new Error(error.message);
  }
  
  return rowToConfig(data);
}

/**
 * Delete a page configuration
 */
export async function deletePageConfig(slug: string): Promise<boolean> {
  if (slug === 'toca') {
    throw new Error('Cannot delete the default TOCA configuration');
  }
  
  const { error } = await supabase
    .from('discovery_pages')
    .delete()
    .eq('slug', slug);
  
  if (error) {
    console.error('Error deleting page config:', error);
    return false;
  }
  
  return true;
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
    '--color-accent': branding.accentColor || branding.secondaryColor,
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
