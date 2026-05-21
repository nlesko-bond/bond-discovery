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
    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-1 max-w-4xl mx-auto py-4">
      {cards.map((card) => (
        <HostPortalSessionCard
          key={card.sessionId}
          card={card}
          config={config}
          hideRegistrationLinks={config.features.hideRegistrationLinks}
        />
      ))}
    </div>
  );
}
