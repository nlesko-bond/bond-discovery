'use client';

import { useEffect, useMemo, useState, type ReactNode } from 'react';
import type { DiscoveryConfig, DiscoveryFilters, ViewMode } from '@/types';
import { PortalSessionSortEnum } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import type { IPortalFilterOptions } from '@/lib/host-shell/portal-filter-options';
import type { IDiscoveryApiEvent } from '@/lib/host-shell/portal-schedule-events';
import {
  buildPortalHeroMetadata,
  derivePortalAgeBounds,
  isPortalHeroEnabled,
  sortPortalSessionCards,
} from '@/lib/host-shell/portal-list-layout';
import { buildSessionTimeChipsBySessionId } from '@/lib/host-shell/portal-session-events';
import { HostPortalHeroBanner } from './HostPortalHeroBanner';
import { HostPortalListFilterBar } from './HostPortalListFilterBar';
import { HostPortalSessionListRow } from './HostPortalSessionListRow';

interface IHostPortalSessionsListViewProps {
  cards: IHostPortalSessionCardModel[];
  config: DiscoveryConfig;
  filters: DiscoveryFilters;
  onFiltersChange: (filters: DiscoveryFilters) => void;
  filterOptions: IPortalFilterOptions;
  apiEvents: IDiscoveryApiEvent[];
  eventsFetched: boolean;
  viewMode: ViewMode;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
  onBackToSessions?: () => void;
  scheduleContent?: ReactNode;
}

export function HostPortalSessionsListView({
  cards,
  config,
  filters,
  onFiltersChange,
  filterOptions,
  apiEvents,
  eventsFetched,
  viewMode,
  onOpenSchedule,
  onBackToSessions,
  scheduleContent,
}: IHostPortalSessionsListViewProps) {
  const [sort, setSort] = useState(PortalSessionSortEnum.START_DATE);
  const ageBounds = useMemo(() => derivePortalAgeBounds(cards), [cards]);
  const [selectedAgeMin, setSelectedAgeMin] = useState(ageBounds.min);
  const [selectedAgeMax, setSelectedAgeMax] = useState(ageBounds.max);

  useEffect(() => {
    setSelectedAgeMin(ageBounds.min);
    setSelectedAgeMax(ageBounds.max);
  }, [ageBounds.min, ageBounds.max]);

  const handleAgeRangeChange = (min: number, max: number) => {
    setSelectedAgeMin(min);
    setSelectedAgeMax(max);
    const atFullRange = min === ageBounds.min && max === ageBounds.max;
    onFiltersChange({
      ...filters,
      ageRange: atFullRange ? {} : { min, max },
      ageBucketIds: undefined,
    });
  };

  const sortedCards = useMemo(() => sortPortalSessionCards(cards, sort), [cards, sort]);
  const timeChipsBySession = useMemo(
    () =>
      buildSessionTimeChipsBySessionId(apiEvents, {
        customRegistrationUrl: config.features.customRegistrationUrl,
      }),
    [apiEvents, config.features.customRegistrationUrl],
  );
  const heroSport = sortedCards.find((card) => card.sport)?.sport;
  const heroMetadata = buildPortalHeroMetadata(config, sortedCards);
  const showHero = isPortalHeroEnabled(config) && viewMode === 'programs';
  const scheduleSessionLabel =
    filters.sessionIds?.length === 1
      ? sortedCards.find((card) => card.sessionId === filters.sessionIds?.[0])?.name
      : undefined;

  return (
    <div className="relative z-0">
      {showHero && <HostPortalHeroBanner metadata={heroMetadata} config={config} sport={heroSport} />}
      <HostPortalListFilterBar
        filters={filters}
        onFiltersChange={onFiltersChange}
        options={filterOptions}
        config={config}
        sort={sort}
        onSortChange={setSort}
        ageBounds={ageBounds}
        selectedAgeMin={selectedAgeMin}
        selectedAgeMax={selectedAgeMax}
        onAgeRangeChange={handleAgeRangeChange}
        scheduleMode={viewMode === 'schedule'}
        scheduleSessionLabel={scheduleSessionLabel}
        onBackToSessions={onBackToSessions}
      />
      {viewMode === 'programs' ? (
        <div className="mx-auto max-w-7xl px-4 py-6 sm:px-6">
          {!eventsFetched && (
            <p className="mb-4 text-sm text-gray-500">Loading class times…</p>
          )}
          {sortedCards.length === 0 ? (
            <p className="py-12 text-center text-sm text-gray-500">No sessions match your filters.</p>
          ) : (
            <ul className="space-y-4">
              {sortedCards.map((card) => (
                <li key={card.sessionId}>
                  <HostPortalSessionListRow
                    card={card}
                    config={config}
                    timeChips={timeChipsBySession.get(card.sessionId) ?? []}
                    onOpenSchedule={onOpenSchedule}
                  />
                </li>
              ))}
            </ul>
          )}
        </div>
      ) : (
        <div className="mx-auto max-w-7xl px-4 py-4 sm:px-6">{scheduleContent}</div>
      )}
    </div>
  );
}
