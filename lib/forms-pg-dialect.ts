/**
 * Bond production DB may use quoted camelCase ("Questionnaires"."organizationId")
 * or conventional snake_case (questionnaires.organization_id).
 * Set BOND_FORMS_SQL_DIALECT=snake if questionnaires fail with "relation does not exist".
 *
 * Optional: BOND_FORMS_PG_SCHEMA=myschema → FROM "myschema".questionnaires
 */

export type FormsPgSqlDialect = 'quoted_camel' | 'snake';

export function getFormsPgSqlDialect(): FormsPgSqlDialect {
  const d = process.env.BOND_FORMS_SQL_DIALECT?.trim().toLowerCase();
  if (d === 'snake') return 'snake';
  return 'quoted_camel';
}

/** Safe schema name fragment for SQL (alphanumeric + underscore only). */
export function getFormsPgSchemaQualifier(): string {
  const raw = process.env.BOND_FORMS_PG_SCHEMA?.trim();
  if (!raw) return '';
  const safe = raw.replace(/[^a-zA-Z0-9_]/g, '');
  if (!safe) return '';
  return `"${safe}".`;
}

export function shouldExposeFormsPgErrors(): boolean {
  return process.env.FORMS_PG_EXPOSE_ERRORS === '1' || process.env.FORMS_PG_EXPOSE_ERRORS === 'true';
}
