'use client';

import { SurfaceBadge } from '../components/SurfaceBadge';
import type { IPageEditorSectionProps } from '../page-config-types';

export function PageEditorBrandingSection({ config, setConfig }: IPageEditorSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Branding</h2>
        <p className="mt-1 text-sm text-gray-600">
          Visual identity shared across public, embed, and portal surfaces.
        </p>
        <div className="mt-3">
          <SurfaceBadge surfaces={['Public', 'Embed', 'Portal']} />
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
              Custom header bar color (leave empty for white)
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

      <div className="rounded-lg border border-gray-200 p-4">
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
          <option value="solid">Solid</option>
          <option value="gradient">Gradient</option>
        </select>
        <p className="mt-1 text-xs text-gray-500">
          Controls schedule headers, portal hero/strip accents, and register button styling.
        </p>
      </div>
    </div>
  );
}
