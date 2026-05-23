'use client';

import { useState } from 'react';
import { ArrowUpDown, MapPin } from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters } from '@/types';
import { PortalSessionSortEnum } from '@/types';
import type { IPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import { resolvePortalBrandColors } from '@/lib/host-shell/portal-branding';
import { HostPortalMultiSelectDropdown } from '../HostPortalMultiSelectDropdown';

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
}

export function HostPortalListFilterBar(props: IHostPortalListFilterBarProps) {
  const { secondaryColor } = resolvePortalBrandColors(props.config);
  const [facilityOpen, setFacilityOpen] = useState(false);

  return (
    <div className="relative z-40 border-b border-gray-200 bg-white">
      <div className="mx-auto grid max-w-7xl gap-4 px-4 py-4 sm:px-6 md:grid-cols-3">
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
            />
          </div>
        )}

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Age range
          </p>
          <div className="rounded-xl border border-gray-200 bg-gray-50/80 px-3 py-3">
            <p className="mb-2 text-sm font-medium text-gray-800">
              {props.selectedAgeMin === props.ageBounds.min &&
              props.selectedAgeMax === props.ageBounds.max
                ? `All ages (${props.ageBounds.min}–${props.ageBounds.max})`
                : `Ages ${props.selectedAgeMin}–${props.selectedAgeMax}`}
            </p>
            <div className="space-y-2">
              <input
                type="range"
                min={props.ageBounds.min}
                max={props.ageBounds.max}
                value={props.selectedAgeMin}
                onChange={(event) => {
                  const nextMin = Number(event.target.value);
                  props.onAgeRangeChange(
                    Math.min(nextMin, props.selectedAgeMax),
                    props.selectedAgeMax,
                  );
                }}
                className="w-full accent-emerald-700"
                aria-label="Minimum age"
              />
              <input
                type="range"
                min={props.ageBounds.min}
                max={props.ageBounds.max}
                value={props.selectedAgeMax}
                onChange={(event) => {
                  const nextMax = Number(event.target.value);
                  props.onAgeRangeChange(
                    props.selectedAgeMin,
                    Math.max(nextMax, props.selectedAgeMin),
                  );
                }}
                className="w-full accent-emerald-700"
                aria-label="Maximum age"
              />
            </div>
          </div>
        </div>

        <div>
          <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-wide text-gray-500">
            Sort
          </p>
          <div className="relative">
            <ArrowUpDown
              size={16}
              className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"
            />
            <select
              value={props.sort}
              onChange={(event) =>
                props.onSortChange(event.target.value as PortalSessionSortEnum)
              }
              className="w-full appearance-none rounded-full border border-gray-200 bg-white py-2.5 pl-9 pr-8 text-sm font-medium text-gray-800 shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-600/30"
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
