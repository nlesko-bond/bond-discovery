'use client';

import { BOND_ENV_OPTIONS, DEFAULT_BOND_ENV, type BondEnv } from '@/lib/bond-env';
import type { IPageEditorSectionProps } from '../page-config-types';

export function PageEditorAdvancedSection({ config, setConfig }: IPageEditorSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Advanced</h2>
        <p className="mt-1 text-sm text-gray-600">
          API credentials, cache behavior, and deep-link URL examples.
        </p>
      </div>

      <div>
        <h3 className="mb-4 font-semibold text-gray-900">API configuration</h3>
        <div className="grid grid-cols-1 gap-6">
          <div>
            <label className="label">Bond Sports API key</label>
            <input
              type="password"
              className="input font-mono"
              placeholder="Enter API key for this organization"
              value={config.apiKey || ''}
              onChange={(event) =>
                setConfig({ ...config, apiKey: event.target.value || undefined })
              }
            />
            <p className="mt-1 text-xs text-gray-500">
              Each partner can have their own API key. Leave empty to use the global default.
            </p>
          </div>

          <div>
            <label className="label">Bond env</label>
            <select
              className="input"
              value={config.features.bondEnv || DEFAULT_BOND_ENV}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: { ...config.features, bondEnv: event.target.value as BondEnv },
                })
              }
            >
              {BOND_ENV_OPTIONS.map((option) => (
                <option key={option.id} value={option.id}>
                  {option.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 font-semibold text-gray-900">Cache &amp; performance</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
          <div>
            <label className="label">Cache TTL (seconds)</label>
            <input
              type="number"
              className="input"
              value={config.cacheTtl || 300}
              onChange={(event) =>
                setConfig({ ...config, cacheTtl: parseInt(event.target.value, 10) || 300 })
              }
            />
          </div>

          <div>
            <label className="label">Availability cache TTL (seconds)</label>
            <input
              type="number"
              min={15}
              className="input"
              value={config.features.availabilityCacheTtl || 60}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    availabilityCacheTtl: parseInt(event.target.value, 10) || 60,
                  },
                })
              }
            />
          </div>

          <div>
            <label className="label">Cache warm policy</label>
            <select
              className="input"
              value={config.features.discoveryRefreshPolicy || '15min'}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    discoveryRefreshPolicy: event.target.value as
                      | '5min'
                      | '15min'
                      | '30min'
                      | '60min',
                  },
                })
              }
            >
              <option value="5min">Every 5 minutes</option>
              <option value="15min">Every 15 minutes</option>
              <option value="30min">Every 30 minutes</option>
              <option value="60min">Every 60 minutes</option>
            </select>
          </div>

          <div>
            <label className="label">Event horizon (months)</label>
            <input
              type="number"
              min={1}
              max={24}
              className="input"
              value={config.features.eventHorizonMonths ?? 3}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    eventHorizonMonths: parseInt(event.target.value, 10) || 3,
                  },
                })
              }
            />
          </div>

          <div className="md:col-span-2">
            <label className="flex items-center gap-3">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={config.features.discoveryCacheEnabled !== false}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    features: { ...config.features, discoveryCacheEnabled: event.target.checked },
                  })
                }
              />
              <div>
                <span className="font-medium">Enable cache-first schedule</span>
                <p className="text-xs text-gray-500">
                  Uses warmed cache for fast loads with fresh availability overlay
                </p>
              </div>
            </label>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 font-semibold text-gray-900">Default URL parameters</h3>
        <p className="mb-4 text-sm text-gray-600">
          Pre-apply filters when users visit this page via query string.
        </p>
        <div className="rounded-lg bg-gray-50 p-4">
          <p className="mb-2 text-sm text-gray-600">Example URLs:</p>
          <code className="mb-1 block text-sm text-gray-800">/{config.slug}?facilityIds=123</code>
          <code className="mb-1 block text-sm text-gray-800">/{config.slug}?viewMode=schedule</code>
          <code className="block text-sm text-gray-800">/{config.slug}?programTypes=camp_clinic</code>
        </div>
      </div>
    </div>
  );
}
