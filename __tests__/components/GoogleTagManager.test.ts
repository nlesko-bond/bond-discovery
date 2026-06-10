import { describe, it, expect, beforeEach } from 'vitest';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';

describe('GTM Event Tracking', () => {
  beforeEach(() => {
    // Reset dataLayer before each test
    window.dataLayer = [];
  });

  describe('gtmEvent.push', () => {
    it('pushes event to dataLayer', () => {
      gtmEvent.push('test_event', { key: 'value' });

      expect(window.dataLayer).toContainEqual({
        event: 'test_event',
        key: 'value',
      });
    });

    it('handles events without data', () => {
      gtmEvent.push('simple_event');

      expect(window.dataLayer).toContainEqual({
        event: 'simple_event',
      });
    });
  });

  describe('gtmEvent.pageView', () => {
    it('pushes page_view event with location context', () => {
      gtmEvent.pageView('/programs', 'Programs List');

      expect(window.dataLayer).toContainEqual({
        event: 'page_view',
        page_path: '/programs',
        page_title: 'Programs List',
        page_location: window.location.href,
        page_referrer: document.referrer,
      });
    });
  });

  describe('gtmEvent.clickRegister', () => {
    it('pushes click_register event with full data', () => {
      gtmEvent.clickRegister({
        programId: 'prog-123',
        programName: 'Youth Soccer',
        sessionId: 'sess-456',
        sessionName: 'Spring 2026',
        productId: 'prod-789',
        price: 299,
        currency: 'USD',
      });

      expect(window.dataLayer).toContainEqual({
        event: 'click_register',
        program_id: 'prog-123',
        program_name: 'Youth Soccer',
        session_id: 'sess-456',
        session_name: 'Spring 2026',
        product_id: 'prod-789',
        price: 299,
        currency: 'USD',
      });
    });

    it('defaults currency to USD', () => {
      gtmEvent.clickRegister({
        programId: 'prog-123',
        programName: 'Test',
      });

      expect(window.dataLayer[0].currency).toBe('USD');
    });
  });

  describe('gtmEvent.clickRedeemPass', () => {
    it('pushes click_redeem_pass event', () => {
      gtmEvent.clickRedeemPass({
        eventId: 'evt-123',
        programId: 'prog-456',
        programName: 'Youth Soccer',
        sessionId: 'sess-789',
        sessionName: 'Spring 2026',
      });

      expect(window.dataLayer).toContainEqual({
        event: 'click_redeem_pass',
        event_id: 'evt-123',
        program_id: 'prog-456',
        program_name: 'Youth Soccer',
        session_id: 'sess-789',
        session_name: 'Spring 2026',
      });
    });
  });

  describe('minimal partner GTM contract', () => {
    it('exposes exactly push, pageView, clickRegister, clickRedeemPass', () => {
      expect(Object.keys(gtmEvent).sort()).toEqual([
        'clickRedeemPass',
        'clickRegister',
        'pageView',
        'push',
      ]);
    });

    it('no longer exposes the removed noise-event helpers', () => {
      const removed = [
        'viewProgram',
        'viewSession',
        'filterApplied',
        'viewModeChanged',
        'scheduleViewChanged',
        'shareLink',
        'clickEvent',
      ];
      for (const helper of removed) {
        expect((gtmEvent as Record<string, unknown>)[helper]).toBeUndefined();
      }
    });
  });
});
