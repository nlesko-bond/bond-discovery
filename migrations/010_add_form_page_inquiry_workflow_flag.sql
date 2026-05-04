ALTER TABLE form_pages
  ADD COLUMN IF NOT EXISTS enable_staff_inquiry_workflow BOOLEAN NOT NULL DEFAULT true;
