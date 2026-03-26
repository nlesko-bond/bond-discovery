/**
 * Read-only Postgres access to Bond forms tables (read replica).
 *
 * Matches Bond `public` schema: PascalCase table names ("Questionnaires", …)
 * and lowercase quoted PK column "id" (not "Id").
 *
 * Optional: BOND_FORMS_PG_SCHEMA only if these tables are outside public.
 *
 * TLS: pg merges parse(connectionString) over Pool config, so ?sslmode=require becomes ssl: {}
 * and wipes explicit ssl — strip ssl* query params and set tls here.
 * Default: rejectUnauthorized: false (Vercel/Node often lacks RDS CA in trust store).
 * BOND_FORMS_PG_SSL_CA (PEM, \\n for newlines) + verification, or BOND_FORMS_PG_SSL_STRICT=1
 * to require default Node verification (will fail without a resolvable chain).
 */

import type { ConnectionOptions } from 'tls';
import { Pool, type PoolClient } from 'pg';
import { filterStaffQuestionColumns } from '@/lib/form-question-visibility';
import type { QuestionColumnMeta, QuestionnaireListItem } from '@/types/form-pages';
import { getFormsPgSchemaQualifier } from '@/lib/forms-pg-dialect';

/** Query keys that must be removed so they cannot overwrite Pool `ssl` (see pg ConnectionParameters). */
const PG_URL_SSL_QUERY_KEYS = [
  'sslmode',
  'ssl',
  'sslcert',
  'sslkey',
  'sslrootcert',
  'uselibpqcompat',
] as const;

function sanitizeBondFormsDatabaseUrl(connectionString: string): string {
  try {
    const u = new URL(connectionString);
    for (const key of PG_URL_SSL_QUERY_KEYS) {
      u.searchParams.delete(key);
    }
    return u.toString();
  } catch {
    return connectionString;
  }
}

let pool: Pool | null = null;

export function isFormsPgConfigured(): boolean {
  return !!process.env.BOND_FORMS_DATABASE_URL?.trim();
}

function schemaQ(): string {
  return getFormsPgSchemaQualifier();
}

function getFormsPgSsl(): ConnectionOptions {
  const caRaw = process.env.BOND_FORMS_PG_SSL_CA?.trim();
  if (caRaw) {
    return {
      rejectUnauthorized: true,
      ca: caRaw.replace(/\\n/g, '\n'),
    };
  }
  const strict =
    process.env.BOND_FORMS_PG_SSL_STRICT === '1' ||
    process.env.BOND_FORMS_PG_SSL_STRICT === 'true';
  if (strict) {
    return { rejectUnauthorized: true };
  }
  return { rejectUnauthorized: false };
}

function getPool(): Pool {
  const url = process.env.BOND_FORMS_DATABASE_URL?.trim();
  if (!url) {
    throw new Error('BOND_FORMS_DATABASE_URL is not set');
  }
  if (!pool) {
    pool = new Pool({
      connectionString: sanitizeBondFormsDatabaseUrl(url),
      ssl: getFormsPgSsl(),
      max: Number(process.env.BOND_FORMS_PG_POOL_MAX || 2),
      idleTimeoutMillis: 10_000,
      connectionTimeoutMillis: 25_000,
    });
  }
  return pool;
}

async function withClient<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const p = getPool();
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
    const sql = `
      SELECT qu."id"::int AS id, qu."title" AS title
      FROM ${sq}"Questionnaires" qu
      WHERE qu."organizationId" = $1
      ORDER BY qu."title" NULLS LAST, qu."id"
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
    const sql = `
      SELECT qu."title" AS title
      FROM ${sq}"Questionnaires" qu
      WHERE qu."organizationId" = $1 AND qu."id"::int = $2
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
    const sql = `
      SELECT
        qu."id"::int AS id,
        qu."questionnaireId"::int AS questionnaireid,
        qu."ordinal" AS ordinal,
        qu."questionType" AS questiontype,
        qu."question" AS question,
        qu."metaData" AS "metaData"
      FROM ${sq}"Questions" qu
      WHERE qu."questionnaireId"::int = $1
      ORDER BY qu."ordinal" NULLS LAST, qu."id"
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
    return filterStaffQuestionColumns(
      rows.map((r) => ({
        id: r.id,
        questionnaireId: r.questionnaireid,
        ordinal: r.ordinal,
        questionType: r.questiontype,
        question: r.question,
        metaData: r.metaData ?? r.metadata,
      }))
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
  cursor: { createdAt: string; id: number } | null;
}

export async function listAnswerTitlesPage(
  params: AnswerTitlePageParams
): Promise<{ titles: AnswerTitleRow[]; nextCursor: { createdAt: string; id: number } | null }> {
  return withClient(async (c) => {
    const sq = schemaQ();

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
      sqlExtra += ` AND (at."createdAt", at."id") < ($${idx}::timestamptz, $${idx + 1}::int)`;
      idx += 2;
    }

    values.push(params.limit + 1);
    const limitIdx = idx;

    const sql = `
      SELECT at."id"::int AS id, at."createdAt" AS "createdAt", at."userId"::int AS "userId"
      FROM ${sq}"AnswerTitles" at
      WHERE at."organizationId" = $1
        AND at."questionnaireId"::int = $2
        AND at."createdAt" >= $3::timestamptz
        AND at."createdAt" <= $4::timestamptz
        ${sqlExtra}
      ORDER BY at."createdAt" DESC, at."id" DESC
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
  /** json/jsonb from Postgres may be object/array; text column is string */
  answerValue: unknown;
  questionType: string | null;
}

export async function listAnswersForTitleIds(
  organizationId: number,
  titleIds: number[]
): Promise<AnswerRowDb[]> {
  if (titleIds.length === 0) return [];
  return withClient(async (c) => {
    const sq = schemaQ();
    const sql = `
      SELECT
        a."answerTitleId"::int AS "answerTitleId",
        a."questionId"::int AS "questionId",
        a."answerValue" AS "answerValue",
        q."questionType" AS "questionType"
      FROM ${sq}"Answers" a
      LEFT JOIN ${sq}"Questions" q ON q."id" = a."questionId"
      WHERE a."organizationId" = $1
        AND a."answerTitleId" = ANY($2::int[])
      `;
    const { rows } = await c.query<{
      answerTitleId: number;
      questionId: number;
      answerValue: unknown;
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
    const sql = `
      SELECT
        u."id"::int AS id,
        u."firstName" AS "firstName",
        u."lastName" AS "lastName",
        u."email" AS email,
        u."phoneNumber" AS phone
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
