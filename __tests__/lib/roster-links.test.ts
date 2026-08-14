import { describe, expect, it } from 'vitest';
import { getRostersUrlForEvent } from '@/lib/schedule-standings';
import type { CalendarEvent, DiscoveryConfig } from '@/types';

const event = (over: Partial<CalendarEvent> = {}): CalendarEvent =>
  ({ id: '1', type: 'league', sessionId: '127956', ...over }) as CalendarEvent;

const config = (features: Record<string, unknown> = {}): DiscoveryConfig =>
  ({ features: { showRostersLink: true, rostersPageSlug: 'coppermine', ...features } }) as unknown as DiscoveryConfig;

describe('getRostersUrlForEvent', () => {
  it('deep-links to the session when opted in', () => {
    expect(getRostersUrlForEvent(event(), config())).toBe('/rosters/coppermine?session=127956');
  });

  it('falls back to the page root when the event has no session', () => {
    expect(getRostersUrlForEvent(event({ sessionId: undefined }), config())).toBe('/rosters/coppermine');
  });

  it('returns nothing unless the feature is explicitly on', () => {
    expect(getRostersUrlForEvent(event(), config({ showRostersLink: undefined }))).toBeUndefined();
    expect(getRostersUrlForEvent(event(), config({ showRostersLink: false }))).toBeUndefined();
    // Truthy-but-not-true must not enable it.
    expect(getRostersUrlForEvent(event(), config({ showRostersLink: 'yes' }))).toBeUndefined();
  });

  it('returns nothing without a roster page slug', () => {
    expect(getRostersUrlForEvent(event(), config({ rostersPageSlug: undefined }))).toBeUndefined();
    expect(getRostersUrlForEvent(event(), config({ rostersPageSlug: '   ' }))).toBeUndefined();
  });

  it('only applies to league programs', () => {
    expect(getRostersUrlForEvent(event({ type: 'class' }), config())).toBeUndefined();
  });

  it('honours programType over the legacy type field', () => {
    const e = event({ type: 'class', programType: 'league' } as Partial<CalendarEvent>);
    expect(getRostersUrlForEvent(e, config())).toBe('/rosters/coppermine?session=127956');
  });
});
