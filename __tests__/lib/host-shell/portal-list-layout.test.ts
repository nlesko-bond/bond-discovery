import { describe, expect, it } from 'vitest';
import { derivePortalEventHorizonMonths } from '@/lib/host-shell/portal-list-layout';
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
