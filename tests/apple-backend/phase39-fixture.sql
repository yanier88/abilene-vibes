-- Synthetic dependencies only. Run exclusively by phase39-local.mjs after its guard.
do $$ begin
 if not exists(select 1 from pg_roles where rolname='anon') then create role anon nologin; end if;
 if not exists(select 1 from pg_roles where rolname='authenticated') then create role authenticated nologin; end if;
 if not exists(select 1 from pg_roles where rolname='service_role') then create role service_role nologin bypassrls; end if;
end; $$;
revoke create on schema public from public,anon,authenticated,service_role;
grant usage on schema public to anon,authenticated,service_role;
create table public.business_submissions(id uuid primary key,status text not null,stripe_subscription_id text,payment_status text,placement_source text);
create table public.job_listings(like public.business_submissions including all);
create table public.rental_listings(like public.business_submissions including all);
