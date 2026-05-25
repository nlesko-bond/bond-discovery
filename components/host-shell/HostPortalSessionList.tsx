'use client';

import { useState } from 'react';
import type { DiscoveryConfig, DiscoveryFilters } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import { buildPortalCardAccentContext } from '@/lib/host-shell/portal-card-accent';
import { HostPortalSessionCard } from './HostPortalSessionCard';

interface IHostPortalSessionListProps {
  cards: IHostPortalSessionCardModel[];
  config: DiscoveryConfig;
  filters: DiscoveryFilters;
  onOpenSchedule?: (programId: string, sessionId: string) => void;
}

export function HostPortalSessionList({
  cards,
  config,
  filters,
  onOpenSchedule,
}: IHostPortalSessionListProps) {
  const [segmentsOpenSessionId, setSegmentsOpenSessionId] = useState<string | null>(null);
  const accentContext = buildPortalCardAccentContext(config, cards, filters);

  if (cards.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500 text-sm">
        No sessions match your filters.
      </div>
    );
  }

  return (
    <div className="py-4 md:py-6">
      <div className="grid grid-cols-1 items-stretch gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {cards.map((card) => {
          const segmentsOpen = segmentsOpenSessionId === card.sessionId;
          return (
            <HostPortalSessionCard
              key={card.sessionId}
              card={card}
              config={config}
              accentContext={accentContext}
              hideRegistrationLinks={config.features.hideRegistrationLinks}
              segmentsOpen={segmentsOpen}
              onSegmentsOpenChange={(open) =>
                setSegmentsOpenSessionId(open ? card.sessionId : null)
              }
              onOpenSchedule={onOpenSchedule}
            />
          );
        })}
      </div>
    </div>
  );
}
