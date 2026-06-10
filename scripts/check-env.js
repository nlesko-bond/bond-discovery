#!/usr/bin/env node
/**
 * Env sanity report (plan 005). Prints SET / MISSING for each env var the app
 * uses — never the values themselves (only the host for URLs). Exits 1 when a
 * required var is missing.
 *
 * Usage: npm run check:env   (or: node scripts/check-env.js)
 * Loads .env.local / .env from the repo root if present, like Next.js does.
 */

const fs = require('fs');
const path = require('path');

// --- minimal .env loader (no dotenv dependency) ---------------------------
function loadEnvFile(file) {
  if (!fs.existsSync(file)) return;
  for (const line of fs.readFileSync(file, 'utf8').split('\n')) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;
    const eq = trimmed.indexOf('=');
    if (eq === -1) continue;
    const key = trimmed.slice(0, eq).trim();
    let value = trimmed.slice(eq + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }
    if (!(key in process.env)) process.env[key] = value;
  }
}

const root = path.resolve(__dirname, '..');
loadEnvFile(path.join(root, '.env.local'));
loadEnvFile(path.join(root, '.env'));

// --- variable matrix --------------------------------------------------------
// `names`: aliases — SET if any alias is set.
const VARS = [
  {
    names: ['NEXT_PUBLIC_SUPABASE_URL', 'SUPABASE_URL'],
    required: true,
    url: true,
    desc: 'Supabase project URL (which database this deployment targets)',
  },
  {
    names: ['NEXT_PUBLIC_SUPABASE_ANON_KEY', 'SUPABASE_ANON_KEY'],
    required: true,
    desc: 'Supabase anon key (public, RLS-enforced reads)',
  },
  {
    names: ['SUPABASE_SERVICE_ROLE_KEY', 'SUPABASE_SERVICE_KEY'],
    required: true,
    desc: 'Supabase service-role key (server-side privileged operations)',
  },
  {
    names: ['KV_REST_API_URL'],
    required: false,
    url: true,
    desc: 'Upstash/Vercel KV REST URL (omit locally to use in-process memory cache)',
  },
  {
    names: ['KV_REST_API_TOKEN'],
    required: false,
    desc: 'Upstash/Vercel KV REST token',
  },
  {
    names: ['CRON_SECRET'],
    required: false,
    desc: 'Bearer token Vercel sends to /api/cron/* (required in deployed envs)',
  },
  {
    names: ['NEXT_PUBLIC_BOND_GTM_ID'],
    required: false,
    desc: 'Bond system GTM container id (use a staging container or leave empty off-prod)',
  },
  {
    names: ['NEXT_PUBLIC_BOND_CONSUMER_ORIGIN'],
    required: false,
    desc: 'Bond consumer origin override for host-shell bootstrap',
  },
];

function hostOf(value) {
  try {
    return new URL(value).host;
  } catch {
    return '(not a valid URL)';
  }
}

let missingRequired = false;
console.log('Environment sanity report (values are never printed)\n');

for (const v of VARS) {
  const setName = v.names.find((n) => process.env[n] && process.env[n].trim());
  const label = v.names.join(' | ');
  if (setName) {
    const detail = v.url ? ` -> host: ${hostOf(process.env[setName].trim())}` : '';
    console.log(`  SET      ${label} (via ${setName})${detail}`);
  } else {
    const tag = v.required ? 'MISSING*' : 'missing ';
    console.log(`  ${tag} ${label} — ${v.desc}`);
    if (v.required) missingRequired = true;
  }
}

console.log('');
if (missingRequired) {
  console.error(
    'MISSING* = required. Set the variables above (see .env.example) — without them the app ' +
      'falls back to the DEPRECATED hardcoded production Supabase project, and that fallback ' +
      'will be removed in the next release.'
  );
  process.exit(1);
}
console.log('All required env vars are set.');
