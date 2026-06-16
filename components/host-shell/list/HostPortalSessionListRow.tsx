'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, MapPin, ArrowRight, ShoppingCart, Info } from 'lucide-react';
import type { DiscoveryConfig } from '@/types';
import type {
  IHostPortalSegmentRow,
  IHostPortalSessionCardModel,
} from '@/lib/host-shell/session-card-model';
import type { IHostPortalSessionTimeChip } from '@/lib/host-shell/portal-session-events';
import { formatSessionTimeChipLabel } from '@/lib/host-shell/portal-session-events';
import { resolvePortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import type { IPortalCardAccentContext } from '@/lib/host-shell/portal-card-accent';
import { hasHostPortalSessionDescription } from '@/lib/host-shell/portal-session-description';
import { HostPortalSessionInfoDialog } from './HostPortalSessionInfoDialog';
import { resolvePortalScheduleLinkTarget } from '@/lib/host-shell/portal-schedule-events';
import { getBondRegisterLinkAnalyticsAttributes } from '@/lib/host-shell/registration-analytics';
import { HostPortalSportIcon } from '../HostPortalSportIcon';
import { HostPortalV2TieredPricingLine } from '../v2/HostPortalV2TieredPricingLine';
import { cn } from '@/lib/utils';

const CLOSED_REGISTER_BACKGROUND = '#9CA3AF';
const AVAILABILITY_OPEN_DOT = '#22c55e';
const MAX_SLOT_BUBBLE_VISIBLE_ROWS = 2;
const SLOT_BUBBLE_ROW_HEIGHT_PX = 32;
const SLOT_BUBBLE_ROW_GAP_PX = 8;
const SLOT_BUBBLE_GRID_MAX_HEIGHT_PX =
  MAX_SLOT_BUBBLE_VISIBLE_ROWS * SLOT_BUBBLE_ROW_HEIGHT_PX +
  (MAX_SLOT_BUBBLE_VISIBLE_ROWS - 1) * SLOT_BUBBLE_ROW_GAP_PX;
const SLOT_BUBBLE_OVERFLOW_FADE_WIDTH_PX = 48;

interface IHostPortalSessionListRowProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  accentContext: IPortalCardAccentContext;
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

function buildSlotBubbleKey(chip: IHostPortalSessionTimeChip): string {
  return [
    chip.segmentId ?? 'session',
    chip.dayLabel,
    chip.timeLabel,
    chip.endTimeLabel ?? '',
  ].join('|');
}

function resolveSegmentForChip(
  chip: IHostPortalSessionTimeChip,
  segments: IHostPortalSegmentRow[],
): IHostPortalSegmentRow | undefined {
  if (!chip.segmentId) {
    return undefined;
  }
  return segments.find((segment) => segment.id === chip.segmentId);
}

interface ISessionSlotBubbleProps {
  chip: IHostPortalSessionTimeChip;
  isExpanded: boolean;
  onToggle: () => void;
}

function SessionSlotBubble({ chip, isExpanded, onToggle }: ISessionSlotBubbleProps) {
  const label = formatSessionTimeChipLabel(chip);

  return (
    <button
      type="button"
      onClick={onToggle}
      aria-expanded={isExpanded}
      className={cn(
        'inline-flex shrink-0 items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
        chip.isFull
          ? 'border-gray-200 bg-gray-50 text-gray-400'
          : isExpanded
            ? 'border-sky-300 bg-sky-50 text-gray-900'
            : 'border-gray-200 bg-white text-gray-800 hover:border-sky-200 hover:bg-sky-50/60',
      )}
    >
      <span
        className={cn('h-2 w-2 shrink-0 rounded-full', chip.isFull && 'bg-gray-300')}
        style={chip.isFull ? undefined : { backgroundColor: AVAILABILITY_OPEN_DOT }}
      />
      <span className="whitespace-nowrap">{label}</span>
    </button>
  );
}

interface ISessionSlotBubbleGridProps {
  chips: IHostPortalSessionTimeChip[];
  expandedSlotKey: string | null;
  onToggle: (chip: IHostPortalSessionTimeChip) => void;
}

function SessionSlotBubbleGrid({ chips, expandedSlotKey, onToggle }: ISessionSlotBubbleGridProps) {
  const gridRef = useRef<HTMLDivElement>(null);
  const [hasOverflow, setHasOverflow] = useState(false);
  const [showAllRows, setShowAllRows] = useState(false);

  useEffect(() => {
    setShowAllRows(false);
  }, [chips]);

  useEffect(() => {
    const node = gridRef.current;
    if (!node || showAllRows) {
      setHasOverflow(false);
      return;
    }

    const measureOverflow = () => {
      setHasOverflow(node.scrollHeight > node.clientHeight + 1);
    };

    measureOverflow();
    const observer = new ResizeObserver(measureOverflow);
    observer.observe(node);
    return () => observer.disconnect();
  }, [chips, showAllRows]);

  return (
    <div className="relative w-full min-w-0">
      <div
        ref={gridRef}
        className="flex w-full min-w-0 flex-row flex-wrap content-start gap-2 overflow-hidden"
        style={showAllRows ? undefined : { maxHeight: SLOT_BUBBLE_GRID_MAX_HEIGHT_PX }}
      >
        {chips.map((chip) => {
          const slotKey = buildSlotBubbleKey(chip);
          return (
            <SessionSlotBubble
              key={slotKey}
              chip={chip}
              isExpanded={expandedSlotKey === slotKey}
              onToggle={() => onToggle(chip)}
            />
          );
        })}
      </div>
      {hasOverflow && !showAllRows && (
        <>
          <div
            aria-hidden
            className="pointer-events-none absolute bottom-0 right-0 h-8 bg-gradient-to-l from-white via-white/95 to-transparent"
            style={{ width: SLOT_BUBBLE_OVERFLOW_FADE_WIDTH_PX }}
          />
          <button
            type="button"
            onClick={() => setShowAllRows(true)}
            className="absolute bottom-0 right-0 inline-flex h-8 min-w-8 items-center justify-center rounded-full border border-gray-200 bg-white px-2.5 text-base font-medium leading-none text-gray-500 shadow-sm transition-colors hover:border-gray-300 hover:bg-gray-50"
            aria-label="Show all time slots"
          >
            …
          </button>
        </>
      )}
    </div>
  );
}

interface ISessionSlotExpandPanelProps {
  chip: IHostPortalSessionTimeChip;
  segment?: IHostPortalSegmentRow;
  sessionDateRange?: string;
  hideRegistrationLinks: boolean;
  linkTarget: '_blank' | '_top' | '_self';
  fallbackRegistrationUrl?: string;
  accentColor: string;
  programId: string;
  programName: string;
  sessionId: string;
  sessionName: string;
}

function SessionSlotExpandPanel({
  chip,
  segment,
  sessionDateRange,
  hideRegistrationLinks,
  linkTarget,
  fallbackRegistrationUrl,
  accentColor,
  programId,
  programName,
  sessionId,
  sessionName,
}: ISessionSlotExpandPanelProps) {
  const dateChips = segment ? buildSegmentDateChips(segment) : sessionDateRange ? [sessionDateRange] : [];
  const registrationUrl = chip.registrationUrl ?? fallbackRegistrationUrl;
  const canRegister =
    !hideRegistrationLinks && !chip.isFull && Boolean(registrationUrl);
  const slotLabel = formatSessionTimeChipLabel(chip);

  return (
    <div className="mt-3 flex flex-wrap items-center gap-2 border-t border-gray-100 pt-3">
      {dateChips.map((dateChip) => (
        <span
          key={`${chip.eventId}-${dateChip}`}
          className="rounded-full bg-gray-100 px-2.5 py-1 text-xs font-medium text-gray-700"
        >
          {dateChip}
        </span>
      ))}
      {segment?.name && dateChips.length === 0 && (
        <span className="text-xs text-gray-500">{segment.name}</span>
      )}
      {canRegister && registrationUrl && (
        <a
          href={registrationUrl}
          target={linkTarget}
          rel={linkTarget === '_blank' ? 'noopener noreferrer' : undefined}
          {...getBondRegisterLinkAnalyticsAttributes({
            programId,
            programName,
            sessionId,
            sessionName,
          })}
          className="ml-auto inline-flex h-8 w-8 items-center justify-center rounded-full border border-gray-200 text-gray-600 transition-colors hover:border-gray-300 hover:bg-gray-50"
          style={{ color: accentColor }}
          aria-label={`Register for ${slotLabel}`}
        >
          <ShoppingCart size={15} aria-hidden />
        </a>
      )}
      {chip.isFull && (
        <span className="ml-auto text-xs font-medium text-gray-400">Full</span>
      )}
    </div>
  );
}

export function HostPortalSessionListRow({
  card,
  config,
  accentContext,
  timeChips,
  onOpenSchedule,
}: IHostPortalSessionListRowProps) {
  const cardVisualTheme = accentContext.getCardVisualTheme(card);
  const uiColors = resolvePortalUiColors(config, card.sport, cardVisualTheme);
  const { visualTheme, primaryColor } = uiColors;
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const linkRel = linkTarget === '_blank' ? 'noopener noreferrer' : undefined;
  const themeBackground =
    config.features.scheduleThemeStyle === 'gradient'
      ? `linear-gradient(160deg, ${visualTheme.gradientFrom}, ${visualTheme.gradientTo})`
      : visualTheme.gradientFrom;
  const [infoOpen, setInfoOpen] = useState(false);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);
  const [loadedSegments, setLoadedSegments] = useState<IHostPortalSegmentRow[]>(card.segments);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const hideRegistrationLinks = config.features.hideRegistrationLinks === true;
  const sessionRegisterAnalyticsAttributes = getBondRegisterLinkAnalyticsAttributes({
    programId: card.programId,
    programName: card.programName,
    sessionId: card.sessionId,
    sessionName: card.name,
    productId: card.registerProductId,
  });
  const showScheduleTab = (config.features.enabledTabs || ['programs', 'schedule']).includes(
    'schedule',
  );
  const needsSegmentFetch =
    card.isSegmented || card.segments.length > 0 || timeChips.some((chip) => chip.segmentId);

  const priceLabel = card.startingPriceLabel
    ? card.hasMultipleRegisterOptions
      ? `From ${card.startingPriceLabel}`
      : card.startingPriceLabel
    : undefined;

  const visibleTimeChips = useMemo(() => timeChips, [timeChips]);

  const expandedChip = useMemo(() => {
    if (!expandedSlotKey) {
      return undefined;
    }
    return visibleTimeChips.find((chip) => buildSlotBubbleKey(chip) === expandedSlotKey);
  }, [expandedSlotKey, visibleTimeChips]);

  useEffect(() => {
    setLoadedSegments(card.segments);
    setExpandedSlotKey(null);
  }, [card.sessionId, card.segments, timeChips]);

  useEffect(() => {
    if (!needsSegmentFetch || loadedSegments.length > 0 || !card.organizationId) {
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
    needsSegmentFetch,
    loadedSegments.length,
    card.organizationId,
    card.programId,
    card.sessionId,
    config.slug,
  ]);

  const toggleSlot = (chip: IHostPortalSessionTimeChip) => {
    const key = buildSlotBubbleKey(chip);
    setExpandedSlotKey((current) => (current === key ? null : key));
  };

  const hasDescription = hasHostPortalSessionDescription(
    card.description,
    card.longDescription,
  );
  const showSessionRegister = !hideRegistrationLinks && Boolean(card.registerUrl);

  return (
    <article className="overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm">
      <div className="flex flex-col sm:flex-row">
        <div
          className="flex w-full shrink-0 flex-col items-center justify-center gap-3 px-4 py-6 sm:w-36"
          style={{
            background: themeBackground,
          }}
        >
          {card.ageRange && (
            <span className="whitespace-nowrap rounded-full bg-white/95 px-2.5 py-1 text-[11px] font-semibold text-gray-800">
              {card.ageRange}
            </span>
          )}
          {card.sport && (
            <HostPortalSportIcon sportId={card.sport} size={40} className="brightness-0 invert" />
          )}
        </div>

        <div className="flex min-w-0 flex-1 flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
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
            </div>

            {(showSessionRegister || priceLabel) && (
              <div className="flex shrink-0 flex-col items-start gap-2 sm:items-end sm:min-w-[9rem]">
                {priceLabel && (
                  <p className="text-left text-xs font-semibold uppercase tracking-wide text-gray-500 sm:text-right">
                    From{' '}
                    <span className="text-lg tabular-nums text-gray-900" style={{ color: primaryColor }}>
                      {card.startingPriceLabel}
                    </span>
                  </p>
                )}
                {card.tieredPricingLabel && (
                  <HostPortalV2TieredPricingLine label={card.tieredPricingLabel} />
                )}
                {showSessionRegister && (
                  <a
                    href={card.registerUrl}
                    target={linkTarget}
                    rel={linkRel}
                    {...sessionRegisterAnalyticsAttributes}
                    className={cn(
                      'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm',
                      card.isClosed && 'pointer-events-none opacity-60',
                    )}
                    style={{
                      background: card.isClosed
                        ? CLOSED_REGISTER_BACKGROUND
                        : themeBackground,
                    }}
                    aria-disabled={card.isClosed}
                  >
                    {card.isClosed ? 'Closed' : 'Register'}
                    <ArrowRight size={16} />
                  </a>
                )}
              </div>
            )}
          </div>

          {segmentsLoading && visibleTimeChips.length > 0 && (
            <p className="text-xs text-gray-500">Loading dates…</p>
          )}
          {segmentsError && <p className="text-xs text-red-600">{segmentsError}</p>}

          {visibleTimeChips.length > 0 && (
            <div className="w-full min-w-0">
              <SessionSlotBubbleGrid
                chips={visibleTimeChips}
                expandedSlotKey={expandedSlotKey}
                onToggle={toggleSlot}
              />
              {expandedChip && (
                <SessionSlotExpandPanel
                  chip={expandedChip}
                  segment={resolveSegmentForChip(expandedChip, loadedSegments)}
                  sessionDateRange={card.dateRange}
                  hideRegistrationLinks={hideRegistrationLinks}
                  linkTarget={linkTarget}
                  fallbackRegistrationUrl={card.registerUrl}
                  accentColor={uiColors.secondaryColor}
                  programId={card.programId}
                  programName={card.programName}
                  sessionId={card.sessionId}
                  sessionName={card.name}
                />
              )}
            </div>
          )}

          {showScheduleTab && onOpenSchedule && (
            <button
              type="button"
              className="inline-flex w-fit items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
              onClick={() => onOpenSchedule(card.programId, card.sessionId)}
            >
              <Clock size={13} className="text-gray-400" aria-hidden />
              View schedule
            </button>
          )}
        </div>
      </div>
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
