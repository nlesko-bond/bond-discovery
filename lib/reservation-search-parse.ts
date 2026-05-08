function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

export interface IReservationSearchHit {
  id: number;
  name: string;
  customerLabel: string;
  approvalStatus: string;
  paymentStatus: string;
}

export interface IReservationSearchMeta {
  totalItems: number;
  currentPage: number;
  totalPages: number;
  itemsPerPage: number;
}

function parseHit(item: unknown): IReservationSearchHit | null {
  if (!isRecord(item) || typeof item.id !== 'number') return null;
  const name = typeof item.name === 'string' ? item.name : '';
  const approvalStatus = typeof item.approvalStatus === 'string' ? item.approvalStatus : '';
  const paymentStatus = typeof item.paymentStatus === 'string' ? item.paymentStatus : '';
  let customerLabel = '';
  const c = item.customer;
  if (isRecord(c)) {
    const email = typeof c.email === 'string' ? c.email : '';
    const fullName = typeof c.name === 'string' ? c.name : '';
    const first = typeof c.firstName === 'string' ? c.firstName : '';
    const last = typeof c.lastName === 'string' ? c.lastName : '';
    const namePart = fullName || `${first} ${last}`.trim();
    customerLabel = [namePart, email].filter(Boolean).join(' · ');
  }
  return { id: item.id, name, customerLabel, approvalStatus, paymentStatus };
}

export function parseReservationSearchResponse(payload: unknown): {
  hits: IReservationSearchHit[];
  meta: IReservationSearchMeta;
} {
  if (!isRecord(payload)) {
    return {
      hits: [],
      meta: { totalItems: 0, currentPage: 1, totalPages: 1, itemsPerPage: 0 },
    };
  }
  const rawData = payload.data;
  const hits: IReservationSearchHit[] = [];
  if (Array.isArray(rawData)) {
    for (const row of rawData) {
      const hit = parseHit(row);
      if (hit) hits.push(hit);
    }
  }
  const m = payload.meta;
  if (!isRecord(m)) {
    return {
      hits,
      meta: { totalItems: hits.length, currentPage: 1, totalPages: 1, itemsPerPage: hits.length },
    };
  }
  const totalItems = typeof m.totalItems === 'number' ? m.totalItems : hits.length;
  const currentPage = typeof m.currentPage === 'number' ? m.currentPage : 1;
  const totalPages = typeof m.totalPages === 'number' ? m.totalPages : 1;
  const itemsPerPage = typeof m.itemsPerPage === 'number' ? m.itemsPerPage : hits.length;
  return { hits, meta: { totalItems, currentPage, totalPages, itemsPerPage } };
}
