/**
 * Persist staff workflow status per Bond answer title row (Discovery Supabase).
 */

import { getSupabaseAdmin } from '@/lib/supabase';
import type { FormResponseRow, StaffInquiryStatus } from '@/types/form-pages';

const VALID_STATUSES: StaffInquiryStatus[] = ['pending', 'in_progress', 'resolved'];

export function isValidStaffInquiryStatus(s: unknown): s is StaffInquiryStatus {
  return typeof s === 'string' && VALID_STATUSES.includes(s as StaffInquiryStatus);
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
    const id = Number((row as { answer_title_id: number }).answer_title_id);
    const st = (row as { status: string }).status;
    if (Number.isFinite(id) && isValidStaffInquiryStatus(st)) {
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

export async function upsertAnswerTitleStatus(
  formPageId: string,
  answerTitleId: number,
  status: StaffInquiryStatus
): Promise<void> {
  const db = getSupabaseAdmin();
  const now = new Date().toISOString();
  const { error } = await db.from('form_answer_title_statuses').upsert(
    {
      form_page_id: formPageId,
      answer_title_id: answerTitleId,
      status,
      updated_at: now,
    },
    { onConflict: 'form_page_id,answer_title_id' }
  );
  if (error) {
    console.error('[form-response-statuses] upsert:', error);
    throw new Error(error.message);
  }
}
