'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, ShoppingCart } from 'lucide-react';
import type { ISessionDescriptionSections } from '@/lib/host-shell/portal-session-description';
import type { DiscoveryConfig } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import type { IHostPortalSegmentRow } from '@/lib/host-shell/session-card-model';
import type {
  IHostPortalUpcomingSessionEvent,
  IPortalV2EventSchedulePanel,
} from '@/lib/host-shell/portal-session-events';
import {
  buildPortalSegmentDetailLine,
  portalSegmentAvailabilityPillClasses,
  resolvePortalSegmentScheduleLabel,
} from '@/lib/host-shell/portal-segment-display';
import { resolvePortalBrandColors } from '@/lib/host-shell/portal-branding';
import { notifyPortalEmbedContentChange } from '@/lib/host-shell/embed-resize';
import { getBondRegisterLinkAnalyticsAttributes } from '@/lib/host-shell/registration-analytics';
import { resolvePortalScheduleLinkTarget } from '@/lib/host-shell/portal-schedule-events';
import { useHostPortalSessionSegments } from '../useHostPortalSessionSegments';
import { cn, formatAgeRange, getSportLabel } from '@/lib/utils';

const EXPANDED_PANEL_SPLIT_MIN_WIDTH_PX = 560;

interface IHostPortalV2RowExpandedPanelProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  descriptionSections: ISessionDescriptionSections | null;
  showSegmentSchedule: boolean;
  eventSchedule?: IPortalV2EventSchedulePanel;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

/**
 * Formats the expanded-panel age tag with month-aware boundaries
 * (e.g. "Ages 16 mo - 3 yrs") instead of raw fractional years.
 */
function buildAgeTag(ageMin?: number, ageMax?: number, ageRange?: string): string | undefined {
  const formatted = ageRange?.trim() || formatAgeRange(ageMin, ageMax);
  if (!formatted) {
    return undefined;
  }
  if (/^ages\b/i.test(formatted)) {
    return formatted;
  }
  return `Ages ${formatted}`;
}

const PROGRAM_TYPE_LABELS: Record<string, string> = {
  class: 'Class',
  clinic: 'Clinic',
  camp: 'Camp',
  lesson: 'Lesson',
  league: 'League',
  tournament: 'Tournament',
  club_team: 'Club Team',
  drop_in: 'Drop-in',
  rental: 'Rental',
};

function resolveExpandedMetaTags(
  card: IHostPortalSessionCardModel,
  showAgeGender: boolean,
): string[] {
  const sessionTitle = card.name || card.programName;
  const sportLabel = card.sport ? getSportLabel(card.sport) : undefined;
  const programTypeLabel = card.programType
    ? PROGRAM_TYPE_LABELS[card.programType]
    : undefined;
  const categoryTag =
    sportLabel && programTypeLabel
      ? `${sportLabel} ${programTypeLabel}`
      : sportLabel ?? programTypeLabel;

  return [
    showAgeGender ? buildAgeTag(card.ageMin, card.ageMax, card.ageRange) : undefined,
    card.weekCountLabel,
    categoryTag && categoryTag !== sessionTitle ? categoryTag : undefined,
  ].filter((tag): tag is string => Boolean(tag));
}

function SessionMetaTag({ children }: { children: string }) {
  return (
    <span
      data-testid="portal-v2-row-meta-tag"
      className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-[12px] font-medium text-slate-600"
    >
      {children}
    </span>
  );
}

function isSegmentFull(segment: IHostPortalSegmentRow): boolean {
  if (segment.availabilityKind === 'full' || segment.availabilityKind === 'waitlist') {
    return true;
  }
  return segment.spotsRemaining !== undefined && segment.spotsRemaining <= 0;
}

function isSegmentWaitlistJoinable(segment: IHostPortalSegmentRow): boolean {
  if (!isSegmentFull(segment)) {
    return false;
  }
  if (segment.availabilityKind === 'waitlist') {
    return true;
  }
  return segment.isWaitlistEnabled === true;
}

/**
 * Spots copy for the expand-panel option row when portalRowShowSegmentSpots is on.
 * Prefers concrete remaining counts; full / waitlist options surface as "Full".
 */
