/**
 * Persist staff workflow status per Bond answer title row (Discovery Supabase).
 */

import { getSupabaseAdmin } from './supabase';
import type { FormResponseRow, StaffInquiryStatus } from '@/types/form-pages';

const VALID_STATUSES: StaffInquiryStatus[] = ['pending', 'in_progress', 'resolved'];

export function isValidStaffInquiryStatus(s: unknown): s is StaffInquiryStatus {
  return typeof s === 'string' && VALID_STATUSES.includes(s as StaffInquiryStatus);
}

function rowAnswerTitleId(row: Record<string, unknown>): number | null {
  const raw = row.answer_title_id ?? row.answerTitleId;
  if (raw == null) return null;
  const n = typeof raw === 'number' ? raw : Number(raw);
  return Number.isFinite(n) ? n : null;
}

export async function getStatusesForAnswerTitles(
  formPageId: string,
  answerTitleIds: number[]
): Promise<Map<number, StaffInquiryStatus>> {
  const map = new Map<number, StaffInquiryStatus>();
  if (answerTitleIds.length === 0) return map;
  const db = getSupabaseAdmin();
  const { data, error } = await db
    .from('form_answer_title_statuses')
    .select('answer_title_id, status')
    .eq('form_page_id', formPageId)
    .in('answer_title_id', answerTitleIds);
  if (error) {
    console.error('[form-response-statuses] getStatusesForAnswerTitles:', error);
    return map;
  }
  for (const row of data || []) {
    const r = row as Record<string, unknown>;
    const id = rowAnswerTitleId(r);
    const st = r.status;
    if (id != null && typeof st === 'string' && isValidStaffInquiryStatus(st)) {
      map.set(id, st);
    }
  }
  return map;
}

export async function attachStaffStatusesToRows(
  formPageId: string,
  rows: FormResponseRow[]
): Promise<FormResponseRow[]> {
  if (rows.length === 0) return rows;
  const ids = rows.map((r) => r.answerTitleId);
  const statusMap = await getStatusesForAnswerTitles(formPageId, ids);
  return rows.map((r) => ({
    ...r,
    staffStatus: statusMap.get(r.answerTitleId),
  }));
}

/**
 * PostgREST composite-key upsert is easy to misconfigure; use update-then-insert so saves persist.
 */
export async function upsertAnswerTitleStatus(
  formPageId: string,
  answerTitleId: number,
  status: StaffInquiryStatus
): Promise<void> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();

  const { data: existing, error: selErr } = await db
    .from('form_answer_title_statuses')
    .select('answer_title_id')
    .eq('form_page_id', formPageId)
    .eq('answer_title_id', answerTitleId)
    .maybeSingle();

  if (selErr) {
    console.error('[form-response-statuses] select before write:', selErr);
    throw new Error(selErr.message);
  }

  if (existing) {
    const { error: updErr } = await db
      .from('form_answer_title_statuses')
      .update({ status, updated_at: now })
      .eq('form_page_id', formPageId)
      .eq('answer_title_id', answerTitleId);
    if (updErr) {
      console.error('[form-response-statuses] update:', updErr);
      throw new Error(updErr.message);
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

  // Unique race: treat as success path by updating
  const code = 'code' in insErr ? String((insErr as { code?: string }).code) : '';
  if (code === '23505') {
    const { error: updErr } = await db
      .from('form_answer_title_statuses')
      .update({ status, updated_at: now })
      .eq('form_page_id', formPageId)
      .eq('answer_title_id', answerTitleId);
    if (updErr) {
      console.error('[form-response-statuses] update after duplicate:', updErr);
      throw new Error(updErr.message);
    }
    return;
  }

  console.error('[form-response-statuses] insert:', insErr);
  throw new Error(insErr.message);
}
