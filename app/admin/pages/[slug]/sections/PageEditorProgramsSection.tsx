'use client';

import { ArrowDown, ArrowUp } from 'lucide-react';
import type { ProgramSortMode, ProgramType, SessionCardPriceMode } from '@/types';
import { resolveProgramTypeOrder } from '@/lib/program-sort';
import { getProgramTypeLabel } from '@/lib/utils';
import {
  ALL_FILTERS,
  TABLE_COLUMNS,
  type IPageConfig,
  type IPageEditorProgramsSectionProps,
} from '../page-config-types';
import { SurfaceBadge } from '../components/SurfaceBadge';

type PageFeatures = IPageConfig['features'];

/**
 * Boolean feature toggle. `defaultOn` flags are stored as `false` to turn off
 * (unset = on); `fallbackKey` flags inherit a legacy master switch when unset.
 */
interface IFeatureCheckboxOption {
  key: keyof PageFeatures;
  label: string;
  hint?: string;
  defaultOn?: boolean;
  fallbackKey?: keyof PageFeatures;
}

const PROGRAM_CARD_OPTIONS: ReadonlyArray<IFeatureCheckboxOption> = [
  {
    key: 'showPricing',
    label: 'Show pricing',
    hint: 'The program "From" price and every session price. Off hides all prices on the page.',
  },
  { key: 'alwaysShowDetailsButton', label: 'Keep Details button when pricing is hidden' },
  {
    key: 'programCardFullTitle',
    label: 'Show full program names',
    hint: 'Long names wrap instead of being clamped to two lines.',
  },
  { key: 'showFullProgramDescription', label: 'Add "Read more" to expand the program description' },
  {
    key: 'showAvailability',
    label: 'Show availability / spots remaining',
    hint: 'Also controls the availability badge on session cards.',
  },
  { key: 'showMembershipBadges', label: 'Show membership badges' },
  { key: 'showAgeGender', label: 'Show age and gender restrictions' },
];

const SESSION_CARD_OPTIONS: ReadonlyArray<IFeatureCheckboxOption> = [
  {
    key: 'sessionCardFullTitle',
    label: 'Show full session titles',
    hint: 'Wrap long titles instead of cutting them off on one line (most visible on mobile).',
  },
  {
    key: 'sessionCardShowAgeRange',
    label: 'Show age range',
    hint: "The session's age range (falls back to the program's). Default off.",
  },
  {
    key: 'sessionCardShowFacility',
    label: 'Show facility',
    hint: 'Default on.',
    defaultOn: true,
  },
  {
    key: 'showSessionShortDescription',
    label: 'Show session short description',
    fallbackKey: 'showSessionDescriptions',
  },
  {
    key: 'showSessionLongDescription',
    label: 'Show session long description',
    hint: 'Clamped to 4 lines with a View more toggle.',
    fallbackKey: 'showSessionDescriptions',
  },
];

const PAGE_OPTIONS: ReadonlyArray<IFeatureCheckboxOption> = [
  { key: 'showSearch', label: 'Show search bar', defaultOn: true },
  { key: 'showShareButton', label: 'Show share / copy link button', defaultOn: true },
  { key: 'showRegisterIcon', label: 'Show icon on Register buttons', defaultOn: true },
  { key: 'allowViewToggle', label: 'Allow switching between Programs and Schedule view' },
  { key: 'showTableView', label: 'Show Table view option on desktop' },
  {
    key: 'showWaitlist',
    label: 'Show waitlist badges and Join Waitlist button on schedule',
    defaultOn: true,
  },
  {
    key: 'showScheduleEventType',
    label: 'Show event type tag on schedule (e.g. Drop-in, Class)',
    defaultOn: true,
  },
];

const PROGRAM_SORT_OPTIONS: ReadonlyArray<{ value: ProgramSortMode; label: string }> = [
  { value: 'default', label: 'Default (Bond order)' },
  { value: 'start_date_asc', label: 'Start date — soonest first' },
  { value: 'start_date_desc', label: 'Start date — latest first' },
  { value: 'name_asc', label: 'Name — A to Z' },
  { value: 'name_desc', label: 'Name — Z to A' },
  { value: 'program_type', label: 'Program type — custom order' },
];

const SESSION_CARD_PRICE_OPTIONS: ReadonlyArray<{ value: SessionCardPriceMode; label: string }> = [
  { value: 'default', label: 'Default — price only when the session has one pricing option' },
  { value: 'hidden', label: 'Hide price on session card' },
  { value: 'range', label: 'Full price range (e.g. $50 – $120)' },
  { value: 'max', label: 'Maximum price' },
  { value: 'min', label: 'Minimum price' },
  { value: 'range_excluding_free', label: 'Price range, excluding $0 options' },
  { value: 'min_excluding_free', label: 'Minimum price, excluding $0 options' },
];

