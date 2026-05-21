'use client';

import type { DiscoveryConfig } from '@/types';
import type { IHostPortalSessionCardModel } from '@/lib/host-shell/session-card-model';
import { HostPortalSessionCard } from './HostPortalSessionCard';

interface IHostPortalSessionListProps {
  cards: IHostPortalSessionCardModel[];
  config: DiscoveryConfig;
}

export function HostPortalSessionList({ cards, config }: IHostPortalSessionListProps) {
  if (cards.length === 0) {
    return (
      <div className="py-16 text-center text-gray-500 text-sm">
        No sessions match your filters.
      </div>
    );
  }

  return (
    <div className="py-4 md:py-6">
      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4 md:gap-6">
        {cards.map((card) => (
          <HostPortalSessionCard
            key={card.sessionId}
            card={card}
            config={config}
            hideRegistrationLinks={config.features.hideRegistrationLinks}
          />
        ))}
      </div>
    </div>
  );
}
