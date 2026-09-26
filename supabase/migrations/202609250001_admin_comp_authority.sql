begin;
-- No legacy backfill: labels cannot establish provenance.
create table public.admin_comp_authority (
 id uuid primary key, business_id uuid not null references public.business_submissions(id),
 source text not null default 'admin_comp' check(source='admin_comp'),
 plan text not null check(plan in ('featured','premium')),
 status text not null check(status in ('active','revoked')),
 starts_at timestamptz not null, expires_at timestamptz not null,
 granted_by uuid not null references auth.users(id), granted_at timestamptz not null,
 duration_days integer not null check(duration_days between 1 and 365),
 revoked_at timestamptz, revoked_by uuid references auth.users(id),
 check(expires_at>starts_at), check((status='active' and revoked_at is null and revoked_by is null) or (status='revoked' and revoked_at is not null and revoked_by is not null))
);
create unique index admin_comp_one_active on public.admin_comp_authority(business_id) where status='active';
create table public.admin_comp_audit (
 id bigint generated always as identity primary key,
 grant_id uuid references public.admin_comp_authority(id), business_id uuid not null references public.business_submissions(id),
 action text not null check(action in ('grant','revoke','supersede','legacy_clear')),
 actor uuid not null references auth.users(id), occurred_at timestamptz not null default clock_timestamp()
);
alter table public.admin_comp_authority enable row level security;
alter table public.admin_comp_audit enable row level security;
revoke all on public.admin_comp_authority,public.admin_comp_audit from public,anon,authenticated,service_role;
grant select on public.admin_comp_authority,public.admin_comp_audit to authenticated;
create policy admin_comp_read on public.admin_comp_authority for select to authenticated using(public.is_service_admin());
create policy admin_comp_audit_read on public.admin_comp_audit for select to authenticated using(public.is_service_admin());

-- Internal conservative test: absence must come from authoritative ledgers, never
-- apple_public_promotions(). Historical/closed/Sandbox evidence also blocks COMP.
create function public.admin_comp_payment_conflict(p_business uuid) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select not exists(select 1 from public.business_submissions where id=p_business)
 or exists(select 1 from public.business_submissions b where b.id=p_business and (
   coalesce(b.stripe_subscription_id,'')<>'' or coalesce(b.stripe_session_id,'')<>''
   or coalesce(b.stripe_payment_intent_id,'')<>'' or coalesce(b.stripe_customer_id,'')<>''
   or b.paid_at is not null or b.payment_status is distinct from 'not_required'
   or b.placement_source is null or b.placement_source not in ('paid','comp')))
 or exists(select 1 from public.payment_records where business_submission_id=p_business)
 or exists(select 1 from public.stripe_promotion_authority where listing_type='business' and listing_id=p_business)
 or exists(select 1 from public.stripe_authority_receipts where lower(btrim(snapshot->>'listing_id'))=p_business::text)
 or exists(select 1 from public.apple_listing_authorizations where listing_type='business' and listing_id=p_business)
 or exists(select 1 from public.apple_expired_purchases where listing_type='business' and listing_id=p_business)
 or exists(select 1 from public.apple_purchase_intents where listing_type='business' and listing_id=p_business)
 or exists(select 1 from public.apple_subscription_assignments where listing_type='business' and listing_id=p_business)
 or exists(select 1 from public.apple_slot_occupancies where listing_type='business' and listing_id=p_business)
 or exists(select 1 from public.listing_promotion_entitlements where listing_type='business' and listing_id=p_business and provider is distinct from 'comp');
 -- Subscription/transaction/delivery evidence links to listings through the
 -- assignments, slots and intents above; none has an independent listing_id.
$$;

create function public.admin_comp_lock_payment_sources() returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if auth.uid() is null or not public.is_service_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 -- Closed staging boundary: the forward protocol migration replaces these RPCs.
 raise exception 'COMMERCIAL_PROTOCOL_REQUIRED';
end $$;
revoke all on function public.admin_comp_payment_conflict(uuid),public.admin_comp_lock_payment_sources() from public,anon,authenticated,service_role;

