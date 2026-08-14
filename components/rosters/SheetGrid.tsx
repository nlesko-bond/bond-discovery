'use client';

import type { RosterParticipant } from '@/types/rosters';

export interface SheetColumn {
  key: string;
  short: string;
  weekday: string;
}

interface Props {
  kind: 'checkin' | 'matrix';
  participants: RosterParticipant[];
  columns: SheetColumn[];
  /** matrix only: participant id -> event ids they are registered for. */
  marks?: Record<string, number[]>;
  /** matrix only: event id -> its date column key. */
  eventDateKeys?: Record<number, string>;
  heading: string;
  subheading: string;
  timezone: string;
  truncated?: { requested: number; loaded: number; cap: number };
}

/**
 * Portrait fits roughly 12-17 date columns at a legible width; beyond that the
 * sheet switches to landscape via the `is-wide` class. Defaulting to portrait
 * is deliberate — a typical season is 8-12 sessions, and landscape would make
 * the common case look sparse and waste a sheet.
 */
const PORTRAIT_COLUMN_LIMIT = 14;

/** Blank rows for the substitute who turns up — every real sheet needs them. */
const BLANK_ROWS = 3;

const EMPTY = '—';

export function SheetGrid({
  kind,
  participants,
  columns,
  marks,
  eventDateKeys,
  heading,
  subheading,
  timezone,
  truncated,
}: Props) {
  const isWide = columns.length > PORTRAIT_COLUMN_LIMIT;
  const printedAt = new Date().toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });

  /** Which date columns a participant is registered for (matrix only). */
  function markedKeys(participantId: string): Set<string> {
    if (!marks || !eventDateKeys) return new Set();
    return new Set((marks[participantId] ?? []).map((id) => eventDateKeys[id]).filter(Boolean));
  }

  return (
    <div
      // Both sheets share the check-in print geometry: participants down the
      // left, dates across the top, portrait until the columns stop fitting.
      className={`roster-print-sheet roster-print-mode-checkin ${isWide ? 'is-wide' : ''}`}
    >
      <header className="mb-3">
        <h2 className="text-lg font-semibold text-gray-900">{heading}</h2>
        <p className="text-sm text-gray-600">{subheading}</p>
        <p className="roster-print-meta text-xs text-gray-500">
          Times in {timezone.replace(/_/g, ' ')} · Roster as of {printedAt}
          {kind === 'matrix' && ' · A mark means registered for that date, not attendance'}
        </p>
        {kind === 'checkin' && (
          <p className="mt-1 text-xs text-gray-500">
            Legend: P present · A absent · E excused · L late
          </p>
        )}
      </header>

      {truncated && (
        <p className="mb-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
          Showing the first {truncated.loaded} of {truncated.requested} dates (cap{' '}
          {truncated.cap}). Narrow the session to see the rest.
        </p>
      )}

      {columns.length === 0 ? (
        <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
          This session has no scheduled dates yet, so there are no columns to build a sheet from.
        </p>
      ) : (
        <div className="roster-print-table-wrap overflow-x-auto">
          <table className="roster-print-table w-full border-collapse text-sm">
            <caption className="sr-only">
              {kind === 'checkin'
                ? 'Blank check-in grid: participants by date'
                : 'Participants by date, marked where registered'}
            </caption>
            <thead>
              <tr>
                <th scope="col" className="w-10 px-2 py-2 text-left font-semibold">
                  #
                </th>
                <th scope="col" className="min-w-[10rem] px-2 py-2 text-left font-semibold">
                  Participant
                </th>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    scope="col"
                    className="px-1 py-2 text-center text-xs font-semibold"
                  >
                    <span className="block">{column.short}</span>
                    {/* Day-of-week under the date: without it staff mark the
                        wrong column on a dense grid. */}
                    <span className="block font-normal text-gray-500">{column.weekday}</span>
                  </th>
                ))}
                <th scope="col" className="w-12 px-2 py-2 text-center text-xs font-semibold">
                  Total
                </th>
              </tr>
            </thead>
            <tbody>
              {participants.map((p) => {
                const marked = markedKeys(p.id);
                return (
                  <tr key={p.id}>
                    <td className="px-2 py-1.5 tabular-nums">{p.jerseyNumber || EMPTY}</td>
                    <th scope="row" className="notranslate px-2 py-1.5 text-left font-medium text-gray-900">
                      {p.displayName}
                    </th>
                    {columns.map((column) => (
                      <td key={column.key} className="roster-print-tick px-1 py-1.5 text-center">
                        {kind === 'matrix' && marked.has(column.key) && (
                          <>
                            <span aria-hidden="true">✓</span>
                            <span className="sr-only">Registered</span>
                          </>
                        )}
                      </td>
                    ))}
                    <td className="roster-print-tick px-2 py-1.5 text-center tabular-nums">
                      {kind === 'matrix' ? marked.size : ''}
                    </td>
                  </tr>
                );
              })}

              {kind === 'checkin' &&
                Array.from({ length: BLANK_ROWS }, (_, i) => (
                  <tr key={`blank-${i}`}>
                    <td className="px-2 py-1.5" />
                    <td className="px-2 py-1.5 text-gray-300">________________</td>
                    {columns.map((column) => (
                      <td key={column.key} className="roster-print-tick px-1 py-1.5" />
                    ))}
                    <td className="roster-print-tick px-2 py-1.5" />
                  </tr>
                ))}
            </tbody>
            <tfoot>
              <tr>
                <td className="px-2 py-1.5" />
                <td className="px-2 py-1.5 text-xs font-semibold uppercase text-gray-600">
                  Daily total
                </td>
                {columns.map((column) => (
                  <td key={column.key} className="roster-print-tick px-1 py-1.5" />
                ))}
                <td className="roster-print-tick px-2 py-1.5" />
              </tr>
            </tfoot>
          </table>
        </div>
      )}
    </div>
  );
}
