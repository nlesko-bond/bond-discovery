'use client';

import type { RosterPageAccess } from '@/types/rosters';
import type { IRosterAccessSectionProps } from '../roster-editor-types';

const ACCESS: Array<{ value: RosterPageAccess; label: string; hint: string }> = [
  { value: 'public', label: 'Anyone with the link', hint: 'No password to open the page.' },
  {
    value: 'password',
    label: 'Anyone with the viewer password',
    hint: 'The page will not open without it.',
  },
  {
    value: 'staff',
    label: 'Staff only',
    hint: 'Only the staff password opens the page at all.',
  },
];

export function RosterAccessSection({
  config,
  patch,
  viewerPassword,
  setViewerPassword,
  staffPassword,
  setStaffPassword,
}: IRosterAccessSectionProps) {
  const gatedWithoutPassword =
    (config.pageAccess === 'password' && !config.hasViewerPassword && !viewerPassword) ||
    (config.pageAccess === 'staff' && !config.hasStaffPassword && !staffPassword);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 font-medium text-gray-900">Who can open the page</h2>
        <div className="space-y-2">
          {ACCESS.map((option) => (
            <label key={option.value} className="flex items-start gap-3 text-sm">
              <input
                type="radio"
                name="pageAccess"
                className="mt-1"
                checked={config.pageAccess === option.value}
                onChange={() => patch({ pageAccess: option.value })}
              />
              <span>
                <span className="font-medium">{option.label}</span>
                <span className="mt-0.5 block text-xs text-gray-500">{option.hint}</span>
              </span>
            </label>
          ))}
        </div>

        {gatedWithoutPassword && (
          <p className="mt-3 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            This page is gated but has no password for that mode, so nobody can open it. Set one
            below.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-1 font-medium text-gray-900">Passwords</h2>
        <p className="mb-3 text-xs text-gray-500">
          Stored hashed. Leave blank to keep the current one; the staff password additionally
          unlocks contact details, ages and waiver status.
        </p>

        <label className="label" htmlFor="viewerPassword">
          Viewer password{' '}
          {config.hasViewerPassword && <span className="text-gray-400">(set)</span>}
        </label>
        <input
          id="viewerPassword"
          type="password"
          autoComplete="new-password"
          className="input mb-3"
          value={viewerPassword}
          onChange={(e) => setViewerPassword(e.target.value)}
        />

        <label className="label" htmlFor="staffPassword">
          Staff password {config.hasStaffPassword && <span className="text-gray-400">(set)</span>}
        </label>
        <input
          id="staffPassword"
          type="password"
          autoComplete="new-password"
          className="input"
          value={staffPassword}
          onChange={(e) => setStaffPassword(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-500">
          A staff session lasts 12 hours; a viewer session 7 days. Shorter for staff because it is
          the one that exposes participant details on shared machines.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-medium text-gray-900">Printing &amp; export</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.allowPrint}
            onChange={(e) => patch({ allowPrint: e.target.checked })}
          />
          Allow printing and CSV export
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Export is refused server-side when this is off. The browser&rsquo;s own print command
          cannot be blocked.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-medium text-gray-900">Search engines</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.allowIndexing}
            onChange={(e) => patch({ allowIndexing: e.target.checked })}
          />
          Allow this page to be indexed
        </label>
        <p className="mt-1 text-xs text-gray-500">
          Off by default. Once a page carrying names has been indexed, getting it back out of search
          results is slow and unreliable.
        </p>
      </section>
    </div>
  );
}
