import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { NextRequest } from 'next/server';

// Mock Supabase client - must be defined before vi.mock
const mockFrom = vi.fn();
const mockSelect = vi.fn();
const mockInsert = vi.fn();
const mockEq = vi.fn();
const mockSingle = vi.fn();

vi.mock('@supabase/supabase-js', () => {
  return {
    createClient: vi.fn(() => ({
      from: (table: string) => mockFrom(table),
    })),
  };
});

// Set environment variables before importing the route
process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://test.supabase.co';
process.env.SUPABASE_SERVICE_KEY = 'test-service-key';
process.env.NEXTAUTH_SECRET = 'test-secret';

// Import after mocks are set up
import { POST } from '@/app/api/analytics/track/route';

describe('Analytics Track API', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    
    // Default mock chain setup
    mockFrom.mockReturnValue({
      select: mockSelect,
      insert: mockInsert,
    });
    mockSelect.mockReturnValue({
      eq: mockEq,
    });
    mockEq.mockReturnValue({
      single: mockSingle,
    });
    mockSingle.mockResolvedValue({
      data: { partner_group_id: 'partner-1' },
      error: null,
    });
    mockInsert.mockResolvedValue({
      data: null,
      error: null,
    });
  });

  afterEach(() => {
    vi.unstubAllEnvs();
  });

  const createMockRequest = (body: any, headers?: Record<string, string>) => {
    return new NextRequest('http://localhost:3000/api/analytics/track', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        'x-forwarded-for': '192.168.1.1',
        'user-agent': 'Mozilla/5.0 Test',
        'referer': 'https://example.com/page',
        ...headers,
      },
    });
  };

  describe('Validation', () => {
    it('returns 400 when pageSlug is missing', async () => {
      const request = createMockRequest({
        type: 'pageview',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('pageSlug required');
    });

    it('returns 400 for event type without eventType', async () => {
      const request = createMockRequest({
        type: 'event',
        pageSlug: 'test-page',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(400);
      expect(data.error).toBe('eventType required');
    });
  });

  describe('Pageview Tracking', () => {
    it('inserts pageview into page_views table', async () => {
      const request = createMockRequest({
        type: 'pageview',
        pageSlug: 'test-page',
        viewMode: 'programs',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify page lookup
      expect(mockFrom).toHaveBeenCalledWith('discovery_pages');
      expect(mockSelect).toHaveBeenCalledWith('partner_group_id');
      expect(mockEq).toHaveBeenCalledWith('slug', 'test-page');
      
      // Verify insert
      expect(mockFrom).toHaveBeenCalledWith('page_views');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        page_slug: 'test-page',
        partner_group_id: 'partner-1',
        view_mode: 'programs',
      }));
    });

    it('includes schedule view in pageview', async () => {
      const request = createMockRequest({
        type: 'pageview',
        pageSlug: 'test-page',
        viewMode: 'schedule',
        scheduleView: 'list',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        view_mode: 'schedule',
        schedule_view: 'list',
      }));
    });

    it('truncates user agent to 500 characters', async () => {
      const longUserAgent = 'A'.repeat(600);
      const request = createMockRequest(
        { type: 'pageview', pageSlug: 'test-page' },
        { 'user-agent': longUserAgent }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        user_agent: expect.stringMatching(/^A{500}$/),
      }));
    });

    it('truncates referrer to 1000 characters', async () => {
      const longReferrer = 'https://example.com/' + 'a'.repeat(1000);
      const request = createMockRequest(
        { type: 'pageview', pageSlug: 'test-page' },
        { 'referer': longReferrer }
      );

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        referrer: expect.stringMatching(/^.{1000}$/),
      }));
    });
  });

  describe('Event Tracking', () => {
    it('inserts event into page_events table', async () => {
      const request = createMockRequest({
        type: 'event',
        pageSlug: 'test-page',
        eventType: 'click_register',
        eventData: { programId: '123', programName: 'Test Program' },
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(200);
      expect(data.success).toBe(true);
      
      // Verify insert
      expect(mockFrom).toHaveBeenCalledWith('page_events');
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        page_slug: 'test-page',
        partner_group_id: 'partner-1',
        event_type: 'click_register',
        event_data: { programId: '123', programName: 'Test Program' },
      }));
    });

    it('handles events without eventData', async () => {
      const request = createMockRequest({
        type: 'event',
        pageSlug: 'test-page',
        eventType: 'share_link',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        event_data: {},
      }));
    });

    it('tracks different event types', async () => {
      const eventTypes = ['click_register', 'share_link', 'view_mode_changed', 'filter_applied'];
      
      for (const eventType of eventTypes) {
        vi.clearAllMocks();
        mockFrom.mockReturnValue({
          select: mockSelect,
          insert: mockInsert,
        });
        mockSelect.mockReturnValue({ eq: mockEq });
        mockEq.mockReturnValue({ single: mockSingle });
        mockSingle.mockResolvedValue({ data: { partner_group_id: 'partner-1' }, error: null });
        mockInsert.mockResolvedValue({ data: null, error: null });

        const request = createMockRequest({
          type: 'event',
          pageSlug: 'test-page',
          eventType,
        });

        const response = await POST(request);
        expect(response.status).toBe(200);
        expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
          event_type: eventType,
        }));
      }
    });
  });

  describe('IP Hashing', () => {
    it('hashes IP address for privacy', async () => {
      const request = createMockRequest({
        type: 'pageview',
        pageSlug: 'test-page',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      // IP hash should be a 16-character hex string
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        ip_hash: expect.stringMatching(/^[a-f0-9]{16}$/),
      }));
    });

    it('produces consistent hash for same IP', async () => {
      // Make two requests with same IP
      const request1 = createMockRequest({
        type: 'pageview',
        pageSlug: 'test-page',
      });

      await POST(request1);
      const firstCall = mockInsert.mock.calls[0][0].ip_hash;

      vi.clearAllMocks();
      mockFrom.mockReturnValue({ select: mockSelect, insert: mockInsert });
      mockSelect.mockReturnValue({ eq: mockEq });
      mockEq.mockReturnValue({ single: mockSingle });
      mockSingle.mockResolvedValue({ data: { partner_group_id: 'partner-1' }, error: null });
      mockInsert.mockResolvedValue({ data: null, error: null });

      const request2 = createMockRequest({
        type: 'pageview',
        pageSlug: 'test-page',
      });

      await POST(request2);
      const secondCall = mockInsert.mock.calls[0][0].ip_hash;

      expect(firstCall).toBe(secondCall);
    });

    it('extracts IP from x-forwarded-for header', async () => {
      const request = createMockRequest(
        { type: 'pageview', pageSlug: 'test-page' },
        { 'x-forwarded-for': '10.0.0.1, 192.168.1.1' }
      );

      const response = await POST(request);

      // Should use first IP from x-forwarded-for
      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalled();
    });
  });

  describe('Partner Group Lookup', () => {
    it('looks up partner_group_id from page', async () => {
      mockSingle.mockResolvedValue({
        data: { partner_group_id: 'custom-partner' },
        error: null,
      });

      const request = createMockRequest({
        type: 'pageview',
        pageSlug: 'partner-page',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        partner_group_id: 'custom-partner',
      }));
    });

    it('handles page without partner_group_id', async () => {
      mockSingle.mockResolvedValue({
        data: { partner_group_id: null },
        error: null,
      });

      const request = createMockRequest({
        type: 'pageview',
        pageSlug: 'no-partner-page',
      });

      const response = await POST(request);

      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        partner_group_id: null,
      }));
    });

    it('handles non-existent page gracefully', async () => {
      mockSingle.mockResolvedValue({
        data: null,
        error: { message: 'Not found' },
      });

      const request = createMockRequest({
        type: 'pageview',
        pageSlug: 'unknown-page',
      });

      const response = await POST(request);

      // Should still succeed with null partner_group_id
      expect(response.status).toBe(200);
      expect(mockInsert).toHaveBeenCalledWith(expect.objectContaining({
        partner_group_id: null,
      }));
    });
  });

  describe('Error Handling', () => {
    it('returns 500 on database error for pageview', async () => {
      mockInsert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const request = createMockRequest({
        type: 'pageview',
        pageSlug: 'test-page',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to track');
    });

    it('returns 500 on database error for event', async () => {
      mockInsert.mockResolvedValue({
        data: null,
        error: { message: 'Database error' },
      });

      const request = createMockRequest({
        type: 'event',
        pageSlug: 'test-page',
        eventType: 'click_register',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Failed to track');
    });

    it('returns 500 on unexpected error', async () => {
      mockFrom.mockImplementation(() => {
        throw new Error('Unexpected error');
      });

      const request = createMockRequest({
        type: 'pageview',
        pageSlug: 'test-page',
      });

      const response = await POST(request);
      const data = await response.json();

      expect(response.status).toBe(500);
      expect(data.error).toBe('Internal error');
    });
  });
});
