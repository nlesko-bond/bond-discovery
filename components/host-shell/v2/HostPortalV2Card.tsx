'use client';

import { useEffect, useState } from 'react';
import { ChevronDown, ChevronUp } from 'lucide-react';
import type { DiscoveryConfig, MemberPricingStyle } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import {
  derivePortalCardTint,
  resolveMemberPricing,
  resolveV2Availability,
  type PortalV2AvailabilityKind,
} from '@/lib/host-shell/portal-v2';
import { cn } from '@/lib/utils';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';
import { getBondRegisterLinkAnalyticsAttributes } from '@/lib/host-shell/registration-analytics';
import { resolvePortalScheduleLinkTarget } from '@/lib/host-shell/portal-schedule-events';
import { HostPortalSportIcon } from '../HostPortalSportIcon';
import { HostPortalV2TieredPricingLine } from './HostPortalV2TieredPricingLine';

const CLOSED_REGISTER_BACKGROUND = '#9CA3AF';

const AVAILABILITY_PILL_STYLES: Record<
  PortalV2AvailabilityKind,
  { background: string; color: string }
> = {
  open: { background: '#dcfce7', color: '#166534' },
  almost_full: { background: '#fef3c7', color: '#92400e' },
  full: { background: '#f3f4f6', color: '#4b5563' },
  closed: { background: '#f3f4f6', color: '#4b5563' },
};

interface IHostPortalV2CardProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  accentColor: string;
  memberPricingStyle: MemberPricingStyle;
  hideRegistrationLinks?: boolean;
}

function buildMetaLine(card: IHostPortalSessionCardModel): string | undefined {
  const parts = [card.ageRange, card.genderLabel, card.dateRange].filter(
    (part): part is string => Boolean(part && part.trim()),
  );
  return parts.length > 0 ? parts.join(' · ') : undefined;
}

