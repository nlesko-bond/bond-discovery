-- Migration: form_pages for password-gated staff form response viewer
-- Run against Supabase project (same as other migrations)

CREATE TABLE IF NOT EXISTS form_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,

  organization_id INTEGER NOT NULL,
  default_questionnaire_id INTEGER NOT NULL,
  allowed_questionnaire_ids INTEGER[],

  branding JSONB NOT NULL DEFAULT '{
    "companyName": "Organization",
    "primaryColor": "#1E2761",
    "secondaryColor": "#6366F1",
    "accentColor": "#8B5CF6",
    "logo": null
  }'::jsonb,

  staff_password_hash TEXT,
  staff_password_updated_at TIMESTAMPTZ,

  default_range_days INTEGER NOT NULL DEFAULT 60,
  max_range_days_cap INTEGER NOT NULL DEFAULT 90,
  titles_per_page INTEGER NOT NULL DEFAULT 25,

  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_form_pages_slug ON form_pages(slug);
CREATE INDEX IF NOT EXISTS idx_form_pages_active ON form_pages(is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_form_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_form_pages_updated_at ON form_pages;
CREATE TRIGGER trigger_form_pages_updated_at
  BEFORE UPDATE ON form_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_form_pages_updated_at();
