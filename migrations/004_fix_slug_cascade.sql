-- Migration: Add ON UPDATE CASCADE to page_views and page_events foreign keys
-- This allows slug changes to cascade to analytics tables

-- Fix page_views foreign key
ALTER TABLE page_views 
DROP CONSTRAINT IF EXISTS page_views_page_slug_fkey;

ALTER TABLE page_views 
ADD CONSTRAINT page_views_page_slug_fkey 
FOREIGN KEY (page_slug) 
REFERENCES discovery_pages(slug) 
ON DELETE CASCADE 
ON UPDATE CASCADE;

-- Fix page_events foreign key  
ALTER TABLE page_events
DROP CONSTRAINT IF EXISTS page_events_page_slug_fkey;

ALTER TABLE page_events
ADD CONSTRAINT page_events_page_slug_fkey
FOREIGN KEY (page_slug)
REFERENCES discovery_pages(slug)
ON DELETE CASCADE
ON UPDATE CASCADE;
