'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowUpDown, MapPin } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters } from '@/types';
import { PortalSessionSortEnum } from '@/types';
import type { IPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import { resolvePortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import { HostPortalMultiSelectDropdown } from '../HostPortalMultiSelectDropdown';
import { HostPortalAgeRangeSlider } from './HostPortalAgeRangeSlider';
import { cn } from '@/lib/utils';

const LIST_FILTER_CONTROL_CLASS =
  'flex min-h-[40px] w-full items-center rounded-lg border border-gray-200 bg-white px-3 shadow-sm sm:min-h-[42px]';

interface IHostPortalListFilterBarProps {
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  options: IPortalFilterOptions;
  config: DiscoveryConfig;
  sort: PortalSessionSortEnum;
  onSortChange: (sort: PortalSessionSortEnum) => void;
  ageBounds: { min: number; max: number };
  selectedAgeMin: number;
  selectedAgeMax: number;
  onAgeRangeChange: (min: number, max: number) => void;
  scheduleMode?: boolean;
  scheduleSessionLabel?: string;
  onBackToSessions?: () => void;
}

export function HostPortalListFilterBar(props: IHostPortalListFilterBarProps) {
  const { secondaryColor } = resolvePortalUiColors(props.config);
  const [facilityOpen, setFacilityOpen] = useState(false);
  const atFullAgeRange =
    props.selectedAgeMin === props.ageBounds.min &&
    props.selectedAgeMax === props.ageBounds.max;
  const hasFacilities = props.options.facilities.length > 0;

  return (
    <div className={cn('relative z-40 border-b border-gray-200 bg-white', props.scheduleMode && 'sticky top-0')}>
      {props.scheduleMode && props.onBackToSessions && (
        <div className="border-b border-gray-100 bg-gray-50/80">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-3 py-2 sm:px-6">
            <button
              type="button"
              onClick={props.onBackToSessions}
              className="inline-flex items-center gap-1.5 rounded-lg border border-gray-200 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
            >
              <ArrowLeft size={15} aria-hidden />
              All sessions
            </button>
            {props.scheduleSessionLabel && (
              <span className="truncate text-sm text-gray-500">{props.scheduleSessionLabel}</span>
            )}
          </div>
        </div>
      )}
      <div
        className={cn(
          'mx-auto grid max-w-7xl gap-3 px-3 py-3 sm:gap-4 sm:px-6 sm:py-4',
          hasFacilities
            ? 'grid-cols-2 md:grid-cols-3 md:items-end'
            : 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 md:items-end',
        )}
      >
        {hasFacilities && (
          <div className="min-w-0">
            <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:mb-1.5 sm:text-[11px]">
              Facility
            </p>
            <HostPortalMultiSelectDropdown
              label="All facilities"
              icon={<MapPin size={16} />}
              options={props.options.facilities.map((facility) => ({
                id: facility.id,
                label: facility.name,
                count: facility.count,
              }))}
              selectedIds={props.filters.facilityIds ?? []}
              onChange={(facilityIds) =>
                props.onFiltersChange({
                  ...props.filters,
                  facilityIds: facilityIds.length > 0 ? facilityIds : undefined,
                })
              }
              isOpen={facilityOpen}
              onOpenChange={setFacilityOpen}
              brandColor={secondaryColor}
              triggerClassName={LIST_FILTER_CONTROL_CLASS}
              menuClassName="rounded-lg"
            />
          </div>
        )}

        <div
          className={cn(
            'min-w-0',
            hasFacilities ? 'col-span-2 md:col-span-1' : 'col-span-1 sm:col-span-2 md:col-span-1',
          )}
        >
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:mb-1.5 sm:text-[11px]">
            Age
          </p>
          <div className={cn(LIST_FILTER_CONTROL_CLASS, 'gap-2 py-2 sm:gap-3')}>
            <HostPortalAgeRangeSlider
              min={props.ageBounds.min}
              max={props.ageBounds.max}
              valueMin={props.selectedAgeMin}
              valueMax={props.selectedAgeMax}
              onChange={props.onAgeRangeChange}
              className="relative min-w-0 flex-1"
            />
            <span className="shrink-0 text-xs font-semibold tabular-nums text-gray-800 sm:text-sm">
              {atFullAgeRange
                ? `${props.ageBounds.min}–${props.ageBounds.max} yrs`
                : `${props.selectedAgeMin}–${props.selectedAgeMax} yrs`}
            </span>
          </div>
        </div>

        <div className={cn('min-w-0', hasFacilities && 'col-span-1')}>
          <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500 sm:mb-1.5 sm:text-[11px]">
            Sort
          </p>
          <div className={cn(LIST_FILTER_CONTROL_CLASS, 'relative py-0')}>
            <ArrowUpDown
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <select
              value={props.sort}
              onChange={(event) =>
                props.onSortChange(event.target.value as PortalSessionSortEnum)
              }
              className="w-full appearance-none bg-transparent py-2 pl-9 pr-8 text-sm font-medium text-gray-800 focus:outline-none sm:py-2.5"
            >
              <option value={PortalSessionSortEnum.START_DATE}>Start date</option>
              <option value={PortalSessionSortEnum.NAME}>Name</option>
              <option value={PortalSessionSortEnum.PRICE}>Price</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
