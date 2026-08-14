'use client';

import { AlertTriangle, Check } from 'lucide-react';
import type { RosterParticipant, RosterViewerMode } from '@/types/rosters';

/** Missing values render as an em-dash, never blank, so a gap is legible. */
const EMPTY = '—';

interface Props {
  participants: RosterParticipant[];
  mode: RosterViewerMode;
}

function initials(name: string): string {
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part.charAt(0).toUpperCase())
    .join('');
}

function WaiverCell({ participant }: { participant: RosterParticipant }) {
  if (participant.waiverSigned === undefined) {
    return <span className="text-gray-400">{EMPTY}</span>;
  }
  if (participant.waiverSigned) {
    return (
      <span className="inline-flex items-center gap-1 text-emerald-700">
        <Check size={14} aria-hidden />
        <span>{participant.waiverSignedDate || 'Signed'}</span>
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 font-medium text-amber-700">
      <AlertTriangle size={14} aria-hidden />
      Unsigned
    </span>
  );
}

export function RosterTable({ participants, mode }: Props) {
  const rows = participants;

  if (rows.length === 0) {
    return (
      <p className="rounded-lg border border-dashed border-gray-300 px-4 py-8 text-center text-sm text-gray-500">
        No participants on this roster yet.
      </p>
    );
  }

  const isStaff = mode === 'staff';
  const showPhotos = rows.some((p) => p.photoUrl);
  const guardianContact = rows.some((p) => p.contactIsGuardian);

  return (
    <>
      {/* Desktop and print: full table. Staff mode is wide, so it scrolls. */}
      {/*
        `print:block` is load-bearing, not decoration. Letter portrait minus
        0.5in margins is 720px, below Tailwind's 768px `md` breakpoint, so
        `md:block` does not match when printing and the table would stay
        display:none -- a blank page.
      */}
      <div
        className={`roster-print-table-wrap hidden md:block print:block ${isStaff ? 'overflow-x-auto' : ''}`}
      >
        <table className="roster-print-table w-full border-collapse text-sm">
          <caption className="sr-only">
            {isStaff ? 'Staff roster with contact and waiver detail' : 'Team roster'}
          </caption>
          <thead>
            <tr className="border-b border-gray-300 text-left">
              <th scope="col" className="w-12 px-3 py-2 font-semibold">
                #
              </th>
              {showPhotos && <th scope="col" className="w-12 px-3 py-2" aria-label="Photo" />}
              <th scope="col" className="px-3 py-2 font-semibold">
                Player
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Position
              </th>
              <th scope="col" className="px-3 py-2 font-semibold">
                Role
              </th>
              {isStaff && (
                <>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {guardianContact ? 'Guardian email' : 'Email'}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    {guardianContact ? 'Guardian phone' : 'Phone'}
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Age
                  </th>
                  <th scope="col" className="px-3 py-2 font-semibold">
                    Waiver
                  </th>
                </>
              )}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.id} className="border-b border-gray-100">
                <td className="px-3 py-2 tabular-nums">{p.jerseyNumber || EMPTY}</td>
                {showPhotos && (
                  <td className="px-3 py-2">
                    {p.photoUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={p.photoUrl}
                        alt=""
                        className="h-8 w-8 rounded-full object-cover object-top"
                      />
                    ) : (
                      <span aria-hidden="true" className="flex h-8 w-8 items-center justify-center rounded-full bg-gray-100 text-[10px] font-medium text-gray-500">
                        {initials(p.displayName)}
                      </span>
                    )}
                  </td>
                )}
                {/* notranslate: team and player names should not be machine-translated. */}
                <th scope="row" className="notranslate px-3 py-2 text-left font-medium text-gray-900">
                  {p.displayName}
                </th>
                <td className="px-3 py-2 text-gray-600">{p.position || EMPTY}</td>
                <td className="px-3 py-2 text-gray-600">{p.teamRole || EMPTY}</td>
                {isStaff && (
                  <>
                    <td className="px-3 py-2 text-gray-600">{p.email || EMPTY}</td>
                    <td className="px-3 py-2 text-gray-600">{p.phone || EMPTY}</td>
                    <td className="px-3 py-2 tabular-nums text-gray-600">{p.age ?? EMPTY}</td>
                    <td className="px-3 py-2">
                      <WaiverCell participant={p} />
                    </td>
                  </>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/*
        Mobile: a fixed number gutter with name over position. Not generic card
        stacking, which repeats "Position:" on every row and wastes the screen,
        and not horizontal scroll, which a four-column roster never needs.
      */}
      <ul className="roster-no-print divide-y divide-gray-100 md:hidden">
        {rows.map((p) => (
          <li key={p.id} className="flex gap-3 py-3">
            <span className="w-8 shrink-0 pt-0.5 text-right text-sm font-semibold tabular-nums text-gray-500">
              {p.jerseyNumber || EMPTY}
            </span>
            <div className="min-w-0 flex-1">
              <p className="notranslate truncate text-sm font-medium text-gray-900">
                {p.displayName}
              </p>
              <p className="truncate text-xs text-gray-500">
                {[p.position, p.teamRole].filter(Boolean).join(' · ') || EMPTY}
              </p>
              {isStaff && (
                <p className="mt-1 truncate text-xs text-gray-500">
                  {[p.email, p.phone].filter(Boolean).join(' · ')}
                  {p.waiverSigned === false && (
                    <span className="ml-2 font-medium text-amber-700">Waiver unsigned</span>
                  )}
                </p>
              )}
            </div>
          </li>
        ))}
      </ul>

      {isStaff && guardianContact && (
        <p className="mt-3 text-xs text-gray-500">
          Contact details shown are the guardian&rsquo;s, not the participant&rsquo;s.
        </p>
      )}
    </>
  );
}
