-- Phase 1 studio auth: named users with email magic-link sign-in.
-- Replaces (and coexists with) the legacy tokenized access links in
-- tvmonitor_access. Bond admins add a user's email + orgs; the user signs in
-- at /tvmonitor/studio by requesting a single-use, short-lived login link.
-- Run against the same Supabase project as other migrations.

CREATE TABLE IF NOT EXISTS tvmonitor_users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email TEXT NOT NULL UNIQUE,          -- stored lowercased
  organization_ids INTEGER[] NOT NULL, -- one or more orgs (uber-orgs supported)
  role TEXT NOT NULL DEFAULT 'editor',

  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_login_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tvmonitor_users_email ON tvmonitor_users (email);

-- Single-use sign-in tokens (hash only; 15 min for self-requested logins,
-- 7 days for admin-issued invite links).
CREATE TABLE IF NOT EXISTS tvmonitor_login_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES tvmonitor_users(id) ON DELETE CASCADE,
  token_hash TEXT NOT NULL UNIQUE,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL,
  used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tvmonitor_login_tokens_user ON tvmonitor_login_tokens (user_id);
