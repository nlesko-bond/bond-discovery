import { describe, it, expect, vi, beforeEach } from 'vitest';
import { 
  mockDiscoveryPageRow, 
  mockDiscoveryPageRowNoGtm, 
  mockDiscoveryPageRowEmptyFilters,
  mockBranding,
  mockFeatures,
} from '../fixtures/mockData';

// Mock Supabase
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockUpdate = vi.fn();
const mockDelete = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();
const mockOrder = vi.fn();

// Mock admin client
const mockAdminFrom = vi.fn();

vi.mock('@/lib/supabase', () => ({
  supabase: {
    from: (table: string) => mockFrom(table),
  },
  getSupabaseAdmin: () => ({
    from: (table: string) => mockAdminFrom(table),
  }),
}));

// Set up mock returns
const createChainableMock = (resolvedValue: any) => ({
  select: mockSelect.mockReturnThis(),
  insert: mockInsert.mockReturnThis(),
  update: mockUpdate.mockReturnThis(),
  delete: mockDelete.mockReturnThis(),
  eq: mockEq.mockReturnThis(),
  single: mockSingle.mockResolvedValue(resolvedValue),
  order: mockOrder.mockResolvedValue(resolvedValue),
});

// Import after mocks
import {
  getConfigBySlug,
  getConfig,
  getAllPageConfigs,
  createPageConfig,
  updatePageConfig,
  deletePageConfig,
  getBrandingCssVars,
  isFilterEnabled,
  parseUrlParams,
  defaultConfig,
} from '@/lib/config';
import { DiscoveryConfig, FeatureConfig, FilterType } from '@/types';

