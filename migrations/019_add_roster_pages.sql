-- Roster pages: per-org league roster + staff check-in surface at /rosters/{slug}.
-- Modeled on reservation_pages (011). Run against the same Supabase project as
-- the other migrations.
--
-- Privacy note: this table stores no participant data. Rosters are fetched from
-- the Bond public API per request and redacted in lib/roster-privacy.ts before
-- leaving the server. What is stored here is the *policy* -- who may see which
-- fields -- plus the scope bound and branding.

CREATE TABLE IF NOT EXISTS roster_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,

  -- Publication is an affirmative act: a new page is never live on creation.
  is_active BOOLEAN NOT NULL DEFAULT false,

  organization_ids INTEGER[] NOT NULL DEFAULT '{}',

  -- Bounds which programs the page can ever reach.
  -- { "mode": "all" | "include" | "exclude", "programIds": [123, 456] }
  program_filter JSONB NOT NULL DEFAULT '{"mode": "all", "programIds": []}'::jsonb,

  -- Explicit override. When non-empty the rolling window below is ignored.
  -- [{ "programId": 123, "sessionId": 456 }]
  pinned_sessions JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Rolling window so new seasons appear without re-configuring the page.
  session_window JSONB NOT NULL DEFAULT '{"pastDays": 90, "futureDays": 180}'::jsonb,

  branding JSONB NOT NULL DEFAULT '{
    "primaryColor": "#1A1A1A",
    "accentColor": "#9A5B18",
    "accentColorLight": "#E8A84C",
    "bgColor": "#F7F7F5",
    "fontHeading": "Bebas Neue",
    "fontBody": "Open Sans",
    "logoUrl": null,
    "heroTitle": null,
    "heroSubtitle": null
  }'::jsonb,

  -- 'public' | 'password' | 'staff'
  page_access TEXT NOT NULL DEFAULT 'public',

  -- Per-field policy. Defaults are the most private setting that still renders
  -- a useful roster: jersey number and position, no names, no photo.
  -- Mirrors DEFAULT_ROSTER_FIELD_VISIBILITY in types/rosters.ts.
  field_visibility JSONB NOT NULL DEFAULT '{
    "nameMode": "numberOnly",
    "showPhoto": false,
    "showJerseyNumber": true,
    "showPosition": true,
    "showTeamRole": true,
    "staffShowContact": true,
    "staffShowBirthDate": true,
    "staffShowGender": false,
    "staffShowWaiver": true,
    "staffShowRegistration": true,
    "staffShowGuardian": true,
    "contactSource": "primary"
  }'::jsonb,

  -- Search engines are opt-in. Roster pages carry participant names once an
  -- operator raises nameMode, and de-indexing after the fact does not work.
  allow_indexing BOOLEAN NOT NULL DEFAULT false,

  -- Orgs can withhold printing entirely (LeagueApps ships the same control).
  allow_print BOOLEAN NOT NULL DEFAULT true,

  -- Youth pages get tighter defaults and consent copy in the admin UI.
  is_youth BOOLEAN NOT NULL DEFAULT false,

  viewer_password_hash TEXT NULL,
  staff_password_hash TEXT NULL,
  staff_password_updated_at TIMESTAMPTZ NULL,

  -- Optional per-page overrides; otherwise the app defaults are used.
  api_key TEXT NULL,
  bond_env TEXT NULL,

  created_by TEXT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

  CONSTRAINT roster_pages_page_access_check
    CHECK (page_access IN ('public', 'password', 'staff'))
);

CREATE INDEX IF NOT EXISTS idx_roster_pages_slug ON roster_pages (slug);
CREATE INDEX IF NOT EXISTS idx_roster_pages_active ON roster_pages (is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_roster_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_roster_pages_updated_at ON roster_pages;
CREATE TRIGGER trigger_roster_pages_updated_at
  BEFORE UPDATE ON roster_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_roster_pages_updated_at();

-- The table holds password hashes and API keys, so it is service-role only.
-- Every read goes through getSupabaseAdmin() in lib/rosters-config.ts, exactly
-- as discovery_pages does for its partner_groups join.
ALTER TABLE roster_pages ENABLE ROW LEVEL SECURITY;
