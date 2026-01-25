import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, within } from '@testing-library/react';
import { ProgramCard } from '@/components/discovery/ProgramCard';
import {
  mockProgram,
  mockProgramNoSessions,
  mockProgramMale,
  mockProgramFree,
  mockConfig,
  mockConfigMinimal,
  mockSession,
  mockSessionFull,
  mockSessionClosed,
  mockSessionComingSoon,
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
vi.mock('next/navigation', () => ({
  usePathname: () => '/test-page',
}));

describe('ProgramCard', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('Basic Rendering', () => {
    it('renders program name', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      expect(screen.getByText('Youth Soccer Camp')).toBeInTheDocument();
    });

    it('renders program type badge', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      expect(screen.getByText('Camp')).toBeInTheDocument();
    });

    it('renders sport badge', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      expect(screen.getByText('Soccer')).toBeInTheDocument();
    });

    it('renders program description', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      expect(screen.getByText('Learn soccer fundamentals in a fun environment')).toBeInTheDocument();
    });

    it('renders session count', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      // Program has 2 sessions
      expect(screen.getByText(/2 sessions/)).toBeInTheDocument();
    });

    it('renders singular session text for 1 session', () => {
      const programWithOneSession = {
        ...mockProgram,
        sessions: [mockSession],
      };
      render(<ProgramCard program={programWithOneSession} config={mockConfig} />);
      expect(screen.getByText(/1 session/)).toBeInTheDocument();
    });
  });

  describe('Facility Display', () => {
    it('shows facility name when showFacility is true (default)', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      expect(screen.getByText('Main Sports Complex')).toBeInTheDocument();
    });

    it('hides facility name when showFacility is false', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} showFacility={false} />);
      expect(screen.queryByText('Main Sports Complex')).not.toBeInTheDocument();
    });
  });

  describe('Age/Gender Display', () => {
    it('shows age range when showAgeGender is enabled', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      expect(screen.getByText(/Ages 5-12/)).toBeInTheDocument();
    });

    it('shows gender label for male-only programs', () => {
      render(<ProgramCard program={mockProgramMale} config={mockConfig} />);
      expect(screen.getByText(/Boys\/Men/)).toBeInTheDocument();
    });

    it('hides age/gender when disabled in config', () => {
      render(<ProgramCard program={mockProgram} config={mockConfigMinimal} />);
      expect(screen.queryByText(/Ages 5-12/)).not.toBeInTheDocument();
    });
  });

  describe('Pricing Display', () => {
    it('shows pricing when showPricing is enabled', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      expect(screen.getByText('From')).toBeInTheDocument();
      expect(screen.getByText('$99.99')).toBeInTheDocument();
    });

    it('shows member pricing when available', () => {
      // Create a program with explicit member pricing to test member display
      const programWithMemberPricing = {
        ...mockProgram,
        sessions: [{
          ...mockSession,
          products: [
            { ...mockSession.products![0], isMemberProduct: false }, // Regular product
            { ...mockSession.products![1], isMemberProduct: true },  // Member product  
          ],
        }],
      };
      render(<ProgramCard program={programWithMemberPricing} config={mockConfig} />);
      // Member pricing badge should be displayed in the header
      expect(screen.getByText('Member Pricing')).toBeInTheDocument();
    });

    it('shows Member Pricing badge', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      expect(screen.getByText('Member Pricing')).toBeInTheDocument();
    });

    it('hides pricing when disabled in config', () => {
      render(<ProgramCard program={mockProgram} config={mockConfigMinimal} />);
      expect(screen.queryByText('From')).not.toBeInTheDocument();
      expect(screen.queryByText('$99.99')).not.toBeInTheDocument();
    });

    it('shows FREE for zero-price programs', () => {
      render(<ProgramCard program={mockProgramFree} config={mockConfig} />);
      expect(screen.getByText('FREE')).toBeInTheDocument();
    });
  });

  describe('Availability Display', () => {
    it('shows spots remaining when showAvailability is enabled', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      expect(screen.getByText(/spots left/)).toBeInTheDocument();
    });

    it('shows Almost Full badge when few spots left', () => {
      const programAlmostFull = {
        ...mockProgram,
        sessions: [{
          ...mockSession,
          spotsRemaining: 2,
          currentEnrollment: 18,
        }],
      };
      render(<ProgramCard program={programAlmostFull} config={mockConfig} />);
      expect(screen.getByText('Almost Full')).toBeInTheDocument();
    });

    it('shows Full badge when no spots', () => {
      const programFull = {
        ...mockProgram,
        sessions: [mockSessionFull],
      };
      render(<ProgramCard program={programFull} config={mockConfig} />);
      // There may be multiple "Full" elements (badge and availability text)
      const fullElements = screen.getAllByText('Full');
      expect(fullElements.length).toBeGreaterThan(0);
    });

    it('hides availability when disabled in config', () => {
      render(<ProgramCard program={mockProgram} config={mockConfigMinimal} />);
      expect(screen.queryByText(/spots left/)).not.toBeInTheDocument();
    });
  });

  describe('Session Expansion', () => {
    it('expands sessions on Details click', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      // Should show session names
      expect(screen.getByText('Spring 2026 Session')).toBeInTheDocument();
      expect(screen.getByText('Summer 2026 Session')).toBeInTheDocument();
    });

    it('shows session date range when expanded', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      // Session date range should be visible
      expect(screen.getByText(/Mar 1 - May 31, 2026/)).toBeInTheDocument();
    });

    it('shows no sessions message when program has no sessions', () => {
      render(<ProgramCard program={mockProgramNoSessions} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('No sessions available')).toBeInTheDocument();
    });

    it('auto-expands when autoExpand prop is true', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} autoExpand={true} />);
      
      // Sessions should already be visible
      expect(screen.getByText('Spring 2026 Session')).toBeInTheDocument();
    });

    it('collapses sessions on second Details click', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      expect(screen.getByText('Spring 2026 Session')).toBeInTheDocument();
      
      fireEvent.click(detailsButton);
      expect(screen.queryByText('Spring 2026 Session')).not.toBeInTheDocument();
    });
  });

  describe('Registration Status', () => {
    it('shows Registration Closed badge for closed sessions', () => {
      const programWithClosed = {
        ...mockProgram,
        sessions: [mockSessionClosed],
      };
      render(<ProgramCard program={programWithClosed} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('Registration Closed')).toBeInTheDocument();
    });

    it('shows Coming Soon badge for upcoming registration', () => {
      const programComingSoon = {
        ...mockProgram,
        sessions: [mockSessionComingSoon],
      };
      render(<ProgramCard program={programComingSoon} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('Coming Soon')).toBeInTheDocument();
    });

    it('shows View Program button when all sessions closed', () => {
      const programAllClosed = {
        ...mockProgram,
        sessions: [mockSessionClosed],
      };
      render(<ProgramCard program={programAllClosed} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('View Program')).toBeInTheDocument();
    });

    it('shows View Program & Register button when sessions open', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('View Program & Register')).toBeInTheDocument();
    });
  });

  describe('Analytics Tracking', () => {
    it('tracks GTM click_register event on register click', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      // Find the main register button
      const registerLink = screen.getByRole('link', { name: /View Program & Register/i });
      fireEvent.click(registerLink);
      
      expect(gtmEvent.clickRegister).toHaveBeenCalledWith({
        programId: 'program-1',
        programName: 'Youth Soccer Camp',
      });
    });

    it('tracks bondAnalytics click_register event on register click', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      const registerLink = screen.getByRole('link', { name: /View Program & Register/i });
      fireEvent.click(registerLink);
      
      expect(bondAnalytics.clickRegister).toHaveBeenCalledWith(
        'test-page',
        expect.objectContaining({
          programId: 'program-1',
          programName: 'Youth Soccer Camp',
        })
      );
    });

    it('tracks session-level register click with session data', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      // Click on a session register button
      const sessionRegisterButtons = screen.getAllByRole('link', { name: /Register/i });
      // First Register link is for the first session
      fireEvent.click(sessionRegisterButtons[0]);
      
      expect(gtmEvent.clickRegister).toHaveBeenCalled();
    });
  });

  describe('Register Links', () => {
    it('includes skipToProducts param in registration URL', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      const registerLink = screen.getByRole('link', { name: /View Program & Register/i });
      expect(registerLink).toHaveAttribute('href', expect.stringContaining('skipToProducts=true'));
    });

    it('links open in new tab', () => {
      render(<ProgramCard program={mockProgram} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      const registerLink = screen.getByRole('link', { name: /View Program & Register/i });
      expect(registerLink).toHaveAttribute('target', '_blank');
      expect(registerLink).toHaveAttribute('rel', 'noopener noreferrer');
    });
  });

  describe('Edge Cases', () => {
    it('handles program without image gracefully', () => {
      const programNoImage = {
        ...mockProgram,
        imageUrl: undefined,
        mainMedia: undefined,
      };
      render(<ProgramCard program={programNoImage} config={mockConfig} />);
      
      // Should render with gradient background instead
      expect(screen.getByText('Youth Soccer Camp')).toBeInTheDocument();
    });

    it('handles program without description', () => {
      const programNoDesc = {
        ...mockProgram,
        description: undefined,
      };
      render(<ProgramCard program={programNoDesc} config={mockConfig} />);
      
      expect(screen.getByText('Youth Soccer Camp')).toBeInTheDocument();
    });

    it('handles session without products', () => {
      const sessionNoProducts = {
        ...mockSession,
        products: [],
      };
      const programNoProducts = {
        ...mockProgram,
        sessions: [sessionNoProducts],
      };
      render(<ProgramCard program={programNoProducts} config={mockConfig} />);
      
      const detailsButton = screen.getByRole('button', { name: /Details/i });
      fireEvent.click(detailsButton);
      
      expect(screen.getByText('Spring 2026 Session')).toBeInTheDocument();
    });

    it('handles undefined spotsRemaining gracefully', () => {
      const sessionNoSpots = {
        ...mockSession,
        spotsRemaining: undefined,
        maxParticipants: undefined,
        capacity: undefined,
        currentEnrollment: undefined,
      };
      const programNoSpots = {
        ...mockProgram,
        sessions: [sessionNoSpots],
      };
      render(<ProgramCard program={programNoSpots} config={mockConfig} />);
      
      // Should not show spots count (but "Available" text might still appear)
      // Check specifically for the "X spots left" pattern
      expect(screen.queryByText(/\d+ spots? left/)).not.toBeInTheDocument();
    });
  });
});
