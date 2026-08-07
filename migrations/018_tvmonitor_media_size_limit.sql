-- Tighten TV monitor media bucket upload cap to match app limits (15 MB videos).
-- Images are preferred via Cloudinary going forward; videos remain on Supabase.
UPDATE storage.buckets
SET file_size_limit = 15728640
WHERE id = 'tvmonitor-media';
