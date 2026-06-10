'use client';

import type { IPageEditorSectionProps } from '../page-config-types';
import { SurfaceBadge } from '../components/SurfaceBadge';

export function PageEditorRegistrationSection({ config, setConfig }: IPageEditorSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Registration</h2>
        <p className="mt-1 text-sm text-gray-600">
          How register links appear and where checkout opens.
        </p>
        <div className="mt-3">
          <SurfaceBadge surfaces={['Public', 'Embed', 'Portal', 'Host']} />
        </div>
      </div>

      <div className="space-y-4">
        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={config.features.hideRegistrationLinks || false}
            onChange={(event) =>
              setConfig({
                ...config,
                features: { ...config.features, hideRegistrationLinks: event.target.checked },
              })
            }
          />
          <div>
            <span className="font-medium">Hide registration links</span>
            <p className="text-sm text-gray-500">
              Hides Register/Learn More on programs and schedule. Punch pass redeem (when enabled
              below) still shows for eligible events.
            </p>
          </div>
        </label>

        <div>
          <label className="label">Registration link behavior</label>
          <select
            className="input"
            value={config.features.linkBehavior || 'new_tab'}
            onChange={(event) =>
              setConfig({
                ...config,
                features: {
                  ...config.features,
                  linkBehavior: event.target.value as 'new_tab' | 'same_window' | 'in_frame',
                },
              })
            }
          >
            <option value="new_tab">Open in new tab (default)</option>
            <option value="same_window">Replace current page (embeds / same window)</option>
            <option value="in_frame">Stay in frame (iframe embeds)</option>
          </select>
          <p className="mt-1 text-xs text-gray-500">
            On partner host shell embeds, new tab opens checkout on the org domain via bond-host.
          </p>
        </div>

        <label className="flex items-center gap-3">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={config.features.showPunchPassRedeemButton === true}
            onChange={(event) =>
              setConfig({
                ...config,
                features: { ...config.features, showPunchPassRedeemButton: event.target.checked },
              })
            }
          />
          <div>
            <span className="font-medium">Show punch pass redeem button</span>
            <p className="text-sm text-gray-500">
              On the schedule tab, adds a second action when the session has a Bond punch-pass
              product.
            </p>
          </div>
        </label>

        <div>
          <label className="label">Punch pass redeem URL (optional)</label>
          <input
            type="text"
            className="input"
            placeholder="https://bondsports.co/user/passes"
            value={config.features.punchPassRedeemUrl || ''}
            onChange={(event) =>
              setConfig({
                ...config,
                features: {
                  ...config.features,
                  punchPassRedeemUrl: event.target.value.trim() || undefined,
                },
              })
            }
          />
          <p className="mt-1 text-xs text-gray-500">
            Defaults to https://bondsports.co/user/passes
          </p>
        </div>
      </div>
    </div>
  );
}
