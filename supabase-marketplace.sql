-- Abilene Vibes Marketplace schema, RLS, and owner/admin RPCs.
-- Marketplace is a free community module: no Stripe, plans, checkout, or paid promotion.
-- Safe to run more than once in Supabase SQL editor.

grant usage on schema public to anon, authenticated;

create table if not exists public.marketplace_listings (
  id uuid primary key default gen_random_uuid(),
  created_at timestamptz not null default now(),
  expires_at timestamptz,
  sold_at timestamptz,
  deleted_at timestamptz,
  title text not null,
  price text not null,
  category text not null,
  location text not null,
  contact text not null,
  description text not null,
  image_data text,
  status text not null default 'active',
  owner_user_id text not null,
  moderation_status text not null default 'pending',
  moderation_reason text,
  moderation_score numeric,
  moderation_flags jsonb not null default '{}'::jsonb,
  moderation_input_types jsonb,
  moderation_model text,
  moderated_at timestamptz,
  reviewed_by_admin boolean not null default false,
  reviewed_at timestamptz,
  reviewed_by text
);

alter table public.marketplace_listings
add column if not exists expires_at timestamptz;

alter table public.marketplace_listings
add column if not exists sold_at timestamptz;

alter table public.marketplace_listings
add column if not exists deleted_at timestamptz;

alter table public.marketplace_listings
add column if not exists image_data text;

alter table public.marketplace_listings
add column if not exists owner_user_id text not null default 'legacy-owner';

alter table public.marketplace_listings
add column if not exists status text not null default 'active';

alter table public.marketplace_listings
add column if not exists moderation_status text not null default 'pending';

alter table public.marketplace_listings
alter column moderation_status set default 'pending';

alter table public.marketplace_listings
add column if not exists moderation_reason text;

alter table public.marketplace_listings
add column if not exists moderation_score numeric;

alter table public.marketplace_listings
add column if not exists moderation_flags jsonb not null default '{}'::jsonb;

alter table public.marketplace_listings
add column if not exists moderation_input_types jsonb;

alter table public.marketplace_listings
add column if not exists moderation_model text;

alter table public.marketplace_listings
add column if not exists moderated_at timestamptz;

alter table public.marketplace_listings
add column if not exists reviewed_by_admin boolean not null default false;

alter table public.marketplace_listings
add column if not exists reviewed_at timestamptz;

alter table public.marketplace_listings
add column if not exists reviewed_by text;

alter table public.marketplace_listings
drop constraint if exists marketplace_listings_status_check;

alter table public.marketplace_listings
add constraint marketplace_listings_status_check
check (status in ('active', 'sold', 'expired', 'hidden', 'deleted'));

alter table public.marketplace_listings
drop constraint if exists marketplace_listings_moderation_status_check;

alter table public.marketplace_listings
add constraint marketplace_listings_moderation_status_check
check (moderation_status in ('pending', 'approved', 'needs_review', 'rejected'));

update public.marketplace_listings
set moderation_status = 'approved'
where moderation_status is null;

create index if not exists marketplace_listings_status_created_idx
on public.marketplace_listings (status, created_at desc);

create index if not exists marketplace_listings_owner_idx
on public.marketplace_listings (owner_user_id);

create index if not exists marketplace_listings_moderation_status_created_idx
on public.marketplace_listings (moderation_status, created_at desc);

create index if not exists marketplace_listings_public_idx
on public.marketplace_listings (status, moderation_status, created_at desc);

create table if not exists public.admin_users (
  email text primary key,
  created_at timestamptz not null default now()
);

alter table public.admin_users enable row level security;

insert into public.admin_users (email)
values ('cabrerahernandezyanier@gmail.com')
on conflict (email) do nothing;

create or replace function public.is_marketplace_admin()
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

alter table public.marketplace_listings enable row level security;

revoke select on public.marketplace_listings from anon;
revoke update, delete on public.marketplace_listings from anon;
grant insert on public.marketplace_listings to anon;
grant select, insert, update, delete on public.marketplace_listings to authenticated;
grant select, insert, update, delete on public.marketplace_listings to service_role;

drop policy if exists "Allow public active marketplace reads" on public.marketplace_listings;
create policy "Allow public active marketplace reads"
on public.marketplace_listings
for select
to anon
using (
  status = 'active'
  and moderation_status = 'approved'
  and deleted_at is null
  and (expires_at is null or expires_at > now())
);

drop policy if exists "Allow public marketplace submissions" on public.marketplace_listings;
drop policy if exists "Allow public marketplace listing posts" on public.marketplace_listings;
create policy "Allow public marketplace submissions"
on public.marketplace_listings
for insert
to anon, authenticated
with check (
  status = 'active'
  and moderation_status = 'pending'
  and length(trim(title)) > 0
  and length(trim(price)) > 0
  and length(trim(category)) > 0
  and length(trim(location)) > 0
  and length(trim(contact)) > 0
  and length(trim(description)) > 0
  and length(trim(owner_user_id)) > 0
  and (expires_at is null or expires_at > now())
);

