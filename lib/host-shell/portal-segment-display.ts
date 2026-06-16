import type { IHostPortalSegmentRow } from '@/lib/host-shell/session-card-model';
import type { PortalSegmentAvailabilityKindEnum } from '@/lib/host-shell/portal-segment-availability';
import { cn } from '@/lib/utils';

export function buildPortalSegmentDetailLine(segment: IHostPortalSegmentRow): string {
  const detailParts = [segment.dateRange, segment.spaceName].filter((part): part is string =>
    Boolean(part && part.trim()),
  );
  return detailParts.join(' · ');
}

export function resolvePortalSegmentScheduleLabel(segment: IHostPortalSegmentRow): string {
  return segment.scheduleLabel ?? segment.name;
}

const AVAILABILITY_PILL_CLASS: Record<PortalSegmentAvailabilityKindEnum, string> = {
  open: 'bg-green-100 text-green-800',
  almost_full: 'bg-amber-100 text-amber-900',
  full: 'bg-gray-100 text-gray-600',
  waitlist: 'bg-violet-100 text-violet-800',
  closed: 'bg-gray-100 text-gray-600',
  coming_soon: 'bg-blue-100 text-blue-700',
};

export function portalSegmentAvailabilityPillClassName(
  kind: PortalSegmentAvailabilityKindEnum | string | undefined,
): string {
  if (kind && kind in AVAILABILITY_PILL_CLASS) {
    return AVAILABILITY_PILL_CLASS[kind as PortalSegmentAvailabilityKindEnum];
  }
  return AVAILABILITY_PILL_CLASS.open;
}

export function portalSegmentAvailabilityLabel(
  segment: IHostPortalSegmentRow,
): string | undefined {
  return segment.availabilityLabel;
}

export function portalSegmentAvailabilityPillClasses(
  segment: IHostPortalSegmentRow,
  className?: string,
): string {
  return cn(
    'inline-flex shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium',
    portalSegmentAvailabilityPillClassName(segment.availabilityKind),
    className,
  );
}
