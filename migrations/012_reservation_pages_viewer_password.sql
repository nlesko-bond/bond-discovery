-- Optional password gate for public /reservations/[slug] pages.
ALTER TABLE reservation_pages
ADD COLUMN IF NOT EXISTS viewer_password_hash TEXT NULL;
