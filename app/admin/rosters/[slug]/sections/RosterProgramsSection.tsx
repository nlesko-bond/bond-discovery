'use client';

import type { IRosterProgramsSectionProps } from '../roster-editor-types';

const MODES = [
  {
    value: 'all' as const,
    label: 'All leagues',
    hint: 'Every program in the listed organizations.',
  },
  {
    value: 'include' as const,
    label: 'Only these leagues',
    hint: 'Nothing else appears, even when new programs are created.',
  },
  {
    value: 'exclude' as const,
    label: 'All except these leagues',
    hint: 'New programs appear automatically; the listed ones never do.',
  },
];

export function RosterProgramsSection({
  config,
  patch,
  programIdsInput,
  setProgramIdsInput,
  pinnedInput,
  setPinnedInput,
}: IRosterProgramsSectionProps) {
  const usingPins = config.pinnedSessions.length > 0;

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 font-medium text-gray-900">Which leagues</h2>
        <p className="mb-3 text-xs text-gray-500">
          Bounds what this page can ever reach. A viewer can only browse inside it.
        </p>

        <div className="space-y-2">
          {MODES.map((mode) => (
            <label key={mode.value} className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="programFilterMode"
                className="mt-1"
                checked={config.programFilter.mode === mode.value}
                onChange={() =>
                  patch({ programFilter: { ...config.programFilter, mode: mode.value } })
                }
              />
              <span>
                <span className="font-medium">{mode.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{mode.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {config.programFilter.mode !== 'all' && (
          <div className="mt-3">
            <label className="label" htmlFor="programIds">
              Program IDs
            </label>
            <input
              id="programIds"
              className="input"
              value={programIdsInput}
              onChange={(e) => setProgramIdsInput(e.target.value)}
              placeholder="11551, 14752"
            />
            <p className="mt-1 text-xs text-gray-500">
              Comma separated. The program id is the number in a Bond season URL, after
              <code> /activity/programs/&#123;name&#125;/</code>.
            </p>
          </div>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-medium text-gray-900">Which seasons</h2>
        <p className="mb-3 text-xs text-gray-500">
          By default a rolling window, so new seasons appear without anyone editing this page.
        </p>

        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label" htmlFor="past">
              Started within the last (days)
            </label>
            <input
              id="past"
              type="number"
              min={0}
              className="input"
              disabled={usingPins}
              value={config.sessionWindow.pastDays}
              onChange={(e) =>
                patch({
                  sessionWindow: { ...config.sessionWindow, pastDays: Number(e.target.value) },
                })
              }
            />
          </div>
          <div>
            <label className="label" htmlFor="future">
              …or starting within (days)
            </label>
            <input
              id="future"
              type="number"
              min={0}
              className="input"
              disabled={usingPins}
              value={config.sessionWindow.futureDays}
              onChange={(e) =>
                patch({
                  sessionWindow: { ...config.sessionWindow, futureDays: Number(e.target.value) },
                })
              }
            />
          </div>
        </div>
        <p className="mt-1 text-xs text-gray-500">
          A season counts if its own dates overlap the window at all — a run that started before the
          window opened is still in progress, and its roster is still the one people want.
        </p>

        <div className="mt-4">
          <label className="label" htmlFor="pinned">
            Or pin specific seasons
          </label>
          <textarea
            id="pinned"
            className="input font-mono text-xs"
            rows={3}
            value={pinnedInput}
            onChange={(e) => setPinnedInput(e.target.value)}
            placeholder={'14752:120054\n11551:127956'}
          />
          <p className="mt-1 text-xs text-gray-500">
            One <code>programId:sessionId</code> per line. When any are pinned the rolling window is
            ignored entirely and only these seasons appear — you will need to edit this each term.
          </p>
          {usingPins && (
            <p className="mt-2 rounded-lg bg-blue-50 px-3 py-2 text-xs text-blue-800">
              {config.pinnedSessions.length} season
              {config.pinnedSessions.length === 1 ? '' : 's'} pinned, so the date window above is
              inactive. Clear the box to go back to a rolling window.
            </p>
          )}
        </div>
      </section>
    </div>
  );
}
