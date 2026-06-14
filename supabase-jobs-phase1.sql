-- ============================================================
-- Abilene Vibes — Jobs & Hiring Phase 1
-- Run this in Supabase SQL Editor (Dashboard → SQL Editor)
-- ============================================================

create table if not exists public.job_listings (
  id            uuid        primary key default gen_random_uuid(),
  created_at    timestamptz not null    default now(),
  title         text        not null,
  company       text        not null,
  category      text        not null    default 'Other',
  job_type      text        not null    default 'Full Time',
  pay_label     text,
  location      text        not null    default 'Abilene, TX',
  phone         text,
  email         text,
  description   text,
  requirements  text,
  app_method    text        not null    default 'Phone',
  duration      text        not null    default '30 Days',
  plan          text        not null    default 'free',
  status        text        not null    default 'approved',
  image_data    text,
  logo_data     text,
  expires_at    timestamptz
);

-- Enable row-level security
alter table public.job_listings enable row level security;

-- Grants
grant usage  on schema public            to anon, authenticated;
grant select on public.job_listings      to anon;
grant insert on public.job_listings      to anon;
grant select, insert, update, delete
              on public.job_listings      to authenticated;
grant select, insert, update, delete
              on public.job_listings      to service_role;

-- ── Policies ────────────────────────────────────────────────

-- Anyone can read approved, non-expired free and featured listings
drop policy if exists "Allow public approved job reads" on public.job_listings;
create policy "Allow public approved job reads"
on public.job_listings
for select
to anon
using (
  status = 'approved'
  and plan IN ('free', 'featured')
  and (expires_at is null or expires_at > now())
);

-- Anyone can insert a free or featured listing (goes live immediately)
drop policy if exists "Allow public free job inserts" on public.job_listings;
create policy "Allow public free job inserts"
on public.job_listings
for insert
to anon
with check (
  plan   IN ('free', 'featured')
  and status = 'approved'
  and length(title)   > 0
  and length(company) > 0
);

-- Admins (authenticated) can do everything
drop policy if exists "Allow authenticated job management" on public.job_listings;
create policy "Allow authenticated job management"
on public.job_listings
for all
to authenticated
using (true)
with check (true);
