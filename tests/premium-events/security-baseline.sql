do $$ begin if not exists(select 1 from pg_roles where rolname='anon') then create role anon;create role authenticated;create role service_role;end if;end $$;
create schema auth;
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
create function auth.role() returns text language sql stable as $$ select nullif(current_setting('request.jwt.claim.role',true),'') $$;
grant usage on schema auth to anon,authenticated,service_role;
create function public.is_service_admin() returns boolean language sql stable as $$ select coalesce(current_setting('request.jwt.claim.admin',true),'')='true' $$;
create table business_submissions(id uuid primary key, advertiser_user_id uuid, owner_user_id text, business_name text, status text, plan text, stripe_subscription_id text, payment_status text, placement_source text, placement_expires_at timestamptz);
create table job_listings(like business_submissions including all);
create table rental_listings(like business_submissions including all);
create table event_submissions(id uuid primary key default gen_random_uuid(),created_at timestamptz default now(),title text not null,place text not null,event_date date not null,event_time text not null,event_type text not null,description text,map_url text,website_url text,ticket_url text,end_date date,end_time text,image_url text,image_data text,status text not null default 'approved');
alter table event_submissions enable row level security;
grant select,truncate,references,trigger,maintain on event_submissions to anon;
grant truncate,references,trigger,maintain on event_submissions to service_role;
grant select,insert,update,delete,truncate,references,trigger,maintain on event_submissions to authenticated;
create policy "Allow public approved event reads" on event_submissions for select to anon,authenticated using(status='approved');
create policy "Allow authenticated event management" on event_submissions for all to authenticated using(public.is_service_admin()) with check(public.is_service_admin());
create table listing_promotion_entitlements(id uuid primary key default gen_random_uuid(),listing_type text,listing_id uuid,provider text,provider_reference text,plan text,status text,valid_from timestamptz,valid_until timestamptz,environment text);
create table apple_subscription_assignments(subscription_id uuid,environment text,closed_at timestamptz);

create table auth.users(id uuid primary key);
create table public.local_test_admins(user_id uuid primary key references auth.users(id));
revoke all on public.local_test_admins from public,anon,authenticated,service_role;
create or replace function public.is_service_admin() returns boolean language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$ select exists(select 1 from public.local_test_admins where user_id=auth.uid()) $$;
create function public.is_business_admin() returns boolean language sql stable as $$ select public.is_service_admin() $$;
alter table business_submissions add column content_rights_confirmed boolean;
alter table business_submissions enable row level security;
grant select,insert,truncate,references,trigger,maintain on business_submissions to anon;
grant all on business_submissions to authenticated,service_role;
create policy "Admin manage business submissions" on public.business_submissions for ALL to authenticated using (is_business_admin()) with check (is_business_admin());
create policy "Allow authenticated business moderation" on public.business_submissions for ALL to authenticated using (is_service_admin()) with check (is_service_admin());
create policy "Allow public approved business listings" on public.business_submissions for SELECT to anon,authenticated using ((status = 'approved'::text));
create policy "Allow public business submissions" on public.business_submissions for INSERT to public with check (((content_rights_confirmed = true) AND (status = 'pending'::text) AND (payment_status = ANY (ARRAY['not_required'::text, 'pending'::text])) AND (plan = ANY (ARRAY['Free'::text, 'Featured'::text, 'Premium'::text])) AND (placement_source = 'paid'::text)));
create policy "advertiser_own_read" on public.business_submissions for SELECT to authenticated using ((advertiser_user_id = ( SELECT auth.uid() AS uid)));
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

alter table public.business_submissions add foreign key(advertiser_user_id) references public.advertiser_profiles(user_id);
create trigger advertiser_identity_guard before insert or update on public.business_submissions for each row execute function public.advertiser_listing_identity_guard();
