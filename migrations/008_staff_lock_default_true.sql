-- New form pages default to "use default form only" (hide staff form dropdown)

ALTER TABLE form_pages
  ALTER COLUMN staff_lock_to_default_questionnaire SET DEFAULT true;
