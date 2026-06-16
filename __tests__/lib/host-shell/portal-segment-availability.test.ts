import { describe, expect, it } from 'vitest';
import { resolvePortalSegmentAvailability } from '@/lib/host-shell/portal-segment-availability';

describe('resolvePortalSegmentAvailability', () => {
  it('returns closed when registration window is closed', () => {
    expect(
      resolvePortalSegmentAvailability({
        registrationWindowStatus: 'closed',
        spotsRemaining: 10,
      }),
    ).toEqual({ kind: 'closed', label: 'Closed' });
  });

  it('returns coming soon when registration has not opened', () => {
    expect(
      resolvePortalSegmentAvailability({
        registrationWindowStatus: 'not_opened_yet',
      }),
    ).toEqual({ kind: 'coming_soon', label: 'Coming soon' });
  });

  it('returns waitlist when full and waitlist is enabled', () => {
    expect(
      resolvePortalSegmentAvailability({
        spotsRemaining: 0,
        isWaitlistEnabled: true,
        registrationWindowStatus: 'open',
      }),
    ).toEqual({ kind: 'waitlist', label: 'Waitlist' });
  });

  it('returns full when no spots remain and waitlist is disabled', () => {
    expect(
      resolvePortalSegmentAvailability({
        spotsRemaining: 0,
        isWaitlistEnabled: false,
        registrationWindowStatus: 'open',
      }),
    ).toEqual({ kind: 'full', label: 'Full' });
  });

  it('returns almost full when spots are at or below threshold', () => {
    expect(
      resolvePortalSegmentAvailability({
        spotsRemaining: 3,
        registrationWindowStatus: 'open',
      }),
    ).toEqual({ kind: 'almost_full', label: '3 spots left' });
  });

  it('returns open when plenty of spots remain', () => {
    expect(
      resolvePortalSegmentAvailability({
        spotsRemaining: 12,
        registrationWindowStatus: 'open',
      }),
    ).toEqual({ kind: 'open', label: 'Open' });
  });

  it('derives spots from max and current participants', () => {
    expect(
      resolvePortalSegmentAvailability({
        maxParticipants: 10,
        currentParticipants: 10,
        registrationWindowStatus: 'open',
      }),
    ).toEqual({ kind: 'full', label: 'Full' });
  });
});
