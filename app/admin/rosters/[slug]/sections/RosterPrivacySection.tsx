'use client';

import { AlertTriangle } from 'lucide-react';
import {
  ROSTER_NAME_MODE_LABELS,
  ROSTER_NAME_MODES,
  type RosterFieldVisibility,
  type RosterNameMode,
} from '@/types/rosters';
import type { IRosterEditorSectionProps } from '../roster-editor-types';

const PUBLIC_FIELDS: Array<[keyof RosterFieldVisibility, string, string]> = [
  ['showPhoto', 'Participant photos', 'Suppressed automatically when names are hidden'],
  ['showJerseyNumber', 'Jersey numbers', ''],
  ['showPosition', 'Positions', ''],
  ['showTeamRole', 'Team roles', 'Player, captain, coach'],
];

const STAFF_FIELDS: Array<[keyof RosterFieldVisibility, string, string]> = [
  ['staffShowContact', 'Contact details', ''],
  ['staffShowBirthDate', 'Date of birth and age', ''],
  ['staffShowGender', 'Gender', ''],
  ['staffShowWaiver', 'Waiver status', ''],
  ['staffShowRegistration', 'Registration date and products', ''],
  ['staffShowGuardian', 'Guardian name', ''],
];

export function RosterPrivacySection({ config, patch }: IRosterEditorSectionProps) {
  const fv = config.fieldVisibility;
  const namesArePublic = config.pageAccess === 'public' && fv.nameMode !== 'numberOnly';

  function setField(key: keyof RosterFieldVisibility, value: boolean) {
    patch({ fieldVisibility: { ...fv, [key]: value } });
  }

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-1 font-medium text-gray-900">Audience</h2>
        <p className="mb-3 text-xs text-gray-500">
          These decide what leaves the server. A hidden field is never sent to the browser, not
          merely hidden in the page.
        </p>

        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.isYouth}
            onChange={(e) => patch({ isYouth: e.target.checked })}
          />
          This page covers participants under 18
        </label>
        {config.isYouth && (
          <p className="mt-2 text-xs text-gray-500">
            Contact columns will show the guardian&rsquo;s details rather than the
            participant&rsquo;s, enforced regardless of the setting below.
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium text-gray-900">Names</h2>
        <label className="label" htmlFor="nameMode">
          How names appear
        </label>
        <select
          id="nameMode"
          className="input"
          value={fv.nameMode}
          onChange={(e) => patch({ fieldVisibility: { ...fv, nameMode: e.target.value as RosterNameMode } })}
        >
          {ROSTER_NAME_MODES.map((mode) => (
            <option key={mode} value={mode}>
              {ROSTER_NAME_MODE_LABELS[mode]}
            </option>
          ))}
        </select>

        {namesArePublic && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            <span>
              This page shows participant names to anyone with the link.
              {config.isYouth && (
                <>
                  {' '}
                  For under-18 participants that normally requires written consent from a parent or
                  guardian.
                </>
              )}{' '}
              No comparable platform publishes full names by default.
            </span>
          </p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium text-gray-900">Shown to everyone</h2>
        <div className="space-y-1.5 text-sm">
          {PUBLIC_FIELDS.map(([key, label, hint]) => (
            <label key={key} className="flex items-start gap-2">
              <input
                type="checkbox"
                className="mt-1"
                checked={Boolean(fv[key])}
                onChange={(e) => setField(key, e.target.checked)}
              />
              <span>
                {label}
                {hint && <span className="mt-0.5 block text-xs text-gray-500">{hint}</span>}
              </span>
            </label>
          ))}
        </div>
      </section>

      <section>
        <h2 className="mb-1 font-medium text-gray-900">Shown only in staff view</h2>
        <p className="mb-3 text-xs text-gray-500">
          Requires the staff password. Never sent to a public viewer.
        </p>
        <div className="space-y-1.5 text-sm">
          {STAFF_FIELDS.map(([key, label]) => (
            <label key={key} className="flex items-center gap-2">
              <input
                type="checkbox"
                checked={Boolean(fv[key])}
                onChange={(e) => setField(key, e.target.checked)}
              />
              {label}
            </label>
          ))}
        </div>

        {config.isYouth ? (
          <p className="mt-3 text-xs text-gray-500">
            Contact details show the guardian&rsquo;s — enforced for youth pages.
          </p>
        ) : (
          <label className="mt-3 flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={fv.contactSource === 'primary'}
              onChange={(e) =>
                patch({
                  fieldVisibility: {
                    ...fv,
                    contactSource: e.target.checked ? 'primary' : 'participant',
                  },
                })
              }
            />
            Show the guardian&rsquo;s contact details rather than the participant&rsquo;s
          </label>
        )}
      </section>
    </div>
  );
}
