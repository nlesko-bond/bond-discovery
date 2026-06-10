'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  MapPin,
  Search,
  SlidersHorizontal,
  Tag,
  Users,
  X,
} from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters, Program, ProgramType } from '@/types';
import { cn, getProgramTypeLabel } from '@/lib/utils';
import type { IPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import {
  buildV2GenderOptions,
  countSessionsPerAgeBucket,
  formatActivityLabel,
} from '@/lib/host-shell/portal-v2';
import { HostPortalMultiSelectDropdown } from '../HostPortalMultiSelectDropdown';

interface IHostPortalV2FilterBarProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  options: IPortalFilterOptions;
  programs: Program[];
  config: DiscoveryConfig;
  accentColor: string;
  resultCount: number;
  isScheduleView: boolean;
}

const SECONDARY_DROPDOWN_CLASS = 'min-w-[8.5rem]';

export function HostPortalV2FilterBar({
  filters,
  onFiltersChange,
  options,
  programs,
  config,
  accentColor,
  resultCount,
  isScheduleView,
}: IHostPortalV2FilterBarProps) {
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.search ?? '');
  const filtersRef = useRef(filters);
  const onFiltersChangeRef = useRef(onFiltersChange);

  useEffect(() => {
    filtersRef.current = filters;
    onFiltersChangeRef.current = onFiltersChange;
  }, [filters, onFiltersChange]);

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchQuery !== (filtersRef.current.search ?? '')) {
        onFiltersChangeRef.current({
          ...filtersRef.current,
          search: searchQuery || undefined,
        });
      }
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  useEffect(() => {
    if (filters.search !== undefined && filters.search !== searchQuery) {
      setSearchQuery(filters.search);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filters.search]);

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
  const showSearch = config.features.showSearch !== false && enabledFilters.includes('search');

  const ageBucketOptions = countSessionsPerAgeBucket(programs).filter(
    (bucket) => bucket.count > 0,
  );
  const genderOptions = buildV2GenderOptions(programs);

  const activeSports = filters.sports ?? [];
  const showActivityChips = enabledFilters.includes('sport') && options.sports.length > 1;

  const toggleSport = (sportId: string | null) => {
    if (sportId === null) {
      onFiltersChange({ ...filters, sports: undefined });
      return;
    }
    const next = activeSports.includes(sportId)
      ? activeSports.filter((id) => id !== sportId)
      : [...activeSports, sportId];
    onFiltersChange({ ...filters, sports: next.length > 0 ? next : undefined });
  };

  const hasActiveSecondaryFilters = Boolean(
    filters.facilityIds?.length ||
      filters.programTypes?.length ||
      filters.genders?.length ||
      filters.ageBucketIds?.length ||
      filters.dateRange?.start ||
      filters.dateRange?.end,
  );

  const hasActiveFilters = Boolean(
    filters.search || activeSports.length > 0 || hasActiveSecondaryFilters,
  );

  const clearAllFilters = () => {
    onFiltersChange({
      ...filters,
      search: '',
      programIds: [],
      sessionIds: [],
      facilityIds: [],
      programTypes: [],
      sports: [],
      dateRange: {},
      ageRange: {},
      ageBucketIds: [],
      gender: 'all',
      genders: [],
      availability: 'all',
      availabilityModes: [],
      spaceNames: undefined,
    });
    setSearchQuery('');
    setOpenDropdownId(null);
    setMobileSheetOpen(false);
  };

  const secondaryFilterGroups = (
    <>
      {enabledFilters.includes('age') && ageBucketOptions.length > 0 && (
        <HostPortalMultiSelectDropdown
          label="Age"
          icon={<Users size={15} />}
          options={ageBucketOptions.map((bucket) => ({
            id: bucket.id,
            label: bucket.label,
            count: bucket.count,
          }))}
          selectedIds={filters.ageBucketIds ?? []}
          onChange={(ageBucketIds) =>
            onFiltersChange({
              ...filters,
              ageBucketIds: ageBucketIds.length > 0 ? ageBucketIds : undefined,
              ageRange: {},
            })
          }
          isOpen={openDropdownId === 'age'}
          onOpenChange={(open) => setOpenDropdownId(open ? 'age' : null)}
          brandColor={accentColor}
          className={SECONDARY_DROPDOWN_CLASS}
        />
      )}

      {enabledFilters.includes('gender') && genderOptions.length > 0 && (
        <HostPortalMultiSelectDropdown
          label="Gender"
          icon={<Users size={15} />}
          options={genderOptions}
          selectedIds={filters.genders ?? []}
          onChange={(genders) =>
            onFiltersChange({
              ...filters,
              genders:
                genders.length > 0 ? (genders as DiscoveryFilters['genders']) : undefined,
              gender: 'all',
            })
          }
          isOpen={openDropdownId === 'gender'}
          onOpenChange={(open) => setOpenDropdownId(open ? 'gender' : null)}
          brandColor={accentColor}
          className={SECONDARY_DROPDOWN_CLASS}
        />
      )}

      {enabledFilters.includes('facility') && options.facilities.length > 1 && (
        <HostPortalMultiSelectDropdown
          label="Location"
          icon={<MapPin size={15} />}
          options={options.facilities.map((facility) => ({
            id: facility.id,
            label: facility.name,
            count: facility.count,
          }))}
          selectedIds={filters.facilityIds ?? []}
          onChange={(facilityIds) =>
            onFiltersChange({
              ...filters,
              facilityIds: facilityIds.length > 0 ? facilityIds : undefined,
            })
          }
          isOpen={openDropdownId === 'facility'}
          onOpenChange={(open) => setOpenDropdownId(open ? 'facility' : null)}
          brandColor={accentColor}
          className={SECONDARY_DROPDOWN_CLASS}
        />
      )}

      {enabledFilters.includes('programType') && options.programTypes.length > 1 && (
        <HostPortalMultiSelectDropdown
          label="Type"
          icon={<Tag size={15} />}
          options={options.programTypes.map((typeOption) => ({
            id: typeOption.id,
            label: getProgramTypeLabel(typeOption.id),
            count: typeOption.count,
          }))}
          selectedIds={(filters.programTypes as string[] | undefined) ?? []}
          onChange={(programTypes) =>
            onFiltersChange({
              ...filters,
              programTypes:
                programTypes.length > 0 ? (programTypes as ProgramType[]) : undefined,
            })
          }
          isOpen={openDropdownId === 'programType'}
          onOpenChange={(open) => setOpenDropdownId(open ? 'programType' : null)}
          brandColor={accentColor}
          className={SECONDARY_DROPDOWN_CLASS}
        />
      )}
    </>
  );

  const dateInputs = enabledFilters.includes('dateRange') && (
    <div className="flex items-center gap-2">
      <Calendar size={15} className="shrink-0 text-gray-400" aria-hidden />
      <input
        type="date"
        aria-label="From date"
        value={filters.dateRange?.start ?? ''}
        onChange={(event) =>
          onFiltersChange({
            ...filters,
            dateRange: { ...filters.dateRange, start: event.target.value || undefined },
          })
        }
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2"
        style={{ ['--tw-ring-color' as string]: `${accentColor}55` }}
      />
      <span className="text-xs text-gray-400">to</span>
      <input
        type="date"
        aria-label="To date"
        value={filters.dateRange?.end ?? ''}
        onChange={(event) =>
          onFiltersChange({
            ...filters,
            dateRange: { ...filters.dateRange, end: event.target.value || undefined },
          })
        }
        className="w-full rounded-lg border border-gray-200 px-2 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2"
        style={{ ['--tw-ring-color' as string]: `${accentColor}55` }}
      />
    </div>
  );

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
        {showSearch && (
          <div className="relative mb-3">
            <Search
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search programs..."
              aria-label="Search programs"
              className="w-full rounded-lg border border-gray-200 bg-gray-50 py-2 pl-9 pr-9 text-sm text-gray-900 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: `${accentColor}55` }}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </div>
        )}

        {/* Activity chips: the hero filter (one tap, always visible, horizontal scroll). */}
        {showActivityChips && (
          <div
            className="-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
            role="group"
            aria-label="Filter by activity"
          >
            <button
              type="button"
              data-testid="portal-v2-activity-chip"
              data-activity-id="all"
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                activeSports.length === 0
                  ? 'border-transparent text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
              )}
              style={
                activeSports.length === 0 ? { backgroundColor: accentColor } : undefined
              }
              aria-pressed={activeSports.length === 0}
              onClick={() => toggleSport(null)}
            >
              All
            </button>
            {options.sports.map((sport) => {
              const isActive = activeSports.includes(sport.id);
              return (
                <button
                  key={sport.id}
                  type="button"
                  data-testid="portal-v2-activity-chip"
                  data-activity-id={sport.id}
                  className={cn(
                    'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium transition-colors',
                    isActive
                      ? 'border-transparent text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                  style={isActive ? { backgroundColor: accentColor } : undefined}
                  aria-pressed={isActive}
                  onClick={() => toggleSport(sport.id)}
                >
                  {formatActivityLabel(sport.id)}
                </button>
              );
            })}
          </div>
        )}

        {/* Secondary filters: pill dropdowns on desktop, in-flow sheet on mobile. */}
        <div className="flex flex-wrap items-center gap-2">
          <div className="hidden flex-wrap items-center gap-2 sm:flex">
            {secondaryFilterGroups}
            {dateInputs && <div className="min-w-[15rem]">{dateInputs}</div>}
          </div>

          <button
            type="button"
            className={cn(
              'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium transition-colors sm:hidden',
              hasActiveSecondaryFilters || mobileSheetOpen
                ? 'text-white'
                : 'border-gray-200 bg-white text-gray-700',
            )}
            style={
              hasActiveSecondaryFilters || mobileSheetOpen
                ? { backgroundColor: accentColor, borderColor: accentColor }
                : undefined
            }
            aria-expanded={mobileSheetOpen}
            onClick={() => setMobileSheetOpen((open) => !open)}
          >
            <SlidersHorizontal size={14} aria-hidden />
            Filters
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-full px-3 text-[13px] font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            >
              <X size={13} aria-hidden />
              Clear all
            </button>
          )}

          <span
            data-testid="portal-v2-result-count"
            className="ml-auto text-xs font-medium text-gray-500"
          >
            {resultCount} {isScheduleView ? 'events' : resultCount === 1 ? 'program' : 'programs'}
          </span>
        </div>

        {/* Mobile filter sheet: rendered in-flow inside the iframe (never position:fixed). */}
        {mobileSheetOpen && (
          <div className="mt-3 space-y-3 rounded-xl border border-gray-200 bg-gray-50 p-3 sm:hidden">
            <div className="flex flex-wrap gap-2">{secondaryFilterGroups}</div>
            {dateInputs}
            <button
              type="button"
              className="w-full rounded-lg py-2 text-center text-[13px] font-medium text-white"
              style={{ backgroundColor: accentColor }}
              onClick={() => setMobileSheetOpen(false)}
            >
              Done
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