function resolveSegmentSpotsLabel(segment: IHostPortalSegmentRow): string | undefined {
  if (isSegmentFull(segment)) {
    return 'Full';
  }
  if (segment.spotsRemaining !== undefined && segment.spotsRemaining > 0) {
    return segment.spotsRemaining === 1
      ? '1 spot left'
      : `${segment.spotsRemaining} spots left`;
  }
  return segment.availabilityLabel;
}

function RegisterCartLink({
  href,
  label,
  card,
  config,
}: {
  href: string;
  label: string;
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
}) {
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const linkRel = linkTarget === '_blank' ? 'noopener noreferrer' : undefined;
  return (
    <a
      href={href}
      target={linkTarget}
      rel={linkRel}
      data-testid="portal-v2-segment-register"
      {...getBondRegisterLinkAnalyticsAttributes({
        programId: card.programId,
        programName: card.programName,
        sessionId: card.sessionId,
        sessionName: card.name,
        productId: card.registerProductId,
      })}
      className="inline-flex items-center gap-1.5 rounded-lg px-2.5 py-1.5 text-[12px] font-semibold text-gray-700 ring-1 ring-inset ring-gray-200 transition-colors hover:bg-gray-50"
      onClick={(event) => event.stopPropagation()}
    >
      <ShoppingCart size={14} aria-hidden />
      {label}
    </a>
  );
}

function SegmentRow({
  segment,
  card,
  config,
  showAvailability,
  showPricing,
  showSegmentRegister,
  showSegmentSpots,
  sessionFallbackPrice,
  hideRegistrationLinks,
}: {
  segment: IHostPortalSegmentRow;
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  showAvailability: boolean;
  showPricing: boolean;
  showSegmentRegister: boolean;
  showSegmentSpots: boolean;
  sessionFallbackPrice?: string;
  hideRegistrationLinks: boolean;
}) {
  const detailLine = buildPortalSegmentDetailLine(segment);
  const spotsLabel = showSegmentSpots ? resolveSegmentSpotsLabel(segment) : undefined;
  const legacyAvailabilityLabel =
    showAvailability && !showSegmentSpots ? segment.availabilityLabel : undefined;
  const priceLabel = showPricing ? (segment.priceLabel ?? sessionFallbackPrice) : undefined;
  const registerUrl = card.registerUrl;
  const waitlistJoinable = isSegmentWaitlistJoinable(segment);
  const segmentFull = isSegmentFull(segment);
  const canRegister =
    showSegmentRegister &&
    !hideRegistrationLinks &&
    Boolean(registerUrl) &&
    !card.isClosed &&
    (!segmentFull || waitlistJoinable);
  const registerLabel = waitlistJoinable ? 'Join waitlist' : 'Register';

  return (
    <li
      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-gray-100"
      data-testid="portal-v2-schedule-option-row"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold leading-snug text-gray-900">
          {resolvePortalSegmentScheduleLabel(segment)}
        </p>
        {detailLine && (
          <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500">{detailLine}</p>
        )}
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3">
        {spotsLabel && (
          <span
            data-testid="portal-v2-segment-spots"
            className={portalSegmentAvailabilityPillClasses(segment, 'text-[12px] px-2.5 py-1')}
          >
            {spotsLabel}
          </span>
        )}
        {legacyAvailabilityLabel && (
          <span className={portalSegmentAvailabilityPillClasses(segment, 'text-[12px] px-2.5 py-1')}>
            {legacyAvailabilityLabel}
          </span>
        )}
        {priceLabel && (
          <span className="text-[14px] font-bold tabular-nums text-gray-900 sm:w-16 sm:text-right">
            {priceLabel}
          </span>
        )}
        {canRegister && registerUrl && (
          <RegisterCartLink
            href={registerUrl}
            label={registerLabel}
            card={card}
            config={config}
          />
        )}
        {showSegmentRegister && segmentFull && !waitlistJoinable && !spotsLabel && (
          <span className="text-[12px] font-medium text-gray-400">Full</span>
        )}
      </div>
    </li>
  );
}

