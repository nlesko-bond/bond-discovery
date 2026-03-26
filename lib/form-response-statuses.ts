/**
 * Persist staff workflow status per Bond answer title row (Discovery Supabase).
 */

import { getSupabaseAdmin } from './supabase';
import type { FormResponseRow, StaffInquiryStatus } from '@/types/form-pages';

const VALID_STATUSES: StaffInquiryStatus[] = ['pending', 'in_progress', 'resolved'];

function isLikelyMissingRpcFn(err: { code?: string; message?: string }): boolean {
  const c = err.code;
  if (c === 'PGRST202' || c === '42883') return true;
  const m = (err.message || '').toLowerCase();
  return (
    m.includes('could not find the function') ||
    m.includes('does not exist') ||
    m.includes('schema cache')
  );
}

/**
 * BIGINT-safe id for application logic (rows, maps).
 * PostgREST filters on `answer_title_id` should use JS numbers for values ≤ MAX_SAFE_INTEGER
 * so `eq`/`or` compare as bigint, not text (string filters often match zero rows).
 */
export function normalizeAnswerTitleId(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return Math.trunc(v);
  if (typeof v === 'bigint') {
    const n = Number(v);
    return Number.isFinite(n) ? Math.trunc(n) : null;
  }
  if (typeof v === 'string' && v.trim() !== '') {
    const n = Number(v);
    if (Number.isFinite(n)) return Math.trunc(n);
  }
  return null;
}

function answerTitleIdStr(id: number): string {
  return String(Math.trunc(id));
}

/** Use in PostgREST `.eq` / `.or` for bigint columns (numeric literal, not quoted string). */
function answerTitleIdForFilter(id: number): number | string {
  const n = Math.trunc(id);
  return Math.abs(n) <= Number.MAX_SAFE_INTEGER ? n : answerTitleIdStr(n);
}

export function isValidStaffInquiryStatus(s: unknown): s is StaffInquiryStatus {
  return typeof s === 'string' && VALID_STATUSES.includes(s as StaffInquiryStatus);
}

/**
 * Map keys for status lookups — always decimal string so JSON number vs string bigint from
 * PostgREST never splits Map keys (was causing "only 1 of N rows" when types mixed).
 */
function statusLookupKeyFromUnknown(v: unknown): string | null {
  if (v == null) return null;
  if (typeof v === 'bigint') return v.toString();
  if (typeof v === 'number' && Number.isFinite(v)) return String(Math.trunc(v));
  if (typeof v === 'string') {
    const t = v.trim();
    if (t === '') return null;
    if (/^-?\d+$/.test(t)) return t.startsWith('-') ? String(Math.trunc(Number(t))) : t;
    const n = Number(t);
    if (Number.isFinite(n)) return String(Math.trunc(n));
  }
  return null;
}

/** RPC / REST may return one row as an object instead of a one-element array. */
function coerceRpcRows(data: unknown): Record<string, unknown>[] {
  if (data == null) return [];
  if (Array.isArray(data)) return data as Record<string, unknown>[];
  if (typeof data === 'object') return [data as Record<string, unknown>];
  return [];
}

/** Chunk RPC arrays and OR filters to keep payloads / URLs reasonable. */
const RPC_CHUNK = 500;
const QUERY_OR_CHUNK = 60;

async function getStatusesViaOrFilter(
  db: ReturnType<typeof getSupabaseAdmin>,
  formPageId: string,
  unique: number[]
): Promise<Map<string, StaffInquiryStatus>> {
  const map = new Map<string, StaffInquiryStatus>();
  for (let i = 0; i < unique.length; i += QUERY_OR_CHUNK) {
    const chunk = unique.slice(i, i + QUERY_OR_CHUNK);
    const orClause = chunk.map((id) => `answer_title_id.eq.${answerTitleIdForFilter(id)}`).join(',');
    const { data, error } = await db
      .from('form_answer_title_statuses')
      .select('answer_title_id, status')
      .eq('form_page_id', formPageId)
      .or(orClause);

    if (error) {
      console.error('[form-response-statuses] getStatusesForAnswerTitles (OR fallback):', error);
      return map;
    }
    for (const row of data || []) {
      const r = row as Record<string, unknown>;
      const key = statusLookupKeyFromUnknown(r.answer_title_id ?? r.answerTitleId);
      const st = r.status;
      if (key != null && typeof st === 'string' && isValidStaffInquiryStatus(st)) {
        map.set(key, st);
      }
    }
  }
  return map;
}

