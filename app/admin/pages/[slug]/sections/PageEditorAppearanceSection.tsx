'use client';

import {
  type MemberPricingStyle,
  type PortalDisplayMode,
  type PortalRowColumn,
} from '@/types';
import { PortalSessionsBrandingControls } from '../components/PortalSessionsBrandingControls';
import { SurfaceBadge } from '../components/SurfaceBadge';
import { PORTAL_ROW_COLUMNS } from '../page-config-types';
import type { IPageConfig, IPageEditorSectionProps } from '../page-config-types';

type PortalView = 'rows' | 'stacked' | 'classic' | 'list' | 'legacy';

function derivePortalView(config: IPageConfig): PortalView {
  if (config.features.portalTemplate === 'v2') {
    const style = config.features.portalCardStyle;
    if (style === 'rows') return 'rows';
    if (style === 'stacked') return 'stacked';
    if (style === 'list') return 'list';
    return 'classic';
  }
  return 'legacy';
}

function applyPortalView(config: IPageConfig, view: PortalView): IPageConfig {
  const base = {
    ...config,
    features: {
      ...config.features,
      portalSessionLayoutDefault: undefined,
      allowPortalSessionLayoutToggle: undefined,
    },
  };
  switch (view) {
    case 'rows':
      return {
        ...base,
        features: {
          ...base.features,
          hostPortalLayout: 'sessions_list' as const,
          portalTemplate: 'v2' as const,
          portalCardStyle: 'rows' as const,
        },
      };
    case 'stacked':
      return {
        ...base,
        features: {
          ...base.features,
          hostPortalLayout: 'sessions_list' as const,
          portalTemplate: 'v2' as const,
          portalCardStyle: 'stacked' as const,
          portalRowColumns: undefined,
          portalRowExpandMode: undefined,
          portalRowActionMode: undefined,
          portalRowShowSegmentRegister: undefined,
          portalRowShowSegmentSpots: undefined,
        },
      };
    case 'classic':
      return {
        ...base,
        features: {
          ...base.features,
          hostPortalLayout: 'sessions_list' as const,
          portalTemplate: 'v2' as const,
          portalCardStyle: undefined,
          portalRowColumns: undefined,
          portalRowExpandMode: undefined,
          portalRowActionMode: undefined,
          portalRowShowSegmentRegister: undefined,
          portalRowShowSegmentSpots: undefined,
        },
      };
    case 'list':
      return {
        ...base,
        features: {
          ...base.features,
          hostPortalLayout: 'sessions_list' as const,
          portalTemplate: 'v2' as const,
          portalCardStyle: 'list' as const,
          portalRowColumns: undefined,
          portalRowExpandMode: undefined,
          portalRowActionMode: undefined,
          portalRowShowSegmentRegister: undefined,
          portalRowShowSegmentSpots: undefined,
        },
      };
    case 'legacy':
      return {
        ...base,
        features: {
          ...base.features,
          hostPortalLayout: 'legacy_programs' as const,
          portalTemplate: undefined,
          portalCardStyle: undefined,
          portalRowColumns: undefined,
          portalRowExpandMode: undefined,
          portalRowActionMode: undefined,
          portalRowShowSegmentRegister: undefined,
          portalRowShowSegmentSpots: undefined,
        },
      };
  }
}

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
        <h3 className="mb-1 font-semibold text-gray-900">Portal view</h3>
        <p className="mb-4 text-sm text-gray-600">
          Layout for{' '}
          <code className="rounded bg-gray-100 px-1 text-xs">/portal/&#123;slug&#125;</code>.
          Public <code className="rounded bg-gray-100 px-1 text-xs">/&#123;slug&#125;</code> and
          embeds use the same setting.
        </p>
        <div className="space-y-4">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {(
              [
                {
                  id: 'rows' as const,
                  label: 'Rows',
                  desc: 'Table-style rows with expand panels',
                  preview: 'portalCardStyle=rows',
                },
                {
                  id: 'stacked' as const,
                  label: 'Stacked cards',
                  desc: 'Modern grid cards with segment chip',
                  preview: 'portalCardStyle=stacked',
                },
                {
                  id: 'classic' as const,
                  label: 'Classic cards',
                  desc: 'Original session card grid',
                  preview: 'portalCardStyle=classic',
                },
                {
                  id: 'list' as const,
                  label: 'List',
                  desc: 'Compact hero-friendly list',
                  preview: 'portalCardStyle=list',
                },
              ] satisfies Array<{ id: PortalView; label: string; desc: string; preview: string }>
            ).map((view) => {
              const isActive = derivePortalView(config) === view.id;
              return (
                <button
                  key={view.id}
                  type="button"
                  onClick={() => setConfig(applyPortalView(config, view.id))}
                  className={`rounded-xl border p-4 text-left transition-all ${
                    isActive
                      ? 'border-indigo-400 bg-indigo-50 shadow-sm ring-1 ring-indigo-300'
                      : 'border-gray-200 bg-white hover:border-gray-300 hover:shadow-sm'
                  }`}
                >
                  <p className={`text-sm font-semibold ${isActive ? 'text-indigo-700' : 'text-gray-900'}`}>
                    {view.label}
                    {view.id === 'rows' && (
                      <span className="ml-2 rounded-full bg-indigo-100 px-2 py-0.5 text-[10px] font-semibold text-indigo-600">
                        New
                      </span>
                    )}
                  </p>
                  <p className="mt-1 text-xs text-gray-500">{view.desc}</p>
                  <p className="mt-2 truncate font-mono text-[10px] text-gray-400">
                    ?portalTemplate=v2&amp;{view.preview}
                  </p>
                </button>
              );
            })}
          </div>

          {derivePortalView(config) === 'legacy' && (
            <div className="rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-800">
              This page is using the legacy program cards layout. Select a view above to upgrade.
            </div>
          )}

          {derivePortalView(config) !== 'legacy' && (
            <button
              type="button"
              onClick={() => setConfig(applyPortalView(config, 'legacy'))}
              className="text-xs text-gray-400 underline-offset-2 hover:text-gray-600 hover:underline"
            >
              Switch to legacy layout
            </button>
          )}

          {derivePortalView(config) === 'rows' && (
            <div className="space-y-4 rounded-lg border border-indigo-100 bg-indigo-50/40 p-4">
              <h5 className="text-sm font-semibold text-gray-900">Rows configuration</h5>

              <div>
                <label className="label">Row type</label>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-indigo-200 bg-white p-3 text-sm shadow-sm">
                    <input
                      type="radio"
                      className="mt-0.5"
                      name="portalRowExpandMode"
                      value="sessions"
                      checked={
                        !config.features.portalRowExpandMode ||
                        config.features.portalRowExpandMode === 'sessions'
                      }
                      onChange={() =>
                        setConfig({
                          ...config,
                          features: { ...config.features, portalRowExpandMode: undefined },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium text-gray-900">Sessions</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        Each row is a session. Clicking expands to show schedule options (time
                        slots and availability).
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-not-allowed items-start gap-3 rounded-lg border border-gray-200 bg-gray-50 p-3 text-sm opacity-50">
                    <input
                      type="radio"
                      className="mt-0.5"
                      name="portalRowExpandMode"
                      value="programs"
                      disabled
                    />
                    <span>
                      <span className="font-medium text-gray-500">
                        Programs{' '}
                        <span className="text-xs font-normal text-gray-400">— coming soon</span>
                      </span>
                      <span className="mt-0.5 block text-xs text-gray-400">
                        Each row is a program. Clicking expands to show its sessions.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div>
                <label className="label">Content grouping</label>
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
                  <option value="auto">Auto — flat when one program, grouped when many</option>
                  <option value="sessions">Flat — all sessions in a single list</option>
                  <option value="programs">
                    Grouped — sessions organized under program headings
                  </option>
                </select>
                <p className="mt-1 text-xs text-gray-500">
                  Grouped hides the Program column (the heading already shows it).
                </p>
              </div>

              <div>
                <label className="label">Columns</label>
                <p className="mb-3 text-xs text-gray-500">
                  Choose which columns appear. Session is always shown.
                </p>
                {(() => {
                  const canonicalIds = PORTAL_ROW_COLUMNS.map((c) => c.id);
                  const activeColumns: PortalRowColumn[] =
                    config.features.portalRowColumns ?? canonicalIds;
                  const inactiveColumns = canonicalIds.filter(
                    (c) => !activeColumns.includes(c),
                  );
                  const displayOrder: PortalRowColumn[] = [...activeColumns, ...inactiveColumns];
                  const colMeta = Object.fromEntries(
                    PORTAL_ROW_COLUMNS.map((c) => [c.id, c]),
                  ) as Record<PortalRowColumn, (typeof PORTAL_ROW_COLUMNS)[number]>;

                  function saveActiveColumns(next: PortalRowColumn[]) {
                    setConfig({
                      ...config,
                      features: {
                        ...config.features,
                        portalRowColumns:
                          next.join(',') === canonicalIds.join(',') ? undefined : next,
                      },
                    });
                  }

                  return (
                    <div className="space-y-1">
                      {displayOrder.map((id) => {
                        const col = colMeta[id];
                        const isChecked = activeColumns.includes(id);
                        const isRequired = id === 'event';
                        const activeIdx = activeColumns.indexOf(id);
                        const canMoveUp = isChecked && activeIdx > 0;
                        const canMoveDown = isChecked && activeIdx < activeColumns.length - 1;

                        return (
                          <div
                            key={id}
                            className={`flex items-center gap-2 rounded-lg border p-2.5 text-sm ${
                              isRequired
                                ? 'border-gray-200 bg-gray-50 opacity-60'
                                : isChecked
                                  ? 'border-gray-200 bg-white'
                                  : 'border-dashed border-gray-200 bg-gray-50 text-gray-400'
                            }`}
                          >
                            <input
                              type="checkbox"
                              className="rounded border-gray-300"
                              checked={isChecked}
                              disabled={isRequired}
                              onChange={(e) => {
                                const next = e.target.checked
                                  ? [...activeColumns, id]
                                  : activeColumns.filter((c) => c !== id);
                                saveActiveColumns(next);
                              }}
                            />
                            <span className="flex-1">
                              <span className="font-medium">{col.label}</span>
                              <span className="ml-2 text-xs text-gray-500">{col.hint}</span>
                            </span>
                            {isChecked && !isRequired && (
                              <span className="flex gap-0.5">
                                <button
                                  type="button"
                                  disabled={!canMoveUp}
                                  onClick={() => {
                                    const newOrder = [...activeColumns];
                                    [newOrder[activeIdx - 1], newOrder[activeIdx]] = [
                                      newOrder[activeIdx],
                                      newOrder[activeIdx - 1],
                                    ];
                                    saveActiveColumns(newOrder);
                                  }}
                                  className="rounded px-1 py-0.5 text-xs text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                                  aria-label={`Move ${col.label} up`}
                                >
                                  ↑
                                </button>
                                <button
                                  type="button"
                                  disabled={!canMoveDown}
                                  onClick={() => {
                                    const newOrder = [...activeColumns];
                                    [newOrder[activeIdx], newOrder[activeIdx + 1]] = [
                                      newOrder[activeIdx + 1],
                                      newOrder[activeIdx],
                                    ];
                                    saveActiveColumns(newOrder);
                                  }}
                                  className="rounded px-1 py-0.5 text-xs text-gray-400 hover:bg-gray-100 disabled:opacity-30"
                                  aria-label={`Move ${col.label} down`}
                                >
                                  ↓
                                </button>
                              </span>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  );
                })()}
              </div>

              <div>
                <label className="label">Row click actions</label>
                <div className="space-y-2">
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-indigo-200 bg-white p-3 text-sm shadow-sm">
                    <input
                      type="radio"
                      className="mt-0.5"
                      name="portalRowActionMode"
                      value="separate"
                      checked={
                        !config.features.portalRowActionMode ||
                        config.features.portalRowActionMode === 'separate'
                      }
                      onChange={() =>
                        setConfig({
                          ...config,
                          features: { ...config.features, portalRowActionMode: undefined },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium text-gray-900">Separate</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        &quot;View schedule&quot; opens the schedule tab; &quot;More info&quot;
                        expands the row.
                      </span>
                    </span>
                  </label>
                  <label className="flex cursor-pointer items-start gap-3 rounded-lg border border-indigo-200 bg-white p-3 text-sm shadow-sm">
                    <input
                      type="radio"
                      className="mt-0.5"
                      name="portalRowActionMode"
                      value="combined"
                      checked={config.features.portalRowActionMode === 'combined'}
                      onChange={() =>
                        setConfig({
                          ...config,
                          features: { ...config.features, portalRowActionMode: 'combined' },
                        })
                      }
                    />
                    <span>
                      <span className="font-medium text-gray-900">Combined expand</span>
                      <span className="mt-0.5 block text-xs text-gray-500">
                        One &quot;More info / Schedule&quot; control (or &quot;More info&quot;
                        when there is no schedule). The whole row expands; no jump to the
                        schedule tab.
                      </span>
                    </span>
                  </label>
                </div>
              </div>

              <div className="space-y-3">
                <p className="text-xs font-semibold uppercase tracking-wide text-gray-500">
                  Expand panel options
                </p>
                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-gray-300"
                    checked={config.features.portalRowShowSegmentRegister === true}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        features: {
                          ...config.features,
                          portalRowShowSegmentRegister: event.target.checked || undefined,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium text-gray-900">
                      Register cart on schedule options
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      Each time slot shows a cart Register link (Join waitlist when full). Links
                      to the session registration page.
                    </span>
                  </span>
                </label>
                <label className="flex items-start gap-3 text-sm text-gray-700">
                  <input
                    type="checkbox"
                    className="mt-0.5 rounded border-gray-300"
                    checked={config.features.portalRowShowSegmentSpots === true}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        features: {
                          ...config.features,
                          portalRowShowSegmentSpots: event.target.checked || undefined,
                        },
                      })
                    }
                  />
                  <span>
                    <span className="font-medium text-gray-900">
                      Spots remaining on schedule options
                    </span>
                    <span className="mt-1 block text-xs text-gray-500">
                      Show remaining spots per time slot; when none remain, show Full.
                    </span>
                  </span>
                </label>
              </div>

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
                    Show early bird / late fee pricing
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    When the API returns tiered prices, rows show a short label (e.g. &quot;early
                    bird until a date&quot;).
                  </span>
                </span>
              </label>
            </div>
          )}

          {derivePortalView(config) !== 'legacy' && derivePortalView(config) !== 'rows' && (
            <div className="space-y-4">
              <div>
                <label className="label">Content grouping</label>
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
                  <option value="sessions">Flat — all sessions in a single list</option>
                  <option value="programs">Grouped — sessions organized under program headings</option>
                </select>
              </div>
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
                    Show early bird / late fee pricing
                  </span>
                  <span className="mt-1 block text-xs text-gray-500">
                    When the API returns tiered prices, session cards show a short pricing label.
                  </span>
                </span>
              </label>
            </div>
          )}

          {derivePortalView(config) !== 'legacy' && (
            <div>
              <label className="label">Session order</label>
              <select
                className="input"
                value={config.features.portalSessionSort || 'default'}
                onChange={(event) => {
                  const value = event.target.value;
                  setConfig({
                    ...config,
                    features: {
                      ...config.features,
                      portalSessionSort:
                        value === 'default'
                          ? undefined
                          : (value as NonNullable<
                              IPageConfig['features']['portalSessionSort']
                            >),
                    },
                  });
                }}
              >
                <option value="default">Default — Bond source order</option>
                <option value="min_age">Age — youngest first</option>
                <option value="start_date">Start date</option>
                <option value="name">Name (A–Z)</option>
                <option value="price">Price (low to high)</option>
              </select>
              <p className="mt-1 text-xs text-gray-500">
                Controls the order sessions appear in. &quot;Age&quot; sorts by each
                session&apos;s minimum age ascending.
              </p>
            </div>
          )}

          {(derivePortalView(config) === 'rows' ||
            derivePortalView(config) === 'stacked') && (
            <label className="flex items-start gap-3 text-sm text-gray-700">
              <input
                type="checkbox"
                className="mt-0.5 rounded border-gray-300"
                checked={config.features.showSegmentScheduleSummary === true}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    features: {
                      ...config.features,
                      showSegmentScheduleSummary: event.target.checked,
                    },
                  })
                }
              />
              <span>
                <span className="font-medium text-gray-900">Show days &amp; times on cards</span>
                <span className="mt-1 block text-xs text-gray-500">
                  Adds a compact schedule line (e.g. &quot;Tue, Thu · 9:30 AM&quot;) built from the
                  events feed, without needing to expand the row.
                </span>
              </span>
            </label>
          )}

          {derivePortalView(config) !== 'legacy' && (
            <div>
              <label className="label">Member price style</label>
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
            </div>
          )}

          <PortalSessionsBrandingControls config={config} setConfig={setConfig} />
        </div>
      </div>
    </div>
  );
}
