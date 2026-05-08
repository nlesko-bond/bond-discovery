import { format, parse } from 'date-fns';
import {
  readSpaceDisplayNameFromReservationSlotRaw,
  readSpaceIdFromReservationSlotRaw,
} from '@/lib/reservation-slot-space';

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

function readSlotId(raw: Record<string, unknown>): number {
  if (typeof raw.id === 'number' && Number.isFinite(raw.id)) {
    return raw.id;
  }
  if (typeof raw.id === 'string' && /^\d+$/.test(raw.id.trim())) {
    return Number(raw.id.trim());
  }
  return 0;
}

function readParentSlotId(raw: Record<string, unknown>): number | null {
  const p = raw.parentSlotId ?? raw.ParentSlotId;
  if (typeof p === 'number' && Number.isFinite(p)) {
    return p;
  }
  if (typeof p === 'string' && /^\d+$/.test(p.trim())) {
    return Number(p.trim());
  }
  return null;
}

function readApprovalStatus(raw: Record<string, unknown>): string {
  const v =
    raw.approvalStatus ??
    raw.ApprovalStatus ??
    raw.slotApprovalStatus ??
    raw.SlotApprovalStatus;
  return typeof v === 'string' ? v : '';
}

function normalizeSlot(raw: Record<string, unknown>): ISlotCore {
  const product = raw.product ?? raw.Product;
  let productName = '';
  if (isRecord(product) && typeof product.name === 'string') {
    productName = product.name;
  } else if (isRecord(product) && typeof product.Name === 'string') {
    productName = product.Name;
  }
  const spaceId = readSpaceIdFromReservationSlotRaw(raw);
  const spaceNameDirect = readSpaceDisplayNameFromReservationSlotRaw(raw);
  const slotId = readSlotId(raw);
  return {
    id: slotId,
    spaceId,
    spaceNameDirect,
    parentSlotId: readParentSlotId(raw),
    title: readString(raw.title ?? raw.Title, ''),
    displayName:
      typeof raw.displayName === 'string'
        ? raw.displayName
        : typeof raw.DisplayName === 'string'
          ? raw.DisplayName
          : null,
    internalName:
      typeof raw.internalName === 'string'
        ? raw.internalName
        : typeof raw.InternalName === 'string'
          ? raw.InternalName
          : null,
    startDate: readString(raw.startDate ?? raw.StartDate, ''),
    startTime: readString(raw.startTime ?? raw.StartTime, ''),
    endTime: readString(raw.endTime ?? raw.EndTime, ''),
    timezone: typeof raw.timezone === 'string' ? raw.timezone : null,
    slotType: readString(raw.slotType ?? raw.SlotType, ''),
    approvalStatus: readApprovalStatus(raw),
    productName,
    totalPrice: readNumberOrNull(raw.totalPrice ?? raw.TotalPrice),
  };
}

const SLOT_TRAVERSE_KEYS = ['segments', 'series', 'slots', 'maintenance', 'data'] as const;

function isSlotLikeNode(node: Record<string, unknown>): boolean {
  const id = readSlotId(node);
  if (id === 0) {
    return false;
  }
  const slotType = node.slotType ?? node.SlotType;
  const hasSlotType = typeof slotType === 'string' && slotType.length > 0;
  return (
    typeof node.startDate === 'string' ||
    typeof node.StartDate === 'string' ||
    typeof node.startTime === 'string' ||
    typeof node.StartTime === 'string' ||
    hasSlotType
  );
}

function collectSlotsDeep(reservation: Record<string, unknown>): ISlotCore[] {
  const byId = new Map<number, ISlotCore>();

  const visit = (node: unknown) => {
    if (!isRecord(node)) return;
    if (isSlotLikeNode(node)) {
      const id = readSlotId(node);
      if (id !== 0 && !byId.has(id)) {
        byId.set(id, normalizeSlot(node));
      }
    }
    for (const key of SLOT_TRAVERSE_KEYS) {
      const arr = node[key];
      if (Array.isArray(arr)) {
        for (const item of arr) visit(item);
      }
    }
  };

  visit(reservation);
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
