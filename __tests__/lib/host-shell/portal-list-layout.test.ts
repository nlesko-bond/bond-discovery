import { describe, expect, it } from 'vitest';
import {
  derivePortalEventHorizonMonths,
  derivePortalAgeBounds,
  orderPortalSessionCards,
  sortPortalSessionCards,
} from '@/lib/host-shell/portal-list-layout';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import { PortalSessionSortEnum } from '@/types';
import type { DiscoveryConfig } from '@/types';

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

function makeAgeCard(
  sessionId: string,
  ageMin: number | undefined,
  startDate = '2026-01-01T00:00:00.000Z',
): IHostPortalSessionCardModel {
  return {
    ...makeCard('2026-12-31T00:00:00.000Z'),
    sessionId,
    name: `Session ${sessionId}`,
    ageMin,
    startDate,
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

describe('sortPortalSessionCards — MIN_AGE', () => {
  it('sorts by minimum age ascending, undefined ages last', () => {
    const cards = [
      makeAgeCard('a', 12),
      makeAgeCard('b', undefined),
      makeAgeCard('c', 4),
      makeAgeCard('d', 8),
    ];
    const sorted = sortPortalSessionCards(cards, PortalSessionSortEnum.MIN_AGE);
    expect(sorted.map((card) => card.sessionId)).toEqual(['c', 'd', 'a', 'b']);
  });

  it('breaks ties on equal age by start date', () => {
    const cards = [
      makeAgeCard('later', 6, '2026-03-01T00:00:00.000Z'),
      makeAgeCard('earlier', 6, '2026-01-01T00:00:00.000Z'),
    ];
    const sorted = sortPortalSessionCards(cards, PortalSessionSortEnum.MIN_AGE);
    expect(sorted.map((card) => card.sessionId)).toEqual(['earlier', 'later']);
  });

  it('does not mutate the input array', () => {
    const cards = [makeAgeCard('a', 12), makeAgeCard('c', 4)];
    const original = [...cards];
    sortPortalSessionCards(cards, PortalSessionSortEnum.MIN_AGE);
    expect(cards).toEqual(original);
  });
});

describe('orderPortalSessionCards', () => {
  const cards = [makeAgeCard('a', 12), makeAgeCard('c', 4), makeAgeCard('d', 8)];

  function configWithSort(sort?: PortalSessionSortEnum): DiscoveryConfig {
    return { features: { ...(sort ? { portalSessionSort: sort } : {}) } } as DiscoveryConfig;
  }

  it('preserves source order when no sort is configured', () => {
    const ordered = orderPortalSessionCards(cards, configWithSort());
    expect(ordered.map((card) => card.sessionId)).toEqual(['a', 'c', 'd']);
  });

  it('applies min-age ordering when configured', () => {
    const ordered = orderPortalSessionCards(cards, configWithSort(PortalSessionSortEnum.MIN_AGE));
    expect(ordered.map((card) => card.sessionId)).toEqual(['c', 'd', 'a']);
  });
});
