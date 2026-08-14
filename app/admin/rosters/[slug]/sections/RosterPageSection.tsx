'use client';

import { AlertTriangle } from 'lucide-react';
import type { IRosterPageSectionProps } from '../roster-editor-types';

export function RosterPageSection({
  config,
  patch,
  partnerGroups,
  organizationIdsInput,
  setOrganizationIdsInput,
  slugInput,
  setSlugInput,
}: IRosterPageSectionProps) {
  const group = partnerGroups.find((g) => g.id === config.partnerGroupId);

  return (
    <div className="space-y-6">
      <section>
        <h2 className="mb-3 font-medium text-gray-900">Identity</h2>

        <label className="label" htmlFor="name">
          Name
        </label>
        <input
          id="name"
          className="input mb-3"
          value={config.name}
          onChange={(e) => patch({ name: e.target.value })}
        />

        <label className="label" htmlFor="slug">
          Slug
        </label>
        <input
          id="slug"
          className="input"
          value={slugInput}
          onChange={(e) => setSlugInput(e.target.value)}
        />
        <p className="mt-1 text-xs text-gray-500">
          The page lives at <code>/rosters/{slugInput || config.slug}</code>. Renaming it breaks any
          link already shared, including ones on a customer&rsquo;s own site.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-medium text-gray-900">Customer &amp; Bond access</h2>

        <label className="label" htmlFor="partnerGroup">
          Customer
        </label>
        <select
          id="partnerGroup"
          className="input"
          value={config.partnerGroupId ?? ''}
          onChange={(e) => patch({ partnerGroupId: e.target.value || undefined })}
        >
          <option value="">— none —</option>
          {partnerGroups.map((option) => (
            <option key={option.id} value={option.id}>
              {option.name}
              {option.hasApiKey ? '' : ' (no API key)'}
            </option>
          ))}
        </select>
        <p className="mt-1 text-xs text-gray-500">
          {config.apiKeyInherited
            ? `Using ${config.partnerGroupName}'s Bond API key — rotating it there updates every page under them.`
            : 'The page uses this customer’s Bond API key unless overridden below.'}
        </p>

        <details className="mt-3">
          <summary className="cursor-pointer text-sm text-gray-600">
            Override the API key for this page
          </summary>
          <input
            className="input mt-2"
            value={config.apiKeyInherited ? '' : (config.apiKey ?? '')}
            onChange={(e) => patch({ apiKey: e.target.value || undefined })}
            placeholder={config.apiKeyInherited ? 'Inherited — leave blank to keep it' : ''}
          />
          <p className="mt-1 text-xs text-gray-500">
            Only when this page must use a different key from the rest of the customer&rsquo;s.
          </p>
        </details>

        {!config.apiKey && (
          <p className="mt-3 flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-xs text-amber-800">
            <AlertTriangle size={14} className="mt-0.5 shrink-0" aria-hidden />
            No Bond API key resolves for this page, so it cannot load data. Pick a customer that has
            one, or set an override.
          </p>
        )}
        {group && !group.hasApiKey && config.apiKeyInherited === false && !config.apiKey && (
          <p className="mt-2 text-xs text-gray-500">{group.name} has no key set on the group.</p>
        )}
      </section>

      <section>
        <h2 className="mb-3 font-medium text-gray-900">Organizations</h2>

        <label className="label" htmlFor="orgs">
          Bond organization IDs
        </label>
        <input
          id="orgs"
          className="input"
          value={organizationIdsInput}
          onChange={(e) => setOrganizationIdsInput(e.target.value)}
          placeholder="277, 516"
        />
        <p className="mt-1 text-xs text-gray-500">
          Comma separated. Sessions are discovered across every organization listed, and each one is
          fetched under the org it belongs to.
        </p>
      </section>

      <section>
        <h2 className="mb-3 font-medium text-gray-900">Status</h2>
        <label className="flex items-center gap-2 text-sm">
          <input
            type="checkbox"
            checked={config.isActive}
            onChange={(e) => patch({ isActive: e.target.checked })}
          />
          Published — live at /rosters/{config.slug}
        </label>
        <p className="mt-1 text-xs text-gray-500">
          An unpublished page returns 404, indistinguishable from one that does not exist. Publishing
          is refused while no API key resolves.
        </p>
      </section>
    </div>
  );
}
