#!/usr/bin/env node
/**
 * Copies the portal-v2 rows expand toggles from a source Coppermine page
 * (default: coppermine-soccer) onto every discovery_pages row whose slug
 * contains "coppermine".
 *
 * Keys synced (the new rows expand settings):
 *   - portalRowActionMode
 *   - portalRowShowSegmentRegister
 *   - portalRowShowSegmentSpots
 *
 * Also strips the retired portalRowShowShortDescription key when present.
 *
 * Usage (loads .env.local / .env automatically):
 *   node scripts/sync-coppermine-row-toggles.mjs              # dry-run
 *   node scripts/sync-coppermine-row-toggles.mjs --apply      # write
 *   node scripts/sync-coppermine-row-toggles.mjs --apply --source=coppermine-soccer
 *
 * Requires NEXT_PUBLIC_SUPABASE_URL + SUPABASE_SERVICE_KEY (or SERVICE_ROLE_KEY).
 */
import { createClient } from '@supabase/supabase-js';
import { existsSync, readFileSync } from 'node:fs';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const match = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (match && !process.env[match[1]]) {
      process.env[match[1]] = match[2];
    }
  }
}

const APPLY = process.argv.includes('--apply');
const USE_STAGING = process.argv.includes('--staging');
const sourceArg = process.argv.find((arg) => arg.startsWith('--source='));
const SOURCE_SLUG = sourceArg ? sourceArg.slice('--source='.length) : 'coppermine-soccer';
const SLUG_SUBSTRING = 'coppermine';

const FEATURE_KEYS = [
  'portalRowActionMode',
  'portalRowShowSegmentRegister',
  'portalRowShowSegmentSpots',
];
const RETIRED_KEYS = ['portalRowShowShortDescription'];

const supabaseUrl = USE_STAGING
  ? process.env.STAGING_SUPABASE_URL
  : process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = USE_STAGING
  ? process.env.STAGING_SUPABASE_SERVICE_KEY
  : process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
const readKey =
  serviceKey ||
  (!USE_STAGING ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

function fail(message) {
  console.error(`\n${message}\n`);
  process.exit(1);
}

if (!supabaseUrl || !readKey) {
  fail(
    USE_STAGING
      ? 'Missing STAGING_SUPABASE_URL + STAGING_SUPABASE_SERVICE_KEY in .env.local.'
      : 'Missing NEXT_PUBLIC_SUPABASE_URL and a key (SUPABASE_SERVICE_KEY preferred; anon works for dry-run reads).',
  );
}
if (APPLY && !serviceKey) {
  fail(
    'Writes require a service-role key. Set SUPABASE_SERVICE_KEY (prod) or pass --staging with STAGING_SUPABASE_SERVICE_KEY.',
  );
}

const supabase = createClient(supabaseUrl, APPLY ? serviceKey : readKey);
console.log(`Target DB: ${USE_STAGING ? 'staging' : 'production'} (${supabaseUrl})`);

function readFeaturePatch(features) {
  const patch = {};
  for (const key of FEATURE_KEYS) {
    if (features[key] !== undefined) {
      patch[key] = features[key];
    }
  }
  return patch;
}

function needsUpdate(features, patch) {
  for (const key of FEATURE_KEYS) {
    if (patch[key] !== undefined && features[key] !== patch[key]) {
      return true;
    }
  }
  for (const key of RETIRED_KEYS) {
    if (features[key] !== undefined) {
      return true;
    }
  }
  return false;
}

function applyPatch(features, patch) {
  const next = { ...features, ...patch };
  for (const key of RETIRED_KEYS) {
    delete next[key];
  }
  return next;
}

const { data: sourcePage, error: sourceError } = await supabase
  .from('discovery_pages')
  .select('slug, features')
  .eq('slug', SOURCE_SLUG)
  .maybeSingle();

if (sourceError) {
  fail(`Failed to load source page "${SOURCE_SLUG}": ${sourceError.message}`);
}
if (!sourcePage) {
  fail(`Source page not found: ${SOURCE_SLUG}`);
}

const sourceFeatures =
  sourcePage.features && typeof sourcePage.features === 'object' ? sourcePage.features : {};
const patch = readFeaturePatch(sourceFeatures);

if (Object.keys(patch).length === 0) {
  fail(
    `Source "${SOURCE_SLUG}" has none of the expected keys set (${FEATURE_KEYS.join(', ')}). Save the rows toggles on that page in admin first.`,
  );
}

console.log(`Source: ${SOURCE_SLUG}`);
console.log('Patch:');
for (const [key, value] of Object.entries(patch)) {
  console.log(`  ${key}: ${JSON.stringify(value)}`);
}
console.log(`Also clearing retired keys when present: ${RETIRED_KEYS.join(', ')}`);
console.log(APPLY ? '\nMode: APPLY (writes enabled)\n' : '\nMode: DRY-RUN (pass --apply to write)\n');

const { data: pages, error: listError } = await supabase
  .from('discovery_pages')
  .select('id, slug, features')
  .ilike('slug', `%${SLUG_SUBSTRING}%`)
  .order('slug');

if (listError) {
  fail(`Failed to list Coppermine pages: ${listError.message}`);
}

const targets = pages ?? [];
if (targets.length === 0) {
  console.log('No Coppermine slugs found. Nothing to do.');
  process.exit(0);
}

let updated = 0;
let skipped = 0;

for (const page of targets) {
  const features =
    page.features && typeof page.features === 'object' ? { ...page.features } : {};
  if (!needsUpdate(features, patch)) {
    console.log(`= ${page.slug} (already matches)`);
    skipped += 1;
    continue;
  }

  const nextFeatures = applyPatch(features, patch);
  const changedKeys = FEATURE_KEYS.filter(
    (key) => patch[key] !== undefined && features[key] !== patch[key],
  );
  const clearedKeys = RETIRED_KEYS.filter((key) => features[key] !== undefined);
  console.log(
    `~ ${page.slug} → set [${changedKeys.join(', ') || '—'}]` +
      (clearedKeys.length ? `; clear [${clearedKeys.join(', ')}]` : ''),
  );

  if (!APPLY) {
    updated += 1;
    continue;
  }

  const { error: updateError } = await supabase
    .from('discovery_pages')
    .update({ features: nextFeatures, updated_at: new Date().toISOString() })
    .eq('id', page.id);

  if (updateError) {
    fail(`Failed updating ${page.slug}: ${updateError.message}`);
  }
  updated += 1;
}

console.log(
  `\nDone. ${APPLY ? 'Updated' : 'Would update'} ${updated} page(s); skipped ${skipped}.`,
);
if (!APPLY && updated > 0) {
  console.log('Re-run with --apply to write these changes.');
}
