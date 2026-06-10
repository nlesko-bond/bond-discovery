'use client';

import { ALL_FILTERS, TABLE_COLUMNS, type IPageEditorProgramsSectionProps } from '../page-config-types';
import { SurfaceBadge } from '../components/SurfaceBadge';

export function PageEditorProgramsSection({
  config,
  setConfig,
  activeTableColumns,
  updateTableColumns,
}: IPageEditorProgramsSectionProps) {
  const enabledTabs = config.features.enabledTabs || ['programs', 'schedule'];

  return (
    <div className="space-y-8">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Programs &amp; Filters</h2>
        <p className="mt-1 text-sm text-gray-600">
          Which programs appear, default views, display options, and the filters visitors can use.
        </p>
        <div className="mt-3">
          <SurfaceBadge surfaces={['Public', 'Embed', 'Portal']} />
        </div>
      </div>

      <div>
        <h3 className="mb-1 font-semibold text-gray-900">Program filtering</h3>
        <p className="mb-4 text-sm text-gray-600">
          Which programs from the configured organizations appear on all discovery surfaces.
        </p>
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
              <span className="font-medium">All active programs (default)</span>
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

      <div>
        <h3 className="mb-4 font-semibold text-gray-900">Tab visibility</h3>
        <p className="mb-4 text-sm text-gray-500">Choose which tabs to display. At least one must be enabled.</p>
        <div className="space-y-3">
          {(
            [
              {
                id: 'programs' as const,
                title: 'Programs tab',
                description: 'Show program cards with details and sessions',
              },
              {
                id: 'schedule' as const,
                title: 'Schedule tab',
                description: 'Show calendar/list view of events',
              },
            ] as const
          ).map((tab) => (
            <label key={tab.id} className="flex items-center gap-3">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={enabledTabs.includes(tab.id)}
                onChange={(event) => {
                  let newTabs = event.target.checked
                    ? [...enabledTabs, tab.id]
                    : enabledTabs.filter((item) => item !== tab.id);
                  if (newTabs.length === 0) {
                    newTabs = tab.id === 'programs' ? ['schedule'] : ['programs'];
                  }
                  let newDefaultView = config.features.defaultView;
                  if (!newTabs.includes(newDefaultView)) {
                    newDefaultView = newTabs[0] as 'programs' | 'schedule';
                  }
                  setConfig({
                    ...config,
                    features: {
                      ...config.features,
                      enabledTabs: newTabs as ('programs' | 'schedule')[],
                      defaultView: newDefaultView,
                    },
                  });
                }}
              />
              <div>
                <span className="font-medium">{tab.title}</span>
                <p className="text-sm text-gray-500">{tab.description}</p>
              </div>
            </label>
          ))}

          <div className="mt-4">
            <label className="label">Default tab</label>
            <select
              className="input"
              value={config.features.defaultView}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    defaultView: event.target.value as 'programs' | 'schedule',
                  },
                })
              }
            >
              {enabledTabs.includes('programs') && <option value="programs">Programs</option>}
              {enabledTabs.includes('schedule') && <option value="schedule">Schedule</option>}
            </select>
          </div>
        </div>
      </div>

      <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
        <div>
          <label className="label">Default schedule view (desktop)</label>
          <select
            className="input"
            value={config.features.defaultScheduleView || 'list'}
            onChange={(event) =>
              setConfig({
                ...config,
                features: {
                  ...config.features,
                  defaultScheduleView: event.target.value as
                    | 'list'
                    | 'table'
                    | 'day'
                    | 'week'
                    | 'month',
                },
              })
            }
          >
            <option value="list">List (default)</option>
            <option value="table">Table</option>
            <option value="day">Day</option>
            <option value="week">Week grid</option>
            <option value="month">Month</option>
          </select>
        </div>

        <div>
          <label className="label">Default schedule view (mobile)</label>
          <select
            className="input"
            value={config.features.mobileDefaultScheduleView || 'list'}
            onChange={(event) =>
              setConfig({
                ...config,
                features: {
                  ...config.features,
                  mobileDefaultScheduleView: event.target.value as
                    | 'list'
                    | 'table'
                    | 'day'
                    | 'week'
                    | 'month',
                },
              })
            }
          >
            <option value="list">List (default)</option>
            {config.features.allowTableViewOnMobile && <option value="table">Table</option>}
            <option value="day">Day</option>
            <option value="week">Week grid</option>
            <option value="month">Month</option>
          </select>
          {!config.features.allowTableViewOnMobile && (
            <p className="mt-1 text-xs text-gray-500">
              Enable table view on mobile below to allow Table as a mobile default.
            </p>
          )}
        </div>
      </div>

      <div>
        <h3 className="mb-4 font-semibold text-gray-900">Display options</h3>
        <div className="space-y-3">
          {(
            [
              { key: 'showPricing', label: 'Show pricing information' },
              { key: 'showAvailability', label: 'Show availability / spots remaining' },
              { key: 'showMembershipBadges', label: 'Show membership badges' },
              { key: 'showAgeGender', label: 'Show age and gender restrictions' },
              { key: 'showSearch', label: 'Show search bar', defaultOn: true },
              { key: 'showShareButton', label: 'Show share / copy link button', defaultOn: true },
              { key: 'showRegisterIcon', label: 'Show icon on Register buttons', defaultOn: true },
              { key: 'allowViewToggle', label: 'Allow switching between Programs and Schedule view' },
              { key: 'showTableView', label: 'Show Table view option on desktop' },
            ] as const
          ).map((option) => {
            const checked =
              option.key === 'showSearch' ||
              option.key === 'showShareButton' ||
              option.key === 'showRegisterIcon'
                ? config.features[option.key] !== false
                : Boolean(config.features[option.key]);
            return (
              <label key={option.key} className="flex items-center gap-3">
                <input
                  type="checkbox"
                  className="rounded border-gray-300"
                  checked={checked}
                  onChange={(event) =>
                    setConfig({
                      ...config,
                      features: { ...config.features, [option.key]: event.target.checked },
                    })
                  }
                />
                <span>{option.label}</span>
              </label>
            );
          })}

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300"
              checked={config.features.showLeagueScheduleTableAndExport || false}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    showLeagueScheduleTableAndExport: event.target.checked,
                  },
                })
              }
            />
            <span>
              <span className="font-medium">Show league table &amp; export option</span>
              <p className="mt-0.5 text-xs text-gray-500">
                When visitors filter to leagues only, schedule table and CSV export use league
                columns.
              </p>
            </span>
          </label>

          <label className="flex items-center gap-2 pt-2 text-sm text-gray-700">
            <input
              type="checkbox"
              className="rounded border-gray-300"
              checked={config.features.mobileQuickFilterChips !== false}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: { ...config.features, mobileQuickFilterChips: event.target.checked },
                })
              }
            />
            <div>
              <span className="font-medium">Enable mobile quick chips</span>
              <p className="text-xs text-gray-500">
                Default: on. Compact Type/Gender chip rows on mobile schedule.
              </p>
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="text-sm font-medium text-gray-900">Table columns</div>
        <p className="mt-1 text-xs text-gray-500">Controls which columns appear in schedule table view. Default: all columns.</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          {TABLE_COLUMNS.map((column) => (
            <label key={column.id} className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                className="rounded border-gray-300"
                checked={activeTableColumns?.includes(column.id) ?? false}
                onChange={(event) => {
                  if (!activeTableColumns) {
                    return;
                  }
                  if (event.target.checked) {
                    updateTableColumns([...activeTableColumns, column.id]);
                  } else {
                    updateTableColumns(activeTableColumns.filter((id) => id !== column.id));
                  }
                }}
              />
              <span>{column.label}</span>
            </label>
          ))}
        </div>
        <label className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3 text-sm text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={config.features.allowTableViewOnMobile || false}
            onChange={(event) =>
              setConfig({
                ...config,
                features: { ...config.features, allowTableViewOnMobile: event.target.checked },
              })
            }
          />
          <div>
            <span className="font-medium">Allow table view on mobile</span>
            <p className="text-xs text-gray-500">
              Default: off. Enable for compact tables that fit on small screens.
            </p>
          </div>
        </label>
        <label className="mt-3 flex items-center gap-2 border-t border-gray-200 pt-3 text-sm text-gray-700">
          <input
            type="checkbox"
            className="rounded border-gray-300"
            checked={config.features.showScheduleTableDateFilters === true}
            onChange={(event) =>
              setConfig({
                ...config,
                features: { ...config.features, showScheduleTableDateFilters: event.target.checked },
              })
            }
          />
          <div>
            <span className="font-medium">Show schedule table date &amp; weekday filters</span>
            <p className="text-xs text-gray-500">Default: off. Adds date range and weekday chips above the grid.</p>
          </div>
        </label>
      </div>

      <div>
        <h3 className="mb-1 font-semibold text-gray-900">Visitor filters</h3>
        <p className="mb-4 text-sm text-gray-600">
          Choose which filter dimensions visitors can use on this page.
        </p>
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
      </div>

      <div className="rounded-lg border border-gray-200 p-4">
        <label className="block text-sm font-medium text-gray-900">Space column label (optional)</label>
        <p className="mb-2 mt-0.5 text-xs text-gray-500">
          Shown on the schedule table header and space filter when Space is enabled. Default:
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
