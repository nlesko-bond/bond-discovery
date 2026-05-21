'use client';

import { useState } from 'react';
import type { DiscoveryConfig } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import { HostPortalSessionCard } from './HostPortalSessionCard';
import { cn } from '@/lib/utils';

interface IHostPortalSessionListProps {
  cards: IHostPortalSessionCardModel[];
  config: DiscoveryConfig;
}

export function HostPortalSessionList({ cards, config }: IHostPortalSessionListProps) {
  const [expandedSessionId, setExpandedSessionId] = useState<string | null>(null);

  if (cards.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500 text-sm">
        No sessions match your filters.
      </div>
    );
  }

  return (
    <div className="py-4 md:py-6">
      <div className="grid grid-cols-1 items-start gap-4 md:grid-cols-2 md:gap-6 xl:grid-cols-3">
        {cards.map((card) => {
          const isExpanded = expandedSessionId === card.sessionId;
          return (
            <div
              key={card.sessionId}
              className={cn(isExpanded && 'col-span-1 md:col-span-2 xl:col-span-3')}
            >
              <HostPortalSessionCard
                card={card}
                config={config}
                hideRegistrationLinks={config.features.hideRegistrationLinks}
                expanded={isExpanded}
                onExpandedChange={(nextExpanded) =>
                  setExpandedSessionId(nextExpanded ? card.sessionId : null)
                }
              />
            </div>
          );
        })}
      </div>
    </div>
  );
}
