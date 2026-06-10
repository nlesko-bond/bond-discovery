'use client';

import { ALL_FILTERS, type IPageEditorSectionProps } from '../page-config-types';
import { SurfaceBadge } from '../components/SurfaceBadge';

export function PageEditorFiltersSection({ config, setConfig }: IPageEditorSectionProps) {
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Filters</h2>
        <p className="mt-1 text-sm text-gray-600">
          Choose which filter dimensions visitors can use on this page.
        </p>
        <div className="mt-3">
          <SurfaceBadge surfaces={['Public', 'Embed', 'Portal']} />
        </div>
      </div>

      <div className="space-y-3">
        {ALL_FILTERS.map((filter) => (
          <label
            key={filter.id}
            className="flex cursor-pointer items-start gap-3 rounded-lg bg-gray-50 p-3 transition-colors hover:bg-gray-100"
          >
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300"
              checked={config.features.enableFilters.includes(filter.id)}
              onChange={(event) => {
                const newFilters = event.target.checked
                  ? [...config.features.enableFilters, filter.id]
                  : config.features.enableFilters.filter((item) => item !== filter.id);
                setConfig({
                  ...config,
                  features: { ...config.features, enableFilters: newFilters },
                });
              }}
            />
            <div>
              <p className="font-medium text-gray-900">{filter.name}</p>
              <p className="text-sm text-gray-500">{filter.description}</p>
            </div>
          </label>
        ))}
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-900">Space column label (optional)</label>
        <p className="mb-2 mt-0.5 text-xs text-gray-500">
          Shown on the schedule table header and space filter when Space is enabled. Leave blank for
          &quot;Space&quot;.
        </p>
        <input
          type="text"
          className="w-full max-w-md rounded-md border border-gray-300 px-3 py-2 text-sm"
          placeholder="Space"
          value={config.features.spaceColumnLabel ?? ''}
          onChange={(event) => {
            const value = event.target.value.trim();
            setConfig({
              ...config,
              features: {
                ...config.features,
                spaceColumnLabel: value.length > 0 ? value : undefined,
              },
            });
          }}
        />
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <h3 className="text-sm font-semibold text-gray-900">Browser storage (privacy)</h3>
        <p className="mt-1 text-sm text-gray-500">
          When enabled, filter choices are saved in the browser and restored on return visits.
          Shared links with query parameters always work.
        </p>
        <label className="mt-3 flex items-start gap-3">
          <input
            type="checkbox"
            className="mt-1 rounded border-gray-300"
            checked={config.features.persistFiltersInLocalStorage !== false}
            onChange={(event) =>
              setConfig({
                ...config,
                features: { ...config.features, persistFiltersInLocalStorage: event.target.checked },
              })
            }
          />
          <div>
            <span className="font-medium text-gray-900">Remember filter selections (localStorage)</span>
            <p className="mt-1 text-xs text-gray-500">Default: on</p>
          </div>
        </label>
      </div>
    </div>
  );
}
