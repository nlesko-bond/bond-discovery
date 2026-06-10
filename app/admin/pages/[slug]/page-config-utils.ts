import { TABLE_COLUMNS, type IPageConfig } from './page-config-types';

export function parseCommaSeparatedIds(value: string): string[] {
  return value.split(',').map((item) => item.trim()).filter(Boolean);
}

export function parseOriginsList(value: string): string[] {
  const parts = value.split(/[\n,]+/).map((item) => item.trim()).filter(Boolean);
  return [...new Set(parts)];
}

export function getDefaultTableColumnIds(): Array<(typeof TABLE_COLUMNS)[number]['id']> {
  return TABLE_COLUMNS.map((column) => column.id);
}

export function getActiveTableColumns(
  config: IPageConfig,
): NonNullable<IPageConfig['features']['tableColumns']> {
  const defaultTableColumns = getDefaultTableColumnIds();
  if (config.features.tableColumns && config.features.tableColumns.length > 0) {
    return config.features.tableColumns;
  }
  return defaultTableColumns;
}

/**
 * "Last warmed: X ago" formatting for the cache status indicator.
 * Accepts a ms-epoch number or ISO string; returns null for missing/invalid
 * input so callers can render "unknown" gracefully.
 */
export function formatRelativeTime(value: number | string | null | undefined, now = Date.now()): string | null {
  if (value === null || value === undefined || value === '') {
    return null;
  }
  const timestamp = typeof value === 'number' ? value : Date.parse(value);
  if (!Number.isFinite(timestamp)) {
    return null;
  }
  const deltaMs = now - timestamp;
  if (deltaMs < 0) {
    return 'just now';
  }
  const minutes = Math.floor(deltaMs / 60_000);
  if (minutes < 1) {
    return 'just now';
  }
  if (minutes < 60) {
    return `${minutes} minute${minutes === 1 ? '' : 's'} ago`;
  }
  const hours = Math.floor(minutes / 60);
  if (hours < 24) {
    return `${hours} hour${hours === 1 ? '' : 's'} ago`;
  }
  const days = Math.floor(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

export function buildNextTableColumns(
  config: IPageConfig,
  nextColumns: NonNullable<IPageConfig['features']['tableColumns']>,
): IPageConfig {
  const defaultTableColumns = getDefaultTableColumnIds();
  const orderedColumns = defaultTableColumns.filter((columnId) => nextColumns.includes(columnId));
  return {
    ...config,
    features: { ...config.features, tableColumns: orderedColumns },
  };
}
