-- Reservation schedule pages (per-org staff tool, slug + branding like memberships)
-- Run against the same Supabase project as other migrations.

CREATE TABLE IF NOT EXISTS reservation_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  organization_ids INTEGER[] NOT NULL,

  branding JSONB NOT NULL DEFAULT '{
    "primaryColor": "#1A1A1A",
    "accentColor": "#C47B2B",
    "accentColorLight": "#E8A84C",
    "bgColor": "#F7F7F5",
    "fontHeading": "Bebas Neue",
    "fontBody": "Open Sans",
    "logoUrl": null,
    "heroTitle": null,
    "heroSubtitle": null
  }'::jsonb,

  page_title TEXT,
  page_subtitle TEXT,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_reservation_pages_slug ON reservation_pages (slug);
CREATE INDEX IF NOT EXISTS idx_reservation_pages_active ON reservation_pages (is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_reservation_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_reservation_pages_updated_at ON reservation_pages;
CREATE TRIGGER trigger_reservation_pages_updated_at
  BEFORE UPDATE ON reservation_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_reservation_pages_updated_at();
