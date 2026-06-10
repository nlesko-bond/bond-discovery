import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

/**
 * Env-resolution tests for lib/supabase.ts (plan 005).
 *
 * NOTE on the deprecated fallback: production Vercel env vars could not be
 * verified at implementation time, so the hardcoded production fallback is
 * retained for exactly one release behind the single DEPRECATED_PROD_FALLBACK
 * constant, with a loud console.error when used. Once the constant is set to
 * null (next release), the "missing env" cases below flip from
 * warn-and-fallback to throwing SUPABASE_ENV_ERROR.
 */

const ENV_VARS = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
] as const;

function clearSupabaseEnv() {
  for (const name of ENV_VARS) {
    vi.stubEnv(name, '');
  }
}

function fakeJwt(payload: Record<string, unknown>): string {
  const body = Buffer.from(JSON.stringify(payload)).toString('base64url');
  return `header.${body}.sig`;
}

async function loadModule() {
  return import('@/lib/supabase');
}

describe('supabase env resolution', () => {
  beforeEach(() => {
    vi.resetModules();
    clearSupabaseEnv();
  });

  afterEach(() => {
    vi.unstubAllEnvs();
    vi.restoreAllMocks();
  });

  it('constructs clients from env when all vars are present', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://envproject.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', fakeJwt({ ref: 'envproject', role: 'anon' }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mod = await loadModule();
    const client = mod.getSupabasePublic();
    expect(client).toBeTruthy();
    expect(mod.getSupabaseUrlForServer()).toBe('https://envproject.supabase.co');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('returns the same lazy public client on repeat calls', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://envproject.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', fakeJwt({ ref: 'envproject', role: 'anon' }));

    const mod = await loadModule();
    expect(mod.getSupabasePublic()).toBe(mod.getSupabasePublic());
  });

  it('missing public env throws the actionable env error (fallback removed)', async () => {
    const mod = await loadModule();
    expect(() => mod.getSupabasePublic()).toThrow(mod.SUPABASE_ENV_ERROR);
  });

  it('missing server env throws the actionable env error (fallback removed)', async () => {
    const mod = await loadModule();
    expect(() => mod.getSupabaseUrlForServer()).toThrow(mod.SUPABASE_ENV_ERROR);
  });

  it('derives the server URL from the service-role JWT ref when no URL env is set', async () => {
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', fakeJwt({ ref: 'abc123', role: 'service_role' }));
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});

    const mod = await loadModule();
    expect(mod.getSupabaseUrlForServer()).toBe('https://abc123.supabase.co');
    expect(errorSpy).not.toHaveBeenCalled();
  });

  it('prefers explicit SUPABASE_URL over JWT derivation', async () => {
    vi.stubEnv('SUPABASE_URL', 'https://explicit.supabase.co');
    vi.stubEnv('SUPABASE_SERVICE_ROLE_KEY', fakeJwt({ ref: 'abc123', role: 'service_role' }));

    const mod = await loadModule();
    expect(mod.getSupabaseUrlForServer()).toBe('https://explicit.supabase.co');
  });

  it('exports the actionable error message used once the fallback is removed', async () => {
    const mod = await loadModule();
    expect(mod.SUPABASE_ENV_ERROR).toBe(
      'Supabase env not configured: set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY (see .env.example)'
    );
  });
});
