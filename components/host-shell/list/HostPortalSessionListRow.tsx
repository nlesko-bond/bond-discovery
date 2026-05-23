'use client';

import { useEffect, useMemo, useState, type MouseEvent } from 'react';
import { Calendar, ChevronDown, Clock, MapPin, ArrowRight, ShoppingCart, Info } from 'lucide-react';
import type { DiscoveryConfig } from '@/types';
import type {
  IHostPortalSegmentRow,
  IHostPortalSessionCardModel,
} from '@/lib/host-shell/session-card-model';
import type { IHostPortalSessionTimeChip } from '@/lib/host-shell/portal-session-events';
import {
  formatSessionTimeChipLabel,
  summarizeSessionTimeChips,
} from '@/lib/host-shell/portal-session-events';
import { resolvePortalUiColors, type IPortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import { hasHostPortalSessionDescription } from '@/lib/host-shell/portal-session-description';
import { HostPortalSessionInfoDialog } from './HostPortalSessionInfoDialog';
import { resolvePortalScheduleLinkTarget } from '@/lib/host-shell/portal-schedule-events';
import { HostPortalSportIcon } from '../HostPortalSportIcon';
import { cn } from '@/lib/utils';

interface IHostPortalSessionListRowProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  timeChips: IHostPortalSessionTimeChip[];
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

function formatSegmentChipDate(isoDate: string): string {
  try {
    return new Date(isoDate).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
    });
  } catch {
    return '';
  }
}

function buildSegmentDateChips(segment: IHostPortalSegmentRow): string[] {
  const chips: string[] = [];
  if (segment.startDate) {
    const start = formatSegmentChipDate(segment.startDate);
    if (start) {
      chips.push(start);
    }
  }
  if (segment.endDate) {
    const end = formatSegmentChipDate(segment.endDate);
    if (end && end !== chips[chips.length - 1]) {
      chips.push(end);
    }
  }
  if (chips.length === 0 && segment.dateRange) {
    chips.push(segment.dateRange);
  }
  return chips;
}

function schedulePanelLabel(
  timeChips: IHostPortalSessionTimeChip[],
  card: IHostPortalSessionCardModel,
): string {
  if (timeChips.length > 0) {
    return summarizeSessionTimeChips(timeChips);
  }
  if (card.isSegmented || card.segments.length > 0) {
    return 'View dates & pricing';
  }
  return 'View schedule';
}

function filterChipsForSegment(
  timeChips: IHostPortalSessionTimeChip[],
  segmentId: string,
): IHostPortalSessionTimeChip[] {
  return timeChips.filter((chip) => chip.segmentId === segmentId);
}

interface ISessionTimeChipBubbleProps {
  chip: IHostPortalSessionTimeChip;
  hideRegistrationLinks: boolean;
  linkTarget: '_blank' | '_top' | '_self';
  fallbackRegistrationUrl?: string;
  uiColors: IPortalUiColors;
}

function SessionTimeChipBubble({
  chip,
  hideRegistrationLinks,
  linkTarget,
  fallbackRegistrationUrl,
  uiColors,
}: ISessionTimeChipBubbleProps) {
  const label = formatSessionTimeChipLabel(chip);
  const registrationUrl = chip.registrationUrl ?? fallbackRegistrationUrl;
  const canRegister =
    !hideRegistrationLinks && !chip.isFull && Boolean(registrationUrl);
  const chipClassName = cn(
    'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
    chip.isFull
      ? 'border-gray-200 bg-gray-100 text-gray-400'
      : 'border-gray-200 bg-white text-gray-800',
  );
  const chipStyle = chip.isFull
    ? undefined
    : canRegister
      ? {
          borderColor: uiColors.chipBorderColor,
        }
      : undefined;
  const chipHoverHandlers = canRegister
    ? {
        onMouseEnter: (event: MouseEvent<HTMLElement>) => {
          event.currentTarget.style.borderColor = uiColors.chipHoverBorderColor;
          event.currentTarget.style.backgroundColor = uiColors.chipHoverBackgroundColor;
        },
        onMouseLeave: (event: MouseEvent<HTMLElement>) => {
          event.currentTarget.style.borderColor = uiColors.chipBorderColor;
          event.currentTarget.style.backgroundColor = '';
        },
      }
    : undefined;
  const chipContent = (
    <>
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', chip.isFull && 'bg-gray-300')}
        style={chip.isFull ? undefined : { backgroundColor: uiColors.availabilityDotColor }}
      />
      <span>{label}</span>
      {canRegister && (
        <ShoppingCart
          size={12}
          className="shrink-0"
          style={{ color: uiColors.chipAccentColor }}
          aria-hidden
        />
      )}
    </>
  );

  if (!canRegister) {
    return (
      <span className={chipClassName} style={chipStyle}>
        {chipContent}
      </span>
    );
  }

  return (
    <a
      href={registrationUrl}
      target={linkTarget}
      rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
      className={chipClassName}
      style={chipStyle}
      aria-label={`Register for ${label}`}
      {...chipHoverHandlers}
    >
      {chipContent}
    </a>
  );
}

