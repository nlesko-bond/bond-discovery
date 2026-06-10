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
