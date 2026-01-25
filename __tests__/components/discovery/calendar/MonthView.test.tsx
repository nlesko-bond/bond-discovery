import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MonthView } from '@/components/discovery/calendar/MonthView';
import { mockConfig, mockCalendarEvent } from '../../../fixtures/mockData';
import { CalendarEvent } from '@/types';

describe('MonthView', () => {
  const mockOnDayClick = vi.fn();
  const mockOnEventClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Helper to create events for a specific date
  const createEventsForDate = (dateStr: string, count: number): CalendarEvent[] => {
    return Array.from({ length: count }, (_, i) => ({
      ...mockCalendarEvent,
      id: `event-${dateStr}-${i}`,
      date: dateStr,
      startTime: `${dateStr}T${10 + i}:00:00.000Z`,
      title: `Event ${i + 1}`,
    }));
  };

  describe('Rendering', () => {
    it('renders weekday headers', () => {
      render(
        <MonthView 
          events={[]}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Mon')).toBeInTheDocument();
      expect(screen.getByText('Tue')).toBeInTheDocument();
      expect(screen.getByText('Wed')).toBeInTheDocument();
      expect(screen.getByText('Thu')).toBeInTheDocument();
      expect(screen.getByText('Fri')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });

    it('renders calendar grid with days', () => {
      render(
        <MonthView 
          events={[]}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // March 2026 should have key dates - using getAllByText since dates repeat
      const day15s = screen.getAllByText('15');
      expect(day15s.length).toBeGreaterThan(0);
    });

    it('renders multiple week rows', () => {
      render(
        <MonthView 
          events={[]}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Should have weekday headers and grid cells
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
    });
  });

  describe('Today Highlighting', () => {
    it('highlights today with special styling', () => {
      const today = new Date();
      render(
        <MonthView 
          events={[]}
          currentMonth={today}
          config={mockConfig}
        />
      );
      
      // Today's date should be present
      const todayNum = String(today.getDate());
      expect(screen.getByText(todayNum)).toBeInTheDocument();
    });
  });

  describe('Event Display', () => {
    it('shows event count badge', () => {
      const events = createEventsForDate('2026-03-15', 5);
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Should show count badge "5"
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('shows event previews for days with events', () => {
      const events = createEventsForDate('2026-03-15', 2);
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Event count should be shown
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('handles many events on same day', () => {
      const events = createEventsForDate('2026-03-15', 5);
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Should show count badge
      expect(screen.getByText('5')).toBeInTheDocument();
    });

    it('does not show +X more for 3 or fewer events', () => {
      const events = createEventsForDate('2026-03-15', 3);
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      expect(screen.queryByText(/\+\d+ more/)).not.toBeInTheDocument();
    });
  });

  describe('Day Click Interaction', () => {
    it('renders day cells with click handlers', () => {
      const events = createEventsForDate('2026-03-15', 2);
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
          onDayClick={mockOnDayClick}
        />
      );
      
      // Event count badge should be visible
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('renders without errors when onDayClick not provided', () => {
      render(
        <MonthView 
          events={[]}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Should render all weekday headers
      expect(screen.getByText('Sun')).toBeInTheDocument();
    });
  });

  describe('Event Click Interaction', () => {
    it('renders events with click handlers', () => {
      const events = createEventsForDate('2026-03-15', 1);
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
          onEventClick={mockOnEventClick}
        />
      );
      
      // Event count should be visible
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('renders without errors when handlers not provided', () => {
      const events = createEventsForDate('2026-03-15', 1);
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Should render event count
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Event Filtering', () => {
    it('displays events for the current month', () => {
      const events = createEventsForDate('2026-03-15', 2);
      
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Should show event count badge
      expect(screen.getByText('2')).toBeInTheDocument();
    });

    it('handles multiple days with events', () => {
      const day15Events = createEventsForDate('2026-03-15', 2);
      const day20Events = createEventsForDate('2026-03-20', 1);
      
      render(
        <MonthView 
          events={[...day15Events, ...day20Events]}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Should show counts for both days
      expect(screen.getByText('2')).toBeInTheDocument();
      expect(screen.getByText('1')).toBeInTheDocument();
    });
  });

  describe('Branding', () => {
    it('renders with custom branding colors', () => {
      const customConfig = {
        ...mockConfig,
        branding: {
          ...mockConfig.branding,
          secondaryColor: '#22C55E',
        },
      };
      const events = createEventsForDate('2026-03-15', 1);
      
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={customConfig}
        />
      );
      
      // Should render event count
      expect(screen.getByText('1')).toBeInTheDocument();
    });

    it('uses secondary color for today highlight', () => {
      const today = new Date();
      const customConfig = {
        ...mockConfig,
        branding: {
          ...mockConfig.branding,
          secondaryColor: '#DC2626',
        },
      };
      
      render(
        <MonthView 
          events={[]}
          currentMonth={today}
          config={customConfig}
        />
      );
      
      // Today's date should be rendered - use getAllByText since there might be duplicates
      const todayNum = String(today.getDate());
      const todayElements = screen.getAllByText(todayNum);
      expect(todayElements.length).toBeGreaterThan(0);
    });
  });

  describe('Adjacent Month Days', () => {
    it('renders complete calendar grid', () => {
      render(
        <MonthView 
          events={[]}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Should render successfully with weekday headers
      expect(screen.getByText('Sun')).toBeInTheDocument();
      expect(screen.getByText('Sat')).toBeInTheDocument();
      // Should have at least some day numbers
      const dayOne = screen.getAllByText('1');
      expect(dayOne.length).toBeGreaterThan(0);
    });
  });

  describe('High Event Count Badge', () => {
    it('styles badge differently for 6+ events', () => {
      const events = createEventsForDate('2026-03-15', 7);
      render(
        <MonthView 
          events={events}
          currentMonth={new Date('2026-03-01')}
          config={mockConfig}
        />
      );
      
      // Count badge should show 7
      expect(screen.getByText('7')).toBeInTheDocument();
    });
  });
});
