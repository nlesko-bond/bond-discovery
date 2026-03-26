-- BIGINT-safe lookups and upserts (no PostgREST .or/.eq filter quirks on bigint columns)

CREATE OR REPLACE FUNCTION public.lookup_form_answer_title_statuses(
  p_form_page_id uuid,
  p_answer_title_ids bigint[]
)
RETURNS TABLE (answer_title_id bigint, status text)
LANGUAGE sql
STABLE
SECURITY INVOKER
SET search_path = public
AS $$
  SELECT f.answer_title_id, f.status::text
  FROM form_answer_title_statuses f
  WHERE f.form_page_id = p_form_page_id
    AND f.answer_title_id = ANY(p_answer_title_ids);
$$;

CREATE OR REPLACE FUNCTION public.upsert_form_answer_title_status(
  p_form_page_id uuid,
  p_answer_title_id bigint,
  p_status text
)
RETURNS void
LANGUAGE sql
SECURITY INVOKER
SET search_path = public
AS $$
  INSERT INTO form_answer_title_statuses (form_page_id, answer_title_id, status, updated_at)
  VALUES (p_form_page_id, p_answer_title_id, p_status, now())
  ON CONFLICT (form_page_id, answer_title_id)
  DO UPDATE SET
    status = EXCLUDED.status,
    updated_at = EXCLUDED.updated_at;
$$;

REVOKE ALL ON FUNCTION public.lookup_form_answer_title_statuses(uuid, bigint[]) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.upsert_form_answer_title_status(uuid, bigint, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.lookup_form_answer_title_statuses(uuid, bigint[]) TO service_role;
GRANT EXECUTE ON FUNCTION public.upsert_form_answer_title_status(uuid, bigint, text) TO service_role;
