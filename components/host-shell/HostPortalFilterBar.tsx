'use client';

import { Search, X } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters, ProgramType } from '@/types';
import { getProgramTypeLabel, getSportLabel, cn } from '@/lib/utils';
import type { IPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';

interface IHostPortalFilterBarProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  options: IPortalFilterOptions;
  config: DiscoveryConfig;
  resultCount: number;
}

const CHIP_ACTIVE_CLASS = 'ring-2 ring-offset-1';

export function HostPortalFilterBar({
  filters,
  onFiltersChange,
  options,
  config,
  resultCount,
}: IHostPortalFilterBarProps) {
  const enabledFilters = config.features.enableFilters || ['search', 'facility', 'programType', 'sport'];
  const showSearch = config.features.showSearch !== false;
  const brandColor = config.branding.secondaryColor || '#6366F1';

  const toggleListFilter = (
    key: 'facilityIds' | 'programTypes' | 'sports' | 'programIds',
    id: string,
  ) => {
    const current = (filters[key] as string[] | undefined) ?? [];
    const next = current.includes(id) ? current.filter((item) => item !== id) : [...current, id];
    onFiltersChange({
      ...filters,
      [key]: next.length > 0 ? next : undefined,
    });
  };

  const clearFilters = () => {
    onFiltersChange({
      search: '',
      programIds: [],
      sessionIds: [],
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

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.facilityIds?.length ||
      filters.programTypes?.length ||
      filters.sports?.length ||
      filters.programIds?.length,
  );

  return (
    <div className="bg-white border-b border-gray-200 px-3 py-3 sm:px-4">
      {showSearch && enabledFilters.includes('search') && (
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500/30"
            placeholder="Search sessions..."
            value={filters.search ?? ''}
            onChange={(event) =>
              onFiltersChange({ ...filters, search: event.target.value || undefined })
            }
            aria-label="Search sessions"
          />
        </div>
      )}

      <div className="flex flex-wrap gap-2 items-center">
        {enabledFilters.includes('facility') &&
          options.hasMultipleFacilities &&
          options.facilities.map((facility) => {
            const active = filters.facilityIds?.includes(facility.id);
            return (
              <button
                key={facility.id}
                type="button"
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                  active
                    ? 'text-white border-transparent'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300',
                )}
                style={active ? { backgroundColor: brandColor } : undefined}
                onClick={() => toggleListFilter('facilityIds', facility.id)}
              >
                {facility.name}
              </button>
            );
          })}

        {enabledFilters.includes('programType') &&
          options.programTypes.map((typeOption) => {
            const active = filters.programTypes?.includes(typeOption.id as ProgramType);
            return (
              <button
                key={typeOption.id}
                type="button"
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                  active
                    ? 'text-white border-transparent'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300',
                )}
                style={active ? { backgroundColor: brandColor } : undefined}
                onClick={() => toggleListFilter('programTypes', typeOption.id)}
              >
                {getProgramTypeLabel(typeOption.id)}
              </button>
            );
          })}

        {enabledFilters.includes('sport') &&
          options.sports.map((sportOption) => {
            const active = filters.sports?.includes(sportOption.id);
            return (
              <button
                key={sportOption.id}
                type="button"
                className={cn(
                  'px-2.5 py-1 text-xs font-medium rounded-full border transition-colors',
                  active
                    ? 'text-white border-transparent'
                    : 'bg-gray-50 text-gray-700 border-gray-200 hover:border-gray-300',
                )}
                style={active ? { backgroundColor: brandColor } : undefined}
                onClick={() => toggleListFilter('sports', sportOption.id)}
              >
                {getSportLabel(sportOption.id)}
              </button>
            );
          })}

        {hasActiveFilters && (
          <button
            type="button"
            className="flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-800"
            onClick={clearFilters}
          >
            <X size={12} />
            Clear
          </button>
        )}
      </div>

      <p className="text-xs text-gray-500 mt-2">
        {resultCount} session{resultCount === 1 ? '' : 's'}
      </p>
    </div>
  );
}
