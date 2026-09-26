begin;
-- EXPLICIT SEPARATE ADMINISTRATIVE STAGE. Never include in bulk migration push.
-- Required external prerequisite: REMOTE EDGE VERIFICATION PASS, using --use-api.
-- SQL checks installed database state ONLY; it cannot attest a remote Edge hash.
do $$
declare p commercial_deploy.protocol; item record; actual jsonb;
begin
 select * into strict p from commercial_deploy.protocol where singleton for update;
 if p.activated_at is not null then raise exception 'ACTIVATION_ALREADY_CONSUMED';end if;
 if p.protocol_version<>1 or p.expected_project<>'ymgiwjuhgvfexitynmtb'
 or p.expected_function<>'stripe-webhook' or p.installed_at>clock_timestamp()
 or (select count(*) from jsonb_object_keys(p.definitions))<>24 or p.triggers='{}'::jsonb
 then raise exception 'COMMERCIAL_PROTOCOL_REQUIRED';end if;
 if to_regclass('public.admin_comp_authority') is null or to_regclass('public.admin_comp_audit') is null
 or to_regprocedure('public.admin_comp_lock_payment_sources()') is null
 or to_regprocedure('public.lock_commercial_listings(jsonb,boolean)') is null
 or to_regprocedure('public.stripe_patch_business(uuid,text,jsonb)') is null
 or to_regprocedure('public.apple_ledger_compare_and_swap(bigint,jsonb)') is null
 or to_regprocedure('public.apple_ledger_compare_and_swap_production(bigint,jsonb)') is null
 then raise exception 'COMMERCIAL_PROTOCOL_REQUIRED';end if;
 if position('COMMERCIAL_PROTOCOL_REQUIRED' in pg_get_functiondef('public.admin_comp_lock_payment_sources()'::regprocedure))=0
 or position('admin_comp_lock_payment_sources' in pg_get_functiondef('public.grant_admin_comp(uuid,text,integer,uuid)'::regprocedure))=0
 or position('admin_comp_lock_payment_sources' in pg_get_functiondef('public.revoke_admin_comp(uuid,uuid)'::regprocedure))=0
 then raise exception 'COMP_MUST_BE_DISABLED';end if;
 for item in select key,value from jsonb_each_text(p.definitions) loop
  if to_regprocedure(item.key) is null or md5(pg_get_functiondef(to_regprocedure(item.key))) is distinct from item.value
  then raise exception 'PROTOCOL_DEFINITION_DRIFT';end if;
 end loop;
 select jsonb_object_agg(t.tgrelid::regclass::text||'.'||t.tgname,
 jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled)) into actual
 from pg_trigger t where not t.tgisinternal and t.tgname like '%commercial%';
 if actual is distinct from p.triggers then raise exception 'PROTOCOL_TRIGGER_DRIFT';end if;
 update commercial_deploy.protocol set activated_at=clock_timestamp() where singleton;
end $$;
create or replace function public.grant_admin_comp(p_business uuid,p_plan text,p_days integer,p_key uuid) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.business_submissions; previous public.admin_comp_authority; stamp timestamptz;
begin
 if auth.uid() is null or not public.is_service_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_plan is null or p_plan not in ('featured','premium') or p_days is null or p_days not between 1 and 365 or p_key is null then raise exception 'INVALID_COMP'; end if;
 perform public.lock_commercial_listings(jsonb_build_array(jsonb_build_object('listing_type','business','listing_id',p_business)));
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

create or replace function public.revoke_admin_comp(p_business uuid,p_grant uuid) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.business_submissions; a public.admin_comp_authority;
begin
 if auth.uid() is null or not public.is_service_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 perform public.lock_commercial_listings(jsonb_build_array(jsonb_build_object('listing_type','business','listing_id',p_business)));
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
 if a.status in ('revoked','superseded_paid') then return; end if;
 update public.admin_comp_authority set status='revoked',revoked_at=clock_timestamp(),revoked_by=auth.uid() where id=a.id;
 insert into public.admin_comp_audit(grant_id,business_id,action,actor) values(a.id,b.id,'revoke',auth.uid());
 if b.placement_source='comp' and not public.admin_comp_payment_conflict(b.id) then
  update public.business_submissions set plan='Free',placement_source='paid',placement_expires_at=null where id=b.id;
 end if;
end $$;

drop function public.admin_comp_lock_payment_sources();
commit;
