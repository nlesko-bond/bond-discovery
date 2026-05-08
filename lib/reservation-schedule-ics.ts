import { addMilliseconds, format, parse } from 'date-fns';

import type { IReservationScheduleRow } from '@/lib/reservation-schedule-transform';

const DEFAULT_EVENT_DURATION_MS = 60 * 60 * 1000;

function icsUtcStamp(date: Date): string {
  const y = date.getUTCFullYear();
  const mo = String(date.getUTCMonth() + 1).padStart(2, '0');
  const d = String(date.getUTCDate()).padStart(2, '0');
  const h = String(date.getUTCHours()).padStart(2, '0');
  const mi = String(date.getUTCMinutes()).padStart(2, '0');
  const s = String(date.getUTCSeconds()).padStart(2, '0');
  return `${y}${mo}${d}T${h}${mi}${s}Z`;
}

function escapeIcsText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

function toIcsLocalDateTime(dateYmd: string, timeHms: string): string {
  const ymd = dateYmd.replace(/-/g, '');
  const parts = timeHms.trim().split(':');
  const h = (parts[0] ?? '00').padStart(2, '0').slice(0, 2);
  const m = (parts[1] ?? '00').padStart(2, '0').slice(0, 2);
  const s = (parts[2] ?? '00').padStart(2, '0').slice(0, 2);
  return `${ymd}T${h}${m}${s}`;
}

function endTimeHmsForEvent(startDate: string, startHms: string, endHms: string): string {
  const endTrim = endHms.trim();
  if (endTrim && endTrim !== startHms.trim()) {
    return endTrim;
  }
  try {
    const d = parse(`${startDate} ${startHms}`, 'yyyy-MM-dd HH:mm:ss', new Date());
    return format(addMilliseconds(d, DEFAULT_EVENT_DURATION_MS), 'HH:mm:ss');
  } catch {
    return startHms;
  }
}

/**
 * Builds an iCalendar document (VCALENDAR) from schedule rows. Uses floating local times (no TZID).
 */
export function buildReservationScheduleIcs(
  rows: IReservationScheduleRow[],
  calendarTitle: string,
): string {
  const lines: string[] = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Bond Discovery//Reservation Schedule//EN',
    'CALSCALE:GREGORIAN',
    `X-WR-CALNAME:${escapeIcsText(calendarTitle)}`,
  ];
  const stamp = icsUtcStamp(new Date());
  for (const row of rows) {
    const endHms = endTimeHmsForEvent(row.date, row.startTimeRaw, row.endTimeRaw);
    const dtStart = toIcsLocalDateTime(row.date, row.startTimeRaw);
    const dtEnd = toIcsLocalDateTime(row.date, endHms);
    const summary =
      [row.title, row.spaceName].filter((x) => Boolean(x && String(x).trim())).join(' — ') ||
      'Rental slot';
    const descParts = [
      `Reservation: ${row.reservationName} (#${row.reservationId})`,
      row.productName ? `Product: ${row.productName}` : '',
      row.timeLabel ? `When: ${row.timeLabel}` : '',
    ].filter((x) => Boolean(x && String(x).trim()));
    const uidSafe = `res-${row.reservationId}-slot-${row.rowKey}`.replace(/[^a-zA-Z0-9-]/g, '');
    lines.push(
      'BEGIN:VEVENT',
      `UID:${uidSafe}@bond-discovery.local`,
      `DTSTAMP:${stamp}`,
      `DTSTART:${dtStart}`,
      `DTEND:${dtEnd}`,
      `SUMMARY:${escapeIcsText(summary)}`,
      `DESCRIPTION:${escapeIcsText(descParts.join('\n'))}`,
      'END:VEVENT',
    );
  }
  lines.push('END:VCALENDAR');
  return lines.join('\r\n');
}