function resolveEventOccurrenceSpotsLabel(
  occurrence: IHostPortalUpcomingSessionEvent,
): string | undefined {
  if (occurrence.isFull) {
    return 'Full';
  }
  if (occurrence.spotsLabel === '1 left') {
    return '1 spot left';
  }
  if (occurrence.spotsLabel.endsWith(' left')) {
    return occurrence.spotsLabel.replace(/ left$/, ' spots left');
  }
  if (occurrence.spotsLabel === 'Open') {
    return undefined;
  }
  return occurrence.spotsLabel;
}

function EventOccurrenceRow({
  occurrence,
  card,
  config,
  showSegmentRegister,
  showSegmentSpots,
  hideRegistrationLinks,
}: {
  occurrence: IHostPortalUpcomingSessionEvent;
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  showSegmentRegister: boolean;
  showSegmentSpots: boolean;
  hideRegistrationLinks: boolean;
}) {
  const waitlistJoinable = occurrence.isFull && occurrence.isWaitlistEnabled;
  const registerUrl = occurrence.registrationUrl ?? card.registerUrl;
  const canRegister =
    showSegmentRegister &&
    !hideRegistrationLinks &&
    Boolean(registerUrl) &&
    !card.isClosed &&
    (!occurrence.isFull || waitlistJoinable);
  const registerLabel = waitlistJoinable ? 'Join waitlist' : 'Register';
  const resolvedSpotsLabel = showSegmentSpots
    ? resolveEventOccurrenceSpotsLabel(occurrence)
    : undefined;

  return (
    <li
      className="flex flex-col gap-2 py-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-gray-100"
      data-testid="portal-v2-event-occurrence-row"
    >
      <div className="min-w-0 flex-1">
        <p className="text-[14px] font-bold leading-snug text-gray-900">
          {occurrence.dateLabel}
        </p>
        <p className="mt-0.5 text-[12px] leading-relaxed text-gray-500">{occurrence.timeLabel}</p>
      </div>
      <div className="flex flex-wrap items-center gap-2 sm:shrink-0 sm:gap-3">
        {resolvedSpotsLabel && (
          <span
            data-testid="portal-v2-segment-spots"
            className={cn(
              'inline-flex shrink-0 rounded-full px-2.5 py-1 text-[12px] font-medium',
              occurrence.isFull ? 'bg-gray-100 text-gray-600' : 'bg-green-100 text-green-800',
            )}
          >
            {resolvedSpotsLabel}
          </span>
        )}
        {canRegister && registerUrl && (
          <RegisterCartLink
            href={registerUrl}
            label={registerLabel}
            card={card}
            config={config}
          />
        )}
        {showSegmentRegister && occurrence.isFull && !waitlistJoinable && !resolvedSpotsLabel && (
          <span className="text-[12px] font-medium text-gray-400">Full</span>
        )}
      </div>
    </li>
  );
}

