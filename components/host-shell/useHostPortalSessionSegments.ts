'use client';

import { useEffect, useState } from 'react';
import type { DiscoveryConfig } from '@/types';
import type {
  IHostPortalSegmentRow,
  IHostPortalSessionCardModel,
} from '@/lib/host-shell/session-card-model';
import { notifyPortalEmbedContentChange } from '@/lib/host-shell/embed-resize';

interface IUseHostPortalSessionSegmentsResult {
  segments: IHostPortalSegmentRow[];
  isLoading: boolean;
  error: string | null;
}

export function useHostPortalSessionSegments(
  card: IHostPortalSessionCardModel,
  config: DiscoveryConfig,
): IUseHostPortalSessionSegmentsResult {
  const [segments, setSegments] = useState<IHostPortalSegmentRow[]>(card.segments);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setSegments(card.segments);
    setIsLoading(false);
    setError(null);
  }, [card.sessionId, card.segments]);

  useEffect(() => {
    if (!card.organizationId) {
      return;
    }

    const params = new URLSearchParams({
      slug: config.slug,
      programId: card.programId,
      sessionId: card.sessionId,
      organizationId: card.organizationId,
      sessionName: card.name,
      programName: card.programName,
    });

    if (card.facilityName) {
      params.set('facilityName', card.facilityName);
    }
    if (card.registrationWindowStatus) {
      params.set('registrationWindowStatus', card.registrationWindowStatus);
    }
    if (card.waitlistEnabled !== undefined) {
      params.set('waitlistEnabled', String(card.waitlistEnabled));
    }
    if (card.startingPriceLabel) {
      params.set('priceLabel', card.startingPriceLabel);
    }

    setIsLoading(true);
    setError(null);

    fetch(`/api/portal-session-segments?${params.toString()}`)
      .then((response) => {
        if (!response.ok) {
          throw new Error(`Failed to load schedule options (${response.status})`);
        }
        return response.json();
      })
      .then((payload: { data?: IHostPortalSegmentRow[] }) => {
        if (Array.isArray(payload.data) && payload.data.length > 0) {
          setSegments(payload.data);
        }
      })
      .catch((loadError: unknown) => {
        setError(
          loadError instanceof Error ? loadError.message : 'Failed to load schedule options',
        );
      })
      .finally(() => {
        setIsLoading(false);
      });
  }, [
    card.facilityName,
    card.organizationId,
    card.programId,
    card.programName,
    card.name,
    card.registrationWindowStatus,
    card.sessionId,
    card.startingPriceLabel,
    card.waitlistEnabled,
    config.slug,
  ]);

  useEffect(() => {
    notifyPortalEmbedContentChange();
  }, [isLoading, segments.length, error]);

  return { segments, isLoading, error };
}
