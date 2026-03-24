/**
 * Read-only Postgres access to Bond forms tables (read replica).
 * Identifier quoting matches camelCase columns described in the product spec.
 *
 * Dynamic import + webpackIgnore: `pg` resolves at runtime on the server (install via npm).
 */

import type { Pool, PoolClient } from 'pg';
import type { QuestionColumnMeta, QuestionnaireListItem } from '@/types/form-pages';

let pool: Pool | null = null;

export function isFormsPgConfigured(): boolean {
  return !!process.env.BOND_FORMS_DATABASE_URL?.trim();
}

async function getPool(): Promise<Pool> {
  const url = process.env.BOND_FORMS_DATABASE_URL?.trim();
  if (!url) {
    throw new Error('BOND_FORMS_DATABASE_URL is not set');
  }
  if (!pool) {
    const { Pool: PgPool } = await import(/* webpackIgnore: true */ 'pg');
    pool = new PgPool({
      connectionString: url,
      max: Number(process.env.BOND_FORMS_PG_POOL_MAX || 2),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 10_000,
    });
  }
  return pool;
}

async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const p = await getPool();
  const client = await p.connect();
  try {
    await client.query('SET statement_timeout = 15000');
    await client.query("SET idle_in_transaction_session_timeout = '10s'");
    return await fn(client);
  } finally {
    client.release();
  }
}

export async function listQuestionnaires(organizationId: number): Promise<QuestionnaireListItem[]> {
  return withClient(async (c) => {
    const { rows } = await c.query<{
      id: number;
      title: string | null;
    }>(
      `
      SELECT q."Id"::int AS id, q."title" AS title
      FROM "Questionnaires" q
      WHERE q."organizationId" = $1
      ORDER BY q."title" NULLS LAST, q."Id"
      `,
      [organizationId]
    );
    return rows;
  });
}

export async function getQuestionnaireTitle(
  organizationId: number,
  questionnaireId: number
): Promise<string | null> {
  return withClient(async (c) => {
    const { rows } = await c.query<{ title: string | null }>(
      `
      SELECT q."title" AS title
      FROM "Questionnaires" q
      WHERE q."organizationId" = $1 AND q."Id"::int = $2
      LIMIT 1
      `,
      [organizationId, questionnaireId]
    );
    return rows[0]?.title ?? null;
  });
}

export async function listQuestionsForQuestionnaire(
  questionnaireId: number
): Promise<QuestionColumnMeta[]> {
  return withClient(async (c) => {
    const { rows } = await c.query<{
      id: number;
      questionnaireid: number;
      ordinal: number | null;
      questiontype: string | null;
      question: string | null;
      metaData: unknown;
    }>(
      `
      SELECT
        qu."Id"::int AS id,
        qu."questionnaireId"::int AS questionnaireId,
        qu."ordinal" AS ordinal,
        qu."questionType" AS questionType,
        qu."question" AS question,
        qu."metaData" AS "metaData"
      FROM "Questions" qu
      WHERE qu."questionnaireId"::int = $1
      ORDER BY qu."ordinal" NULLS LAST, qu."Id"
      `,
      [questionnaireId]
    );
    return rows.map(
      (r: {
        id: number;
        questionnaireid: number;
        ordinal: number | null;
        questiontype: string | null;
        question: string | null;
        metaData?: unknown;
        metadata?: unknown;
      }) => ({
        id: r.id,
        questionnaireId: r.questionnaireid,
        ordinal: r.ordinal,
        questionType: r.questiontype,
        question: r.question,
        metaData: r.metaData ?? r.metadata,
      })
    );
  });
}

export interface AnswerTitleRow {
  id: number;
  createdAt: Date;
  userId: number | null;
}

export interface AnswerTitlePageParams {
  organizationId: number;
  questionnaireId: number;
  from: Date;
  to: Date;
  limit: number;
  search: string;
  cursor: { createdAt: string; id: number } | null;
}

