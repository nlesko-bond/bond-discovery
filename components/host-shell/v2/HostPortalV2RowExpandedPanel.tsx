'use client';

import { useEffect, useRef, useState } from 'react';
import { MapPin, ShoppingCart } from 'lucide-react';
import type { ISessionDescriptionSections } from '@/lib/host-shell/portal-session-description';
import type { DiscoveryConfig } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import type { IHostPortalSegmentRow } from '@/lib/host-shell/session-card-model';
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
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const linkRel = linkTarget === '_blank' ? 'noopener noreferrer' : undefined;
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
      className="flex items-center justify-between gap-4 py-3 [&:not(:last-child)]:border-b [&:not(:last-child)]:border-gray-100"
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
      <div className="flex shrink-0 items-center gap-3">
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
          <span className="w-16 text-right text-[14px] font-bold tabular-nums text-gray-900">
            {priceLabel}
          </span>
        )}
        {canRegister && registerUrl && (
          <a
            href={registerUrl}
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
            {registerLabel}
          </a>
        )}
        {showSegmentRegister && segmentFull && !waitlistJoinable && !spotsLabel && (
          <span className="text-[12px] font-medium text-gray-400">Full</span>
        )}
      </div>
    </li>
  );
}

export function HostPortalV2RowExpandedPanel({
  card,
  config,
  descriptionSections,
  showSegmentSchedule,
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
  const showShortDescription = config.features.portalRowShowShortDescription === true;
  const shortDescription = card.description?.trim() || undefined;
  const sessionFallbackPrice =
    card.startingPriceLabel && card.hasMultipleRegisterOptions
      ? `From ${card.startingPriceLabel}`
      : card.startingPriceLabel;
  const segmentCount = segments.length;
  const metaTags = resolveExpandedMetaTags(card, showAgeGender);
  const isSplitLayout = panelLayout === 'split';
  const storyLead =
    showShortDescription && shortDescription && descriptionSections?.lead === shortDescription
      ? undefined
      : descriptionSections?.lead;
  const storyBody =
    showShortDescription &&
    shortDescription &&
    !descriptionSections?.lead &&
    descriptionSections?.body === shortDescription
      ? undefined
      : descriptionSections?.body;

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
  }, [panelLayout, isLoading, segments.length, error]);

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

            {storyLead && (
              <p className="mt-4 text-[13px] font-medium leading-relaxed text-gray-800">
                {storyLead}
              </p>
            )}
            {storyBody && (
              <p
                className={`whitespace-pre-wrap text-[13px] leading-relaxed text-gray-700${
                  storyLead ? ' mt-2' : ' mt-4'
                }`}
              >
                {storyBody}
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

            {showShortDescription && shortDescription && (
              <p
                className={cn(
                  'text-[13px] leading-relaxed text-gray-700',
                  card.facilityName ? 'mt-2' : 'mt-5',
                )}
                data-testid="portal-v2-row-short-description"
              >
                {shortDescription}
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
        </div>
      </div>
    </div>
  );
}
