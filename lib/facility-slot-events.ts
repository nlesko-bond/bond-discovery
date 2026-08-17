/**
 * Shared marker for events sourced from the facility-schedule link
 * (lib/facility-schedule-link.ts). Client-safe.
 */
export const FACILITY_EVENT_ID_PREFIX = 'fsched-';

export function isFacilityScheduleEvent(eventId: string | undefined): boolean {
  return !!eventId && eventId.startsWith(FACILITY_EVENT_ID_PREFIX);
}
