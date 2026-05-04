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
  type QuestionnaireListItem,
  type StaffInquiryStatus,
} from '@/types/form-pages';

const STAFF_STATUS_ORDER: StaffInquiryStatus[] = ['pending', 'in_progress', 'resolved'];
const DEFAULT_SORT = { column: 'submitted' as SortColumn, dir: 'desc' as const };
const SHORT_TEXT_MAX_CHARS = 12;
const MEDIUM_TEXT_MAX_CHARS = 36;
const WIDE_TEXT_MIN_CHARS = 80;
const COLUMN_SAMPLE_LIMIT = 50;
const AUTO_LOAD_MAX_ROWS = 2000;
const NARROW_COLUMN_WIDTH_PX = 112;
const MEDIUM_COLUMN_WIDTH_PX = 160;
const DEFAULT_COLUMN_WIDTH_PX = 192;
const WIDE_COLUMN_WIDTH_PX = 288;
const MIN_RESIZABLE_COLUMN_WIDTH_PX = 96;
const MAX_RESIZABLE_COLUMN_WIDTH_PX = 480;
const PRINT_GROUPED_COLUMN_THRESHOLD = 10;
const HEX_SHORT_LENGTH = 3;
const HEX_LONG_LENGTH = 6;
const HEX_BYTE_LENGTH = 2;
const HEX_RADIX = 16;
const RGB_MAX = 255;
const LIGHT_COLOR_LUMINANCE_THRESHOLD = 0.58;
const RED_LUMINANCE_WEIGHT = 0.2126;
const GREEN_LUMINANCE_WEIGHT = 0.7152;
const BLUE_LUMINANCE_WEIGHT = 0.0722;
const HEX_COLOR_REGEX = /^[0-9a-fA-F]{6}$/;
const NARROW_COLUMN_CLASSES = 'min-w-[6rem] max-w-[8rem] w-[7rem]';
const MEDIUM_COLUMN_CLASSES = 'min-w-[8rem] max-w-[12rem] w-[10rem]';
const DEFAULT_COLUMN_CLASSES = 'min-w-[10rem] max-w-[15rem] w-[12rem]';
const WIDE_COLUMN_CLASSES = 'min-w-[14rem] max-w-[24rem] w-[18rem]';
const TRUNCATED_ANSWER_CLASSES = 'block line-clamp-3 break-words';
const submittedDateFormatter = new Intl.DateTimeFormat(undefined, {
  year: 'numeric',
  month: 'numeric',
  day: 'numeric',
});
const submittedTimeFormatter = new Intl.DateTimeFormat(undefined, {
  hour: 'numeric',
  minute: '2-digit',
  second: '2-digit',
});
const STRING_SORT_OPTIONS: Intl.CollatorOptions = {
  numeric: true,
  sensitivity: 'base',
};

