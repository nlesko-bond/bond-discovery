/**
 * Optional schema qualifier when form tables are NOT in `public`.
 *
 * Most Bond setups use `public."Questionnaires"` etc. — leave BOND_FORMS_PG_SCHEMA unset.
 *
 * If tables lived in e.g. schema `analytics`, you would set BOND_FORMS_PG_SCHEMA=analytics
 * and queries become FROM "analytics"."Questionnaires" (not `analytics.questionnaires` unless unquoted).
 */

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
