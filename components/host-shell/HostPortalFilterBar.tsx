'use client';

import { useEffect, useRef, useState } from 'react';
import {
  Calendar,
  ChevronDown,
  MapPin,
  Search,
  SlidersHorizontal,
  Tag,
  Trophy,
  Users,
  X,
} from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters, ProgramType } from '@/types';
import { cn, getProgramTypeLabel, getSportLabel } from '@/lib/utils';
import { resolvePortalBrandColors } from '@/lib/host-shell/portal-branding';
import { PORTAL_AGE_BUCKETS } from '@/lib/host-shell/portal-age-buckets';
import type { IPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import { HostPortalMultiSelectDropdown } from './HostPortalMultiSelectDropdown';

const GENDER_FILTER_OPTIONS = [
  { id: 'coed', label: 'Co-ed' },
  { id: 'male', label: 'Boys' },
  { id: 'female', label: 'Girls' },
] as const;

const AVAILABILITY_FILTER_OPTIONS = [
  { id: 'available', label: 'Has open spots' },
  { id: 'almost_full', label: 'Almost full' },
] as const;

interface IHostPortalFilterBarProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  options: IPortalFilterOptions;
  config: DiscoveryConfig;
  resultCount: number;
  isScheduleView: boolean;
  scheduleSpaces?: { id: string; name: string; count?: number }[];
}

