'use client';

import { Calendar, ExternalLink, ChevronDown } from 'lucide-react';
import { useState } from 'react';
import type { DiscoveryConfig } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import { HostPortalSessionIconStrip } from './HostPortalSessionIconStrip';
import { cn } from '@/lib/utils';
import { gtmEvent } from '@/components/analytics/GoogleTagManager';
import { bondAnalytics } from '@/lib/analytics';

interface IHostPortalSessionCardProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  hideRegistrationLinks?: boolean;
}

export function HostPortalSessionCard({
  card,
  config,
  hideRegistrationLinks = false,
}: IHostPortalSessionCardProps) {
  const [expanded, setExpanded] = useState(true);
  const secondaryColor = config.branding.secondaryColor || '#6366F1';
  const showPricing = config.features.showPricing !== false;
  const showAgeGender = config.features.showAgeGender !== false;

  return (
    <article className="bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm hover:shadow-md transition-shadow">
      <HostPortalSessionIconStrip
        sport={card.sport}
        facilityName={card.facilityName}
        ageRange={showAgeGender ? card.ageRange : undefined}
        genderLabel={showAgeGender ? card.genderLabel : undefined}
      />

      <div className="p-4">
        <div className="flex items-start justify-between gap-2">
          <div className="min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <h3 className="font-bold text-gray-900 text-base leading-tight">{card.name}</h3>
              {card.isClosed && (
                <span className="px-2 py-0.5 text-xs font-bold bg-gray-100 text-gray-600 rounded-full">
                  Closed
                </span>
              )}
            </div>
            <p className="text-xs text-gray-500 mt-0.5">{card.programName}</p>
          </div>
          {(card.products.length > 0 || card.segments.length > 0) && (
            <button
              type="button"
              className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
              onClick={() => setExpanded((value) => !value)}
              aria-expanded={expanded}
              aria-label={expanded ? 'Collapse details' : 'Expand details'}
            >
              <ChevronDown size={18} className={cn('transition-transform', expanded && 'rotate-180')} />
            </button>
          )}
        </div>

        {card.dateRange && (
          <p className="flex items-center gap-1 text-xs text-gray-500 mt-2">
            <Calendar size={12} className="text-gray-400 shrink-0" aria-hidden />
            {card.dateRange}
          </p>
        )}

        {card.description && (
          <p className="text-sm text-gray-600 mt-3 line-clamp-4">{card.description}</p>
        )}

        {expanded && card.segments.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100">
            <p className="text-xs font-semibold text-gray-500 mb-2">Segments</p>
            <ul className="space-y-2">
              {card.segments.map((segment) => (
                <li key={segment.id} className="text-sm text-gray-700 bg-gray-50 rounded-lg px-3 py-2">
                  <span className="font-medium">{segment.name}</span>
                  {segment.dateRange && (
                    <span className="text-gray-500 text-xs block mt-0.5">{segment.dateRange}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}

        {expanded && showPricing && card.products.length > 0 && (
          <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
            <p className="text-xs font-semibold text-gray-500">Pricing</p>
            {card.products.map((product) => (
              <div
                key={product.id}
                className="flex items-center justify-between gap-3 p-3 bg-gray-50 rounded-lg"
              >
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-900">{product.name}</p>
                  {product.description && (
                    <p className="text-xs text-gray-500 line-clamp-2">{product.description}</p>
                  )}
                  {product.priceLabel && (
                    <p className="text-sm font-bold text-gray-900 mt-1">{product.priceLabel}</p>
                  )}
                </div>
                {!hideRegistrationLinks && product.registrationUrl && (
                  <a
                    href={product.registrationUrl}
                    className={cn(
                      'shrink-0 flex items-center gap-1 px-3 py-1.5 text-xs font-semibold rounded-lg text-white',
                      product.registerDisabled && 'opacity-60 pointer-events-none cursor-not-allowed',
                    )}
                    style={{
                      backgroundColor: product.registerDisabled ? '#9CA3AF' : secondaryColor,
                    }}
                    aria-disabled={product.registerDisabled}
                    onClick={() => {
                      if (product.registerDisabled) {
                        return;
                      }
                      gtmEvent.clickRegister({
                        programId: card.programId,
                        programName: card.programName,
                        sessionId: card.sessionId,
                        sessionName: card.name,
                        productId: product.id,
                      });
                      bondAnalytics.clickRegister(config.slug, {
                        programId: card.programId,
                        programName: card.programName,
                        sessionId: card.sessionId,
                        sessionName: card.name,
                        productId: product.id,
                      });
                    }}
                  >
                    {product.registerDisabled ? 'Closed' : 'Register'}
                    <ExternalLink size={12} />
                  </a>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </article>
  );
}