function EventScheduleSection({
  card,
  config,
  eventSchedule,
  accentColor,
  showSegmentRegister,
  showSegmentSpots,
  hideRegistrationLinks,
  onOpenSchedule,
}: {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  eventSchedule: IPortalV2EventSchedulePanel;
  accentColor: string;
  showSegmentRegister: boolean;
  showSegmentSpots: boolean;
  hideRegistrationLinks: boolean;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}) {
  const sessionTitle = card.name || card.programName;
  const remainingCount = Math.max(
    0,
    eventSchedule.totalUpcomingCount - eventSchedule.upcoming.length,
  );
  const scheduleTabEnabled = (config.features.enabledTabs || ['programs', 'schedule']).includes(
    'schedule',
  );

  return (
    <section
      className="px-5 py-5 sm:px-6 sm:py-6"
      data-testid="portal-v2-event-schedule"
      aria-label={`Schedule for ${sessionTitle}`}
    >
      <div className="mb-3 flex items-baseline justify-between gap-3">
        <h4
          className="text-[11px] font-semibold uppercase tracking-widest"
          style={{ color: accentColor }}
        >
          Schedule
        </h4>
        {eventSchedule.totalUpcomingCount > 0 && (
          <span className="text-[13px] font-medium text-gray-700">
            {eventSchedule.totalUpcomingCount === 1
              ? '1 upcoming'
              : `${eventSchedule.totalUpcomingCount} upcoming`}
          </span>
        )}
      </div>

      {eventSchedule.summary && (
        <p
          data-testid="portal-v2-event-schedule-summary"
          className="mb-3 text-[14px] font-semibold text-gray-900"
        >
          {eventSchedule.summary}
        </p>
      )}

      {eventSchedule.upcoming.length > 0 && (
        <ul data-testid="portal-v2-event-occurrence-list">
          {eventSchedule.upcoming.map((occurrence) => (
            <EventOccurrenceRow
              key={occurrence.eventId}
              occurrence={occurrence}
              card={card}
              config={config}
              showSegmentRegister={showSegmentRegister}
              showSegmentSpots={showSegmentSpots}
              hideRegistrationLinks={hideRegistrationLinks}
            />
          ))}
        </ul>
      )}

      {remainingCount > 0 && (
        <p className="mt-2 text-[12px] text-gray-500">
          {remainingCount === 1 ? '1 more date' : `${remainingCount} more dates`}
        </p>
      )}

      {scheduleTabEnabled && onOpenSchedule && (
        <button
          type="button"
          data-testid="portal-v2-event-view-full-schedule"
          className="mt-4 text-[13px] font-semibold underline-offset-2 hover:underline"
          style={{ color: accentColor }}
          onClick={(event) => {
            event.stopPropagation();
            onOpenSchedule(card.programId, card.sessionId);
          }}
        >
          View full schedule
        </button>
      )}
    </section>
  );
}