describe('Config Library', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockFrom.mockReturnValue(createChainableMock({ data: null, error: null }));
    mockAdminFrom.mockReturnValue(createChainableMock({ data: null, error: null }));
  });

  describe('defaultConfig', () => {
    it('has required fields', () => {
      expect(defaultConfig.id).toBe('default');
      expect(defaultConfig.slug).toBe('default');
      expect(defaultConfig.organizationIds).toEqual([]);
      expect(defaultConfig.branding).toBeDefined();
      expect(defaultConfig.features).toBeDefined();
    });

    it('has default filter types', () => {
      expect(defaultConfig.features.enableFilters).toContain('search');
      expect(defaultConfig.features.enableFilters).toContain('facility');
      expect(defaultConfig.features.enableFilters).toContain('programType');
    });
  });

  describe('getConfigBySlug', () => {
    it('returns config for valid slug', async () => {
      // getConfigBySlug uses admin client
      mockAdminFrom.mockReturnValue(createChainableMock({
        data: mockDiscoveryPageRow,
        error: null,
      }));

      const config = await getConfigBySlug('test-page');

      expect(mockAdminFrom).toHaveBeenCalledWith('discovery_pages');
      expect(mockEq).toHaveBeenCalledWith('slug', 'test-page');
      expect(config).not.toBeNull();
      expect(config?.slug).toBe('test-page');
    });

    it('returns null for non-existent slug', async () => {
      mockAdminFrom.mockReturnValue(createChainableMock({
        data: null,
        error: { message: 'Not found' },
      }));

      const config = await getConfigBySlug('non-existent');

      expect(config).toBeNull();
    });

    it('converts database row to DiscoveryConfig', async () => {
      mockAdminFrom.mockReturnValue(createChainableMock({
        data: mockDiscoveryPageRow,
        error: null,
      }));

      const config = await getConfigBySlug('test-page');

      expect(config?.id).toBe(mockDiscoveryPageRow.id);
      expect(config?.name).toBe(mockDiscoveryPageRow.name);
      expect(config?.organizationIds).toEqual(['123', '456']); // Converted to strings
      expect(config?.facilityIds).toEqual(['789']);
      expect(config?.branding).toEqual(mockDiscoveryPageRow.branding);
      expect(config?.isActive).toBe(mockDiscoveryPageRow.is_active);
    });

    it('inherits GTM ID from partner group if page has none', async () => {
      mockAdminFrom.mockReturnValue(createChainableMock({
        data: mockDiscoveryPageRowNoGtm,
        error: null,
      }));

      const config = await getConfigBySlug('test-page');

      expect(config?.gtmId).toBe('GTM-PARTNER'); // From partner_group
    });

    it('uses page GTM ID over partner group', async () => {
      mockAdminFrom.mockReturnValue(createChainableMock({
        data: mockDiscoveryPageRow,
        error: null,
      }));

      const config = await getConfigBySlug('test-page');

      expect(config?.gtmId).toBe('GTM-TEST123'); // Page-level GTM
    });

    it('applies default filters when enableFilters is empty', async () => {
      mockAdminFrom.mockReturnValue(createChainableMock({
        data: mockDiscoveryPageRowEmptyFilters,
        error: null,
      }));

      const config = await getConfigBySlug('test-page');

      // Should have default filters applied
      expect(config?.features.enableFilters.length).toBeGreaterThan(0);
      expect(config?.features.enableFilters).toContain('search');
    });
  });

  describe('getConfig', () => {
    it('returns config by ID', async () => {
      // getConfig uses admin client
      mockAdminFrom.mockReturnValue(createChainableMock({
        data: mockDiscoveryPageRow,
        error: null,
      }));

      const config = await getConfig('test-config-1');

      expect(mockEq).toHaveBeenCalledWith('id', 'test-config-1');
      expect(config.id).toBe('test-config-1');
    });

    it('returns defaultConfig when not found', async () => {
      mockAdminFrom.mockReturnValue(createChainableMock({
        data: null,
        error: { message: 'Not found' },
      }));

      const config = await getConfig('non-existent');

      expect(config.id).toBe('default');
      expect(config.slug).toBe('default');
    });
  });

  describe('getAllPageConfigs', () => {
    it('returns array of configs', async () => {
      // getAllPageConfigs uses admin client
      mockOrder.mockResolvedValue({
        data: [mockDiscoveryPageRow, { ...mockDiscoveryPageRow, id: 'config-2', slug: 'page-2' }],
        error: null,
      });
      mockAdminFrom.mockReturnValue({
        select: mockSelect.mockReturnThis(),
        eq: mockEq.mockReturnThis(),
        order: mockOrder,
      });

      const configs = await getAllPageConfigs();

      expect(Array.isArray(configs)).toBe(true);
      expect(configs.length).toBe(2);
    });

    it('returns empty array on error', async () => {
      mockOrder.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });
      mockAdminFrom.mockReturnValue({
        select: mockSelect.mockReturnThis(),
        eq: mockEq.mockReturnThis(),
        order: mockOrder,
      });

      const configs = await getAllPageConfigs();

      expect(configs).toEqual([]);
    });

    it('orders by name without active filter', async () => {
      mockOrder.mockResolvedValue({ data: [], error: null });
      mockAdminFrom.mockReturnValue({
        select: mockSelect.mockReturnThis(),
        eq: mockEq.mockReturnThis(),
        order: mockOrder,
      });

      await getAllPageConfigs();

      expect(mockOrder).toHaveBeenCalledWith('name');
      expect(mockEq).not.toHaveBeenCalledWith('is_active', true);
    });
  });

  describe('createPageConfig', () => {
    it('creates new config with required fields', async () => {
      const mockReturn = {
        ...mockDiscoveryPageRow,
        slug: 'new-page',
      };
      mockSingle.mockResolvedValue({ data: mockReturn, error: null });
      mockAdminFrom.mockReturnValue({
        insert: mockInsert.mockReturnThis(),
        select: mockSelect.mockReturnThis(),
        single: mockSingle,
      });

      const config = await createPageConfig({
        name: 'New Page',
        slug: 'new-page',
        organizationIds: ['123'],
      });

      expect(mockAdminFrom).toHaveBeenCalledWith('discovery_pages');
      expect(mockInsert).toHaveBeenCalled();
      expect(config.slug).toBe('new-page');
    });

    it('normalizes slug to lowercase with dashes', async () => {
      const mockReturn = {
        ...mockDiscoveryPageRow,
        slug: 'test-page-name',
      };
      mockSingle.mockResolvedValue({ data: mockReturn, error: null });
      mockAdminFrom.mockReturnValue({
        insert: mockInsert.mockReturnThis(),
        select: mockSelect.mockReturnThis(),
        single: mockSingle,
      });

      await createPageConfig({
        name: 'Test Page',
        slug: 'Test Page Name',
        organizationIds: ['123'],
      });

      // Check the inserted data
      const insertedData = mockInsert.mock.calls[0][0];
      expect(insertedData.slug).toBe('test-page-name');
    });

    it('applies default values', async () => {
      const mockReturn = mockDiscoveryPageRow;
      mockSingle.mockResolvedValue({ data: mockReturn, error: null });
      mockAdminFrom.mockReturnValue({
        insert: mockInsert.mockReturnThis(),
        select: mockSelect.mockReturnThis(),
        single: mockSingle,
      });

      await createPageConfig({
        name: 'Test',
        slug: 'test',
        organizationIds: ['1'],
      });

      const insertedData = mockInsert.mock.calls[0][0];
      expect(insertedData.branding.primaryColor).toBe('#1E2761');
      expect(insertedData.features.showPricing).toBe(true);
      expect(insertedData.cache_ttl).toBe(300);
      expect(insertedData.is_active).toBe(true);
    });

    it('throws error on database failure', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Duplicate slug' },
      });
      mockAdminFrom.mockReturnValue({
        insert: mockInsert.mockReturnThis(),
        select: mockSelect.mockReturnThis(),
        single: mockSingle,
      });

      await expect(createPageConfig({
        name: 'Test',
        slug: 'test',
        organizationIds: ['1'],
      })).rejects.toThrow('Duplicate slug');
    });
  });

  describe('updatePageConfig', () => {
    it('updates config by slug', async () => {
      // First call is update (returns no error), second call is select (returns data)
      let callCount = 0;
      mockAdminFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          // Update call
          return {
            update: mockUpdate.mockReturnThis(),
            eq: mockEq.mockResolvedValue({ error: null }),
          };
        } else {
          // Select call
          return {
            select: mockSelect.mockReturnThis(),
            eq: mockEq.mockReturnThis(),
            single: mockSingle.mockResolvedValue({ data: mockDiscoveryPageRow, error: null }),
          };
        }
      });

      const config = await updatePageConfig('test-page', {
        name: 'Updated Name',
      });

      expect(mockUpdate).toHaveBeenCalledWith(expect.objectContaining({
        name: 'Updated Name',
      }));
    });

    it('only updates provided fields', async () => {
      let callCount = 0;
      mockAdminFrom.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return {
            update: mockUpdate.mockReturnThis(),
            eq: mockEq.mockResolvedValue({ error: null }),
          };
        } else {
          return {
            select: mockSelect.mockReturnThis(),
            eq: mockEq.mockReturnThis(),
            single: mockSingle.mockResolvedValue({ data: mockDiscoveryPageRow, error: null }),
          };
        }
      });

      await updatePageConfig('test-page', {
        branding: { ...mockBranding, primaryColor: '#FF0000' },
      });

      const updateData = mockUpdate.mock.calls[0][0];
      expect(updateData.branding).toBeDefined();
      expect(updateData.name).toBeUndefined();
    });

    it('throws error on database failure', async () => {
      mockAdminFrom.mockReturnValue({
        update: mockUpdate.mockReturnThis(),
        eq: mockEq.mockResolvedValue({ error: { message: 'Not found' } }),
      });

      await expect(updatePageConfig('non-existent', { name: 'Test' }))
        .rejects.toThrow('Not found');
    });
  });

  describe('deletePageConfig', () => {
    it('deletes config by slug', async () => {
      mockAdminFrom.mockReturnValue({
        delete: mockDelete.mockReturnThis(),
        eq: mockEq.mockResolvedValue({ error: null }),
      });

      const result = await deletePageConfig('test-page');

      expect(mockAdminFrom).toHaveBeenCalledWith('discovery_pages');
      expect(mockDelete).toHaveBeenCalled();
      expect(result).toBe(true);
    });

    it('prevents deletion of toca config', async () => {
      await expect(deletePageConfig('toca'))
        .rejects.toThrow('Cannot delete the default TOCA configuration');
    });

    it('returns false on error', async () => {
      mockAdminFrom.mockReturnValue({
        delete: mockDelete.mockReturnThis(),
        eq: mockEq.mockResolvedValue({ error: { message: 'Error' } }),
      });

      const result = await deletePageConfig('test-page');

      expect(result).toBe(false);
    });
  });

  describe('getBrandingCssVars', () => {
    it('returns CSS variables from branding config', () => {
      const cssVars = getBrandingCssVars(mockBranding);

      expect(cssVars['--color-primary']).toBe('#1E2761');
      expect(cssVars['--color-secondary']).toBe('#6366F1');
    });

    it('generates darker primary color', () => {
      const cssVars = getBrandingCssVars(mockBranding);

      expect(cssVars['--color-primary-dark']).toBeDefined();
      // Darker color should be different from primary
      expect(cssVars['--color-primary-dark']).not.toBe(cssVars['--color-primary']);
    });

    it('generates lighter primary color', () => {
      const cssVars = getBrandingCssVars(mockBranding);

      expect(cssVars['--color-primary-light']).toBeDefined();
      expect(cssVars['--color-primary-light']).not.toBe(cssVars['--color-primary']);
    });

    it('uses secondary as accent fallback', () => {
      const brandingNoAccent = { ...mockBranding, accentColor: undefined };
      const cssVars = getBrandingCssVars(brandingNoAccent);

      expect(cssVars['--color-accent']).toBe(mockBranding.secondaryColor);
    });

    it('uses accentColor when provided', () => {
      const cssVars = getBrandingCssVars(mockBranding);

      expect(cssVars['--color-accent']).toBe('#8B5CF6');
    });
  });

  describe('isFilterEnabled', () => {
    const features: FeatureConfig = {
      ...mockFeatures,
      enableFilters: ['search', 'facility', 'sport'] as FilterType[],
    };

    it('returns true for enabled filter', () => {
      expect(isFilterEnabled(features, 'search')).toBe(true);
      expect(isFilterEnabled(features, 'facility')).toBe(true);
      expect(isFilterEnabled(features, 'sport')).toBe(true);
    });

    it('returns false for disabled filter', () => {
      expect(isFilterEnabled(features, 'price')).toBe(false);
      expect(isFilterEnabled(features, 'gender')).toBe(false);
    });
  });

  describe('parseUrlParams', () => {
    const config: DiscoveryConfig = {
      ...defaultConfig,
      allowedParams: ['viewMode', 'search', 'facilityIds'],
      defaultParams: { viewMode: 'programs' },
    };

    it('applies default params', () => {
      const params = parseUrlParams(new URLSearchParams(), config);

      expect(params.viewMode).toBe('programs');
    });

    it('overrides defaults with URL params', () => {
      const urlParams = new URLSearchParams({ viewMode: 'schedule' });
      const params = parseUrlParams(urlParams, config);

      expect(params.viewMode).toBe('schedule');
    });

    it('only includes allowed params', () => {
      const urlParams = new URLSearchParams({
        viewMode: 'schedule',
        search: 'soccer',
        notAllowed: 'value',
      });
      const params = parseUrlParams(urlParams, config);

      expect(params.viewMode).toBe('schedule');
      expect(params.search).toBe('soccer');
      expect(params.notAllowed).toBeUndefined();
    });

    it('ignores empty URL params', () => {
      const urlParams = new URLSearchParams({ search: '' });
      const params = parseUrlParams(urlParams, config);

      // Empty string is falsy, so search won't be set
      expect(params.search).toBeUndefined();
    });
  });
});
