-- Staff (Bond internal users)
create table staff (
  id            uuid primary key default gen_random_uuid(),
  email         text unique not null,
  name          text not null,
  role          text not null check (role in ('admin', 'cs_rep')),
  notify_email  boolean default true,
  created_at    timestamptz default now()
);

-- Templates (step definitions as JSONB)
create table templates (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  steps         jsonb not null,
  is_default    boolean default false,
  created_at    timestamptz default now()
);

-- Orgs (each onboarding client)
create table orgs (
  id            uuid primary key default gen_random_uuid(),
  name          text not null,
  slug          text unique not null,
  contact_name  text,
  contact_email text,
  pin           text,
  template_id   uuid references templates(id),
  assigned_rep  uuid references staff(id),
  status        text default 'active' check (status in ('active', 'completed', 'paused', 'archived')),
  created_at    timestamptz default now(),
  completed_at  timestamptz
);

-- Step progress (one row per step per org)
create table step_progress (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references orgs(id) on delete cascade,
  step_index    int not null,
  completed     boolean default false,
  completed_at  timestamptz,
  completed_by  text,
  notes         text,
  unique(org_id, step_index)
);

-- Activity log (immutable audit trail)
create table activity_log (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references orgs(id) on delete cascade,
  action        text not null,
  step_index    int,
  actor         text,
  metadata      jsonb default '{}',
  created_at    timestamptz default now()
);

-- Messages (Phase 2, create table now)
create table messages (
  id            uuid primary key default gen_random_uuid(),
  org_id        uuid references orgs(id) on delete cascade,
  sender_type   text not null check (sender_type in ('org', 'staff')),
  sender_name   text not null,
  body          text not null,
  read_at       timestamptz,
  created_at    timestamptz default now()
);

-- Dashboard view for aggregated stats
create or replace view org_dashboard as
select
  o.id,
  o.name,
  o.slug,
  o.status,
  o.contact_email,
  o.created_at,
  o.completed_at,
  s.id as rep_id,
  s.name as rep_name,
  s.email as rep_email,
  count(sp.id) filter (where sp.completed) as steps_done,
  count(sp.id) as steps_total,
  round(
    (count(sp.id) filter (where sp.completed))::numeric /
    nullif(count(sp.id), 0) * 100
  ) as completion_pct,
  max(sp.completed_at) as last_activity
from orgs o
left join staff s on s.id = o.assigned_rep
left join step_progress sp on sp.org_id = o.id
group by o.id, s.id, s.name, s.email;

-- Enable RLS
alter table step_progress enable row level security;
alter table activity_log enable row level security;
alter table messages enable row level security;
alter table orgs enable row level security;

-- RLS: anon can read/update step_progress for their org (matched by slug in the request)
create policy "anon_read_step_progress" on step_progress for select using (true);
create policy "anon_update_step_progress" on step_progress for update using (true);
create policy "anon_read_orgs" on orgs for select using (true);
create policy "anon_insert_activity" on activity_log for insert with check (true);
create policy "anon_read_activity" on activity_log for select using (true);
create policy "anon_insert_messages" on messages for insert with check (true);
create policy "anon_read_messages" on messages for select using (true);

-- Enable realtime on step_progress
alter publication supabase_realtime add table step_progress;