function resolveFeatureChecked(
  features: PageFeatures,
  option: IFeatureCheckboxOption,
): boolean {
  const value = features[option.key];
  if (option.defaultOn) {
    return value !== false;
  }
  if (option.fallbackKey) {
    return Boolean(value ?? features[option.fallbackKey]);
  }
  return Boolean(value);
}

function FeatureCheckbox({
  option,
  checked,
  onChange,
}: {
  option: IFeatureCheckboxOption;
  checked: boolean;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className="flex items-start gap-3">
      <input
        type="checkbox"
        className="mt-1 rounded border-gray-300"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span>
        <span className={option.hint ? 'font-medium' : undefined}>{option.label}</span>
        {option.hint && <p className="mt-0.5 text-xs text-gray-500">{option.hint}</p>}
      </span>
    </label>
  );
}

function ProgramTypeOrderEditor({
  order,
  onChange,
}: {
  order: ProgramType[];
  onChange: (next: ProgramType[]) => void;
}) {
  const move = (index: number, delta: -1 | 1) => {
    const target = index + delta;
    if (target < 0 || target >= order.length) return;
    const next = [...order];
    [next[index], next[target]] = [next[target], next[index]];
    onChange(next);
  };

  return (
    <div className="ml-7 rounded-lg border border-gray-200 bg-gray-50 p-3">
      <p className="text-sm font-medium text-gray-900">Program type order</p>
      <p className="mb-2 mt-0.5 text-xs text-gray-500">
        Programs are grouped by type in this order. Within a type they keep Bond&apos;s order.
        Programs without a type go last.
      </p>
      <ol className="space-y-1" data-testid="program-type-order">
        {order.map((type, index) => (
          <li
            key={type}
            className="flex items-center justify-between gap-2 rounded-md bg-white px-3 py-1.5 text-sm text-gray-800 ring-1 ring-gray-200"
          >
            <span>
              <span className="mr-2 text-xs tabular-nums text-gray-400">{index + 1}.</span>
              {getProgramTypeLabel(type)}
            </span>
            <span className="flex gap-1">
              <button
                type="button"
                className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                aria-label={`Move ${getProgramTypeLabel(type)} up`}
                disabled={index === 0}
                onClick={() => move(index, -1)}
              >
                <ArrowUp size={14} />
              </button>
              <button
                type="button"
                className="rounded p-1 text-gray-500 hover:bg-gray-100 disabled:opacity-30"
                aria-label={`Move ${getProgramTypeLabel(type)} down`}
                disabled={index === order.length - 1}
                onClick={() => move(index, 1)}
              >
                <ArrowDown size={14} />
              </button>
            </span>
          </li>
        ))}
      </ol>
    </div>
  );
}

