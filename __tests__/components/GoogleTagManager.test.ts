import { describe, it, expect, beforeEach, vi } from 'vitest';
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
    it('pushes page_view event', () => {
      gtmEvent.pageView('/programs', 'Programs List');
      
      expect(window.dataLayer).toContainEqual({
        event: 'page_view',
        page_path: '/programs',
        page_title: 'Programs List',
      });
    });
  });

  describe('gtmEvent.viewProgram', () => {
    it('pushes view_program event with all data', () => {
      gtmEvent.viewProgram({
        id: 'prog-123',
        name: 'Youth Soccer',
        type: 'camp',
        sport: 'soccer',
      });
      
      expect(window.dataLayer).toContainEqual({
        event: 'view_program',
        program_id: 'prog-123',
        program_name: 'Youth Soccer',
        program_type: 'camp',
        sport: 'soccer',
      });
    });
  });

  describe('gtmEvent.viewSession', () => {
    it('pushes view_session event', () => {
      gtmEvent.viewSession({
        id: 'sess-456',
        name: 'Spring 2026',
        programId: 'prog-123',
        programName: 'Youth Soccer',
      });
      
      expect(window.dataLayer).toContainEqual({
        event: 'view_session',
        session_id: 'sess-456',
        session_name: 'Spring 2026',
        program_id: 'prog-123',
        program_name: 'Youth Soccer',
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

  describe('gtmEvent.filterApplied', () => {
    it('pushes filter_applied event with string value', () => {
      gtmEvent.filterApplied('facility', 'Main Arena');
      
      expect(window.dataLayer).toContainEqual({
        event: 'filter_applied',
        filter_type: 'facility',
        filter_value: 'Main Arena',
      });
    });

    it('joins array values with comma', () => {
      gtmEvent.filterApplied('sports', ['soccer', 'basketball']);
      
      expect(window.dataLayer).toContainEqual({
        event: 'filter_applied',
        filter_type: 'sports',
        filter_value: 'soccer,basketball',
      });
    });
  });

  describe('gtmEvent.viewModeChanged', () => {
    it('pushes view_mode_changed event', () => {
      gtmEvent.viewModeChanged('programs', 'schedule');
      
      expect(window.dataLayer).toContainEqual({
        event: 'view_mode_changed',
        from_view: 'programs',
        to_view: 'schedule',
      });
    });
  });

  describe('gtmEvent.scheduleViewChanged', () => {
    it('pushes schedule_view_changed event', () => {
      gtmEvent.scheduleViewChanged('list');
      
      expect(window.dataLayer).toContainEqual({
        event: 'schedule_view_changed',
        view_type: 'list',
      });
    });
  });

  describe('gtmEvent.shareLink', () => {
    it('pushes share_link event', () => {
      gtmEvent.shareLink('my-page', 'https://example.com/shared');
      
      expect(window.dataLayer).toContainEqual({
        event: 'share_link',
        page_slug: 'my-page',
        shared_url: 'https://example.com/shared',
      });
    });
  });

  describe('gtmEvent.clickEvent', () => {
    it('pushes click_event event', () => {
      gtmEvent.clickEvent({
        id: 'evt-123',
        title: 'Soccer Practice',
        programId: 'prog-456',
        programName: 'Youth Soccer',
        sessionId: 'sess-789',
      });
      
      expect(window.dataLayer).toContainEqual({
        event: 'click_event',
        event_id: 'evt-123',
        event_title: 'Soccer Practice',
        program_id: 'prog-456',
        program_name: 'Youth Soccer',
        session_id: 'sess-789',
      });
    });
  });
});
