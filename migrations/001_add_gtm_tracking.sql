-- Add GTM tracking columns to partner_groups and discovery_pages
-- Run this in Supabase SQL Editor

-- Add gtm_id to partner_groups (for partner-level default)
ALTER TABLE partner_groups 
ADD COLUMN IF NOT EXISTS gtm_id TEXT DEFAULT NULL;

-- Add gtm_id to discovery_pages (page-level override, inherits from partner if null)
ALTER TABLE discovery_pages 
ADD COLUMN IF NOT EXISTS gtm_id TEXT DEFAULT NULL;

-- Add comment for documentation
COMMENT ON COLUMN partner_groups.gtm_id IS 'Google Tag Manager container ID (e.g., GTM-XXXXXX). Applied to all pages in this partner group unless overridden.';
COMMENT ON COLUMN discovery_pages.gtm_id IS 'Google Tag Manager container ID. If null, inherits from partner_group.';
