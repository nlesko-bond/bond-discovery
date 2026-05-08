'use client';

import { useCallback, useEffect, useMemo, useRef, useState, type FormEvent } from 'react';
import Image from 'next/image';
import { format } from 'date-fns';
import {
  CalendarDays,
  CalendarPlus,
  ChevronDown,
  ChevronUp,
  Columns3,
  Download,
  Mail,
  Printer,
  Search,
  SlidersHorizontal,
} from 'lucide-react';
import type { IReservationPageConfig } from '@/types/reservation-pages';
import {
  buildReservationScheduleRows,
  MaintenanceDisplayModeEnum,
  type IReservationScheduleRow,
  type MaintenanceDisplayMode,
} from '@/lib/reservation-schedule-transform';
import { buildMailtoScheduleBody } from '@/lib/reservation-schedule-email';
import { buildReservationScheduleIcs } from '@/lib/reservation-schedule-ics';
import { cn } from '@/lib/utils';
import type { IReservationSearchHit, IReservationSearchMeta } from '@/lib/reservation-search-parse';

const ICON_SMALL = 16;
const ICON_MEDIUM = 18;
const RESERVATION_SEARCH_ITEMS_PER_PAGE = 25;
const RESERVATION_LOAD_CONCURRENCY = 5;

const EMPTY_SEARCH_META: IReservationSearchMeta = {
  totalItems: 0,
  currentPage: 1,
  totalPages: 1,
  itemsPerPage: 0,
};

type ReservationColumnKey =
  | 'reservation'
  | 'date'
  | 'day'
  | 'time'
  | 'space'
  | 'slotType'
  | 'approvalStatus'
  | 'title'
  | 'product'
  | 'price'
  | 'maintenance';

type ScheduleSortColumn = 'default' | ReservationColumnKey;

interface ISortState {
  column: ScheduleSortColumn;
  dir: 'asc' | 'desc';
}

interface IColumnDef {
  key: ReservationColumnKey;
  label: string;
}

const COLUMN_DEFS: IColumnDef[] = [
  { key: 'reservation', label: 'Reservation' },
  { key: 'date', label: 'Date' },
  { key: 'day', label: 'Day' },
  { key: 'time', label: 'Time' },
  { key: 'space', label: 'Space' },
  { key: 'slotType', label: 'Slot type' },
  { key: 'approvalStatus', label: 'Approval' },
  { key: 'title', label: 'Title' },
  { key: 'product', label: 'Product' },
  { key: 'price', label: 'Price' },
  { key: 'maintenance', label: 'Maintenance' },
];

const DEFAULT_COLUMNS: ReservationColumnKey[] = [
  'reservation',
  'date',
  'day',
  'time',
  'space',
  'slotType',
  'approvalStatus',
  'title',
  'product',
  'price',
  'maintenance',
];

function hexToRgba(hex: string, alpha: number): string {
  const h = hex.replace('#', '');
  const bigint = parseInt(h.length === 3 ? h.split('').map((c) => c + c).join('') : h, 16);
  const r = (bigint >> 16) & 255;
  const g = (bigint >> 8) & 255;
  const b = bigint & 255;
  return `rgba(${r},${g},${b},${alpha})`;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function readCustomerMailParts(reservation: unknown): { name: string; email: string | null } {
  if (!isRecord(reservation)) return { name: '', email: null };
  const title = typeof reservation.name === 'string' ? reservation.name : 'Reservation';
  const c = reservation.customer;
  if (!isRecord(c)) return { name: title, email: null };
  const email = typeof c.email === 'string' ? c.email : null;
  const first = typeof c.firstName === 'string' ? c.firstName : '';
  const last = typeof c.lastName === 'string' ? c.lastName : '';
  const full = typeof c.name === 'string' ? c.name : `${first} ${last}`.trim();
  return { name: full || title, email };
}

interface IScheduleSource {
  reservationId: number;
  reservationName: string;
  payload: unknown;
  spaceNameBySpaceId: Record<number, string>;
}

async function fetchReservationScheduleSource(
  organizationId: number,
  slug: string,
  reservationId: number,
): Promise<IScheduleSource> {
  const res = await fetch(`/api/reservation-pages/${encodeURIComponent(slug)}/reservation`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      organizationId,
      reservationId,
    }),
  });
  const json: unknown = await res.json();
  if (!res.ok) {
    const msg = isRecord(json) && typeof json.error === 'string' ? json.error : 'Request failed';
    throw new Error(msg);
  }
  if (!isRecord(json) || !('reservation' in json) || !('meta' in json)) {
    throw new Error('Invalid response shape');
  }
  const meta = json.meta;
  if (!isRecord(meta)) throw new Error('Invalid meta');
  const sn = meta.spaceNameBySpaceId;
  const payload = json.reservation;
  let reservationName = `Reservation ${reservationId}`;
  if (isRecord(payload) && typeof payload.name === 'string' && payload.name.trim()) {
    reservationName = payload.name.trim();
  }
  return {
    reservationId,
    reservationName,
    payload,
    spaceNameBySpaceId: isRecord(sn)
      ? Object.fromEntries(
          Object.entries(sn).map(([k, v]) => [Number(k), typeof v === 'string' ? v : String(v)]),
        )
      : {},
  };
}

