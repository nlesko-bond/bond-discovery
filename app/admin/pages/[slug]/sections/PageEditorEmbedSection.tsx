'use client';

import type { BondEmbedPortalTemplate } from '@/types';
import type { IPageEditorEmbedSectionProps } from '../page-config-types';
import { SurfaceBadge } from '../components/SurfaceBadge';

export function PageEditorEmbedSection({
  config,
  setConfig,
  embedAllowedOriginsInput,
  setEmbedAllowedOriginsInput,
}: IPageEditorEmbedSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Embed (Bond iframe)</h2>
        <p className="mt-1 text-sm text-gray-600">
          Settings for Bond-hosted discovery URLs and the script embed kit.
        </p>
        <div className="mt-3">
          <SurfaceBadge surfaces={['Embed', 'Public']} />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Header display</label>
          <select
            className="input"
            value={config.features.headerDisplay || 'full'}
            onChange={(event) =>
              setConfig({
                ...config,
                features: {
                  ...config.features,
                  headerDisplay: event.target.value as 'full' | 'minimal' | 'hidden',
                },
              })
            }
          >
            <option value="full">Full — logo, tagline, tabs, share button (sticky)</option>
            <option value="minimal">Minimal — tabs and share button only (not sticky)</option>
            <option value="hidden">Hidden — no header (tabs move to filter bar)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Use Minimal or Hidden when embedding on a site that already has its own header.
          </p>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={config.features.disableStickyHeader || false}
            onChange={(event) =>
              setConfig({
                ...config,
                features: { ...config.features, disableStickyHeader: event.target.checked },
              })
            }
          />
          <div>
            <span>Disable sticky main header</span>
            <p className="text-xs text-gray-500">
              Calendar navigation headers will still stick for better UX
            </p>
          </div>
        </label>

        <div>
          <label className="label">Embed portal layout</label>
          <select
            className="input"
            value={config.features.embedPortalTemplate || 'classic'}
            onChange={(event) =>
              setConfig({
                ...config,
                features: {
                  ...config.features,
                  embedPortalTemplate: event.target.value as BondEmbedPortalTemplate,
                },
              })
            }
          >
            <option value="classic">Classic grid</option>
            <option value="hero-carousel">Hero carousel</option>
            <option value="schedule-first">Schedule first</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Default layout for the script embed (data-bond-discovery).
          </p>
        </div>

        <div>
          <label className="label">Embed allowed origins (CORS)</label>
          <textarea
            className="input min-h-24 font-mono text-sm"
            value={embedAllowedOriginsInput}
            onChange={(event) => setEmbedAllowedOriginsInput(event.target.value)}
            placeholder="https://www.example.webflow.io&#10;https://example.com"
          />
          <p className="mt-1 text-xs text-gray-500">
            Exact Origin values (scheme plus host, no path), one per line or comma-separated. Leave
            empty to allow any origin.
          </p>
        </div>
      </div>
    </div>
  );
}
