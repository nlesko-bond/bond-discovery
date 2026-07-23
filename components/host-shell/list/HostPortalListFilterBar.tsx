'use client';

import { useState } from 'react';
import { ArrowLeft, ArrowUpDown, LayoutGrid, LayoutList, MapPin } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters } from '@/types';
import { PortalSessionLayoutEnum, PortalSessionSortEnum } from '@/types';
import type { IPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import { resolvePortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import { HostPortalMultiSelectDropdown } from '../HostPortalMultiSelectDropdown';
import { HostPortalAgeRangeSlider } from './HostPortalAgeRangeSlider';
import { cn } from '@/lib/utils';

const LIST_FILTER_CONTROL_CLASS =
  'flex min-h-[40px] w-full items-center rounded-lg border border-gray-200 bg-white px-3 shadow-sm sm:min-h-[42px]';

const COMPACT_SORT_CONTROL_SIZE_PX = 40;
const COMPACT_LAYOUT_TOGGLE_SIZE_PX = 40;

interface IHostPortalSessionLayoutToggleProps {
  layout: PortalSessionLayoutEnum;
  onLayoutChange: (layout: PortalSessionLayoutEnum) => void;
  accentColor: string;
}

function HostPortalSessionLayoutToggle({
  layout,
  onLayoutChange,
  accentColor,
}: IHostPortalSessionLayoutToggleProps) {
  return (
    <div
      className="flex shrink-0 rounded-lg border border-gray-200 bg-white p-0.5 shadow-sm"
      style={{ height: COMPACT_LAYOUT_TOGGLE_SIZE_PX }}
      role="group"
      aria-label="Session layout"
    >
      <button
        type="button"
        aria-pressed={layout === PortalSessionLayoutEnum.LIST}
        aria-label="List view"
        onClick={() => onLayoutChange(PortalSessionLayoutEnum.LIST)}
        className={cn(
          'flex h-full items-center justify-center rounded-md px-2 transition-colors',
          layout === PortalSessionLayoutEnum.LIST ? 'text-white' : 'text-gray-500 hover:bg-gray-50',
        )}
        style={
          layout === PortalSessionLayoutEnum.LIST
            ? { backgroundColor: accentColor }
            : undefined
        }
      >
        <LayoutList size={18} aria-hidden />
      </button>
      <button
        type="button"
        aria-pressed={layout === PortalSessionLayoutEnum.GRID}
        aria-label="Grid view"
        onClick={() => onLayoutChange(PortalSessionLayoutEnum.GRID)}
        className={cn(
          'flex h-full items-center justify-center rounded-md px-2 transition-colors',
          layout === PortalSessionLayoutEnum.GRID ? 'text-white' : 'text-gray-500 hover:bg-gray-50',
        )}
        style={
          layout === PortalSessionLayoutEnum.GRID
            ? { backgroundColor: accentColor }
            : undefined
        }
      >
        <LayoutGrid size={18} aria-hidden />
      </button>
    </div>
  );
}

interface IHostPortalListSortControlProps {
  sort: PortalSessionSortEnum;
  onSortChange: (sort: PortalSessionSortEnum) => void;
  compact?: boolean;
}

function HostPortalListSortControl({
  sort,
  onSortChange,
  compact = false,
}: IHostPortalListSortControlProps) {
  if (compact) {
    return (
      <div className="relative shrink-0" style={{ width: COMPACT_SORT_CONTROL_SIZE_PX }}>
        <label className="sr-only" htmlFor="portal-session-sort-mobile">
          Sort sessions
        </label>
        <div
          className="relative flex items-center justify-center rounded-lg border border-gray-200 bg-white shadow-sm"
          style={{ width: COMPACT_SORT_CONTROL_SIZE_PX, height: COMPACT_SORT_CONTROL_SIZE_PX }}
        >
          <ArrowUpDown size={18} className="pointer-events-none text-gray-500" aria-hidden />
          <select
            id="portal-session-sort-mobile"
            value={sort}
            onChange={(event) => onSortChange(event.target.value as PortalSessionSortEnum)}
            className="absolute inset-0 cursor-pointer appearance-none opacity-0"
            aria-label="Sort sessions"
          >
            <option value={PortalSessionSortEnum.START_DATE}>Start date</option>
            <option value={PortalSessionSortEnum.MIN_AGE}>Age (youngest first)</option>
            <option value={PortalSessionSortEnum.NAME}>Name</option>
            <option value={PortalSessionSortEnum.PRICE}>Price</option>
          </select>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(LIST_FILTER_CONTROL_CLASS, 'relative py-0')}>
      <ArrowUpDown
        size={16}
        className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
      />
      <select
        value={sort}
        onChange={(event) => onSortChange(event.target.value as PortalSessionSortEnum)}
        className="w-full appearance-none bg-transparent py-2 pl-9 pr-8 text-sm font-medium text-gray-800 focus:outline-none sm:py-2.5"
      >
        <option value={PortalSessionSortEnum.START_DATE}>Start date</option>
        <option value={PortalSessionSortEnum.MIN_AGE}>Age (youngest first)</option>
        <option value={PortalSessionSortEnum.NAME}>Name</option>
        <option value={PortalSessionSortEnum.PRICE}>Price</option>
      </select>
    </div>
  );
}

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
  sessionLayout?: PortalSessionLayoutEnum;
  onSessionLayoutChange?: (layout: PortalSessionLayoutEnum) => void;
  showSessionLayoutToggle?: boolean;
}

export function HostPortalListFilterBar(props: IHostPortalListFilterBarProps) {
  const { secondaryColor } = resolvePortalUiColors(props.config);
  const [facilityOpen, setFacilityOpen] = useState(false);
  const atFullAgeRange =
    props.selectedAgeMin === props.ageBounds.min &&
    props.selectedAgeMax === props.ageBounds.max;
  const hasFacilities = props.options.facilities.length > 0;
  const showLayoutToggle =
    props.showSessionLayoutToggle &&
    props.sessionLayout !== undefined &&
    props.onSessionLayoutChange !== undefined;

  const facilityControl = hasFacilities ? (
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
  ) : null;

  const ageControl = (
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
  );

  const layoutToggleControl = showLayoutToggle ? (
    <HostPortalSessionLayoutToggle
      layout={props.sessionLayout!}
      onLayoutChange={props.onSessionLayoutChange!}
      accentColor={secondaryColor}
    />
  ) : null;

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

      {!props.scheduleMode && (
        <>
          <div className="mx-auto max-w-7xl px-3 py-3 sm:px-6 sm:py-4 md:hidden">
            <div className="flex items-end gap-2">
              {hasFacilities && (
                <div className="min-w-0 flex-1">
                  <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                    Facility
                  </p>
                  {facilityControl}
                </div>
              )}
              <div className={cn('flex shrink-0 items-end gap-2', !hasFacilities && 'ml-auto')}>
                {layoutToggleControl}
                <div>
                  {!hasFacilities && (
                    <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                      Sort
                    </p>
                  )}
                  <HostPortalListSortControl
                    sort={props.sort}
                    onSortChange={props.onSortChange}
                    compact
                  />
                </div>
              </div>
            </div>
            <div className="mt-2.5">
              <p className="mb-1 text-[10px] font-semibold uppercase tracking-wide text-gray-500">
                Age
              </p>
              {ageControl}
            </div>
          </div>

          <div className="mx-auto hidden max-w-7xl items-end gap-4 px-6 py-4 md:flex">
            {hasFacilities && (
              <div className="min-w-0 flex-1">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  Facility
                </p>
                {facilityControl}
              </div>
            )}

            <div className="min-w-0 flex-[1.4]">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Age
              </p>
              {ageControl}
            </div>

            <div className="min-w-0 w-full max-w-[11rem] shrink-0">
              <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                Sort
              </p>
              <HostPortalListSortControl sort={props.sort} onSortChange={props.onSortChange} />
            </div>

            {layoutToggleControl && (
              <div className="shrink-0 self-end pb-0.5">
                <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
                  View
                </p>
                {layoutToggleControl}
              </div>
            )}
          </div>
        </>
      )}
    </div>
  );
}
