import { format, parse } from 'date-fns';

export const MaintenanceDisplayModeEnum = {
  FLATTEN: 'flatten',
  BUNDLE: 'bundle',
  HIDE: 'hide',
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
  spaceNameDirect: string | null;
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

function readSpaceObject(raw: Record<string, unknown>): Record<string, unknown> | null {
  const s = raw.space ?? raw.Space;
  return isRecord(s) ? s : null;
}

function readSpaceNameFromSpaceObject(spaceObj: Record<string, unknown>): string | null {
  const n =
    spaceObj.name ??
    spaceObj.Name ??
    spaceObj.displayName ??
    spaceObj.DisplayName ??
    spaceObj.internalName ??
    spaceObj.InternalName;
  if (typeof n === 'string' && n.trim()) {
    return n.trim();
  }
  return null;
}

function readSpaceIdFromRaw(raw: Record<string, unknown>, spaceObj: Record<string, unknown> | null): number | null {
  let spaceId = readNumberOrNull(raw.spaceId);
  if (spaceId == null && typeof raw.spaceId === 'string' && /^\d+$/.test(raw.spaceId.trim())) {
    spaceId = Number(raw.spaceId.trim());
  }
  if (spaceObj) {
    const sid = spaceObj.id ?? spaceObj.Id;
    if (spaceId == null) {
      if (typeof sid === 'number') spaceId = sid;
      else if (typeof sid === 'string' && /^\d+$/.test(sid.trim())) spaceId = Number(sid.trim());
    }
  }
  return spaceId;
}

function normalizeSlot(raw: Record<string, unknown>): ISlotCore {
  const product = raw.product;
  let productName = '';
  if (isRecord(product) && typeof product.name === 'string') {
    productName = product.name;
  }
  const spaceObj = readSpaceObject(raw);
  const spaceId = readSpaceIdFromRaw(raw, spaceObj);
  let spaceNameDirect: string | null = null;
  if (spaceObj) {
    spaceNameDirect = readSpaceNameFromSpaceObject(spaceObj);
  }
  return {
    id: typeof raw.id === 'number' ? raw.id : 0,
    spaceId,
    spaceNameDirect,
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

function enrichSlotsWithSharedSpaceNames(slots: ISlotCore[]): ISlotCore[] {
  const idToName = new Map<number, string>();
  for (const s of slots) {
    if (s.spaceId != null && s.spaceNameDirect) {
      idToName.set(s.spaceId, s.spaceNameDirect);
    }
  }
  if (idToName.size === 0) {
    return slots;
  }
  return slots.map((s) => {
    if (s.spaceNameDirect) {
      return s;
    }
    if (s.spaceId == null) {
      return s;
    }
    const shared = idToName.get(s.spaceId);
    if (!shared) {
      return s;
    }
    return { ...s, spaceNameDirect: shared };
  });
}

function spaceLabel(slot: ISlotCore, spaceNameBySpaceId: Record<number, string>): string {
  if (slot.spaceNameDirect) return slot.spaceNameDirect;
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

export interface IReservationScheduleContext {
  reservationId: number;
  reservationName: string;
}

export interface IReservationScheduleRow {
  rowKey: string;
  reservationId: number;
  reservationName: string;
  date: string;
  dayLabel: string;
  timeLabel: string;
  startTimeRaw: string;
  endTimeRaw: string;
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
  spaceNameBySpaceId: Record<number, string>,
  maintenanceSummary: string,
  context: IReservationScheduleContext,
): IReservationScheduleRow {
  let dayLabel = '';
  try {
    dayLabel = format(parse(slot.startDate, 'yyyy-MM-dd', new Date()), 'EEEE');
  } catch {
    dayLabel = '';
  }
  const priceLabel = slot.totalPrice != null ? `$${slot.totalPrice}` : '';
  const endTimeRaw =
    typeof slot.endTime === 'string' && slot.endTime.trim() ? slot.endTime.trim() : slot.startTime;
  return {
    rowKey: `${context.reservationId}-${slot.id}`,
    reservationId: context.reservationId,
    reservationName: context.reservationName,
    date: slot.startDate,
    dayLabel,
    timeLabel: timeRangeLabel(slot),
    startTimeRaw: slot.startTime,
    endTimeRaw,
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
  spaceNameBySpaceId: Record<number, string>,
  mode: MaintenanceDisplayMode,
  context: IReservationScheduleContext,
): IReservationScheduleRow[] {
  if (!isRecord(reservation)) return [];
  const all = enrichSlotsWithSharedSpaceNames(collectSlotsDeep(reservation));
  const primary = all.filter((s) => s.slotType !== 'maintenance' && s.parentSlotId === null);

  if (mode === MaintenanceDisplayModeEnum.HIDE) {
    const rows = primary.map((p) => toRow(p, spaceNameBySpaceId, '', context));
    return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  if (mode === MaintenanceDisplayModeEnum.BUNDLE) {
    const rows = primary.map((p) =>
      toRow(
        p,
        spaceNameBySpaceId,
        maintenanceSummaryForParent(p.id, all, spaceNameBySpaceId),
        context,
      ),
    );
    return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
  }

  const maintenance = all.filter((s) => s.slotType === 'maintenance');
  const combined = [...primary, ...maintenance];
  const rows = combined.map((s) => toRow(s, spaceNameBySpaceId, '', context));
  return rows.sort((a, b) => a.sortKey.localeCompare(b.sortKey));
}

export function parseReservationRoot(data: unknown): Record<string, unknown> | null {
  return isRecord(data) ? data : null;
}
