'use client';

import { useEffect, useState } from 'react';
import { Calendar, ChevronDown, Clock, MapPin, ArrowRight } from 'lucide-react';
import type { DiscoveryConfig } from '@/types';
import type {
  IHostPortalSegmentRow,
  IHostPortalSessionCardModel,
} from '@/lib/host-shell/session-card-model';
import type { IHostPortalSessionTimeChip } from '@/lib/host-shell/portal-session-events';
import { summarizeSessionTimeChips } from '@/lib/host-shell/portal-session-events';
import { getSportVisualTheme } from '@/lib/host-shell/sport-visuals';
import { resolvePortalBrandColors } from '@/lib/host-shell/portal-branding';
import { HostPortalSportIcon } from '../HostPortalSportIcon';
import { cn } from '@/lib/utils';

interface IHostPortalSessionListRowProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  timeChips: IHostPortalSessionTimeChip[];
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

function schedulePanelLabel(
  timeChips: IHostPortalSessionTimeChip[],
  card: IHostPortalSessionCardModel,
): string {
  if (timeChips.length > 0) {
    return summarizeSessionTimeChips(timeChips);
  }
  if (card.isSegmented || card.segments.length > 0) {
    return 'View segments';
  }
  return 'View schedule';
}

export function HostPortalSessionListRow({
  card,
  config,
  timeChips,
  onOpenSchedule,
}: IHostPortalSessionListRowProps) {
  const { primaryColor } = resolvePortalBrandColors(config);
  const sportTheme = getSportVisualTheme(card.sport);
  const [panelOpen, setPanelOpen] = useState(false);
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

  useEffect(() => {
    setLoadedSegments(card.segments);
  }, [card.sessionId, card.segments]);

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

  const hasPanelContent = timeChips.length > 0 || showSegments || (showScheduleTab && onOpenSchedule);

  return (
    <article className="flex flex-col rounded-2xl border border-gray-200 bg-white shadow-sm sm:flex-row">
      <div
        className="flex w-full shrink-0 flex-col items-center justify-center gap-3 overflow-hidden rounded-t-2xl px-4 py-6 sm:w-36 sm:rounded-l-2xl sm:rounded-tr-none"
        style={{
          background: `linear-gradient(160deg, ${sportTheme.gradientFrom}, ${sportTheme.gradientTo})`,
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
          <h3 className="mt-1 text-xl font-semibold text-gray-900">{card.name}</h3>
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
            <div className="mt-3 max-w-xl">
              <button
                type="button"
                className="flex w-full items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-left text-sm font-medium text-sky-900"
                onClick={() => setPanelOpen((value) => !value)}
                aria-expanded={panelOpen}
              >
                <span>{schedulePanelLabel(timeChips, card)}</span>
                <ChevronDown
                  size={16}
                  className={cn('shrink-0 transition-transform', panelOpen && 'rotate-180')}
                />
              </button>

              {panelOpen && (
                <div className="mt-2 rounded-xl border border-gray-200 bg-gray-50/80 p-3">
                  {timeChips.length > 0 && (
                    <div className="flex flex-wrap gap-2">
                      {timeChips.map((chip) => (
                        <span
                          key={chip.eventId}
                          className={cn(
                            'inline-flex items-center gap-1.5 rounded-lg border px-2.5 py-1.5 text-xs font-medium',
                            chip.isFull
                              ? 'border-gray-200 bg-gray-50 text-gray-400'
                              : 'border-gray-200 bg-white text-gray-800',
                          )}
                        >
                          <span
                            className={cn(
                              'h-2 w-2 rounded-full',
                              chip.isFull ? 'bg-gray-300' : 'bg-emerald-500',
                            )}
                          />
                          {chip.dayLabel} · {chip.timeLabel} · {chip.spotsLabel}
                        </span>
                      ))}
                    </div>
                  )}

                  {showSegments && (
                    <div className={cn(timeChips.length > 0 && 'mt-3 border-t border-gray-200 pt-3')}>
                      <p className="mb-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
                        Segments
                      </p>
                      {segmentsLoading && (
                        <p className="text-sm text-gray-500">Loading segments…</p>
                      )}
                      {!segmentsLoading && segmentsError && (
                        <p className="text-sm text-red-600">{segmentsError}</p>
                      )}
                      {!segmentsLoading && !segmentsError && loadedSegments.length > 0 && (
                        <ul className="grid gap-2 sm:grid-cols-2">
                          {loadedSegments.map((segment) => (
                            <li
                              key={segment.id}
                              className="rounded-lg border border-white bg-white px-3 py-2 text-sm text-gray-800 shadow-sm"
                            >
                              <span className="font-medium">{segment.name}</span>
                              {segment.dateRange && (
                                <span className="mt-0.5 block text-xs text-gray-500">
                                  {segment.dateRange}
                                </span>
                              )}
                            </li>
                          ))}
                        </ul>
                      )}
                      {!segmentsLoading && !segmentsError && loadedSegments.length === 0 && (
                        <p className="text-sm text-gray-500">No segments listed for this session.</p>
                      )}
                    </div>
                  )}

                  {timeChips.length === 0 && showScheduleTab && onOpenSchedule && (
                    <button
                      type="button"
                      className={cn(
                        'text-sm font-semibold text-sky-800 hover:underline',
                        showSegments && 'mt-3',
                      )}
                      onClick={() => onOpenSchedule(card.programId, card.sessionId)}
                    >
                      Open full schedule
                    </button>
                  )}
                </div>
              )}
            </div>
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
                  : `linear-gradient(135deg, ${sportTheme.gradientFrom}, ${sportTheme.gradientTo})`,
              }}
              aria-disabled={card.isClosed}
            >
              {card.isClosed ? 'Closed' : 'Register'}
              <ArrowRight size={16} />
            </a>
          </div>
        )}
      </div>
    </article>
  );
}
