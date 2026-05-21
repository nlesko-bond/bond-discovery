'use client';

import { ScheduleView } from '@/components/discovery/ScheduleView';
import { ScheduleViewSkeleton } from '@/components/ui/Skeleton';
import type { DiscoveryConfig, DiscoveryFilters, Program, WeekSchedule } from '@/types';
import { scheduleViewParamFromPageSearchParams } from '@/lib/schedule-view-resolution';
import { isLeagueScheduleTableContext } from '@/lib/league-schedule-context';

interface IHostPortalScheduleTabProps {
  schedule: WeekSchedule[] | null;
  config: DiscoveryConfig;
  scheduleThemeStyle: 'gradient' | 'solid';
  isLoading: boolean;
  error: string | null;
  totalEvents: number;
  totalServerEvents: number;
  onLoadMore: () => void;
  loadingMore: boolean;
  hasMultipleFacilities: boolean;
  filters?: DiscoveryFilters;
  onScheduleFiltersChange?: (filters: DiscoveryFilters) => void;
  searchParams: { [key: string]: string | string[] | undefined };
  programs: Program[];
  linkTarget: '_blank' | '_top' | '_self';
}

export function HostPortalScheduleTab({
  schedule,
  config,
  scheduleThemeStyle,
  isLoading,
  error,
  totalEvents,
  totalServerEvents,
  onLoadMore,
  loadingMore,
  hasMultipleFacilities,
  filters,
  onScheduleFiltersChange,
  searchParams,
  programs,
  linkTarget,
}: IHostPortalScheduleTabProps) {
  const leagueTableMode = isLeagueScheduleTableContext(config, filters ?? {}, programs);

  if (isLoading && !schedule) {
    return <ScheduleViewSkeleton />;
  }

  return (
    <ScheduleView
      schedule={schedule || []}
      config={config}
      scheduleThemeStyle={scheduleThemeStyle}
      isLoading={isLoading}
      error={error}
      totalEvents={totalEvents}
      totalServerEvents={totalServerEvents}
      onLoadMore={onLoadMore}
      loadingMore={loadingMore}
      hasMultipleFacilities={hasMultipleFacilities}
      linkTarget={linkTarget}
      hideRegistrationLinks={config.features.hideRegistrationLinks}
      customRegistrationUrl={config.features.customRegistrationUrl}
      filters={config.features.showScheduleTableDateFilters ? filters : undefined}
      onScheduleFiltersChange={
        config.features.showScheduleTableDateFilters ? onScheduleFiltersChange : undefined
      }
      initialUrlScheduleView={scheduleViewParamFromPageSearchParams(searchParams)}
      leagueTableMode={leagueTableMode}
    />
  );
}