export function HostPortalV2Card({
  card,
  config,
  accentColor,
  memberPricingStyle,
  hideRegistrationLinks = false,
}: IHostPortalV2CardProps) {
  const tint = derivePortalCardTint(accentColor, card.sport);
  const availability = resolveV2Availability(card);
  const pillStyle = AVAILABILITY_PILL_STYLES[availability.kind];
  const showPricing = config.features.showPricing !== false;
  const showAvailability = config.features.showAvailability !== false;
  const linkTarget = resolvePortalScheduleLinkTarget(config);
  const linkRel = linkTarget === '_blank' ? 'noopener noreferrer' : undefined;

  const [detailsOpen, setDetailsOpen] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  useEffect(() => {
    setDetailsOpen(false);
    setImageFailed(false);
  }, [card.sessionId]);

  const metaLine = buildMetaLine(card);
  const memberPricing = showPricing ? resolveMemberPricing(card.products) : {};
  const priceLabel =
    showPricing && card.startingPriceLabel
      ? card.hasMultipleRegisterOptions
        ? `From ${card.startingPriceLabel}`
        : (card.products[0]?.priceLabel ?? card.startingPriceLabel)
      : undefined;

  const hasDetails =
    Boolean(card.description?.trim() || card.longDescription?.trim()) ||
    card.segments.length > 0 ||
    (card.hasMultipleRegisterOptions && card.products.length > 1);

  const showPhoto = Boolean(card.imageUrl) && !imageFailed;

  const registerAnalyticsAttributes = getBondRegisterLinkAnalyticsAttributes({
    programId: card.programId,
    programName: card.programName,
    sessionId: card.sessionId,
    sessionName: card.name,
    productId: card.registerProductId,
  });

  const trackRegisterClick = (productId?: string) => {
    if (card.isClosed) {
      return;
    }
    // Embedded clicks are tracked by HostShellPortalBridge → trackHostShellRegisterClick.
    if (typeof window !== 'undefined' && window.self !== window.top) {
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

  return (
    <article
      data-testid="portal-v2-card"
      className="flex h-full flex-col overflow-hidden rounded-xl bg-white ring-1 ring-gray-200 transition-shadow duration-200 hover:shadow-md"
    >
      {/* Visual panel: tinted sport glyph is the primary visual; program photo enhances when present. */}
      <div
        className="relative flex h-24 items-center justify-center overflow-hidden"
        style={{ backgroundColor: tint.panelBackground }}
      >
        {showPhoto ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={card.imageUrl}
            alt=""
            loading="lazy"
            className="absolute inset-0 h-full w-full object-cover"
            onError={() => setImageFailed(true)}
          />
        ) : (
          <span style={{ color: tint.glyphColor }} aria-hidden>
            <HostPortalSportIcon sportId={card.sport || 'sports'} size={40} />
          </span>
        )}
        {showAvailability && (
          <span
            data-testid="portal-v2-availability"
            className="absolute left-2.5 top-2.5 rounded-full px-2 py-0.5 text-[11px] font-medium"
            style={{ backgroundColor: pillStyle.background, color: pillStyle.color }}
          >
            {availability.label}
          </span>
        )}
      </div>

      <div className="flex flex-1 flex-col gap-1.5 p-4">
        <p className="truncate text-xs text-gray-500" title={card.programName}>
          {card.programName}
        </p>
        <h3 className="text-[15px] font-medium leading-snug text-gray-900">
          {card.name || card.programName}
        </h3>
        {metaLine && (
          <p className="text-xs leading-relaxed text-gray-500">{metaLine}</p>
        )}

        {/* Price row: works with and without member pricing (no gap when absent). */}
        {priceLabel && (
          <div className="mt-1" data-testid="portal-v2-price-row">
            {memberPricingStyle === 'stacked' ? (
              <>
                <p className="text-[15px] font-semibold tabular-nums text-gray-900">
                  {priceLabel}
                </p>
                {memberPricing.memberPriceLabel && (
                  <p
                    className="text-xs font-medium tabular-nums"
                    style={{ color: accentColor }}
                  >
                    Members from {memberPricing.memberPriceLabel}
                  </p>
                )}
              </>
            ) : (
              <p className="flex flex-wrap items-center gap-x-1.5 gap-y-1 text-[15px] font-semibold tabular-nums text-gray-900">
                {priceLabel}
                {memberPricing.memberPriceLabel &&
                  (memberPricingStyle === 'badge' ? (
                    <span
                      className="rounded-full px-2 py-0.5 text-[11px] font-medium tabular-nums"
                      style={{
                        backgroundColor: `${accentColor}14`,
                        color: accentColor,
                      }}
                    >
                      Members {memberPricing.memberPriceLabel}
                    </span>
                  ) : (
                    <span
                      className="text-xs font-medium tabular-nums"
                      style={{ color: accentColor }}
                    >
                      · {memberPricing.memberPriceLabel} members
                    </span>
                  ))}
              </p>
            )}
          </div>
        )}
        {card.tieredPricingLabel && (
          <HostPortalV2TieredPricingLine label={card.tieredPricingLabel} />
        )}

        {detailsOpen && (
          <div className="mt-2 space-y-2 border-t border-gray-100 pt-2 text-xs text-gray-600">
            {(card.description || card.longDescription) && (
              <p className="leading-relaxed">
                {card.description || card.longDescription}
              </p>
            )}
            {card.segments.length > 0 && (
              <ul className="space-y-1">
                {card.segments.map((segment) => (
                  <li key={segment.id} className="flex justify-between gap-2">
                    <span className="truncate">{segment.name}</span>
                    {segment.dateRange && (
                      <span className="shrink-0 text-gray-400">{segment.dateRange}</span>
                    )}
                  </li>
                ))}
              </ul>
            )}
            {showPricing && card.hasMultipleRegisterOptions && card.products.length > 1 && (
              <ul className="space-y-1.5">
                {card.products.map((product) => (
                  <li key={product.id} className="flex items-center justify-between gap-2">
                    <span className="min-w-0 truncate text-gray-700">{product.name}</span>
                    <span className="flex shrink-0 items-center gap-2">
                      {product.priceLabel && (
                        <span className="font-medium tabular-nums text-gray-900">
                          {product.priceLabel}
                        </span>
                      )}
                      {!hideRegistrationLinks && product.registrationUrl && (
                        <a
                          href={product.registrationUrl}
                          target={linkTarget}
                          rel={linkRel}
                          {...getBondRegisterLinkAnalyticsAttributes({
                            programId: card.programId,
                            programName: card.programName,
                            sessionId: card.sessionId,
                            sessionName: card.name,
                            productId: product.id,
                          })}
                          className={cn(
                            'rounded-md px-2 py-1 text-[11px] font-medium text-white',
                            product.registerDisabled &&
                              'pointer-events-none cursor-not-allowed opacity-60',
                          )}
                          style={{
                            backgroundColor: product.registerDisabled
                              ? CLOSED_REGISTER_BACKGROUND
                              : accentColor,
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
                        </a>
                      )}
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        )}

        <div className="mt-auto flex flex-col gap-2 pt-3 sm:flex-row sm:items-center">
          {!hideRegistrationLinks && card.registerUrl && (
            <a
              href={card.registerUrl}
              target={linkTarget}
              rel={linkRel}
              {...registerAnalyticsAttributes}
              className={cn(
                'inline-flex min-h-[44px] w-full items-center justify-center rounded-lg px-4 text-[13px] font-medium text-white transition-opacity hover:opacity-90 sm:flex-1',
                card.isClosed && 'pointer-events-none cursor-not-allowed opacity-60',
              )}
              style={{
                backgroundColor: card.isClosed
                  ? CLOSED_REGISTER_BACKGROUND
                  : accentColor,
              }}
              aria-disabled={card.isClosed}
              onClick={() => trackRegisterClick(card.registerProductId)}
            >
              {card.isClosed ? 'Closed' : 'Register'}
            </a>
          )}
          {hasDetails && (
            <button
              type="button"
              className="inline-flex min-h-[44px] items-center justify-center gap-1 rounded-lg px-3 text-[13px] font-medium text-gray-600 transition-colors hover:bg-gray-50 hover:text-gray-900"
              onClick={() => setDetailsOpen((open) => !open)}
              aria-expanded={detailsOpen}
            >
              Details
              {detailsOpen ? (
                <ChevronUp size={14} aria-hidden />
              ) : (
                <ChevronDown size={14} aria-hidden />
              )}
            </button>
          )}
        </div>
      </div>
    </article>
  );
}
