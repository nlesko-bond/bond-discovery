'use client';

import { TABLE_COLUMNS, type IPageEditorProgramsSectionProps } from '../page-config-types';
import { SurfaceBadge } from '../components/SurfaceBadge';

export function PageEditorProgramsSection({
  config,
  setConfig,
  activeTableColumns,
  updateTableColumns,
}: IPageEditorProgramsSectionProps) {
  const enabledTabs = config.features.enabledTabs || ['programs', 'schedule'];

  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-lg font-semibold text-gray-900">Programs &amp; schedule</h2>
        <p className="mt-1 text-sm text-gray-600">
          Tabs, default views, card/schedule display, and table options.
        </p>
        <div className="mt-3">
          <SurfaceBadge surfaces={['Public', 'Embed', 'Portal']} />
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
            <option value="list">List</option>
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
            <option value="list">List</option>
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
              <p className="text-xs text-gray-500">Compact Type/Gender chip rows on mobile schedule</p>
            </div>
          </label>
        </div>
      </div>

      <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
        <div className="text-sm font-medium text-gray-900">Table columns</div>
        <p className="mt-1 text-xs text-gray-500">Controls which columns appear in schedule table view.</p>
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
            <p className="text-xs text-gray-500">Enable for compact tables that fit on small screens</p>
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
            <p className="text-xs text-gray-500">Off by default. Adds date range and weekday chips above the grid.</p>
          </div>
        </label>
      </div>
    </div>
  );
}
