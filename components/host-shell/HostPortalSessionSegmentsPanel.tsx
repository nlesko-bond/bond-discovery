'use client';

import { useEffect, useState } from 'react';
import type { DiscoveryConfig } from '@/types';
import type {
  IHostPortalSegmentRow,
  IHostPortalSessionCardModel,
} from '@/lib/host-shell/session-card-model';
import { cn } from '@/lib/utils';

interface IHostPortalSessionSegmentsPanelProps {
  card: IHostPortalSessionCardModel;
  config: DiscoveryConfig;
  variant?: 'inline' | 'standalone';
}

export function HostPortalSessionSegmentsPanel({
  card,
  config,
  variant = 'standalone',
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

      {segmentsLoading && <p className="text-sm text-gray-500">Loading segments...</p>}
      {!segmentsLoading && segmentsError && (
        <p className="text-sm text-red-600">{segmentsError}</p>
      )}
      {!segmentsLoading && !segmentsError && loadedSegments.length > 0 && (
        <ul className="space-y-2">
          {loadedSegments.map((segment) => (
            <li
              key={segment.id}
              className="rounded-lg border border-gray-100 bg-white px-3 py-2.5 text-sm text-gray-800"
            >
              <span className="font-medium">{segment.name}</span>
              {segment.dateRange && (
                <span className="mt-0.5 block text-xs text-gray-500">{segment.dateRange}</span>
              )}
            </li>
          ))}
        </ul>
      )}
      {!segmentsLoading && !segmentsError && loadedSegments.length === 0 && (
        <p className="text-sm text-gray-500">No segments listed for this session.</p>
      )}
    </div>
  );
}
