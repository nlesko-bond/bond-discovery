'use client';

import { PortalSessionLayoutEnum } from '@/types';
import { PortalSessionsBrandingControls } from '../components/PortalSessionsBrandingControls';
import { SurfaceBadge } from '../components/SurfaceBadge';
import type { IPageEditorHostPortalSectionProps } from '../page-config-types';

export function PageEditorHostPortalSection({
  config,
  setConfig,
  onNavigateToSection,
}: IPageEditorHostPortalSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Host portal</h2>
        <p className="mt-1 text-sm text-gray-600">
          Partner website integration via bond-host and the /portal discovery shell.
        </p>
        <div className="mt-3">
          <SurfaceBadge surfaces={['Host', 'Portal']} />
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="label">Partner site URL</label>
          <input
            type="url"
            className="input"
            value={config.features.partnerPublicOrigin || ''}
            onChange={(event) =>
              setConfig({
                ...config,
                features: {
                  ...config.features,
                  partnerPublicOrigin: event.target.value.trim() || undefined,
                },
              })
            }
            placeholder="https://www.your-org.webflow.io"
          />
          <p className="mt-1 text-xs text-gray-500">
            The org&apos;s public website origin (no path). Registration opens on this domain via
            bond-host.
          </p>
        </div>

        <div>
          <label className="label">Bond checkout domain</label>
          <input
            type="url"
            className="input"
            value={config.features.consumerOrigin || ''}
            onChange={(event) =>
              setConfig({
                ...config,
                features: {
                  ...config.features,
                  consumerOrigin: event.target.value.trim() || undefined,
                },
              })
            }
            placeholder="https://bondsports.co"
          />
          <p className="mt-1 text-xs text-gray-500">
            Where registration/checkout loads inside the iframe (usually bondsports.co).
          </p>
        </div>

        <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
          <div>
            <label className="label">Programs page path (org site)</label>
            <input
              type="text"
              className="input"
              value={config.features.linkSeoPathPrefix || '/programs'}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    linkSeoPathPrefix: event.target.value.trim() || undefined,
                  },
                })
              }
              placeholder="/programs"
            />
          </div>
          <div>
            <label className="label">Checkout page path (org site)</label>
            <input
              type="text"
              className="input"
              value={config.features.checkoutLandingPath || '/programs/register'}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    checkoutLandingPath: event.target.value.trim() || undefined,
                  },
                })
              }
              placeholder="/programs/register"
            />
          </div>
        </div>

        <div>
          <label className="label">Portal discovery layout</label>
          <select
            className="input"
            value={config.features.hostPortalLayout || 'legacy_programs'}
            onChange={(event) =>
              setConfig({
                ...config,
                features: {
                  ...config.features,
                  hostPortalLayout: event.target.value as
                    | 'legacy_programs'
                    | 'sessions_first'
                    | 'sessions_list',
                },
              })
            }
          >
            <option value="legacy_programs">Legacy (program cards)</option>
            <option value="sessions_first">Sessions first (grid cards)</option>
            <option value="sessions_list">Sessions list (hero + rows)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            Applies only to <code className="rounded bg-gray-100 px-1 text-xs">/portal/&#123;slug&#125;</code>.
            Public /&#123;slug&#125; and embed are unchanged.
          </p>
        </div>

        {(config.features.hostPortalLayout === 'sessions_list' ||
          config.features.hostPortalLayout === 'sessions_first') && (
          <div className="space-y-4 rounded-lg border border-gray-200 p-4">
            <h3 className="text-sm font-semibold text-gray-900">Session list vs grid</h3>
            <p className="text-xs text-gray-500">
              Default presentation on the portal sessions shell. When the visitor toggle is enabled,
              list/grid icons appear in the filter bar.
            </p>
            <div>
              <label className="label">Default session view</label>
              <select
                className="input"
                value={
                  config.features.portalSessionLayoutDefault ||
                  (config.features.hostPortalLayout === 'sessions_first' ? 'grid' : 'list')
                }
                onChange={(event) =>
                  setConfig({
                    ...config,
                    features: {
                      ...config.features,
                      portalSessionLayoutDefault: event.target.value as 'list' | 'grid',
                    },
                  })
                }
              >
                <option value={PortalSessionLayoutEnum.LIST}>List rows (hero-friendly)</option>
                <option value={PortalSessionLayoutEnum.GRID}>Grid cards</option>
              </select>
            </div>
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300"
                checked={config.features.allowPortalSessionLayoutToggle === true}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    features: {
                      ...config.features,
                      allowPortalSessionLayoutToggle: event.target.checked,
                    },
                  })
                }
              />
              <span>
                <span className="font-medium text-gray-900">Allow visitors to switch list / grid</span>
                <span className="mt-1 block text-xs text-gray-500">
                  Hero banner appears only in list view.
                </span>
              </span>
            </label>
          </div>
        )}

        <PortalSessionsBrandingControls
          config={config}
          setConfig={setConfig}
          onNavigateToSection={onNavigateToSection}
        />
      </div>
    </div>
  );
}
