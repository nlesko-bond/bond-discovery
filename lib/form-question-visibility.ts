import type { FormResponseRow, QuestionColumnMeta } from '@/types/form-pages';

/**
 * Drop questions Bond marks inactive/hidden via metaData (common JSON flags).
 */
export function filterStaffQuestionColumns(columns: QuestionColumnMeta[]): QuestionColumnMeta[] {
  return columns.filter((c) => {
    const m = c.metaData;
    if (m == null || typeof m !== 'object' || Array.isArray(m)) return true;
    const o = m as Record<string, unknown>;
    if (o.active === false || o.isActive === false) return false;
    if (o.hidden === true || o.archived === true) return false;
    if (o.includeInForm === false) return false;
    return true;
  });
}

function answerHasVisibleContent(
  a: { display: string; linkUrl?: string; checkmark?: boolean } | undefined
): boolean {
  if (!a) return false;
  if (a.checkmark) return true;
  if (a.linkUrl) return true;
  return Boolean(a.display?.trim());
}

/**
 * Only show columns that have at least one non-empty answer in this row set
 * (hides retired questions that still exist on Questions but no longer collect answers).
 */
export function filterColumnsWithAnswersInRows(
  columns: QuestionColumnMeta[],
  rows: FormResponseRow[]
): QuestionColumnMeta[] {
  if (rows.length === 0) return columns;
  const ids = new Set<number>();
  for (const r of rows) {
    for (const [qid, a] of Object.entries(r.answers)) {
      if (answerHasVisibleContent(a)) ids.add(Number(qid));
    }
  }
  return columns.filter((c) => ids.has(c.id));
}
