/**
 * Read-only Postgres access to Bond forms tables (read replica).
 *
 * Dialects:
 * - quoted_camel (default): "Questionnaires"."organizationId" — matches TypeORM-style quoted identifiers.
 * - snake: questionnaires.organization_id — common Sequelize/Postgres naming.
 *
 * Set BOND_FORMS_SQL_DIALECT=snake on Vercel if you get 500 / "relation does not exist".
 * Set BOND_FORMS_PG_SCHEMA=myschema if tables are not in public.
 */

import type { Pool, PoolClient } from 'pg';
import type { QuestionColumnMeta, QuestionnaireListItem } from '@/types/form-pages';
import { getFormsPgSchemaQualifier, getFormsPgSqlDialect } from '@/lib/forms-pg-dialect';

let pool: Pool | null = null;

export function isFormsPgConfigured(): boolean {
  return !!process.env.BOND_FORMS_DATABASE_URL?.trim();
}

function schemaQ(): string {
  return getFormsPgSchemaQualifier();
}

function snake(): boolean {
  return getFormsPgSqlDialect() === 'snake';
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
      connectionTimeoutMillis: 25_000,
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

export function formatFormsPgError(e: unknown): { message: string; code?: string } {
  const err = e as { message?: string; code?: string };
  return { message: err?.message || String(e), code: err?.code };
}

export async function listQuestionnaires(organizationId: number): Promise<QuestionnaireListItem[]> {
  return withClient(async (c) => {
    const sq = schemaQ();
    const sql = snake()
      ? `
      SELECT qu.id::int AS id, qu.title AS title
      FROM ${sq}questionnaires qu
      WHERE qu.organization_id = $1
      ORDER BY qu.title NULLS LAST, qu.id
      `
      : `
      SELECT qu."Id"::int AS id, qu."title" AS title
      FROM ${sq}"Questionnaires" qu
      WHERE qu."organizationId" = $1
      ORDER BY qu."title" NULLS LAST, qu."Id"
      `;
    const { rows } = await c.query<{ id: number; title: string | null }>(sql, [organizationId]);
    return rows;
  });
}

export async function getQuestionnaireTitle(
  organizationId: number,
  questionnaireId: number
): Promise<string | null> {
  return withClient(async (c) => {
    const sq = schemaQ();
    const sql = snake()
      ? `
      SELECT qu.title AS title
      FROM ${sq}questionnaires qu
      WHERE qu.organization_id = $1 AND qu.id::int = $2
      LIMIT 1
      `
      : `
      SELECT qu."title" AS title
      FROM ${sq}"Questionnaires" qu
      WHERE qu."organizationId" = $1 AND qu."Id"::int = $2
      LIMIT 1
      `;
    const { rows } = await c.query<{ title: string | null }>(sql, [organizationId, questionnaireId]);
    return rows[0]?.title ?? null;
  });
}

export async function listQuestionsForQuestionnaire(
  questionnaireId: number
): Promise<QuestionColumnMeta[]> {
  return withClient(async (c) => {
    const sq = schemaQ();
    const sql = snake()
      ? `
      SELECT
        qu.id::int AS id,
        qu.questionnaire_id::int AS questionnaireid,
        qu.ordinal AS ordinal,
        qu.question_type AS questiontype,
        qu.question AS question,
        qu.meta_data AS "metaData"
      FROM ${sq}questions qu
      WHERE qu.questionnaire_id::int = $1
      ORDER BY qu.ordinal NULLS LAST, qu.id
      `
      : `
      SELECT
        qu."Id"::int AS id,
        qu."questionnaireId"::int AS questionnaireId,
        qu."ordinal" AS ordinal,
        qu."questionType" AS questionType,
        qu."question" AS question,
        qu."metaData" AS "metaData"
      FROM ${sq}"Questions" qu
      WHERE qu."questionnaireId"::int = $1
      ORDER BY qu."ordinal" NULLS LAST, qu."Id"
      `;
    const { rows } = await c.query<{
      id: number;
      questionnaireid: number;
      ordinal: number | null;
      questiontype: string | null;
      question: string | null;
      metaData?: unknown;
      metadata?: unknown;
    }>(sql, [questionnaireId]);
    return rows.map((r) => ({
      id: r.id,
      questionnaireId: r.questionnaireid,
      ordinal: r.ordinal,
      questionType: r.questiontype,
      question: r.question,
      metaData: r.metaData ?? r.metadata,
    }));
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
    const sq = schemaQ();
    const sn = snake();

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
      if (sn) {
        sqlExtra += ` AND (at.created_at, at.id) < ($${idx}::timestamptz, $${idx + 1}::int)`;
      } else {
        sqlExtra += ` AND (at."createdAt", at."Id") < ($${idx}::timestamptz, $${idx + 1}::int)`;
      }
      idx += 2;
    }

    if (search.length > 0) {
      values.push(search);
      if (sn) {
        sqlExtra += `
        AND EXISTS (
          SELECT 1 FROM ${sq}answers a
          WHERE a.answer_title_id = at.id
            AND a.organization_id = $1
            AND (
              position($${idx} in lower(coalesce(a.question_text, ''))) > 0
              OR position($${idx} in lower(coalesce(a.answer_value::text, ''))) > 0
            )
        )
      `;
      } else {
        sqlExtra += `
        AND EXISTS (
          SELECT 1 FROM ${sq}"Answers" a
          WHERE a."answerTitleId" = at."Id"
            AND a."organizationId" = $1
            AND (
              position($${idx} in lower(coalesce(a."questionText", ''))) > 0
              OR position($${idx} in lower(coalesce(a."answerValue"::text, ''))) > 0
            )
        )
      `;
      }
      idx += 1;
    }

    values.push(params.limit + 1);
    const limitIdx = idx;

    const sql = sn
      ? `
      SELECT at.id::int AS id, at.created_at AS "createdAt", at.user_id::int AS "userId"
      FROM ${sq}answer_titles at
      WHERE at.organization_id = $1
        AND at.questionnaire_id::int = $2
        AND at.created_at >= $3::timestamptz
        AND at.created_at <= $4::timestamptz
        ${sqlExtra}
      ORDER BY at.created_at DESC, at.id DESC
      LIMIT $${limitIdx}
    `
      : `
      SELECT at."Id"::int AS id, at."createdAt" AS "createdAt", at."userId"::int AS "userId"
      FROM ${sq}"AnswerTitles" at
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
      titles: slice.map((r) => ({
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
    const sq = schemaQ();
    const sql = snake()
      ? `
      SELECT
        a.answer_title_id::int AS "answerTitleId",
        a.question_id::int AS "questionId",
        a.answer_value AS "answerValue",
        q.question_type AS "questionType"
      FROM ${sq}answers a
      LEFT JOIN ${sq}questions q ON q.id = a.question_id
      WHERE a.organization_id = $1
        AND a.answer_title_id = ANY($2::int[])
      `
      : `
      SELECT
        a."answerTitleId"::int AS "answerTitleId",
        a."questionId"::int AS "questionId",
        a."answerValue" AS "answerValue",
        q."questionType" AS "questionType"
      FROM ${sq}"Answers" a
      LEFT JOIN ${sq}"Questions" q ON q."Id" = a."questionId"
      WHERE a."organizationId" = $1
        AND a."answerTitleId" = ANY($2::int[])
      `;
    const { rows } = await c.query<{
      answerTitleId: number;
      questionId: number;
      answerValue: string | null;
      questionType: string | null;
    }>(sql, [organizationId, titleIds]);
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
    const sq = schemaQ();
    const sql = snake()
      ? `
      SELECT
        u.id::int AS id,
        u.first_name AS "firstName",
        u.last_name AS "lastName",
        u.email AS email,
        u.phone AS phone
      FROM ${sq}users u
      WHERE u.id = ANY($1::int[])
      `
      : `
      SELECT
        u."id"::int AS id,
        u."firstName" AS "firstName",
        u."lastName" AS "lastName",
        u."email" AS email,
        u."phone" AS phone
      FROM ${sq}"Users" u
      WHERE u."id" = ANY($1::int[])
      `;
    const { rows } = await c.query<{
      id: number;
      firstName: string | null;
      lastName: string | null;
      email: string | null;
      phone: string | null;
    }>(sql, [unique]);
    const m = new Map<number, UserRowDb>();
    for (const r of rows) {
      m.set(r.id, r);
    }
    return m;
  });
}