interface ISessionTimeChipGridProps {
  chips: IHostPortalSessionTimeChip[];
  hideRegistrationLinks: boolean;
  linkTarget: '_blank' | '_top' | '_self';
  fallbackRegistrationUrl?: string;
  uiColors: IPortalUiColors;
}

function SessionTimeChipGrid({
  chips,
  hideRegistrationLinks,
  linkTarget,
  fallbackRegistrationUrl,
  uiColors,
}: ISessionTimeChipGridProps) {
  if (chips.length === 0) {
    return null;
  }

  return (
    <div className="mt-2 flex flex-wrap gap-2 pl-1">
      {chips.map((chip) => (
        <SessionTimeChipBubble
          key={chip.eventId}
          chip={chip}
          hideRegistrationLinks={hideRegistrationLinks}
          linkTarget={linkTarget}
          fallbackRegistrationUrl={fallbackRegistrationUrl}
          uiColors={uiColors}
        />
      ))}
    </div>
  );
}


export function HostPortalSessionListRow({
  card,
  config,
  timeChips,
  onOpenSchedule,
}: IHostPortalSessionListRowProps) {
  const uiColors = resolvePortalUiColors(config, card.sport);
  const { visualTheme, primaryColor } = uiColors;
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const [infoOpen, setInfoOpen] = useState(false);
  const [panelOpen, setPanelOpen] = useState(false);
  const [expandedSegmentIds, setExpandedSegmentIds] = useState<Set<string>>(() => new Set());
  const [otherTimesOpen, setOtherTimesOpen] = useState(false);
  const [loadedSegments, setLoadedSegments] = useState<IHostPortalSegmentRow[]>(card.segments);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const hideRegistrationLinks = config.features.hideRegistrationLinks === true;
  const showScheduleTab = (config.features.enabledTabs || ['programs', 'schedule']).includes(
    'schedule',
  );
  const showSegments =
    card.isSegmented ||
    card.segments.length > 0 ||
    segmentsLoading ||
    Boolean(segmentsError);
  const priceLabel = card.startingPriceLabel
    ? card.hasMultipleRegisterOptions
      ? `From ${card.startingPriceLabel}`
      : card.startingPriceLabel
    : undefined;

  const orphanTimeChips = useMemo(() => {
    if (!showSegments) {
      return timeChips;
    }
    if (loadedSegments.length === 0) {
      return [];
    }
    const segmentIds = new Set(loadedSegments.map((segment) => segment.id));
    return timeChips.filter((chip) => !chip.segmentId || !segmentIds.has(chip.segmentId));
  }, [timeChips, showSegments, loadedSegments]);

  useEffect(() => {
    setLoadedSegments(card.segments);
  }, [card.sessionId, card.segments]);

  useEffect(() => {
    if (!panelOpen) {
      setExpandedSegmentIds(new Set());
      setOtherTimesOpen(false);
    }
  }, [panelOpen]);

  useEffect(() => {
    if (!panelOpen || loadedSegments.length > 0 || !card.organizationId) {
      return;
    }

    const params = new URLSearchParams({
      slug: config.slug,
      programId: card.programId,
      sessionId: card.sessionId,
      organizationId: card.organizationId,
    });

    setSegmentsLoading(true);
    setSegmentsError(null);

    fetch(`/api/portal-session-segments?${params.toString()}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load segments (${response.status})`);
        }
        return response.json();
      })
      .then((payload: { data?: IHostPortalSegmentRow[] }) => {
        if (Array.isArray(payload.data)) {
          setLoadedSegments(payload.data);
        }
      })
      .catch((error: unknown) => {
        setSegmentsError(error instanceof Error ? error.message : 'Failed to load segments');
      })
      .finally(() => setSegmentsLoading(false));
  }, [
    panelOpen,
    loadedSegments.length,
    card.organizationId,
    card.programId,
    card.sessionId,
    config.slug,
  ]);

  const toggleSegment = (segmentId: string) => {
    setExpandedSegmentIds((current) => {
      const next = new Set(current);
      if (next.has(segmentId)) {
        next.delete(segmentId);
      } else {
        next.add(segmentId);
      }
      return next;
    });
  };

  const hasDescription = hasHostPortalSessionDescription(
    card.description,
    card.longDescription,
  );
  const hasPanelContent = timeChips.length > 0 || showSegments || (showScheduleTab && onOpenSchedule);

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row">
        <div
          className="flex w-full shrink-0 flex-col items-center justify-center gap-3 px-4 py-6 sm:w-36"
          style={{
            background: `linear-gradient(160deg, ${visualTheme.gradientFrom}, ${visualTheme.gradientTo})`,
          }}
        >
          {card.ageRange && (
            <span className="rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-gray-800">
              {card.ageRange}
            </span>
          )}
          {card.sport && (
            <HostPortalSportIcon sportId={card.sport} size={40} className="brightness-0 invert" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
          <div className="min-w-0 flex-1">
            <p className="text-xs font-medium text-gray-500">{card.programName}</p>
            <div className="mt-1 flex items-start gap-2">
              <h3 className="min-w-0 flex-1 text-xl font-semibold text-gray-900">{card.name}</h3>
              {hasDescription && (
                <button
                  type="button"
                  onClick={() => setInfoOpen(true)}
                  className="shrink-0 rounded-full p-1 text-gray-400 transition-colors hover:bg-gray-100 hover:text-gray-700"
                  style={{ color: uiColors.secondaryColor }}
                  aria-label={`About ${card.name}`}
                >
                  <Info size={18} aria-hidden />
                </button>
              )}
            </div>
            <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-gray-600">
              {card.facilityName && (
                <span className="inline-flex items-center gap-1">
                  <MapPin size={14} className="text-gray-400" aria-hidden />
                  {card.facilityName}
                </span>
              )}
              {card.dateRange && (
                <span className="inline-flex items-center gap-1">
                  <Calendar size={14} className="text-gray-400" aria-hidden />
                  {card.dateRange}
                </span>
              )}
              {card.weekCountLabel && (
                <span className="inline-flex items-center gap-1">
                  <Clock size={14} className="text-gray-400" aria-hidden />
                  {card.weekCountLabel}
                </span>
              )}
            </div>

            {hasPanelContent && (
              <button
                type="button"
                className="mt-3 flex w-full max-w-xl items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-medium"
                style={{
                  borderColor: uiColors.panelBorderColor,
                  backgroundColor: uiColors.panelBackgroundColor,
                  color: uiColors.panelTextColor,
                }}
                onClick={() => setPanelOpen((value) => !value)}
                aria-expanded={panelOpen}
              >
                <span>{schedulePanelLabel(timeChips, card)}</span>
                <ChevronDown
                  size={16}
                  className={cn('shrink-0 transition-transform', panelOpen && 'rotate-180')}
                />
              </button>
            )}
          </div>

          {!hideRegistrationLinks && card.registerUrl && (
            <div className="flex shrink-0 flex-col items-end gap-2 sm:min-w-[9rem]">
              {priceLabel && (
                <p className="text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  From{' '}
                  <span className="text-lg tabular-nums text-gray-900" style={{ color: primaryColor }}>
                    {card.startingPriceLabel}
                  </span>
                </p>
              )}
              <a
                href={card.registerUrl}
                className={cn(
                  'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm',
                  card.isClosed && 'pointer-events-none opacity-60',
                )}
                style={{
                  background: card.isClosed
                    ? '#9CA3AF'
                    : `linear-gradient(135deg, ${visualTheme.gradientFrom}, ${visualTheme.gradientTo})`,
                }}
                aria-disabled={card.isClosed}
              >
                {card.isClosed ? 'Closed' : 'Register'}
                <ArrowRight size={16} />
              </a>
            </div>
          )}
        </div>
      </div>

      {panelOpen && (
        <div className="w-full border-t border-gray-100 bg-gray-50/60 px-4 py-3 sm:px-5">
          {showSegments && (
            <ul className="flex flex-col gap-2">
              {segmentsLoading && (
                <li className="text-sm text-gray-500">Loading dates…</li>
              )}
              {!segmentsLoading && segmentsError && (
                <li className="text-sm text-red-600">{segmentsError}</li>
              )}
              {!segmentsLoading &&
                !segmentsError &&
                loadedSegments.map((segment) => {
                  const dateChips = buildSegmentDateChips(segment);
                  const segmentTimeChips = filterChipsForSegment(timeChips, segment.id);
                  const isSegmentExpanded = expandedSegmentIds.has(segment.id);
                  return (
                    <li key={segment.id} className="flex flex-col">
                      <button
                        type="button"
                        className={cn(
                          'flex w-full items-center justify-between gap-4 rounded-lg border px-3 py-2.5 text-left transition-colors',
                          !isSegmentExpanded && 'border-gray-200 bg-white',
                        )}
                        style={
                          isSegmentExpanded
                            ? {
                                borderColor: uiColors.panelBorderColor,
                                backgroundColor: uiColors.panelBackgroundColor,
                              }
                            : undefined
                        }
                        onClick={() => toggleSegment(segment.id)}
                        aria-expanded={isSegmentExpanded}
                      >
                        <div className="flex min-w-0 flex-wrap gap-2">
                          {dateChips.map((chip) => (
                            <span
                              key={`${segment.id}-${chip}`}
                              className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
                            >
                              {chip}
                            </span>
                          ))}
                        </div>
                        <div className="flex shrink-0 items-center gap-2">
                          {priceLabel && (
                            <span
                              className="text-sm font-semibold tabular-nums text-gray-900"
                              style={{ color: primaryColor }}
                            >
                              {priceLabel}
                            </span>
                          )}
                          <ChevronDown
                            size={14}
                            className={cn(
                              'text-gray-500 transition-transform',
                              isSegmentExpanded && 'rotate-180',
                            )}
                            aria-hidden
                          />
                        </div>
                      </button>
                      {isSegmentExpanded && (
                        <div className="px-1 pb-1">
                          {segmentTimeChips.length > 0 ? (
                            <SessionTimeChipGrid
                              chips={segmentTimeChips}
                              hideRegistrationLinks={hideRegistrationLinks}
                              linkTarget={linkTarget}
                              fallbackRegistrationUrl={card.registerUrl}
                              uiColors={uiColors}
                            />
                          ) : (
                            <p className="mt-2 text-xs text-gray-500">No class times listed.</p>
                          )}
                        </div>
                      )}
                    </li>
                  );
                })}
              {!segmentsLoading && !segmentsError && loadedSegments.length === 0 && (
                <li className="text-sm text-gray-500">No dates listed for this session.</li>
              )}
            </ul>
          )}

          {!showSegments && orphanTimeChips.length > 0 && (
            <SessionTimeChipGrid
              chips={orphanTimeChips}
              hideRegistrationLinks={hideRegistrationLinks}
              linkTarget={linkTarget}
              fallbackRegistrationUrl={card.registerUrl}
              uiColors={uiColors}
            />
          )}

          {showSegments && orphanTimeChips.length > 0 && (
            <div className={cn(loadedSegments.length > 0 && 'mt-3')}>
              <button
                type="button"
                className="flex w-full items-center justify-between rounded-lg border border-gray-200 bg-white px-3 py-2 text-left text-xs font-semibold uppercase tracking-wide text-gray-600 hover:bg-gray-50"
                onClick={() => setOtherTimesOpen((value) => !value)}
                aria-expanded={otherTimesOpen}
              >
                <span>Other class times ({orphanTimeChips.length})</span>
                <ChevronDown
                  size={14}
                  className={cn('transition-transform', otherTimesOpen && 'rotate-180')}
                  aria-hidden
                />
              </button>
              {otherTimesOpen && (
                <SessionTimeChipGrid
                  chips={orphanTimeChips}
                  hideRegistrationLinks={hideRegistrationLinks}
                  linkTarget={linkTarget}
                  fallbackRegistrationUrl={card.registerUrl}
                  uiColors={uiColors}
                />
              )}
            </div>
          )}

          {timeChips.length === 0 &&
            !showSegments &&
            showScheduleTab &&
            onOpenSchedule && (
              <button
                type="button"
                className="text-sm font-semibold hover:underline"
                style={{ color: uiColors.secondaryColor }}
                onClick={() => onOpenSchedule(card.programId, card.sessionId)}
              >
                Open full schedule
              </button>
            )}
        </div>
      )}
      <HostPortalSessionInfoDialog
        open={infoOpen}
        onClose={() => setInfoOpen(false)}
        programName={card.programName}
        sessionName={card.name}
        description={card.description}
        longDescription={card.longDescription}
        accentColor={uiColors.primaryColor}
      />
    </article>
  );
}
