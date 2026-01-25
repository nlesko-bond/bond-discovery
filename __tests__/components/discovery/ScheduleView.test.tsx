import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { render, screen, fireEvent, waitFor, within } from '@testing-library/react';
import { ScheduleView } from '@/components/discovery/ScheduleView';
import {
  mockConfig,
  mockConfigMinimal,
  mockWeekSchedule,
  mockDaySchedule,
  mockDayScheduleToday,
  mockDayScheduleEmpty,
  mockCalendarEvent,
  mockCalendarEventFull,
  mockCalendarEventClosed,
} from '../../fixtures/mockData';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';

// Mock the analytics modules
vi.mock('@/components/analytics/GoogleTagManager', () => ({
  gtmEvent: {
    clickRegister: vi.fn(),
  },
}));

vi.mock('@/lib/analytics', () => ({
  bondAnalytics: {
    clickRegister: vi.fn(),
  },
}));

// Mock next/navigation
const mockReplace = vi.fn();
vi.mock('next/navigation', () => ({
  useSearchParams: () => new URLSearchParams(),
  useRouter: () => ({
    replace: mockReplace,
  }),
  usePathname: () => '/test-page',
}));

// Mock IntersectionObserver
const mockIntersectionObserver = vi.fn();
mockIntersectionObserver.mockReturnValue({
  observe: () => null,
  unobserve: () => null,
  disconnect: () => null,
});
window.IntersectionObserver = mockIntersectionObserver;

// Mock window.print
window.print = vi.fn();