function cellForColumn(row: IReservationScheduleRow, key: ReservationColumnKey): string {
  switch (key) {
    case 'reservation':
      return row.reservationName;
    case 'date':
      return row.date;
    case 'day':
      return row.dayLabel;
    case 'time':
      return row.timeLabel;
    case 'space':
      return row.spaceName;
    case 'slotType':
      return row.slotType;
    case 'approvalStatus':
      return row.approvalStatus;
    case 'title':
      return row.title;
    case 'product':
      return row.productName;
    case 'price':
      return row.priceLabel;
    case 'maintenance':
      return row.maintenanceSummary;
  }
}

function getMailCell(row: unknown, key: string): string {
  if (!row || typeof row !== 'object') return '';
  return cellForColumn(row as IReservationScheduleRow, key as ReservationColumnKey);
}

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
}

function compareScheduleRows(a: IReservationScheduleRow, b: IReservationScheduleRow, sort: ISortState): number {
  if (sort.column === 'default') {
    return a.sortKey.localeCompare(b.sortKey);
  }
  const dir = sort.dir === 'asc' ? 1 : -1;
  let cmp = 0;
  switch (sort.column) {
    case 'reservation':
      cmp = a.reservationName.localeCompare(b.reservationName);
      break;
    case 'date':
      cmp = a.date.localeCompare(b.date);
      break;
    case 'day':
      cmp = a.dayLabel.localeCompare(b.dayLabel);
      break;
    case 'time':
      cmp = a.startTimeRaw.localeCompare(b.startTimeRaw);
      break;
    case 'space':
      cmp = a.spaceName.localeCompare(b.spaceName);
      break;
    case 'slotType':
      cmp = a.slotType.localeCompare(b.slotType);
      break;
    case 'approvalStatus':
      cmp = a.approvalStatus.localeCompare(b.approvalStatus);
      break;
    case 'title':
      cmp = a.title.localeCompare(b.title);
      break;
    case 'product':
      cmp = a.productName.localeCompare(b.productName);
      break;
    case 'price':
      cmp = a.priceLabel.localeCompare(b.priceLabel);
      break;
    case 'maintenance':
      cmp = a.maintenanceSummary.localeCompare(b.maintenanceSummary);
      break;
    default:
      cmp = 0;
  }
  if (cmp !== 0) return cmp * dir;
  return a.sortKey.localeCompare(b.sortKey);
}

interface IReservationSchedulePageProps {
  config: IReservationPageConfig;
}

/**
 * Staff-facing rental schedule report: search reservations, load by ID, filter columns, export CSV / print, mailto draft.
 */
