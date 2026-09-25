import { describe, it, expect, vi, afterEach } from 'vitest';
import { act, render, screen } from '@testing-library/react';
import TvMonitorScreen from '@/components/tvmonitor/TvMonitorScreen';
import { normalizeTvMonitorConfig } from '@/lib/tvmonitor-config';
import type { TvMonitorSchedulePayload } from '@/types/tvmonitor';

const SCHEDULE: TvMonitorSchedulePayload = {
  facilityId: 636,
  facilityName: 'Utah Mammoth Ice Center',
  fetchedAt: '',
  spaces: [
    {
      id: 7245,
      name: 'North Rink',
      slots: [
        {
          slotId: 1,
          parentSlotId: null,
          reservationId: 1,
          reservationName: 'Aviators vs Baja',
          date: '2026-09-24',
          endDate: '2026-09-24',
          startTime: '20:30:00',
          endTime: '21:30:00',
          notes: 'LR 2 Aviators\nLR 6 Baja',
          spaceId: 7245,
          slotType: 'internal',
          isPrivate: false,
        },
        {
          slotId: 2,
          parentSlotId: null,
          reservationId: 2,
          reservationName: 'Stick & Puck',
          date: '2026-09-24',
          endDate: '2026-09-24',
          startTime: '19:00:00',
          endTime: '20:00:00',
          notes: 'Under 18 LR 5',
          spaceId: 7245,
          slotType: 'internal',
          isPrivate: false,
        },
      ],
    },
  ],
};

describe('TvMonitorScreen dayboard view', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  it('renders the day board sections once the client clock is known', () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-24T19:05:00'));
    const config = normalizeTvMonitorConfig({
      schedule: {
        viewMode: 'dayboard',
        resourceIds: [7245],
        dayboard: { primaryTitle: 'Rink schedule', gamesTitle: 'Adult League' },
      },
    });
    render(<TvMonitorScreen config={config} schedule={SCHEDULE} previewMode />);
    act(() => {
      vi.advanceTimersByTime(1000);
    });

    expect(screen.getByText('Rink schedule')).toBeTruthy();
    expect(screen.getByText('Adult League')).toBeTruthy();
    expect(screen.getByText('Stick & Puck')).toBeTruthy();
    expect(screen.getByText('Aviators')).toBeTruthy();
    expect(screen.getByText('NOW')).toBeTruthy();
    expect(screen.getByText('Thursday · Sep 24')).toBeTruthy();
  });
});
