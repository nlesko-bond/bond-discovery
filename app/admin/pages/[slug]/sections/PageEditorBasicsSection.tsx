'use client';

import { Eye, EyeOff } from 'lucide-react';
import type { IPageEditorBasicsSectionProps } from '../page-config-types';

export function PageEditorBasicsSection({
  config,
  setConfig,
  organizationIdsInput,
  setOrganizationIdsInput,
  facilityIdsInput,
  setFacilityIdsInput,
}: IPageEditorBasicsSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Basics</h2>
        <p className="mt-1 text-sm text-gray-600">
          Page identity, data scope, and which programs appear on all discovery surfaces.
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
          <p className="mt-1 text-xs text-gray-500">Comma-separated list</p>
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
          <p className="mt-1 text-xs text-gray-500">Restrict to specific facilities</p>
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
        </div>
      </div>

      <div>
        <label className="label">Program filtering</label>
        <div className="mt-2 space-y-3">
          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="programFilterMode"
              className="text-indigo-600"
              checked={(config.features.programFilterMode || 'all') === 'all'}
              onChange={() =>
                setConfig({
                  ...config,
                  excludedProgramIds: undefined,
                  features: {
                    ...config.features,
                    programFilterMode: 'all',
                    includedProgramIds: undefined,
                    customRegistrationUrl: undefined,
                  },
                })
              }
            />
            <div>
              <span className="font-medium">All active programs</span>
              <p className="text-sm text-gray-500">
                Show all published programs from configured organizations
              </p>
            </div>
          </label>

          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="programFilterMode"
              className="text-indigo-600"
              checked={config.features.programFilterMode === 'exclude'}
              onChange={() =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    programFilterMode: 'exclude',
                    includedProgramIds: undefined,
                    customRegistrationUrl: undefined,
                  },
                })
              }
            />
            <div>
              <span className="font-medium">Exclude specific programs</span>
              <p className="text-sm text-gray-500">Show all programs except the ones listed</p>
            </div>
          </label>

          {config.features.programFilterMode === 'exclude' && (
            <div className="ml-7">
              <input
                type="text"
                className="input"
                placeholder="e.g., 12345, 67890"
                value={config.excludedProgramIds?.join(', ') || ''}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    excludedProgramIds: event.target.value
                      ? event.target.value.split(',').map((item) => item.trim()).filter(Boolean)
                      : undefined,
                  })
                }
              />
              <p className="mt-1 text-xs text-gray-500">
                Comma-separated list of program IDs to hide
              </p>
            </div>
          )}

          <label className="flex items-center gap-3">
            <input
              type="radio"
              name="programFilterMode"
              className="text-indigo-600"
              checked={config.features.programFilterMode === 'include'}
              onChange={() =>
                setConfig({
                  ...config,
                  excludedProgramIds: undefined,
                  features: { ...config.features, programFilterMode: 'include' },
                })
              }
            />
            <div>
              <span className="font-medium">Include specific programs only</span>
              <p className="text-sm text-gray-500">Only show the programs listed (lightweight mode)</p>
            </div>
          </label>

          {config.features.programFilterMode === 'include' && (
            <div className="ml-7 space-y-3">
              <div>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g., 12345, 67890"
                  value={config.features.includedProgramIds?.join(', ') || ''}
                  onChange={(event) => {
                    const ids = event.target.value
                      ? event.target.value.split(',').map((item) => item.trim()).filter(Boolean)
                      : undefined;
                    setConfig({
                      ...config,
                      includedProgramIds: ids,
                      features: {
                        ...config.features,
                        includedProgramIds: ids,
                        customRegistrationUrl:
                          ids?.length === 1 ? config.features.customRegistrationUrl : undefined,
                      },
                    });
                  }}
                />
                <p className="mt-1 text-xs text-gray-500">
                  Comma-separated list of program IDs to show
                </p>
              </div>

              {config.features.includedProgramIds?.length === 1 && (
                <div className="rounded-lg bg-blue-50 p-3">
                  <label className="label text-blue-800">Custom registration URL (optional)</label>
                  <input
                    type="url"
                    className="input"
                    placeholder="https://example.com/register"
                    value={config.features.customRegistrationUrl || ''}
                    onChange={(event) =>
                      setConfig({
                        ...config,
                        features: {
                          ...config.features,
                          customRegistrationUrl: event.target.value || undefined,
                        },
                      })
                    }
                  />
                  <p className="mt-1 text-xs text-blue-600">
                    With exactly one program, registration links can point to a custom URL instead of
                    Bond checkout.
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
