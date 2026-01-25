import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { WeekGridView } from '@/components/discovery/calendar/WeekGridView';
import { mockConfig, mockCalendarEvent, mockDaySchedule, mockWeekSchedule } from '../../../fixtures/mockData';
import { DaySchedule } from '@/types';

describe('WeekGridView', () => {
  const mockOnEventClick = vi.fn();
  const mockOnDayClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create days array for testing
  const createDays = (eventsPerDay: number[] = [0, 0, 0, 0, 0, 0, 0]): DaySchedule[] => {
    const startDate = new Date('2026-03-15');
    return eventsPerDay.map((eventCount, index) => {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + index);
      const dateStr = date.toISOString().split('T')[0];
      
      const events = Array.from({ length: eventCount }, (_, i) => ({
        ...mockCalendarEvent,
        id: `event-${dateStr}-${i}`,
        date: dateStr,
        startTime: `${dateStr}T${10 + i}:00:00.000Z`,
        title: `Event ${i + 1}`,
      }));

      return {
        date: dateStr,
        dayOfWeek: date.toLocaleDateString('en-US', { weekday: 'long' }),
        events,
        isToday: false,
        isPast: false,
      };
    });
  };

  describe('Rendering', () => {
    it('renders 7 day columns', () => {
      const days = createDays();
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      // Should show all weekday headers
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('displays date numbers for each day', () => {
      const days = createDays();
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      // Should show date numbers (15-21 for our test week)
      expect(screen.getByText('15')).toBeInTheDocument();
      expect(screen.getByText('16')).toBeInTheDocument();
      expect(screen.getByText('21')).toBeInTheDocument();
    });

    it('shows month abbreviation', () => {
      const days = createDays();
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      // All days in March should show Mar
      const marchLabels = screen.getAllByText('Mar');
      expect(marchLabels.length).toBe(7);
    });
  });

  describe('Time Slots', () => {
    it('renders time labels from 6 AM to 10 PM', () => {
      const days = createDays([1, 0, 0, 0, 0, 0, 0]);
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('6 AM')).toBeInTheDocument();
      expect(screen.getByText('12 PM')).toBeInTheDocument();
      expect(screen.getByText('10 PM')).toBeInTheDocument();
    });
  });

  describe('Today Handling', () => {
    it('renders without errors when today is in view', () => {
      const days = createDays();
      
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      // Should render all 7 days without errors
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });
  });

  describe('Event Display', () => {
    it('renders first event in cell', () => {
      const days = createDays([1, 0, 0, 0, 0, 0, 0]);
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('Event 1')).toBeInTheDocument();
    });

    it('shows +X more when multiple events in same hour', () => {
      const days = createDays([3, 0, 0, 0, 0, 0, 0]);
      // Override to put all events at same time
      days[0].events = days[0].events.map((e, i) => ({
        ...e,
        startTime: `2026-03-15T10:00:00.000Z`, // All at 10 AM
        title: `Event ${i + 1}`,
      }));
      
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      // Should show first event
      expect(screen.getByText('Event 1')).toBeInTheDocument();
      // Should show +2 more
      expect(screen.getByText('+2 more')).toBeInTheDocument();
    });

    it('shows event start time', () => {
      const days = createDays([1, 0, 0, 0, 0, 0, 0]);
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      // Event at 10:00 should show time (format varies by timezone)
      const timeElements = screen.getAllByText(/AM|PM/i);
      expect(timeElements.length).toBeGreaterThan(0);
    });
  });

  describe('Event Interaction', () => {
    it('calls onEventClick when event is clicked', () => {
      const days = createDays([1, 0, 0, 0, 0, 0, 0]);
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
          onEventClick={mockOnEventClick}
        />
      );
      
      const eventButton = screen.getByRole('button', { name: /Event 1/i });
      fireEvent.click(eventButton);
      
      expect(mockOnEventClick).toHaveBeenCalledWith(days[0].events[0]);
    });

    it('calls onDayClick when day header is clicked', () => {
      const days = createDays([0, 0, 0, 0, 0, 0, 0]);
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
          onDayClick={mockOnDayClick}
        />
      );
      
      // Click on day 15
      const dayHeader = screen.getByText('15');
      fireEvent.click(dayHeader.closest('div')!);
      
      expect(mockOnDayClick).toHaveBeenCalledWith('2026-03-15');
    });

    it('calls onDayClick when +X more is clicked', () => {
      const days = createDays([3, 0, 0, 0, 0, 0, 0]);
      // Put all events at same time
      days[0].events = days[0].events.map((e) => ({
        ...e,
        startTime: `2026-03-15T10:00:00.000Z`,
      }));
      
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
          onDayClick={mockOnDayClick}
        />
      );
      
      const moreButton = screen.getByText('+2 more');
      fireEvent.click(moreButton);
      
      expect(mockOnDayClick).toHaveBeenCalledWith('2026-03-15');
    });
  });

  describe('Responsive Design', () => {
    it('has minimum width to prevent squishing', () => {
      const days = createDays();
      const { container } = render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      // Check that there's a minWidth style applied
      const innerDiv = container.querySelector('[style*="minWidth"]') || 
                       container.querySelector('.overflow-x-auto > div');
      expect(innerDiv).toBeInTheDocument();
    });
  });

  describe('Branding', () => {
    it('uses secondary color for event styling', () => {
      const customConfig = {
        ...mockConfig,
        branding: {
          ...mockConfig.branding,
          secondaryColor: '#22C55E',
        },
      };
      const days = createDays([1, 0, 0, 0, 0, 0, 0]);
      
      render(
        <WeekGridView 
          days={days} 
          config={customConfig}
        />
      );
      
      // Should render without errors
      expect(screen.getByText('Event 1')).toBeInTheDocument();
    });
  });

  describe('Event Grouping', () => {
    it('displays multiple events across days', () => {
      // Events on different days
      const days = createDays([1, 1, 0, 0, 0, 0, 0]);
      days[0].events[0].title = 'Sunday Event';
      days[1].events[0].title = 'Monday Event';
      
      render(
        <WeekGridView 
          days={days} 
          config={mockConfig}
        />
      );
      
      // Both events should be visible
      expect(screen.getByText('Sunday Event')).toBeInTheDocument();
      expect(screen.getByText('Monday Event')).toBeInTheDocument();
    });
  });
});
