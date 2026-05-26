import { describe, expect, it } from 'vitest';
import { buildPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import type { Program } from '@/types';

describe('buildPortalFilterOptions', () => {
  it('counts facilities per session using session.facility', () => {
    const programs: Program[] = [
      {
        id: '14268',
        name: 'Soccer Classes',
        facilityId: '639',
        facilityName: 'Sports Center',
        sport: 'soccer',
        sessions: [
          {
            id: '118780',
            name: 'Session A',
            facility: { id: 639, name: 'Sports Center' },
          },
          {
            id: '118797',
            name: 'Session B',
            facility: { id: 645, name: 'Du Burns Arena' },
          },
          {
            id: '118774',
            name: 'Session C',
            facility: { id: 639, name: 'Sports Center' },
          },
        ],
      } as Program,
    ];

    const options = buildPortalFilterOptions(programs);
    const sportsCenter = options.facilities.find((facility) => facility.name === 'Sports Center');
    const duBurns = options.facilities.find((facility) => facility.name === 'Du Burns Arena');

    expect(sportsCenter?.count).toBe(2);
    expect(duBurns?.count).toBe(1);
    expect(options.hasMultipleFacilities).toBe(true);
  });

  it('normalizes numeric program facility IDs for dropdown options', () => {
    const programs: Program[] = [
      {
        id: '14268',
        name: 'Soccer Classes',
        facilityId: 639,
        facilityName: 'Sports Center',
        sport: 'soccer',
        sessions: [
          {
            id: '118780',
            name: 'Session A',
          },
        ],
      } as unknown as Program,
    ];

    const options = buildPortalFilterOptions(programs);

    expect(options.facilities[0].id).toBe('639');
    expect(options.facilities[0].name).toBe('Sports Center');
  });
});
