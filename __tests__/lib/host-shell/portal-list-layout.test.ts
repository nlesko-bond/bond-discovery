import { describe, expect, it } from 'vitest';
import { derivePortalEventHorizonMonths, derivePortalAgeBounds } from '@/lib/host-shell/portal-list-layout';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';

function makeCard(endDate: string): IHostPortalSessionCardModel {
  return {
    sessionId: '1',
    programId: '1',
    programName: 'Program',
    name: 'Session',
    isClosed: false,
    isRegistrationOpen: true,
    hasMultipleRegisterOptions: false,
    isSegmented: false,
    endDate,
    segments: [],
    products: [],
  };
}

describe('derivePortalEventHorizonMonths', () => {
  it('extends horizon when sessions end beyond the default window', () => {
    const horizon = derivePortalEventHorizonMonths([
      makeCard('2026-11-07T00:00:00.000Z'),
    ]);
    expect(horizon).toBeGreaterThan(3);
  });

  it('falls back to the minimum horizon when cards have no end dates', () => {
    expect(derivePortalEventHorizonMonths([makeCard('')])).toBe(3);
  });
});

describe('derivePortalAgeBounds', () => {
  it('uses slider min 0 and numeric ageMax from cards', () => {
    const bounds = derivePortalAgeBounds([
      {
        ...makeCard('2026-11-07T00:00:00.000Z'),
        ageMin: 1.5,
        ageMax: 16,
        ageRange: '18 mo - 16 yrs',
      },
    ]);
    expect(bounds).toEqual({ min: 0, max: 16 });
  });

  it('defaults to 0–18 when cards have no age data', () => {
    expect(derivePortalAgeBounds([makeCard('2026-11-07T00:00:00.000Z')])).toEqual({
      min: 0,
      max: 18,
    });
  });
});