export function HostPortalFilterBar({
  filters,
  onFiltersChange,
  options,
  config,
  resultCount,
  isScheduleView,
  scheduleSpaces = [],
}: IHostPortalFilterBarProps) {
  const { secondaryColor, primaryColor } = resolvePortalBrandColors(config);
  const [openDropdownId, setOpenDropdownId] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState(filters.search ?? '');
  const barRef = useRef<HTMLDivElement>(null);
  const filtersRef = useRef(filters);
  const onFiltersChangeRef = useRef(onFiltersChange);

  useEffect(() => {
    filtersRef.current = filters;
    onFiltersChangeRef.current = onFiltersChange;
  }, [filters, onFiltersChange]);

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
  const spaceFilterLabel = config.features.spaceColumnLabel?.trim() || 'Space';

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
  }, [filters.search]);

  const clearAllFilters = () => {
    onFiltersChange({
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
      membershipRequired: null,
      spaceNames: undefined,
    });
    setSearchQuery('');
    setOpenDropdownId(null);
  };

  const hasActiveFilters = Boolean(
    filters.search ||
      filters.facilityIds?.length ||
      filters.programTypes?.length ||
      filters.sports?.length ||
      filters.programIds?.length ||
      filters.sessionIds?.length ||
      filters.genders?.length ||
      filters.ageBucketIds?.length ||
      filters.availabilityModes?.length ||
      (filters.availability && filters.availability !== 'all') ||
      filters.dateRange?.start ||
      filters.dateRange?.end ||
      filters.spaceNames?.length,
  );

  const visiblePrograms = options.programs.filter((program) => {
    if (!filters.facilityIds?.length) {
      return true;
    }
    return !program.facilityId || filters.facilityIds.includes(program.facilityId);
  });

  const visibleSessions = options.sessions.filter((session) => {
    if (!filters.programIds?.length) {
      return false;
    }
    return filters.programIds.includes(session.programId);
  });

  const [datePanelOpen, setDatePanelOpen] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handlePointerDown = (event: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(event.target as Node)) {
        setDatePanelOpen(false);
      }
    };
    if (datePanelOpen) {
      document.addEventListener('mousedown', handlePointerDown);
    }
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [datePanelOpen]);

  const hasDateFilter = Boolean(filters.dateRange?.start || filters.dateRange?.end);

  return (
    <div ref={barRef} className="border-b border-gray-200/80 bg-white/90 backdrop-blur-sm">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4 sm:py-4">
        {showSearch && enabledFilters.includes('search') && (
          <div className="relative mb-3">
            <Search
              size={18}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder={isScheduleView ? 'Search events...' : 'Search sessions...'}
              aria-label="Search"
              className="w-full rounded-xl border border-gray-200 bg-gray-50/80 py-2.5 pl-10 pr-10 text-sm text-gray-900 shadow-sm transition-colors placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2"
              style={{ ['--tw-ring-color' as string]: `${secondaryColor}55` }}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-gray-400 hover:bg-gray-100 hover:text-gray-600"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={16} />
              </button>
            )}
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          {enabledFilters.includes('facility') && options.facilities.length > 0 && (
            <HostPortalMultiSelectDropdown
              label="Location"
              icon={<MapPin size={16} />}
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
              brandColor={secondaryColor}
              className="min-w-[9.5rem] sm:min-w-[11rem]"
            />
          )}

          {!isScheduleView && enabledFilters.includes('age') && (
            <HostPortalMultiSelectDropdown
              label="Age"
              icon={<Users size={16} />}
              options={PORTAL_AGE_BUCKETS.map((bucket) => ({
                id: bucket.id,
                label: bucket.label,
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
              brandColor={secondaryColor}
              className="min-w-[9.5rem] sm:min-w-[10rem]"
            />
          )}

          {enabledFilters.includes('gender') && (
            <HostPortalMultiSelectDropdown
              label="Gender"
              icon={<Users size={16} />}
              options={GENDER_FILTER_OPTIONS.map((option) => ({
                id: option.id,
                label: option.label,
              }))}
              selectedIds={filters.genders ?? []}
              onChange={(genders) =>
                onFiltersChange({
                  ...filters,
                  genders:
                    genders.length > 0
                      ? (genders as DiscoveryFilters['genders'])
                      : undefined,
                  gender: 'all',
                })
              }
              isOpen={openDropdownId === 'gender'}
              onOpenChange={(open) => setOpenDropdownId(open ? 'gender' : null)}
              brandColor={secondaryColor}
              className="min-w-[9.5rem] sm:min-w-[10rem]"
            />
          )}

          {enabledFilters.includes('sport') && options.sports.length > 0 && (
            <HostPortalMultiSelectDropdown
              label="Activity"
              icon={<Trophy size={16} />}
              options={options.sports.map((sport) => ({
                id: sport.id,
                label: getSportLabel(sport.id),
                count: sport.count,
              }))}
              selectedIds={filters.sports ?? []}
              onChange={(sports) =>
                onFiltersChange({
                  ...filters,
                  sports: sports.length > 0 ? sports : undefined,
                })
              }
              isOpen={openDropdownId === 'sport'}
              onOpenChange={(open) => setOpenDropdownId(open ? 'sport' : null)}
              brandColor={secondaryColor}
              className="min-w-[9.5rem] sm:min-w-[11rem]"
            />
          )}

          {enabledFilters.includes('programType') && options.programTypes.length > 0 && (
            <HostPortalMultiSelectDropdown
              label="Type"
              icon={<Tag size={16} />}
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
                    programTypes.length > 0
                      ? (programTypes as ProgramType[])
                      : undefined,
                })
              }
              isOpen={openDropdownId === 'programType'}
              onOpenChange={(open) => setOpenDropdownId(open ? 'programType' : null)}
              brandColor={secondaryColor}
              className="min-w-[9.5rem] sm:min-w-[10rem]"
            />
          )}

          {enabledFilters.includes('program') && visiblePrograms.length > 0 && (
            <HostPortalMultiSelectDropdown
              label="Program"
              icon={<SlidersHorizontal size={16} />}
              options={visiblePrograms.map((program) => ({
                id: program.id,
                label: program.name,
              }))}
              selectedIds={filters.programIds ?? []}
              onChange={(programIds) => {
                const next: DiscoveryFilters = {
                  ...filters,
                  programIds: programIds.length > 0 ? programIds : undefined,
                };
                if (!programIds.length) {
                  next.sessionIds = undefined;
                }
                onFiltersChange(next);
              }}
              isOpen={openDropdownId === 'program'}
              onOpenChange={(open) => setOpenDropdownId(open ? 'program' : null)}
              brandColor={secondaryColor}
              className="min-w-[9.5rem] sm:min-w-[11rem]"
            />
          )}

          {enabledFilters.includes('program') &&
            filters.programIds &&
            filters.programIds.length > 0 &&
            visibleSessions.length > 0 && (
              <HostPortalMultiSelectDropdown
                label="Session"
                icon={<Calendar size={16} />}
                options={visibleSessions.map((session) => ({
                  id: session.id,
                  label: session.name,
                }))}
                selectedIds={filters.sessionIds ?? []}
                onChange={(sessionIds) =>
                  onFiltersChange({
                    ...filters,
                    sessionIds: sessionIds.length > 0 ? sessionIds : undefined,
                  })
                }
                isOpen={openDropdownId === 'session'}
                onOpenChange={(open) => setOpenDropdownId(open ? 'session' : null)}
                brandColor={secondaryColor}
                className="min-w-[9.5rem] sm:min-w-[11rem]"
              />
            )}

          {isScheduleView &&
            enabledFilters.includes('space') &&
            scheduleSpaces.length > 0 && (
              <HostPortalMultiSelectDropdown
                label={spaceFilterLabel}
                icon={<MapPin size={16} />}
                options={scheduleSpaces.map((space) => ({
                  id: space.id,
                  label: space.name,
                  count: space.count,
                }))}
                selectedIds={filters.spaceNames ?? []}
                onChange={(spaceNames) =>
                  onFiltersChange({
                    ...filters,
                    spaceNames: spaceNames.length > 0 ? spaceNames : undefined,
                  })
                }
                isOpen={openDropdownId === 'space'}
                onOpenChange={(open) => setOpenDropdownId(open ? 'space' : null)}
                brandColor={secondaryColor}
                className="min-w-[9.5rem] sm:min-w-[11rem]"
              />
            )}

          {!isScheduleView && enabledFilters.includes('availability') && (
            <HostPortalMultiSelectDropdown
              label="Availability"
              icon={<Users size={16} />}
              options={AVAILABILITY_FILTER_OPTIONS.map((option) => ({
                id: option.id,
                label: option.label,
              }))}
              selectedIds={filters.availabilityModes ?? []}
              onChange={(modes) =>
                onFiltersChange({
                  ...filters,
                  availabilityModes:
                    modes.length > 0
                      ? (modes as DiscoveryFilters['availabilityModes'])
                      : undefined,
                  availability: 'all',
                })
              }
              isOpen={openDropdownId === 'availability'}
              onOpenChange={(open) => setOpenDropdownId(open ? 'availability' : null)}
              brandColor={secondaryColor}
              className="min-w-[9.5rem] sm:min-w-[12rem]"
            />
          )}

          {enabledFilters.includes('dateRange') && (
            <div ref={dateRef} className="relative min-w-[9.5rem] sm:min-w-[11rem]">
              <button
                type="button"
                className={cn(
                  'inline-flex min-h-[40px] w-full items-center gap-2 rounded-xl border bg-white px-3 py-2 text-sm font-medium shadow-sm transition-all',
                  'hover:border-gray-300 hover:shadow',
                  hasDateFilter ? 'text-gray-900' : 'text-gray-600',
                )}
                style={
                  hasDateFilter
                    ? {
                        borderColor: `${secondaryColor}55`,
                        backgroundColor: `${secondaryColor}08`,
                      }
                    : { borderColor: '#e5e7eb' }
                }
                aria-expanded={datePanelOpen}
                onClick={() => {
                  setOpenDropdownId(null);
                  setDatePanelOpen((value) => !value);
                }}
              >
                <Calendar size={16} className="shrink-0 text-gray-400" />
                <span className="flex-1 truncate text-left">
                  {hasDateFilter ? 'Dates selected' : 'Dates'}
                </span>
                <ChevronDown
                  size={16}
                  className={cn(
                    'shrink-0 text-gray-400 transition-transform',
                    datePanelOpen && 'rotate-180',
                  )}
                />
              </button>
              {datePanelOpen && (
                <div className="absolute left-0 z-50 mt-1.5 w-64 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                  <div className="space-y-3">
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">From</label>
                      <input
                        type="date"
                        value={filters.dateRange?.start ?? ''}
                        onChange={(event) =>
                          onFiltersChange({
                            ...filters,
                            dateRange: {
                              ...filters.dateRange,
                              start: event.target.value || undefined,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                        style={{ ['--tw-ring-color' as string]: `${secondaryColor}55` }}
                      />
                    </div>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-gray-500">To</label>
                      <input
                        type="date"
                        value={filters.dateRange?.end ?? ''}
                        onChange={(event) =>
                          onFiltersChange({
                            ...filters,
                            dateRange: {
                              ...filters.dateRange,
                              end: event.target.value || undefined,
                            },
                          })
                        }
                        className="w-full rounded-lg border border-gray-200 px-3 py-2 text-sm focus:outline-none focus:ring-2"
                        style={{ ['--tw-ring-color' as string]: `${secondaryColor}55` }}
                      />
                    </div>
                  </div>
                  {hasDateFilter && (
                    <button
                      type="button"
                      className="mt-3 w-full rounded-lg py-1.5 text-xs font-medium text-gray-500 hover:bg-gray-50"
                      onClick={() => onFiltersChange({ ...filters, dateRange: {} })}
                    >
                      Clear dates
                    </button>
                  )}
                </div>
              )}
            </div>
          )}

          {hasActiveFilters && (
            <button
              type="button"
              onClick={clearAllFilters}
              className="inline-flex min-h-[40px] items-center gap-1 rounded-xl px-3 py-2 text-sm font-medium text-gray-500 transition-colors hover:bg-gray-100 hover:text-gray-800"
            >
              <X size={14} />
              Clear all
            </button>
          )}

          <span
            className="ml-auto hidden text-xs font-medium text-gray-500 sm:inline-flex sm:items-center"
            style={{ color: primaryColor }}
          >
            {resultCount} {isScheduleView ? 'events' : 'sessions'}
          </span>
        </div>

        <p className="mt-2 text-xs text-gray-500 sm:hidden">
          {resultCount} {isScheduleView ? 'events' : 'sessions'}
        </p>
      </div>
    </div>
  );
}
