import { describe, it, expect } from 'vitest';
import {
  buildReservationScheduleRows,
  MaintenanceDisplayModeEnum,
} from '@/lib/reservation-schedule-transform';

const SCHEDULE_TEST_CONTEXT = { reservationId: 1, reservationName: 'Test reservation' };

describe('buildReservationScheduleRows — space names', () => {
  it('reads name from nested space object with spaceId on slot', () => {
    const reservation = {
      segments: [
        {
          slots: [
            {
              id: 10,
              spaceId: 7689,
              space: { id: 7689, name: 'West Rink' },
              startDate: '2025-06-01',
              startTime: '10:00:00',
              endTime: '11:00:00',
              slotType: 'external',
              title: 'Ice',
              approvalStatus: 'approved',
            },
          ],
        },
      ],
    };
    const rows = buildReservationScheduleRows(
      reservation,
      {},
      MaintenanceDisplayModeEnum.HIDE,
      SCHEDULE_TEST_CONTEXT,
    );
    expect(rows).toHaveLength(1);
    expect(rows[0]?.spaceName).toBe('West Rink');
  });

  it('collects slots when id is a numeric string', () => {
    const reservation = {
      segments: [
        {
          slots: [
            {
              id: '20',
              spaceId: 1,
              space: { id: 1, name: 'Court A' },
              startDate: '2025-06-01',
              startTime: '09:00:00',
              endTime: '10:00:00',
              slotType: 'external',
              approvalStatus: 'Approved',
            },
          ],
        },
      ],
    };
    const rows = buildReservationScheduleRows(
      reservation,
      {},
      MaintenanceDisplayModeEnum.HIDE,
      SCHEDULE_TEST_CONTEXT,
    );
    expect(rows.length).toBeGreaterThanOrEqual(1);
    expect(rows.some((r) => r.spaceName === 'Court A')).toBe(true);
  });

  it('enriches space name from another slot with the same spaceId', () => {
    const reservation = {
      segments: [
        {
          slots: [
            {
              id: 1,
              spaceId: 99,
              space: { id: 99, name: 'Shared Arena' },
              startDate: '2025-06-01',
              startTime: '08:00:00',
              endTime: '09:00:00',
              slotType: 'external',
              approvalStatus: 'approved',
            },
            {
              id: 2,
              spaceId: 99,
              startDate: '2025-06-02',
              startTime: '08:00:00',
              endTime: '09:00:00',
              slotType: 'external',
              approvalStatus: 'approved',
            },
          ],
        },
      ],
    };
    const rows = buildReservationScheduleRows(
      reservation,
      { 99: 'Space 99' },
      MaintenanceDisplayModeEnum.HIDE,
      SCHEDULE_TEST_CONTEXT,
    );
    const june2 = rows.find((r) => r.date === '2025-06-02');
    expect(june2?.spaceName).toBe('Shared Arena');
  });

  it('reads nested Space object with PascalCase Id and Name', () => {
    const reservation = {
      segments: [
        {
          slots: [
            {
              id: 3,
              SpaceId: 500,
              Space: { Id: 500, Name: 'North Field' },
              startDate: '2025-06-03',
              startTime: '12:00:00',
              endTime: '13:00:00',
              SlotType: 'external',
              ApprovalStatus: 'approved',
            },
          ],
        },
      ],
    };
    const rows = buildReservationScheduleRows(
      reservation,
      {},
      MaintenanceDisplayModeEnum.HIDE,
      SCHEDULE_TEST_CONTEXT,
    );
    expect(rows[0]?.spaceName).toBe('North Field');
  });

  it('reads space id from embedded object when spaceId is omitted on slot', () => {
    const reservation = {
      segments: [
        {
          slots: [
            {
              id: 40,
              space: { id: 7689, name: 'West Rink' },
              startDate: '2025-06-04',
              startTime: '14:00:00',
              endTime: '15:00:00',
              slotType: 'external',
              approvalStatus: 'approved',
            },
          ],
        },
      ],
    };
    const rows = buildReservationScheduleRows(
      reservation,
      { 7689: 'Space 7689' },
      MaintenanceDisplayModeEnum.HIDE,
      SCHEDULE_TEST_CONTEXT,
    );
    expect(rows[0]?.spaceName).toBe('West Rink');
  });
});
