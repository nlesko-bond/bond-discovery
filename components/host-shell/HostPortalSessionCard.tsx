'use client';

import { Calendar, Clock, ChevronDown, ChevronUp, ExternalLink, X } from 'lucide-react';
import { useEffect, useState } from 'react';
import type { DiscoveryConfig } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import type { IPortalCardAccentContext } from '@/lib/host-shell/portal-card-accent';
import { HostPortalSessionIconStrip } from './HostPortalSessionIconStrip';
import { HostPortalSessionSegmentsPanel } from './HostPortalSessionSegmentsPanel';
import { resolvePortalUiColors } from '@/lib/host-shell/portal-accent-theme';
import { cn } from '@/lib/utils';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';
import { resolvePortalScheduleLinkTarget } from '@/lib/host-shell/portal-schedule-events';

const CLOSED_REGISTER_BACKGROUND = '#9CA3AF';

interface IHostPortalSessionCardProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  hideRegistrationLinks?: boolean;
  accentContext: IPortalCardAccentContext;
  segmentsOpen: boolean;
  onSegmentsOpenChange: (open: boolean) => void;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

export function HostPortalSessionCard({
  card,
  config,
  hideRegistrationLinks = false,
  accentContext,
  segmentsOpen,
  onSegmentsOpenChange,
  onOpenSchedule,
}: IHostPortalSessionCardProps) {
  const cardVisualTheme = accentContext.getCardVisualTheme(card);
  const { primaryColor, secondaryColor, visualTheme } = resolvePortalUiColors(
    config,
    card.sport,
    cardVisualTheme,
  );
  const showPricing = config.features.showPricing !== false;
  const showAgeGender = config.features.showAgeGender !== false;
  const showScheduleTab = (config.features.enabledTabs || ['programs', 'schedule']).includes(
    'schedule',
  );
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const linkRel = linkTarget === '_blank' ? 'noopener noreferrer' : undefined;
  const themeBackground =
    config.features.scheduleThemeStyle === 'gradient'
      ? `linear-gradient(135deg, ${visualTheme.gradientFrom}, ${visualTheme.gradientTo})`
      : visualTheme.gradientFrom;

  const [pricingOpen, setPricingOpen] = useState(false);

  useEffect(() => {
    setPricingOpen(false);
  }, [card.sessionId]);

  const showPricingOptions = showPricing && card.hasMultipleRegisterOptions && card.products.length > 0;
  const showSegmentsButton = card.isSegmented || card.segments.length > 0;

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
        target={linkTarget}
        rel={linkRel}
        className={cn(
          'inline-flex shrink-0 items-center gap-1.5 rounded-xl px-4 py-2.5 text-sm font-semibold text-white shadow-sm transition-opacity hover:opacity-90',
          card.isClosed && 'pointer-events-none cursor-not-allowed opacity-60',
        )}
        style={{
          background: card.isClosed
            ? CLOSED_REGISTER_BACKGROUND
            : themeBackground,
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
        'flex h-full flex-col overflow-hidden rounded-2xl bg-white ring-1 ring-gray-200/90 shadow-sm',
        'transition-shadow duration-300 hover:shadow-lg hover:ring-gray-300/90',
        segmentsOpen && 'ring-gray-300 shadow-md',
      )}
    >
      <HostPortalSessionIconStrip
        config={config}
        sport={card.sport}
        facilityName={card.facilityName}
        ageRange={showAgeGender ? card.ageRange : undefined}
        genderLabel={showAgeGender ? card.genderLabel : undefined}
        visualTheme={cardVisualTheme}
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

          {showSegmentsButton && (
            <button
              type="button"
              className={cn(
                'mt-3 flex w-full items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm font-semibold transition-colors',
                segmentsOpen
                  ? 'border-gray-300 bg-gray-100 text-gray-900'
                  : 'border-gray-200 bg-gray-50 text-gray-700 hover:bg-gray-100',
              )}
              onClick={() => onSegmentsOpenChange(!segmentsOpen)}
              aria-expanded={segmentsOpen}
            >
              <span>{segmentsOpen ? 'Hide segments' : 'View segments'}</span>
              {segmentsOpen ? (
                <ChevronUp size={16} className="shrink-0 text-gray-500" />
              ) : (
                <ChevronDown size={16} className="shrink-0 text-gray-500" />
              )}
            </button>
          )}

          {segmentsOpen && showSegmentsButton && (
            <HostPortalSessionSegmentsPanel
              card={card}
              config={config}
              variant="inline"
            />
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
                        target={linkTarget}
                        rel={linkRel}
                        className={cn(
                          'inline-flex shrink-0 items-center gap-1 rounded-lg px-3 py-2 text-xs font-semibold text-white shadow-sm',
                          product.registerDisabled &&
                            'pointer-events-none cursor-not-allowed opacity-60',
                        )}
                        style={{
                          background: product.registerDisabled
                            ? CLOSED_REGISTER_BACKGROUND
                            : themeBackground,
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

        <div className="mt-auto border-t border-gray-100 pt-4">{registerFooter}</div>
      </div>
    </article>
  );
}
