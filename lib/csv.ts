/**
 * CSV building and browser download.
 *
 * Single home for the CSV rules used by every export in the app (schedule,
 * form responses, rosters). Quoting and line endings follow RFC 4180: a field
 * is quoted only when it contains a quote, comma, CR or LF, embedded quotes
 * are doubled, and records are separated by CRLF.
 */

/** Quote a single field, only when it actually needs it. */
export function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
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