/** Prefer SQL `ANY(bigint[])` via RPC — stable vs PostgREST filter encoding. Falls back if migration not applied. */
async function getStatusesViaRpc(
  db: ReturnType<typeof getSupabaseAdmin>,
  formPageId: string,
  unique: number[]
): Promise<Map<string, StaffInquiryStatus> | null> {
  const map = new Map<string, StaffInquiryStatus>();
  for (let i = 0; i < unique.length; i += RPC_CHUNK) {
    const chunk = unique.slice(i, i + RPC_CHUNK);
    const { data, error } = await db.rpc('lookup_form_answer_title_statuses', {
      p_form_page_id: formPageId,
      p_answer_title_ids: chunk,
    });
    if (error) {
      if (isLikelyMissingRpcFn(error)) return null;
      console.error('[form-response-statuses] lookup RPC:', error);
      return null;
    }
    for (const row of coerceRpcRows(data)) {
      const r = row as Record<string, unknown>;
      const key = statusLookupKeyFromUnknown(r.answer_title_id ?? r.answerTitleId);
      const st = r.status;
      if (key != null && typeof st === 'string' && isValidStaffInquiryStatus(st)) {
        map.set(key, st);
      }
    }
  }
  return map;
}

export async function getStatusesForAnswerTitles(
  formPageId: string,
  answerTitleIds: number[]
): Promise<Map<string, StaffInquiryStatus>> {
  const unique = [
    ...new Set(
      answerTitleIds.map((id) => normalizeAnswerTitleId(id)).filter((n): n is number => n != null)
    ),
  ];
  if (unique.length === 0) return new Map();

  const db = getSupabaseAdmin();
  const fromRpc = await getStatusesViaRpc(db, formPageId, unique);
  if (fromRpc) return fromRpc;

  return getStatusesViaOrFilter(db, formPageId, unique);
}

export async function attachStaffStatusesToRows(
  formPageId: string,
  rows: FormResponseRow[]
): Promise<FormResponseRow[]> {
  if (rows.length === 0) return rows;
  const ids = rows
    .map((r) => normalizeAnswerTitleId(r.answerTitleId))
    .filter((n): n is number => n != null);
  const statusMap = await getStatusesForAnswerTitles(formPageId, ids);

  return rows.map((r) => {
    const key = statusLookupKeyFromUnknown(r.answerTitleId);
    const staffStatus = key != null ? statusMap.get(key) : undefined;
    return { ...r, staffStatus };
  });
}

/**
 * Prefer SQL `ON CONFLICT` via RPC; fallback to select/update/insert if migration not applied.
 */
export async function upsertAnswerTitleStatus(
  formPageId: string,
  answerTitleId: number,
  status: StaffInquiryStatus
): Promise<void> {
  const db = getSupabaseAdmin();
  const { error: rpcErr } = await db.rpc('upsert_form_answer_title_status', {
    p_form_page_id: formPageId,
    p_answer_title_id: answerTitleId,
    p_status: status,
  });
  if (!rpcErr) return;
  if (!isLikelyMissingRpcFn(rpcErr)) {
    console.error('[form-response-statuses] upsert RPC:', rpcErr);
    throw new Error(rpcErr.message);
  }

  await upsertAnswerTitleStatusPostgrestFallback(db, formPageId, answerTitleId, status);
}

async function upsertAnswerTitleStatusPostgrestFallback(
  db: ReturnType<typeof getSupabaseAdmin>,
  formPageId: string,
  answerTitleId: number,
  status: StaffInquiryStatus
): Promise<void> {
  const now = new Date().toISOString();
  const idFilter = answerTitleIdForFilter(answerTitleId);

  const { data: existing, error: selErr } = await db
    .from('form_answer_title_statuses')
    .select('answer_title_id')
    .eq('form_page_id', formPageId)
    .eq('answer_title_id', idFilter)
    .maybeSingle();

  if (selErr) {
    console.error('[form-response-statuses] select before write:', selErr);
    throw new Error(selErr.message);
  }

  if (existing) {
    const { error: updErr, count } = await db
      .from('form_answer_title_statuses')
      .update({ status, updated_at: now }, { count: 'exact' })
      .eq('form_page_id', formPageId)
      .eq('answer_title_id', idFilter);
    if (updErr) {
      console.error('[form-response-statuses] update:', updErr);
      throw new Error(updErr.message);
    }
    if (count === 0) {
      console.error('[form-response-statuses] update matched 0 rows (answer_title_id filter?)');
      throw new Error('Status update did not match any row');
    }
    return;
  }

  const { error: insErr } = await db.from('form_answer_title_statuses').insert({
    form_page_id: formPageId,
    answer_title_id: answerTitleId,
    status,
    updated_at: now,
  });

  if (!insErr) return;

  const code = 'code' in insErr ? String((insErr as { code?: string }).code) : '';
  if (code === '23505') {
    const { error: updErr, count } = await db
      .from('form_answer_title_statuses')
      .update({ status, updated_at: now }, { count: 'exact' })
      .eq('form_page_id', formPageId)
      .eq('answer_title_id', idFilter);
    if (updErr) {
      console.error('[form-response-statuses] update after duplicate:', updErr);
      throw new Error(updErr.message);
    }
    if (count === 0) {
      console.error('[form-response-statuses] update after duplicate matched 0 rows');
      throw new Error('Status update did not match any row');
    }
    return;
  }

  console.error('[form-response-statuses] insert:', insErr);
  throw new Error(insErr.message);
}
