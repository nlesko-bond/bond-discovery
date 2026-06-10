'use client';

import { PortalAccentSourceEnum } from '@/types';
import type { IPageConfig } from '../page-config-types';

interface IPortalSessionsBrandingControlsProps {
  config: IPageConfig;
  setConfig: (next: IPageConfig) => void;
}

export function PortalSessionsBrandingControls({
  config,
  setConfig,
}: IPortalSessionsBrandingControlsProps) {
  const hostPortalLayout = config.features.hostPortalLayout || 'legacy_programs';
  const isSessionsList = hostPortalLayout === 'sessions_list';
  const isSessionsFirst = hostPortalLayout === 'sessions_first';
  const isSessionsLayout = isSessionsList || isSessionsFirst;

  return (
    <div className="space-y-4 rounded-lg border border-gray-200 p-4">
      <div>
        <h3 className="text-base font-semibold text-gray-900">Portal hero &amp; accents</h3>
        <p className="mt-1 text-sm text-gray-600">
          Styles the hero banner and session accents on{' '}
          <code className="rounded bg-gray-100 px-1 text-xs">/portal/&#123;slug&#125;</code> when
          portal layout is Sessions list or Sessions first.
        </p>
      </div>
      {!isSessionsLayout && (
        <p className="rounded-lg border border-amber-200 bg-amber-50 p-3 text-sm text-amber-900">
          Portal layout is still Legacy. Choose <strong>Sessions list</strong> or{' '}
          <strong>Sessions first</strong> in this section, then save.
        </p>
      )}
      <label className="flex items-center gap-2 text-sm text-gray-700">
        <input
          type="checkbox"
          checked={
            isSessionsList
              ? config.features.portalHeroEnabled !== false
              : config.features.portalHeroEnabled === true
          }
          onChange={(event) =>
            setConfig({
              ...config,
              features: {
                ...config.features,
                portalHeroEnabled: event.target.checked,
              },
            })
          }
        />
        Show hero banner above filters
      </label>
      <div>
        <label className="label">Hero title (optional)</label>
        <input
          type="text"
          className="input"
          placeholder="Soccer."
          value={config.features.portalHeroTitle || ''}
          onChange={(event) =>
            setConfig({
              ...config,
              features: {
                ...config.features,
                portalHeroTitle: event.target.value || undefined,
              },
            })
          }
        />
        <p className="mt-1 text-xs text-gray-500">
          Default: sport label from API (e.g. Soccer.) or page name.
        </p>
      </div>
      <div>
        <label className="label">Hero subtitle (optional)</label>
        <textarea
          className="input min-h-[4rem]"
          placeholder="All soccer programs at Coppermine. Filter by facility or age…"
          value={config.features.portalHeroSubtitle || ''}
          onChange={(event) =>
            setConfig({
              ...config,
              features: {
                ...config.features,
                portalHeroSubtitle: event.target.value || undefined,
              },
            })
          }
        />
        <p className="mt-1 text-xs text-gray-500">
          Default: auto-generated from company name and sport.
        </p>
      </div>
      <label className="flex items-start gap-3 text-sm text-gray-700">
        <input
          type="checkbox"
          className="mt-0.5 rounded border-gray-300"
          checked={config.features.portalAccentSource === PortalAccentSourceEnum.BRANDING}
          onChange={(event) =>
            setConfig({
              ...config,
              features: {
                ...config.features,
                portalAccentSource: event.target.checked
                  ? PortalAccentSourceEnum.BRANDING
                  : PortalAccentSourceEnum.SPORT,
              },
            })
          }
        />
        <span>
          <span className="font-medium text-gray-900">
            Use organization branding on hero &amp; session list
          </span>
          <span className="mt-1 block text-xs text-gray-500">
            Hero gradient, session strip, and register buttons use primary, secondary, and header
            colors from Branding (and logo on the hero when set). Session rows keep sport icons; org
            branding changes their accent colors.
          </span>
        </span>
      </label>
      {!config.branding.logo && (
        <p className="text-xs text-amber-700">
          Add a logo URL (top of this section) to show your mark on the hero when org branding is
          enabled.
        </p>
      )}
    </div>
  );
}
