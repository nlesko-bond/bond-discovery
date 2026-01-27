-- Migration: Add link_behavior column to discovery_pages
-- This controls how registration links open (new tab, same window, or in frame)

ALTER TABLE discovery_pages 
ADD COLUMN IF NOT EXISTS link_behavior TEXT DEFAULT 'new_tab';

-- Add comment explaining the values
COMMENT ON COLUMN discovery_pages.link_behavior IS 
'Controls how registration links open: new_tab (default), same_window (for embeds - replaces page), in_frame (for embeds - stays in iframe)';
