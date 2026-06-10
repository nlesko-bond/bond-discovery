'use client';

import { Eye, EyeOff } from 'lucide-react';
import type { IPageEditorPageSectionProps } from '../page-config-types';

export function PageEditorPageSection({
  config,
  setConfig,
  organizationIdsInput,
  setOrganizationIdsInput,
  facilityIdsInput,
  setFacilityIdsInput,
  allowedOriginsInput,
  setAllowedOriginsInput,
}: IPageEditorPageSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Page</h2>
        <p className="mt-1 text-sm text-gray-600">
          Identity, data scope, credentials, and publish status for this page.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="label">Page Name</label>
          <input
            type="text"
            className="input"
            value={config.name}
            onChange={(event) => setConfig({ ...config, name: event.target.value })}
          />
          <p className="mt-1 text-xs text-gray-500">Internal name shown in the admin list.</p>
        </div>

        <div>
          <label className="label">URL Slug</label>
          <input
            type="text"
            className="input"
            value={config.slug}
            onChange={(event) =>
              setConfig({
                ...config,
                slug: event.target.value.toLowerCase().replace(/[^a-z0-9-]/g, '-'),
              })
            }
            placeholder="page-url-slug"
          />
          <p className="mt-1 text-xs text-gray-500">Page URL: /{config.slug}</p>
        </div>

        <div>
          <label className="label">Organization IDs</label>
          <input
            type="text"
            className="input"
            value={organizationIdsInput}
            onChange={(event) => setOrganizationIdsInput(event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">
            Comma-separated Bond organization IDs whose programs appear here.
          </p>
        </div>

        <div>
          <label className="label">Facility IDs (optional)</label>
          <input
            type="text"
            className="input"
            placeholder="Leave empty for all facilities"
            value={facilityIdsInput}
            onChange={(event) => setFacilityIdsInput(event.target.value)}
          />
          <p className="mt-1 text-xs text-gray-500">Restrict to specific facilities.</p>
        </div>

        <div>
          <label className="label">Bond Sports API key</label>
          <input
            type="password"
            className="input font-mono"
            placeholder="Leave empty to use the global default"
            value={config.apiKey || ''}
            onChange={(event) => setConfig({ ...config, apiKey: event.target.value || undefined })}
          />
          <p className="mt-1 text-xs text-gray-500">
            Each partner can have their own API key. Default: the global key.
          </p>
        </div>

        <div>
          <label className="label">Page Status</label>
          <button
            type="button"
            onClick={() => setConfig({ ...config, isActive: !config.isActive })}
            className={`flex items-center gap-2 rounded-lg px-4 py-2 font-medium ${
              config.isActive !== false
                ? 'bg-green-100 text-green-700 hover:bg-green-200'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {config.isActive !== false ? (
              <>
                <Eye size={16} />
                Active (Public)
              </>
            ) : (
              <>
                <EyeOff size={16} />
                Draft (Hidden)
              </>
            )}
          </button>
          <p className="mt-1 text-xs text-gray-500">
            Draft pages return 404 to visitors and are skipped by the cache warmer.
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <label className="label">Allowed website origins (CORS)</label>
        <textarea
          className="input min-h-24 font-mono text-sm"
          value={allowedOriginsInput}
          onChange={(event) => setAllowedOriginsInput(event.target.value)}
          placeholder="https://www.example.webflow.io&#10;https://example.com"
        />
        <p className="mt-1 text-xs text-gray-500">
          Controls which partner sites may call the discovery APIs (cross-origin browser access to
          /api/events for host-kit integrations). Exact Origin values (scheme plus host, no path),
          one per line or comma-separated. Default: empty — any origin allowed.
        </p>
      </div>
    </div>
  );
}
