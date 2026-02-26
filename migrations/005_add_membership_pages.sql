-- Migration: Add membership_pages table for membership discovery feature
-- Run against Supabase project: mxketdjzelojxjnzsjgd

CREATE TABLE IF NOT EXISTS membership_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  -- Organization info
  organization_id INTEGER NOT NULL,
  organization_name TEXT,
  organization_slug TEXT, -- e.g. "Coppermine" for Bond registration URLs
  facility_id INTEGER,

  -- Branding (configurable per page, Coppermine theme as sensible defaults)
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

  -- Membership filtering
  membership_ids_include INTEGER[],   -- whitelist; NULL = include all
  membership_ids_exclude INTEGER[],   -- blacklist; applied after whitelist
  include_not_open_for_registration BOOLEAN NOT NULL DEFAULT false,

  -- Registration link template with placeholders
  registration_link_template TEXT NOT NULL DEFAULT 'https://bondsports.co/{orgSlug}/memberships/{membershipSlug}/{membershipId}',

  -- Category overrides (age-based or name-based custom categories)
  category_overrides JSONB,  -- array of { key, label, minAge?, maxAge?, nameContains?, badgeBg, badgeColor }

  -- Navigation and footer
  nav_links JSONB,   -- array of { label, url }
  footer_info JSONB,  -- { address, email, phone }

  -- Cache
  cache_ttl INTEGER NOT NULL DEFAULT 900,

  -- Timestamps
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Slug index for fast lookups
CREATE INDEX IF NOT EXISTS idx_membership_pages_slug ON membership_pages(slug);
CREATE INDEX IF NOT EXISTS idx_membership_pages_active ON membership_pages(is_active) WHERE is_active = true;

-- Auto-update updated_at
CREATE OR REPLACE FUNCTION update_membership_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER trigger_membership_pages_updated_at
  BEFORE UPDATE ON membership_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_membership_pages_updated_at();

-- Seed Coppermine White Marsh config
INSERT INTO membership_pages (
  slug,
  name,
  organization_id,
  organization_name,
  organization_slug,
  facility_id,
  branding,
  category_overrides,
  nav_links,
  footer_info,
  registration_link_template
) VALUES (
  'coppermine',
  'White Marsh Swim Club Memberships',
  529,
  'Coppermine',
  'Coppermine',
  665,
  '{
    "primaryColor": "#1A1A1A",
    "accentColor": "#C47B2B",
    "accentColorLight": "#E8A84C",
    "bgColor": "#F7F7F5",
    "fontHeading": "Bebas Neue",
    "fontBody": "Open Sans",
    "logoUrl": null,
    "heroTitle": "WHITE MARSH SWIM CLUB",
    "heroSubtitle": "Summer 2026 Pool Memberships — Individual, family, and senior plans for the full season."
  }'::jsonb,
  '[{"key": "senior", "label": "Senior (65+)", "minAge": 65, "nameContains": "Senior", "badgeBg": "#E8F5E9", "badgeColor": "#2E7D32"}]'::jsonb,
  '[
    {"label": "Aquatics", "url": "https://www.gocoppermine.com/coppermine/programs/aquatic/"},
    {"label": "White Marsh", "url": "https://www.gocoppermine.com/coppermine/white-marsh-swim-club/"},
    {"label": "Locations", "url": "https://www.gocoppermine.com/coppermine/locations/"}
  ]'::jsonb,
  '{
    "address": "White Marsh Swim Club · 4719 Beaconsfield Dr, Nottingham, MD 21236",
    "email": "whitemarshpool@gocoppermine.com"
  }'::jsonb,
  'https://bondsports.co/{orgSlug}/memberships/{membershipSlug}/{membershipId}'
) ON CONFLICT (slug) DO NOTHING;
