import { format, parse } from 'date-fns';

export const MaintenanceDisplayModeEnum = {
  FLATTEN: 'flatten',
  BUNDLE: 'bundle',
} as const;

export type MaintenanceDisplayMode =
  (typeof MaintenanceDisplayModeEnum)[keyof typeof MaintenanceDisplayModeEnum];

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function formatTimeHm(hms: string): string {
  try {
    const d = parse(hms, 'HH:mm:ss', new Date());
    return format(d, 'h:mm a');
  } catch {
    return hms;
  }
}

interface ISlotCore {
  id: number;
  spaceId: number | null;
  parentSlotId: number | null;
  title: string;
  displayName: string | null;
  internalName: string | null;
  startDate: string;
  startTime: string;
  endTime: string;
  timezone: string | null;
  slotType: string;
  approvalStatus: string;
  productName: string;
  totalPrice: number | null;
}

function readString(value: unknown, fallback: string): string {
  return typeof value === 'string' ? value : fallback;
}

function readNumberOrNull(value: unknown): number | null {
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
}

function normalizeSlot(raw: Record<string, unknown>): ISlotCore {
  const product = raw.product;
  let productName = '';
  if (isRecord(product) && typeof product.name === 'string') {
    productName = product.name;
  }
  return {
    id: typeof raw.id === 'number' ? raw.id : 0,
    spaceId: readNumberOrNull(raw.spaceId),
    parentSlotId: readNumberOrNull(raw.parentSlotId),
    title: readString(raw.title, ''),
    displayName: typeof raw.displayName === 'string' ? raw.displayName : null,
    internalName: typeof raw.internalName === 'string' ? raw.internalName : null,
    startDate: readString(raw.startDate, ''),
    startTime: readString(raw.startTime, ''),
    endTime: readString(raw.endTime, ''),
    timezone: typeof raw.timezone === 'string' ? raw.timezone : null,
    slotType: readString(raw.slotType, ''),
    approvalStatus: readString(raw.approvalStatus, ''),
    productName,
    totalPrice: readNumberOrNull(raw.totalPrice),
  };
}

function collectSlotsDeep(reservation: Record<string, unknown>): ISlotCore[] {
  const byId = new Map<number, ISlotCore>();

  const visit = (node: unknown) => {
    if (!isRecord(node) || typeof node.id !== 'number') return;
    if (byId.has(node.id)) return;
    byId.set(node.id, normalizeSlot(node));
    const maintenance = node.maintenance;
    if (Array.isArray(maintenance)) {
      for (const m of maintenance) visit(m);
    }
  };

  const segments = reservation.segments;
  if (!Array.isArray(segments)) {
    return [...byId.values()];
  }

  for (const seg of segments) {
    if (!isRecord(seg)) continue;
    const series = seg.series;
    if (!Array.isArray(series)) continue;
    for (const ser of series) {
      if (!isRecord(ser)) continue;
      const slots = ser.slots;
      if (!Array.isArray(slots)) continue;
      for (const sl of slots) visit(sl);
    }
  }

  return [...byId.values()];
}

function spaceLabel(slot: ISlotCore, spaceNameBySpaceId: Record<number, string>): string {
  const named =
    slot.displayName?.trim() ||
    slot.internalName?.trim() ||
    (slot.spaceId != null ? spaceNameBySpaceId[slot.spaceId] : null);
  if (named) return named;
  if (slot.spaceId != null) return spaceNameBySpaceId[slot.spaceId] || `Space ${slot.spaceId}`;
  return '';
}

function timeRangeLabel(slot: ISlotCore): string {
  const a = formatTimeHm(slot.startTime);
  const b = formatTimeHm(slot.endTime);
  return b ? `${a} - ${b}` : a;
}

function maintenanceSummaryForParent(
  parentId: number,
  all: ISlotCore[],
  spaceNameBySpaceId: Record<number, string>,
): string {
  const children = all.filter((s) => s.parentSlotId === parentId && s.slotType === 'maintenance');
  if (!children.length) return '';
  return children
    .map((c) => {
      const t = timeRangeLabel(c);
      const sp = spaceLabel(c, spaceNameBySpaceId);
      const head = c.title || 'Maintenance';
      return sp ? `${c.startDate} ${t} — ${head} (${sp})` : `${c.startDate} ${t} — ${head}`;
    })
    .join(' | ');
}

function sortKey(slot: ISlotCore): string {
  return `${slot.startDate}T${slot.startTime}:${slot.id}`;
}

export interface IReservationScheduleRow {
  rowKey: string;
  date: string;
  dayLabel: string;
  timeLabel: string;
  facilityName: string;
  spaceName: string;
  slotType: string;
  approvalStatus: string;
  title: string;
  productName: string;
  quantityLabel: string;
  priceLabel: string;
  notes: string;
  maintenanceSummary: string;
  isMaintenance: boolean;
  sortKey: string;
}

function toRow(
  slot: ISlotCore,
  facilityName: string,
  spaceNameBySpaceId: Record<number, string>,
  maintenanceSummary: string,
): IReservationScheduleRow {
  let dayLabel = '';
  try {
    dayLabel = format(parse(slot.startDate, 'yyyy-MM-dd', new Date()), 'EEEE');
  } catch {
    dayLabel = '';
  }
  const priceLabel = slot.totalPrice != null ? `$${slot.totalPrice}` : '';
  return {
    rowKey: String(slot.id),
    date: slot.startDate,
    dayLabel,
    timeLabel: timeRangeLabel(slot),
    facilityName,
    spaceName: spaceLabel(slot, spaceNameBySpaceId),
    slotType: slot.slotType,
    approvalStatus: slot.approvalStatus,
    title: slot.title,
    productName: slot.productName,
    quantityLabel: '',
    priceLabel,
    notes: '',
    maintenanceSummary,
    isMaintenance: slot.slotType === 'maintenance',
    sortKey: sortKey(slot),
  };
}

export function buildReservationScheduleRows(
  reservation: unknown,
  facilityName: string,
  spaceNameBySpaceId: Record<number, string>,
  mode: MaintenanceDisplayMode,
): IReservationScheduleRow[] {
  if (!isRecord(reservation)) return [];
  const all = collectSlotsDeep(reservation);
  const primary = all.filter((s) => s.slotType !== 'maintenance' && s.parentSlotId === null);

  if (mode === MaintenanceDisplayModeEnum.BUNDLE) {
    const rows = primary.map((p) =>
      toRow(
        p,
        facilityName,
        spaceNameBySpaceId,
        maintenanceSummaryForParent(p.id, all, spaceNameBySpaceId),
      ),
    );
    return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  const maintenance = all.filter((s) => s.slotType === 'maintenance');
  const combined = [...primary, ...maintenance];
  const rows = combined.map((s) =>
    toRow(s, facilityName, spaceNameBySpaceId, ''),
  );
  return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function parseReservationRoot(data: unknown): Record<string, unknown> | null {
  return isRecord(data) ? data : null;
}