drop policy if exists "Allow authenticated marketplace moderation" on public.marketplace_listings;
drop policy if exists "Allow authenticated marketplace management" on public.marketplace_listings;
drop policy if exists "Allow public owner marketplace updates" on public.marketplace_listings;
create policy "Allow authenticated marketplace moderation"
on public.marketplace_listings
for all
to authenticated
using (public.is_marketplace_admin())
with check (public.is_marketplace_admin());

drop function if exists public.expire_marketplace_listings();

create or replace function public.expire_marketplace_listings()
returns integer
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  update public.marketplace_listings
  set status = 'expired'
  where status = 'active'
    and expires_at is not null
    and expires_at <= now();

  get diagnostics changed_count = row_count;
  return changed_count;
end;
$$;

grant execute on function public.expire_marketplace_listings() to anon, authenticated, service_role;

drop function if exists public.list_marketplace_listings(text);

create or replace function public.list_marketplace_listings(owner_id text default '')
returns table (
  id uuid,
  created_at timestamptz,
  expires_at timestamptz,
  sold_at timestamptz,
  deleted_at timestamptz,
  title text,
  price text,
  category text,
  location text,
  contact text,
  description text,
  image_data text,
  status text,
  moderation_status text,
  owner_user_id text
)
language sql
security definer
set search_path = public
as $$
  select
    ml.id,
    ml.created_at,
    ml.expires_at,
    ml.sold_at,
    ml.deleted_at,
    ml.title,
    ml.price,
    ml.category,
    ml.location,
    ml.contact,
    ml.description,
    ml.image_data,
    ml.status,
    ml.moderation_status,
    ml.owner_user_id
  from public.marketplace_listings ml
  where ml.status = 'active'
    and ml.moderation_status = 'approved'
    and ml.deleted_at is null
    and (ml.expires_at is null or ml.expires_at > now())
  order by ml.created_at desc;
$$;

grant execute on function public.list_marketplace_listings(text) to anon, authenticated, service_role;

drop function if exists public.count_owner_marketplace_listings_today(text);
drop function if exists public.count_owner_marketplace_listings_between(text, timestamptz, timestamptz);

create or replace function public.count_owner_marketplace_listings_between(
  owner_id text,
  starts_at timestamptz,
  ends_at timestamptz
)
returns integer
language sql
security definer
set search_path = public
as $$
  select count(*)::integer
  from public.marketplace_listings ml
  where ml.owner_user_id = owner_id
    and length(trim(coalesce(owner_id, ''))) > 0
    and ml.created_at >= starts_at
    and ml.created_at < ends_at;
$$;

grant execute on function public.count_owner_marketplace_listings_between(text, timestamptz, timestamptz) to anon, authenticated, service_role;

drop function if exists public.owner_set_marketplace_listing_status(uuid, text, text);

create or replace function public.owner_set_marketplace_listing_status(
  listing_id uuid,
  owner_id text,
  new_status text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  if new_status not in ('active', 'sold', 'hidden', 'deleted') then
    return false;
  end if;

  update public.marketplace_listings
  set
    status = new_status,
    sold_at = case
      when new_status = 'sold' then coalesce(sold_at, now())
      when new_status = 'active' then null
      else sold_at
    end,
    deleted_at = case
      when new_status = 'deleted' then coalesce(deleted_at, now())
      else deleted_at
    end
  where id = listing_id
    and owner_user_id = owner_id
    and status <> 'deleted';

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

grant execute on function public.owner_set_marketplace_listing_status(uuid, text, text) to anon, authenticated, service_role;

drop function if exists public.owner_update_marketplace_listing(uuid, text, text, text, text, text, text, text, text);

create or replace function public.owner_update_marketplace_listing(
  listing_id uuid,
  owner_id text,
  new_title text,
  new_price text,
  new_category text,
  new_location text,
  new_contact text,
  new_description text,
  new_image_data text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  update public.marketplace_listings
  set
    title = trim(new_title),
    price = trim(new_price),
    category = trim(new_category),
    location = trim(new_location),
    contact = trim(new_contact),
    description = trim(new_description),
    image_data = coalesce(new_image_data, '')
  where id = listing_id
    and owner_user_id = owner_id
    and status <> 'deleted'
    and length(trim(new_title)) > 0
    and length(trim(new_price)) > 0
    and length(trim(new_category)) > 0
    and length(trim(new_location)) > 0
    and length(trim(new_contact)) > 0
    and length(trim(new_description)) > 0;

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

grant execute on function public.owner_update_marketplace_listing(uuid, text, text, text, text, text, text, text, text) to anon, authenticated, service_role;

drop function if exists public.admin_delete_marketplace_listing(uuid);

create or replace function public.admin_delete_marketplace_listing(listing_id uuid)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  if not public.is_marketplace_admin() then
    return false;
  end if;

  update public.marketplace_listings
  set status = 'deleted',
      deleted_at = coalesce(deleted_at, now())
  where id = listing_id;

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

grant execute on function public.admin_delete_marketplace_listing(uuid) to authenticated, service_role;
grant execute on function public.is_marketplace_admin() to authenticated;

drop policy if exists "Allow public likes" on public.public_likes;
create policy "Allow public likes"
on public.public_likes
for insert
to anon
with check (
  item_type in ('business', 'photo', 'marketplace')
  and length(item_key) > 0
  and length(visitor_key) > 0
);