export function HostPortalV2RowExpandedPanel({
  card,
  config,
  descriptionSections,
  showSegmentSchedule,
  eventSchedule,
  onOpenSchedule,
}: IHostPortalV2RowExpandedPanelProps) {
  const panelRef = useRef<HTMLDivElement>(null);
  const [panelLayout, setPanelLayout] = useState<'stack' | 'split'>('stack');
  const { segments, isLoading, error } = useHostPortalSessionSegments(card, config);
  const { primaryColor } = resolvePortalBrandColors(config);
  const accentColor = config.branding.accentColor?.trim() || primaryColor;
  const sessionTitle = card.name || card.programName;
  const showPricing = config.features.showPricing !== false;
  const showAvailability = config.features.showAvailability !== false;
  const showAgeGender = config.features.showAgeGender !== false;
  const hideRegistrationLinks = config.features.hideRegistrationLinks === true;
  const showSegmentRegister = config.features.portalRowShowSegmentRegister === true;
  const showSegmentSpots = config.features.portalRowShowSegmentSpots === true;
  const sessionFallbackPrice =
    card.startingPriceLabel && card.hasMultipleRegisterOptions
      ? `From ${card.startingPriceLabel}`
      : card.startingPriceLabel;
  const segmentCount = segments.length;
  const metaTags = resolveExpandedMetaTags(card, showAgeGender);
  const isSplitLayout = panelLayout === 'split';
  const longOrSoleDescription = descriptionSections?.body ?? descriptionSections?.lead;
  const showEventSchedule = !showSegmentSchedule && Boolean(eventSchedule);

  useEffect(() => {
    const element = panelRef.current;
    if (!element || typeof ResizeObserver === 'undefined') {
      notifyPortalEmbedContentChange();
      return;
    }

    const syncPanelLayout = () => {
      const nextLayout =
        element.clientWidth >= EXPANDED_PANEL_SPLIT_MIN_WIDTH_PX ? 'split' : 'stack';
      setPanelLayout((prev) => (prev === nextLayout ? prev : nextLayout));
      notifyPortalEmbedContentChange();
    };

    syncPanelLayout();
    const observer = new ResizeObserver(syncPanelLayout);
    observer.observe(element);
    return () => observer.disconnect();
  }, []);

  useEffect(() => {
    notifyPortalEmbedContentChange();
  }, [panelLayout, isLoading, segments.length, error, eventSchedule?.upcoming.length]);

  return (
    <div
      ref={panelRef}
      className="border-t border-gray-200 bg-gray-50/60 px-3 pb-4 pt-2 sm:px-4"
      data-testid="portal-v2-row-expanded"
      data-panel-layout={panelLayout}
    >
      <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
        <div
          className={cn(
            'grid',
            isSplitLayout
              ? 'grid-cols-[minmax(0,1fr)_minmax(0,1.05fr)] divide-x divide-gray-100'
              : 'grid-cols-1',
          )}
        >
          <section
            className={cn('px-5 py-5 sm:px-6 sm:py-6', !isSplitLayout && 'border-b border-gray-100')}
            data-testid="portal-v2-row-description"
            aria-label={`About ${sessionTitle}`}
          >
            {card.programName && card.programName !== sessionTitle && (
              <p
                className="text-[11px] font-semibold uppercase tracking-widest"
                style={{ color: accentColor }}
              >
                {card.programName}
              </p>
            )}

            <h3 className="mt-1.5 text-[22px] font-extrabold leading-tight tracking-tight text-gray-900">
              {sessionTitle}
            </h3>

            {metaTags.length > 0 && (
              <ul
                className="mt-3 flex flex-wrap gap-2"
                data-testid="portal-v2-row-meta-tags"
              >
                {metaTags.map((tag) => (
                  <li key={tag}>
                    <SessionMetaTag>{tag}</SessionMetaTag>
                  </li>
                ))}
              </ul>
            )}

            {longOrSoleDescription && (
              <p className="mt-4 whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700">
                {longOrSoleDescription}
              </p>
            )}

            {card.facilityName && (
              <p
                className="mt-5 flex items-center gap-1.5 text-[13px] text-gray-500"
                data-testid="portal-v2-row-location"
              >
                <MapPin size={14} className="shrink-0 text-gray-400" aria-hidden />
                <span>{card.facilityName}</span>
              </p>
            )}
          </section>

          {showSegmentSchedule && (
            <section
              className="px-5 py-5 sm:px-6 sm:py-6"
              data-testid="portal-v2-segment-schedule"
              aria-label={`Schedule options for ${sessionTitle}`}
            >
              <div className="mb-3 flex items-baseline justify-between gap-3">
                <h4
                  className="text-[11px] font-semibold uppercase tracking-widest"
                  style={{ color: accentColor }}
                >
                  Schedule options
                </h4>
                {segmentCount > 0 && !isLoading && (
                  <span className="text-[13px] font-medium text-gray-700">
                    {segmentCount === 1 ? '1 time' : `${segmentCount} times`}
                  </span>
                )}
              </div>

              {isLoading && (
                <p className="text-[13px] text-gray-500">Loading schedule options...</p>
              )}
              {!isLoading && error && (
                <p className="text-[13px] text-red-600">{error}</p>
              )}
              {!isLoading && !error && segmentCount === 0 && (
                <p className="text-[13px] text-gray-500">
                  No schedule options listed for this session.
                </p>
              )}
              {!isLoading && !error && segmentCount > 0 && (
                <ul data-testid="portal-v2-schedule-option-list">
                  {segments.map((segment) => (
                    <SegmentRow
                      key={segment.id}
                      segment={segment}
                      card={card}
                      config={config}
                      showAvailability={showAvailability}
                      showPricing={showPricing}
                      showSegmentRegister={showSegmentRegister}
                      showSegmentSpots={showSegmentSpots}
                      sessionFallbackPrice={sessionFallbackPrice}
                      hideRegistrationLinks={hideRegistrationLinks}
                    />
                  ))}
                </ul>
              )}
            </section>
          )}

          {showEventSchedule && eventSchedule && (
            <EventScheduleSection
              card={card}
              config={config}
              eventSchedule={eventSchedule}
              accentColor={accentColor}
              showSegmentRegister={showSegmentRegister}
              showSegmentSpots={showSegmentSpots}
              hideRegistrationLinks={hideRegistrationLinks}
              onOpenSchedule={onOpenSchedule}
            />
          )}
        </div>
      </div>
    </div>
  );
}
