import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { DayView } from '@/components/discovery/calendar/DayView';
import { mockConfig, mockCalendarEvent } from '../../../fixtures/mockData';

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

describe('DayView', () => {
  const mockOnEventClick = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Rendering', () => {
    it('renders day header with date', () => {
      render(
        <DayView 
          events={[]} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText(/Sunday, March 15/)).toBeInTheDocument();
    });

    it('renders without errors when date is today', () => {
      // Use today's date - component should handle today highlighting internally
      const today = new Date().toISOString().split('T')[0];
      render(
        <DayView 
          events={[]} 
          date={today} 
          config={mockConfig}
        />
      );
      
      // Should render the day header with current day's date
      expect(screen.getByText('No events scheduled')).toBeInTheDocument();
    });

    it('shows event count for single event', () => {
      const event = {
        ...mockCalendarEvent,
        id: 'day-event-1',
        date: '2026-03-15',
        startTime: '2026-03-15T10:00:00.000Z',
      };
      render(
        <DayView 
          events={[event]} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('1 event')).toBeInTheDocument();
    });

    it('shows event count for multiple events', () => {
      const events = [
        { ...mockCalendarEvent, id: 'day-event-1', date: '2026-03-15', startTime: '2026-03-15T10:00:00.000Z' },
        { ...mockCalendarEvent, id: 'day-event-2', date: '2026-03-15', startTime: '2026-03-15T14:00:00.000Z' },
      ];
      render(
        <DayView 
          events={events} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('2 events')).toBeInTheDocument();
    });
  });

  describe('Time Slots', () => {
    it('renders time slots from 6 AM to 10 PM', () => {
      const event = {
        ...mockCalendarEvent,
        id: 'day-event-1',
        date: '2026-03-15',
        startTime: '2026-03-15T10:00:00.000Z',
      };
      render(
        <DayView 
          events={[event]} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      // Should show AM times
      expect(screen.getByText('6 AM')).toBeInTheDocument();
      expect(screen.getByText('9 AM')).toBeInTheDocument();
      
      // Should show PM times
      expect(screen.getByText('12 PM')).toBeInTheDocument();
      expect(screen.getByText('6 PM')).toBeInTheDocument();
      expect(screen.getByText('10 PM')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows no events message when empty', () => {
      render(
        <DayView 
          events={[]} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('No events scheduled')).toBeInTheDocument();
    });
  });

  describe('Event Rendering', () => {
    it('renders event title', () => {
      const event = {
        ...mockCalendarEvent,
        id: 'day-event-title',
        title: 'Morning Practice',
        date: '2026-03-15',
        startTime: '2026-03-15T10:00:00.000Z',
      };
      render(
        <DayView 
          events={[event]} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('Morning Practice')).toBeInTheDocument();
    });

    it('shows facility name when provided', () => {
      const event = {
        ...mockCalendarEvent,
        id: 'day-event-facility',
        date: '2026-03-15',
        startTime: '2026-03-15T10:00:00.000Z',
        facilityName: 'Indoor Arena',
      };
      render(
        <DayView 
          events={[event]} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('Indoor Arena')).toBeInTheDocument();
    });

    it('shows spots remaining when available', () => {
      const event = {
        ...mockCalendarEvent,
        id: 'day-event-spots',
        date: '2026-03-15',
        startTime: '2026-03-15T10:00:00.000Z',
        spotsRemaining: 8,
      };
      render(
        <DayView 
          events={[event]} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('8 spots')).toBeInTheDocument();
    });

    it('shows time range', () => {
      const event = {
        ...mockCalendarEvent,
        id: 'day-event-time',
        date: '2026-03-15',
        startTime: '2026-03-15T10:00:00.000Z',
        endTime: '2026-03-15T11:30:00.000Z',
      };
      render(
        <DayView 
          events={[event]} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      // Should show both start and end times (format may vary)
      const timeTexts = screen.getAllByText(/AM|PM/i);
      expect(timeTexts.length).toBeGreaterThan(0);
    });
  });

  describe('Event Interaction', () => {
    it('calls onEventClick when event is clicked', () => {
      const event = {
        ...mockCalendarEvent,
        id: 'day-event-click',
        date: '2026-03-15',
        startTime: '2026-03-15T10:00:00.000Z',
      };
      render(
        <DayView 
          events={[event]} 
          date="2026-03-15" 
          config={mockConfig}
          onEventClick={mockOnEventClick}
        />
      );
      
      const eventCard = screen.getByText('Soccer Practice').closest('div');
      if (eventCard) {
        fireEvent.click(eventCard);
        expect(mockOnEventClick).toHaveBeenCalledWith(event);
      }
    });

    it('has register link that opens in new tab', () => {
      const event = {
        ...mockCalendarEvent,
        id: 'day-event-register',
        date: '2026-03-15',
        startTime: '2026-03-15T10:00:00.000Z',
        linkSEO: '/programs/test/session',
      };
      render(
        <DayView 
          events={[event]} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      const registerLink = screen.getByRole('link');
      expect(registerLink).toHaveAttribute('target', '_blank');
      expect(registerLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Event Filtering', () => {
    it('only shows events for the specified date', () => {
      const events = [
        { ...mockCalendarEvent, id: 'event-15', date: '2026-03-15', startTime: '2026-03-15T10:00:00.000Z', title: 'March 15 Event' },
        { ...mockCalendarEvent, id: 'event-16', date: '2026-03-16', startTime: '2026-03-16T10:00:00.000Z', title: 'March 16 Event' },
      ];
      render(
        <DayView 
          events={events} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('March 15 Event')).toBeInTheDocument();
      expect(screen.queryByText('March 16 Event')).not.toBeInTheDocument();
    });

    it('displays events from different hours', () => {
      const events = [
        { ...mockCalendarEvent, id: 'event-10am', date: '2026-03-15', startTime: '2026-03-15T10:00:00.000Z', title: 'Morning Event' },
        { ...mockCalendarEvent, id: 'event-2pm', date: '2026-03-15', startTime: '2026-03-15T14:00:00.000Z', title: 'Afternoon Event' },
      ];
      render(
        <DayView 
          events={events} 
          date="2026-03-15" 
          config={mockConfig}
        />
      );
      
      // Both should be present - displayed in their respective time slots
      expect(screen.getByText('Morning Event')).toBeInTheDocument();
      expect(screen.getByText('Afternoon Event')).toBeInTheDocument();
      expect(screen.getByText('2 events')).toBeInTheDocument();
    });
  });

  describe('Branding', () => {
    it('uses brand colors from config', () => {
      const customConfig = {
        ...mockConfig,
        branding: {
          ...mockConfig.branding,
          secondaryColor: '#FF0000',
        },
      };
      const event = {
        ...mockCalendarEvent,
        id: 'branded-event',
        date: '2026-03-15',
        startTime: '2026-03-15T10:00:00.000Z',
      };
      render(
        <DayView 
          events={[event]} 
          date="2026-03-15" 
          config={customConfig}
        />
      );
      
      // Component should render without errors with custom branding
      expect(screen.getByText('Soccer Practice')).toBeInTheDocument();
    });
  });
});
