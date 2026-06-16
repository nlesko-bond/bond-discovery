'use client';

import { CalendarDays, ExternalLink } from 'lucide-react';
import type { DiscoveryConfig } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import {
  buildPortalSegmentDetailLine,
  portalSegmentAvailabilityLabel,
  portalSegmentAvailabilityPillClasses,
  resolvePortalSegmentScheduleLabel,
} from '@/lib/host-shell/portal-segment-display';
import { useHostPortalSessionSegments } from './useHostPortalSessionSegments';
import { cn } from '@/lib/utils';

export const HOST_PORTAL_SEGMENT_SCHEDULE_LABEL = 'Schedule options';

export interface IHostPortalSegmentsPanelActions {
  accentColor: string;
  registerUrl?: string;
  registerDisabled?: boolean;
  linkTarget?: string;
  linkRel?: string;
  /** data-bond-* attributes for the register link (partner GTM contract). */
  analyticsAttributes?: Record<string, string>;
  onRegisterClick?: () => void;
  onOpenSchedule?: () => void;
}

interface IHostPortalSessionSegmentsPanelProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  variant?: 'inline' | 'standalone';
  /** 'grid' lays segment rows out in responsive columns (full-width breakout). */
  layout?: 'stack' | 'grid';
  /** 'section' renders inside a parent card without its own outer frame. */
  surface?: 'panel' | 'section';
  /** Session-level register / view-schedule actions rendered under the segment list. */
  actions?: IHostPortalSegmentsPanelActions;
}

function scheduleOptionsAriaLabel(sessionName: string): string {
  return `${HOST_PORTAL_SEGMENT_SCHEDULE_LABEL} for ${sessionName}`;
}

export function HostPortalSessionSegmentsPanel({
  card,
  config,
  variant = 'standalone',
  layout = 'stack',
  surface = 'panel',
  actions,
}: IHostPortalSessionSegmentsPanelProps) {
  const { segments: loadedSegments, isLoading: segmentsLoading, error: segmentsError } =
    useHostPortalSessionSegments(card, config);
  const showAvailability = config.features.showAvailability !== false;
  const showPricing = config.features.showPricing !== false;
  const isInline = variant === 'inline';
  const isSectionSurface = surface === 'section';
  const sessionFallbackPrice =
    card.startingPriceLabel && card.hasMultipleRegisterOptions
      ? `From ${card.startingPriceLabel}`
      : card.startingPriceLabel;
  const segmentCount = loadedSegments.length;

  const showActions = Boolean(
    actions && (actions.registerUrl || actions.onOpenSchedule),
  );

  const scheduleHeader = (
    <div className="mb-2.5 flex flex-wrap items-center gap-2">
      <h4 className="text-xs font-semibold uppercase tracking-wide text-gray-500">
        {HOST_PORTAL_SEGMENT_SCHEDULE_LABEL}
      </h4>
      {segmentCount > 0 && !segmentsLoading && (
        <span className="rounded-full bg-gray-100 px-2 py-0.5 text-[11px] font-medium normal-case tracking-normal text-gray-600">
          {segmentCount}
        </span>
      )}
    </div>
  );

  const gridPanelHeader = !isSectionSurface && layout === 'grid' && (
    <p className="mb-2 text-[13px] font-semibold text-gray-800">
      {card.name}{' '}
      <span className="font-normal text-gray-500">· schedule options</span>
    </p>
  );

  const segmentList = (
    <>
      {segmentsLoading && (
        <p className="text-sm text-gray-500">Loading schedule options...</p>
      )}
      {!segmentsLoading && segmentsError && (
        <p className="text-sm text-red-600">{segmentsError}</p>
      )}
      {!segmentsLoading && !segmentsError && loadedSegments.length > 0 && (
        <ul
          className={cn(
            layout === 'grid'
              ? 'grid grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3'
              : 'space-y-2',
          )}
        >
          {loadedSegments.map((segment) => (
            <li
              key={segment.id}
              className="flex items-start gap-3 rounded-lg border border-gray-100 bg-gray-50/60 px-3.5 py-2.5 transition-colors hover:border-gray-200 hover:bg-gray-50"
            >
              <CalendarDays
                size={15}
                className="mt-0.5 shrink-0 text-gray-400"
                aria-hidden
              />
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2">
                  <span className="block text-sm font-medium leading-snug text-gray-900">
                    {resolvePortalSegmentScheduleLabel(segment)}
                  </span>
                  {showAvailability && portalSegmentAvailabilityLabel(segment) && (
                    <span className={portalSegmentAvailabilityPillClasses(segment)}>
                      {portalSegmentAvailabilityLabel(segment)}
                    </span>
                  )}
                </span>
                {buildPortalSegmentDetailLine(segment) && (
                  <span className="mt-0.5 block text-xs leading-relaxed text-gray-500">
                    {buildPortalSegmentDetailLine(segment)}
                  </span>
                )}
                {showPricing && (segment.priceLabel ?? sessionFallbackPrice) && (
                  <span className="mt-1 block text-xs font-semibold tabular-nums text-gray-800">
                    {segment.priceLabel ?? sessionFallbackPrice}
                  </span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!segmentsLoading && !segmentsError && loadedSegments.length === 0 && (
        <p className="text-sm text-gray-500">No schedule options listed for this session.</p>
      )}
    </>
  );

  const actionsBlock = showActions && actions && (
    <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
      {actions.onOpenSchedule ? (
        <button
          type="button"
          className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 underline-offset-2 hover:underline"
          onClick={actions.onOpenSchedule}
        >
          <CalendarDays size={13} aria-hidden />
          View schedule
        </button>
      ) : (
        <span />
      )}
      {actions.registerUrl && (
        <a
          href={actions.registerUrl}
          target={actions.linkTarget}
          rel={actions.linkRel}
          {...actions.analyticsAttributes}
          className={cn(
            'inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90',
            actions.registerDisabled && 'pointer-events-none cursor-not-allowed opacity-60',
          )}
          style={{
            backgroundColor: actions.registerDisabled ? '#9CA3AF' : actions.accentColor,
          }}
          aria-disabled={actions.registerDisabled}
          onClick={() => {
            if (actions.registerDisabled) {
              return;
            }
            actions.onRegisterClick?.();
          }}
        >
          {actions.registerDisabled ? 'Closed' : 'Register'}
          <ExternalLink size={13} aria-hidden />
        </a>
      )}
    </div>
  );

  if (isSectionSurface) {
    return (
      <section
        className="px-4 py-3.5 sm:px-5 sm:py-4"
        data-testid="portal-v2-segment-schedule"
        aria-label={scheduleOptionsAriaLabel(card.name)}
      >
        {scheduleHeader}
        {segmentList}
        {actionsBlock}
      </section>
    );
  }

  return (
    <div
      className={cn(
        isInline
          ? 'mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3'
          : 'rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm',
      )}
      data-testid="portal-v2-segment-schedule"
      aria-label={scheduleOptionsAriaLabel(card.name)}
    >
      {!isInline && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">
          {HOST_PORTAL_SEGMENT_SCHEDULE_LABEL}
        </p>
      )}
      {gridPanelHeader}
      {isInline && layout !== 'grid' && scheduleHeader}
      {segmentList}
      {actionsBlock}
    </div>
  );
}
