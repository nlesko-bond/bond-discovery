'use client';

import { useEffect, useState } from 'react';
import { CalendarDays, ExternalLink } from 'lucide-react';
import type { DiscoveryConfig } from '@/types';
import type {
  IHostPortalSegmentRow,
  IHostPortalSessionCardModel,
} from '@/lib/host-shell/session-card-model';
import { trimSegmentDisplayName } from '@/lib/host-shell/session-card-model';
import { cn } from '@/lib/utils';

export interface IHostPortalSegmentsPanelActions {
  accentColor: string;
  registerUrl?: string;
  registerDisabled?: boolean;
  linkTarget?: string;
  linkRel?: string;
  /** data-bond-* attributes for the register link (partner GTM contract). */
  analyticsAttributes?: Record<string, string>;
  onRegisterClick?: () => void;
  onOpenSchedule?: () => void;
}

interface IHostPortalSessionSegmentsPanelProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  variant?: 'inline' | 'standalone';
  /** 'grid' lays segment rows out in responsive columns (full-width breakout). */
  layout?: 'stack' | 'grid';
  /** Session-level register / view-schedule actions rendered under the segment list. */
  actions?: IHostPortalSegmentsPanelActions;
}

export function HostPortalSessionSegmentsPanel({
  card,
  config,
  variant = 'standalone',
  layout = 'stack',
  actions,
}: IHostPortalSessionSegmentsPanelProps) {
  const [loadedSegments, setLoadedSegments] = useState<IHostPortalSegmentRow[]>(card.segments);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);
  const isInline = variant === 'inline';

  useEffect(() => {
    setLoadedSegments(card.segments);
    setSegmentsLoading(false);
    setSegmentsError(null);
  }, [card.sessionId, card.segments]);

  useEffect(() => {
    if (loadedSegments.length > 0 || !card.organizationId) {
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
    loadedSegments.length,
    card.organizationId,
    card.programId,
    card.sessionId,
    config.slug,
  ]);

  const showActions = Boolean(
    actions && (actions.registerUrl || actions.onOpenSchedule),
  );

  return (
    <div
      className={cn(
        isInline
          ? 'mt-2 space-y-2 rounded-lg border border-gray-200 bg-gray-50 p-3'
          : 'rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm',
      )}
      aria-label={`Segments for ${card.name}`}
    >
      {!isInline && (
        <p className="mb-3 text-xs font-semibold uppercase tracking-wide text-gray-500">Segments</p>
      )}
      {layout === 'grid' && (
        // Detached full-width breakout — name which session this panel belongs to.
        <p className="mb-2 text-[13px] font-semibold text-gray-800">
          {card.name} <span className="font-normal text-gray-500">· segments</span>
        </p>
      )}

      {segmentsLoading && <p className="text-sm text-gray-500">Loading segments...</p>}
      {!segmentsLoading && segmentsError && (
        <p className="text-sm text-red-600">{segmentsError}</p>
      )}
      {!segmentsLoading && !segmentsError && loadedSegments.length > 0 && (
        <ul
          className={cn(
            layout === 'grid'
              ? 'grid grid-cols-1 gap-1.5 sm:grid-cols-2 lg:grid-cols-3'
              : 'space-y-1.5',
          )}
        >
          {loadedSegments.map((segment) => (
            <li
              key={segment.id}
              className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 bg-white px-3 py-2"
            >
              <span className="min-w-0">
                <span className="block truncate text-sm font-medium text-gray-900">
                  {trimSegmentDisplayName(segment.name, card)}
                </span>
                {segment.dateRange && (
                  <span className="mt-0.5 block text-xs text-gray-500">{segment.dateRange}</span>
                )}
              </span>
            </li>
          ))}
        </ul>
      )}
      {!segmentsLoading && !segmentsError && loadedSegments.length === 0 && (
        <p className="text-sm text-gray-500">No segments listed for this session.</p>
      )}

      {showActions && actions && (
        <div className="mt-3 flex items-center justify-between gap-3 border-t border-gray-200 pt-3">
          {actions.onOpenSchedule ? (
            <button
              type="button"
              className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-700 underline-offset-2 hover:underline"
              onClick={actions.onOpenSchedule}
            >
              <CalendarDays size={13} aria-hidden />
              View schedule
            </button>
          ) : (
            <span />
          )}
          {actions.registerUrl && (
            <a
              href={actions.registerUrl}
              target={actions.linkTarget}
              rel={actions.linkRel}
              {...actions.analyticsAttributes}
              className={cn(
                'inline-flex min-h-[36px] items-center justify-center gap-1.5 rounded-lg px-4 text-[13px] font-semibold text-white transition-opacity hover:opacity-90',
                actions.registerDisabled && 'pointer-events-none cursor-not-allowed opacity-60',
              )}
              style={{
                backgroundColor: actions.registerDisabled ? '#9CA3AF' : actions.accentColor,
              }}
              aria-disabled={actions.registerDisabled}
              onClick={() => {
                if (actions.registerDisabled) {
                  return;
                }
                actions.onRegisterClick?.();
              }}
            >
              {actions.registerDisabled ? 'Closed' : 'Register'}
              <ExternalLink size={13} aria-hidden />
            </a>
          )}
        </div>
      )}
    </div>
  );
}
