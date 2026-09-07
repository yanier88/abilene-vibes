-- Phase 26B. Reviewed against production ymgiwjuhgvfexitynmtb catalog.
-- Job insert policy name and predicates in production are preserved.
-- No payment functions, prices, historical ownership or claims are changed.
begin;

create table public.advertiser_profiles (
  user_id uuid primary key references auth.users(id),
  app_account_token uuid not null unique default gen_random_uuid(),
  created_at timestamptz not null default now()
);
alter table public.advertiser_profiles enable row level security;
revoke all on public.advertiser_profiles from public, anon, authenticated;
grant select on public.advertiser_profiles to authenticated;
grant all on public.advertiser_profiles to service_role;
create policy advertiser_profile_self_read on public.advertiser_profiles
for select to authenticated using (user_id = (select auth.uid()));

create function public.ensure_advertiser_profile()
returns void language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Authentication required' using errcode = '42501'; end if;
  insert into public.advertiser_profiles(user_id) values (auth.uid()) on conflict (user_id) do nothing;
end;
$$;
revoke all on function public.ensure_advertiser_profile() from public, anon;
grant execute on function public.ensure_advertiser_profile() to authenticated;

-- Marker is server-owned. UUID-shaped legacy owner_user_id is NOT a claim.
create function public.advertiser_listing_identity_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if TG_OP = 'INSERT' then
    if auth.uid() is not null then
      perform public.ensure_advertiser_profile();
      new.advertiser_user_id := auth.uid();
      new.owner_user_id := auth.uid()::text;
    elsif auth.role() = 'service_role' and new.advertiser_user_id is not null then
      -- Only trusted server code may supply this marker after verifying Auth.
      -- Edge sanitizers must never copy advertiser_user_id from request payloads.
      if new.owner_user_id is distinct from new.advertiser_user_id::text then
        raise exception 'Verified ownership mismatch' using errcode = '42501';
      end if;
      insert into public.advertiser_profiles(user_id) values (new.advertiser_user_id)
      on conflict (user_id) do nothing;
    else
      new.advertiser_user_id := null;
    end if;
  else
    if new.advertiser_user_id is distinct from old.advertiser_user_id then
      raise exception 'Ownership claims are not enabled' using errcode = '42501';
    end if;
    if old.advertiser_user_id is not null and new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Authenticated ownership is immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.advertiser_listing_identity_guard() from public, anon, authenticated;

alter table public.business_submissions add column advertiser_user_id uuid references public.advertiser_profiles(user_id);
create index business_submissions_advertiser_idx on public.business_submissions(advertiser_user_id) where advertiser_user_id is not null;
create trigger advertiser_identity_guard before insert or update on public.business_submissions
for each row execute function public.advertiser_listing_identity_guard();
create policy advertiser_own_read on public.business_submissions for select to authenticated
using (advertiser_user_id = (select auth.uid()));
grant select, insert on public.business_submissions to authenticated;

alter table public.job_listings add column advertiser_user_id uuid references public.advertiser_profiles(user_id);
create index job_listings_advertiser_idx on public.job_listings(advertiser_user_id) where advertiser_user_id is not null;
create trigger advertiser_identity_guard before insert or update on public.job_listings
for each row execute function public.advertiser_listing_identity_guard();
create policy advertiser_own_read on public.job_listings for select to authenticated
using (advertiser_user_id = (select auth.uid()));
grant select, insert on public.job_listings to authenticated;

alter table public.rental_listings add column advertiser_user_id uuid references public.advertiser_profiles(user_id);
create index rental_listings_advertiser_idx on public.rental_listings(advertiser_user_id) where advertiser_user_id is not null;
create trigger advertiser_identity_guard before insert or update on public.rental_listings
for each row execute function public.advertiser_listing_identity_guard();
create policy advertiser_own_read on public.rental_listings for select to authenticated
using (advertiser_user_id = (select auth.uid()));
grant select, insert on public.rental_listings to authenticated;

-- Same public visibility/insert predicates as anon, no moderation privileges.
-- Only named policies from the audited local schema are expanded. Missing policies
-- fail the transaction instead of silently inventing production behavior.
alter policy "Allow public approved business listings" on public.business_submissions to anon, authenticated;
alter policy "Allow public approved job reads" on public.job_listings to anon, authenticated;
alter policy "Allow public pending job inserts" on public.job_listings to anon, authenticated;
alter policy "Allow public approved gallery photos" on public.gallery_submissions to anon, authenticated;
alter policy "Allow public hidden static reads" on public.hidden_static_items to anon, authenticated;
alter policy "Allow public like reads" on public.public_likes to anon, authenticated;
alter policy "Allow public likes" on public.public_likes to anon, authenticated;
alter policy "Allow public approved review reads" on public.business_reviews to anon, authenticated;
alter policy "Allow public business interaction tracking" on public.business_interactions to anon, authenticated;
alter policy "Allow public item interaction tracking" on public.public_item_interactions to anon, authenticated;
alter policy "Allow public approved local news reads" on public.local_news_items to anon, authenticated;
alter policy "Allow public active marketplace reads" on public.marketplace_listings to anon, authenticated;
grant select on public.gallery_submissions, public.hidden_static_items, public.public_likes,
 public.business_reviews, public.local_news_items, public.marketplace_listings to authenticated;
grant insert on public.gallery_submissions, public.public_likes, public.business_reviews,
 public.business_interactions, public.public_item_interactions to authenticated;

