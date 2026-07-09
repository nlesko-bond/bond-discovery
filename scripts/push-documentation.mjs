#!/usr/bin/env node
/**
 * Publishes documentation pages from the repo to the live docs system.
 *
 * Source of truth: docs/documentation/<path>.html  →  served at /documentation/<path>
 * (e.g. docs/documentation/website/discovery/guide.html
 *   →  https://discovery.bondsports.co/documentation/website/discovery/guide)
 *
 * Usage:
 *   npm run docs:push -- --dry-run     # show what would change
 *   npm run docs:push                  # upsert all repo docs pages
 *   npm run docs:push -- website/discovery/guide   # push one page
 *
 * Upserts by path: existing pages keep their is_active flag; new pages are
 * created active. Reads Supabase credentials from .env.local like the app.
 */
import { createClient } from '@supabase/supabase-js';
import { readFileSync, existsSync, readdirSync, statSync } from 'node:fs';
import { join, relative, sep } from 'node:path';

for (const file of ['.env.local', '.env']) {
  if (!existsSync(file)) continue;
  for (const line of readFileSync(file, 'utf8').split('\n')) {
    const m = line.match(/^([A-Z0-9_]+)=(.*)$/);
    if (m && !process.env[m[1]]) process.env[m[1]] = m[2];
  }
}

const DRY = process.argv.includes('--dry-run');
const onlyPaths = process.argv.slice(2).filter((a) => !a.startsWith('--'));

const DOCS_ROOT = 'docs/documentation';
const AUTHOR = process.env.DOCS_PUSH_EMAIL || 'docs-push@bondsports.co';
const PATH_SEGMENT_REGEX = /^[a-z0-9][a-z0-9-]*$/;

const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY;
// Dry runs only read; the anon key suffices when no service key is configured locally.
const key = serviceKey || (DRY ? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY : undefined);

function fail(msg) {
  console.error(`\n✖ ${msg}\n`);
  process.exit(1);
}

if (!url || !key) {
  fail(
    DRY
      ? 'Missing NEXT_PUBLIC_SUPABASE_URL + a Supabase key (see .env.local)'
      : 'Publishing needs SUPABASE_SERVICE_KEY in .env.local (Supabase dashboard → Settings → API → service_role). Use --dry-run to preview with the anon key.',
  );
}
if (!existsSync(DOCS_ROOT)) fail(`${DOCS_ROOT} not found — run from the repo root`);

const db = createClient(url, key);

function htmlFilesUnder(dir) {
  const out = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...htmlFilesUnder(full));
    else if (entry.endsWith('.html')) out.push(full);
  }
  return out;
}

const files = htmlFilesUnder(DOCS_ROOT)
  .map((file) => {
    const path = relative(DOCS_ROOT, file).replace(/\.html$/, '').split(sep).join('/');
    return { file, path };
  })
  .filter(({ path }) => onlyPaths.length === 0 || onlyPaths.includes(path));

if (files.length === 0) fail(onlyPaths.length ? `No repo docs match: ${onlyPaths.join(', ')}` : 'No .html files found');

for (const { path } of files) {
  const bad = path.split('/').find((segment) => !PATH_SEGMENT_REGEX.test(segment));
  if (bad) fail(`Path segment "${bad}" in "${path}" must be lowercase letters, numbers, hyphens`);
}

const { data: existing, error: readError } = await db
  .from('documentation_pages')
  .select('id, path, title, source_html, is_active');
if (readError) fail(`Reading documentation_pages: ${readError.message}`);
if (!serviceKey && (existing ?? []).length === 0) {
  console.warn(
    '⚠ Anon key sees no existing pages (RLS) — pages listed as "create" below may actually be updates. Add SUPABASE_SERVICE_KEY for an accurate preview.',
  );
}
const byPath = new Map((existing ?? []).map((row) => [row.path, row]));

let changed = 0;
for (const { file, path } of files) {
  const sourceHtml = readFileSync(file, 'utf8');
  const title = (sourceHtml.match(/<title>([^<]+)<\/title>/i)?.[1] ?? path).trim();
  const current = byPath.get(path);

  if (current && current.source_html === sourceHtml && current.title === title) {
    console.log(`  = ${path} (unchanged${current.is_active ? '' : ', INACTIVE'})`);
    continue;
  }

  changed++;
  if (current) {
    console.log(`  ~ ${path} → update "${title}"${current.is_active ? '' : ' (stays INACTIVE)'}${DRY ? ' [dry-run]' : ''}`);
    if (!DRY) {
      const { error } = await db
        .from('documentation_pages')
        .update({ title, source_html: sourceHtml, updated_by_email: AUTHOR })
        .eq('id', current.id);
      if (error) fail(`Updating ${path}: ${error.message}`);
    }
  } else {
    console.log(`  + ${path} → create "${title}" (active)${DRY ? ' [dry-run]' : ''}`);
    if (!DRY) {
      const { error } = await db
        .from('documentation_pages')
        .insert({ title, path, source_html: sourceHtml, is_active: true, created_by_email: AUTHOR, updated_by_email: AUTHOR });
      if (error) fail(`Creating ${path}: ${error.message}`);
    }
  }
}

console.log(`\n${DRY ? 'Would change' : 'Changed'} ${changed} of ${files.length} page(s).`);
