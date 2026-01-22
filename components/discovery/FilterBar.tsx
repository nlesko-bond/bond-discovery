'use client';

import { useState } from 'react';
import { ChevronDown, X, Search } from 'lucide-react';
import { DiscoveryFilters, FilterType, FilterOption } from '@/types';
import { getProgramTypeLabel, getSportLabel, cn } from '@/lib/utils';

interface FilterBarProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  options: {
    facilities: { id: string; name: string; count: number }[];
    sports: FilterOption[];
    programTypes: FilterOption[];
  };
  enabledFilters: FilterType[];
}

export function FilterBar({ 
  filters, 
  onFiltersChange, 
  options,
  enabledFilters 
}: FilterBarProps) {
  const [expanded, setExpanded] = useState<string | null>(null);

  const handleClearAll = () => {
    onFiltersChange({
      search: '',
      facilityIds: [],
      programTypes: [],
      sports: [],
      dateRange: {},
      ageRange: {},
      gender: 'all',
      availability: 'all',
      membershipRequired: null,
    });
  };

  const hasActiveFilters = 
    filters.search ||
    (filters.facilityIds?.length || 0) > 0 ||
    (filters.programTypes?.length || 0) > 0 ||
    (filters.sports?.length || 0) > 0 ||
    filters.dateRange?.start ||
    filters.dateRange?.end ||
    filters.ageRange?.min !== undefined ||
    filters.ageRange?.max !== undefined ||
    (filters.gender && filters.gender !== 'all') ||
    (filters.availability && filters.availability !== 'all');

  const isEnabled = (filter: FilterType) => enabledFilters.includes(filter);

  return (
    <div className="p-4">
      <div className="flex items-center justify-between mb-6">
        <h2 className="text-lg font-bold text-gray-900">Filters</h2>
        {hasActiveFilters && (
          <button
            onClick={handleClearAll}
            className="text-xs font-medium text-bond-gold hover:text-bond-gold-dark"
          >
            Clear All
          </button>
        )}
      </div>

      <div className="space-y-4">
        {/* Search */}
        {isEnabled('search') && (
          <div>
            <label className="label">Search</label>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
              <input
                type="text"
                placeholder="Search programs..."
                value={filters.search || ''}
                onChange={(e) => onFiltersChange({ ...filters, search: e.target.value })}
                className="input pl-9"
              />
              {filters.search && (
                <button
                  onClick={() => onFiltersChange({ ...filters, search: '' })}
                  className="absolute right-3 top-1/2 -translate-y-1/2"
                >
                  <X className="w-4 h-4 text-gray-400 hover:text-gray-600" />
                </button>
              )}
            </div>
          </div>
        )}

        {/* Facility Filter */}
        {isEnabled('facility') && options.facilities.length > 0 && (
          <FilterSection
            title="Facility"
            expanded={expanded === 'facility'}
            onToggle={() => setExpanded(expanded === 'facility' ? null : 'facility')}
            count={filters.facilityIds?.length || 0}
          >
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {options.facilities.map((facility) => (
                <label key={facility.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.facilityIds?.includes(facility.id) || false}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...(filters.facilityIds || []), facility.id]
                        : (filters.facilityIds || []).filter(f => f !== facility.id);
                      onFiltersChange({ ...filters, facilityIds: updated });
                    }}
                    className="w-4 h-4 accent-bond-gold rounded"
                  />
                  <span className="text-sm text-gray-700 flex-1">{facility.name}</span>
                  <span className="text-xs text-gray-400">({facility.count})</span>
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Program Type Filter */}
        {isEnabled('programType') && options.programTypes.length > 0 && (
          <FilterSection
            title="Program Type"
            expanded={expanded === 'programType'}
            onToggle={() => setExpanded(expanded === 'programType' ? null : 'programType')}
            count={filters.programTypes?.length || 0}
          >
            <div className="space-y-2">
              {options.programTypes.map((type) => (
                <label key={type.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.programTypes?.includes(type.id as any) || false}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...(filters.programTypes || []), type.id as any]
                        : (filters.programTypes || []).filter(t => t !== type.id);
                      onFiltersChange({ ...filters, programTypes: updated });
                    }}
                    className="w-4 h-4 accent-bond-gold rounded"
                  />
                  <span className="text-sm text-gray-700 capitalize flex-1">
                    {getProgramTypeLabel(type.id)}
                  </span>
                  <span className="text-xs text-gray-400">({type.count})</span>
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Sport Filter */}
        {isEnabled('sport') && options.sports.length > 0 && (
          <FilterSection
            title="Activity / Sport"
            expanded={expanded === 'sport'}
            onToggle={() => setExpanded(expanded === 'sport' ? null : 'sport')}
            count={filters.sports?.length || 0}
          >
            <div className="space-y-2 max-h-48 overflow-y-auto">
              {options.sports.map((sport) => (
                <label key={sport.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={filters.sports?.includes(sport.id) || false}
                    onChange={(e) => {
                      const updated = e.target.checked
                        ? [...(filters.sports || []), sport.id]
                        : (filters.sports || []).filter(s => s !== sport.id);
                      onFiltersChange({ ...filters, sports: updated });
                    }}
                    className="w-4 h-4 accent-bond-gold rounded"
                  />
                  <span className="text-sm text-gray-700 capitalize flex-1">
                    {getSportLabel(sport.id)}
                  </span>
                  <span className="text-xs text-gray-400">({sport.count})</span>
                </label>
              ))}
            </div>
          </FilterSection>
        )}

        {/* Age Filter */}
        {isEnabled('age') && (
          <FilterSection
            title="Age Range"
            expanded={expanded === 'age'}
            onToggle={() => setExpanded(expanded === 'age' ? null : 'age')}
            count={filters.ageRange?.min !== undefined || filters.ageRange?.max !== undefined ? 1 : 0}
          >
            <div className="flex items-center gap-2">
              <input
                type="number"
                placeholder="Min"
                min={0}
                max={99}
                value={filters.ageRange?.min ?? ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  ageRange: {
                    ...filters.ageRange,
                    min: e.target.value ? parseInt(e.target.value) : undefined,
                  },
                })}
                className="input w-20 text-center"
              />
              <span className="text-gray-400">to</span>
              <input
                type="number"
                placeholder="Max"
                min={0}
                max={99}
                value={filters.ageRange?.max ?? ''}
                onChange={(e) => onFiltersChange({
                  ...filters,
                  ageRange: {
                    ...filters.ageRange,
                    max: e.target.value ? parseInt(e.target.value) : undefined,
                  },
                })}
                className="input w-20 text-center"
              />
            </div>
          </FilterSection>
        )}

        {/* Date Range Filter */}
        {isEnabled('dateRange') && (
          <FilterSection
            title="Date Range"
            expanded={expanded === 'date'}
            onToggle={() => setExpanded(expanded === 'date' ? null : 'date')}
            count={filters.dateRange?.start || filters.dateRange?.end ? 1 : 0}
          >
            <div className="space-y-2">
              <div>
                <label className="text-xs font-medium text-gray-700">From</label>
                <input
                  type="date"
                  value={filters.dateRange?.start || ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    dateRange: { ...filters.dateRange, start: e.target.value },
                  })}
                  className="input"
                />
              </div>
              <div>
                <label className="text-xs font-medium text-gray-700">To</label>
                <input
                  type="date"
                  value={filters.dateRange?.end || ''}
                  onChange={(e) => onFiltersChange({
                    ...filters,
                    dateRange: { ...filters.dateRange, end: e.target.value },
                  })}
                  className="input"
                />
              </div>
            </div>
          </FilterSection>
        )}

        {/* Availability Filter */}
        {isEnabled('availability') && (
          <FilterSection
            title="Availability"
            expanded={expanded === 'availability'}
            onToggle={() => setExpanded(expanded === 'availability' ? null : 'availability')}
            count={filters.availability && filters.availability !== 'all' ? 1 : 0}
          >
            <div className="space-y-2">
              {[
                { id: 'all', label: 'All Programs' },
                { id: 'available', label: 'Has Open Spots' },
                { id: 'almost_full', label: 'Almost Full (< 5 spots)' },
              ].map((option) => (
                <label key={option.id} className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="radio"
                    name="availability"
                    checked={filters.availability === option.id || (!filters.availability && option.id === 'all')}
                    onChange={() => onFiltersChange({ ...filters, availability: option.id as any })}
                    className="w-4 h-4 accent-bond-gold"
                  />
                  <span className="text-sm text-gray-700">{option.label}</span>
                </label>
              ))}
            </div>
          </FilterSection>
        )}
      </div>
    </div>
  );
}

// Filter section component
interface FilterSectionProps {
  title: string;
  expanded: boolean;
  onToggle: () => void;
  count: number;
  children: React.ReactNode;
}

function FilterSection({ title, expanded, onToggle, count, children }: FilterSectionProps) {
  return (
    <div className="border-b border-gray-200 pb-4 last:border-b-0 last:pb-0">
      <button
        onClick={onToggle}
        className="w-full flex items-center justify-between text-sm font-semibold text-gray-900 hover:text-bond-gold transition-colors"
      >
        <div className="flex items-center gap-2">
          <span>{title}</span>
          {count > 0 && (
            <span className="text-xs font-bold px-2 py-0.5 bg-bond-gold text-white rounded-full">
              {count}
            </span>
          )}
        </div>
        <ChevronDown
          size={16}
          className={cn('transition-transform', expanded && 'rotate-180')}
        />
      </button>

      {expanded && <div className="mt-3">{children}</div>}
    </div>
  );
}