export function PageEditorProgramsSection({
  config,
  setConfig,
  activeTableColumns,
  updateTableColumns,
}: IPageEditorProgramsSectionProps) {
  const enabledTabs = config.features.enabledTabs || ['programs', 'schedule'];

  const setFeature = <K extends keyof PageFeatures>(key: K, value: PageFeatures[K]) =>
    setConfig({ ...config, features: { ...config.features, [key]: value } });

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
        <h3 className="mb-1 font-semibold text-gray-900">Program cards</h3>
        <p className="mb-4 text-sm text-gray-600">
          The cards on the Programs tab. Defaults match how pages render today.
        </p>
        <div className="space-y-3">
          {PROGRAM_CARD_OPTIONS.map((option) => (
            <FeatureCheckbox
              key={option.key}
              option={option}
              checked={resolveFeatureChecked(config.features, option)}
              onChange={(checked) => setFeature(option.key, checked)}
            />
          ))}

          <label className="block pt-2 text-sm text-gray-700">
            <span className="font-medium">Program order</span>
            <select
              className="input mt-1"
              value={config.features.programSort || 'default'}
              onChange={(event) => setFeature('programSort', event.target.value as ProgramSortMode)}
            >
              {PROGRAM_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-xs text-gray-500">
              Default keeps Bond&apos;s order (alphabetical in practice). Start date uses each
              program&apos;s earliest session that hasn&apos;t ended; programs with no dates sort last.
            </p>
          </label>

          {config.features.programSort === 'program_type' && (
            <ProgramTypeOrderEditor
              order={resolveProgramTypeOrder(config.features.programTypeOrder)}
              onChange={(next) => setFeature('programTypeOrder', next)}
            />
          )}

          <label className="block pt-2 text-sm text-gray-700">
            Program details button label
            <input
              type="text"
              className="input mt-1"
              value={config.features.programCtaLabel || ''}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    programCtaLabel: event.target.value.trim() ? event.target.value : undefined,
                  },
                })
              }
              placeholder="View Program & Register"
            />
            <p className="mt-0.5 text-xs text-gray-500">
              Bottom button in expanded program details. Empty = default (&quot;View Program&quot; when
              registration is closed). A custom label is used in both states.
            </p>
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-1 font-semibold text-gray-900">Session cards</h3>
        <p className="mb-4 text-sm text-gray-600">
          The session rows shown after a visitor expands a program&apos;s Details.
        </p>
        <div className="space-y-3">
          {SESSION_CARD_OPTIONS.map((option) => (
            <FeatureCheckbox
              key={option.key}
              option={option}
              checked={resolveFeatureChecked(config.features, option)}
              onChange={(checked) => setFeature(option.key, checked)}
            />
          ))}

          <label className="block pt-2 text-sm text-gray-700">
            <span className="font-medium">Session card price</span>
            <select
              className="input mt-1"
              value={config.features.sessionCardPriceMode || 'default'}
              disabled={!config.features.showPricing}
              onChange={(event) =>
                setFeature('sessionCardPriceMode', event.target.value as SessionCardPriceMode)
              }
            >
              {SESSION_CARD_PRICE_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="mt-0.5 text-xs text-gray-500">
              The price shown next to Register on each session card. Summaries use the
              session&apos;s public (non-member) pricing options. The &quot;Pricing&quot; toggle that
              lists every option is unaffected.
              {!config.features.showPricing && ' Turn on Show pricing above to enable.'}
            </p>
          </label>
        </div>
      </div>

      <div>
        <h3 className="mb-1 font-semibold text-gray-900">Page &amp; schedule options</h3>
        <p className="mb-4 text-sm text-gray-600">Header controls, view switching, and schedule tab display.</p>
        <div className="space-y-3">
          {PAGE_OPTIONS.map((option) => (
            <FeatureCheckbox
              key={option.key}
              option={option}
              checked={resolveFeatureChecked(config.features, option)}
              onChange={(checked) => setFeature(option.key, checked)}
            />
          ))}

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

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300"
              checked={config.features.showLeagueStandingsLink || false}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    showLeagueStandingsLink: event.target.checked,
                  },
                })
              }
            />
            <span>
              <span className="font-medium">Show league standings link</span>
              <p className="mt-0.5 text-xs text-gray-500">
                League events in the schedule get a Standings link that opens the Bond season
                standings page, next to Register.
              </p>
            </span>
          </label>

          <label className="flex items-start gap-3">
            <input
              type="checkbox"
              className="mt-1 rounded border-gray-300"
              checked={config.features.showRostersLink || false}
              onChange={(event) =>
                setConfig({
                  ...config,
                  features: {
                    ...config.features,
                    showRostersLink: event.target.checked,
                  },
                })
              }
            />
            <span>
              <span className="font-medium">Show team rosters link</span>
              <p className="mt-0.5 text-xs text-gray-500">
                League events get a Team rosters link pointing at a roster page. Only a link — no
                participant data enters this page.
              </p>
            </span>
          </label>

          {config.features.showRostersLink && (
            <label className="block pl-8">
              <span className="text-sm font-medium text-gray-700">Roster page slug</span>
              <input
                type="text"
                className="input mt-1"
                value={config.features.rostersPageSlug || ''}
                onChange={(event) =>
                  setConfig({
                    ...config,
                    features: {
                      ...config.features,
                      rostersPageSlug: event.target.value,
                    },
                  })
                }
                placeholder="e.g. coppermine"
              />
              <p className="mt-0.5 text-xs text-gray-500">
                The link is hidden until this names an existing roster page.
              </p>
            </label>
          )}

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
        <p className="mt-1 text-xs text-gray-500">
          Controls schedule table columns and, when the portal uses the V2 rows card style,
          session-level row columns (time and space are ignored at session level).
        </p>
        {config.features.portalTemplate === 'v2' && config.features.portalCardStyle === 'rows' && (
          <p className="mt-2 rounded-md border border-indigo-100 bg-indigo-50 px-3 py-2 text-xs text-indigo-900">
            Rows layout: uncheck Program when sessions are shown flat (e.g. Coppermine). Session
            name is always shown.
          </p>
        )}
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
