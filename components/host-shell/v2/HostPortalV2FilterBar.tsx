'use client';

import {
  useCallback,
  useEffect,
  useId,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Calendar,
  MapPin,
  Search,
  SlidersHorizontal,
  Tag,
  Users,
  X,
} from 'lucide-react';
import type { DiscoveryConfig, DiscoveryFilters, Program } from '@/types';
import { cn, getProgramTypeLabel } from '@/lib/utils';
import type { IPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import {
  buildV2GenderOptions,
  countSessionsPerAgeBucket,
  formatActivityLabel,
} from '@/lib/host-shell/portal-v2';
import {
  applyFacetSelection,
  buildActiveFilterChips,
  computeFacetCounts,
  countActiveSecondaryFilters,
  getFacetSelection,
  removeFilterChip,
  toggleSelection,
  type V2FacetDimension,
} from './ui/filter-core';
import { HostPortalV2Collapse } from './ui/HostPortalV2Collapse';
import { HostPortalV2FilterPill } from './ui/HostPortalV2FilterPill';
import {
  HostPortalV2OptionList,
  type IV2FilterOption,
} from './ui/HostPortalV2OptionList';

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

type PanelId = 'age' | 'gender' | 'facility' | 'programType' | 'dates';

interface IFacetDef {
  panelId: Exclude<PanelId, 'dates'>;
  dimension: V2FacetDimension;
  label: string;
  icon: ReactNode;
  options: IV2FilterOption[];
}

/**
 * v2 filter bar — custom filter system, no native <select> anywhere.
 *
 * POPOVER STRATEGY (iframe constraint): every filter panel is an
 * INLINE-EXPANDING in-flow section (HostPortalV2Collapse), never a floating
 * popover and never position:fixed. The portal lives in a content-sized
 * iframe, so a floating panel near the page bottom would be clipped at the
 * iframe edge; an in-flow panel pushes content down instead, and the
 * ResizeObserver in useHostPortalEmbedResize grows the iframe to match.
 */
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
  const [openPanelId, setOpenPanelId] = useState<PanelId | null>(null);
  const [mobileSheetOpen, setMobileSheetOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState(filters.search ?? '');
  const filtersRef = useRef(filters);
  const onFiltersChangeRef = useRef(onFiltersChange);
  const desktopAreaRef = useRef<HTMLDivElement>(null);
  const triggerRefs = useRef(new Map<string, HTMLButtonElement | null>());
  const mobileTriggerRef = useRef<HTMLButtonElement>(null);
  const idPrefix = useId();

  useEffect(() => {
    filtersRef.current = filters;
    onFiltersChangeRef.current = onFiltersChange;
  }, [filters, onFiltersChange]);

  // Debounced search (300ms), instant apply.
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
  const showDates = enabledFilters.includes('dateRange');

  const ageBucketOptions = useMemo(
    () => countSessionsPerAgeBucket(programs).filter((bucket) => bucket.count > 0),
    [programs],
  );
  const genderOptions = useMemo(() => buildV2GenderOptions(programs), [programs]);

  const activeSports = filters.sports ?? [];
  const showActivityChips = enabledFilters.includes('sport') && options.sports.length > 1;

  // Facet dimensions visible on this page (same gating as the v1 bar).
  const facetDefs = useMemo<IFacetDef[]>(() => {
    const defs: IFacetDef[] = [];
    if (enabledFilters.includes('age') && ageBucketOptions.length > 0) {
      defs.push({
        panelId: 'age',
        dimension: 'ageBucketIds',
        label: 'Age',
        icon: <Users size={15} />,
        options: ageBucketOptions.map((bucket) => ({ id: bucket.id, label: bucket.label })),
      });
    }
    if (enabledFilters.includes('gender') && genderOptions.length > 0) {
      defs.push({
        panelId: 'gender',
        dimension: 'genders',
        label: 'Gender',
        icon: <Users size={15} />,
        options: genderOptions.map((option) => ({ id: option.id, label: option.label })),
      });
    }
    if (enabledFilters.includes('facility') && options.facilities.length > 1) {
      defs.push({
        panelId: 'facility',
        dimension: 'facilityIds',
        label: 'Location',
        icon: <MapPin size={15} />,
        options: options.facilities.map((facility) => ({
          id: facility.id,
          label: facility.name,
        })),
      });
    }
    if (enabledFilters.includes('programType') && options.programTypes.length > 1) {
      defs.push({
        panelId: 'programType',
        dimension: 'programTypes',
        label: 'Type',
        icon: <Tag size={15} />,
        options: options.programTypes.map((typeOption) => ({
          id: typeOption.id,
          label: getProgramTypeLabel(typeOption.id),
        })),
      });
    }
    return defs;
  }, [enabledFilters, ageBucketOptions, genderOptions, options.facilities, options.programTypes]);

  // Live per-option result counts (faceted: option vs. every OTHER active
  // filter). Only computed while a panel/sheet is open; the schedule view
  // counts events (different pipeline), so it gets no per-option counts.
  const needCounts = !isScheduleView && (openPanelId !== null || mobileSheetOpen);
  const facetCounts = useMemo(() => {
    if (!needCounts) {
      return null;
    }
    const byDimension = new Map<V2FacetDimension, Record<string, number>>();
    for (const def of facetDefs) {
      byDimension.set(
        def.dimension,
        computeFacetCounts(
          programs,
          filters,
          def.dimension,
          def.options.map((option) => option.id),
        ),
      );
    }
    return byDimension;
  }, [needCounts, facetDefs, programs, filters]);

  const withCounts = useCallback(
    (def: IFacetDef): IV2FilterOption[] => {
      const counts = facetCounts?.get(def.dimension);
      if (!counts) {
        return def.options;
      }
      return def.options.map((option) => ({ ...option, count: counts[option.id] }));
    },
    [facetCounts],
  );

  const activeSecondaryCount = countActiveSecondaryFilters(filters);
  const activeChips = useMemo(
    () =>
      buildActiveFilterChips(filters, {
        facilityNames: new Map(
          options.facilities.map((facility) => [facility.id, facility.name]),
        ),
        programTypeLabel: getProgramTypeLabel,
      }),
    [filters, options.facilities],
  );
  const hasActiveFilters = activeChips.length > 0 || activeSports.length > 0;

  const toggleSport = (sportId: string | null) => {
    if (sportId === null) {
      onFiltersChange({ ...filters, sports: undefined });
      return;
    }
    const next = toggleSelection(activeSports, sportId);
    onFiltersChange({ ...filters, sports: next.length > 0 ? next : undefined });
  };

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
    setOpenPanelId(null);
    setMobileSheetOpen(false);
  };

  const togglePanel = (panelId: PanelId) => {
    setOpenPanelId((current) => (current === panelId ? null : panelId));
  };

  const closePanelAndRefocus = useCallback(() => {
    setOpenPanelId((current) => {
      if (current) {
        triggerRefs.current.get(current)?.focus();
      }
      return null;
    });
  }, []);

  // Escape inside a desktop panel closes it and returns focus to its trigger.
  const handlePanelKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      closePanelAndRefocus();
    }
  };

  const handleSheetKeyDown = (event: React.KeyboardEvent) => {
    if (event.key === 'Escape') {
      event.stopPropagation();
      setMobileSheetOpen(false);
      mobileTriggerRef.current?.focus();
    }
  };

  // Click outside the desktop pill row + panel closes the open panel.
  // Listens on 'click' (not 'mousedown') on purpose: collapsing the in-flow
  // panel shifts everything below it upward, so closing on mousedown would
  // move the user's actual click target away mid-press.
  useEffect(() => {
    if (!openPanelId) {
      return;
    }
    const handleOutsideClick = (event: MouseEvent) => {
      if (
        desktopAreaRef.current &&
        !desktopAreaRef.current.contains(event.target as Node)
      ) {
        setOpenPanelId(null);
      }
    };
    document.addEventListener('click', handleOutsideClick);
    return () => document.removeEventListener('click', handleOutsideClick);
  }, [openPanelId]);

  const dateInputClass =
    'w-full rounded-full border border-gray-200 bg-white px-3 py-1.5 text-xs text-gray-700 focus:outline-none focus:ring-2';
  const dateInputs = showDates && (
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
        className={dateInputClass}
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
        className={dateInputClass}
        style={{ ['--tw-ring-color' as string]: `${accentColor}55` }}
      />
    </div>
  );

  const hasDateSelection = Boolean(filters.dateRange?.start || filters.dateRange?.end);
  const openFacetDef = facetDefs.find((def) => def.panelId === openPanelId) ?? null;

  // Close a panel whose dimension is no longer offered (e.g. switching to the
  // schedule view removes the Age filter).
  useEffect(() => {
    if (!openPanelId) {
      return;
    }
    const stillAvailable =
      openPanelId === 'dates'
        ? showDates
        : facetDefs.some((def) => def.panelId === openPanelId);
    if (!stillAvailable) {
      setOpenPanelId(null);
    }
  }, [openPanelId, facetDefs, showDates]);

  return (
    <div className="border-b border-gray-200 bg-white">
      <div className="mx-auto max-w-7xl px-3 py-3 sm:px-4">
        {showSearch && (
          <div className="relative mb-3">
            <Search
              size={16}
              className="pointer-events-none absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-400"
              aria-hidden
            />
            <input
              type="search"
              value={searchQuery}
              onChange={(event) => setSearchQuery(event.target.value)}
              placeholder="Search programs..."
              aria-label="Search programs"
              className="w-full rounded-full border border-gray-200 bg-gray-50 py-2 pl-10 pr-9 text-sm text-gray-900 transition-colors duration-150 placeholder:text-gray-400 focus:border-transparent focus:bg-white focus:outline-none focus:ring-2 motion-reduce:transition-none"
              style={{ ['--tw-ring-color' as string]: `${accentColor}55` }}
            />
            {searchQuery && (
              <button
                type="button"
                className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-gray-400 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-600 motion-reduce:transition-none"
                onClick={() => setSearchQuery('')}
                aria-label="Clear search"
              >
                <X size={14} aria-hidden />
              </button>
            )}
          </div>
        )}

        {/* Activity chips: the hero filter — one tap, always visible.
            Mobile: horizontal scroll with a right edge-fade hint. */}
        {showActivityChips && (
          <div
            className={cn(
              '-mx-3 mb-3 flex gap-2 overflow-x-auto px-3 pb-1 sm:mx-0 sm:flex-wrap sm:px-0',
              '[scrollbar-width:none] [&::-webkit-scrollbar]:hidden',
              '[mask-image:linear-gradient(to_right,black_calc(100%-28px),transparent)] sm:[mask-image:none]',
            )}
            role="group"
            aria-label="Filter by activity"
          >
            <button
              type="button"
              data-testid="portal-v2-activity-chip"
              data-activity-id="all"
              className={cn(
                'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium',
                'transition-[background-color,border-color,color,transform] duration-150 ease-out motion-reduce:transition-none',
                'active:scale-[0.96] motion-reduce:active:scale-100',
                'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                activeSports.length === 0
                  ? 'border-transparent text-white'
                  : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
              )}
              style={{
                ...(activeSports.length === 0 ? { backgroundColor: accentColor } : undefined),
                ['--tw-ring-color' as string]: `${accentColor}88`,
              }}
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
                    'shrink-0 rounded-full border px-3.5 py-1.5 text-[13px] font-medium',
                    'transition-[background-color,border-color,color,transform] duration-150 ease-out motion-reduce:transition-none',
                    'active:scale-[0.96] motion-reduce:active:scale-100',
                    'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                    isActive
                      ? 'border-transparent text-white'
                      : 'border-gray-200 bg-white text-gray-700 hover:border-gray-300',
                  )}
                  style={{
                    ...(isActive ? { backgroundColor: accentColor } : undefined),
                    ['--tw-ring-color' as string]: `${accentColor}88`,
                  }}
                  aria-pressed={isActive}
                  onClick={() => toggleSport(sport.id)}
                >
                  {formatActivityLabel(sport.id)}
                  <span
                    className={cn(
                      'ml-1.5 text-xs tabular-nums',
                      isActive ? 'text-white/80' : 'text-gray-400',
                    )}
                  >
                    {sport.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* Desktop: pill triggers + ONE inline-expanding panel below the row. */}
        <div ref={desktopAreaRef}>
          <div className="flex flex-wrap items-center gap-2">
            <div className="hidden flex-wrap items-center gap-2 sm:flex">
              {facetDefs.map((def) => (
                <HostPortalV2FilterPill
                  key={def.panelId}
                  ref={(element) => {
                    triggerRefs.current.set(def.panelId, element);
                  }}
                  label={def.label}
                  icon={def.icon}
                  filterId={def.panelId}
                  activeCount={getFacetSelection(filters, def.dimension).length}
                  isOpen={openPanelId === def.panelId}
                  panelId={`${idPrefix}-panel`}
                  accentColor={accentColor}
                  onToggle={() => togglePanel(def.panelId)}
                />
              ))}
              {showDates && (
                <HostPortalV2FilterPill
                  ref={(element) => {
                    triggerRefs.current.set('dates', element);
                  }}
                  label="Dates"
                  icon={<Calendar size={15} />}
                  filterId="dates"
                  activeCount={hasDateSelection ? 1 : 0}
                  isOpen={openPanelId === 'dates'}
                  panelId={`${idPrefix}-panel`}
                  accentColor={accentColor}
                  onToggle={() => togglePanel('dates')}
                />
              )}
            </div>

            {/* Mobile: one "Filters" pill with the total active count. */}
            {(facetDefs.length > 0 || showDates) && (
              <button
                ref={mobileTriggerRef}
                type="button"
                data-testid="portal-v2-mobile-filters"
                className={cn(
                  'inline-flex min-h-[40px] items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-medium sm:hidden',
                  'transition-[background-color,border-color,color,transform] duration-150 ease-out motion-reduce:transition-none',
                  'active:scale-[0.97] motion-reduce:active:scale-100',
                  'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1',
                  mobileSheetOpen ? 'text-white' : 'border-gray-200 bg-white text-gray-700',
                )}
                style={{
                  ...(mobileSheetOpen
                    ? { backgroundColor: accentColor, borderColor: accentColor }
                    : undefined),
                  ['--tw-ring-color' as string]: `${accentColor}88`,
                }}
                aria-expanded={mobileSheetOpen}
                aria-controls={`${idPrefix}-sheet`}
                onClick={() => setMobileSheetOpen((open) => !open)}
              >
                <SlidersHorizontal size={14} aria-hidden />
                Filters
                {activeSecondaryCount > 0 && (
                  <span
                    className={cn(
                      'inline-flex h-[18px] min-w-[18px] items-center justify-center rounded-full px-1 text-[11px] font-semibold',
                      mobileSheetOpen ? 'bg-white/25 text-white' : 'text-white',
                    )}
                    style={mobileSheetOpen ? undefined : { backgroundColor: accentColor }}
                  >
                    {activeSecondaryCount}
                  </span>
                )}
              </button>
            )}

            <span
              data-testid="portal-v2-result-count"
              aria-live="polite"
              className="ml-auto text-xs font-medium text-gray-500"
            >
              {resultCount}{' '}
              {isScheduleView ? 'events' : resultCount === 1 ? 'program' : 'programs'}
            </span>
          </div>

          {/* Desktop inline panel (in-flow; pushes content down — see header note). */}
          <div className="hidden sm:block">
            <HostPortalV2Collapse open={openPanelId !== null} id={`${idPrefix}-panel`}>
            <div
              data-testid="portal-v2-filter-panel"
              onKeyDown={handlePanelKeyDown}
              className="mt-2 rounded-xl border border-gray-200 bg-white p-3 shadow-sm"
            >
              {openFacetDef && (
                <HostPortalV2OptionList
                  label={openFacetDef.label}
                  options={withCounts(openFacetDef)}
                  selectedIds={getFacetSelection(filters, openFacetDef.dimension)}
                  onToggleOption={(optionId) =>
                    onFiltersChange(
                      applyFacetSelection(
                        filters,
                        openFacetDef.dimension,
                        toggleSelection(
                          getFacetSelection(filters, openFacetDef.dimension),
                          optionId,
                        ),
                      ),
                    )
                  }
                  onClear={() =>
                    onFiltersChange(applyFacetSelection(filters, openFacetDef.dimension, []))
                  }
                  accentColor={accentColor}
                  variant="rows"
                  className="max-w-md"
                />
              )}
              {openPanelId === 'dates' && (
                <div className="max-w-md space-y-2">
                  {dateInputs}
                  {hasDateSelection && (
                    <button
                      type="button"
                      onClick={() => onFiltersChange({ ...filters, dateRange: {} })}
                      className="rounded-md px-2 py-1 text-xs font-medium text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-800 motion-reduce:transition-none"
                    >
                      Clear dates
                    </button>
                  )}
                </div>
              )}
            </div>
            </HostPortalV2Collapse>
          </div>
        </div>

        {/* Mobile sheet: in-flow bottom-sheet-style panel (NEVER position:fixed —
            it expands in document flow and the iframe grows with it). */}
        <div className="sm:hidden">
          <HostPortalV2Collapse open={mobileSheetOpen} id={`${idPrefix}-sheet`}>
          <div
            data-testid="portal-v2-mobile-sheet"
            onKeyDown={handleSheetKeyDown}
            className="mt-3 overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm"
          >
            {/* Bounded scroll area so the confirm row below stays visible. */}
            <div className="max-h-[420px] space-y-4 overflow-y-auto p-3">
              {facetDefs.map((def) => (
                <section key={def.panelId} aria-label={def.label}>
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    {def.label}
                  </h3>
                  <HostPortalV2OptionList
                    label={def.label}
                    options={withCounts(def)}
                    selectedIds={getFacetSelection(filters, def.dimension)}
                    onToggleOption={(optionId) =>
                      onFiltersChange(
                        applyFacetSelection(
                          filters,
                          def.dimension,
                          toggleSelection(getFacetSelection(filters, def.dimension), optionId),
                        ),
                      )
                    }
                    onClear={() =>
                      onFiltersChange(applyFacetSelection(filters, def.dimension, []))
                    }
                    accentColor={accentColor}
                    variant="chips"
                  />
                </section>
              ))}
              {showDates && (
                <section aria-label="Dates">
                  <h3 className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                    Dates
                  </h3>
                  {dateInputs}
                </section>
              )}
            </div>
            {/* Confirm row pinned at the panel bottom (in-flow). */}
            <div className="border-t border-gray-100 bg-white p-3">
              <button
                type="button"
                data-testid="portal-v2-sheet-confirm"
                className="w-full rounded-full py-2.5 text-center text-[13px] font-semibold text-white transition-transform duration-150 active:scale-[0.98] motion-reduce:transition-none motion-reduce:active:scale-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-offset-1"
                style={{
                  backgroundColor: accentColor,
                  ['--tw-ring-color' as string]: `${accentColor}88`,
                }}
                onClick={() => setMobileSheetOpen(false)}
              >
                Show {resultCount} {isScheduleView ? 'events' : resultCount === 1 ? 'program' : 'results'}
              </button>
            </div>
          </div>
          </HostPortalV2Collapse>
        </div>

        {/* Active filter summary: removable chips + Clear all. */}
        {hasActiveFilters && (
          <div
            data-testid="portal-v2-active-filters"
            className="mt-2.5 flex flex-wrap items-center gap-1.5"
          >
            {activeChips.map((chip) => (
              <button
                key={chip.key}
                type="button"
                data-testid="portal-v2-active-chip"
                onClick={() => onFiltersChange(removeFilterChip(filters, chip))}
                aria-label={`Remove filter ${chip.label}`}
                className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium transition-colors duration-150 hover:opacity-80 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2"
                style={{
                  backgroundColor: `${accentColor}14`,
                  color: accentColor,
                  ['--tw-ring-color' as string]: `${accentColor}88`,
                }}
              >
                {chip.label}
                <X size={12} aria-hidden />
              </button>
            ))}
            <button
              type="button"
              data-testid="portal-v2-clear-all"
              onClick={clearAllFilters}
              className="inline-flex items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium text-gray-500 transition-colors duration-150 hover:bg-gray-100 hover:text-gray-800 motion-reduce:transition-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gray-300"
            >
              Clear all
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
