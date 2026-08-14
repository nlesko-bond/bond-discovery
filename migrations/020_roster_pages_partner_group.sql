-- Roster pages inherit their Bond API key from a partner group, exactly as
-- discovery_pages do (see lib/config.ts -- `row.api_key || row.partner_group.api_key`).
--
-- Without this every roster page needed its own key pasted in, and the admin
-- list was a flat set of slugs with no way to see which customer they belonged
-- to. The partner group is the customer; a customer can have many roster pages.
--
-- Run against the same Supabase project as the other migrations.

ALTER TABLE roster_pages
  ADD COLUMN IF NOT EXISTS partner_group_id UUID NULL REFERENCES partner_groups(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_roster_pages_partner_group
  ON roster_pages (partner_group_id);

-- api_key stays nullable and now means "override the group's key for this page".
COMMENT ON COLUMN roster_pages.api_key IS
  'Per-page Bond API key override. Normally NULL — the key is inherited from partner_group_id.';
