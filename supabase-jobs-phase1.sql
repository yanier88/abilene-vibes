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
  contact_person text,
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

alter table public.job_listings
add column if not exists contact_person text;

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

-- Anyone can read approved, non-expired free, featured, and premium listings
drop policy if exists "Allow public approved job reads" on public.job_listings;
create policy "Allow public approved job reads"
on public.job_listings
for select
to anon
using (
  status = 'approved'
  and plan IN ('free', 'featured', 'premium')
  and (expires_at is null or expires_at > now())
);

-- Anyone can insert a free, featured, or premium listing (goes live immediately)
drop policy if exists "Allow public free job inserts" on public.job_listings;
create policy "Allow public free job inserts"
on public.job_listings
for insert
to anon
with check (
  plan   IN ('free', 'featured', 'premium')
  and status = 'approved'
  and length(title)   > 0
  and length(company) > 0
);

-- ============================================================
-- Final Service state: Jobs are reviewed by Admin, and admin
-- access is restricted to the allowlisted emails in admin_users.
-- Safe to run more than once.
-- ============================================================

alter table public.job_listings
add column if not exists payment_status text not null default 'not_required';

alter table public.job_listings
add column if not exists stripe_session_id text;

alter table public.job_listings
add column if not exists stripe_subscription_id text;

alter table public.job_listings
add column if not exists stripe_payment_intent_id text;

alter table public.job_listings
add column if not exists stripe_customer_id text;

alter table public.job_listings
add column if not exists paid_at timestamptz;

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

insert into public.admin_users (email)
values ('cabrerahernandezyanier@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_jobs_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1
    from public.admin_users
    where lower(email) = lower(coalesce(auth.jwt() ->> 'email', ''))
  );
$$;

drop policy if exists "Allow public free job inserts" on public.job_listings;
create policy "Allow public free job inserts"
on public.job_listings
for insert
to anon
with check (
  plan = 'free'
  and status = 'pending'
  and payment_status = 'not_required'
  and length(title) > 0
  and length(company) > 0
);

drop policy if exists "Allow authenticated job management" on public.job_listings;
create policy "Allow authenticated job management"
on public.job_listings
for all
to authenticated
using (public.is_jobs_admin())
with check (public.is_jobs_admin());

drop function if exists public.admin_list_job_listings();

create or replace function public.admin_list_job_listings()
returns setof public.job_listings
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_jobs_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select *
  from public.job_listings
  where coalesce(status, 'pending') in ('pending', 'approved', 'hidden', 'rejected')
  order by created_at desc;
end;
$$;

drop function if exists public.admin_update_job_listing(
  uuid,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  text,
  timestamptz
);

create or replace function public.admin_update_job_listing(
  listing_id uuid,
  new_title text,
  new_company text,
  new_category text,
  new_job_type text,
  new_pay_label text,
  new_location text,
  new_phone text,
  new_email text,
  new_description text,
  new_requirements text,
  new_app_method text,
  new_apply_url text,
  new_duration text,
  new_plan text,
  new_status text,
  new_image_data text,
  new_logo_data text,
  new_expires_at timestamptz
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_jobs_admin() then
    raise exception 'Not authorized';
  end if;

  update public.job_listings
  set
    title = new_title,
    company = new_company,
    category = new_category,
    job_type = new_job_type,
    pay_label = new_pay_label,
    location = new_location,
    phone = new_phone,
    email = new_email,
    description = new_description,
    requirements = new_requirements,
    app_method = new_app_method,
    apply_url = new_apply_url,
    duration = new_duration,
    plan = new_plan,
    status = new_status,
    image_data = new_image_data,
    logo_data = new_logo_data,
    expires_at = new_expires_at
  where id = listing_id;

  return found;
end;
$$;

drop function if exists public.admin_set_job_payment_plan(uuid, text, text, text, timestamptz);

create or replace function public.admin_set_job_payment_plan(
  listing_id uuid,
  new_plan text,
  new_status text,
  new_payment_status text,
  new_expires_at timestamptz default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_jobs_admin() then
    raise exception 'Not authorized';
  end if;

  if new_plan not in ('free', 'featured', 'premium') then
    raise exception 'Invalid job plan';
  end if;

  if new_status not in ('pending', 'approved', 'hidden', 'rejected') then
    raise exception 'Invalid job status';
  end if;

  if new_payment_status not in ('not_required', 'pending', 'checkout_started', 'paid', 'failed', 'expired', 'canceled') then
    raise exception 'Invalid job payment status';
  end if;

  update public.job_listings
  set
    plan = new_plan,
    status = new_status,
    payment_status = new_payment_status,
    expires_at = new_expires_at
  where id = listing_id;

  return found;
end;
$$;

drop function if exists public.admin_delete_job_listing(uuid);

create or replace function public.admin_delete_job_listing(listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_jobs_admin() then
    raise exception 'Not authorized';
  end if;

  delete from public.job_listings
  where id = listing_id;

  return found;
end;
$$;

grant execute on function public.is_jobs_admin() to authenticated;
revoke execute on function public.admin_list_job_listings() from public;
revoke execute on function public.admin_list_job_listings() from anon;
grant execute on function public.admin_list_job_listings() to authenticated;
grant execute on function public.admin_update_job_listing(uuid,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,text,timestamptz) to authenticated;
grant execute on function public.admin_set_job_payment_plan(uuid,text,text,text,timestamptz) to authenticated;
grant execute on function public.admin_delete_job_listing(uuid) to authenticated;
