-- Storage bucket for TV Monitor uploads (logos, ad images/videos).
-- Public read (assets render on public TV pages); writes only via signed
-- upload URLs issued by /api/tvmonitor/media (admin or studio session).
-- Run against the same Supabase project as other migrations.

INSERT INTO storage.buckets (id, name, public, file_size_limit)
VALUES ('tvmonitor-media', 'tvmonitor-media', true, 52428800) -- 50 MB
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = 52428800;
