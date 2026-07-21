-- Store the raw studio access token alongside its hash so Bond admins can
-- re-copy a builder's access link from /admin/tvmonitor at any time.
-- The table is only readable via the service role (admin-gated API); token
-- lookup during sign-in still goes through token_hash.
-- Existing grants keep token = NULL (created before this column existed) and
-- must be recreated to get a copyable link.
-- Run against the same Supabase project as other migrations.

ALTER TABLE tvmonitor_access ADD COLUMN IF NOT EXISTS token TEXT;
