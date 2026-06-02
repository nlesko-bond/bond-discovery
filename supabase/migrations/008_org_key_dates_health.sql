-- Key dates for Customer Health sync
alter table orgs add column if not exists actual_launch_date date;
alter table orgs add column if not exists onboarding_started_at timestamptz;

-- Backfill onboarding_started_at from earliest checklist activity (step completion or CSV upload).
update orgs o
set onboarding_started_at = sub.earliest
from (
  select org_id, min(activity_at) as earliest
  from (
    select org_id, completed_at as activity_at
    from step_progress
    where completed = true and completed_at is not null
    union all
    select id as org_id, spaces_uploaded_at as activity_at
    from orgs
    where spaces_uploaded_at is not null
    union all
    select id as org_id, gl_codes_uploaded_at as activity_at
    from orgs
    where gl_codes_uploaded_at is not null
  ) events
  where activity_at is not null
  group by org_id
) sub
where o.id = sub.org_id
  and o.onboarding_started_at is null;
