'use client';

import { useState, useRef, useEffect } from 'react';
import { 
  ChevronDown, 
  X, 
  MapPin, 
  Layers, 
  Activity, 
  Users, 
  Calendar,
  Filter,
  Check,
  Tag,
  Search
} from 'lucide-react';
import { DiscoveryFilters, DiscoveryConfig } from '@/types';
import { cn, getProgramTypeLabel, getSportLabel } from '@/lib/utils';

interface FilterOption {
  id: string;
  name: string;
  count?: number;
}

interface FilterOptions {
  facilities: FilterOption[];
  programTypes: FilterOption[];
  sports: FilterOption[];
  programs: FilterOption[];
  ages: { min: number; max: number }[];
}

interface HorizontalFilterBarProps {
  filters: DiscoveryFilters;
  onFilterChange: (filters: DiscoveryFilters) => void;
  filterOptions: FilterOptions;
  config: DiscoveryConfig;
}

export function HorizontalFilterBar({
  filters,
  onFilterChange,
  filterOptions,
  config,
}: HorizontalFilterBarProps) {
  const [openDropdown, setOpenDropdown] = useState<string | null>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Count active filters
  const activeFilterCount = [
    filters.facilityIds?.length || 0,
    filters.programIds?.length || 0,
    filters.programTypes?.length || 0,
    filters.sports?.length || 0,
    (filters.ageRange?.min || filters.ageRange?.max) ? 1 : 0,
    filters.dateRange?.start || filters.dateRange?.end ? 1 : 0,
  ].reduce((a, b) => a + b, 0);

  // Close dropdown when clicking outside
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setOpenDropdown(null);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  const handleMultiSelect = (
    key: 'facilityIds' | 'programIds' | 'programTypes' | 'sports',
    value: string
  ) => {
    const current = (filters[key] || []) as string[];
    const newValues = current.includes(value)
      ? current.filter(v => v !== value)
      : [...current, value];
    
    onFilterChange({
      ...filters,
      [key]: newValues.length > 0 ? newValues : undefined,
    } as DiscoveryFilters);
  };

  const clearFilter = (key: string) => {
    const newFilters = { ...filters };
    if (key === 'facilityIds') newFilters.facilityIds = undefined;
    if (key === 'programIds') newFilters.programIds = undefined;
    if (key === 'programTypes') newFilters.programTypes = undefined;
    if (key === 'sports') newFilters.sports = undefined;
    if (key === 'age') {
      newFilters.ageRange = undefined;
    }
    if (key === 'date') {
      newFilters.dateRange = undefined;
    }
    onFilterChange(newFilters);
  };

  const clearAllFilters = () => {
    onFilterChange({
      search: filters.search,
    });
  };

  return (
    <div className="space-y-3">
      {/* Filter Buttons Row */}
      <div ref={dropdownRef} className="flex flex-wrap items-center gap-2">
        {/* Facility Filter */}
        {filterOptions.facilities.length > 0 && (
          <FilterDropdown
            label="Location"
            icon={<MapPin size={14} />}
            isOpen={openDropdown === 'facility'}
            onToggle={() => setOpenDropdown(openDropdown === 'facility' ? null : 'facility')}
            hasSelection={(filters.facilityIds?.length || 0) > 0}
            selectionCount={filters.facilityIds?.length}
          >
            <div className="p-2 max-h-64 overflow-y-auto">
              {filterOptions.facilities.map(facility => (
                <button
                  key={facility.id}
                  onClick={() => handleMultiSelect('facilityIds', facility.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors',
                    filters.facilityIds?.includes(facility.id)
                      ? 'bg-toca-purple/10 text-toca-purple'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <span className="truncate">{facility.name}</span>
                  <div className="flex items-center gap-2">
                    {facility.count !== undefined && (
                      <span className="text-xs text-gray-400">{facility.count}</span>
                    )}
                    {filters.facilityIds?.includes(facility.id) && (
                      <Check size={14} className="text-toca-purple" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </FilterDropdown>
        )}

        {/* Program Filter */}
        {filterOptions.programs.length > 0 && (
          <FilterDropdown
            label="Program"
            icon={<Tag size={14} />}
            isOpen={openDropdown === 'program'}
            onToggle={() => setOpenDropdown(openDropdown === 'program' ? null : 'program')}
            hasSelection={(filters.programIds?.length || 0) > 0}
            selectionCount={filters.programIds?.length}
          >
            <div className="p-2 max-h-64 overflow-y-auto">
              {filterOptions.programs.map(program => (
                <button
                  key={program.id}
                  onClick={() => handleMultiSelect('programIds', program.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors',
                    filters.programIds?.includes(program.id)
                      ? 'bg-toca-purple/10 text-toca-purple'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <span className="truncate">{program.name}</span>
                  {filters.programIds?.includes(program.id) && (
                    <Check size={14} className="text-toca-purple" />
                  )}
                </button>
              ))}
            </div>
          </FilterDropdown>
        )}

        {/* Program Type Filter */}
        {filterOptions.programTypes.length > 0 && (
          <FilterDropdown
            label="Type"
            icon={<Layers size={14} />}
            isOpen={openDropdown === 'type'}
            onToggle={() => setOpenDropdown(openDropdown === 'type' ? null : 'type')}
            hasSelection={(filters.programTypes?.length || 0) > 0}
            selectionCount={filters.programTypes?.length}
          >
            <div className="p-2">
              {filterOptions.programTypes.map(type => (
                <button
                  key={type.id}
                  onClick={() => handleMultiSelect('programTypes', type.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors',
                    (filters.programTypes as string[] | undefined)?.includes(type.id)
                      ? 'bg-toca-purple/10 text-toca-purple'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <span>{getProgramTypeLabel(type.id as any)}</span>
                  <div className="flex items-center gap-2">
                    {type.count !== undefined && (
                      <span className="text-xs text-gray-400">{type.count}</span>
                    )}
                    {(filters.programTypes as string[] | undefined)?.includes(type.id) && (
                      <Check size={14} className="text-toca-purple" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </FilterDropdown>
        )}

        {/* Sport Filter */}
        {filterOptions.sports.length > 0 && (
          <FilterDropdown
            label="Activity"
            icon={<Activity size={14} />}
            isOpen={openDropdown === 'sport'}
            onToggle={() => setOpenDropdown(openDropdown === 'sport' ? null : 'sport')}
            hasSelection={(filters.sports?.length || 0) > 0}
            selectionCount={filters.sports?.length}
          >
            <div className="p-2 max-h-64 overflow-y-auto">
              {filterOptions.sports.map(sport => (
                <button
                  key={sport.id}
                  onClick={() => handleMultiSelect('sports', sport.id)}
                  className={cn(
                    'w-full text-left px-3 py-2 rounded-lg text-sm flex items-center justify-between gap-2 transition-colors',
                    filters.sports?.includes(sport.id)
                      ? 'bg-toca-purple/10 text-toca-purple'
                      : 'hover:bg-gray-50'
                  )}
                >
                  <span>{getSportLabel(sport.id)}</span>
                  <div className="flex items-center gap-2">
                    {sport.count !== undefined && (
                      <span className="text-xs text-gray-400">{sport.count}</span>
                    )}
                    {filters.sports?.includes(sport.id) && (
                      <Check size={14} className="text-toca-purple" />
                    )}
                  </div>
                </button>
              ))}
            </div>
          </FilterDropdown>
        )}

        {/* Age Filter */}
        <FilterDropdown
          label="Age"
          icon={<Users size={14} />}
          isOpen={openDropdown === 'age'}
          onToggle={() => setOpenDropdown(openDropdown === 'age' ? null : 'age')}
          hasSelection={!!(filters.ageRange?.min || filters.ageRange?.max)}
        >
          <div className="p-3 space-y-3">
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Min Age</label>
              <input
                type="number"
                min={0}
                max={99}
                value={filters.ageRange?.min || ''}
                onChange={(e) => onFilterChange({
                  ...filters,
                  ageRange: {
                    ...filters.ageRange,
                    min: e.target.value ? parseInt(e.target.value) : undefined,
                  },
                })}
                placeholder="Any"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-toca-purple focus:border-transparent"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 mb-1 block">Max Age</label>
              <input
                type="number"
                min={0}
                max={99}
                value={filters.ageRange?.max || ''}
                onChange={(e) => onFilterChange({
                  ...filters,
                  ageRange: {
                    ...filters.ageRange,
                    max: e.target.value ? parseInt(e.target.value) : undefined,
                  },
                })}
                placeholder="Any"
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-toca-purple focus:border-transparent"
              />
            </div>
          </div>
        </FilterDropdown>

        {/* Clear All */}
        {activeFilterCount > 0 && (
          <button
            onClick={clearAllFilters}
            className="flex items-center gap-1.5 px-3 py-2 text-sm text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X size={14} />
            Clear all
          </button>
        )}
      </div>

      {/* Active Filter Chips */}
      {activeFilterCount > 0 && (
        <div className="flex flex-wrap items-center gap-2">
          {/* Facility Chips */}
          {filters.facilityIds?.map(id => {
            const facility = filterOptions.facilities.find(f => f.id === id);
            return facility ? (
              <FilterChip
                key={`facility-${id}`}
                label={facility.name}
                onRemove={() => handleMultiSelect('facilityIds', id)}
              />
            ) : null;
          })}

          {/* Program Chips */}
          {filters.programIds?.map(id => {
            const program = filterOptions.programs.find(p => p.id === id);
            return program ? (
              <FilterChip
                key={`program-${id}`}
                label={program.name}
                onRemove={() => handleMultiSelect('programIds', id)}
              />
            ) : null;
          })}

          {/* Type Chips */}
          {filters.programTypes?.map(type => (
            <FilterChip
              key={`type-${type}`}
              label={getProgramTypeLabel(type as any)}
              onRemove={() => handleMultiSelect('programTypes', type)}
            />
          ))}

          {/* Sport Chips */}
          {filters.sports?.map(sport => (
            <FilterChip
              key={`sport-${sport}`}
              label={getSportLabel(sport)}
              onRemove={() => handleMultiSelect('sports', sport)}
            />
          ))}

          {/* Age Chip */}
          {(filters.ageRange?.min || filters.ageRange?.max) && (
            <FilterChip
              label={`Ages ${filters.ageRange?.min || 0}-${filters.ageRange?.max || '∞'}`}
              onRemove={() => clearFilter('age')}
            />
          )}

          {/* Date Chip */}
          {(filters.dateRange?.start || filters.dateRange?.end) && (
            <FilterChip
              label="Date Range"
              onRemove={() => clearFilter('date')}
            />
          )}
        </div>
      )}
    </div>
  );
}

// Filter Dropdown Component
function FilterDropdown({
  label,
  icon,
  isOpen,
  onToggle,
  hasSelection,
  selectionCount,
  children,
}: {
  label: string;
  icon: React.ReactNode;
  isOpen: boolean;
  onToggle: () => void;
  hasSelection?: boolean;
  selectionCount?: number;
  children: React.ReactNode;
}) {
  return (
    <div className="relative">
      <button
        onClick={onToggle}
        className={cn(
          'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium border transition-all',
          hasSelection
            ? 'bg-toca-purple/10 border-toca-purple/30 text-toca-purple'
            : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
        )}
      >
        {icon}
        <span>{label}</span>
        {selectionCount != null && selectionCount > 0 && (
          <span className="bg-toca-purple text-white text-xs font-bold px-1.5 py-0.5 rounded-full min-w-[20px] text-center">
            {selectionCount}
          </span>
        )}
        <ChevronDown size={14} className={cn('transition-transform', isOpen && 'rotate-180')} />
      </button>

      {isOpen && (
        <div className="fixed sm:absolute top-auto sm:top-full left-0 right-0 sm:right-auto sm:left-0 mt-1 bg-white rounded-xl shadow-xl border border-gray-200 min-w-[200px] z-[100] animate-fade-in max-h-[60vh] overflow-y-auto">
          {children}
        </div>
      )}
    </div>
  );
}

// Filter Chip Component
function FilterChip({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-toca-purple/10 text-toca-purple text-sm font-medium rounded-full">
      {label}
      <button
        onClick={onRemove}
        className="hover:bg-toca-purple/20 rounded-full p-0.5 transition-colors"
      >
        <X size={12} />
      </button>
    </span>
  );
}

export default HorizontalFilterBar;
