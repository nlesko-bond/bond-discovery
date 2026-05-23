'use client';

import { useEffect, useMemo, useState } from 'react';
import { Calendar, Clock, MapPin, ArrowRight, ShoppingCart, Info } from 'lucide-react';
import type { DiscoveryConfig } from '@/types';
import type {
  IHostPortalSegmentRow,
  IHostPortalSessionCardModel,
} from '@/lib/host-shell/session-card-model';
import type { IHostPortalSessionTimeChip } from '@/lib/host-shell/portal-session-events';
import { formatSessionTimeChipLabel } from '@/lib/host-shell/portal-session-events';
import { resolvePortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import { hasHostPortalSessionDescription } from '@/lib/host-shell/portal-session-description';
import { HostPortalSessionInfoDialog } from './HostPortalSessionInfoDialog';
import { resolvePortalScheduleLinkTarget } from '@/lib/host-shell/portal-schedule-events';
import { HostPortalSportIcon } from '../HostPortalSportIcon';
import { cn } from '@/lib/utils';

const CLOSED_REGISTER_BACKGROUND = '#9CA3AF';
const AVAILABILITY_OPEN_DOT = '#22c55e';

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
        'inline-flex items-center gap-1.5 rounded-full border px-3 py-1.5 text-xs font-medium transition-colors',
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
      <span>{label}</span>
    </button>
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
}

function SessionSlotExpandPanel({
  chip,
  segment,
  sessionDateRange,
  hideRegistrationLinks,
  linkTarget,
  fallbackRegistrationUrl,
  accentColor,
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
  timeChips,
  onOpenSchedule,
}: IHostPortalSessionListRowProps) {
  const uiColors = resolvePortalUiColors(config, card.sport);
  const { visualTheme, primaryColor } = uiColors;
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const [infoOpen, setInfoOpen] = useState(false);
  const [expandedSlotKey, setExpandedSlotKey] = useState<string | null>(null);
  const [loadedSegments, setLoadedSegments] = useState<IHostPortalSegmentRow[]>(card.segments);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const hideRegistrationLinks = config.features.hideRegistrationLinks === true;
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
    if (timeChips.length === 1) {
      setExpandedSlotKey(buildSlotBubbleKey(timeChips[0]));
    } else {
      setExpandedSlotKey(null);
    }
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

        <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-4 sm:flex-row sm:items-start sm:p-5">
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

            {segmentsLoading && visibleTimeChips.length > 0 && (
              <p className="mt-3 text-xs text-gray-500">Loading dates…</p>
            )}
            {segmentsError && (
              <p className="mt-3 text-xs text-red-600">{segmentsError}</p>
            )}

            {visibleTimeChips.length > 0 && (
              <div className="mt-3">
                <div className="flex flex-wrap gap-2">
                  {visibleTimeChips.map((chip) => {
                    const slotKey = buildSlotBubbleKey(chip);
                    return (
                      <SessionSlotBubble
                        key={slotKey}
                        chip={chip}
                        isExpanded={expandedSlotKey === slotKey}
                        onToggle={() => toggleSlot(chip)}
                      />
                    );
                  })}
                </div>
                {expandedChip && (
                  <SessionSlotExpandPanel
                    chip={expandedChip}
                    segment={resolveSegmentForChip(expandedChip, loadedSegments)}
                    sessionDateRange={card.dateRange}
                    hideRegistrationLinks={hideRegistrationLinks}
                    linkTarget={linkTarget}
                    fallbackRegistrationUrl={card.registerUrl}
                    accentColor={uiColors.secondaryColor}
                  />
                )}
              </div>
            )}

            {showScheduleTab && onOpenSchedule && (
              <button
                type="button"
                className="mt-3 inline-flex items-center gap-1.5 rounded-full border border-gray-200 bg-gray-50 px-2.5 py-1 text-xs font-semibold text-gray-700 transition-colors hover:bg-gray-100"
                onClick={() => onOpenSchedule(card.programId, card.sessionId)}
              >
                <Clock size={13} className="text-gray-400" aria-hidden />
                View schedule
              </button>
            )}
          </div>

          {(showSessionRegister || priceLabel) && (
            <div className="flex shrink-0 flex-col items-end gap-2 sm:min-w-[9rem]">
              {priceLabel && (
                <p className="text-right text-xs font-semibold uppercase tracking-wide text-gray-500">
                  From{' '}
                  <span className="text-lg tabular-nums text-gray-900" style={{ color: primaryColor }}>
                    {card.startingPriceLabel}
                  </span>
                </p>
              )}
              {showSessionRegister && (
                <a
                  href={card.registerUrl}
                  className={cn(
                    'inline-flex items-center gap-2 rounded-lg px-5 py-2.5 text-sm font-semibold text-white shadow-sm',
                    card.isClosed && 'pointer-events-none opacity-60',
                  )}
                  style={{
                    background: card.isClosed
                      ? CLOSED_REGISTER_BACKGROUND
                      : `linear-gradient(135deg, ${visualTheme.gradientFrom}, ${visualTheme.gradientTo})`,
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
