-- Retain a small legacy Supabase upload cap; new images and videos use Cloudinary.
UPDATE storage.buckets
SET file_size_limit = 5242880
WHERE id = 'tvmonitor-media';
