'use client';

import { useState } from 'react';
import { Calendar, ChevronDown, Clock, MapPin, ArrowRight } from 'lucide-react';
import type { DiscoveryConfig } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
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

export function HostPortalSessionListRow({
  card,
  config,
  timeChips,
  onOpenSchedule,
}: IHostPortalSessionListRowProps) {
  const { primaryColor } = resolvePortalBrandColors(config);
  const sportTheme = getSportVisualTheme(card.sport);
  const [timesOpen, setTimesOpen] = useState(false);
  const hideRegistrationLinks = config.features.hideRegistrationLinks === true;
  const priceLabel = card.startingPriceLabel
    ? card.hasMultipleRegisterOptions
      ? `From ${card.startingPriceLabel}`
      : card.startingPriceLabel
    : undefined;

  return (
    <article className="flex flex-col overflow-hidden rounded-2xl border border-gray-200 bg-white shadow-sm sm:flex-row">
      <div
        className="flex w-full shrink-0 flex-col items-center justify-center gap-3 px-4 py-6 sm:w-36"
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

      <div className="flex min-w-0 flex-1 flex-col justify-between gap-4 p-4 sm:flex-row sm:items-center sm:p-5">
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

          <div className="relative mt-3 max-w-md">
            <button
              type="button"
              className="flex w-full items-center justify-between gap-2 rounded-lg border border-sky-200 bg-sky-50/80 px-3 py-2 text-left text-sm font-medium text-sky-900"
              onClick={() => setTimesOpen((value) => !value)}
              aria-expanded={timesOpen}
            >
              <span>{summarizeSessionTimeChips(timeChips)}</span>
              <ChevronDown
                size={16}
                className={cn('shrink-0 transition-transform', timesOpen && 'rotate-180')}
              />
            </button>
            {timesOpen && timeChips.length > 0 && (
              <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-gray-200 bg-white p-2 shadow-xl">
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
              </div>
            )}
            {timesOpen && timeChips.length === 0 && onOpenSchedule && (
              <div className="absolute left-0 right-0 z-30 mt-1 rounded-xl border border-gray-200 bg-white p-3 shadow-xl">
                <button
                  type="button"
                  className="text-sm font-semibold text-sky-800 hover:underline"
                  onClick={() => onOpenSchedule(card.programId, card.sessionId)}
                >
                  Open schedule for this session
                </button>
              </div>
            )}
          </div>
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
