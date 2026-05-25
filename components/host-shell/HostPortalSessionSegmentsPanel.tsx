'use client';

import { X } from 'lucide-react';
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
  onClose: () => void;
  className?: string;
}

export function HostPortalSessionSegmentsPanel({
  card,
  config,
  onClose,
  className,
}: IHostPortalSessionSegmentsPanelProps) {
  const [loadedSegments, setLoadedSegments] = useState<IHostPortalSegmentRow[]>(card.segments);
  const [segmentsLoading, setSegmentsLoading] = useState(false);
  const [segmentsError, setSegmentsError] = useState<string | null>(null);

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
    <section
      id={`portal-segments-${card.sessionId}`}
      className={cn(
        'rounded-xl border border-gray-200 bg-gray-50 p-4 shadow-sm',
        className,
      )}
      aria-label={`Segments for ${card.name}`}
    >
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">Segments</p>
          <p className="mt-0.5 truncate text-sm font-semibold text-gray-900">{card.name}</p>
        </div>
        <button
          type="button"
          className="shrink-0 rounded-md p-1.5 text-gray-500 hover:bg-white hover:text-gray-800"
          aria-label="Close segments"
          onClick={onClose}
        >
          <X size={18} aria-hidden />
        </button>
      </div>

      {segmentsLoading && <p className="text-sm text-gray-500">Loading segments...</p>}
      {!segmentsLoading && segmentsError && (
        <p className="text-sm text-red-600">{segmentsError}</p>
      )}
      {!segmentsLoading && !segmentsError && loadedSegments.length > 0 && (
        <ul className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
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
    </section>
  );
}
