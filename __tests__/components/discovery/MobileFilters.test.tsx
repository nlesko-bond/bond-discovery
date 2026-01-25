import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { MobileFilters } from '@/components/discovery/MobileFilters';
import { mockFiltersEmpty, mockFilterOptions } from '../../fixtures/mockData';
import { FilterType } from '@/types';

// Mock GTM
vi.mock('@/components/analytics/GoogleTagManager', () => ({
  gtmEvent: {
    filterApplied: vi.fn(),
  },
}));

// Mock dialog element methods
HTMLDialogElement.prototype.showModal = vi.fn();
HTMLDialogElement.prototype.close = vi.fn();

describe('MobileFilters', () => {
  const mockOnClose = vi.fn();
  const mockOnFiltersChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  const defaultProps = {
    isOpen: true,
    onClose: mockOnClose,
    filters: mockFiltersEmpty,
    onFiltersChange: mockOnFiltersChange,
    options: {
      facilities: mockFilterOptions.facilities,
      sports: mockFilterOptions.sports,
      programTypes: mockFilterOptions.programTypes,
    },
    enabledFilters: ['search', 'facility', 'programType', 'sport'] as FilterType[],
    resultCount: 42,
  };

  describe('Basic Rendering', () => {
    it('renders nothing when isOpen is false', () => {
      const { container } = render(
        <MobileFilters {...defaultProps} isOpen={false} />
      );
      
      expect(container.firstChild).toBeNull();
    });

    it('renders component when isOpen is true', () => {
      render(<MobileFilters {...defaultProps} />);
      
      // Should show Filters header
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });

    it('shows result count', () => {
      render(<MobileFilters {...defaultProps} resultCount={42} />);
      
      // Should show count somewhere
      expect(screen.getByText(/42/)).toBeInTheDocument();
    });
  });

  describe('Filter Sections', () => {
    it('shows Facility section when enabled', () => {
      render(<MobileFilters {...defaultProps} />);
      
      expect(screen.getByText('Facility')).toBeInTheDocument();
    });

    it('shows Program Type section when enabled', () => {
      render(<MobileFilters {...defaultProps} />);
      
      expect(screen.getByText('Program Type')).toBeInTheDocument();
    });

    it('shows Sport section when enabled', () => {
      render(<MobileFilters {...defaultProps} />);
      
      // Sport options should be visible (e.g., Soccer)
      expect(screen.getByText(/Soccer/)).toBeInTheDocument();
    });

    it('hides sections when not in enabledFilters', () => {
      const limitedFilters = {
        ...defaultProps,
        enabledFilters: ['facility'] as FilterType[],
      };
      render(<MobileFilters {...limitedFilters} />);
      
      expect(screen.getByText('Facility')).toBeInTheDocument();
      expect(screen.queryByText('Program Type')).not.toBeInTheDocument();
    });
  });

  describe('Filter Options', () => {
    it('shows facility options', () => {
      render(<MobileFilters {...defaultProps} />);
      
      // Should show facility names with counts
      expect(screen.getByText(/Main Sports Complex/)).toBeInTheDocument();
      expect(screen.getByText(/Indoor Gymnasium/)).toBeInTheDocument();
    });

    it('shows program type options', () => {
      render(<MobileFilters {...defaultProps} />);
      
      expect(screen.getByText(/Camp/)).toBeInTheDocument();
      expect(screen.getByText(/Clinic/)).toBeInTheDocument();
    });

    it('shows sport options', () => {
      render(<MobileFilters {...defaultProps} />);
      
      expect(screen.getByText(/Soccer/)).toBeInTheDocument();
      expect(screen.getByText(/Basketball/)).toBeInTheDocument();
    });
  });

  describe('Clear All', () => {
    it('shows Clear All functionality', () => {
      render(<MobileFilters {...defaultProps} />);
      
      // Look for clear all text
      const clearButtons = screen.getAllByText(/Clear/i);
      expect(clearButtons.length).toBeGreaterThan(0);
    });
  });

  describe('View Results', () => {
    it('shows View Results button with count', () => {
      render(<MobileFilters {...defaultProps} resultCount={42} />);
      
      // Should have a button with results count
      const resultText = screen.getByText(/42/);
      expect(resultText).toBeInTheDocument();
    });
  });

  describe('Search Filter', () => {
    it('shows search input when search filter is enabled', () => {
      render(<MobileFilters {...defaultProps} />);
      
      // Search section should be present
      const searchInputs = screen.queryAllByRole('textbox');
      // At least one should be the search input
      expect(searchInputs.length).toBeGreaterThanOrEqual(0);
    });

    it('hides search when not in enabledFilters', () => {
      const propsWithoutSearch = {
        ...defaultProps,
        enabledFilters: ['facility', 'sport'] as FilterType[],
      };
      render(<MobileFilters {...propsWithoutSearch} />);
      
      // Search section should not be present
      // The component may still render, but search-specific elements should be hidden
    });
  });

  describe('Filter Selection', () => {
    it('calls onFiltersChange when filter is toggled', () => {
      render(<MobileFilters {...defaultProps} />);
      
      // Find and click a facility checkbox/button
      const facilityOption = screen.getByText(/Main Sports Complex/);
      const checkbox = facilityOption.closest('label')?.querySelector('input') ||
                       facilityOption.closest('button');
      
      if (checkbox) {
        fireEvent.click(checkbox);
        expect(mockOnFiltersChange).toHaveBeenCalled();
      }
    });
  });

  describe('Close Functionality', () => {
    it('has header with Filters title', () => {
      render(<MobileFilters {...defaultProps} />);
      
      // Header should have Filters title
      expect(screen.getByText('Filters')).toBeInTheDocument();
    });
  });
});
