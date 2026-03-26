-- Staff inquiry status per Bond answer title row + optional lock to default questionnaire only

ALTER TABLE form_pages
  ADD COLUMN IF NOT EXISTS staff_lock_to_default_questionnaire BOOLEAN NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS form_answer_title_statuses (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  form_page_id UUID NOT NULL REFERENCES form_pages(id) ON DELETE CASCADE,
  answer_title_id BIGINT NOT NULL,
  status TEXT NOT NULL CHECK (status IN ('pending', 'in_progress', 'resolved')),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (form_page_id, answer_title_id)
);

CREATE INDEX IF NOT EXISTS idx_fats_form_page
  ON form_answer_title_statuses(form_page_id);

CREATE INDEX IF NOT EXISTS idx_fats_answer_title
  ON form_answer_title_statuses(answer_title_id);
