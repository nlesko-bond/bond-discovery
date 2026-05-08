const MAILTO_SAFE_BODY_UTF8_LENGTH = 3800;

export interface ISchedulePlainColumn {
  key: string;
  label: string;
}

/**
 * Builds a tab-separated plain-text grid for email bodies and similar.
 */
export function buildSchedulePlainTextTable(
  rows: unknown[],
  columns: ISchedulePlainColumn[],
  getCell: (row: unknown, key: string) => string,
): string {
  const header = columns.map((c) => c.label).join('\t');
  const dataLines = rows.map((row) =>
    columns
      .map((c) => getCell(row, c.key).replace(/\r?\n/g, ' ').replace(/\t/g, ' '))
      .join('\t'),
  );
  return [header, ...dataLines].join('\n');
}

export interface IBuildMailtoScheduleBodyParams {
  greetingName: string;
  introLine: string;
  rows: unknown[];
  columns: ISchedulePlainColumn[];
  getCell: (row: unknown, key: string) => string;
  footerThanksLine: string;
}

/**
 * Builds a mailto-safe body: truncates the table if the encoded URL would exceed typical client limits.
 */
export function buildMailtoScheduleBody(params: IBuildMailtoScheduleBodyParams): string {
  const tableFull = buildSchedulePlainTextTable(params.rows, params.columns, params.getCell);
  const base = [
    `Hi ${params.greetingName},`,
    '',
    params.introLine,
    '',
    tableFull,
    '',
    params.footerThanksLine,
  ].join('\n');
  if (base.length <= MAILTO_SAFE_BODY_UTF8_LENGTH) {
    return base;
  }
  let kept = params.rows.length;
  while (kept > 0) {
    const slice = params.rows.slice(0, kept);
    const partialTable = buildSchedulePlainTextTable(slice, params.columns, params.getCell);
    const omitted = params.rows.length - kept;
    const truncationLines = omitted > 0 ? ['', `${omitted} row(s) omitted.`] : [''];
    const body = [
      `Hi ${params.greetingName},`,
      '',
      params.introLine,
      '',
      partialTable,
      ...truncationLines,
      '',
      params.footerThanksLine,
    ].join('\n');
    if (body.length <= MAILTO_SAFE_BODY_UTF8_LENGTH) {
      return body;
    }
    kept -= 1;
  }
  return [
    `Hi ${params.greetingName},`,
    '',
    params.introLine,
    '',
    'Schedule omitted (too long for this message).',
    '',
    params.footerThanksLine,
  ].join('\n');
}
