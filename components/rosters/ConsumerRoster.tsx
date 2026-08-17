'use client';

import type { RosterParticipant } from '@/types/rosters';

/**
 * The consumer roster: a game-day lineup, not a data grid.
 *
 * Rec-league data is sparse — many teams have no jersey numbers and no
 * positions — so the layout adapts to what the roster actually holds instead
 * of rendering columns of em-dashes. A number column only exists when someone
 * has a number; a position line only when someone has a position; and the
 * default role "Player" is noise, so only Captain and Invited render at all.
 */

interface Props {
  participants: RosterParticipant[];
}

export function ConsumerRoster({ participants }: Props) {
  if (participants.length === 0) {
    return (
      <p className="rounded-xl border border-dashed border-gray-300 px-4 py-10 text-center text-sm text-gray-500">
        No players on this roster yet.
      </p>
    );
  }

  const hasNumbers = participants.some((p) => p.jerseyNumber);
  const hasPhotos = participants.some((p) => p.photoUrl);

  return (
    <ol className="rp-lineup" data-has-numbers={hasNumbers || undefined}>
      {participants.map((p) => {
        const isCaptain = p.teamRole === 'Captain';
        const isInvited = p.teamRole?.toLowerCase().includes('invited') ?? false;

        return (
          <li key={p.id} className="rp-lineup-row">
            {hasNumbers && (
              <span className="rp-jersey" aria-label={p.jerseyNumber ? `Number ${p.jerseyNumber}` : undefined}>
                {p.jerseyNumber ?? ''}
              </span>
            )}

            {hasPhotos &&
              (p.photoUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={p.photoUrl} alt="" className="rp-headshot" />
              ) : (
                <span className="rp-headshot rp-headshot--empty" aria-hidden="true" />
              ))}

            <span className="min-w-0 flex-1">
              <span className="rp-player notranslate">{p.displayName}</span>
              {p.position && <span className="rp-position">{p.position}</span>}
            </span>

            {isCaptain && (
              <span className="rp-captain" title="Captain">
                <span aria-hidden="true">C</span>
                <span className="sr-only">Captain</span>
              </span>
            )}
            {isInvited && <span className="rp-invited">Invited</span>}
          </li>
        );
      })}
    </ol>
  );
}
