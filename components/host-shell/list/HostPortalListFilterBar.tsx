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
  'flex min-h-[42px] w-full items-center rounded-lg border border-gray-200 bg-white px-3 shadow-sm';

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

  return (
    <div className={cn('relative z-40 border-b border-gray-200 bg-white', props.scheduleMode && 'sticky top-[var(--bond-embed-chrome-px,0px)]')}>
      {props.scheduleMode && props.onBackToSessions && (
        <div className="border-b border-gray-100 bg-gray-50/80">
          <div className="mx-auto flex max-w-7xl items-center gap-3 px-4 py-2.5 sm:px-6">
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
      <div className="mx-auto grid max-w-7xl items-end gap-4 px-4 py-4 sm:px-6 md:grid-cols-3">
        {props.options.facilities.length > 0 && (
          <div>
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Age range
          </p>
          <div className={cn(LIST_FILTER_CONTROL_CLASS, 'gap-3 py-2')}>
            <HostPortalAgeRangeSlider
              min={props.ageBounds.min}
              max={props.ageBounds.max}
              valueMin={props.selectedAgeMin}
              valueMax={props.selectedAgeMax}
              onChange={props.onAgeRangeChange}
              className="relative min-w-0 flex-1"
            />
            <span className="shrink-0 text-sm font-semibold tabular-nums text-gray-800">
              {atFullAgeRange
                ? `${props.ageBounds.min}–${props.ageBounds.max} yrs`
                : `${props.selectedAgeMin}–${props.selectedAgeMax} yrs`}
            </span>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
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
              className="w-full appearance-none bg-transparent py-2.5 pl-9 pr-8 text-sm font-medium text-gray-800 focus:outline-none"
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
