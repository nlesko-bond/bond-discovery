'use client';

import { useCallback, useMemo, useState, type FormEvent } from 'react';
import Image from 'next/image';
import {
  CalendarDays,
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
import { cn } from '@/lib/utils';
import type { IReservationSearchHit, IReservationSearchMeta } from '@/lib/reservation-search-parse';

const ICON_SMALL = 16;
const ICON_MEDIUM = 18;
const RESERVATION_SEARCH_ITEMS_PER_PAGE = 25;

const EMPTY_SEARCH_META: IReservationSearchMeta = {
  totalItems: 0,
  currentPage: 1,
  totalPages: 1,
  itemsPerPage: 0,
};

type ReservationColumnKey =
  | 'date'
  | 'day'
  | 'time'
  | 'facility'
  | 'space'
  | 'slotType'
  | 'approvalStatus'
  | 'title'
  | 'product'
  | 'price'
  | 'maintenance';

interface IColumnDef {
  key: ReservationColumnKey;
  label: string;
}

const COLUMN_DEFS: IColumnDef[] = [
  { key: 'date', label: 'Date' },
  { key: 'day', label: 'Day' },
  { key: 'time', label: 'Time' },
  { key: 'facility', label: 'Facility' },
  { key: 'space', label: 'Space' },
  { key: 'slotType', label: 'Slot type' },
  { key: 'approvalStatus', label: 'Approval' },
  { key: 'title', label: 'Title' },
  { key: 'product', label: 'Product' },
  { key: 'price', label: 'Price' },
  { key: 'maintenance', label: 'Maintenance' },
];

const DEFAULT_COLUMNS: ReservationColumnKey[] = [
  'date',
  'day',
  'time',
  'facility',
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

function cellForColumn(row: IReservationScheduleRow, key: ReservationColumnKey): string {
  switch (key) {
    case 'date':
      return row.date;
    case 'day':
      return row.dayLabel;
    case 'time':
      return row.timeLabel;
    case 'facility':
      return row.facilityName;
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

function csvEscape(value: string): string {
  return `"${value.replace(/"/g, '""')}"`;
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
  const [bondQueryJson, setBondQueryJson] = useState('');
  const [reservationPayload, setReservationPayload] = useState<unknown>(null);
  const [facilityName, setFacilityName] = useState('');
  const [spaceNameBySpaceId, setSpaceNameBySpaceId] = useState<Record<number, string>>({});
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

  const cssVars = {
    '--rs-black': branding.primaryColor,
    '--rs-accent': branding.accentColor,
    '--rs-accent-light': branding.accentColorLight || branding.accentColor,
    '--rs-accent-bg': hexToRgba(branding.accentColor, 0.08),
    '--rs-bg': branding.bgColor,
  } as React.CSSProperties;

  const baseRows = useMemo(() => {
    if (!reservationPayload) return [];
    return buildReservationScheduleRows(
      reservationPayload,
      facilityName,
      spaceNameBySpaceId,
      maintenanceMode,
    );
  }, [reservationPayload, facilityName, spaceNameBySpaceId, maintenanceMode]);

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
        row.date,
        row.dayLabel,
        row.timeLabel,
        row.facilityName,
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

  const visibleColumnDefs = useMemo(
    () => COLUMN_DEFS.filter((c) => visibleColumns.includes(c.key)),
    [visibleColumns],
  );

  const mailtoHref = useMemo(() => {
    const { name, email } = readCustomerMailParts(reservationPayload);
    if (!email) return null;
    const resId =
      isRecord(reservationPayload) && typeof reservationPayload.id === 'number'
        ? String(reservationPayload.id)
        : reservationIdInput;
    const subject = `Your rental schedule — reservation ${resId}`;
    const body = [
      `Hi ${name},`,
      '',
      `Please find your rental schedule for reservation ${resId} below.`,
      '',
      'Thanks,',
      config.name,
    ].join('\n');
    return `mailto:${email}?subject=${encodeURIComponent(subject)}&body=${encodeURIComponent(body)}`;
  }, [reservationPayload, reservationIdInput, config.name]);

  const parseBondQuery = useCallback((): Record<string, string> | undefined => {
    const raw = bondQueryJson.trim();
    if (!raw) return undefined;
    try {
      const parsed: unknown = JSON.parse(raw);
      if (!isRecord(parsed)) return undefined;
      const out: Record<string, string> = {};
      for (const [k, v] of Object.entries(parsed)) {
        if (typeof v === 'string' && v !== '') out[k] = v;
        else if (typeof v === 'number' || typeof v === 'boolean') out[k] = String(v);
      }
      return Object.keys(out).length ? out : undefined;
    } catch {
      return undefined;
    }
  }, [bondQueryJson]);

  const loadReservationById = useCallback(
    async (rid: number) => {
      setLoadError(null);
      setLoading(true);
      try {
        const bondQuery = parseBondQuery();
        const res = await fetch(`/api/reservation-pages/${encodeURIComponent(config.slug)}/reservation`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            organizationId,
            reservationId: rid,
            ...(bondQuery ? { bondQuery } : {}),
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
        const fn = meta.facilityName;
        const sn = meta.spaceNameBySpaceId;
        setReservationPayload(json.reservation);
        setFacilityName(typeof fn === 'string' ? fn : '');
        setSpaceNameBySpaceId(
          isRecord(sn)
            ? Object.fromEntries(
                Object.entries(sn).map(([k, v]) => [Number(k), typeof v === 'string' ? v : String(v)]),
              )
            : {},
        );
        setReservationIdInput(String(rid));
      } catch (e) {
        setReservationPayload(null);
        setFacilityName('');
        setSpaceNameBySpaceId({});
        setLoadError(e instanceof Error ? e.message : 'Failed to load');
      } finally {
        setLoading(false);
      }
    },
    [organizationId, config.slug, parseBondQuery],
  );

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
        const bondQuery = parseBondQuery();
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
              ...(bondQuery ? { bondQuery } : {}),
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
    [organizationId, customerSearch, config.slug, parseBondQuery],
  );

  async function handleSearchReservations(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    await runReservationSearch(1);
  }

  async function selectSearchHit(hit: IReservationSearchHit) {
    await loadReservationById(hit.id);
  }

  function toggleColumn(key: ReservationColumnKey) {
    setVisibleColumns((prev) =>
      prev.includes(key) ? prev.filter((k) => k !== key) : [...prev, key],
    );
  }

  function handleExportCsv() {
    const headers = visibleColumnDefs.map((c) => c.label);
    const rows = filteredRows.map((row) =>
      visibleColumnDefs.map((c) => csvEscape(cellForColumn(row, c.key))).join(','),
    );
    const csv = [headers.map(csvEscape).join(','), ...rows].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `reservation-${reservationIdInput || 'schedule'}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  function handlePrint() {
    window.print();
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
            Search, filters, and actions
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
            <div className="flex flex-wrap gap-2 lg:ml-auto">
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
              {mailtoHref ? (
                <a
                  href={mailtoHref}
                  className="inline-flex items-center gap-2 rounded-lg px-3 py-2 text-sm font-semibold text-white"
                  style={{ background: 'var(--rs-accent)' }}
                >
                  <Mail size={ICON_SMALL} />
                  Email customer
                </a>
              ) : (
                <span className="inline-flex items-center gap-2 rounded-lg border border-dashed border-gray-300 px-3 py-2 text-sm text-gray-400">
                  Email (load reservation with customer)
                </span>
              )}
            </div>
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
                <div className="flex gap-2">
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
                    <th className="px-3 py-2">ID</th>
                    <th className="px-3 py-2">Reservation</th>
                    <th className="px-3 py-2">Customer</th>
                    <th className="px-3 py-2">Approval</th>
                    <th className="px-3 py-2">Payment</th>
                    <th className="px-3 py-2"> </th>
                  </tr>
                </thead>
                <tbody>
                  {searchHits.map((hit) => (
                    <tr key={hit.id} className="border-b border-gray-100 hover:bg-gray-50">
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
                          Load schedule
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

          <details className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3 text-sm">
            <summary className="cursor-pointer font-semibold text-gray-800">Advanced: Bond API query (optional JSON)</summary>
            <p className="mt-2 text-xs text-gray-500">
              Merged with defaults (customer, buildTree, etc.). Use for extra flags such as slot type filters on the API
              when needed.
            </p>
            <textarea
              value={bondQueryJson}
              onChange={(e) => setBondQueryJson(e.target.value)}
              rows={3}
              className="mt-2 w-full rounded-lg border border-gray-300 px-3 py-2 font-mono text-xs"
              placeholder='{"slotTypes":"external,maintenance"}'
            />
          </details>

          <div className="mt-4 grid gap-3 border-t border-gray-100 pt-4 md:grid-cols-2 xl:grid-cols-4">
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Search table
              <span className="relative">
                <Search className="pointer-events-none absolute left-2 top-1/2 h-4 w-4 -translate-y-1/2 text-gray-400" />
                <input
                  value={textFilter}
                  onChange={(e) => setTextFilter(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 py-2 pl-8 pr-2 text-sm"
                  placeholder="Filter rows…"
                />
              </span>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              From date
              <input
                type="date"
                value={startDate}
                onChange={(e) => setStartDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              To date
              <input
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(e) => setEndDate(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Maintenance rows
              <select
                value={maintenanceMode}
                onChange={(e) => setMaintenanceMode(e.target.value as MaintenanceDisplayMode)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value={MaintenanceDisplayModeEnum.BUNDLE}>Bundle (column on rental row)</option>
                <option value={MaintenanceDisplayModeEnum.FLATTEN}>Flatten (separate rows)</option>
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Approval status
              <select
                value={approvalFilter}
                onChange={(e) => setApprovalFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
              >
                <option value="all">All</option>
                {approvalOptions.map((a) => (
                  <option key={a} value={a}>
                    {a}
                  </option>
                ))}
              </select>
            </label>
            <label className="flex flex-col gap-1 text-sm font-medium text-gray-700">
              Slot type
              <select
                value={slotTypeFilter}
                onChange={(e) => setSlotTypeFilter(e.target.value)}
                className="rounded-lg border border-gray-300 px-3 py-2 text-sm"
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

          <div className="mt-4 rounded-lg border border-gray-100 bg-gray-50 p-3 print:hidden">
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
                    style={on ? { background: 'var(--rs-accent)', borderColor: 'var(--rs-accent)' } : undefined}
                  >
                    {col.label}
                  </button>
                );
              })}
            </div>
          </div>
        </section>

        <section className="rounded-xl border border-gray-200 bg-white shadow-sm">
          <div className="hidden print:block print:mb-3">
            <h2 className="text-xl font-bold">{pageTitle}</h2>
            {reservationPayload && isRecord(reservationPayload) && typeof reservationPayload.id === 'number' ? (
              <p className="text-sm text-gray-700">Reservation #{reservationPayload.id}</p>
            ) : null}
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
                      {col.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredRows.map((row) => (
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
            {!filteredRows.length ? (
              <p className="p-6 text-center text-sm text-gray-500">
                Load a reservation to see slots, or adjust filters.
              </p>
            ) : null}
          </div>
        </section>
      </div>
    </div>
  );
}
