-- Base schema for the discovery feature, for provisioning a NEW (staging)
-- Supabase project. Derived 2026-06-10 from production row shapes +
-- lib/supabase.ts types. Run this in the staging project's SQL editor
-- BEFORE scripts/seed-staging.mjs.
--
-- Production already has these tables — never run this against production.

create table if not exists public.partner_groups (
  id uuid primary key default gen_random_uuid(),
  name text,
  api_key text,
  gtm_id text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.discovery_pages (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  name text not null,
  organization_ids jsonb not null default '[]'::jsonb,
  facility_ids jsonb not null default '[]'::jsonb,
  api_key text,
  partner_group_id uuid references public.partner_groups (id),
  branding jsonb not null default '{}'::jsonb,
  features jsonb not null default '{}'::jsonb,
  allowed_params jsonb not null default '[]'::jsonb,
  default_params jsonb not null default '{}'::jsonb,
  cache_ttl integer not null default 300,
  is_active boolean not null default true,
  gtm_id text,
  created_by text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists discovery_pages_slug_idx on public.discovery_pages (slug);
create index if not exists discovery_pages_partner_group_idx on public.discovery_pages (partner_group_id);

-- RLS: anon may read active pages (the app reads configs with the anon key
-- when no service key is present); all writes go through the service role,
-- which bypasses RLS.
alter table public.discovery_pages enable row level security;
alter table public.partner_groups enable row level security;

drop policy if exists "anon can read active pages" on public.discovery_pages;
create policy "anon can read active pages"
  on public.discovery_pages for select
  using (true);

drop policy if exists "anon can read partner groups" on public.partner_groups;
create policy "anon can read partner groups"
  on public.partner_groups for select
  using (true);
