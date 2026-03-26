/** Local calendar helpers for staff date inputs (aligns with server max-span cap). */

export function ymdFromLocalNoon(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function parseLocalYmd(ymd: string): Date | null {
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(ymd.trim());
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]) - 1;
  const d = Number(m[3]);
  const dt = new Date(y, mo, d, 12, 0, 0, 0);
  return Number.isNaN(dt.getTime()) ? null : dt;
}

export function clampYmdRangeToMaxSpan(
  fromYmd: string,
  toYmd: string,
  capDays: number
): { fromYmd: string; toYmd: string } {
  const cap = Math.min(Math.max(capDays, 1), 365);
  let start = parseLocalYmd(fromYmd);
  let end = parseLocalYmd(toYmd);
  if (!start || !end) return { fromYmd, toYmd };
  if (start > end) {
    const t = start;
    start = end;
    end = t;
  }
  const maxMs = cap * 86400000;
  if (end.getTime() - start.getTime() > maxMs) {
    start = new Date(end.getTime() - maxMs);
  }
  return { fromYmd: ymdFromLocalNoon(start), toYmd: ymdFromLocalNoon(end) };
}

export function minFromYmdForTo(toYmd: string, capDays: number): string | undefined {
  const end = parseLocalYmd(toYmd);
  if (!end) return undefined;
  const cap = Math.min(Math.max(capDays, 1), 365);
  const start = new Date(end.getTime() - cap * 86400000);
  return ymdFromLocalNoon(start);
}

export function todayLocalYmd(): string {
  return ymdFromLocalNoon(new Date());
}

export function maxToYmdForFrom(fromYmd: string, capDays: number): string {
  const start = parseLocalYmd(fromYmd);
  const cap = Math.min(Math.max(capDays, 1), 365);
  const today = parseLocalYmd(todayLocalYmd())!;
  if (!start) return ymdFromLocalNoon(today);
  const spanEnd = new Date(start.getTime() + cap * 86400000);
  const max = spanEnd.getTime() > today.getTime() ? today : spanEnd;
  return ymdFromLocalNoon(max);
}
