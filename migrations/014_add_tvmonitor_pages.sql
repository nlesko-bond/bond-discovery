-- TV Monitor pages: self-serve facility TV displays at /tvmonitor/{slug}.
-- Config (template, blocks, ads, design) lives in the `config` jsonb blob.
-- Run against the same Supabase project as other migrations.

CREATE TABLE IF NOT EXISTS tvmonitor_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  organization_id INTEGER NOT NULL,
  facility_id INTEGER NOT NULL,

  -- Full display config: template key, screen ratio, header/schedule/ad blocks, design.
  -- Shape is normalized in lib/tvmonitor-config.ts (normalizeTvMonitorConfig).
  config JSONB NOT NULL DEFAULT '{}'::jsonb,

  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_tvmonitor_pages_slug ON tvmonitor_pages (slug);
CREATE INDEX IF NOT EXISTS idx_tvmonitor_pages_org ON tvmonitor_pages (organization_id);
CREATE INDEX IF NOT EXISTS idx_tvmonitor_pages_active ON tvmonitor_pages (is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_tvmonitor_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_tvmonitor_pages_updated_at ON tvmonitor_pages;
CREATE TRIGGER trigger_tvmonitor_pages_updated_at
  BEFORE UPDATE ON tvmonitor_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_tvmonitor_pages_updated_at();

-- Org-scoped builder access for people outside Bond Sports.
-- A grant is a long-lived access link: the raw token is shown once at creation,
-- only its sha256 hash is stored. Bond admins provision/revoke these in /admin/tvmonitor.
CREATE TABLE IF NOT EXISTS tvmonitor_access (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id INTEGER NOT NULL,
  label TEXT NOT NULL,
  token_hash TEXT NOT NULL UNIQUE,

  created_by TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  revoked_at TIMESTAMPTZ,
  last_used_at TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_tvmonitor_access_org ON tvmonitor_access (organization_id);
CREATE INDEX IF NOT EXISTS idx_tvmonitor_access_token ON tvmonitor_access (token_hash);