create function public.grant_admin_comp(p_business uuid,p_plan text,p_days integer,p_key uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.business_submissions; previous public.admin_comp_authority; stamp timestamptz;
begin
 if auth.uid() is null or not public.is_service_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_plan is null or p_plan not in ('featured','premium') or p_days is null or p_days not between 1 and 365 or p_key is null then raise exception 'INVALID_COMP'; end if;
 perform public.admin_comp_lock_payment_sources();
 select * into b from public.business_submissions where id=p_business for update;
 if b.id is null then raise exception 'BUSINESS_REQUIRED'; end if;
 select * into previous from public.admin_comp_authority where id=p_key;
 if found then
  if previous.business_id<>p_business or previous.plan<>p_plan or previous.duration_days<>p_days or previous.granted_by<>auth.uid() then raise exception 'IDEMPOTENCY_CONFLICT'; end if;
  return previous.id; -- Never extends or resurrects an already revoked grant.
 end if;
 -- Explicit provider isolation; never overwrite a Stripe/Apple binding.
 if public.admin_comp_payment_conflict(b.id) then raise exception 'PAID_PROVIDER_BOUND'; end if;
 stamp:=clock_timestamp();
 for previous in select * from public.admin_comp_authority where business_id=b.id and status='active' loop
  update public.admin_comp_authority set status='revoked',revoked_at=stamp,revoked_by=auth.uid() where id=previous.id;
  insert into public.admin_comp_audit(grant_id,business_id,action,actor) values(previous.id,b.id,'supersede',auth.uid());
 end loop;
 insert into public.admin_comp_authority(id,business_id,plan,status,starts_at,expires_at,granted_by,granted_at,duration_days)
 values(p_key,b.id,p_plan,'active',stamp,stamp+make_interval(days=>p_days),auth.uid(),stamp,p_days);
 insert into public.admin_comp_audit(grant_id,business_id,action,actor) values(p_key,b.id,'grant',auth.uid());
 update public.business_submissions set plan=initcap(p_plan),status='approved',payment_status='not_required',placement_source='comp',placement_expires_at=stamp+make_interval(days=>p_days) where id=b.id;
 return p_key;
end $$;
create function public.revoke_admin_comp(p_business uuid,p_grant uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.business_submissions; a public.admin_comp_authority;
begin
 if auth.uid() is null or not public.is_service_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 perform public.admin_comp_lock_payment_sources();
 select * into b from public.business_submissions where id=p_business for update;
 if p_grant is null then
  if b.id is null or b.placement_source<>'comp' or exists(select 1 from public.admin_comp_authority where business_id=b.id and status='active') then raise exception 'LEGACY_COMP_REQUIRED'; end if;
  if public.admin_comp_payment_conflict(b.id) then raise exception 'PAID_PROVIDER_BOUND'; end if;
  insert into public.admin_comp_audit(grant_id,business_id,action,actor) values(null,b.id,'legacy_clear',auth.uid());
  update public.business_submissions set plan='Free',placement_source='paid',placement_expires_at=null where id=b.id;
  return;
 end if;
 select * into a from public.admin_comp_authority where id=p_grant and business_id=p_business;
 if a.id is null then raise exception 'GRANT_REQUIRED'; end if;
 if a.status='revoked' then return; end if;
 update public.admin_comp_authority set status='revoked',revoked_at=clock_timestamp(),revoked_by=auth.uid() where id=a.id;
 insert into public.admin_comp_audit(grant_id,business_id,action,actor) values(a.id,b.id,'revoke',auth.uid());
 if b.placement_source='comp' and not public.admin_comp_payment_conflict(b.id) then
  update public.business_submissions set plan='Free',placement_source='paid',placement_expires_at=null where id=b.id;
 end if;
end $$;
revoke all on function public.grant_admin_comp(uuid,text,integer,uuid),public.revoke_admin_comp(uuid,uuid) from public,anon,service_role;
grant execute on function public.grant_admin_comp(uuid,text,integer,uuid),public.revoke_admin_comp(uuid,uuid) to authenticated;

-- Retain paid-provider positive policy; COMP additionally fails closed on all
-- historical/transitional bindings, even if the public Apple projection is empty.
create or replace function public.premium_event_provider(p_business uuid) returns text
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.business_submissions; n integer;
begin
 select * into b from public.business_submissions where id=p_business;
 if auth.uid() is null or b.id is null or b.advertiser_user_id is distinct from auth.uid() or b.status<>'approved' then return null; end if;
 if coalesce(b.stripe_subscription_id,'')<>'' then
  if exists(select 1 from public.stripe_promotion_authority a where a.subscription_id=b.stripe_subscription_id and a.listing_type='business' and a.listing_id=b.id and a.environment='Production' and a.plan='premium' and a.status='active' and not a.ambiguous and a.period_end>now()) then return 'stripe'; end if;
  return null;
 end if;
 select count(*) into n from public.apple_public_promotions() a where a.listing_type='business' and a.listing_id=b.id and a.plan='premium' and a.valid_until>now();
 if n=1 then return 'apple'; end if;
 if public.admin_comp_payment_conflict(b.id) then return null; end if;
 if exists(select 1 from public.admin_comp_authority a where a.business_id=b.id and a.plan='premium' and a.status='active' and a.starts_at<=now() and a.expires_at>now()) then return 'admin_comp'; end if;
 return null;
end $$;
alter table public.event_submissions drop constraint event_submissions_entitlement_provider_check;
alter table public.event_submissions add constraint event_submissions_entitlement_provider_check check(entitlement_provider in ('stripe','apple','admin_comp'));
-- Pin execution/identity ownership and ACLs independently of the deploy role's
-- defaults (supabase_admin sequence defaults may otherwise expose nextval/setval).
alter table public.admin_comp_authority owner to postgres;
alter table public.admin_comp_audit owner to postgres;
revoke all on sequence public.admin_comp_audit_id_seq from public,anon,authenticated,service_role;
alter function public.admin_comp_payment_conflict(uuid) owner to postgres;
alter function public.admin_comp_lock_payment_sources() owner to postgres;
alter function public.grant_admin_comp(uuid,text,integer,uuid) owner to postgres;
alter function public.revoke_admin_comp(uuid,uuid) owner to postgres;
commit;
