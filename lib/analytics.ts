/**
 * Bond Discovery Analytics Client
 * Tracks page views and events to Bond's internal analytics
 */

const TRACK_ENDPOINT = '/api/analytics/track';

interface TrackPageViewOptions {
  pageSlug: string;
  viewMode?: string;
  scheduleView?: string;
}

interface TrackEventOptions {
  pageSlug: string;
  eventType: string;
  eventData?: Record<string, any>;
}

// Debounce tracker to avoid duplicate calls
const trackedViews = new Set<string>();

/**
 * Track a page view
 */
export async function trackPageView(options: TrackPageViewOptions): Promise<void> {
  const { pageSlug, viewMode, scheduleView } = options;
  
  // Create unique key for this page view (debounce within session)
  const key = `${pageSlug}-${Date.now().toString().slice(0, -4)}`; // Debounce per 10 seconds
  if (trackedViews.has(key)) return;
  trackedViews.add(key);
  
  try {
    await fetch(TRACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'pageview',
        pageSlug,
        viewMode,
        scheduleView,
      }),
    });
  } catch (error) {
    // Silently fail - analytics shouldn't break the app
    console.debug('Analytics tracking failed:', error);
  }
}

/**
 * Track an event
 */
export async function trackEvent(options: TrackEventOptions): Promise<void> {
  const { pageSlug, eventType, eventData } = options;
  
  try {
    await fetch(TRACK_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'event',
        pageSlug,
        eventType,
        eventData,
      }),
    });
  } catch (error) {
    console.debug('Analytics event tracking failed:', error);
  }
}

/**
 * Convenience methods for common events
 */
export const bondAnalytics = {
  pageView: trackPageView,
  event: trackEvent,
  
  clickRegister: (pageSlug: string, data: {
    programId: string;
    programName: string;
    sessionId?: string;
    sessionName?: string;
    productId?: string;
  }) => trackEvent({
    pageSlug,
    eventType: 'click_register',
    eventData: data,
  }),
  
  shareLink: (pageSlug: string, sharedUrl: string) => trackEvent({
    pageSlug,
    eventType: 'share_link',
    eventData: { shared_url: sharedUrl },
  }),
  
  viewModeChanged: (pageSlug: string, fromView: string, toView: string) => trackEvent({
    pageSlug,
    eventType: 'view_mode_changed',
    eventData: { from_view: fromView, to_view: toView },
  }),
  
  filterApplied: (pageSlug: string, filterType: string, filterValue: string | string[]) => trackEvent({
    pageSlug,
    eventType: 'filter_applied',
    eventData: { 
      filter_type: filterType, 
      filter_value: Array.isArray(filterValue) ? filterValue.join(',') : filterValue 
    },
  }),
};
