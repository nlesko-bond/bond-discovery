import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { trackPageView, trackEvent, bondAnalytics } from '@/lib/analytics';

describe('Analytics Module', () => {
  const mockFetch = vi.fn();
  
  beforeEach(() => {
    global.fetch = mockFetch;
    mockFetch.mockResolvedValue({ ok: true });
  });
  
  afterEach(() => {
    vi.clearAllMocks();
  });

  describe('trackPageView', () => {
    it('sends pageview tracking request', async () => {
      await trackPageView({ pageSlug: 'test-page', viewMode: 'programs' });
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/track',
        expect.objectContaining({
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: expect.stringContaining('"type":"pageview"'),
        })
      );
    });

    it('includes pageSlug in request', async () => {
      await trackPageView({ pageSlug: 'my-discovery-page' });
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.pageSlug).toBe('my-discovery-page');
    });

    it('includes viewMode and scheduleView', async () => {
      await trackPageView({ 
        pageSlug: 'test', 
        viewMode: 'schedule',
        scheduleView: 'list' 
      });
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.viewMode).toBe('schedule');
      expect(body.scheduleView).toBe('list');
    });

    it('handles fetch errors silently', async () => {
      mockFetch.mockRejectedValue(new Error('Network error'));
      
      // Should not throw
      await expect(trackPageView({ pageSlug: 'test' })).resolves.toBeUndefined();
    });
  });

  describe('trackEvent', () => {
    it('sends event tracking request', async () => {
      await trackEvent({ 
        pageSlug: 'test-page', 
        eventType: 'click_register' 
      });
      
      expect(mockFetch).toHaveBeenCalledWith(
        '/api/analytics/track',
        expect.objectContaining({
          method: 'POST',
          body: expect.stringContaining('"type":"event"'),
        })
      );
    });

    it('includes eventType and eventData', async () => {
      await trackEvent({ 
        pageSlug: 'test', 
        eventType: 'click_register',
        eventData: { programId: '123', programName: 'Soccer Camp' }
      });
      
      const body = JSON.parse(mockFetch.mock.calls[0][1].body);
      expect(body.eventType).toBe('click_register');
      expect(body.eventData.programId).toBe('123');
      expect(body.eventData.programName).toBe('Soccer Camp');
    });
  });

  describe('bondAnalytics convenience methods', () => {
    describe('clickRegister', () => {
      it('tracks register click with program data', async () => {
        await bondAnalytics.clickRegister('test-page', {
          programId: 'prog-123',
          programName: 'Youth Soccer',
          sessionId: 'sess-456',
          sessionName: 'Spring 2026',
        });
        
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.eventType).toBe('click_register');
        expect(body.eventData.programId).toBe('prog-123');
        expect(body.eventData.sessionId).toBe('sess-456');
      });
    });

    describe('shareLink', () => {
      it('tracks share link with URL', async () => {
        await bondAnalytics.shareLink('test-page', 'https://example.com/share');
        
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.eventType).toBe('share_link');
        expect(body.eventData.shared_url).toBe('https://example.com/share');
      });
    });

    describe('viewModeChanged', () => {
      it('tracks view mode changes', async () => {
        await bondAnalytics.viewModeChanged('test-page', 'programs', 'schedule');
        
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.eventType).toBe('view_mode_changed');
        expect(body.eventData.from_view).toBe('programs');
        expect(body.eventData.to_view).toBe('schedule');
      });
    });

    describe('filterApplied', () => {
      it('tracks filter applied with string value', async () => {
        await bondAnalytics.filterApplied('test-page', 'facility', 'Main Arena');
        
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.eventType).toBe('filter_applied');
        expect(body.eventData.filter_type).toBe('facility');
        expect(body.eventData.filter_value).toBe('Main Arena');
      });

      it('tracks filter applied with array value', async () => {
        await bondAnalytics.filterApplied('test-page', 'sports', ['soccer', 'basketball']);
        
        const body = JSON.parse(mockFetch.mock.calls[0][1].body);
        expect(body.eventData.filter_value).toBe('soccer,basketball');
      });
    });
  });
});
