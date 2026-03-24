import type { FormPageConfig } from '@/types/form-pages';

export function parseFormResponsesDateRange(
  searchParams: URLSearchParams,
  config: FormPageConfig
): { from: Date; to: Date } {
  const capDays = Math.min(Math.max(config.max_range_days_cap || 90, 1), 365);
  const defaultDays = Math.min(Math.max(config.default_range_days || 60, 1), capDays);

  const toParam = searchParams.get('to');
  const fromParam = searchParams.get('from');
  let end = toParam ? new Date(toParam) : new Date();
  let start = fromParam ? new Date(fromParam) : new Date(end.getTime() - defaultDays * 86400000);

  if (Number.isNaN(end.getTime())) throw new Error('Invalid `to` date');
  if (Number.isNaN(start.getTime())) throw new Error('Invalid `from` date');

  if (start > end) {
    const tmp = start;
    start = end;
    end = tmp;
  }

  const maxMs = capDays * 86400000;
  if (end.getTime() - start.getTime() > maxMs) {
    start = new Date(end.getTime() - maxMs);
  }
  return { from: start, to: end };
}

export function parseTitleCursor(
  searchParams: URLSearchParams
): { createdAt: string; id: number } | null {
  const ca = searchParams.get('cursorCreatedAt');
  const id = searchParams.get('cursorId');
  if (!ca || !id) return null;
  const num = parseInt(id, 10);
  if (Number.isNaN(num)) return null;
  return { createdAt: ca, id: num };
}
