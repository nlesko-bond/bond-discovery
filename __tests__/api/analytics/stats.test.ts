import { describe, it, expect, vi, beforeEach } from 'vitest';
import { NextRequest } from 'next/server';

// Helper to create a chainable mock that returns a promise at the end
const createChainableMock = (resolvedValue: any) => {
  const chainable: any = {
    select: vi.fn().mockReturnThis(),
    eq: vi.fn().mockReturnThis(),
    gte: vi.fn().mockReturnThis(),
    order: vi.fn().mockReturnThis(),
    then: (resolve: any) => resolve(resolvedValue),
  };
  // Make it thenable (awaitable)
  chainable[Symbol.toStringTag] = 'Promise';
  return chainable;
};

// Default mock responses
const defaultResponses = {
  pageViewsCount: { count: 100, data: null, error: null },
  uniqueVisitors: { data: [{ ip_hash: 'hash1' }, { ip_hash: 'hash2' }], error: null },
  registerClicks: { count: 10, data: null, error: null },
  dailyViews: { data: [
    { created_at: '2026-01-20T10:00:00Z', page_slug: 'test-page' },
    { created_at: '2026-01-21T10:00:00Z', page_slug: 'test-page' },
  ], error: null },
  pageViews: { data: [
    { page_slug: 'page-1' },
    { page_slug: 'page-1' },
    { page_slug: 'page-2' },
  ], error: null },
  events: { data: [
    { event_type: 'click_register' },
    { event_type: 'share_link' },
  ], error: null },
};

// Track which query is being made
let queryIndex = 0;

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: (table: string) => {
        queryIndex++;
        
        // Return appropriate mock based on query order and table
        // The stats route makes queries in this order:
        // 1. page_views with count (totalViews)
        // 2. page_views select ip_hash (unique visitors)
        // 3. page_events with count (registerClicks)
        // 4. page_views with order (dailyViews)
        // 5. page_views select page_slug (topPages)
        // 6. page_events select event_type (events)
        
        if (table === 'page_views') {
          if (queryIndex === 1) {
            return createChainableMock(defaultResponses.pageViewsCount);
          } else if (queryIndex === 2) {
            return createChainableMock(defaultResponses.uniqueVisitors);
          } else if (queryIndex === 4) {
            return createChainableMock(defaultResponses.dailyViews);
          } else {
            return createChainableMock(defaultResponses.pageViews);
          }
        }
        if (table === 'page_events') {
          if (queryIndex === 3) {
            return createChainableMock(defaultResponses.registerClicks);
          }
          return createChainableMock(defaultResponses.events);
        }
        return createChainableMock({ data: [], error: null });
      },
    })),
  };
});

// Set environment variables
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';

// Import after mocks are set up
import { GET } from '@/app/api/analytics/stats/route';

describe('Analytics Stats API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    queryIndex = 0;
  });

  const createMockRequest = (params?: Record<string, string>) => {
    const url = new URL('http://localhost:3000/api/analytics/stats');
    if (params) {
      Object.entries(params).forEach(([key, value]) => {
        url.searchParams.set(key, value);
      });
    }
    return new NextRequest(url.toString());
  };

  describe('Basic Stats Response', () => {
    it('returns stats summary with all fields', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('summary');
      expect(data.summary).toHaveProperty('totalViews');
      expect(data.summary).toHaveProperty('uniqueVisitors');
      expect(data.summary).toHaveProperty('registerClicks');
      expect(data.summary).toHaveProperty('conversionRate');
    });

    it('returns daily stats array', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('dailyStats');
      expect(Array.isArray(data.dailyStats)).toBe(true);
    });

    it('returns top pages array', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('topPages');
      expect(Array.isArray(data.topPages)).toBe(true);
    });

    it('returns event breakdown object', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('eventBreakdown');
      expect(typeof data.eventBreakdown).toBe('object');
    });

    it('returns period information', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data).toHaveProperty('period');
      expect(data.period).toHaveProperty('days');
      expect(data.period).toHaveProperty('startDate');
    });
  });

  describe('Query Parameters', () => {
    it('accepts days parameter', async () => {
      const request = createMockRequest({ days: '7' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.period.days).toBe(7);
    });

    it('defaults to 30 days when not specified', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.period.days).toBe(30);
    });

    it('accepts pageSlug parameter', async () => {
      const request = createMockRequest({ pageSlug: 'my-page' });
      const response = await GET(request);

      // Should succeed (filtering happens in mock)
      expect(response.status).toBe(200);
    });

    it('accepts partnerGroupId parameter', async () => {
      const request = createMockRequest({ partnerGroupId: 'partner-123' });
      const response = await GET(request);

      expect(response.status).toBe(200);
    });

    it('accepts multiple parameters together', async () => {
      const request = createMockRequest({ 
        days: '14', 
        pageSlug: 'test-page',
        partnerGroupId: 'partner-123',
      });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.period.days).toBe(14);
    });
  });

  describe('Summary Calculations', () => {
    it('returns totalViews count', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.summary.totalViews).toBe('number');
    });

    it('calculates unique visitors from ip_hash', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.summary.uniqueVisitors).toBe('number');
    });

    it('returns registerClicks count', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.summary.registerClicks).toBe('number');
    });

    it('calculates conversion rate as string percentage', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(typeof data.summary.conversionRate).toBe('string');
      // Should be formatted as X.XX
      expect(data.summary.conversionRate).toMatch(/^\d+(\.\d{2})?$/);
    });
  });

  describe('Period Date Calculation', () => {
    it('startDate is in ISO format', async () => {
      const request = createMockRequest({ days: '7' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      // Should be valid ISO date
      const date = new Date(data.period.startDate);
      expect(date.toISOString()).toBe(data.period.startDate);
    });

    it('startDate is approximately N days ago', async () => {
      const request = createMockRequest({ days: '7' });
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      
      const startDate = new Date(data.period.startDate);
      const now = new Date();
      const diffDays = Math.round((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
      
      // Allow 1 day tolerance for test timing
      expect(diffDays).toBeGreaterThanOrEqual(6);
      expect(diffDays).toBeLessThanOrEqual(8);
    });
  });

  describe('Response Structure', () => {
    it('has correct top-level keys', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(Object.keys(data).sort()).toEqual([
        'dailyStats',
        'eventBreakdown',
        'period',
        'summary',
        'topPages',
      ].sort());
    });

    it('topPages items have slug and views', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      if (data.topPages.length > 0) {
        expect(data.topPages[0]).toHaveProperty('slug');
        expect(data.topPages[0]).toHaveProperty('views');
      }
    });

    it('dailyStats items have date and views', async () => {
      const request = createMockRequest();
      const response = await GET(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      if (data.dailyStats.length > 0) {
        expect(data.dailyStats[0]).toHaveProperty('date');
        expect(data.dailyStats[0]).toHaveProperty('views');
      }
    });
  });
});
