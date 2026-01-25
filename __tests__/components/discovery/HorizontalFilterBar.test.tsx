import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { HorizontalFilterBar } from '@/components/discovery/HorizontalFilterBar';
import { mockConfig, mockFiltersEmpty, mockFilterOptions } from '../../fixtures/mockData';

// Mock GTM
vi.mock('@/components/analytics/GoogleTagManager', () => ({
  gtmEvent: {
    filterApplied: vi.fn(),
  },
}));

describe('HorizontalFilterBar', () => {
  const mockOnFilterChange = vi.fn();

  beforeEach(() => {
    vi.clearAllMocks();
  });

  // Ensure filterOptions has the proper flags
  const enhancedFilterOptions = {
    ...mockFilterOptions,
    hasMultipleFacilities: true,
  };

  const defaultProps = {
    filters: mockFiltersEmpty,
    onFilterChange: mockOnFilterChange,
    filterOptions: enhancedFilterOptions,
    config: mockConfig,
  };

  describe('Basic Rendering', () => {
    it('renders without crashing', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      // Should render search input
      expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
    });

    it('renders filter buttons', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      // Should render Type filter button
      expect(screen.getByText('Type')).toBeInTheDocument();
    });

    it('renders Age filter when enabled', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      expect(screen.getByText('Age')).toBeInTheDocument();
    });
  });

  describe('Search Functionality', () => {
    it('renders search input', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/Search/i);
      expect(searchInput).toBeInTheDocument();
    });

    it('updates search input value on typing', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(searchInput, { target: { value: 'soccer' } });
      
      expect(searchInput).toHaveValue('soccer');
    });

    it('debounces search and calls onFilterChange', async () => {
      vi.useFakeTimers();
      render(<HorizontalFilterBar {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/Search/i);
      fireEvent.change(searchInput, { target: { value: 'test' } });
      
      // Should not be called immediately
      expect(mockOnFilterChange).not.toHaveBeenCalled();
      
      // Advance timer past debounce (300ms)
      vi.advanceTimersByTime(350);
      
      expect(mockOnFilterChange).toHaveBeenCalledWith(
        expect.objectContaining({ search: 'test' })
      );
      
      vi.useRealTimers();
    });

    it('shows current search value from filters', () => {
      const filtersWithSearch = {
        ...mockFiltersEmpty,
        search: 'basketball',
      };
      render(
        <HorizontalFilterBar 
          {...defaultProps} 
          filters={filtersWithSearch}
        />
      );
      
      const searchInput = screen.getByPlaceholderText(/Search/i);
      expect(searchInput).toHaveValue('basketball');
    });
  });

  describe('Filter Dropdowns', () => {
    it('opens Type dropdown on click', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      const typeButton = screen.getByText('Type');
      fireEvent.click(typeButton);
      
      // Dropdown should show program type options
      expect(screen.getByText('Camp')).toBeInTheDocument();
    });

    it('shows program type options with counts', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      const typeButton = screen.getByText('Type');
      fireEvent.click(typeButton);
      
      // Should show type options
      expect(screen.getByText('Camp')).toBeInTheDocument();
      expect(screen.getByText('Clinic')).toBeInTheDocument();
    });

    it('selects program type and calls onFilterChange', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      // Open Type dropdown
      const typeButton = screen.getByText('Type');
      fireEvent.click(typeButton);
      
      // Select Camp
      const campOption = screen.getByText('Camp');
      fireEvent.click(campOption);
      
      expect(mockOnFilterChange).toHaveBeenCalled();
    });
  });

  describe('Limited Filters', () => {
    it('only shows enabled filters', () => {
      const configWithLimitedFilters = {
        ...mockConfig,
        features: {
          ...mockConfig.features,
          enableFilters: ['search'] as any[],
        },
      };
      render(
        <HorizontalFilterBar 
          {...defaultProps} 
          config={configWithLimitedFilters}
        />
      );
      
      // Search should be present
      expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
      
      // Type filter should not be present
      expect(screen.queryByText('Type')).not.toBeInTheDocument();
    });
  });

  describe('Branding', () => {
    it('renders with custom brand colors', () => {
      const customConfig = {
        ...mockConfig,
        branding: {
          ...mockConfig.branding,
          primaryColor: '#FF0000',
          secondaryColor: '#00FF00',
        },
      };
      render(
        <HorizontalFilterBar 
          {...defaultProps} 
          config={customConfig}
        />
      );
      
      // Should render without errors
      expect(screen.getByPlaceholderText(/Search/i)).toBeInTheDocument();
    });
  });

  describe('Accessibility', () => {
    it('search input is focusable', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      const searchInput = screen.getByPlaceholderText(/Search/i);
      searchInput.focus();
      expect(document.activeElement).toBe(searchInput);
    });

    it('filter buttons are clickable', () => {
      render(<HorizontalFilterBar {...defaultProps} />);
      
      const typeButton = screen.getByText('Type');
      expect(typeButton).toBeEnabled();
    });
  });
});
