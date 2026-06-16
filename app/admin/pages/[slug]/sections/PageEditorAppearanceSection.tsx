'use client';

import {
  PortalSessionLayoutEnum,
  type MemberPricingStyle,
  type PortalCardStyle,
  type PortalDisplayMode,
  type PortalTemplate,
} from '@/types';
import { PortalSessionsBrandingControls } from '../components/PortalSessionsBrandingControls';
import { SurfaceBadge } from '../components/SurfaceBadge';
import type { IPageEditorSectionProps } from '../page-config-types';

export function PageEditorAppearanceSection({ config, setConfig }: IPageEditorSectionProps) {
  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Appearance</h2>
        <p className="mt-1 text-sm text-gray-600">
          Visual identity shared across all surfaces, plus host-portal layout and branding
          overrides.
        </p>
        <div className="mt-3">
          <SurfaceBadge surfaces={['Public', 'Embed', 'Portal', 'Host']} />
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="label">Company / brand name</label>
          <input
            type="text"
            className="input"
            value={config.branding.companyName}
            onChange={(event) =>
              setConfig({
                ...config,
                branding: { ...config.branding, companyName: event.target.value },
              })
            }
          />
          <p className="mt-1 text-xs text-gray-500">Shown in the page header and portal hero.</p>
        </div>

        <div>
          <label className="label">Tagline</label>
          <input
            type="text"
            className="input"
            placeholder="Optional tagline"
            value={config.branding.tagline || ''}
            onChange={(event) =>
              setConfig({
                ...config,
                branding: { ...config.branding, tagline: event.target.value },
              })
            }
          />
          {config.branding.tagline && (
            <label className="mt-2 flex cursor-pointer items-center gap-2 text-sm text-gray-600">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={config.branding.showTaglineOnMobile || false}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    branding: { ...config.branding, showTaglineOnMobile: event.target.checked },
                  })
                }
              />
              Show tagline on mobile
            </label>
          )}
        </div>

        <div>
          <label className="label">Logo URL</label>
          <input
            type="text"
            className="input"
            placeholder="https://example.com/logo.png"
            value={config.branding.logo || ''}
            onChange={(event) =>
              setConfig({
                ...config,
                branding: { ...config.branding, logo: event.target.value },
              })
            }
          />
          <p className="mt-1 text-xs text-gray-500">
            Shown in the header and (when org branding is on) the portal hero.
          </p>
        </div>
      </div>

      <div>
        <h3 className="mb-4 font-semibold text-gray-900">Colors</h3>
        <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
          {(
            [
              {
                key: 'primaryColor' as const,
                label: 'Primary color',
                hint: 'Main brand color (header, buttons)',
              },
              {
                key: 'secondaryColor' as const,
                label: 'Secondary color',
                hint: 'Secondary highlights',
              },
              {
                key: 'accentColor' as const,
                label: 'Accent color',
                hint: 'Accents and hover states',
                fallback: '#8B5CF6',
              },
            ] as const
          ).map((colorField) => {
            const value =
              colorField.key === 'accentColor'
                ? config.branding.accentColor || colorField.fallback
                : config.branding[colorField.key];
            return (
              <div key={colorField.key}>
                <label className="label">{colorField.label}</label>
                <div className="flex items-center gap-2">
                  <input
                    type="color"
                    className="h-12 w-12 cursor-pointer rounded border border-gray-200"
                    value={value}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        branding: { ...config.branding, [colorField.key]: event.target.value },
                      })
                    }
                  />
                  <input
                    type="text"
                    className="input flex-1"
                    value={value}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        branding: { ...config.branding, [colorField.key]: event.target.value },
                      })
                    }
                  />
                </div>
                <p className="mt-1 text-xs text-gray-500">{colorField.hint}</p>
              </div>
            );
          })}

          <div>
            <label className="label">Header background</label>
            <div className="flex items-center gap-2">
              <input
                type="color"
                className="h-12 w-12 cursor-pointer rounded border border-gray-200"
                value={config.branding.headerBackgroundColor || '#ffffff'}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    branding: { ...config.branding, headerBackgroundColor: event.target.value },
                  })
                }
              />
              <input
                type="text"
                className="input flex-1"
                placeholder="#ffffff (default: white)"
                value={config.branding.headerBackgroundColor || ''}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    branding: {
                      ...config.branding,
                      headerBackgroundColor: event.target.value || undefined,
                    },
                  })
                }
              />
              {config.branding.headerBackgroundColor && (
                <button
                  type="button"
                  className="rounded border border-gray-200 px-2 py-1 text-xs text-gray-500 hover:text-gray-700"
                  onClick={() =>
                    setConfig({
                      ...config,
                      branding: { ...config.branding, headerBackgroundColor: undefined },
                    })
                  }
                >
                  Reset
                </button>
              )}
            </div>
            <p className="mt-1 text-xs text-gray-500">
              Custom header bar color. Default: white.
            </p>
          </div>
        </div>

        <div className="mt-6 rounded-lg bg-gray-50 p-4">
          <p className="mb-3 text-sm font-medium text-gray-700">Color preview</p>
          <div className="flex gap-4">
            <div
              className="flex h-16 w-24 items-center justify-center rounded-lg text-xs font-medium text-white shadow-sm"
              style={{ backgroundColor: config.branding.primaryColor }}
            >
              Primary
            </div>
            <div
              className="flex h-16 w-24 items-center justify-center rounded-lg text-xs font-medium text-white shadow-sm"
              style={{ backgroundColor: config.branding.secondaryColor }}
            >
              Secondary
            </div>
            <div
              className="flex h-16 w-24 items-center justify-center rounded-lg text-xs font-medium text-white shadow-sm"
              style={{ backgroundColor: config.branding.accentColor || '#8B5CF6' }}
            >
              Accent
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-4 font-semibold text-gray-900">Header &amp; theme</h3>
        <div className="space-y-4">
          <div>
            <label className="label">Schedule &amp; portal theme style</label>
            <select
              className="input"
              value={config.features.scheduleThemeStyle || 'solid'}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    scheduleThemeStyle: event.target.value as 'solid' | 'gradient',
                  },
                })
              }
            >
              <option value="solid">Solid (default)</option>
              <option value="gradient">Gradient</option>
            </select>
            <p className="mt-1 text-xs text-gray-500">
              Controls schedule headers, portal hero/strip accents, and register button styling.
            </p>
          </div>

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
              Default: Full. Use Minimal or Hidden when the page renders inside a site that already
              has its own header.
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
                Default: off. Calendar navigation headers still stick for better UX.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-1 font-semibold text-gray-900">Partner site integration</h3>
        <p className="mb-4 text-sm text-gray-600">
          Where the host kit opens registration and checkout on the org&apos;s own website.
        </p>
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
              Where registration/checkout loads inside the iframe. Default: https://bondsports.co.
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
              <p className="mt-1 text-xs text-gray-500">Default: /programs</p>
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
              <p className="mt-1 text-xs text-gray-500">Default: /programs/register</p>
            </div>
          </div>
        </div>
      </div>

      <div>
        <h3 className="mb-1 font-semibold text-gray-900">Portal overrides</h3>
        <p className="mb-4 text-sm text-gray-600">
          Layout and branding that apply only to{' '}
          <code className="rounded bg-gray-100 px-1 text-xs">/portal/&#123;slug&#125;</code>. Public
          /&#123;slug&#125; and embeds are unchanged.
        </p>
        <div className="space-y-4">
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
              <option value="legacy_programs">Legacy (program cards) — default</option>
              <option value="sessions_first">Sessions first (grid cards)</option>
              <option value="sessions_list">Sessions list (hero + rows)</option>
            </select>
          </div>

          {(config.features.hostPortalLayout === 'sessions_list' ||
            config.features.hostPortalLayout === 'sessions_first') && (
            <div className="space-y-4 rounded-lg border border-gray-200 p-4">
              <h4 className="text-sm font-semibold text-gray-900">Session list vs grid</h4>
              <p className="text-xs text-gray-500">
                Default presentation on the portal sessions shell. When the visitor toggle is
                enabled, list/grid icons appear in the filter bar.
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
                  <span className="font-medium text-gray-900">
                    Allow visitors to switch list / grid
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    Default: off. Hero banner appears only in list view.
                  </span>
                </span>
              </label>
            </div>
          )}

          <div className="space-y-4 rounded-lg border border-gray-200 p-4">
            <div>
              <h4 className="text-sm font-semibold text-gray-900">Discovery template</h4>
              <p className="mt-1 text-xs text-gray-500">
                Redesigned template (plan 009). Applies to /portal/&#123;slug&#125; and the
                public /&#123;slug&#125; page. &quot;Current&quot; keeps existing rendering
                unchanged.
              </p>
            </div>
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
              <div>
                <label className="label">Template</label>
                <select
                  className="input"
                  value={config.features.portalTemplate || 'current'}
                  onChange={(event) => {
                    const value = event.target.value as PortalTemplate;
                    setConfig({
                      ...config,
                      features: {
                        ...config.features,
                        portalTemplate: value === 'current' ? undefined : value,
                      },
                    });
                  }}
                >
                  <option value="current">Current</option>
                  <option value="v2">V2 (redesigned)</option>
                </select>
              </div>
              <div>
                <label className="label">Card min width (px)</label>
                <input
                  type="number"
                  className="input"
                  min={160}
                  max={480}
                  step={10}
                  placeholder="Default: 240 (cards) / 200 (list)"
                  value={config.features.portalCardMinWidth ?? ''}
                  onChange={(event) => {
                    const parsed = Number.parseInt(event.target.value, 10);
                    setConfig({
                      ...config,
                      features: {
                        ...config.features,
                        portalCardMinWidth: Number.isFinite(parsed) ? parsed : undefined,
                      },
                    });
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Feeds the V2 auto-fill grid: smaller = denser columns.
                </p>
              </div>
            </div>
            {config.features.portalTemplate === 'v2' && (
              <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
                <div>
                  <label className="label">Display mode</label>
                  <select
                    className="input"
                    value={config.features.portalDisplayMode || 'auto'}
                    onChange={(event) => {
                      const value = event.target.value as PortalDisplayMode;
                      setConfig({
                        ...config,
                        features: {
                          ...config.features,
                          portalDisplayMode: value === 'auto' ? undefined : value,
                        },
                      });
                    }}
                  >
                    <option value="auto">Auto — sessions when the page has one program</option>
                    <option value="sessions">Sessions — flat session cards</option>
                    <option value="programs">Programs — sessions grouped by program</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Auto keeps single-program pages (e.g. one-sport portals) as a clean
                    session list and groups multi-program pages by program.
                  </p>
                </div>
                <div>
                  <label className="label">Session card style</label>
                  <select
                    className="input"
                    value={config.features.portalCardStyle || 'classic'}
                    onChange={(event) => {
                      const value = event.target.value as PortalCardStyle;
                      setConfig({
                        ...config,
                        features: {
                          ...config.features,
                          portalCardStyle: value === 'classic' ? undefined : value,
                        },
                      });
                    }}
                  >
                    <option value="classic">Classic — current session card</option>
                    <option value="stacked">Stacked — modern card, segments chip</option>
                    <option value="rows">Rows — dense table-style rows</option>
                  </select>
                  <p className="mt-1 text-xs text-gray-500">
                    Preview without saving: ?portalTemplate=v2&amp;portalCardStyle=stacked
                  </p>
                </div>
              </div>
            )}
            {config.features.portalTemplate === 'v2' && (
              <label className="flex items-start gap-3 text-sm text-gray-700">
                <input
                  type="checkbox"
                  className="mt-0.5 rounded border-gray-300"
                  checked={config.features.showTieredSessionPricing === true}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      features: {
                        ...config.features,
                        showTieredSessionPricing: event.target.checked,
                      },
                    })
                  }
                />
                <span>
                  <span className="font-medium text-gray-900">
                    Show early bird / late fee pricing on sessions
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    When the API returns tiered product prices, session cards and rows show a
                    short label (e.g. early bird rate until a date).
                  </span>
                </span>
              </label>
            )}
            {config.features.portalTemplate === 'v2' && (
              <div>
                <label className="label">Member price style (temporary)</label>
                <select
                  className="input"
                  value={config.features.memberPricingStyle || 'inline'}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      features: {
                        ...config.features,
                        memberPricingStyle: event.target.value as MemberPricingStyle,
                      },
                    })
                  }
                >
                  <option value="inline">Inline — From $30 · $24 members</option>
                  <option value="badge">Badge — From $30 [Members $24]</option>
                  <option value="stacked">Stacked — second line under price</option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Compare on a preview URL:
                  ?portalTemplate=v2&amp;memberPricingStyle=badge&amp;portalCardMinWidth=280
                </p>
              </div>
            )}
          </div>

          <PortalSessionsBrandingControls config={config} setConfig={setConfig} />
        </div>
      </div>
    </div>
  );
}
