'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  clampYmdRangeToMaxSpan,
  maxToYmdForFrom,
  minFromYmdForTo,
  todayLocalYmd,
  ymdFromLocalNoon,
} from '@/lib/form-responses-dates';
import { filterColumnsWithAnswersInRows } from '@/lib/form-question-visibility';
import type {
  FormResponsesPage,
  FormResponseRow,
  QuestionColumnMeta,
  QuestionnaireListItem,
} from '@/types/form-pages';

function GoogleSheetsMark({ className }: { className?: string }) {
  return (
    <svg
      className={className}
      width="18"
      height="18"
      viewBox="0 0 48 48"
      aria-hidden
      focusable="false"
    >
      <path fill="#0F9D58" d="M6 6h18v18H6z" />
      <path fill="#F4B400" d="M24 6h18v18H24z" />
      <path fill="#DB4437" d="M6 24h18v18H6z" />
      <path fill="#4285F4" d="M24 24h18v18H24z" />
    </svg>
  );
}

type SortColumn = 'submitted' | 'participant' | number;

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

  const [questionnaires, setQuestionnaires] = useState<QuestionnaireListItem[]>([]);
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

  const displayRows = useMemo(
    () => sortedRows.filter((r) => rowMatchesClientSearch(r, search)),
    [sortedRows, search]
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
        const res = await fetch(`${base}/config`);
        if (!res.ok) {
          if (!cancelled) setLoadError('This page was not found or is inactive.');
          return;
        }
        const data = (await res.json()) as PublicConfig;
        if (!cancelled) {
          setPublicConfig(data);
          const cap = Math.min(Math.max(data.max_range_days_cap || 90, 1), 365);
          const defaultDays = Math.min(Math.max(data.default_range_days || 60, 1), cap);
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

  useEffect(() => {
    if (!authenticated || !publicConfig) return;
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch(`${base}/questionnaires`, { credentials: 'include' });
        if (!res.ok) throw new Error('Could not load forms list');
        const data = await res.json();
        const list = (data.questionnaires || []) as QuestionnaireListItem[];
        if (cancelled) return;
        setQuestionnaires(list);
        const def = publicConfig.default_questionnaire_id;
        const hasDef = list.some((q) => q.id === def);
        setQuestionnaireId(hasDef ? def : list[0]?.id ?? null);
      } catch (e) {
        if (!cancelled) setLoadError(e instanceof Error ? e.message : 'Failed to load forms');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, publicConfig, base]);

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

  return (
    <div
      className="min-h-screen print:bg-white"
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
            <a
              href={exportHref || '#'}
              download={`form-responses-${slug}.csv`}
              title="Identical CSV to Download. No Google sign-in: open the file in Sheets yourself (File → Import)."
              className="inline-flex items-center gap-2 text-sm px-3 py-2 rounded-xl border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50/90 transition-colors"
              style={!exportHref ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
            >
              <GoogleSheetsMark className="shrink-0" />
              <span className="hidden sm:inline">Sheets (CSV)</span>
              <span className="sm:hidden">Sheets</span>
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="text-sm px-3 py-2 rounded-xl border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50/90 transition-colors"
            >
              Print
            </button>
          </div>
          <p className="w-full basis-full text-[11px] text-slate-500 leading-snug border-t border-slate-100 pt-2 mt-1">
            Exports use your staff session cookie to this app only. Google is not involved until you
            manually import the downloaded file in Sheets.
          </p>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6 space-y-4 form-responses-no-print">
        <div
          className="rounded-2xl border border-slate-200/90 bg-white p-4 sm:p-5 shadow-md shadow-slate-200/50 space-y-4"
          style={{ borderLeftWidth: 4, borderLeftColor: b.primaryColor }}
        >
          <div className="flex flex-col gap-4 lg:flex-row lg:flex-wrap lg:items-end">
            <div className="w-full sm:w-auto sm:min-w-[220px]">
              <label className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5">
                Form
              </label>
              <select
                value={questionnaireId ?? ''}
                onChange={(e) => setQuestionnaireId(Number(e.target.value))}
                className="w-full rounded-xl border border-slate-200 bg-slate-50/50 px-3 py-2.5 text-sm text-slate-900 shadow-inner focus:border-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-200/80"
              >
                {questionnaires.map((q) => (
                  <option key={q.id} value={q.id}>
                    {q.title || `Form ${q.id}`}
                  </option>
                ))}
              </select>
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
              <p className="mt-1 text-[11px] text-slate-500 leading-relaxed">
                Runs in your browser on rows already loaded (and &quot;Load more&quot;). Not case-sensitive.
                Does not query Bond or change which submissions are fetched.
              </p>
            </div>
          </div>
        </div>
        {questionnaireTitle ? (
          <p className="text-sm text-slate-800 font-semibold">Form: {questionnaireTitle}</p>
        ) : null}
        {search.trim() && accumulatedRows.length > 0 ? (
          <p className="text-xs text-slate-600">
            Showing <span className="font-semibold tabular-nums">{displayRows.length}</span> of{' '}
            <span className="font-semibold tabular-nums">{accumulatedRows.length}</span> loaded rows.
          </p>
        ) : null}
        <p className="text-xs text-slate-500 leading-relaxed">
          Date range is limited to {capDays} days (admin cap). The server enforces this on every
          request — nothing is cached long-term; each load queries the Bond replica.
        </p>
        {authenticated && questionnaires.length === 0 ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No questionnaires found for this organization in the database. Check org ID and replica
            connectivity.
          </p>
        ) : null}
      </main>

      <div className="max-w-[1600px] mx-auto px-4 pb-12">
        <div className="rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-200/40 overflow-x-auto max-h-[min(75vh,calc(100dvh-13rem))] overflow-y-auto print:max-h-none print:overflow-visible">
          <table className="min-w-max w-full text-sm print:text-xs border-collapse">
            <thead>
              <tr>
                <th
                  scope="col"
                  className="text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle w-[9rem] min-w-[8rem] sticky top-0 z-10 print:static shadow-[inset_0_-1px_0_0_rgb(226_232_240)]"
                  style={{ backgroundColor: `${b.primaryColor}18` }}
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
                  className="text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle min-w-[9rem] max-w-[11rem] sticky top-0 z-10 print:static shadow-[inset_0_-1px_0_0_rgb(226_232_240)]"
                  style={{ backgroundColor: `${b.primaryColor}18` }}
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
                    className="text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle min-w-[8.5rem] max-w-[13rem] w-[11rem] sticky top-0 z-10 print:static shadow-[inset_0_-1px_0_0_rgb(226_232_240)]"
                    style={{ backgroundColor: `${b.primaryColor}18` }}
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
          <tbody>
            {rowsLoading && accumulatedRows.length === 0 ? (
              <tr>
                <td colSpan={2 + Math.max(visibleColumns.length, 1)} className="p-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : accumulatedRows.length === 0 ? (
              <tr>
                <td colSpan={2 + Math.max(visibleColumns.length, 1)} className="p-8 text-center text-slate-500">
                  No responses in this range.
                </td>
              </tr>
            ) : displayRows.length === 0 ? (
              <tr>
                <td colSpan={2 + Math.max(visibleColumns.length, 1)} className="p-8 text-center text-slate-500">
                  No loaded rows match this search. Clear search or load more responses.
                </td>
              </tr>
            ) : (
              displayRows.map((row) => (
                <tr key={row.answerTitleId} className="border-t border-slate-100 hover:bg-slate-50/90">
                  <td className="p-3 align-top text-slate-600 whitespace-nowrap text-xs sm:text-sm">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="p-3 align-top text-slate-800 min-w-[9rem] max-w-[11rem] break-words text-sm">
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
              ))
            )}
          </tbody>
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
