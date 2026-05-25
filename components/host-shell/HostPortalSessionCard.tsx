'use client';

import { Calendar, Clock, ExternalLink, ChevronDown, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DiscoveryConfig } from '@/types';
import type {
  IHostPortalSegmentRow,
  IHostPortalSessionCardModel,
} from '@/lib/host-shell/session-card-model';
import { HostPortalSessionIconStrip } from './HostPortalSessionIconStrip';
import { resolvePortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import { cn } from '@/lib/utils';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';

const CLOSED_REGISTER_BACKGROUND = '#9CA3AF';

interface IHostPortalSessionCardProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  hideRegistrationLinks?: boolean;
  segmentsOpen: boolean;
  onSegmentsOpenChange: (open: boolean) => void;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

export function HostPortalSessionCard({
  card,
  config,
  hideRegistrationLinks = false,
  segmentsOpen,
  onSegmentsOpenChange,
  onOpenSchedule,
}: IHostPortalSessionCardProps) {
  const { primaryColor, secondaryColor, visualTheme } = resolvePortalUiColors(config, card.sport);
  const showPricing = config.features.showPricing !== false;
  const showAgeGender = config.features.showAgeGender !== false;
  const showScheduleTab = (config.features.enabledTabs || ['programs', 'schedule']).includes(
    'schedule',
  );

  const [loadedSegments, setLoadedSegments] = useState<IHostPortalSegmentRow[]>(card.segments);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    setLoadedSegments(card.segments);
    setPricingOpen(false);
    setSegmentsLoading(false);
    setSegmentsError(null);
  }, [card.sessionId, card.segments]);

  const displaySegments = loadedSegments;
  const showPricingOptions = showPricing && card.hasMultipleRegisterOptions && card.products.length > 0;
  const showSegmentsButton = card.isSegmented || card.segments.length > 0;

  useEffect(() => {
    if (!segmentsOpen || displaySegments.length > 0 || !card.organizationId) {
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
    segmentsOpen,
    displaySegments.length,
    card.organizationId,
    card.programId,
    card.sessionId,
    config.slug,
  ]);

  const collapsedPriceLabel =
    showPricing && card.startingPriceLabel
      ? card.hasMultipleRegisterOptions
        ? `From ${card.startingPriceLabel}`
        : card.products[0]?.priceLabel
      : undefined;

  const trackRegisterClick = (productId?: string) => {
    if (card.isClosed) {
      return;
    }
    gtmEvent.clickRegister({
      programId: card.programId,
      programName: card.programName,
      sessionId: card.sessionId,
      sessionName: card.name,
      productId,
    });
    bondAnalytics.clickRegister(config.slug, {
      programId: card.programId,
      programName: card.programName,
      sessionId: card.sessionId,
      sessionName: card.name,
      productId,
    });
  };

  const handleViewSchedule = () => {
    if (!showScheduleTab || !onOpenSchedule) {
      return;
    }
    onOpenSchedule(card.programId, card.sessionId);
  };

  const registerFooter = !hideRegistrationLinks && card.registerUrl && (
    <div className="flex flex-wrap items-center justify-between gap-3">
      <div className="min-w-0">
        {collapsedPriceLabel && (
          <p className="text-base font-bold tabular-nums" style={{ color: primaryColor }}>
            {collapsedPriceLabel}
          </p>
        )}
        {showPricingOptions && !pricingOpen && (
          <button
            type="button"
            className="mt-1 text-xs font-semibold hover:opacity-80"
            style={{ color: secondaryColor }}
            onClick={() => setPricingOpen(true)}
          >
            View all pricing options
          </button>
        )}
      </div>
      <a
        href={card.registerUrl}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90',
          card.isClosed && 'pointer-events-none cursor-not-allowed opacity-60',
        )}
        style={{
          background: card.isClosed
            ? CLOSED_REGISTER_BACKGROUND
            : `linear-gradient(135deg, ${visualTheme.gradientFrom}, ${visualTheme.gradientTo})`,
        }}
        aria-disabled={card.isClosed}
        onClick={() => trackRegisterClick(card.registerProductId)}
      >
        {card.isClosed ? 'Closed' : 'Register'}
        <ExternalLink size={14} />
      </a>
    </div>
  );

  return (
    <article
      className={cn(
        'group relative isolate flex h-full flex-col overflow-visible rounded-2xl',
        'bg-white ring-1 ring-gray-200/90 shadow-sm',
        'transition-shadow duration-300 hover:shadow-lg hover:ring-gray-300/90',
      )}
    >
      <HostPortalSessionIconStrip
        config={config}
        sport={card.sport}
        facilityName={card.facilityName}
        ageRange={showAgeGender ? card.ageRange : undefined}
        genderLabel={showAgeGender ? card.genderLabel : undefined}
      />

      <div className="flex flex-1 flex-col p-4 sm:p-5">
        <div className="min-w-0 flex-1">
          <p
            className="truncate text-[11px] font-semibold uppercase tracking-wider text-gray-500"
            title={card.programName}
          >
            {card.programName}
          </p>
          <div className="mt-1 flex flex-wrap items-start gap-2">
            <h3 className="line-clamp-2 min-h-[2.75rem] text-base font-semibold leading-snug text-gray-900">
              {card.name}
            </h3>
            {card.isClosed && (
              <span className="shrink-0 rounded-full bg-gray-100 px-2 py-0.5 text-[10px] font-bold uppercase tracking-wide text-gray-600">
                Closed
              </span>
            )}
          </div>

          <div className="mt-3 flex min-h-[2rem] flex-wrap items-center gap-2">
            {card.dateRange && (
              <span className="inline-flex items-center gap-1.5 rounded-full bg-gray-50 px-2.5 py-1 text-xs font-medium text-gray-600">
                <Calendar size={13} className="shrink-0 text-gray-400" aria-hidden />
                {card.dateRange}
              </span>
            )}
            {showScheduleTab && onOpenSchedule && (
              <button
                type="button"
                onClick={handleViewSchedule}
                className="inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-xs font-semibold transition-colors hover:opacity-90"
                style={{
                  borderColor: `${secondaryColor}35`,
                  backgroundColor: `${secondaryColor}10`,
                  color: secondaryColor,
                }}
              >
                <Clock size={13} aria-hidden />
                View schedule
              </button>
            )}
          </div>

          {!segmentsOpen && showSegmentsButton && (
            <button
              type="button"
              className="mt-3 flex w-full items-center justify-between gap-2 rounded-lg border border-gray-200 bg-gray-50 px-3 py-2 text-left text-sm font-semibold text-gray-700 transition-colors hover:bg-gray-100"
              onClick={() => onSegmentsOpenChange(true)}
              aria-expanded={segmentsOpen}
            >
              <span>View segments</span>
              <ChevronDown size={16} className="shrink-0 text-gray-500" />
            </button>
          )}

          {pricingOpen && showPricingOptions && (
            <div className="mt-3 space-y-2 rounded-xl border border-gray-200 bg-gray-50 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Pricing options
                </p>
                <button
                  type="button"
                  className="rounded-md p-1 text-gray-500 hover:bg-white hover:text-gray-800"
                  aria-label="Close pricing options"
                  onClick={() => setPricingOpen(false)}
                >
                  <X size={16} aria-hidden />
                </button>
              </div>
              <ul className="grid gap-2">
                {card.products.map((product) => (
                  <li
                    key={product.id}
                    className="flex items-center justify-between gap-3 rounded-lg border border-white bg-white p-3"
                  >
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                      {product.priceLabel && (
                        <p className="mt-1 text-sm font-bold" style={{ color: primaryColor }}>
                          {product.priceLabel}
                        </p>
                      )}
                    </div>
                    {!hideRegistrationLinks && product.registrationUrl && (
                      <a
                        href={product.registrationUrl}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm',
                          product.registerDisabled &&
                            'pointer-events-none cursor-not-allowed opacity-60',
                        )}
                        style={{
                          background: product.registerDisabled
                            ? CLOSED_REGISTER_BACKGROUND
                            : `linear-gradient(135deg, ${visualTheme.gradientFrom}, ${visualTheme.gradientTo})`,
                        }}
                        aria-disabled={product.registerDisabled}
                        onClick={() => {
                          if (product.registerDisabled) {
                            return;
                          }
                          trackRegisterClick(product.id);
                        }}
                      >
                        {product.registerDisabled ? 'Closed' : 'Register'}
                        <ExternalLink size={12} />
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          )}
        </div>

        {segmentsOpen && (
          <div
            className={cn(
              'mt-3 w-full shrink-0 rounded-xl border border-gray-200 bg-white p-3 shadow-lg',
              'xl:absolute xl:left-[calc(100%+0.75rem)] xl:top-16 xl:z-30 xl:w-80 xl:max-w-[calc(100vw-2rem)]',
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-2">
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Segments</p>
              <button
                type="button"
                className="shrink-0 rounded-md p-1 text-gray-500 hover:bg-gray-100 hover:text-gray-800"
                aria-label="Close segments"
                onClick={() => onSegmentsOpenChange(false)}
              >
                <X size={16} aria-hidden />
              </button>
            </div>
            {segmentsLoading && (
              <p className="text-sm text-gray-500">Loading segments...</p>
            )}
            {!segmentsLoading && segmentsError && (
              <p className="text-sm text-red-600">{segmentsError}</p>
            )}
            {!segmentsLoading && !segmentsError && displaySegments.length > 0 && (
              <ul className="max-h-64 space-y-2 overflow-y-auto">
                {displaySegments.map((segment) => (
                  <li
                    key={segment.id}
                    className="rounded-lg border border-gray-100 bg-gray-50 px-3 py-2.5 text-sm text-gray-800"
                  >
                    <span className="font-medium">{segment.name}</span>
                    {segment.dateRange && (
                      <span className="mt-0.5 block text-xs text-gray-500">{segment.dateRange}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {!segmentsLoading && !segmentsError && displaySegments.length === 0 && (
              <p className="text-sm text-gray-500">No segments listed for this session.</p>
            )}
          </div>
        )}

        <div className="mt-auto border-t border-gray-100 pt-4">{registerFooter}</div>
      </div>
    </article>
  );
}