export function ReservationSchedulePage({ config }: IReservationSchedulePageProps) {
  const { branding } = config;
  const pageTitle = config.page_title?.trim() || config.name;
  const pageSubtitle = config.page_subtitle?.trim() || '';

  const [organizationId, setOrganizationId] = useState<number>(
    config.organization_ids[0] ?? 0,
  );
  const [reservationIdInput, setReservationIdInput] = useState('');
  const [customerSearch, setCustomerSearch] = useState('');
  const [searchHits, setSearchHits] = useState<IReservationSearchHit[]>([]);
  const [searchMeta, setSearchMeta] = useState<IReservationSearchMeta>(EMPTY_SEARCH_META);
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchError, setSearchError] = useState<string | null>(null);
  const [lastSearchQuery, setLastSearchQuery] = useState<string | null>(null);
  const [selectedHitIds, setSelectedHitIds] = useState<number[]>([]);
  const [scheduleSources, setScheduleSources] = useState<IScheduleSource[]>([]);
  const [loading, setLoading] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);

  const [maintenanceMode, setMaintenanceMode] = useState<MaintenanceDisplayMode>(
    MaintenanceDisplayModeEnum.BUNDLE,
  );
  const [textFilter, setTextFilter] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');
  const [approvalFilter, setApprovalFilter] = useState<string>('all');
  const [slotTypeFilter, setSlotTypeFilter] = useState<string>('all');
  const [visibleColumns, setVisibleColumns] = useState<ReservationColumnKey[]>(DEFAULT_COLUMNS);
  const [sortState, setSortState] = useState<ISortState>({ column: 'default', dir: 'asc' });
  const [printGeneratedAt, setPrintGeneratedAt] = useState<Date | null>(null);

  const selectAllSearchRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    setSortState({ column: 'default', dir: 'asc' });
  }, [scheduleSources]);

  useEffect(() => {
    const el = selectAllSearchRef.current;
    if (!el) return;
    const pageIds = searchHits.map((h) => h.id);
    const selectedOnPage = pageIds.filter((id) => selectedHitIds.includes(id)).length;
    el.indeterminate = selectedOnPage > 0 && selectedOnPage < pageIds.length;
  }, [searchHits, selectedHitIds]);

  useEffect(() => {
    const onBeforePrint = () => setPrintGeneratedAt(new Date());
    window.addEventListener('beforeprint', onBeforePrint);
    return () => window.removeEventListener('beforeprint', onBeforePrint);
  }, []);

  const cssVars = {
    '--rs-black': branding.primaryColor,
    '--rs-accent': branding.accentColor,
    '--rs-accent-light': branding.accentColorLight || branding.accentColor,
    '--rs-accent-bg': hexToRgba(branding.accentColor, 0.08),
    '--rs-bg': branding.bgColor,
  } as React.CSSProperties;

  const baseRows = useMemo(() => {
    if (!scheduleSources.length) return [];
    return scheduleSources.flatMap((src) =>
      buildReservationScheduleRows(
        src.payload,
        src.spaceNameBySpaceId,
        maintenanceMode,
        { reservationId: src.reservationId, reservationName: src.reservationName },
      ),
    );
  }, [scheduleSources, maintenanceMode]);

  const approvalOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of baseRows) {
      if (r.approvalStatus) set.add(r.approvalStatus);
    }
    return [...set].sort();
  }, [baseRows]);

  const slotTypeOptions = useMemo(() => {
    const set = new Set<string>();
    for (const r of baseRows) {
      if (r.slotType) set.add(r.slotType);
    }
    return [...set].sort();
  }, [baseRows]);

  const filteredRows = useMemo(() => {
    const q = textFilter.trim().toLowerCase();
    return baseRows.filter((row) => {
      if (startDate && row.date < startDate) return false;
      if (endDate && row.date > endDate) return false;
      if (approvalFilter !== 'all' && row.approvalStatus !== approvalFilter) return false;
      if (slotTypeFilter !== 'all' && row.slotType !== slotTypeFilter) return false;
      if (!q) return true;
      return [
        row.reservationName,
        row.date,
        row.dayLabel,
        row.timeLabel,
        row.spaceName,
        row.slotType,
        row.approvalStatus,
        row.title,
        row.productName,
        row.priceLabel,
        row.maintenanceSummary,
      ]
        .join(' ')
        .toLowerCase()
        .includes(q);
    });
  }, [baseRows, textFilter, startDate, endDate, approvalFilter, slotTypeFilter]);

  const displayedRows = useMemo(() => {
    const copy = [...filteredRows];
    copy.sort((a, b) => compareScheduleRows(a, b, sortState));
    return copy;
  }, [filteredRows, sortState]);

  const visibleColumnDefs = useMemo(
    () => COLUMN_DEFS.filter((c) => visibleColumns.includes(c.key)),
    [visibleColumns],
  );

  const printCustomerInfo = useMemo(() => {
    for (const src of scheduleSources) {
      const parts = readCustomerMailParts(src.payload);
      if (parts.name || parts.email) {
        return parts;
      }
    }
    return { name: '', email: null as string | null };
  }, [scheduleSources]);

  const mailtoHref = useMemo(() => {
    if (!scheduleSources.length) return null;
    let email: string | null = null;
    let name = '';
    for (const src of scheduleSources) {
      const parts = readCustomerMailParts(src.payload);
      if (parts.email) {
        email = parts.email;
        name = parts.name;
        break;
      }
    }
    if (!email) return null;
    const resIds = scheduleSources.map((s) => s.reservationId).join(', ');
    const subject =
      scheduleSources.length === 1
        ? `Your rental schedule — reservation ${resIds}`
        : `Your rental schedules — reservations ${resIds}`;
    const introLine =
      scheduleSources.length === 1
        ? `Please find your rental schedule for reservation ${resIds} below.`
        : `Please find your rental schedules for reservations ${resIds} below.`;
    const body = buildMailtoScheduleBody({
      greetingName: name || 'there',
      introLine,
      rows: displayedRows,
      columns: visibleColumnDefs.map((c) => ({ key: c.key, label: c.label })),
      getCell: getMailCell,
      footerThanksLine: `Thanks,\n${config.name}`,
    });
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [scheduleSources, displayedRows, visibleColumnDefs, config.name]);

  const loadReservationById = useCallback(
    async (rid: number) => {
      setLoadError(null);
      setLoading(true);
      try {
        const src = await fetchReservationScheduleSource(organizationId, config.slug, rid);
        setScheduleSources([src]);
        setReservationIdInput(String(rid));
      } catch (e) {
        setScheduleSources([]);
        setLoadError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [organizationId, config.slug],
  );

  const loadSelectedSchedules = useCallback(async () => {
    if (!selectedHitIds.length) return;
    setLoadError(null);
    setLoading(true);
    try {
      const ordered = selectedHitIds.map((id) => {
        const hit = searchHits.find((h) => h.id === id);
        const label = hit?.name?.trim() || `Reservation ${id}`;
        return { id, label };
      });
      const sources: IScheduleSource[] = [];
      for (let i = 0; i < ordered.length; i += RESERVATION_LOAD_CONCURRENCY) {
        const chunk = ordered.slice(i, i + RESERVATION_LOAD_CONCURRENCY);
        const part = await Promise.all(
          chunk.map(async (h) => {
            const src = await fetchReservationScheduleSource(organizationId, config.slug, h.id);
            return { ...src, reservationName: h.label };
          }),
        );
        sources.push(...part);
      }
      setScheduleSources(sources);
      setReservationIdInput(sources.length === 1 ? String(sources[0].reservationId) : '');
      setSelectedHitIds([]);
    } catch (e) {
      setScheduleSources([]);
      setLoadError(e instanceof Error ? e.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, [selectedHitIds, searchHits, organizationId, config.slug]);

  async function handleLoad(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const rid = parseInt(reservationIdInput, 10);
    if (!organizationId || !Number.isFinite(rid)) {
      setLoadError('Choose an organization and enter a numeric reservation ID.');
      return;
    }
    await loadReservationById(rid);
  }

  const runReservationSearch = useCallback(
    async (page: number) => {
      setSearchError(null);
      if (!organizationId || !customerSearch.trim()) {
        setSearchError('Choose an organization and enter name, email, or other search text.');
        return;
      }
      setSearchLoading(true);
      try {
        const res = await fetch(
          `/api/reservation-pages/${encodeURIComponent(config.slug)}/reservations/search`,
          {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              organizationId,
              search: customerSearch.trim(),
              page,
              itemsPerPage: RESERVATION_SEARCH_ITEMS_PER_PAGE,
            }),
          },
        );
        const json: unknown = await res.json();
        if (!res.ok) {
          const msg = isRecord(json) && typeof json.error === 'string' ? json.error : 'Search failed';
          throw new Error(msg);
        }
        if (!isRecord(json) || !Array.isArray(json.hits) || !isRecord(json.meta)) {
          throw new Error('Invalid search response');
        }
        const hits: IReservationSearchHit[] = [];
        for (const row of json.hits) {
          if (!isRecord(row) || typeof row.id !== 'number') continue;
          hits.push({
            id: row.id,
            name: typeof row.name === 'string' ? row.name : '',
            customerLabel: typeof row.customerLabel === 'string' ? row.customerLabel : '',
            approvalStatus: typeof row.approvalStatus === 'string' ? row.approvalStatus : '',
            paymentStatus: typeof row.paymentStatus === 'string' ? row.paymentStatus : '',
          });
        }
        const m = json.meta;
        setSearchHits(hits);
        setSelectedHitIds([]);
        setLastSearchQuery(customerSearch.trim());
        setSearchMeta({
          totalItems: typeof m.totalItems === 'number' ? m.totalItems : hits.length,
          currentPage: typeof m.currentPage === 'number' ? m.currentPage : page,
          totalPages: typeof m.totalPages === 'number' ? m.totalPages : 1,
          itemsPerPage: typeof m.itemsPerPage === 'number' ? m.itemsPerPage : RESERVATION_SEARCH_ITEMS_PER_PAGE,
        });
      } catch (e) {
        setSearchHits([]);
        setSearchMeta(EMPTY_SEARCH_META);
        setLastSearchQuery(null);
        setSearchError(e instanceof Error ? e.message : 'Search failed');
      } finally {
        setSearchLoading(false);
      }
    },
    [organizationId, customerSearch, config.slug],
  );

  async function handleSearchReservations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runReservationSearch(1);
  }

  async function selectSearchHit(hit: IReservationSearchHit) {
    await loadReservationById(hit.id);
  }

  function toggleHitSelected(id: number) {
    setSelectedHitIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]));
  }

  function toggleSelectAllSearchPage() {
    setSelectedHitIds((prev) => {
      const pageIds = searchHits.map((h) => h.id);
      const allOnPageSelected = pageIds.length > 0 && pageIds.every((id) => prev.includes(id));
      if (allOnPageSelected) {
        return prev.filter((id) => !pageIds.includes(id));
      }
      return [...new Set([...prev, ...pageIds])];
    });
  }

  function handleSortColumnClick(key: ReservationColumnKey) {
    setSortState((prev) => {
      if (prev.column === key) {
        return { column: key, dir: prev.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { column: key, dir: 'asc' };
    });
  }

  function toggleColumn(key: ReservationColumnKey) {
    const isOn = visibleColumns.includes(key);
    if (!isOn && key === 'maintenance') {
      setMaintenanceMode(MaintenanceDisplayModeEnum.BUNDLE);
    }
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function handleExportCsv() {
    const headers = visibleColumnDefs.map((c) => c.label);
    const rows = displayedRows.map((row) =>
      visibleColumnDefs.map((c) => csvEscape(cellForColumn(row, c.key))).join(','),
    );
    const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const idPart = scheduleSources.map((s) => s.reservationId).join('-');
    a.download = idPart ? `reservations-${idPart}.csv` : `reservation-${reservationIdInput || 'schedule'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    setPrintGeneratedAt(new Date());
    window.print();
  }

  function handleDownloadIcs() {
    if (!displayedRows.length) return;
    const resIds = scheduleSources.map((s) => s.reservationId).join('-');
    const title =
      scheduleSources.length === 1
        ? `Rental schedule — reservation ${scheduleSources[0].reservationId}`
        : `Rental schedules — ${resIds}`;
    const ics = buildReservationScheduleIcs(displayedRows, title);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = resIds ? `rental-schedule-${resIds}.ics` : 'rental-schedule.ics';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={cssVars} className="min-h-screen" data-reservation-schedule-page>
      <style
        dangerouslySetInnerHTML={{
          __html: `
            @import url('https://fonts.googleapis.com/css2?family=${encodeURIComponent(branding.fontHeading)}&family=${encodeURIComponent(branding.fontBody)}:wght@400;500;600;700;800&display=swap');
            [data-reservation-schedule-page] {
              font-family: '${branding.fontBody}', Helvetica, Arial, sans-serif;
              background: var(--rs-bg);
              color: var(--rs-black);
              -webkit-font-smoothing: antialiased;
            }
            [data-reservation-schedule-page] .rs-heading {
              font-family: '${branding.fontHeading}', sans-serif;
            }
            @media print {
              [data-reservation-schedule-page] th button {
                border: none !important;
                background: none !important;
                padding: 0 !important;
                font: inherit !important;
                color: inherit !important;
              }
            }
          `,
        }}
      />

      <header className="border-b border-gray-200 bg-white print:hidden">
        <div className="mx-auto flex max-w-7xl flex-col gap-4 px-4 py-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            {branding.logoUrl ? (
              <Image
                src={branding.logoUrl}
                alt=""
                width={200}
                height={48}
                className="h-12 w-auto object-contain"
                unoptimized
              />
            ) : (
              <div
                className="flex h-12 w-12 items-center justify-center rounded-lg text-lg font-bold text-white"
                style={{ background: 'var(--rs-accent)' }}
              >
                <CalendarDays size={ICON_MEDIUM} />
              </div>
            )}
            <div>
              <h1 className="rs-heading text-2xl font-bold tracking-tight md:text-3xl">{pageTitle}</h1>
              {pageSubtitle ? <p className="mt-1 text-sm text-gray-600">{pageSubtitle}</p> : null}
              <p className="mt-1 text-xs text-gray-500">{config.name}</p>
            </div>
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-4 px-4 py-6 print:py-2">
        <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm print:hidden">
          <div className="mb-3 flex flex-wrap items-center gap-2 text-xs font-semibold uppercase tracking-wide text-gray-500">
            <SlidersHorizontal size={ICON_SMALL} className="inline" />
            Search and filters
          </div>
          <form onSubmit={handleLoad} className="flex flex-col gap-3 lg:flex-row lg:flex-wrap lg:items-end">
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm font-medium text-gray-700">
              Organization
              <select
                value={organizationId || ''}
                onChange={(e) => {
                  setOrganizationId(Number(e.target.value));
                  setSearchHits([]);
                  setSearchMeta(EMPTY_SEARCH_META);
                  setSearchError(null);
                  setLastSearchQuery(null);
                  setSelectedHitIds([]);
                }}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                required
              >
                {config.organization_ids.map((id) => (
                  <option key={id} value={id}>
                    {id}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[10rem] flex-1 flex-col gap-1 text-sm font-medium text-gray-700">
              Reservation ID
              <input
                value={reservationIdInput}
                onChange={(e) => setReservationIdInput(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="394436"
                inputMode="numeric"
              />
            </label>
            <button
              type="submit"
              disabled={loading}
              className="rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--rs-black)' }}
            >
              {loading ? 'Loading…' : 'Load by ID'}
            </button>
          </form>

          <form
            onSubmit={handleSearchReservations}
            className="mt-4 flex flex-col gap-3 border-t border-gray-100 pt-4 lg:flex-row lg:flex-wrap lg:items-end"
          >
            <label className="flex min-w-[12rem] flex-1 flex-col gap-1 text-sm font-medium text-gray-700">
              Customer search (name, email, ID fragment)
              <input
                value={customerSearch}
                onChange={(e) => setCustomerSearch(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
                placeholder="kenny@example.com or customer name"
                autoComplete="off"
              />
            </label>
            <button
              type="submit"
              disabled={searchLoading}
              className="inline-flex items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold text-white disabled:opacity-50"
              style={{ background: 'var(--rs-accent)' }}
            >
              <Search size={ICON_SMALL} />
              {searchLoading ? 'Searching…' : 'Search reservations'}
            </button>
          </form>

          {searchError ? (
            <p className="mt-3 text-sm text-red-600">{searchError}</p>
          ) : null}

          {lastSearchQuery && !searchLoading && !searchError && searchHits.length === 0 ? (
            <p className="mt-3 text-sm text-gray-600">
              No reservations matched &quot;{lastSearchQuery}&quot; for this organization.
            </p>
          ) : null}

          {searchHits.length > 0 ? (
            <div className="mt-4 overflow-x-auto rounded-lg border border-gray-200">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-gray-100 bg-gray-50 px-3 py-2 text-xs text-gray-600">
                <span>
                  Page {searchMeta.currentPage} of {searchMeta.totalPages} ({searchMeta.totalItems} total)
                </span>
                <div className="flex flex-wrap items-center gap-2">
                  <button
                    type="button"
                    disabled={!selectedHitIds.length || loading}
                    onClick={() => void loadSelectedSchedules()}
                    className="rounded border border-emerald-700 bg-emerald-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-emerald-700 disabled:opacity-40"
                  >
                    Load selected ({selectedHitIds.length})
                  </button>
                  <button
                    type="button"
                    disabled={searchLoading || searchMeta.currentPage <= 1}
                    onClick={() => void runReservationSearch(searchMeta.currentPage - 1)}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 disabled:opacity-40"
                  >
                    Previous
                  </button>
                  <button
                    type="button"
                    disabled={searchLoading || searchMeta.currentPage >= searchMeta.totalPages}
                    onClick={() => void runReservationSearch(searchMeta.currentPage + 1)}
                    className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-700 disabled:opacity-40"
                  >
                    Next
                  </button>
                </div>
              </div>
              <table className="w-full min-w-[36rem] text-left text-sm">
                <thead className="border-b border-gray-200 bg-white text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="w-10 px-2 py-2">
                      <input
                        ref={selectAllSearchRef}
                        type="checkbox"
                        checked={
                          searchHits.length > 0 && searchHits.every((h) => selectedHitIds.includes(h.id))
                        }
                        onChange={toggleSelectAllSearchPage}
                        className="rounded border-gray-300"
                        aria-label="Select all on this page"
                      />
                    </th>
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Reservation</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Approval</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2 text-right"> </th>
                  </tr>
                </thead>
                <tbody>
                  {searchHits.map((hit) => (
                    <tr key={hit.id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="px-2 py-2">
                        <input
                          type="checkbox"
                          checked={selectedHitIds.includes(hit.id)}
                          onChange={() => toggleHitSelected(hit.id)}
                          className="rounded border-gray-300"
                          aria-label={`Select reservation ${hit.id}`}
                        />
                      </td>
                      <td className="px-3 py-2 font-mono text-xs">{hit.id}</td>
                      <td className="px-3 py-2">{hit.name || '—'}</td>
                      <td className="px-3 py-2 text-gray-700">{hit.customerLabel || '—'}</td>
                      <td className="px-3 py-2">{hit.approvalStatus || '—'}</td>
                      <td className="px-3 py-2">{hit.paymentStatus || '—'}</td>
                      <td className="px-3 py-2 text-right">
                        <button
                          type="button"
                          onClick={() => void selectSearchHit(hit)}
                          disabled={loading}
                          className="rounded border border-gray-300 bg-white px-2 py-1 text-xs font-semibold text-gray-800 hover:bg-gray-50 disabled:opacity-40"
                        >
                          Load one
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {loadError ? (
            <p className="mt-3 text-sm text-red-600">{loadError}</p>
          ) : null}

          <div className="mt-4 flex flex-nowrap items-end gap-3 overflow-x-auto border-t border-gray-100 pt-4 pb-1 print:hidden">
            <label className="flex min-w-[7.5rem] shrink-0 flex-col gap-1 text-xs font-medium text-gray-600">
              Search table
              <span className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={textFilter}
                  onChange={(e) => setTextFilter(e.target.value)}
                  className="w-full min-w-[7.5rem] rounded-lg border border-gray-300 py-1.5 pl-8 pr-2 text-sm"
                  placeholder="Filter…"
                />
              </span>
            </label>
            <label className="flex min-w-[8.5rem] shrink-0 flex-col gap-1 text-xs font-medium text-gray-600">
              From
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex min-w-[8.5rem] shrink-0 flex-col gap-1 text-xs font-medium text-gray-600">
              To
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              />
            </label>
            <label className="flex min-w-[10rem] shrink-0 flex-col gap-1 text-xs font-medium text-gray-600">
              Maintenance
              <select
                value={maintenanceMode}
                onChange={(e) => {
                  const v = e.target.value as MaintenanceDisplayMode;
                  setMaintenanceMode(v);
                  if (v === MaintenanceDisplayModeEnum.HIDE) {
                    setVisibleColumns((prev) => prev.filter((k) => k !== 'maintenance'));
                  }
                }}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value={MaintenanceDisplayModeEnum.BUNDLE}>Bundle</option>
                <option value={MaintenanceDisplayModeEnum.FLATTEN}>Separate rows</option>
                <option value={MaintenanceDisplayModeEnum.HIDE}>Hide</option>
              </select>
            </label>
            <label className="flex min-w-[8.5rem] shrink-0 flex-col gap-1 text-xs font-medium text-gray-600">
              Approval
              <select
                value={approvalFilter}
                onChange={(e) => setApprovalFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="all">All</option>
                {approvalOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex min-w-[8.5rem] shrink-0 flex-col gap-1 text-xs font-medium text-gray-600">
              Slot type
              <select
                value={slotTypeFilter}
                onChange={(e) => setSlotTypeFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-2 py-1.5 text-sm"
              >
                <option value="all">All</option>
                {slotTypeOptions.map((opt) => (
                  <option key={opt} value={opt}>
                    {opt}
                  </option>
                ))}
              </select>
            </label>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden print:block print:mb-4 print:border-b print:border-gray-300 print:pb-3">
            <h2 className="text-xl font-bold">{pageTitle}</h2>
            {scheduleSources.length === 1 ? (
              <p className="mt-1 text-sm text-gray-700">Reservation #{scheduleSources[0].reservationId}</p>
            ) : scheduleSources.length > 1 ? (
              <p className="mt-1 text-sm text-gray-700">
                Reservations #{scheduleSources.map((s) => s.reservationId).join(', ')}
              </p>
            ) : null}
            <div className="mt-3 grid gap-1 text-sm text-gray-800 sm:grid-cols-2">
              <p>
                <span className="font-semibold">Customer: </span>
                {printCustomerInfo.name || '—'}
              </p>
              <p>
                <span className="font-semibold">Email: </span>
                {printCustomerInfo.email || '—'}
              </p>
              <p className="sm:col-span-2">
                <span className="font-semibold">Generated: </span>
                {format(printGeneratedAt ?? new Date(), 'PPpp')}
              </p>
            </div>
          </div>
          <div className="flex flex-col gap-3 border-b border-gray-100 p-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4 print:hidden">
            <div className="min-w-0 flex-1">
              <div className="mb-2 flex items-center gap-2 text-sm font-semibold text-gray-800">
                <Columns3 size={ICON_MEDIUM} />
                Columns
              </div>
              <div className="flex flex-wrap gap-2">
                {COLUMN_DEFS.map((col) => {
                  const on = visibleColumns.includes(col.key);
                  return (
                    <button
                      key={col.key}
                      type="button"
                      onClick={() => toggleColumn(col.key)}
                      className={cn(
                        'rounded-full border px-3 py-1 text-xs font-semibold',
                        on
                          ? 'border-transparent text-white'
                          : 'border-gray-200 bg-white text-gray-500',
                      )}
                      style={
                        on ? { background: 'var(--rs-accent)', borderColor: 'var(--rs-accent)' } : undefined
                      }
                    >
                      {col.label}
                    </button>
                  );
                })}
              </div>
            </div>
            <div className="flex shrink-0 flex-wrap items-center justify-end gap-2">
              <button
                type="button"
                onClick={handleExportCsv}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Download size={ICON_SMALL} />
                CSV
              </button>
              <button
                type="button"
                onClick={handlePrint}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50"
              >
                <Printer size={ICON_SMALL} />
                PDF / print
              </button>
              <button
                type="button"
                onClick={handleDownloadIcs}
                disabled={!displayedRows.length}
                className="inline-flex items-center gap-2 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-semibold text-gray-700 hover:bg-gray-50 disabled:opacity-40"
              >
                <CalendarPlus size={ICON_SMALL} />
                Calendar (.ics)
              </button>
              {mailtoHref ? (
                <a
                  href={mailtoHref}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
                  style={{ background: 'var(--rs-accent)' }}
                >
                  <Mail size={ICON_SMALL} />
                  Email
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-400">
                  Email (needs customer)
                </span>
              )}
            </div>
          </div>
          <div className="overflow-x-auto p-2 sm:p-4">
            <table className="min-w-full divide-y divide-gray-200 text-left text-sm">
              <thead className="bg-gray-50 print:bg-white">
                <tr>
                  {visibleColumnDefs.map((col) => (
                    <th
                      key={col.key}
                      className="whitespace-nowrap px-3 py-3 text-xs font-semibold uppercase tracking-wide text-gray-600"
                    >
                      <button
                        type="button"
                        onClick={() => handleSortColumnClick(col.key)}
                        className="inline-flex items-center gap-1 rounded px-1 py-0.5 hover:bg-gray-200/80"
                      >
                        {col.label}
                        {sortState.column === col.key ? (
                          sortState.dir === 'asc' ? (
                            <ChevronUp className="h-3.5 w-3.5" aria-hidden />
                          ) : (
                            <ChevronDown className="h-3.5 w-3.5" aria-hidden />
                          )
                        ) : null}
                      </button>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {displayedRows.map((row) => (
                  <tr
                    key={row.rowKey}
                    className={row.isMaintenance ? 'bg-amber-50/70' : undefined}
                  >
                    {visibleColumnDefs.map((col) => (
                      <td key={col.key} className="whitespace-nowrap px-3 py-2 text-gray-800">
                        {col.key === 'slotType' ? (
                          <span
                            className={cn(
                              'rounded-full px-2 py-0.5 text-xs font-semibold',
                              row.slotType === 'maintenance'
                                ? 'bg-amber-100 text-amber-800'
                                : 'bg-slate-100 text-slate-700',
                            )}
                          >
                            {row.slotType}
                          </span>
                        ) : col.key === 'approvalStatus' ? (
                          <span className="text-xs font-medium">{row.approvalStatus || '—'}</span>
                        ) : (
                          cellForColumn(row, col.key) || '—'
                        )}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            {!displayedRows.length ? (
              <p className="p-6 text-center text-sm text-gray-500">
                Load reservation(s) to see slots, or adjust filters.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