describe('ScheduleView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Loading State', () => {
    it('renders loading skeleton when isLoading is true', () => {
      render(
        <ScheduleView 
          schedule={[]} 
          config={mockConfig} 
          isLoading={true}
        />
      );
      
      // Skeleton should be rendered (loading state)
      expect(screen.queryByText('No Schedule Available')).not.toBeInTheDocument();
    });
  });

  describe('Error State', () => {
    it('displays error message when error prop is set', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig} 
          error="Failed to load events"
        />
      );
      
      expect(screen.getByText('Error Loading Events')).toBeInTheDocument();
      expect(screen.getByText('Failed to load events')).toBeInTheDocument();
    });
  });

  describe('Empty State', () => {
    it('shows "No Schedule Available" for empty schedule', () => {
      render(
        <ScheduleView 
          schedule={[]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('No Schedule Available')).toBeInTheDocument();
      expect(screen.getByText('Check back later for upcoming events.')).toBeInTheDocument();
    });
  });

  describe('Event Count Display', () => {
    it('shows total event count', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig}
          totalEvents={42}
        />
      );
      
      expect(screen.getByText('42')).toBeInTheDocument();
      expect(screen.getByText('events')).toBeInTheDocument();
    });

    it('shows 0 events when totalEvents not provided', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('0')).toBeInTheDocument();
    });
  });

  describe('View Mode Switching', () => {
    it('renders view mode buttons', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByTitle('List View')).toBeInTheDocument();
      expect(screen.getByTitle('Day View')).toBeInTheDocument();
      expect(screen.getByTitle('Week View')).toBeInTheDocument();
      expect(screen.getByTitle('Month View')).toBeInTheDocument();
    });

    it('switches to day view on button click', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig}
        />
      );
      
      const dayButton = screen.getByTitle('Day View');
      fireEvent.click(dayButton);
      
      // Router should be called to update URL
      expect(mockReplace).toHaveBeenCalled();
    });

    it('switches to week view on button click', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig}
        />
      );
      
      const weekButton = screen.getByTitle('Week View');
      fireEvent.click(weekButton);
      
      expect(mockReplace).toHaveBeenCalled();
    });

    it('switches to month view on button click', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig}
        />
      );
      
      const monthButton = screen.getByTitle('Month View');
      fireEvent.click(monthButton);
      
      expect(mockReplace).toHaveBeenCalled();
    });

    it('shows table view button when showTableView is enabled', () => {
      const configWithTable = {
        ...mockConfig,
        features: {
          ...mockConfig.features,
          showTableView: true,
        },
      };
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={configWithTable}
        />
      );
      
      expect(screen.getByTitle('Table View')).toBeInTheDocument();
    });

    it('hides table view button when showTableView is disabled', () => {
      const configWithoutTable = {
        ...mockConfig,
        features: {
          ...mockConfig.features,
          showTableView: false,
        },
      };
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={configWithoutTable}
        />
      );
      
      expect(screen.queryByTitle('Table View')).not.toBeInTheDocument();
    });
  });

  describe('Export Functionality', () => {
    it('shows export button', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByTitle('Export schedule')).toBeInTheDocument();
    });

    it('opens export menu on click', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig}
        />
      );
      
      const exportButton = screen.getByTitle('Export schedule');
      fireEvent.click(exportButton);
      
      expect(screen.getByText('Add to Calendar')).toBeInTheDocument();
      expect(screen.getByText('Export to CSV')).toBeInTheDocument();
      expect(screen.getByText('Print / PDF')).toBeInTheDocument();
    });

    it('triggers print on Print/PDF click', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule]} 
          config={mockConfig}
        />
      );
      
      const exportButton = screen.getByTitle('Export schedule');
      fireEvent.click(exportButton);
      
      const printButton = screen.getByText('Print / PDF');
      fireEvent.click(printButton);
      
      expect(window.print).toHaveBeenCalled();
    });
  });

  describe('List View', () => {
    it('renders day sections with events', () => {
      // Use unique event to avoid duplicates
      const uniqueEvent = {
        ...mockCalendarEvent,
        id: 'unique-event-1',
        title: 'Unique Soccer Practice',
      };
      const scheduleWithEvents = {
        ...mockWeekSchedule,
        days: [
          { ...mockDaySchedule, date: '2026-03-20', events: [uniqueEvent] },
        ],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvents]} 
          config={mockConfig}
        />
      );
      
      // Should show the event
      expect(screen.getByText('Unique Soccer Practice')).toBeInTheDocument();
    });

    it('shows Today badge for today\'s events', () => {
      const uniqueTodayEvent = {
        ...mockCalendarEvent,
        id: 'today-event-1',
        title: 'Today Soccer Event',
      };
      const todaySchedule = {
        ...mockWeekSchedule,
        days: [{
          ...mockDayScheduleToday,
          events: [uniqueTodayEvent],
        }],
      };
      render(
        <ScheduleView 
          schedule={[todaySchedule]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('Today')).toBeInTheDocument();
    });

    it('displays event time', () => {
      const uniqueTimeEvent = {
        ...mockCalendarEvent,
        id: 'time-event-1',
        title: 'Timed Event',
      };
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, date: '2026-03-22', events: [uniqueTimeEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
        />
      );
      
      // Time should be displayed (format may vary)
      const timeElements = screen.getAllByText(/AM|PM/i);
      expect(timeElements.length).toBeGreaterThan(0);
    });

    it('displays facility name when hasMultipleFacilities', () => {
      const facilityEvent = {
        ...mockCalendarEvent,
        id: 'facility-event-1',
        title: 'Facility Test Event',
        facilityName: 'Test Facility',
        spaceName: 'Court 1',
      };
      const facilityDaySchedule = {
        date: '2026-03-23',
        dayOfWeek: 'Monday',
        events: [facilityEvent],
        isToday: false,
        isPast: false,
      };
      const scheduleWithEvent = {
        weekStart: '2026-03-22',
        weekEnd: '2026-03-28',
        days: [facilityDaySchedule],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
          hasMultipleFacilities={true}
          totalEvents={1}
        />
      );
      
      // Should show facility name with space name when multiple facilities
      expect(screen.getByText(/Test Facility/)).toBeInTheDocument();
    });

    it('shows empty state when no events match filters', () => {
      const emptySchedule = {
        ...mockWeekSchedule,
        days: mockWeekSchedule.days.map(day => ({ ...day, events: [] })),
      };
      render(
        <ScheduleView 
          schedule={[emptySchedule]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('No events found')).toBeInTheDocument();
    });
  });

  describe('Availability Display', () => {
    it('shows spots remaining when showAvailability is enabled', () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('5 left')).toBeInTheDocument();
    });

    it('shows Full badge for full events', () => {
      const scheduleWithFullEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEventFull] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithFullEvent]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('Full')).toBeInTheDocument();
    });

    it('hides availability when disabled in config', () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfigMinimal}
        />
      );
      
      expect(screen.queryByText('5 left')).not.toBeInTheDocument();
    });
  });

  describe('Registration Status', () => {
    it('shows Registration Closed badge', () => {
      const scheduleWithClosedEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEventClosed] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithClosedEvent]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('Registration Closed')).toBeInTheDocument();
    });

    it('shows Learn More for closed registration', () => {
      const scheduleWithClosedEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEventClosed] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithClosedEvent]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText(/Learn More/)).toBeInTheDocument();
    });
  });

  describe('Register Links', () => {
    it('includes skipToProducts param in registration URL', () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
        />
      );
      
      const registerLink = screen.getByRole('link', { name: /Register/i });
      expect(registerLink).toHaveAttribute('href', expect.stringContaining('skipToProducts=true'));
    });

    it('opens register links in new tab', () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
        />
      );
      
      const registerLink = screen.getByRole('link', { name: /Register/i });
      expect(registerLink).toHaveAttribute('target', '_blank');
    });
  });

  describe('Analytics Tracking', () => {
    it('tracks GTM click_register on register click', () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
        />
      );
      
      const registerLink = screen.getByRole('link', { name: /Register/i });
      fireEvent.click(registerLink);
      
      expect(gtmEvent.clickRegister).toHaveBeenCalledWith(
        expect.objectContaining({
          programId: 'program-1',
          programName: 'Youth Soccer Camp',
        })
      );
    });

    it('tracks bondAnalytics click_register on register click', () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
        />
      );
      
      const registerLink = screen.getByRole('link', { name: /Register/i });
      fireEvent.click(registerLink);
      
      expect(bondAnalytics.clickRegister).toHaveBeenCalledWith(
        'test-page',
        expect.objectContaining({
          programId: 'program-1',
          programName: 'Youth Soccer Camp',
        })
      );
    });

    it('does not track analytics for closed registration clicks', () => {
      const scheduleWithClosedEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEventClosed] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithClosedEvent]} 
          config={mockConfig}
        />
      );
      
      const learnMoreLink = screen.getByRole('link', { name: /Learn More/i });
      fireEvent.click(learnMoreLink);
      
      // Should not track for closed registration
      expect(gtmEvent.clickRegister).not.toHaveBeenCalled();
    });
  });

  describe('Pricing Display', () => {
    it('shows price when showPricing is enabled', () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
        />
      );
      
      expect(screen.getByText('$99.99')).toBeInTheDocument();
    });

    it('hides price when showPricing is disabled', () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfigMinimal}
        />
      );
      
      expect(screen.queryByText('$99.99')).not.toBeInTheDocument();
    });
  });

  describe('Event Detail Modal', () => {
    it('opens modal on event card click', async () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
        />
      );
      
      // Click the event card (not the register link)
      const eventCard = screen.getByText('Soccer Practice').closest('button');
      if (eventCard) {
        fireEvent.click(eventCard);
      }
      
      // Modal should show program name and details
      await waitFor(() => {
        expect(screen.getByText('Youth Soccer Camp')).toBeInTheDocument();
      });
    });

    it('closes modal on close button click', async () => {
      const scheduleWithEvent = {
        ...mockWeekSchedule,
        days: [{ ...mockDaySchedule, events: [mockCalendarEvent] }],
      };
      render(
        <ScheduleView 
          schedule={[scheduleWithEvent]} 
          config={mockConfig}
        />
      );
      
      // Open modal
      const eventCard = screen.getByText('Soccer Practice').closest('button');
      if (eventCard) {
        fireEvent.click(eventCard);
      }
      
      // Wait for modal to appear
      await waitFor(() => {
        expect(screen.getByText('Youth Soccer Camp')).toBeInTheDocument();
      });
      
      // Close modal
      const closeButton = screen.getByRole('button', { name: /Close/i });
      fireEvent.click(closeButton);
      
      // Modal should be closed - the program name header should no longer be in modal
      await waitFor(() => {
        // The modal-specific "Event Details" should not be present
        expect(screen.queryByRole('button', { name: /Close/i })).not.toBeInTheDocument();
      });
    });
  });

  describe('Week Navigation', () => {
    it('shows week navigation in week view', () => {
      render(
        <ScheduleView 
          schedule={[mockWeekSchedule, mockWeekSchedule]} 
          config={mockConfig}
        />
      );
      
      // Switch to week view
      const weekButton = screen.getByTitle('Week View');
      fireEvent.click(weekButton);
      
      // Should show week range
      expect(screen.getByText(/Mar 15 - Mar 21, 2026/)).toBeInTheDocument();
    });
  });
});
