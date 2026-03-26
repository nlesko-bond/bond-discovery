'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  clampYmdRangeToMaxSpan,
  maxToYmdForFrom,
  minFromYmdForTo,
  todayLocalYmd,
  ymdFromLocalNoon,
} from '@/lib/form-responses-dates';
import { filterColumnsWithAnswersInRows } from '@/lib/form-question-visibility';
import {
  STAFF_INQUIRY_STATUS_LABELS,
  type FormResponsesPage,
  type FormResponseRow,
  type QuestionColumnMeta,
  type StaffInquiryStatus,
} from '@/types/form-pages';

const STAFF_STATUS_ORDER: StaffInquiryStatus[] = ['pending', 'in_progress', 'resolved'];

function answerTextForPrint(
  cell: { display?: string; linkUrl?: string; checkmark?: boolean } | undefined
): string {
  if (!cell) return '';
  if (cell.checkmark) return 'Yes';
  if (cell.linkUrl) return (cell.display?.trim() || cell.linkUrl).trim();
  return (cell.display ?? '').trim();
}

function ParticipantPrintDetail({
  row,
  columns,
}: {
  row: FormResponseRow;
  columns: QuestionColumnMeta[];
}) {
  const u = row.user;
  const name = [u?.firstName, u?.lastName].filter(Boolean).join(' ') || '—';
  const rowStatus = (row.staffStatus ?? 'pending') as StaffInquiryStatus;
  return (
    <div className="space-y-3 text-slate-900 print:py-1">
      <div className="flex flex-col gap-1 border-b border-slate-200 pb-2 print:border-slate-400">
        <p className="text-sm font-bold text-slate-900">{name}</p>
        <p className="text-xs text-slate-600 break-all">
          {[u?.email, u?.phone].filter(Boolean).join(' · ') || '—'}
        </p>
        <p className="text-xs text-slate-600">
          Submitted {new Date(row.createdAt).toLocaleString()} · Inquiry:{' '}
          {STAFF_INQUIRY_STATUS_LABELS[rowStatus]}
        </p>
      </div>
      <dl className="grid gap-3 sm:grid-cols-2 print:grid-cols-2 print:gap-2">
        {columns.map((c) => {
          const cell = row.answers[c.id];
          const label = c.question?.trim() || `Question ${c.id}`;
          const text = answerTextForPrint(cell);
          return (
            <div key={c.id} className="min-w-0">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500 mb-0.5 print:text-slate-600">
                {label}
              </dt>
              <dd className="text-xs text-slate-800 leading-snug break-words">{text || '—'}</dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

/** Default: hide Done. All: show every row. Completed only: find mistaken Done marks. */
type StatusViewFilter = 'active' | 'all' | 'completed_only';

const STATUS_SELECT_CLASSES: Record<StaffInquiryStatus, string> = {
  pending:
    'border-amber-400/90 bg-gradient-to-br from-amber-50 via-amber-50 to-orange-50/70 text-amber-950 shadow-sm ring-1 ring-amber-300/50 focus:outline-none focus:ring-2 focus:ring-amber-400/80',
  in_progress:
    'border-sky-500/80 bg-gradient-to-br from-sky-50 via-indigo-50/80 to-violet-50/60 text-sky-950 shadow-sm ring-1 ring-sky-300/50 focus:outline-none focus:ring-2 focus:ring-sky-400/80',
  resolved:
    'border-emerald-500/80 bg-gradient-to-br from-emerald-50 via-teal-50/80 to-cyan-50/50 text-emerald-950 shadow-sm ring-1 ring-emerald-300/50 focus:outline-none focus:ring-2 focus:ring-emerald-400/80',
};

type SortColumn = 'status' | 'submitted' | 'participant' | number;

/** Newest submission in the loaded set (for incremental refresh watermark). */
function computeNewestWatermark(rows: FormResponseRow[]): { createdAt: string; id: number } | null {
  if (rows.length === 0) return null;
  let best = rows[0];
  for (let i = 1; i < rows.length; i++) {
    const r = rows[i];
    const ta = new Date(r.createdAt).getTime();
    const tb = new Date(best.createdAt).getTime();
    if (ta > tb || (ta === tb && r.answerTitleId > best.answerTitleId)) {
      best = r;
    }
  }
  return { createdAt: best.createdAt, id: best.answerTitleId };
}

function mergeNewRowsAtTop(prev: FormResponseRow[], incoming: FormResponseRow[]): FormResponseRow[] {
  if (incoming.length === 0) return prev;
  const seen = new Set(prev.map((r) => r.answerTitleId));
  const fresh = incoming.filter((r) => !seen.has(r.answerTitleId));
  return [...fresh, ...prev];
}

function participantSortKey(row: FormResponseRow): string {
  const u = row.user;
  if (!u) return '\uFFFF';
  const ln = (u.lastName || '').toLowerCase();
  const fn = (u.firstName || '').toLowerCase();
  const em = (u.email || '').toLowerCase();
  return `${ln}\t${fn}\t${em}`;
}

function cellSortKey(row: FormResponseRow, qid: number): string {
  const cell = row.answers[qid];
  if (cell?.checkmark) return '1';
  if (cell?.linkUrl) return cell.linkUrl.toLowerCase();
  return (cell?.display || '').toLowerCase();
}

function statusSortKey(row: FormResponseRow): string {
  const s = row.staffStatus ?? 'pending';
  const i = STAFF_STATUS_ORDER.indexOf(s);
  return i >= 0 ? String(i).padStart(2, '0') : '99';
}

/** Client-only filter — never sent to the API or database. */
function rowMatchesClientSearch(row: FormResponseRow, query: string): boolean {
  const n = query.trim().toLowerCase();
  if (!n) return true;
  const u = row.user;
  const participant = [u?.firstName, u?.lastName, u?.email, u?.phone]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (participant.includes(n)) return true;
  if (new Date(row.createdAt).toLocaleString().toLowerCase().includes(n)) return true;
  const st = (row.staffStatus ?? 'pending') as StaffInquiryStatus;
  if (STAFF_INQUIRY_STATUS_LABELS[st].toLowerCase().includes(n)) return true;
  if (st.replace(/_/g, ' ').includes(n)) return true;
  for (const a of Object.values(row.answers)) {
    const hay = [
      a.checkmark ? 'yes' : '',
      a.display ?? '',
      a.linkUrl ?? '',
    ]
      .join(' ')
      .toLowerCase();
    if (hay.includes(n)) return true;
  }
  return false;
}

type PublicConfig = {
  slug: string;
  name: string;
  branding: {
    companyName: string;
    primaryColor: string;
    secondaryColor: string;
    accentColor: string;
    logo: string | null;
  };
  default_questionnaire_id: number;
  default_range_days: number;
  max_range_days_cap: number;
  requires_password: boolean;
};

export function FormResponsesStaffApp({ slug }: { slug: string }) {
  const [publicConfig, setPublicConfig] = useState<PublicConfig | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [authenticated, setAuthenticated] = useState(false);
  const [password, setPassword] = useState('');
  const [authError, setAuthError] = useState<string | null>(null);
  const [authLoading, setAuthLoading] = useState(false);

  const [questionnaireId, setQuestionnaireId] = useState<number | null>(null);
  const [columns, setColumns] = useState<QuestionColumnMeta[]>([]);
  const [questionnaireTitle, setQuestionnaireTitle] = useState<string | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<{ createdAt: string; id: number } | null>(null);
  const [accumulatedRows, setAccumulatedRows] = useState<FormResponsesPage['rows']>([]);
  const [sort, setSort] = useState<{ column: SortColumn; dir: 'asc' | 'desc' }>({
    column: 'submitted',
    dir: 'desc',
  });
  const [statusViewFilter, setStatusViewFilter] = useState<StatusViewFilter>('active');
  const [savingStatusId, setSavingStatusId] = useState<number | null>(null);
  const [statusSaveError, setStatusSaveError] = useState<string | null>(null);

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const accumulatedRowsRef = useRef<FormResponseRow[]>([]);
  accumulatedRowsRef.current = accumulatedRows;

  const base = `/api/form-responses/${encodeURIComponent(slug)}`;

  const visibleColumns = useMemo(
    () => filterColumnsWithAnswersInRows(columns, accumulatedRows),
    [columns, accumulatedRows]
  );

  useEffect(() => {
    if (typeof sort.column === 'number' && !visibleColumns.some((c) => c.id === sort.column)) {
      setSort({ column: 'submitted', dir: 'desc' });
    }
  }, [visibleColumns, sort.column]);

  const sortedRows = useMemo(() => {
    const copy = [...accumulatedRows];
    const { column: sortColumn, dir: sortDir } = sort;
    const mult = sortDir === 'asc' ? 1 : -1;
    copy.sort((a, b) => {
      if (sortColumn === 'status') {
        return statusSortKey(a).localeCompare(statusSortKey(b)) * mult;
      }
      if (sortColumn === 'submitted') {
        const ta = new Date(a.createdAt).getTime();
        const tb = new Date(b.createdAt).getTime();
        return (ta - tb) * mult;
      }
      if (sortColumn === 'participant') {
        return participantSortKey(a).localeCompare(participantSortKey(b)) * mult;
      }
      return cellSortKey(a, sortColumn).localeCompare(cellSortKey(b, sortColumn)) * mult;
    });
    return copy;
  }, [accumulatedRows, sort]);

  const statusFilteredRows = useMemo(() => {
    switch (statusViewFilter) {
      case 'all':
        return sortedRows;
      case 'completed_only':
        return sortedRows.filter((r) => (r.staffStatus ?? 'pending') === 'resolved');
      case 'active':
      default:
        return sortedRows.filter((r) => (r.staffStatus ?? 'pending') !== 'resolved');
    }
  }, [sortedRows, statusViewFilter]);

  const displayRows = useMemo(
    () => statusFilteredRows.filter((r) => rowMatchesClientSearch(r, search)),
    [statusFilteredRows, search]
  );

  const headerSort = useCallback((col: SortColumn) => {
    setSort((s) => {
      if (s.column === col) {
        return { column: col, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { column: col, dir: col === 'submitted' ? 'desc' : 'asc' };
    });
  }, []);

  function sortHint(col: SortColumn): string {
    if (sort.column !== col) return '';
    return sort.dir === 'asc' ? ' ↑' : ' ↓';
  }

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/config`, { cache: 'no-store' });
        if (!res.ok) {
          if (!cancelled) setLoadError('This page was not found or is inactive.');
          return;
        }
        const raw = (await res.json()) as Record<string, unknown>;
        if (!cancelled) {
          setPublicConfig(raw as unknown as PublicConfig);
          const cap = Math.min(Math.max(Number(raw.max_range_days_cap) || 90, 1), 365);
          const defaultDays = Math.min(Math.max(Number(raw.default_range_days) || 60, 1), cap);
          const end = new Date();
          end.setHours(12, 0, 0, 0);
          const start = new Date(end.getTime() - defaultDays * 86400000);
          const clamped = clampYmdRangeToMaxSpan(
            ymdFromLocalNoon(start),
            ymdFromLocalNoon(end),
            cap
          );
          setFrom(clamped.fromYmd);
          setTo(clamped.toYmd);
        }
      } catch {
        if (!cancelled) setLoadError('Failed to load page.');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [base]);

  /** Re-fetch after login so staff_lock and other flags match the server (avoids stale pre-auth cache). */
  useEffect(() => {
    if (!authenticated) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/config`, { cache: 'no-store' });
        if (!res.ok) return;
        const raw = (await res.json()) as Record<string, unknown>;
        if (!cancelled) {
          setPublicConfig(raw as unknown as PublicConfig);
        }
      } catch {
        /* keep existing config */
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, base]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      const res = await fetch(`${base}/session`, { credentials: 'include' });
      const data = await res.json();
      if (!cancelled && data.authenticated) setAuthenticated(true);
    })();
    return () => {
      cancelled = true;
    };
  }, [base]);

  /** Staff view always uses the page default questionnaire (no multi-form picker). */
  useEffect(() => {
    if (!authenticated || !publicConfig) return;
    setQuestionnaireId(publicConfig.default_questionnaire_id);
  }, [authenticated, publicConfig]);

  useEffect(() => {
    if (!authenticated || questionnaireId == null) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(
        `${base}/questions?questionnaireId=${questionnaireId}`,
        { credentials: 'include' }
      );
      if (!res.ok) return;
      const data = await res.json();
      if (!cancelled) setColumns(data.columns || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, questionnaireId, base]);

  const fetchRows = useCallback(
    async (append: boolean, nextCursor: { createdAt: string; id: number } | null) => {
      if (questionnaireId == null || !publicConfig) return;
      setRowsLoading(true);
      try {
        const sp = new URLSearchParams();
        sp.set('questionnaireId', String(questionnaireId));
        sp.set('from', from);
        sp.set('to', to);
        if (nextCursor) {
          sp.set('cursorCreatedAt', nextCursor.createdAt);
          sp.set('cursorId', String(nextCursor.id));
        }
        const res = await fetch(`${base}/rows?${sp}`, { credentials: 'include' });
        if (!res.ok) throw new Error('Failed to load responses');
        const json = await res.json();
        const data = json.data as FormResponsesPage;
        if (append) {
          setAccumulatedRows((r) => [...r, ...data.rows]);
        } else {
          setAccumulatedRows(data.rows);
        }
        setQuestionnaireTitle(data.questionnaireTitle);
        setCursor(data.nextCursor);
      } finally {
        setRowsLoading(false);
      }
    },
    [base, questionnaireId, from, to, publicConfig]
  );

  const refreshNewSubmissions = useCallback(async () => {
    if (questionnaireId == null || !publicConfig || !from || !to) return;
    const prev = accumulatedRowsRef.current;
    if (prev.length === 0) {
      fetchRows(false, null);
      return;
    }
    const wm = computeNewestWatermark(prev);
    if (!wm) return;
    const el = tableScrollRef.current;
    const beforeH = el?.scrollHeight ?? 0;
    const beforeTop = el?.scrollTop ?? 0;
    setRowsLoading(true);
    try {
      const sp = new URLSearchParams();
      sp.set('questionnaireId', String(questionnaireId));
      sp.set('from', from);
      sp.set('to', to);
      sp.set('sinceCreatedAt', wm.createdAt);
      sp.set('sinceId', String(wm.id));
      const res = await fetch(`${base}/rows?${sp}`, { credentials: 'include' });
      if (!res.ok) throw new Error('Failed to check for new responses');
      const json = await res.json();
      const data = json.data as FormResponsesPage;
      if (data.incremental) {
        setAccumulatedRows((p) => mergeNewRowsAtTop(p, data.rows));
        setQuestionnaireTitle(data.questionnaireTitle);
        requestAnimationFrame(() => {
          const node = tableScrollRef.current;
          if (node) {
            node.scrollTop = beforeTop + (node.scrollHeight - beforeH);
          }
        });
      }
    } finally {
      setRowsLoading(false);
    }
  }, [base, questionnaireId, from, to, publicConfig, fetchRows]);

  useEffect(() => {
    if (!authenticated || questionnaireId == null || !from || !to) return;
    setCursor(null);
    fetchRows(false, null);
  }, [authenticated, questionnaireId, from, to, fetchRows]);

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault();
    setAuthError(null);
    setAuthLoading(true);
    try {
      const res = await fetch(`${base}/auth`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        setAuthError(err.error || 'Login failed');
        return;
      }
      setAuthenticated(true);
      setPassword('');
    } finally {
      setAuthLoading(false);
    }
  }

  const exportHref = useMemo(() => {
    if (questionnaireId == null || !from || !to) return '';
    const sp = new URLSearchParams();
    sp.set('questionnaireId', String(questionnaireId));
    sp.set('from', from);
    sp.set('to', to);
    return `${base}/export?${sp}`;
  }, [base, questionnaireId, from, to]);

  const capDays = useMemo(
    () => Math.min(Math.max(publicConfig?.max_range_days_cap ?? 90, 1), 365),
    [publicConfig?.max_range_days_cap]
  );

  const fromDateMin = useMemo(
    () => (to ? minFromYmdForTo(to, capDays) : undefined),
    [to, capDays]
  );

  const toDateMax = useMemo(
    () => (from ? maxToYmdForFrom(from, capDays) : todayLocalYmd()),
    [from, capDays]
  );

  const handleFromChange = useCallback(
    (v: string) => {
      const end = to || v;
      const next = clampYmdRangeToMaxSpan(v, end, capDays);
      setFrom(next.fromYmd);
      setTo(next.toYmd);
    },
    [to, capDays]
  );

  const handleToChange = useCallback(
    (v: string) => {
      const start = from || v;
      const next = clampYmdRangeToMaxSpan(start, v, capDays);
      setFrom(next.fromYmd);
      setTo(next.toYmd);
    },
    [from, capDays]
  );

  const setRowStatus = useCallback(
    async (answerTitleId: number, status: StaffInquiryStatus) => {
      setStatusSaveError(null);
      setSavingStatusId(answerTitleId);
      try {
        const res = await fetch(`${base}/status`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          credentials: 'include',
          body: JSON.stringify({ answerTitleId, status }),
        });
        if (!res.ok) {
          const err = (await res.json().catch(() => ({}))) as { error?: string };
          setStatusSaveError(err.error || 'Could not save status');
          return;
        }
        setAccumulatedRows((prev) =>
          prev.map((r) => (r.answerTitleId === answerTitleId ? { ...r, staffStatus: status } : r))
        );
      } finally {
        setSavingStatusId(null);
      }
    },
    [base]
  );

  if (loadError && !publicConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <p className="text-red-700">{loadError}</p>
      </div>
    );
  }

  if (!publicConfig) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100">
        <div className="animate-pulse text-slate-500">Loading…</div>
      </div>
    );
  }

  const b = publicConfig.branding;

  if (!publicConfig.requires_password) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-100 p-6">
        <div className="max-w-md bg-white rounded-xl shadow border p-8 text-center">
          <h1 className="text-xl font-semibold text-slate-900">{publicConfig.name}</h1>
          <p className="mt-3 text-slate-600 text-sm">
            Staff access is not configured yet. A Bond admin must set a password for this page in the
            Discovery admin console.
          </p>
        </div>
      </div>
    );
  }

  if (!authenticated) {
    return (
      <div
        className="min-h-screen flex items-center justify-center p-6"
        style={{
          background: `linear-gradient(135deg, ${b.primaryColor}12, ${b.secondaryColor}18)`,
        }}
      >
        <form
          onSubmit={handleLogin}
          className="w-full max-w-md bg-white rounded-xl shadow-lg border border-slate-200 p-8"
        >
          <div className="flex flex-col items-center gap-2 mb-6">
            {b.logo ? (
              <img src={b.logo} alt="" className="h-12 w-auto object-contain" />
            ) : null}
            <h1 className="text-xl font-bold text-slate-900 text-center">{b.companyName}</h1>
            <p className="text-sm text-slate-500 text-center">{publicConfig.name}</p>
          </div>
          <label className="block text-sm font-medium text-slate-700 mb-1">Password</label>
          <input
            type="password"
            autoComplete="current-password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm mb-4"
            required
          />
          {authError ? <p className="text-sm text-red-600 mb-3">{authError}</p> : null}
          <button
            type="submit"
            disabled={authLoading}
            className="w-full py-2.5 rounded-lg text-white text-sm font-semibold disabled:opacity-50"
            style={{ backgroundColor: b.primaryColor }}
          >
            {authLoading ? 'Signing in…' : 'View responses'}
          </button>
        </form>
      </div>
    );
  }

  /** Fully opaque tint (no alpha hex) so sticky headers hide scrolling rows */
  const stickyHeaderBg = `color-mix(in srgb, ${b.primaryColor} 13%, rgb(241 245 249))`;

  return (
    <div
      className="form-responses-print-root min-h-screen print:bg-white"
      style={{
        background: `linear-gradient(165deg, ${b.primaryColor}0d 0%, rgb(248 250 252) 22%, rgb(241 245 249) 55%, rgb(248 250 252) 100%)`,
      }}
    >
      <header
        className="form-responses-no-print border-b border-slate-200/90 bg-white/95 backdrop-blur-sm sticky top-0 z-20 shadow-sm shadow-slate-200/40"
        style={{ borderBottomColor: `${b.primaryColor}40` }}
      >
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center gap-x-4 gap-y-2 justify-between">
          <div className="flex items-center gap-3 min-w-0">
            {b.logo ? <img src={b.logo} alt="" className="h-9 w-auto object-contain shrink-0" /> : null}
            <div className="min-w-0">
              <h1 className="text-lg font-bold text-slate-900 truncate">{b.companyName}</h1>
              <p className="text-xs text-slate-500 truncate">{publicConfig.name}</p>
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <a
              href={exportHref || '#'}
              download={`form-responses-${slug}.csv`}
              className="inline-flex items-center gap-1.5 text-sm px-3 py-2 rounded-xl border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50/90 transition-colors"
              style={!exportHref ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
            >
              Download CSV
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="text-sm px-3 py-2 rounded-xl border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50/90 transition-colors"
            >
              Print
            </button>
            <button
              type="button"
              onClick={() => void refreshNewSubmissions()}
              disabled={rowsLoading || questionnaireId == null}
              title="Load only submissions newer than your newest loaded row. Keeps filters, search, and &quot;Load more&quot; position."
              className="text-sm px-3 py-2 rounded-xl border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50/90 transition-colors disabled:opacity-50"
            >
              Refresh new
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6 space-y-4 form-responses-no-print">
        <div
          className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-md shadow-slate-200/50 space-y-4"
          style={{ borderLeftWidth: 4, borderLeftColor: b.primaryColor }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="w-full sm:w-auto sm:min-w-[240px]">
              <p className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Form
              </p>
              <p
                className="text-sm font-semibold text-slate-900 rounded-xl border-2 px-3 py-2.5 shadow-sm"
                style={{
                  borderColor: b.primaryColor,
                  background: `linear-gradient(135deg, ${b.primaryColor}18, ${b.secondaryColor}14)`,
                }}
              >
                {questionnaireTitle?.trim()
                  ? questionnaireTitle
                  : `Default form (ID ${publicConfig.default_questionnaire_id})`}
              </p>
            </div>
            <div className="flex flex-wrap gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  From
                </label>
                <input
                  type="date"
                  value={from}
                  min={fromDateMin}
                  max={to || undefined}
                  onChange={(e) => handleFromChange(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/80"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                  To
                </label>
                <input
                  type="date"
                  value={to}
                  min={from || undefined}
                  max={toDateMax}
                  onChange={(e) => handleToChange(e.target.value)}
                  className="rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/80"
                />
              </div>
            </div>
            <div className="flex-1 min-w-[min(100%,240px)] lg:max-w-xl">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Search
              </label>
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Filter loaded rows — names, email, answers…"
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 placeholder:text-slate-400 shadow-inner focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/80"
              />
            </div>
            <div className="w-full sm:w-auto sm:max-w-[min(100%,22rem)]">
              <p className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Inquiry view
              </p>
              <div
                className="inline-flex flex-wrap gap-0.5 rounded-2xl border border-slate-200/90 bg-slate-100/80 p-1 shadow-inner"
                role="group"
                aria-label="Filter by inquiry status"
              >
                {(
                  [
                    ['active', 'Active'],
                    ['all', 'All'],
                    ['completed_only', 'Completed only'],
                  ] as const
                ).map(([key, label]) => {
                  const selected = statusViewFilter === key;
                  return (
                    <button
                      key={key}
                      type="button"
                      onClick={() => setStatusViewFilter(key)}
                      className={`px-3 py-2 text-sm rounded-xl font-semibold transition-colors ${
                        selected
                          ? 'text-white shadow-md'
                          : 'text-slate-600 hover:text-slate-900 hover:bg-white/50'
                      }`}
                      style={
                        selected
                          ? { backgroundColor: b.primaryColor, boxShadow: `0 2px 8px ${b.primaryColor}55` }
                          : undefined
                      }
                    >
                      {label}
                    </button>
                  );
                })}
              </div>
              <p className="text-xs text-slate-500 mt-1.5 leading-snug">
                Active hides Done. <span className="font-medium text-slate-600">Completed only</span> finds rows
                marked Done so you can fix them.
              </p>
            </div>
          </div>
        </div>
        {statusSaveError ? (
          <p className="text-sm text-red-600" role="alert">
            {statusSaveError}
          </p>
        ) : null}
        {questionnaireTitle ? (
          <p className="text-sm text-slate-800 font-semibold">Form: {questionnaireTitle}</p>
        ) : null}
        {accumulatedRows.length > 0 && displayRows.length < accumulatedRows.length ? (
          <p className="text-xs text-slate-600">
            Showing <span className="font-semibold tabular-nums">{displayRows.length}</span> of{' '}
            <span className="font-semibold tabular-nums">{accumulatedRows.length}</span> loaded rows
            {search.trim() ? ' (search)' : ''}
            {statusViewFilter === 'active' &&
            accumulatedRows.some((r) => (r.staffStatus ?? 'pending') === 'resolved')
              ? ' · Done hidden'
              : ''}
            {statusViewFilter === 'completed_only' ? ' · completed only' : ''}
            .
          </p>
        ) : null}
      </main>

      <div className="max-w-[1600px] mx-auto px-4 pb-12">
        <p className="form-responses-no-print hidden md:block text-xs text-slate-500 mb-2 leading-snug">
          Tip: On desktop, Status, Submitted, and Participant stay pinned when you scroll sideways to read
          answers.
        </p>
        <div
          ref={tableScrollRef}
          tabIndex={0}
          role="region"
          aria-label="Form responses table. Use arrow keys or swipe to scroll horizontally."
          className="form-responses-print-scroll rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-200/40 overflow-x-auto max-h-[min(75vh,calc(100dvh-13rem))] overflow-y-auto print:max-h-none print:overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
        >
          <div className="hidden print:block px-3 pt-3 pb-1 print:border-b print:border-slate-300">
            <p className="text-sm font-bold text-slate-900">
              {b.companyName} · {questionnaireTitle || publicConfig.name}
            </p>
            {from && to ? (
              <p className="text-xs text-slate-600 mt-0.5">
                Submissions {from} – {to}
                {displayRows.length < accumulatedRows.length
                  ? ` · showing ${displayRows.length} of ${accumulatedRows.length} loaded`
                  : ''}
                {statusViewFilter === 'active' &&
                accumulatedRows.some((r) => (r.staffStatus ?? 'pending') === 'resolved')
                  ? ' · Done hidden'
                  : ''}
                {statusViewFilter === 'completed_only' ? ' · completed only' : ''}
              </p>
            ) : null}
          </div>
          <table className="form-responses-print-table min-w-max w-full text-sm print:text-xs border-collapse isolate">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle w-[9.5rem] min-w-[8.5rem] box-border shrink-0 sticky top-0 z-30 print:static md:left-0 md:z-[41] md:border-r md:border-slate-200/90 md:shadow-[2px_0_8px_-4px_rgba(15,23,42,0.08)]"
                  style={{
                    backgroundColor: stickyHeaderBg,
                    boxShadow: 'inset 0 -1px 0 0 rgb(226 232 240)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => headerSort('status')}
                    className="text-left w-full min-h-[2.75rem] flex items-center font-semibold text-slate-900 hover:opacity-80 leading-snug"
                  >
                    Status{sortHint('status')}
                  </button>
                </th>
                <th
                  scope="col"
                  className="text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle w-[9rem] min-w-[8rem] box-border shrink-0 sticky top-0 z-30 print:static md:left-[9.5rem] md:z-[42] md:border-r md:border-slate-200/90 md:shadow-[2px_0_8px_-4px_rgba(15,23,42,0.08)]"
                  style={{
                    backgroundColor: stickyHeaderBg,
                    boxShadow: 'inset 0 -1px 0 0 rgb(226 232 240)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => headerSort('submitted')}
                    className="text-left w-full min-h-[2.75rem] flex items-center font-semibold text-slate-900 hover:opacity-80 leading-snug"
                  >
                    Submitted{sortHint('submitted')}
                  </button>
                </th>
                <th
                  scope="col"
                  className="text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle w-[11rem] min-w-[9rem] max-w-[11rem] box-border shrink-0 sticky top-0 z-30 print:static md:left-[18.5rem] md:z-[43] md:border-r md:border-slate-300/90 md:shadow-[3px_0_10px_-4px_rgba(15,23,42,0.1)]"
                  style={{
                    backgroundColor: stickyHeaderBg,
                    boxShadow: 'inset 0 -1px 0 0 rgb(226 232 240)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => headerSort('participant')}
                    className="text-left w-full min-h-[2.75rem] flex items-center font-semibold text-slate-900 hover:opacity-80"
                  >
                    <span className="block leading-snug whitespace-normal break-words">
                      Participant{sortHint('participant')}
                    </span>
                  </button>
                </th>
                {visibleColumns.map((c) => (
                  <th
                    key={c.id}
                    scope="col"
                    className="text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle min-w-[8.5rem] max-w-[13rem] w-[11rem] sticky top-0 z-20 print:static"
                    style={{
                      backgroundColor: stickyHeaderBg,
                      boxShadow: 'inset 0 -1px 0 0 rgb(226 232 240)',
                    }}
                  >
                    <button
                      type="button"
                      onClick={() => headerSort(c.id)}
                      className="text-left w-full min-h-[2.75rem] flex items-center font-semibold text-slate-900 hover:opacity-80"
                    >
                      <span className="block leading-snug whitespace-normal break-words">
                        {c.question?.trim() || `Q ${c.id}`}
                        {sortHint(c.id)}
                      </span>
                    </button>
                  </th>
                ))}
              </tr>
            </thead>
          {rowsLoading && accumulatedRows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={3 + Math.max(visibleColumns.length, 1)} className="p-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            </tbody>
          ) : accumulatedRows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={3 + Math.max(visibleColumns.length, 1)} className="p-8 text-center text-slate-500">
                  No responses in this range.
                </td>
              </tr>
            </tbody>
          ) : displayRows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={3 + Math.max(visibleColumns.length, 1)} className="p-8 text-center text-slate-500">
                  No loaded rows match your filters. Clear search, switch Inquiry view (All / Completed
                  only), or load more responses.
                </td>
              </tr>
            </tbody>
          ) : (
            displayRows.map((row) => {
              const rowStatus = (row.staffStatus ?? 'pending') as StaffInquiryStatus;
              const colSpan = 3 + Math.max(visibleColumns.length, 1);
              return (
                <tbody key={row.answerTitleId} className="form-responses-print-row-group">
                  <tr className="group border-t border-slate-100 hover:bg-slate-50/90">
                    <td
                      className={`p-2 align-top text-slate-800 w-[9.5rem] min-w-[8.5rem] max-w-[9.5rem] box-border shrink-0 bg-white md:sticky md:left-0 md:z-[15] md:border-r md:border-slate-200/90 md:shadow-[2px_0_8px_-4px_rgba(15,23,42,0.06)] md:group-hover:bg-slate-50/90 print:static print:bg-transparent`}
                    >
                      <label className="sr-only" htmlFor={`status-${row.answerTitleId}`}>
                        Status
                      </label>
                      <select
                        id={`status-${row.answerTitleId}`}
                        value={rowStatus}
                        disabled={savingStatusId === row.answerTitleId}
                        onChange={(e) =>
                          void setRowStatus(row.answerTitleId, e.target.value as StaffInquiryStatus)
                        }
                        className={`w-full max-w-[11rem] rounded-xl px-2.5 py-2 text-xs sm:text-sm font-semibold disabled:opacity-60 ${STATUS_SELECT_CLASSES[rowStatus]}`}
                        style={{ accentColor: b.accentColor }}
                      >
                        {STAFF_STATUS_ORDER.map((s) => (
                          <option key={s} value={s}>
                            {STAFF_INQUIRY_STATUS_LABELS[s]}
                          </option>
                        ))}
                      </select>
                    </td>
                    <td
                      className="p-3 align-top text-slate-600 whitespace-nowrap text-xs sm:text-sm w-[9rem] min-w-[8rem] max-w-[9rem] box-border shrink-0 bg-white md:sticky md:left-[9.5rem] md:z-[16] md:border-r md:border-slate-200/90 md:shadow-[2px_0_8px_-4px_rgba(15,23,42,0.06)] md:group-hover:bg-slate-50/90 print:static print:bg-transparent"
                    >
                      {new Date(row.createdAt).toLocaleString()}
                    </td>
                    <td
                      className="p-3 align-top text-slate-800 w-[11rem] min-w-[9rem] max-w-[11rem] box-border shrink-0 break-words text-sm bg-white md:sticky md:left-[18.5rem] md:z-[17] md:border-r md:border-slate-300/90 md:shadow-[3px_0_10px_-4px_rgba(15,23,42,0.08)] md:group-hover:bg-slate-50/90 print:static print:bg-transparent"
                    >
                      {row.user ? (
                        <div>
                          <div className="font-medium">
                            {[row.user.firstName, row.user.lastName].filter(Boolean).join(' ') || '—'}
                          </div>
                          <div className="text-xs text-slate-500 break-all">{row.user.email || ''}</div>
                        </div>
                      ) : (
                        '—'
                      )}
                    </td>
                    {visibleColumns.map((c) => {
                      const cell = row.answers[c.id];
                      return (
                        <td
                          key={c.id}
                          className="p-3 align-top text-slate-800 max-w-[13rem] w-[11rem] break-words text-sm"
                        >
                          {cell?.checkmark ? (
                            <span className="text-lg text-emerald-700" title="Yes" aria-label="Yes">
                              ✓
                            </span>
                          ) : cell?.linkUrl ? (
                            <a
                              href={cell.linkUrl}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="text-blue-600 underline"
                            >
                              {cell.display || 'Open'}
                            </a>
                          ) : (
                            cell?.display || ''
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="form-responses-print-participant-detail" aria-hidden="true">
                    <td colSpan={colSpan} className="p-0 border-0 print:p-3 print:bg-slate-50/80">
                      <ParticipantPrintDetail row={row} columns={visibleColumns} />
                    </td>
                  </tr>
                </tbody>
              );
            })
          )}
        </table>
        </div>
        {cursor ? (
          <div className="form-responses-no-print mt-4 flex justify-center">
            <button
              type="button"
              disabled={rowsLoading}
              onClick={() => fetchRows(true, cursor)}
              className="px-4 py-2 rounded-lg text-white text-sm font-medium disabled:opacity-50"
              style={{ backgroundColor: b.primaryColor }}
            >
              {rowsLoading ? 'Loading…' : 'Load more'}
            </button>
          </div>
        ) : null}
      </div>
    </div>
  );
}
