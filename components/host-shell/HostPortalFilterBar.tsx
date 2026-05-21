'use client';

import { Search, SlidersHorizontal, X } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters, ProgramType } from '@/types';
import { getProgramTypeLabel, getSportLabel, cn } from '@/lib/utils';
import { resolvePortalBrandColors } from '@/lib/host-shell/portal-branding';
import type { IPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';

interface IHostPortalFilterBarProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  options: IPortalFilterOptions;
  config: DiscoveryConfig;
  resultCount: number;
  onOpenFiltersPanel: () => void;
  isScheduleView: boolean;
}

export function HostPortalFilterBar({
  filters,
  onFiltersChange,
  options,
  config,
  resultCount,
  onOpenFiltersPanel,
  isScheduleView,
}: IHostPortalFilterBarProps) {
  const { secondaryColor, primaryColor } = resolvePortalBrandColors(config);
  const configFilters = config.features.enableFilters || [
    'search',
    'facility',
    'programType',
    'sport',
    'age',
    'dateRange',
    'program',
  ];
  const enabledFilters = isScheduleView
    ? configFilters.filter((filterId) => filterId !== 'age')
    : configFilters;
  const showSearch = config.features.showSearch !== false;

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
      filters.programIds?.length ||
      filters.sessionIds?.length ||
      (filters.gender && filters.gender !== 'all') ||
      (filters.availability && filters.availability !== 'all') ||
      filters.dateRange?.start ||
      filters.dateRange?.end ||
      filters.ageRange?.min !== undefined ||
      filters.ageRange?.max !== undefined,
  );

  const advancedFilterCount = [
    filters.programIds?.length || 0,
    filters.sessionIds?.length || 0,
    filters.gender && filters.gender !== 'all' ? 1 : 0,
    filters.availability && filters.availability !== 'all' ? 1 : 0,
    filters.dateRange?.start || filters.dateRange?.end ? 1 : 0,
    !isScheduleView && (filters.ageRange?.min !== undefined || filters.ageRange?.max !== undefined)
      ? 1
      : 0,
  ].reduce((sum, value) => sum + value, 0);

  const showFacilityChips =
    enabledFilters.includes('facility') && options.facilities.length > 0;

  return (
    <div
      className="border-b px-3 py-3 sm:px-4"
      style={{ backgroundColor: '#ffffff', borderColor: `${primaryColor}18` }}
    >
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <button
          type="button"
          className="inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors"
          style={{
            borderColor: `${secondaryColor}40`,
            color: primaryColor,
            backgroundColor: `${secondaryColor}10`,
          }}
          onClick={onOpenFiltersPanel}
        >
          <SlidersHorizontal size={14} />
          Filters
          {advancedFilterCount > 0 && (
            <span
              className="px-1.5 py-0.5 rounded-full text-[10px] font-bold text-white"
              style={{ backgroundColor: secondaryColor }}
            >
              {advancedFilterCount}
            </span>
          )}
        </button>
        {hasActiveFilters && (
          <button
            type="button"
            className="inline-flex items-center gap-1 px-2 py-1 text-xs text-gray-500 hover:text-gray-800"
            onClick={clearFilters}
          >
            <X size={12} />
            Clear all
          </button>
        )}
        <span className="text-xs text-gray-500 ml-auto">
          {resultCount} {isScheduleView ? 'events' : 'sessions'}
        </span>
      </div>

      {showSearch && enabledFilters.includes('search') && (
        <div className="relative mb-3">
          <Search size={16} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2"
            style={{ outlineColor: secondaryColor }}
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
        {showFacilityChips &&
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
                style={active ? { backgroundColor: secondaryColor } : undefined}
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
                style={active ? { backgroundColor: secondaryColor } : undefined}
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
                style={active ? { backgroundColor: secondaryColor } : undefined}
                onClick={() => toggleListFilter('sports', sportOption.id)}
              >
                {getSportLabel(sportOption.id)}
              </button>
            );
          })}
      </div>
    </div>
  );
}
