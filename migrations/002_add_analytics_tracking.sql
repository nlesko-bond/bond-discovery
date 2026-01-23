-- Analytics tracking tables for Bond Discovery
-- Run this in Supabase SQL Editor

-- Table to track page views
CREATE TABLE IF NOT EXISTS page_views (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_slug TEXT NOT NULL REFERENCES discovery_pages(slug) ON DELETE CASCADE,
  partner_group_id UUID REFERENCES partner_groups(id) ON DELETE SET NULL,
  
  -- Request info
  user_agent TEXT,
  referrer TEXT,
  ip_hash TEXT, -- Hashed IP for privacy
  country TEXT,
  city TEXT,
  
  -- Page context
  view_mode TEXT, -- 'programs' or 'schedule'
  schedule_view TEXT, -- 'list', 'table', 'day', 'week', 'month'
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Table to track events/interactions
CREATE TABLE IF NOT EXISTS page_events (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  page_slug TEXT NOT NULL REFERENCES discovery_pages(slug) ON DELETE CASCADE,
  partner_group_id UUID REFERENCES partner_groups(id) ON DELETE SET NULL,
  
  -- Event info
  event_type TEXT NOT NULL, -- 'click_register', 'view_mode_changed', 'share_link', 'filter_applied', etc.
  event_data JSONB DEFAULT '{}',
  
  -- Request info  
  ip_hash TEXT,
  
  -- Timestamp
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for efficient querying
CREATE INDEX IF NOT EXISTS idx_page_views_slug ON page_views(page_slug);
CREATE INDEX IF NOT EXISTS idx_page_views_partner ON page_views(partner_group_id);
CREATE INDEX IF NOT EXISTS idx_page_views_created ON page_views(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_views_slug_created ON page_views(page_slug, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_page_events_slug ON page_events(page_slug);
CREATE INDEX IF NOT EXISTS idx_page_events_type ON page_events(event_type);
CREATE INDEX IF NOT EXISTS idx_page_events_created ON page_events(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_page_events_slug_type ON page_events(page_slug, event_type);

-- Materialized view for daily stats (refresh periodically)
CREATE MATERIALIZED VIEW IF NOT EXISTS daily_page_stats AS
SELECT 
  page_slug,
  DATE(created_at) as date,
  COUNT(*) as view_count,
  COUNT(DISTINCT ip_hash) as unique_visitors
FROM page_views
GROUP BY page_slug, DATE(created_at)
ORDER BY date DESC, page_slug;

-- Create unique index on materialized view for concurrent refresh
CREATE UNIQUE INDEX IF NOT EXISTS idx_daily_page_stats_unique 
ON daily_page_stats(page_slug, date);

-- Function to refresh daily stats
CREATE OR REPLACE FUNCTION refresh_daily_stats()
RETURNS void AS $$
BEGIN
  REFRESH MATERIALIZED VIEW CONCURRENTLY daily_page_stats;
END;
$$ LANGUAGE plpgsql;

-- Comments for documentation
COMMENT ON TABLE page_views IS 'Tracks page views for Bond Discovery pages';
COMMENT ON TABLE page_events IS 'Tracks user interactions/events on Discovery pages';
COMMENT ON MATERIALIZED VIEW daily_page_stats IS 'Pre-aggregated daily stats for fast dashboard queries';