-- Only wrapper/RPC callers can use this helper. It never accepts client ownership
-- for a marked row; the old comparison remains exclusively on unclaimed rows.
create function public.advertiser_can_manage(kind text, listing uuid, legacy_owner text)
returns boolean language plpgsql stable security definer set search_path = public, pg_temp as $$
declare verified_owner uuid; old_owner text;
begin
  case kind
    when 'business' then select advertiser_user_id, owner_user_id into verified_owner, old_owner from public.business_submissions where id = listing;
    when 'job' then select advertiser_user_id, owner_user_id into verified_owner, old_owner from public.job_listings where id = listing;
    when 'rental' then select advertiser_user_id, owner_user_id into verified_owner, old_owner from public.rental_listings where id = listing;
    else return false;
  end case;
  if public.is_service_admin() then return true; end if;
  if verified_owner is not null then return coalesce(auth.uid() = verified_owner, false); end if;
  return coalesce(length(trim(legacy_owner)) > 0 and old_owner = legacy_owner, false);
end;
$$;
revoke all on function public.advertiser_can_manage(text,uuid,text) from public, anon, authenticated;

create or replace function public.owner_update_business_submission(
  p_business_id uuid,
  p_owner_id text,
  p_business_name text,
  p_contact_name text,
  p_contact_email text,
  p_phone text,
  p_address text,
  p_social text,
  p_description text,
  p_image_data text default null
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  if not public.advertiser_can_manage('business', p_business_id, p_owner_id) then return false; end if;
  update public.business_submissions
  set
    business_name = coalesce(nullif(trim(p_business_name), ''), business_name),
    contact_name = coalesce(nullif(trim(p_contact_name), ''), contact_name),
    contact_email = nullif(trim(coalesce(p_contact_email, '')), ''),
    phone = coalesce(nullif(trim(p_phone), ''), phone),
    address = nullif(trim(coalesce(p_address, '')), ''),
    social = nullif(trim(coalesce(p_social, '')), ''),
    description = nullif(trim(coalesce(p_description, '')), ''),
    image_data = coalesce(p_image_data, image_data)
  where id = p_business_id
    and (
      public.is_service_admin()
      or (
        length(trim(coalesce(p_owner_id, ''))) > 0
        and owner_user_id = p_owner_id
      )
    );

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

create or replace function public.owner_hide_business_submission(
  p_business_id uuid,
  p_owner_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  changed_count integer;
begin
  if not public.advertiser_can_manage('business', p_business_id, p_owner_id) then return false; end if;
  update public.business_submissions
  set status = 'hidden'
  where id = p_business_id
    and status <> 'hidden'
    and (
      public.is_service_admin()
      or (
        length(trim(coalesce(p_owner_id, ''))) > 0
        and owner_user_id = p_owner_id
      )
    );

  get diagnostics changed_count = row_count;
  return changed_count = 1;
end;
$$;

create or replace function public.owner_update_job_listing(
  listing_id uuid,
  owner_id text,
  new_title text,
  new_company text,
  new_category text,
  new_job_type text,
  new_pay_label text,
  new_location text,
  new_contact_person text,
  new_phone text,
  new_email text,
  new_description text,
  new_requirements text,
  new_app_method text,
  new_apply_url text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.advertiser_can_manage('job', listing_id, owner_id) then return false; end if;
  update public.job_listings
  set
    title = trim(new_title),
    company = trim(new_company),
    category = trim(new_category),
    job_type = trim(new_job_type),
    pay_label = nullif(trim(coalesce(new_pay_label, '')), ''),
    location = trim(new_location),
    contact_person = nullif(trim(coalesce(new_contact_person, '')), ''),
    phone = nullif(trim(coalesce(new_phone, '')), ''),
    email = nullif(trim(coalesce(new_email, '')), ''),
    description = trim(new_description),
    requirements = nullif(trim(coalesce(new_requirements, '')), ''),
    app_method = trim(coalesce(new_app_method, 'Phone')),
    apply_url = nullif(trim(coalesce(new_apply_url, '')), '')
  where id = listing_id
    and owner_user_id = owner_id
    and coalesce(status, 'pending') in ('pending', 'approved')
    and length(trim(new_title)) > 0
    and length(trim(new_company)) > 0
    and length(trim(new_category)) > 0
    and length(trim(new_job_type)) > 0
    and length(trim(new_location)) > 0
    and length(trim(new_description)) > 0;

  return found;
end;
$$;

create or replace function public.owner_delete_job_listing(
  listing_id uuid,
  owner_id text
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
begin
  if not public.advertiser_can_manage('job', listing_id, owner_id) then return false; end if;
  update public.job_listings
  set status = 'hidden'
  where id = listing_id
    and owner_user_id = owner_id;

  return found;
end;
$$;

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
  if not public.advertiser_can_manage('rental', listing_id, owner_id) then return false; end if;
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
  if not public.advertiser_can_manage('rental', listing_id, owner_id) then return false; end if;
  delete from public.rental_listings
  where id = listing_id
    and owner_user_id = owner_id;

  return found;
end;
$$;

-- Authenticated-only view of recoverable ownership, including pending/hidden rows.
create function public.advertiser_my_listings()
returns table(listing_type text, id uuid, title text, status text)
language sql stable security definer set search_path = public, pg_temp as $$
  select 'business'::text, id, business_name, status from public.business_submissions where advertiser_user_id = auth.uid()
  union all
  select 'job'::text, id, title, status from public.job_listings where advertiser_user_id = auth.uid()
  union all
  select 'rental'::text, id, title, status from public.rental_listings where advertiser_user_id = auth.uid();
$$;
revoke all on function public.advertiser_my_listings() from public, anon;
grant execute on function public.advertiser_my_listings() to authenticated;
commit;
