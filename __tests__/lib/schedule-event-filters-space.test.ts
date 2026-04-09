import { describe, it, expect } from 'vitest';
import { eventMatchesSpaceNames } from '@/lib/schedule-event-filters';

describe('eventMatchesSpaceNames', () => {
  it('allows all when no filter', () => {
    expect(eventMatchesSpaceNames({ spaceName: 'Court A' }, undefined)).toBe(true);
    expect(eventMatchesSpaceNames({ spaceName: 'Court A' }, [])).toBe(true);
  });

  it('matches exact trimmed space name', () => {
    expect(
      eventMatchesSpaceNames({ spaceName: 'Court A' }, ['Court A', 'Court B']),
    ).toBe(true);
    expect(eventMatchesSpaceNames({ spaceName: 'Court B' }, ['Court A'])).toBe(
      false,
    );
  });

  it('rejects empty event space when filter is active', () => {
    expect(eventMatchesSpaceNames({}, ['Court A'])).toBe(false);
    expect(eventMatchesSpaceNames({ spaceName: '' }, ['Court A'])).toBe(false);
  });
});
