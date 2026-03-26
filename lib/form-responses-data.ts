import { formatAnswerValue } from '@/lib/answer-value-format';
import { filterColumnsWithAnswersInRows } from '@/lib/form-question-visibility';
import type { AnswerTitleRow } from '@/lib/forms-pg';
import {
  getQuestionnaireTitle,
  listAnswerTitlesNewerThan,
  listAnswerTitlesPage,
  listAnswersForTitleIds,
  listQuestionsForQuestionnaire,
  listUsersByIds,
} from '@/lib/forms-pg';
import { attachStaffStatusesToRows } from '@/lib/form-response-statuses';
import {
  STAFF_INQUIRY_STATUS_LABELS,
  type FormPageConfig,
  type FormResponseRow,
  type FormResponsesPage,
  type QuestionColumnMeta,
  type StaffInquiryStatus,
} from '@/types/form-pages';

async function buildRowsFromTitles(
  config: FormPageConfig,
  titles: AnswerTitleRow[]
): Promise<FormResponseRow[]> {
  if (titles.length === 0) return [];
  const titleIds = titles.map((t) => t.id);
  const flatAnswers = await listAnswersForTitleIds(config.organization_id, titleIds);
  const userIds = titles.map((t) => t.userId).filter((x): x is number => x != null);
  const users = await listUsersByIds(userIds);

  const byTitle = new Map<number, typeof flatAnswers>();
  for (const a of flatAnswers) {
    const list = byTitle.get(a.answerTitleId) ?? [];
    list.push(a);
    byTitle.set(a.answerTitleId, list);
  }

  return titles.map((t) => {
    const u = t.userId != null ? users.get(t.userId) : null;
    const ansList = byTitle.get(t.id) ?? [];
    const answers: Record<number, { display: string; linkUrl?: string; checkmark?: boolean }> = {};
    for (const ar of ansList) {
      answers[ar.questionId] = formatAnswerValue(
        ar.answerValue,
        ar.questionType,
        ar.questionMetaData
      );
    }
    return {
      answerTitleId: t.id,
      createdAt: t.createdAt.toISOString(),
      user: u
        ? {
            id: u.id,
            firstName: u.firstName,
            lastName: u.lastName,
            email: u.email,
            phone: u.phone,
          }
        : null,
      answers,
    };
  });
}

export async function loadFormResponsesPage(
  config: FormPageConfig,
  opts: {
    questionnaireId: number;
    from: Date;
    to: Date;
    cursor: { createdAt: string; id: number } | null;
    /** When set, returns only submissions newer than this watermark (incremental refresh) */
    newerThan?: { createdAt: string; id: number } | null;
  }
): Promise<FormResponsesPage> {
  const limit = Math.min(Math.max(config.titles_per_page || 25, 5), 100);
  const orgId = config.organization_id;

  const [questionnaireTitle, columns, titlePack] = await Promise.all([
    getQuestionnaireTitle(orgId, opts.questionnaireId),
    listQuestionsForQuestionnaire(opts.questionnaireId),
    opts.newerThan
      ? listAnswerTitlesNewerThan({
          organizationId: orgId,
          questionnaireId: opts.questionnaireId,
          from: opts.from,
          to: opts.to,
          newerThan: opts.newerThan,
          limit,
        }).then((r) => ({
          titles: r.titles,
          nextCursor: null as { createdAt: string; id: number } | null,
          incremental: true,
        }))
      : listAnswerTitlesPage({
          organizationId: orgId,
          questionnaireId: opts.questionnaireId,
          from: opts.from,
          to: opts.to,
          limit,
          cursor: opts.cursor,
        }).then((r) => ({
          titles: r.titles,
          nextCursor: r.nextCursor,
          incremental: false,
        })),
  ]);

  const built = await buildRowsFromTitles(config, titlePack.titles);
  const rows = await attachStaffStatusesToRows(config.id, built);

  return {
    questionnaireTitle,
    columns,
    rows,
    nextCursor: titlePack.nextCursor,
    incremental: titlePack.incremental,
  };
}

export async function loadFormResponsesForExport(
  config: FormPageConfig,
  opts: {
    questionnaireId: number;
    from: Date;
    to: Date;
  },
  maxTitles = 2000
): Promise<{ columns: QuestionColumnMeta[]; rows: FormResponseRow[] }> {
  const columns: QuestionColumnMeta[] = [];
  const rows: FormResponseRow[] = [];
  let cursor: { createdAt: string; id: number } | null = null;

  while (rows.length < maxTitles) {
    const page = await loadFormResponsesPage(config, { ...opts, cursor });
    if (columns.length === 0) columns.push(...page.columns);
    rows.push(...page.rows);
    if (!page.nextCursor || page.rows.length === 0) break;
    cursor = page.nextCursor;
  }

  const exportColumns = filterColumnsWithAnswersInRows(columns, rows);

  return { columns: exportColumns, rows };
}

function csvEscape(value: string): string {
  if (/[",\n\r]/.test(value)) {
    return `"${value.replace(/"/g, '""')}"`;
  }
  return value;
}

function csvStatusLabel(r: FormResponseRow): string {
  const s = (r.staffStatus ?? 'pending') as StaffInquiryStatus;
  return STAFF_INQUIRY_STATUS_LABELS[s] ?? s;
}

export function formResponsesToCsv(
  columns: QuestionColumnMeta[],
  rows: FormResponseRow[]
): string {
  const headers = [
    'Submitted',
    'Status',
    'UserId',
    'FirstName',
    'LastName',
    'Email',
    'Phone',
    ...columns.map((c) => c.question || `Question ${c.id}`),
  ];
  const lines = [headers.map(csvEscape).join(',')];
  for (const r of rows) {
    const base = [
      r.createdAt,
      csvStatusLabel(r),
      r.user ? String(r.user.id) : '',
      r.user?.firstName ?? '',
      r.user?.lastName ?? '',
      r.user?.email ?? '',
      r.user?.phone ?? '',
    ];
    const cells = columns.map((c) => {
      const a = r.answers[c.id];
      if (a?.checkmark) return 'Yes';
      return a?.display ?? '';
    });
    lines.push([...base, ...cells].map(csvEscape).join(','));
  }
  return lines.join('\r\n');
}
