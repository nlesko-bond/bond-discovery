#!/usr/bin/env node
/**
 * Copies discovery page configs from PRODUCTION Supabase to a STAGING project,
 * scrubbing Bond API keys and GTM IDs so staging can't touch production systems
 * with real credentials.
 *
 * Usage:
 *   STAGING_SUPABASE_URL=https://<staging-ref>.supabase.co \
 *   STAGING_SUPABASE_SERVICE_KEY=<staging service role key> \
 *   node scripts/seed-staging.mjs [--include-api-keys] [--dry-run]
 *
 * Reads production from the same env vars the app uses
 * (NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY/SUPABASE_SERVICE_ROLE_KEY),
 * loaded from .env.local automatically.
 *
 * Safe to re-run: rows are upserted by slug/id.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync } from 'node:fs';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const DRY = process.argv.includes('--dry-run');
const KEEP_KEYS = process.argv.includes('--include-api-keys');

const prodUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const prodKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const stagingUrl = process.env.STAGING_SUPABASE_URL;
const stagingKey = process.env.STAGING_SUPABASE_SERVICE_KEY;

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!prodUrl || !prodKey) fail('Production env missing: NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY (see .env.local)');
if (!stagingUrl || !stagingKey) fail('Staging env missing: set STAGING_SUPABASE_URL and STAGING_SUPABASE_SERVICE_KEY (from the staging project: Settings → API)');
if (stagingUrl === prodUrl) fail('STAGING_SUPABASE_URL equals the production URL — refusing to run.');

const prod = createClient(prodUrl, prodKey);
const staging = createClient(stagingUrl, stagingKey);

const { data: groups, error: gErr } = await prod.from('partner_groups').select('*');
if (gErr) fail(`Reading partner_groups from production: ${gErr.message}`);
const { data: pages, error: pErr } = await prod.from('discovery_pages').select('*');
if (pErr) fail(`Reading discovery_pages from production: ${pErr.message}`);

const scrubbedGroups = (groups ?? []).map((g) => ({
  ...g,
  api_key: KEEP_KEYS ? g.api_key : null,
  gtm_id: null,
}));
const scrubbedPages = (pages ?? []).map((p) => ({
  ...p,
  api_key: KEEP_KEYS ? p.api_key : null,
  gtm_id: null,
}));

console.log(`Production: ${scrubbedGroups.length} partner_groups, ${scrubbedPages.length} discovery_pages`);
console.log(`API keys: ${KEEP_KEYS ? 'KEPT (--include-api-keys)' : 'scrubbed (pages will use DEFAULT_API_KEY; pass --include-api-keys if staging should hit real org data)'}`);

if (DRY) {
  console.log('\n--dry-run: nothing written. Slugs that would be seeded:');
  console.log(scrubbedPages.map((p) => `  ${p.slug}${p.is_active ? '' : ' (inactive)'}`).join('\n'));
  process.exit(0);
}

if (scrubbedGroups.length) {
  const { error } = await staging.from('partner_groups').upsert(scrubbedGroups, { onConflict: 'id' });
  if (error) fail(`Writing partner_groups to staging: ${error.message}\n(If the table does not exist, create the schema first — see docs/environments.md)`);
}
const { error: wErr } = await staging.from('discovery_pages').upsert(scrubbedPages, { onConflict: 'slug' });
if (wErr) fail(`Writing discovery_pages to staging: ${wErr.message}\n(If the table does not exist, create the schema first — see docs/environments.md)`);

console.log(`\n✔ Seeded staging: ${scrubbedGroups.length} groups, ${scrubbedPages.length} pages.`);
console.log('Next: set the staging Vercel env vars (docs/environments.md) and load /admin/pages on the staging URL.');
