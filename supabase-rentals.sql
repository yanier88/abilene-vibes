-- ============================================================
-- Abilene Vibes - Rent & Housing owner controls
-- Run manually in Supabase SQL Editor.
-- This script does NOT create a global authenticated admin policy.
-- ============================================================

-- 1. Add owner column if missing.
alter table public.rental_listings
add column if not exists owner_user_id text;

alter table public.rental_listings
add column if not exists contact_person text;

-- 1b. Add payment columns if missing.
alter table public.rental_listings
add column if not exists requested_plan text;

alter table public.rental_listings
add column if not exists payment_status text not null default 'not_required';

alter table public.rental_listings
add column if not exists stripe_session_id text;

alter table public.rental_listings
add column if not exists stripe_subscription_id text;

alter table public.rental_listings
add column if not exists stripe_payment_intent_id text;

alter table public.rental_listings
add column if not exists stripe_customer_id text;

alter table public.rental_listings
add column if not exists paid_at timestamptz;

-- 1c. Add payment lookup indexes if missing.
create index if not exists idx_rental_listings_requested_plan
on public.rental_listings (requested_plan);

create index if not exists idx_rental_listings_payment_status
on public.rental_listings (payment_status);

create index if not exists idx_rental_listings_stripe_session_id
on public.rental_listings (stripe_session_id)
where stripe_session_id is not null;

create index if not exists idx_rental_listings_stripe_subscription_id
on public.rental_listings (stripe_subscription_id)
where stripe_subscription_id is not null;

create index if not exists idx_rental_listings_stripe_payment_intent_id
on public.rental_listings (stripe_payment_intent_id)
where stripe_payment_intent_id is not null;

create index if not exists idx_rental_listings_stripe_customer_id
on public.rental_listings (stripe_customer_id)
where stripe_customer_id is not null;

-- 2. Enable RLS.
alter table public.rental_listings enable row level security;

-- 3. Remove unsafe/global policies.
drop policy if exists "Admin manage rentals" on public.rental_listings;
drop policy if exists "Public read rentals" on public.rental_listings;
drop policy if exists "Public insert rentals" on public.rental_listings;

-- 3b. Real admin allowlist for authenticated Admin Panel sessions.
-- Add more admin emails here if needed.
create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

