'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import type {
  FormResponsesPage,
  QuestionColumnMeta,
  QuestionnaireListItem,
} from '@/types/form-pages';

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

function formatDateInput(d: Date): string {
  return d.toISOString().slice(0, 10);
}

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
  const [searchDebounced, setSearchDebounced] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<{ createdAt: string; id: number } | null>(null);
  const [accumulatedRows, setAccumulatedRows] = useState<FormResponsesPage['rows']>([]);

  const base = `/api/form-responses/${encodeURIComponent(slug)}`;

  useEffect(() => {
    const t = setTimeout(() => setSearchDebounced(search), 350);
    return () => clearTimeout(t);
  }, [search]);

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
          const end = new Date();
          const start = new Date(end);
          start.setUTCDate(start.getUTCDate() - (data.default_range_days || 60));
          setTo(formatDateInput(end));
          setFrom(formatDateInput(start));
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
        if (searchDebounced.trim()) sp.set('q', searchDebounced.trim());
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
    [base, questionnaireId, from, to, searchDebounced, publicConfig]
  );

  useEffect(() => {
    if (!authenticated || questionnaireId == null || !from || !to) return;
    setCursor(null);
    fetchRows(false, null);
  }, [authenticated, questionnaireId, from, to, searchDebounced, fetchRows]);

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
    if (searchDebounced.trim()) sp.set('q', searchDebounced.trim());
    return `${base}/export?${sp}`;
  }, [base, questionnaireId, from, to, searchDebounced]);

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
    <div className="min-h-screen bg-slate-50 print:bg-white">
      <header
        className="form-responses-no-print border-b border-slate-200 bg-white sticky top-0 z-20"
        style={{ borderBottomColor: `${b.primaryColor}33` }}
      >
        <div className="max-w-[1600px] mx-auto px-4 py-3 flex flex-wrap items-center gap-4 justify-between">
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
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
              style={!exportHref ? { pointerEvents: 'none', opacity: 0.5 } : undefined}
            >
              Download CSV
            </a>
            <button
              type="button"
              onClick={() => window.print()}
              className="text-sm px-3 py-1.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50"
            >
              Print
            </button>
          </div>
        </div>
      </header>

      <main className="max-w-[1600px] mx-auto px-4 py-6 space-y-4 form-responses-no-print">
        <div className="flex flex-wrap gap-3 items-end">
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">Form</label>
            <select
              value={questionnaireId ?? ''}
              onChange={(e) => setQuestionnaireId(Number(e.target.value))}
              className="border border-slate-300 rounded-lg px-2 py-2 text-sm min-w-[200px]"
            >
              {questionnaires.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.title || `Form ${q.id}`}
                </option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">From</label>
            <input
              type="date"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
            />
          </div>
          <div>
            <label className="block text-xs font-medium text-slate-600 mb-1">To</label>
            <input
              type="date"
              value={to}
              onChange={(e) => setTo(e.target.value)}
              className="border border-slate-300 rounded-lg px-2 py-2 text-sm"
            />
          </div>
          <div className="flex-1 min-w-[180px] max-w-md">
            <label className="block text-xs font-medium text-slate-600 mb-1">Search answers</label>
            <input
              type="search"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Filter current result set…"
              className="w-full border border-slate-300 rounded-lg px-2 py-2 text-sm"
            />
          </div>
        </div>
        {questionnaireTitle ? (
          <p className="text-sm text-slate-700 font-medium">Form: {questionnaireTitle}</p>
        ) : null}
        <p className="text-xs text-slate-500">
          Showing up to {publicConfig.max_range_days_cap} days per range · sensitive data — do not share
          links publicly.
        </p>
        {authenticated && questionnaires.length === 0 ? (
          <p className="text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            No questionnaires found for this organization in the database. Check org ID and replica
            connectivity.
          </p>
        ) : null}
      </main>

      <div className="max-w-[1600px] mx-auto px-4 pb-10 overflow-x-auto">
        <table className="min-w-max max-w-full text-sm border border-slate-200 bg-white rounded-lg overflow-hidden print:text-xs">
          <thead>
            <tr style={{ backgroundColor: `${b.primaryColor}14` }}>
              <th className="text-left p-2 border-b border-slate-200 font-semibold whitespace-nowrap align-bottom w-[9.5rem]">
                Submitted
              </th>
              <th className="text-left p-2 border-b border-slate-200 font-semibold align-bottom min-w-[10rem] max-w-[13rem]">
                <span className="line-clamp-3 block leading-snug">Participant</span>
              </th>
              {columns.map((c) => (
                <th
                  key={c.id}
                  className="text-left p-2 border-b border-slate-200 font-semibold align-bottom min-w-[11rem] max-w-[15rem] w-[15rem]"
                >
                  <span className="line-clamp-3 block leading-snug text-slate-900 break-words">
                    {c.question?.trim() || `Q ${c.id}`}
                  </span>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rowsLoading && accumulatedRows.length === 0 ? (
              <tr>
                <td colSpan={2 + columns.length} className="p-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            ) : accumulatedRows.length === 0 ? (
              <tr>
                <td colSpan={2 + columns.length} className="p-8 text-center text-slate-500">
                  No responses in this range.
                </td>
              </tr>
            ) : (
              accumulatedRows.map((row) => (
                <tr key={row.answerTitleId} className="border-t border-slate-100 hover:bg-slate-50/80">
                  <td className="p-2 align-top text-slate-600 whitespace-nowrap">
                    {new Date(row.createdAt).toLocaleString()}
                  </td>
                  <td className="p-2 align-top text-slate-800 min-w-[10rem] max-w-[13rem] break-words">
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
                  {columns.map((c) => {
                    const cell = row.answers[c.id];
                    return (
                      <td key={c.id} className="p-2 align-top text-slate-800 max-w-[15rem] w-[15rem] break-words">
                        {cell?.linkUrl ? (
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
