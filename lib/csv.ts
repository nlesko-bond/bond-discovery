/**
 * CSV building and browser download.
 *
 * Single home for the CSV rules used by every export in the app (schedule,
 * form responses, rosters). Quoting and line endings follow RFC 4180: a field
 * is quoted only when it contains a quote, comma, CR or LF, embedded quotes
 * are doubled, and records are separated by CRLF.
 */

/**
 * Cells Excel and Sheets would evaluate as a formula rather than display.
 *
 * Export values come from participant records — names, team names, product
 * names — which are supplied at registration by people outside the org, and
 * the file's whole purpose is to be opened in a spreadsheet on a staff machine.
 */
const FORMULA_PREFIX = /^[=+\-@\t\r]/;

/**
 * Quote a single field, only when it actually needs it, and neutralize
 * spreadsheet formula injection by prefixing an apostrophe.
 */
export function csvEscape(value: string): string {
  const safe = FORMULA_PREFIX.test(value) ? `'${value}` : value;
  if (/[",\n\r]/.test(safe)) {
    return `"${safe.replace(/"/g, '""')}"`;
  }
  return safe;
}

export type CsvCell = string | number | null | undefined;

/** Render a header row plus body rows as an RFC 4180 document. */
export function toCsv(headers: string[], rows: CsvCell[][]): string {
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    lines.push(row.map((cell) => csvEscape(cell == null ? '' : String(cell))).join(','));
  }
  return lines.join('\r\n');
}

/**
 * Hand a CSV string to the browser as a file download. No-op outside the
 * browser so callers can live in components that also render on the server.
 */
export function downloadCsv(filename: string, csv: string): void {
  if (typeof document === 'undefined') return;

  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