insert into public.admin_users (email)
values ('cabrerahernandezyanier@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_rentals_admin()
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

-- 4. Public read: approved and non-expired listings only.
create policy "Public read rentals"
on public.rental_listings
for select
to anon, authenticated
using (
  status = 'approved'
  and (expires_at is null or expires_at > now())
);

-- 5. Public insert: users can create rentals for admin review only.
create policy "Public insert rentals"
on public.rental_listings
for insert
to anon, authenticated
with check (
  plan = 'free'
  and status = 'pending'
  and payment_status = 'not_required'
  and requested_plan = 'free'
  and stripe_session_id is null
  and stripe_subscription_id is null
  and stripe_payment_intent_id is null
  and stripe_customer_id is null
  and paid_at is null
  and length(title) > 0
  and length(address) > 0
  and owner_user_id is not null
  and length(owner_user_id) > 0
);

-- 6. Do not allow direct table update/delete for normal users.
revoke update, delete on public.rental_listings from anon;
revoke update, delete on public.rental_listings from authenticated;

-- 7. Keep basic table access needed by the app.
grant usage on schema public to anon, authenticated;
grant select, insert on public.rental_listings to anon, authenticated;

-- 8. Owner-only update through RPC.
drop function if exists public.owner_update_rental_listing(
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
  date,
  date,
  text,
  text,
  boolean,
  text,
  text
);

create or replace function public.owner_update_rental_listing(
  listing_id uuid,
  owner_id text,
  new_title text,
  new_property_type text,
  new_address text,
  new_description text,
  new_phone text,
  new_email text,
  new_external_url text,
  new_price text,
  new_deposit text,
  new_price_per_night text,
  new_price_per_week text,
  new_available_from date,
  new_available_to date,
  new_max_guests text,
  new_house_rules text,
  new_pets_allowed boolean,
  new_bedrooms text,
  new_bathrooms text,
  new_contact_person text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.rental_listings
  set
    title = new_title,
    property_type = new_property_type,
    contact_person = coalesce(new_contact_person, contact_person),
    address = new_address,
    description = new_description,
    phone = new_phone,
    email = new_email,
    external_url = new_external_url,
    price = new_price,
    deposit = new_deposit,
    price_per_night = new_price_per_night,
    price_per_week = new_price_per_week,
    available_from = new_available_from,
    available_to = new_available_to,
    max_guests = new_max_guests,
    house_rules = new_house_rules,
    pets_allowed = coalesce(new_pets_allowed, false),
    bedrooms = new_bedrooms,
    bathrooms = new_bathrooms
  where id = listing_id
    and owner_user_id = owner_id;

  return found;
end;
$$;

-- 9. Owner-only delete through RPC.
create or replace function public.owner_delete_rental_listing(
  listing_id uuid,
  owner_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  delete from public.rental_listings
  where id = listing_id
    and owner_user_id = owner_id;

  return found;
end;
$$;

-- 10. Allow app users to call only these owner-checked functions.
grant execute on function public.owner_update_rental_listing to anon, authenticated;
grant execute on function public.owner_delete_rental_listing to anon, authenticated;

-- 11. Admin read through RPC. This is not a global authenticated table policy:
-- it requires a real Supabase Auth session whose email is in public.admin_users.
drop function if exists public.admin_list_rental_listings();

create or replace function public.admin_list_rental_listings()
returns table (
  id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  title text,
  property_type text,
  price text,
  deposit text,
  price_per_night text,
  price_per_week text,
  available_from date,
  available_to date,
  max_guests text,
  house_rules text,
  pets_allowed boolean,
  address text,
  contact_person text,
  bedrooms text,
  bathrooms text,
  description text,
  phone text,
  email text,
  external_url text,
  duration text,
  plan text,
  status text,
  payment_status text,
  stripe_session_id text,
  stripe_subscription_id text,
  paid_at timestamptz,
  requested_plan text,
  image_data text[]
)
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_rentals_admin() then
    raise exception 'Not authorized';
  end if;

  return query
  select
    rl.id,
    rl.created_at,
    rl.expires_at,
    rl.title,
    rl.property_type,
    rl.price,
    rl.deposit,
    rl.price_per_night,
    rl.price_per_week,
    rl.available_from,
    rl.available_to,
    rl.max_guests,
    rl.house_rules,
    rl.pets_allowed,
    rl.address,
    rl.contact_person,
    rl.bedrooms,
    rl.bathrooms,
    rl.description,
    rl.phone,
    rl.email,
    rl.external_url,
    rl.duration,
    rl.plan,
    rl.status,
    rl.payment_status,
    rl.stripe_session_id,
    rl.stripe_subscription_id,
    rl.paid_at,
    rl.requested_plan,
    rl.image_data
  from public.rental_listings rl
  where coalesce(rl.status, 'approved') in ('pending', 'approved', 'hidden', 'rejected')
  order by rl.created_at desc;
end;
$$;

-- 12. Admin update through RPC. This is not a global authenticated table policy:
-- it requires a real Supabase Auth session whose email is in public.admin_users.
drop function if exists public.admin_update_rental_listing(
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
  boolean,
  text[],
  text,
  text,
  text,
  text,
  date,
  date,
  text,
  text,
  text,
  text
);

create or replace function public.admin_update_rental_listing(
  listing_id uuid,
  new_title text,
  new_property_type text,
  new_address text,
  new_description text,
  new_phone text,
  new_email text,
  new_external_url text,
  new_duration text,
  new_plan text,
  new_status text,
  new_pets_allowed boolean,
  new_image_data text[],
  new_price text,
  new_deposit text,
  new_price_per_night text,
  new_price_per_week text,
  new_available_from date,
  new_available_to date,
  new_max_guests text,
  new_house_rules text,
  new_bedrooms text,
  new_bathrooms text,
  new_contact_person text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_rentals_admin() then
    raise exception 'Not authorized';
  end if;

  update public.rental_listings
  set
    title = new_title,
    property_type = new_property_type,
    contact_person = coalesce(new_contact_person, contact_person),
    address = new_address,
    description = new_description,
    phone = new_phone,
    email = new_email,
    external_url = new_external_url,
    duration = new_duration,
    plan = new_plan,
    status = new_status,
    pets_allowed = coalesce(new_pets_allowed, false),
    image_data = coalesce(new_image_data, array[]::text[]),
    price = new_price,
    deposit = new_deposit,
    price_per_night = new_price_per_night,
    price_per_week = new_price_per_week,
    available_from = new_available_from,
    available_to = new_available_to,
    max_guests = new_max_guests,
    house_rules = new_house_rules,
    bedrooms = new_bedrooms,
    bathrooms = new_bathrooms
  where id = listing_id;

  return found;
end;
$$;

-- 12b. Admin-safe payment/plan update for Rentals Stripe controls.
create or replace function public.admin_set_rental_payment_plan(
  listing_id uuid,
  new_plan text,
  new_status text,
  new_payment_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_rentals_admin() then
    raise exception 'Not authorized';
  end if;

  if new_plan not in ('free', 'featured', 'premium') then
    raise exception 'Invalid rental plan';
  end if;

  if new_status not in ('pending', 'approved', 'hidden', 'rejected') then
    raise exception 'Invalid rental status';
  end if;

  if new_payment_status not in ('not_required', 'pending', 'checkout_started', 'paid', 'failed', 'expired', 'canceled') then
    raise exception 'Invalid rental payment status';
  end if;

  update public.rental_listings
  set
    plan = new_plan,
    status = new_status,
    payment_status = new_payment_status
  where id = listing_id;

  return found;
end;
$$;

-- 13. Admin delete through RPC, including legacy rentals without owner_user_id.
create or replace function public.admin_delete_rental_listing(
  listing_id uuid
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.is_rentals_admin() then
    raise exception 'Not authorized';
  end if;

  delete from public.rental_listings
  where id = listing_id;

  return found;
end;
$$;

grant execute on function public.is_rentals_admin to authenticated;
revoke execute on function public.admin_list_rental_listings from public;
revoke execute on function public.admin_list_rental_listings from anon;
grant execute on function public.admin_list_rental_listings to authenticated;
grant execute on function public.admin_update_rental_listing to authenticated;
revoke execute on function public.admin_set_rental_payment_plan from public;
revoke execute on function public.admin_set_rental_payment_plan from anon;
grant execute on function public.admin_set_rental_payment_plan to authenticated;
grant execute on function public.admin_delete_rental_listing to authenticated;
