'use client';

import Link from 'next/link';
import { ExternalLink } from 'lucide-react';
import type { IPageEditorSectionProps } from '../page-config-types';
import { SurfaceBadge } from '../components/SurfaceBadge';

export function PageEditorRegistrationSection({ config, setConfig }: IPageEditorSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Registration &amp; Analytics</h2>
        <p className="mt-1 text-sm text-gray-600">
          How register links appear, where checkout opens, and what gets tracked.
        </p>
        <div className="mt-3">
          <SurfaceBadge surfaces={['Public', 'Embed', 'Portal', 'Host']} />
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Registration links</h3>
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
              Default: off. Hides Register/Learn More on programs and schedule. Punch pass redeem
              (when enabled below) still shows for eligible events.
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
              Default: off. On the schedule tab, adds a second action when the session has a Bond
              punch-pass product.
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
            Default: https://bondsports.co/user/passes
          </p>
        </div>
      </div>

      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Analytics</h3>
        <div>
          <label className="label">Google Tag Manager ID (optional)</label>
          <input
            type="text"
            className="input font-mono"
            placeholder="GTM-XXXXXX"
            value={config.gtmId || ''}
            onChange={(event) => setConfig({ ...config, gtmId: event.target.value || undefined })}
          />
          <p className="mt-1 text-xs text-gray-500">
            Page-specific GTM container ID. GTM loads inside the discovery iframe and pushes events
            to the partner&apos;s dataLayer for GA4. Leave empty to inherit from partner group.
          </p>
        </div>

        <div className="rounded-lg border border-gray-200 bg-gray-50 p-4 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Events that fire</p>
          <ul className="mt-2 list-disc space-y-1 pl-5">
            <li>
              <code className="rounded bg-gray-100 px-1 text-xs">page_view</code> — on discovery
              page load
            </li>
            <li>
              <code className="rounded bg-gray-100 px-1 text-xs">click_register</code> — when a
              visitor clicks a Register link
            </li>
            <li>
              <code className="rounded bg-gray-100 px-1 text-xs">click_redeem_pass</code> — when a
              visitor clicks a punch pass redeem button
            </li>
            <li>Forwarded Bond checkout events (purchase funnel) when checkout completes</li>
          </ul>
        </div>

        <div className="rounded-lg border border-blue-200 bg-blue-50 p-4 text-sm text-blue-900">
          <p className="font-medium">Setup guide</p>
          <p className="mt-1">
            Use GTM Preview on your live discovery or portal URL after saving. Bond also tracks
            page views internally at{' '}
            <Link href="/admin/analytics" className="font-medium underline">
              Admin Analytics
            </Link>
            .
          </p>
          <Link
            href="/admin/help/gtm-setup"
            className="mt-3 inline-flex items-center gap-1.5 font-medium text-blue-700 hover:text-blue-900"
          >
            Open GTM setup guide
            <ExternalLink size={14} />
          </Link>
        </div>
      </div>

      <div>
        <h3 className="mb-1 font-semibold text-gray-900">Deep links</h3>
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
