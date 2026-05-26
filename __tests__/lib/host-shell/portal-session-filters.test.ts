import { describe, expect, it } from 'vitest';
import { filterProgramsForPortalSessions } from '@/lib/host-shell/portal-session-filters';
import type { Program } from '@/types';

describe('filterProgramsForPortalSessions', () => {
  it('matches facility filters when program facility IDs are numeric', () => {
    const programs: Program[] = [
      {
        id: 'program-1',
        name: 'Soccer Classes',
        facilityId: 639,
        facilityName: 'Sports Center',
        sessions: [
          {
            id: 'session-1',
            name: 'Morning',
          },
        ],
      } as unknown as Program,
      {
        id: 'program-2',
        name: 'Basketball Classes',
        facilityId: 645,
        facilityName: 'Du Burns Arena',
        sessions: [
          {
            id: 'session-2',
            name: 'Afternoon',
          },
        ],
      } as unknown as Program,
    ];

    const result = filterProgramsForPortalSessions(programs, {
      facilityIds: ['639'],
    });

    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('program-1');
    expect(result[0].sessions).toHaveLength(1);
  });
});