-- Seed: default template
insert into templates (name, is_default, steps) values (
  'Default Onboarding',
  true,
  '[
    {"title": "Understand the Back Office", "time": "~3 min", "description": "Before diving into setup, spend a few minutes getting oriented with how Bond''s back office is organized. Understanding the main navigation will make every step below much faster.", "links": [{"label": "Back Office Overview", "url": "https://help.bondsports.co/en/collections/11612167-getting-started", "icon": "📖"}], "doneWhen": "Done when you''ve watched the overview and can find the main nav sections."},
    {"title": "Connect Your Bank Account", "time": "~5 min", "description": "This is what allows you to start collecting payments from customers. Get this done first so everything else can be tested end to end.", "links": [{"label": "Watch setup video", "url": "https://jam.dev/c/b1815fb9-2d82-46ed-b75b-8416566440ec", "icon": "🎥"}], "doneWhen": "Done when your bank account shows as connected in Settings."},
    {"title": "Set Up Roles & Permissions", "time": "~10 min", "description": "Control what each member of your staff can access and do in Bond. This step directly impacts both daily operations and account security.", "links": [{"label": "Roles & Permissions Guide", "url": "https://help.bondsports.co/en/articles/10128365-roles-permissions", "icon": "📖"}], "note": "⚠️ Important: Incorrect permissions can affect security and daily operations. Take a few extra minutes to assign roles carefully.", "checklist": ["Add all employees to the system", "Assign the correct role to each person"], "doneWhen": "Done when all staff are added and roles are assigned."},
    {"title": "Configure Your Tax Rates", "time": "~5 min", "description": "Set how taxes are applied to your products. You''ll want this in place before creating any rentals or programs.", "links": [{"label": "Open Tax Settings", "url": "https://backoffice.bondsports.co/client/settings#/organization/taxes/tax-rates", "icon": "⚙️"}], "checklist": ["Exclusive tax, added on top of product price", "Inclusive tax, built into the product price"], "doneWhen": "Done when your tax rates are saved in Settings."},
    {"title": "Set Up Accounting Codes", "time": "~5 min", "description": "Set up your accounting codes before creating any products. This keeps your reporting organized from the start and avoids having to remap codes later.", "links": [{"label": "Accounting Codes Guide", "url": "https://help.bondsports.co/en/articles/12968674-accounting-codes", "icon": "📖"}], "doneWhen": "Done when your accounting codes are created and ready to assign."},
    {"title": "Set Up Rental Products", "time": "~15 min", "description": "Create your rental products, courts, fields, ice time, cages, or any bookable space at your facility. Program products will be set up together during your initial program training call with the Bond team.", "links": [{"label": "Setting Up Rental Products", "url": "https://help.bondsports.co/en/articles/11021853-setting-up-rental-products", "icon": "📖"}, {"label": "Rental Reservations Overview", "url": "https://help.bondsports.co/en/articles/11403275-rental-reservations-overview", "icon": "📖"}], "doneWhen": "Done when your rental products are created and visible in the back office."},
    {"title": "Set Up Programs (Registrations)", "time": "~10 min", "description": "Use programs for classes, leagues, camps, clinics, and training sessions — anything that requires participant registration rather than a simple rental booking.", "links": [{"label": "Programs Getting Started Guide", "url": "https://help.bondsports.co/en/articles/11060636-getting-started", "icon": "📖"}], "note": "📅 Note: Your Bond onboarding specialist will walk through program setup in detail on your training call. This step is here to help you get familiar beforehand.", "doneWhen": "Done when you''ve reviewed the guide and are ready for your training call."},
    {"title": "Set Up Forms & Waivers", "time": "~5 min", "description": "Collect important participant information, waivers, and custom questionnaires — attached directly to your products and programs.", "links": [{"label": "Forms & Waivers Guide", "url": "https://help.bondsports.co/en/articles/13066858-managing-forms-questionnaires-in-the-bond-back-office", "icon": "📖"}], "doneWhen": "Done when at least one form or waiver is created and linked to a product."},
    {"title": "Enable Conversion Tracking", "time": "~5 min", "description": "Connect Bond to tools like Google Analytics (GA4) to track how customers are finding and completing registrations on your site. This is an advanced step — come back to it once your core setup is complete.", "links": [{"label": "Conversion Analytics Guide", "url": "https://help.bondsports.co/en/collections/12615606-conversion-analytics", "icon": "📖"}], "optional": true, "doneWhen": "Done when your GA4 or tracking pixel is connected and firing."}
  ]'::jsonb
);