function hexToRgb(hex: string): { r: number; g: number; b: number } | null {
  const normalized = hex.trim().replace(/^#/, '');
  const expanded =
    normalized.length === HEX_SHORT_LENGTH
      ? normalized.split('').map((char) => `${char}${char}`).join('')
      : normalized;
  if (!HEX_COLOR_REGEX.test(expanded)) return null;
  return {
    r: parseInt(expanded.slice(0, HEX_BYTE_LENGTH), HEX_RADIX),
    g: parseInt(expanded.slice(HEX_BYTE_LENGTH, HEX_BYTE_LENGTH * 2), HEX_RADIX),
    b: parseInt(expanded.slice(HEX_BYTE_LENGTH * 2, HEX_LONG_LENGTH), HEX_RADIX),
  };
}

function isLightHexColor(hex: string): boolean {
  const rgb = hexToRgb(hex);
  if (!rgb) return false;
  const luminance =
    (RED_LUMINANCE_WEIGHT * rgb.r +
      GREEN_LUMINANCE_WEIGHT * rgb.g +
      BLUE_LUMINANCE_WEIGHT * rgb.b) /
    RGB_MAX;
  return luminance >= LIGHT_COLOR_LUMINANCE_THRESHOLD;
}

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
  showInquiryStatus,
}: {
  row: FormResponseRow;
  columns: QuestionColumnMeta[];
  showInquiryStatus: boolean;
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
          Submitted {new Date(row.createdAt).toLocaleString()}
          {showInquiryStatus ? ` · Inquiry: ${STAFF_INQUIRY_STATUS_LABELS[rowStatus]}` : ''}
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
type ColumnResizeState = {
  columnId: number;
  startX: number;
  startWidth: number;
};

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

function normalizedQuestionType(column: QuestionColumnMeta): string {
  return (column.questionType || '').toLowerCase().replace(/[\s_-]/g, '');
}

function columnLooksDateLike(column: QuestionColumnMeta): boolean {
  const questionType = normalizedQuestionType(column);
  if (questionType === 'date' || questionType === 'datetime' || questionType === 'birthdate' || questionType === 'dob') {
    return true;
  }
  const meta = column.metaData;
  if (!meta || typeof meta !== 'object' || Array.isArray(meta)) return false;
  const record = meta as Record<string, unknown>;
  const customType = String(record.customType ?? record.CustomType ?? '').toLowerCase();
  const dateType = String(record.dateType ?? record.DateType ?? '').toLowerCase();
  return customType === 'date' || dateType === 'single' || dateType === 'range' || dateType === 'datetime';
}

function columnLooksBooleanLike(column: QuestionColumnMeta): boolean {
  const questionType = normalizedQuestionType(column);
  return [
    'boolean',
    'bool',
    'checkbox',
    'terms',
    'termsandconditions',
    'waiver',
    'consent',
    'agreement',
    'acknowledgment',
    'acknowledgement',
  ].includes(questionType);
}

function columnLooksWideByType(column: QuestionColumnMeta): boolean {
  const questionType = normalizedQuestionType(column);
  return [
    'address',
    'textarea',
    'longtext',
    'paragraph',
    'description',
    'multiline',
  ].includes(questionType);
}

function displayTextLength(row: FormResponseRow, questionId: number): number {
  const cell = row.answers[questionId];
  if (!cell) return 0;
  if (cell.checkmark) return SHORT_TEXT_MAX_CHARS;
  return (cell.display || cell.linkUrl || '').trim().length;
}

function getQuestionColumnClasses(column: QuestionColumnMeta, rows: FormResponseRow[]): string {
  if (columnLooksBooleanLike(column) || columnLooksDateLike(column)) return NARROW_COLUMN_CLASSES;
  if (columnLooksWideByType(column)) return WIDE_COLUMN_CLASSES;

  const headerLength = (column.question || '').trim().length;
  let longest = headerLength;
  const sample = rows.slice(0, COLUMN_SAMPLE_LIMIT);
  for (const row of sample) {
    longest = Math.max(longest, displayTextLength(row, column.id));
  }

  if (longest <= SHORT_TEXT_MAX_CHARS) return NARROW_COLUMN_CLASSES;
  if (longest <= MEDIUM_TEXT_MAX_CHARS) return MEDIUM_COLUMN_CLASSES;
  if (longest >= WIDE_TEXT_MIN_CHARS) return WIDE_COLUMN_CLASSES;
  return DEFAULT_COLUMN_CLASSES;
}

function getQuestionColumnDefaultWidth(column: QuestionColumnMeta, rows: FormResponseRow[]): number {
  if (columnLooksBooleanLike(column) || columnLooksDateLike(column)) return NARROW_COLUMN_WIDTH_PX;
  if (columnLooksWideByType(column)) return WIDE_COLUMN_WIDTH_PX;

  const headerLength = (column.question || '').trim().length;
  let longest = headerLength;
  const sample = rows.slice(0, COLUMN_SAMPLE_LIMIT);
  for (const row of sample) {
    longest = Math.max(longest, displayTextLength(row, column.id));
  }

  if (longest <= SHORT_TEXT_MAX_CHARS) return NARROW_COLUMN_WIDTH_PX;
  if (longest <= MEDIUM_TEXT_MAX_CHARS) return MEDIUM_COLUMN_WIDTH_PX;
  if (longest >= WIDE_TEXT_MIN_CHARS) return WIDE_COLUMN_WIDTH_PX;
  return DEFAULT_COLUMN_WIDTH_PX;
}

function clampColumnWidth(width: number): number {
  return Math.min(
    Math.max(width, MIN_RESIZABLE_COLUMN_WIDTH_PX),
    MAX_RESIZABLE_COLUMN_WIDTH_PX
  );
}

function formatSubmittedParts(value: string): { date: string; time: string } {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return { date: value, time: '' };
  return {
    date: submittedDateFormatter.format(date),
    time: submittedTimeFormatter.format(date),
  };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function formResponseRowsToCsv(
  columns: QuestionColumnMeta[],
  rows: FormResponseRow[],
  includeStaffStatus: boolean
): string {
  const headers = [
    'Submitted',
    ...(includeStaffStatus ? ['Status'] : []),
    'UserId',
    'FirstName',
    'LastName',
    'Email',
    'Phone',
    ...columns.map((c) => c.question || `Question ${c.id}`),
  ];
  const lines = [headers.map(csvEscape).join(',')];
  for (const row of rows) {
    const status = (row.staffStatus ?? 'pending') as StaffInquiryStatus;
    const base = [
      row.createdAt,
      ...(includeStaffStatus ? [STAFF_INQUIRY_STATUS_LABELS[status] ?? status] : []),
      row.user ? String(row.user.id) : '',
      row.user?.firstName ?? '',
      row.user?.lastName ?? '',
      row.user?.email ?? '',
      row.user?.phone ?? '',
    ];
    const cells = columns.map((column) => {
      const answer = row.answers[column.id];
      if (answer?.checkmark) return 'Yes';
      return answer?.display ?? '';
    });
    lines.push([...base, ...cells].map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}

function downloadCsv(filename: string, csv: string): void {
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function statusSortKey(row: FormResponseRow): string {
  const s = row.staffStatus ?? 'pending';
  const i = STAFF_STATUS_ORDER.indexOf(s);
  return i >= 0 ? String(i).padStart(2, '0') : '99';
}

function compareStrings(a: string, b: string): number {
  const left = a.trim();
  const right = b.trim();
  if (!left && right) return 1;
  if (left && !right) return -1;
  return left.localeCompare(right, undefined, STRING_SORT_OPTIONS);
}

function compareSubmitted(a: FormResponseRow, b: FormResponseRow): number {
  const left = new Date(a.createdAt).getTime();
  const right = new Date(b.createdAt).getTime();
  const normalizedLeft = Number.isNaN(left) ? 0 : left;
  const normalizedRight = Number.isNaN(right) ? 0 : right;
  if (normalizedLeft !== normalizedRight) return normalizedLeft - normalizedRight;
  return a.answerTitleId - b.answerTitleId;
}

function compareRowsBySort(
  a: FormResponseRow,
  b: FormResponseRow,
  sortColumn: SortColumn
): number {
  if (sortColumn === 'status') {
    const statusCompare = compareStrings(statusSortKey(a), statusSortKey(b));
    return statusCompare || compareSubmitted(a, b);
  }
  if (sortColumn === 'submitted') {
    return compareSubmitted(a, b);
  }
  if (sortColumn === 'participant') {
    const participantCompare = compareStrings(participantSortKey(a), participantSortKey(b));
    return participantCompare || compareSubmitted(a, b);
  }
  const cellCompare = compareStrings(cellSortKey(a, sortColumn), cellSortKey(b, sortColumn));
  return cellCompare || compareSubmitted(a, b);
}

/** Client-only filter — never sent to the API or database. */
function rowMatchesClientSearch(
  row: FormResponseRow,
  query: string,
  includeStaffStatus: boolean
): boolean {
  const n = query.trim().toLowerCase();
  if (!n) return true;
  const u = row.user;
  const participant = [u?.firstName, u?.lastName, u?.email, u?.phone]
    .filter(Boolean)
    .join(' ')
    .toLowerCase();
  if (participant.includes(n)) return true;
  if (new Date(row.createdAt).toLocaleString().toLowerCase().includes(n)) return true;
  if (includeStaffStatus) {
    const st = (row.staffStatus ?? 'pending') as StaffInquiryStatus;
    if (STAFF_INQUIRY_STATUS_LABELS[st].toLowerCase().includes(n)) return true;
    if (st.replace(/_/g, ' ').includes(n)) return true;
  }
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
  staff_lock_to_default_questionnaire: boolean;
  enable_staff_inquiry_workflow: boolean;
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
  const [questionnaires, setQuestionnaires] = useState<QuestionnaireListItem[]>([]);
  const [columns, setColumns] = useState<QuestionColumnMeta[]>([]);
  const [questionnaireTitle, setQuestionnaireTitle] = useState<string | null>(null);
  const [rowsLoading, setRowsLoading] = useState(false);
  const [search, setSearch] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [cursor, setCursor] = useState<{ createdAt: string; id: number } | null>(null);
  const [accumulatedRows, setAccumulatedRows] = useState<FormResponsesPage['rows']>([]);
  const [sort, setSort] = useState<{ column: SortColumn; dir: 'asc' | 'desc' }>(DEFAULT_SORT);
  const [statusViewFilter, setStatusViewFilter] = useState<StatusViewFilter>('active');
  const [savingStatusId, setSavingStatusId] = useState<number | null>(null);
  const [statusSaveError, setStatusSaveError] = useState<string | null>(null);
  const [columnWidthOverrides, setColumnWidthOverrides] = useState<Record<number, number>>({});
  const [resizingColumnId, setResizingColumnId] = useState<number | null>(null);
  const [sortVersion, setSortVersion] = useState(0);

  const tableScrollRef = useRef<HTMLDivElement>(null);
  const accumulatedRowsRef = useRef<FormResponseRow[]>([]);
  const resizeStateRef = useRef<ColumnResizeState | null>(null);
  accumulatedRowsRef.current = accumulatedRows;

  const base = `/api/form-responses/${encodeURIComponent(slug)}`;
  const inquiryWorkflowEnabled = publicConfig?.enable_staff_inquiry_workflow !== false;
  const staffCanSwitchForms = publicConfig?.staff_lock_to_default_questionnaire === false;

  const visibleColumns = useMemo(
    () => filterColumnsWithAnswersInRows(columns, accumulatedRows),
    [columns, accumulatedRows]
  );

  const questionColumnClasses = useMemo(() => {
    const map = new Map<number, string>();
    for (const column of visibleColumns) {
      map.set(column.id, getQuestionColumnClasses(column, accumulatedRows));
    }
    return map;
  }, [visibleColumns, accumulatedRows]);

  const questionColumnWidths = useMemo(() => {
    const map = new Map<number, number>();
    for (const column of visibleColumns) {
      map.set(
        column.id,
        columnWidthOverrides[column.id] ?? getQuestionColumnDefaultWidth(column, accumulatedRows)
      );
    }
    return map;
  }, [visibleColumns, accumulatedRows, columnWidthOverrides]);

  useEffect(() => {
    if (!inquiryWorkflowEnabled && sort.column === 'status') {
      setSort(DEFAULT_SORT);
      return;
    }
    if (typeof sort.column === 'number' && !visibleColumns.some((c) => c.id === sort.column)) {
      setSort(DEFAULT_SORT);
    }
  }, [inquiryWorkflowEnabled, visibleColumns, sort.column]);

  const statusFilteredRows = useMemo(() => {
    if (!inquiryWorkflowEnabled) return accumulatedRows;
    switch (statusViewFilter) {
      case 'all':
        return accumulatedRows;
      case 'completed_only':
        return accumulatedRows.filter((r) => (r.staffStatus ?? 'pending') === 'resolved');
      case 'active':
      default:
        return accumulatedRows.filter((r) => (r.staffStatus ?? 'pending') !== 'resolved');
    }
  }, [accumulatedRows, inquiryWorkflowEnabled, statusViewFilter]);

  const displayRows = useMemo(() => {
    const filtered = statusFilteredRows.filter((r) =>
      rowMatchesClientSearch(r, search, inquiryWorkflowEnabled)
    );
    const sorted = [...filtered].sort((a, b) => {
      const result = compareRowsBySort(a, b, sort.column);
      return sort.dir === 'asc' ? result : -result;
    });
    return sorted;
  }, [statusFilteredRows, search, inquiryWorkflowEnabled, sort]);
  const hasMoreRows = cursor !== null;
  const reachedAutoLoadCap = hasMoreRows && accumulatedRows.length >= AUTO_LOAD_MAX_ROWS;
  const loadedAllRows = !hasMoreRows;
  const loadingRemainingRows = rowsLoading && accumulatedRows.length > 0 && hasMoreRows;
  const filteredExportDisabled = !loadedAllRows || rowsLoading;

  const headerSort = useCallback((col: SortColumn) => {
    setSort((s) => {
      if (s.column === col) {
        return { column: col, dir: s.dir === 'asc' ? 'desc' : 'asc' };
      }
      return { column: col, dir: col === 'submitted' ? 'desc' : 'asc' };
    });
    setSortVersion((version) => version + 1);
  }, []);

  function sortHint(col: SortColumn): string {
    if (sort.column !== col) return '';
    return sort.dir === 'asc' ? ' ↑' : ' ↓';
  }

  const startQuestionColumnResize = useCallback(
    (event: React.MouseEvent<HTMLButtonElement>, columnId: number) => {
      event.preventDefault();
      event.stopPropagation();
      resizeStateRef.current = {
        columnId,
        startX: event.clientX,
        startWidth: questionColumnWidths.get(columnId) ?? DEFAULT_COLUMN_WIDTH_PX,
      };
      setResizingColumnId(columnId);
    },
    [questionColumnWidths]
  );

  useEffect(() => {
    if (resizingColumnId == null) return;

    const previousCursor = document.body.style.cursor;
    const previousUserSelect = document.body.style.userSelect;
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';

    function handlePointerMove(event: MouseEvent) {
      const resizeState = resizeStateRef.current;
      if (!resizeState) return;
      const nextWidth = clampColumnWidth(
        resizeState.startWidth + event.clientX - resizeState.startX
      );
      setColumnWidthOverrides((prev) => ({
        ...prev,
        [resizeState.columnId]: nextWidth,
      }));
    }

    function handlePointerUp() {
      resizeStateRef.current = null;
      setResizingColumnId(null);
    }

    window.addEventListener('mousemove', handlePointerMove);
    window.addEventListener('mouseup', handlePointerUp);
    return () => {
      window.removeEventListener('mousemove', handlePointerMove);
      window.removeEventListener('mouseup', handlePointerUp);
      document.body.style.cursor = previousCursor;
      document.body.style.userSelect = previousUserSelect;
    };
  }, [resizingColumnId]);

  useEffect(() => {
    if (sortVersion === 0) return;
    const frame = requestAnimationFrame(() => {
      tableScrollRef.current?.scrollTo({ top: 0 });
    });
    return () => cancelAnimationFrame(frame);
  }, [displayRows, sortVersion]);

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

  useEffect(() => {
    if (!authenticated || !publicConfig) return;
    if (publicConfig.staff_lock_to_default_questionnaire) {
      setQuestionnaireId(publicConfig.default_questionnaire_id);
      return;
    }
    setQuestionnaireId((current) => current ?? publicConfig.default_questionnaire_id);
  }, [authenticated, publicConfig]);

  useEffect(() => {
    if (!authenticated || !publicConfig) return;
    let cancelled = false;
    (async () => {
      const res = await fetch(`${base}/questionnaires`, { credentials: 'include' });
      if (!res.ok) return;
      const data = (await res.json()) as { questionnaires?: QuestionnaireListItem[] };
      if (!cancelled) setQuestionnaires(data.questionnaires || []);
    })();
    return () => {
      cancelled = true;
    };
  }, [authenticated, publicConfig, base]);

  useEffect(() => {
    setColumns([]);
    setQuestionnaireTitle(null);
    setAccumulatedRows([]);
    setCursor(null);
    setSort(DEFAULT_SORT);
    setColumnWidthOverrides({});
  }, [questionnaireId]);

  useEffect(() => {
    if (!staffCanSwitchForms || questionnaires.length === 0) return;
    if (questionnaireId != null && questionnaires.some((q) => q.id === questionnaireId)) return;
    setQuestionnaireId(questionnaires[0].id);
  }, [questionnaireId, questionnaires, staffCanSwitchForms]);

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

  useEffect(() => {
    if (!authenticated || questionnaireId == null || !from || !to) return;
    if (!cursor || rowsLoading || accumulatedRows.length >= AUTO_LOAD_MAX_ROWS) return;
    void fetchRows(true, cursor);
  }, [
    authenticated,
    questionnaireId,
    from,
    to,
    cursor,
    rowsLoading,
    accumulatedRows.length,
    fetchRows,
  ]);

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

  const exportFilteredRows = useCallback(() => {
    if (filteredExportDisabled) return;
    const csv = formResponseRowsToCsv(visibleColumns, displayRows, inquiryWorkflowEnabled);
    downloadCsv(`form-responses-${slug}-filtered.csv`, csv);
  }, [displayRows, filteredExportDisabled, inquiryWorkflowEnabled, slug, visibleColumns]);

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
      if (!inquiryWorkflowEnabled) return;
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
    [base, inquiryWorkflowEnabled]
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
  const showFormPicker = staffCanSwitchForms && questionnaires.length > 1;
  const selectedQuestionnaireTitle =
    questionnaires.find((q) => q.id === questionnaireId)?.title?.trim() || questionnaireTitle?.trim();
  const pinnedColumnCount = inquiryWorkflowEnabled ? 3 : 2;
  const tableHeaderTextColor = isLightHexColor(b.primaryColor) ? '#0f172a' : '#ffffff';
  const usesGroupedPrintLayout =
    pinnedColumnCount + visibleColumns.length > PRINT_GROUPED_COLUMN_THRESHOLD;

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
      className={`form-responses-print-root min-h-screen print:bg-white ${
        usesGroupedPrintLayout ? 'form-responses-print-mode-grouped' : 'form-responses-print-mode-table'
      }`}
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
              Export all in range
            </a>
            <button
              type="button"
              onClick={exportFilteredRows}
              disabled={filteredExportDisabled}
              title={
                filteredExportDisabled
                  ? 'Current filtered export is available after all rows in the date range finish loading.'
                  : 'Export the current search, inquiry view, and sort order.'
              }
              className="text-sm px-3 py-2 rounded-xl border border-slate-200/90 bg-white text-slate-800 shadow-sm hover:border-slate-300 hover:bg-slate-50/90 transition-colors disabled:opacity-50"
            >
              Export current view
            </button>
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
              <label
                htmlFor="form-response-questionnaire"
                className="block text-xs font-semibold uppercase tracking-wide text-slate-500 mb-1.5"
              >
                Form
              </label>
              {showFormPicker ? (
                <select
                  id="form-response-questionnaire"
                  value={questionnaireId ?? ''}
                  onChange={(e) => setQuestionnaireId(Number(e.target.value))}
                  className="w-full text-sm font-semibold text-slate-900 rounded-xl border-2 px-3 py-2.5 shadow-sm bg-white focus:outline-none focus:ring-2 focus:ring-slate-200/80"
                  style={{ borderColor: b.primaryColor }}
                >
                  {questionnaires.map((q) => (
                    <option key={q.id} value={q.id}>
                      {q.title?.trim() || `Form ${q.id}`}
                    </option>
                  ))}
                </select>
              ) : (
                <p
                  id="form-response-questionnaire"
                  className="text-sm font-semibold text-slate-900 rounded-xl border-2 px-3 py-2.5 shadow-sm"
                  style={{
                    borderColor: b.primaryColor,
                    background: `linear-gradient(135deg, ${b.primaryColor}18, ${b.secondaryColor}14)`,
                  }}
                >
                  {selectedQuestionnaireTitle || `Default form (ID ${publicConfig.default_questionnaire_id})`}
                </p>
              )}
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
            {inquiryWorkflowEnabled ? (
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
            ) : null}
          </div>
        </div>
        {inquiryWorkflowEnabled && statusSaveError ? (
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
            {inquiryWorkflowEnabled &&
            statusViewFilter === 'active' &&
            accumulatedRows.some((r) => (r.staffStatus ?? 'pending') === 'resolved')
              ? ' · Done hidden'
              : ''}
            {inquiryWorkflowEnabled && statusViewFilter === 'completed_only' ? ' · completed only' : ''}
            .
          </p>
        ) : null}
        {accumulatedRows.length > 0 ? (
          <p className="text-xs text-slate-600">
            {loadedAllRows
              ? `Loaded all ${accumulatedRows.length} responses in this date range.`
              : loadingRemainingRows
                ? `Loading remaining responses… ${accumulatedRows.length} loaded so far.`
                : reachedAutoLoadCap
                  ? `Loaded ${accumulatedRows.length} responses. Narrow the date range to load more than ${AUTO_LOAD_MAX_ROWS}.`
                  : `Loaded ${accumulatedRows.length} responses. More responses are queued to load.`}
          </p>
        ) : null}
      </main>

      <div className="max-w-[1600px] mx-auto px-4 pb-12">
        <p className="form-responses-no-print hidden md:block text-xs text-slate-500 mb-2 leading-snug">
          Tip: On desktop, {inquiryWorkflowEnabled ? 'Status, Submitted, and Participant' : 'Submitted and Participant'} stay pinned
          when you scroll sideways to read answers.
        </p>
        <div
          ref={tableScrollRef}
          tabIndex={0}
          role="region"
          aria-label="Form responses table. Use arrow keys or swipe to scroll horizontally."
          className="form-responses-print-scroll rounded-xl border border-slate-200/90 bg-white shadow-md shadow-slate-200/40 overflow-x-auto max-h-[min(75vh,calc(100dvh-13rem))] overflow-y-auto print:max-h-none print:overflow-visible focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-slate-300/80 focus-visible:ring-offset-2"
          style={{ overflowAnchor: 'none' }}
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
                {inquiryWorkflowEnabled &&
                statusViewFilter === 'active' &&
                accumulatedRows.some((r) => (r.staffStatus ?? 'pending') === 'resolved')
                  ? ' · Done hidden'
                  : ''}
                {inquiryWorkflowEnabled && statusViewFilter === 'completed_only' ? ' · completed only' : ''}
              </p>
            ) : null}
          </div>
          <table className="form-responses-print-table min-w-max w-full text-sm print:text-xs border-collapse isolate">
            <thead>
              <tr>
                {inquiryWorkflowEnabled ? (
                <th
                  scope="col"
                  className="text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle w-[9.5rem] min-w-[8.5rem] box-border shrink-0 sticky top-0 z-30 print:static md:left-0 md:z-[41] md:border-r md:border-slate-200/90 md:shadow-[2px_0_8px_-4px_rgba(15,23,42,0.08)]"
                  style={{
                    backgroundColor: b.primaryColor,
                    color: tableHeaderTextColor,
                    boxShadow: 'inset 0 -1px 0 0 rgb(226 232 240)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => headerSort('status')}
                    className="text-left w-full min-h-[2.75rem] flex items-center font-semibold hover:opacity-80 leading-snug"
                  >
                    Status{sortHint('status')}
                  </button>
                </th>
                ) : null}
                <th
                  scope="col"
                  className={`text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle w-[9rem] min-w-[8rem] box-border shrink-0 sticky top-0 z-30 print:static md:z-[42] md:border-r md:border-slate-200/90 md:shadow-[2px_0_8px_-4px_rgba(15,23,42,0.08)] ${
                    inquiryWorkflowEnabled ? 'md:left-[9.5rem]' : 'md:left-0'
                  }`}
                  style={{
                    backgroundColor: b.primaryColor,
                    color: tableHeaderTextColor,
                    boxShadow: 'inset 0 -1px 0 0 rgb(226 232 240)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => headerSort('submitted')}
                    className="text-left w-full min-h-[2.75rem] flex items-center font-semibold hover:opacity-80 leading-snug"
                  >
                    Submitted{sortHint('submitted')}
                  </button>
                </th>
                <th
                  scope="col"
                  className={`text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle w-[11rem] min-w-[9rem] max-w-[11rem] box-border shrink-0 sticky top-0 z-30 print:static md:z-[43] md:border-r md:border-slate-300/90 md:shadow-[3px_0_10px_-4px_rgba(15,23,42,0.1)] ${
                    inquiryWorkflowEnabled ? 'md:left-[18.5rem]' : 'md:left-[9rem]'
                  }`}
                  style={{
                    backgroundColor: b.primaryColor,
                    color: tableHeaderTextColor,
                    boxShadow: 'inset 0 -1px 0 0 rgb(226 232 240)',
                  }}
                >
                  <button
                    type="button"
                    onClick={() => headerSort('participant')}
                    className="text-left w-full min-h-[2.75rem] flex items-center font-semibold hover:opacity-80"
                  >
                    <span className="block leading-snug whitespace-normal break-words">
                      Participant{sortHint('participant')}
                    </span>
                  </button>
                </th>
                {visibleColumns.map((c) => {
                  const width = questionColumnWidths.get(c.id) ?? DEFAULT_COLUMN_WIDTH_PX;
                  return (
                    <th
                      key={c.id}
                      scope="col"
                      className={`relative text-left px-3 py-3 border-b border-slate-200 font-semibold align-middle sticky top-0 z-20 print:static ${
                        questionColumnClasses.get(c.id) ?? DEFAULT_COLUMN_CLASSES
                      }`}
                      style={{
                        width,
                        minWidth: width,
                        maxWidth: width,
                        backgroundColor: b.primaryColor,
                        color: tableHeaderTextColor,
                        boxShadow: 'inset 0 -1px 0 0 rgb(226 232 240)',
                      }}
                    >
                      <button
                        type="button"
                        onClick={() => headerSort(c.id)}
                        className="text-left w-full min-h-[2.75rem] pr-3 flex items-center font-semibold hover:opacity-80"
                      >
                        <span className="block leading-snug whitespace-normal break-words">
                          {c.question?.trim() || `Q ${c.id}`}
                          {sortHint(c.id)}
                        </span>
                      </button>
                      <button
                        type="button"
                        aria-label={`Resize ${c.question?.trim() || `Question ${c.id}`}`}
                        onMouseDown={(event) => startQuestionColumnResize(event, c.id)}
                        className={`absolute right-0 top-0 h-full w-2 cursor-col-resize border-r border-transparent hover:border-slate-400 focus:border-slate-500 focus:outline-none ${
                          resizingColumnId === c.id ? 'border-slate-500 bg-slate-400/10' : ''
                        }`}
                      />
                    </th>
                  );
                })}
              </tr>
            </thead>
          {rowsLoading && accumulatedRows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={pinnedColumnCount + Math.max(visibleColumns.length, 1)} className="p-8 text-center text-slate-500">
                  Loading…
                </td>
              </tr>
            </tbody>
          ) : accumulatedRows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={pinnedColumnCount + Math.max(visibleColumns.length, 1)} className="p-8 text-center text-slate-500">
                  No responses in this range.
                </td>
              </tr>
            </tbody>
          ) : displayRows.length === 0 ? (
            <tbody>
              <tr>
                <td colSpan={pinnedColumnCount + Math.max(visibleColumns.length, 1)} className="p-8 text-center text-slate-500">
                  {inquiryWorkflowEnabled
                    ? 'No loaded rows match your filters. Clear search, switch Inquiry view (All / Completed only), or load more responses.'
                    : 'No loaded rows match your filters. Clear search or load more responses.'}
                </td>
              </tr>
            </tbody>
          ) : (
            displayRows.map((row) => {
              const rowStatus = (row.staffStatus ?? 'pending') as StaffInquiryStatus;
              const colSpan = pinnedColumnCount + Math.max(visibleColumns.length, 1);
              return (
                <tbody key={row.answerTitleId} className="form-responses-print-row-group">
                  <tr className="form-responses-print-summary-row group border-t border-slate-100 hover:bg-slate-50/90">
                    {inquiryWorkflowEnabled ? (
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
                    ) : null}
                    <td
                      className={`p-3 align-top text-slate-600 text-xs sm:text-sm w-[9rem] min-w-[8rem] max-w-[9rem] box-border shrink-0 bg-white md:sticky md:z-[16] md:border-r md:border-slate-200/90 md:shadow-[2px_0_8px_-4px_rgba(15,23,42,0.06)] md:group-hover:bg-slate-50/90 print:static print:bg-transparent ${
                        inquiryWorkflowEnabled ? 'md:left-[9.5rem]' : 'md:left-0'
                      }`}
                    >
                      {(() => {
                        const submitted = formatSubmittedParts(row.createdAt);
                        return (
                          <span className="block leading-snug">
                            <span className="block">{submitted.date}</span>
                            {submitted.time ? <span className="block">{submitted.time}</span> : null}
                          </span>
                        );
                      })()}
                    </td>
                    <td
                      className={`p-3 align-top text-slate-800 w-[11rem] min-w-[9rem] max-w-[11rem] box-border shrink-0 break-words text-sm bg-white md:sticky md:z-[17] md:border-r md:border-slate-300/90 md:shadow-[3px_0_10px_-4px_rgba(15,23,42,0.08)] md:group-hover:bg-slate-50/90 print:static print:bg-transparent ${
                        inquiryWorkflowEnabled ? 'md:left-[18.5rem]' : 'md:left-[9rem]'
                      }`}
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
                      const width = questionColumnWidths.get(c.id) ?? DEFAULT_COLUMN_WIDTH_PX;
                      return (
                        <td
                          key={c.id}
                          className={`p-3 align-top text-slate-800 text-sm ${
                            questionColumnClasses.get(c.id) ?? DEFAULT_COLUMN_CLASSES
                          }`}
                          style={{ width, minWidth: width, maxWidth: width }}
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
                              className={`text-blue-600 underline ${TRUNCATED_ANSWER_CLASSES}`}
                              title={cell.display || cell.linkUrl}
                            >
                              {cell.display || 'Open'}
                            </a>
                          ) : (
                            <span className={TRUNCATED_ANSWER_CLASSES} title={cell?.display || undefined}>
                              {cell?.display || ''}
                            </span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                  <tr className="form-responses-print-participant-detail" aria-hidden="true">
                    <td colSpan={colSpan} className="p-0 border-0 print:p-3 print:bg-slate-50/80">
                      <ParticipantPrintDetail
                        row={row}
                        columns={visibleColumns}
                        showInquiryStatus={inquiryWorkflowEnabled}
                      />
                    </td>
                  </tr>
                </tbody>
              );
            })
          )}
        </table>
        </div>
      </div>
    </div>
  );
}