export async function listAnswerTitlesPage(
  params: AnswerTitlePageParams
): Promise<{ titles: AnswerTitleRow[]; nextCursor: { createdAt: string; id: number } | null }> {
  const search = params.search.trim().toLowerCase();
  return withClient(async (c) => {
    const values: unknown[] = [
      params.organizationId,
      params.questionnaireId,
      params.from.toISOString(),
      params.to.toISOString(),
    ];
    let sqlExtra = '';
    let idx = 5;

    if (params.cursor) {
      values.push(params.cursor.createdAt, params.cursor.id);
      sqlExtra += ` AND (at."createdAt", at."Id") < ($${idx}::timestamptz, $${idx + 1}::int)`;
      idx += 2;
    }

    if (search.length > 0) {
      values.push(search);
      sqlExtra += `
        AND EXISTS (
          SELECT 1 FROM "Answers" a
          WHERE a."answerTitleId" = at."Id"
            AND a."organizationId" = $1
            AND (
              position($${idx} in lower(coalesce(a."questionText", ''))) > 0
              OR position($${idx} in lower(coalesce(a."answerValue"::text, ''))) > 0
            )
        )
      `;
      idx += 1;
    }

    values.push(params.limit + 1);
    const limitIdx = idx;

    const sql = `
      SELECT at."Id"::int AS id, at."createdAt" AS "createdAt", at."userId"::int AS "userId"
      FROM "AnswerTitles" at
      WHERE at."organizationId" = $1
        AND at."questionnaireId"::int = $2
        AND at."createdAt" >= $3::timestamptz
        AND at."createdAt" <= $4::timestamptz
        ${sqlExtra}
      ORDER BY at."createdAt" DESC, at."Id" DESC
      LIMIT $${limitIdx}
    `;

    const { rows } = await c.query<{
      id: number;
      createdAt: Date;
      userId: number | null;
    }>(sql, values);

    const hasMore = rows.length > params.limit;
    const slice = hasMore ? rows.slice(0, params.limit) : rows;
    const last = slice[slice.length - 1];
    const nextCursor =
      hasMore && last
        ? { createdAt: last.createdAt.toISOString(), id: last.id }
        : null;

    return {
      titles: slice.map((r: { id: number; createdAt: Date; userId: number | null }) => ({
        id: r.id,
        createdAt: r.createdAt,
        userId: r.userId,
      })),
      nextCursor,
    };
  });
}

export interface AnswerRowDb {
  answerTitleId: number;
  questionId: number;
  answerValue: string | null;
  questionType: string | null;
}

export async function listAnswersForTitleIds(
  organizationId: number,
  titleIds: number[]
): Promise<AnswerRowDb[]> {
  if (titleIds.length === 0) return [];
  return withClient(async (c) => {
    const { rows } = await c.query<{
      answerTitleId: number;
      questionId: number;
      answerValue: string | null;
      questionType: string | null;
    }>(
      `
      SELECT
        a."answerTitleId"::int AS "answerTitleId",
        a."questionId"::int AS "questionId",
        a."answerValue" AS "answerValue",
        q."questionType" AS "questionType"
      FROM "Answers" a
      LEFT JOIN "Questions" q ON q."Id" = a."questionId"
      WHERE a."organizationId" = $1
        AND a."answerTitleId" = ANY($2::int[])
      `,
      [organizationId, titleIds]
    );
    return rows;
  });
}

export interface UserRowDb {
  id: number;
  firstName: string | null;
  lastName: string | null;
  email: string | null;
  phone: string | null;
}

export async function listUsersByIds(userIds: number[]): Promise<Map<number, UserRowDb>> {
  const unique = [...new Set(userIds)].filter((id) => Number.isFinite(id));
  if (unique.length === 0) return new Map();
  return withClient(async (c) => {
    const { rows } = await c.query<{
      id: number;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    }>(
      `
      SELECT
        u."id"::int AS id,
        u."firstName" AS "firstName",
        u."lastName" AS "lastName",
        u."email" AS email,
        u."phone" AS phone
      FROM "Users" u
      WHERE u."id" = ANY($1::int[])
      `,
      [unique]
    );
    const m = new Map<number, UserRowDb>();
    for (const r of rows) {
      m.set(r.id, r);
    }
    return m;
  });
}
