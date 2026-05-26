CREATE TABLE IF NOT EXISTS documentation_pages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title TEXT NOT NULL,
  path TEXT NOT NULL UNIQUE,
  source_html TEXT NOT NULL,
  is_active BOOLEAN NOT NULL DEFAULT true,
  created_by_email TEXT,
  updated_by_email TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE documentation_pages ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_documentation_pages_path ON documentation_pages (path);
CREATE INDEX IF NOT EXISTS idx_documentation_pages_active ON documentation_pages (is_active) WHERE is_active = true;

CREATE OR REPLACE FUNCTION update_documentation_pages_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trigger_documentation_pages_updated_at ON documentation_pages;
CREATE TRIGGER trigger_documentation_pages_updated_at
  BEFORE UPDATE ON documentation_pages
  FOR EACH ROW
  EXECUTE FUNCTION update_documentation_pages_updated_at();
