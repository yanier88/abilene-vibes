begin;
set local lock_timeout='5s';
set local statement_timeout='30s';
-- Drain transactions already using the old provider relations. Dormant old
-- invocations remain possible; write triggers and NOWAIT ledger acquisition
-- below make those safe after COMMIT. Never claim CREATE OR REPLACE cancels them.
lock table public.apple_ledger_revision in access exclusive mode;
lock table public.business_submissions,public.job_listings,public.rental_listings,
 public.stripe_promotion_authority,public.stripe_authority_receipts,
 public.payment_records,public.apple_listing_authorizations,
 public.apple_purchase_intents,public.apple_subscription_assignments,
 public.apple_slot_occupancies,public.apple_expired_purchases,
 public.listing_promotion_entitlements in access exclusive mode;
-- Forward-only replacements for deployed provider functions. Never reapply their
-- historical migrations. COMP stays disabled until the separate 250003 activation gate.
create function public.lock_commercial_listings(p_listings jsonb,p_nowait boolean default false)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare x record; locked uuid;
begin
 if current_setting('transaction_isolation')<>'read committed' then raise exception 'COMMERCIAL_READ_COMMITTED_REQUIRED'; end if;
 if p_listings is null or jsonb_typeof(p_listings)<>'array' then raise exception 'LISTING_LOCK_INPUT'; end if;
 -- The actual PK row is the lock identity: no truncated UUID or hash collision.
 -- All callers acquire the full sorted set before any provider/ledger row.
 for x in select distinct value->>'listing_type' kind,(value->>'listing_id')::uuid id
  from jsonb_array_elements(p_listings) order by kind,id loop
  if x.id is null then raise exception 'LISTING_LOCK_INPUT'; end if;
  locked:=null;
  case x.kind
  when 'business' then
   if p_nowait then select id into locked from public.business_submissions where id=x.id for update nowait;
   else select id into locked from public.business_submissions where id=x.id for update; end if;
  when 'job' then
   if p_nowait then select id into locked from public.job_listings where id=x.id for update nowait;
   else select id into locked from public.job_listings where id=x.id for update; end if;
  when 'rental' then
   if p_nowait then select id into locked from public.rental_listings where id=x.id for update nowait;
   else select id into locked from public.rental_listings where id=x.id for update; end if;
  else raise exception 'LISTING_LOCK_INPUT'; end case;
  if locked is null then raise exception 'LISTING_LOCK_NOT_FOUND'; end if;
 end loop;
end $$;
revoke all on function public.lock_commercial_listings(jsonb,boolean) from public,anon,authenticated,service_role;

-- Preserve the admin actor of the original grant. Provider supersession is a
-- distinct system action, never a fabricated admin revocation.
alter table public.admin_comp_authority drop constraint admin_comp_authority_status_check;
alter table public.admin_comp_authority add constraint admin_comp_authority_status_check check(status in ('active','revoked','superseded_paid'));
alter table public.admin_comp_authority drop constraint admin_comp_authority_check1;
alter table public.admin_comp_authority add constraint admin_comp_authority_check1 check(
 (status='active' and revoked_at is null and revoked_by is null)
 or (status='revoked' and revoked_at is not null and revoked_by is not null)
 or (status='superseded_paid' and revoked_at is not null and revoked_by is null));
alter table public.admin_comp_audit alter column actor drop not null;
alter table public.admin_comp_audit add column provider text;
alter table public.admin_comp_audit drop constraint admin_comp_audit_action_check;
alter table public.admin_comp_audit add constraint admin_comp_audit_action_check check(action in ('grant','revoke','supersede','legacy_clear','paid_priority'));
alter table public.admin_comp_audit add constraint admin_comp_audit_actor_source check(
 (action='paid_priority' and actor is null and provider in ('apple','stripe') and grant_id is not null)
 or (action<>'paid_priority' and actor is not null and provider is null));

create function public.commercial_paid_priority(p_id uuid,p_provider text,p_plan text,p_until timestamptz)
returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare a public.admin_comp_authority; stamp timestamptz:=clock_timestamp();
begin
 if p_provider not in ('apple','stripe') or p_plan not in ('featured','premium') then raise exception 'PAID_PRIORITY_INVALID'; end if;
 perform public.lock_commercial_listings(jsonb_build_array(jsonb_build_object('listing_type','business','listing_id',p_id)));
 for a in update public.admin_comp_authority set status='superseded_paid',revoked_at=stamp,revoked_by=null
  where business_id=p_id and status='active' returning * loop
  insert into public.admin_comp_audit(grant_id,business_id,action,actor,provider) values(a.id,p_id,'paid_priority',null,p_provider);
 end loop;
 -- Replace only a COMP projection. Never change moderation, owner, money,
 -- subscription identity or an existing paid-provider projection.
 update public.business_submissions set plan=initcap(p_plan),placement_source=p_provider,
  placement_expires_at=p_until where id=p_id and placement_source='comp';
end $$;
revoke all on function public.commercial_paid_priority(uuid,text,text,timestamptz) from public,anon,authenticated,service_role;

-- Legacy webhook UPSERT obtains the Business lock BEFORE its payment row lock.
-- A direct UPDATE (not an existing writer) must not introduce a wait edge in
-- reverse order: NOWAIT makes it fail atomically if it lacks the Business lock.
create function public.commercial_payment_record_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if TG_OP='UPDATE' and new.business_submission_id is distinct from old.business_submission_id then raise exception 'PAYMENT_LISTING_IMMUTABLE'; end if;
 if new.business_submission_id is not null then
  perform public.lock_commercial_listings(jsonb_build_array(jsonb_build_object('listing_type','business','listing_id',new.business_submission_id)),TG_OP='UPDATE');
 end if;
 return new;
end $$;
revoke all on function public.commercial_payment_record_guard() from public,anon,authenticated,service_role;
create trigger commercial_payment_record_guard before insert or update on public.payment_records for each row execute function public.commercial_payment_record_guard();

-- Binding inserts (including legacy RPCs) take the same existing listing row.
-- Main CAS/authority RPCs already own it; UPDATE guard uses NOWAIT to avoid a
-- reverse waiting edge for unsupported direct SQL. No client gets new writes.
create function public.commercial_provider_row_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if TG_OP='UPDATE' and TG_TABLE_NAME<>'apple_slot_occupancies' and (new.listing_type,new.listing_id) is distinct from (old.listing_type,old.listing_id) then raise exception 'COMMERCIAL_LISTING_IMMUTABLE'; end if;
 -- Canonical RPCs already hold the whole listing set. An old in-flight function
 -- may still hold the ledger first: it must abort rather than wait in reverse.
 perform public.lock_commercial_listings(jsonb_build_array(jsonb_build_object('listing_type',new.listing_type,'listing_id',new.listing_id)),true);
 return new;
end $$;
revoke all on function public.commercial_provider_row_guard() from public,anon,authenticated,service_role;
create trigger aa_commercial_listing before insert or update on public.stripe_promotion_authority for each row execute function public.commercial_provider_row_guard();
create trigger aa_commercial_listing before insert or update on public.apple_listing_authorizations for each row execute function public.commercial_provider_row_guard();
create trigger aa_commercial_listing before insert or update on public.apple_purchase_intents for each row execute function public.commercial_provider_row_guard();
create trigger aa_commercial_listing before insert or update on public.apple_subscription_assignments for each row execute function public.commercial_provider_row_guard();
create trigger aa_commercial_listing before insert or update on public.apple_slot_occupancies for each row execute function public.commercial_provider_row_guard();
create trigger aa_commercial_listing before insert or update on public.apple_expired_purchases for each row execute function public.commercial_provider_row_guard();
create trigger aa_commercial_listing before insert or update on public.listing_promotion_entitlements for each row execute function public.commercial_provider_row_guard();

-- Defensive direct/old Apple writers may already own a row or relation lock.
-- They must never wait for the revision in reverse order. Canonical RPCs already
-- own it; NOWAIT retains atomic rollback for unsupported/in-flight old ordering.
create function public.commercial_apple_ledger_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if TG_TABLE_NAME='listing_promotion_entitlements' then
  if new.provider<>'apple' then return new; end if;
 end if;
 perform 1 from public.apple_ledger_revision where id=1 for update nowait;
 return new;
end $$;
revoke all on function public.commercial_apple_ledger_guard() from public,anon,authenticated,service_role;
do $$ declare t text; begin
 foreach t in array array['apple_intent_attempt_facts','apple_transactions','apple_deliveries','apple_subscriptions','apple_subscription_assignments','listing_promotion_entitlements','apple_expired_purchases','apple_challenges','apple_notification_events','apple_purchase_intents'] loop
  execute format('create trigger ab_commercial_ledger before insert or update on public.%I for each row execute function public.commercial_apple_ledger_guard()',t);
 end loop;
end $$;
create function public.commercial_stripe_receipt_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if new.snapshot->>'listing_id' is not null then
  perform public.lock_commercial_listings(jsonb_build_array(jsonb_build_object(
   'listing_type',coalesce(new.snapshot->>'listing_type','business'),'listing_id',new.snapshot->>'listing_id')),true);
 end if;
 return new;
end $$;
revoke all on function public.commercial_stripe_receipt_guard() from public,anon,authenticated,service_role;
create trigger commercial_stripe_receipt_guard before insert or update on public.stripe_authority_receipts for each row execute function public.commercial_stripe_receipt_guard();

create function public.commercial_paid_row_projection() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if new.listing_type='business' and new.environment='Production' then
  if TG_TABLE_NAME='stripe_promotion_authority' then
   if new.status='active' and not new.ambiguous and new.period_end>clock_timestamp() and new.plan in ('featured','premium') then
    perform public.commercial_paid_priority(new.listing_id,'stripe',new.plan,new.period_end);
   end if;
  elsif new.provider='apple' and new.status in ('active','active_nonrenewing','grace') and new.valid_from<=clock_timestamp() and new.valid_until>clock_timestamp() and new.plan in ('featured','premium') then
   perform public.commercial_paid_priority(new.listing_id,'apple',new.plan,new.valid_until);
  end if;
 end if;
 return new;
end $$;
revoke all on function public.commercial_paid_row_projection() from public,anon,authenticated,service_role;
create trigger commercial_paid_row_projection after insert or update on public.stripe_promotion_authority for each row execute function public.commercial_paid_row_projection();
create trigger commercial_paid_row_projection after insert or update on public.listing_promotion_entitlements for each row execute function public.commercial_paid_row_projection();

-- Build typed deltas before acquiring the ledger revision. Unchanged rows in a
-- whole-ledger snapshot must not acquire locks on unrelated listings. Revision
-- comparison after waiting still rejects any stale snapshot without applying it.
create function public.commercial_apple_delta(p_state jsonb,p_environment text) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare spec text[]; payload jsonb; delta jsonb; answer jsonb:='{}'; predicate text; equal_columns text;
 pairs text[][]:=array[
 ['buyers','apple_buyers','id'],['installations','apple_installations','installation_id'],['capabilities','apple_session_capabilities','id'],['challenges','apple_challenges','id'],
 ['catalog','apple_product_catalog','environment,product_id'],['grants','apple_listing_authorizations','id'],['intents','apple_purchase_intents','id'],
 ['subscriptions','apple_subscriptions','id'],['assignments','apple_subscription_assignments','id'],['slots','apple_slot_occupancies','buyer_id,environment,slot_number'],
 ['transactions','apple_transactions','bundle_id,environment,transaction_id'],['notifications','apple_notification_events','id'],['entitlements','listing_promotion_entitlements','id'],['deliveries','apple_deliveries','id'],['expired_purchases','apple_expired_purchases','id']];
begin
 if p_state is null or jsonb_typeof(p_state)<>'object' then raise exception 'INVALID_STATE'; end if;
 foreach spec slice 1 in array pairs loop
  payload:=p_state->spec[1];
  if payload is null or jsonb_typeof(payload)<>'array' then raise exception 'INVALID_STATE'; end if;
  if exists(select 1 from jsonb_array_elements(payload) x where x->>'environment' is distinct from p_environment) then raise exception 'ENVIRONMENT_DISABLED'; end if;
  if spec[1]='entitlements' and exists(select 1 from jsonb_array_elements(payload) x where x->>'provider' is distinct from 'apple') then raise exception 'PROVIDER_DISABLED'; end if;
  select string_agg(format('old.%I is not distinct from candidate.%I',k,k),' and ') into predicate from unnest(string_to_array(spec[3],','))k;
  -- Compare at the precision exported by the real snapshot RPC. Most dates are
  -- milliseconds; authorization/capability dates deliberately preserve micros.
  select string_agg(case when atttypid='timestamptz'::regtype and spec[1] not in ('grants','capabilities')
   then format('date_trunc(''milliseconds'',old.%I) is not distinct from date_trunc(''milliseconds'',candidate.%I)',attname,attname)
   else format('old.%I is not distinct from candidate.%I',attname,attname) end,' and ')
  into equal_columns from pg_attribute where attrelid=format('public.%I',spec[2])::regclass and attnum>0 and not attisdropped;
  -- Identifiers come ONLY from the fixed server allowlist above; values are bound.
  execute format('select coalesce(jsonb_agg(to_jsonb(candidate)),''[]''::jsonb) from jsonb_populate_recordset(null::public.%I,$1) candidate where not exists(select 1 from public.%I old where %s and %s)',spec[2],spec[2],predicate,equal_columns) into delta using payload;
  answer:=jsonb_set(answer,array[spec[1]],delta);
 end loop;
 return answer;
end $$;
revoke all on function public.commercial_apple_delta(jsonb,text) from public,anon,authenticated,service_role;

create function public.commercial_apple_listings(p_delta jsonb,p_state jsonb) returns jsonb
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 with direct as (
  select x.value->>'listing_type' kind,(x.value->>'listing_id')::uuid id from jsonb_each(p_delta) e cross join lateral jsonb_array_elements(e.value) x(value) where x.value ? 'listing_id'
 ), subs as (select (value->>'id')::uuid id from jsonb_array_elements(p_delta->'subscriptions')),
 assignments as (
  select a.listing_type kind,a.listing_id id from public.apple_subscription_assignments a where a.subscription_id in (select id from subs)
  union select value->>'listing_type',(value->>'listing_id')::uuid from jsonb_array_elements(p_state->'assignments') where (value->>'subscription_id')::uuid in (select id from subs)
 ), financial_assignments as (
  select a.listing_type kind,a.listing_id id from public.apple_subscription_assignments a where a.id in (
   select (value->>'assignment_id')::uuid from jsonb_array_elements(p_delta->'transactions')
   union select (value->>'assignment_id')::uuid from jsonb_array_elements(p_delta->'deliveries'))
 ), prior_slots as (
  select a.listing_type kind,a.listing_id id from public.apple_slot_occupancies a join jsonb_array_elements(p_delta->'slots') x on a.buyer_id=(x->>'buyer_id')::uuid and a.environment=x->>'environment' and a.slot_number=(x->>'slot_number')::integer
 ) select coalesce(jsonb_agg(jsonb_build_object('listing_type',kind,'listing_id',id) order by kind,id),'[]') from (select * from direct union select * from assignments union select * from financial_assignments union select * from prior_slots) x;
$$;
revoke all on function public.commercial_apple_listings(jsonb,jsonb) from public,anon,authenticated,service_role;
create or replace function public.apple_ledger_compare_and_swap(expected_version bigint, next_state jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare write_state jsonb; v bigint; spec text[]; payload jsonb; columns_sql text; updates_sql text; pk_sql text;
 pairs text[][] := array[
 ['buyers','apple_buyers','id'],['installations','apple_installations','installation_id'],['capabilities','apple_session_capabilities','id'],['challenges','apple_challenges','id'],
 ['catalog','apple_product_catalog','environment,product_id'],['grants','apple_listing_authorizations','id'],['intents','apple_purchase_intents','id'],
 ['subscriptions','apple_subscriptions','id'],['assignments','apple_subscription_assignments','id'],['slots','apple_slot_occupancies','buyer_id,environment,slot_number'],
 ['transactions','apple_transactions','bundle_id,environment,transaction_id'],['notifications','apple_notification_events','id'],
 ['entitlements','listing_promotion_entitlements','id'],['deliveries','apple_deliveries','id'],['expired_purchases','apple_expired_purchases','id']];
begin
 write_state:=public.commercial_apple_delta(next_state,'Sandbox');
 perform public.lock_commercial_listings(public.commercial_apple_listings(write_state,next_state));
 select revision into v from public.apple_ledger_revision where id=1 for update nowait;
 if expected_version is null or next_state is null or jsonb_typeof(next_state)<>'object' then raise exception 'INVALID_STATE'; end if;
 if v<>expected_version then return false; end if;
 -- Serialize with entitlement writers while checking new Apple work. No foreign
 -- provider row is changed. Existing unrelated Apple rows do not block this CAS.
 -- Common listing rows serialize relevant commercial writers; no global table lock.
 if exists (
   select 1 from jsonb_array_elements(next_state->'intents') i
   join public.listing_promotion_entitlements e
    on e.listing_type=i->>'listing_type' and e.listing_id::text=i->>'listing_id'
   where e.environment='Sandbox' and e.provider='stripe'
    and e.status in ('active','active_nonrenewing','grace')
    and e.valid_from<=clock_timestamp() and e.valid_until>clock_timestamp()
    and (not exists(select 1 from public.apple_purchase_intents old where old.id::text=i->>'id')
      or exists(select 1 from public.apple_purchase_intents old where old.id::text=i->>'id' and old.status is distinct from i->>'status')
      or exists(select 1 from jsonb_array_elements(next_state->'deliveries') d
          where d->>'purchase_intent_id'=i->>'id' and not exists(select 1 from public.apple_deliveries old where old.id::text=d->>'id')))
 ) then raise exception 'STRIPE_CONFLICT'; end if;

 foreach spec slice 1 in array pairs loop
  payload:=write_state->spec[1];
  if payload is null or jsonb_typeof(payload)<>'array' then raise exception 'INVALID_STATE'; end if;
  if exists(select 1 from jsonb_array_elements(payload) x where x->>'environment' is distinct from 'Sandbox') then raise exception 'ENVIRONMENT_DISABLED'; end if;
  if spec[1]='entitlements' and exists(select 1 from jsonb_array_elements(payload) x where x->>'provider' is distinct from 'apple') then raise exception 'PROVIDER_DISABLED'; end if;
  select string_agg(format('%I',a.attname),',' order by a.attnum),
   string_agg(format('%I=excluded.%I',a.attname,a.attname),',' order by a.attnum) filter(where not a.attname=any(string_to_array(spec[3],',')))
   into columns_sql,updates_sql from pg_attribute a where a.attrelid=format('public.%I',spec[2])::regclass and a.attnum>0 and not a.attisdropped;
  select string_agg(format('%I',p),',') into pk_sql from unnest(string_to_array(spec[3],',')) p;
  -- Fixed server allowlist; no table/column identifiers from next_state. Never deletes history.
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1) on conflict (%s) do update set %s',spec[2],columns_sql,columns_sql,spec[2],pk_sql,updates_sql) using payload;
 end loop;
 update public.apple_ledger_revision set revision=revision+1 where id=1;
 return true;
exception when lock_not_available then return false;
end; $$;

create or replace function public.apple_ledger_compare_and_swap_production(expected_version bigint, next_state jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare write_state jsonb; v bigint; spec text[]; payload jsonb; columns_sql text; updates_sql text; pk_sql text;
 pairs text[][] := array[
 ['buyers','apple_buyers','id'],['installations','apple_installations','installation_id'],['capabilities','apple_session_capabilities','id'],['challenges','apple_challenges','id'],
 ['catalog','apple_product_catalog','environment,product_id'],['grants','apple_listing_authorizations','id'],['intents','apple_purchase_intents','id'],
 ['subscriptions','apple_subscriptions','id'],['assignments','apple_subscription_assignments','id'],['slots','apple_slot_occupancies','buyer_id,environment,slot_number'],
 ['transactions','apple_transactions','bundle_id,environment,transaction_id'],['notifications','apple_notification_events','id'],
 ['entitlements','listing_promotion_entitlements','id'],['deliveries','apple_deliveries','id'],['expired_purchases','apple_expired_purchases','id']];
begin
 write_state:=public.commercial_apple_delta(next_state,'Production');
 perform public.lock_commercial_listings(public.commercial_apple_listings(write_state,next_state));
 select revision into v from public.apple_ledger_revision where id=1 for update nowait;
 if expected_version is null or next_state is null or jsonb_typeof(next_state)<>'object' then raise exception 'INVALID_STATE'; end if;
 if v<>expected_version then return false; end if;
 -- Serialize with entitlement writers while checking new Apple work. No foreign
 -- provider row is changed. Existing unrelated Apple rows do not block this CAS.
 -- Common listing rows serialize relevant commercial writers; no global table lock.
 if exists (
   select 1 from jsonb_array_elements(next_state->'intents') i
   join public.listing_promotion_entitlements e
    on e.listing_type=i->>'listing_type' and e.listing_id::text=i->>'listing_id'
   where e.environment='Production' and e.provider='stripe'
    and e.status in ('active','active_nonrenewing','grace')
    and e.valid_from<=clock_timestamp() and e.valid_until>clock_timestamp()
    and (not exists(select 1 from public.apple_purchase_intents old where old.id::text=i->>'id')
      or exists(select 1 from public.apple_purchase_intents old where old.id::text=i->>'id' and old.status is distinct from i->>'status')
      or exists(select 1 from jsonb_array_elements(next_state->'deliveries') d
          where d->>'purchase_intent_id'=i->>'id' and not exists(select 1 from public.apple_deliveries old where old.id::text=d->>'id')))
 ) then raise exception 'STRIPE_CONFLICT'; end if;

 foreach spec slice 1 in array pairs loop
  payload:=write_state->spec[1];
  if payload is null or jsonb_typeof(payload)<>'array' then raise exception 'INVALID_STATE'; end if;
  if exists(select 1 from jsonb_array_elements(payload) x where x->>'environment' is distinct from 'Production') then raise exception 'ENVIRONMENT_DISABLED'; end if;
  if spec[1]='entitlements' and exists(select 1 from jsonb_array_elements(payload) x where x->>'provider' is distinct from 'apple') then raise exception 'PROVIDER_DISABLED'; end if;
  select string_agg(format('%I',a.attname),',' order by a.attnum),
   string_agg(format('%I=excluded.%I',a.attname,a.attname),',' order by a.attnum) filter(where not a.attname=any(string_to_array(spec[3],',')))
   into columns_sql,updates_sql from pg_attribute a where a.attrelid=format('public.%I',spec[2])::regclass and a.attnum>0 and not a.attisdropped;
  select string_agg(format('%I',p),',') into pk_sql from unnest(string_to_array(spec[3],',')) p;
  -- Fixed server allowlist; no table/column identifiers from next_state. Never deletes history.
  execute format('insert into public.%I (%s) select %s from jsonb_populate_recordset(null::public.%I,$1) on conflict (%s) do update set %s',spec[2],columns_sql,columns_sql,spec[2],pk_sql,updates_sql) using payload;
 end loop;
 update public.apple_ledger_revision set revision=revision+1 where id=1;
 return true;
exception when lock_not_available then return false;
end; $$;

create or replace function public.apple_bootstrap_complete(p_user uuid,p_challenge uuid,p_app_transaction text,p_listing_type text,p_listing uuid,p_not_after timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare c public.apple_bootstrap_challenges; b public.apple_buyers; i public.apple_installations; k public.apple_installation_keys;
 profile_token uuid; owner_id uuid; listing_status text; secret text; t timestamptz; cap uuid;
begin
 perform public.lock_commercial_listings(jsonb_build_array(jsonb_build_object('listing_type',p_listing_type,'listing_id',p_listing)));
 perform 1 from public.apple_ledger_revision where id=1 for update nowait;
 if p_not_after<=clock_timestamp() or p_not_after>clock_timestamp()+interval '60 seconds' or p_not_after is null then raise exception 'VERIFICATION_EXPIRED_AT_COMMIT';end if;
 select * into c from public.apple_bootstrap_challenges where id=p_challenge and user_id=p_user for update;
 if not found or c.consumed_at is not null or c.expires_at<=clock_timestamp() then raise exception 'CHALLENGE_REJECTED';end if;
 case p_listing_type
 when 'business' then select advertiser_user_id,status into owner_id,listing_status from public.business_submissions where id=p_listing for share;
 when 'job' then select advertiser_user_id,status into owner_id,listing_status from public.job_listings where id=p_listing for share;
 when 'rental' then select advertiser_user_id,status into owner_id,listing_status from public.rental_listings where id=p_listing for share;
 else raise exception 'LISTING_TYPE_REJECTED';end case;
 if owner_id is distinct from p_user or listing_status not in ('pending','approved') then raise exception 'LISTING_UNAUTHORIZED';end if;
 if not exists(select 1 from jsonb_array_elements(public.apple_ledger_snapshot_production()->'state'->'listings') l where l->>'listing_type'=p_listing_type and l->>'listing_id'=p_listing::text and (l->>'stripe_conflict')::boolean=false) then raise exception 'STRIPE_CONFLICT';end if;
 insert into public.advertiser_profiles(user_id) values(p_user) on conflict do nothing;
 select app_account_token into profile_token from public.advertiser_profiles where user_id=p_user;
 select ab.* into b from public.apple_buyers ab join public.apple_advertiser_buyers u on u.buyer_id=ab.id where u.user_id=p_user and u.environment='Production';
 t:=date_trunc('milliseconds',clock_timestamp());
 if not found then
  insert into public.apple_buyers(app_account_token,app_transaction_id,bundle_id,environment,status,last_verified_at)
  values(profile_token,p_app_transaction,'com.abilenevibes.app','Production','active',t) returning * into b;
  insert into public.apple_advertiser_buyers values(p_user,'Production',b.id);
 end if;
 if b.status<>'active' or b.app_transaction_id is distinct from p_app_transaction or b.app_account_token is distinct from profile_token then raise exception 'BUYER_BINDING_MISMATCH';end if;
 select * into k from public.apple_installation_keys where key_id=c.key_id;
 if found then
  if k.user_id<>p_user or k.revoked_at is not null or k.public_spki<>c.public_spki then raise exception 'INSTALLATION_REJECTED';end if;
  select * into i from public.apple_installations where installation_id=k.installation_id and buyer_id=b.id and revoked_at is null and attestation_status='verified';
  if not found then raise exception 'INSTALLATION_REJECTED';end if;
 else
  insert into public.apple_installations(buyer_id,key_id,attestation_status,environment,last_seen_at) values(b.id,c.key_id,'verified','Production',t) returning * into i;
  insert into public.apple_installation_keys(key_id,user_id,public_spki,installation_id) values(c.key_id,p_user,c.public_spki,i.installation_id);
 end if;
 if not exists(select 1 from public.apple_listing_authorizations where buyer_id=b.id and environment='Production' and listing_type=p_listing_type and listing_id=p_listing and revoked_at is null and expires_at>t) then
  insert into public.apple_listing_authorizations(buyer_id,environment,listing_type,listing_id,created_at,expires_at) values(b.id,'Production',p_listing_type,p_listing,t,t+interval '15 minutes');
 end if;
 secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');cap:=gen_random_uuid();
 insert into public.apple_session_capabilities(id,token_hash,buyer_id,installation_id,environment,scope,created_at,expires_at)
 values(cap,encode(sha256(convert_to(secret,'UTF8')),'hex'),b.id,i.installation_id,'Production',array['prepare','verify','reconcile'],t,t+interval '15 minutes');
 update public.apple_bootstrap_challenges set consumed_at=t where id=c.id;
 update public.apple_ledger_revision set revision=revision+1 where id=1;
 if p_not_after<=clock_timestamp() then raise exception 'VERIFICATION_EXPIRED_AT_COMMIT';end if;
 return jsonb_build_object('buyer_id',b.id,'installation_id',i.installation_id,'installation_key_id',c.key_id,'app_account_token',profile_token,'capability',secret,'environment','Production','listing_type',p_listing_type,'listing_id',p_listing);
end; $$;

create or replace function public.apple_renew_existing_purchase_permissions(intent_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare i public.apple_purchase_intents; b public.apple_buyers;
 t timestamptz; deadline timestamptz; secret text; cap_id uuid; grant_id uuid; listing_ok boolean;
begin
 perform public.lock_commercial_listings(coalesce((select jsonb_agg(jsonb_build_object('listing_type',listing_type,'listing_id',listing_id)) from public.apple_purchase_intents where id=intent_id),'[]'::jsonb));
 -- Same lock order as the ledger CAS; prevents a stale CAS from losing new rows.
 perform 1 from public.apple_ledger_revision where id=1 for update nowait;
 select * into i from public.apple_purchase_intents where id=intent_id;
 if not found or i.status<>'purchasing' or i.environment<>'Sandbox'
  or i.requested_plan<>'featured' or i.product_id<>'com.abilenevibes.app.promotion.slot01.featured.monthly'
  or i.subscription_group_id<>'22382531' or i.bundle_id<>'com.abilenevibes.app'
  or i.originating_installation_id is null then raise exception 'RENEWAL_CONTEXT_REJECTED'; end if;
 select * into b from public.apple_buyers where id=i.buyer_id and environment=i.environment;
 if not found or b.status<>'active' or b.bundle_id is distinct from i.bundle_id
  or b.app_account_token is distinct from i.app_account_token then raise exception 'RENEWAL_BINDING_REJECTED'; end if;
 if not exists(select 1 from public.apple_installations where installation_id=i.originating_installation_id
  and buyer_id=i.buyer_id and environment=i.environment and attestation_status='verified' and revoked_at is null)
  then raise exception 'RENEWAL_INSTALLATION_REJECTED'; end if;
 if not exists(select 1 from public.apple_product_catalog where product_id=i.product_id and environment=i.environment
  and bundle_id=i.bundle_id and subscription_group_id=i.subscription_group_id and plan='featured' and enabled)
  then raise exception 'RENEWAL_CATALOG_REJECTED'; end if;
 select exists(select 1 from jsonb_array_elements(public.apple_ledger_snapshot()->'state'->'listings') l
  where l->>'listing_type'=i.listing_type and l->>'listing_id'=i.listing_id::text
  and l->>'status' in ('pending','approved') and (l->>'stripe_conflict')::boolean=false) into listing_ok;
 if not listing_ok then raise exception 'RENEWAL_LISTING_REJECTED'; end if;
 t:=date_trunc('milliseconds',clock_timestamp()); deadline:=t+interval '15 minutes';
 if exists(select 1 from public.apple_listing_authorizations where buyer_id=i.buyer_id
  and environment=i.environment and listing_type=i.listing_type and listing_id=i.listing_id
  and revoked_at is null and created_at<=t and expires_at>t) then raise exception 'AUTHORIZATION_ALREADY_CURRENT'; end if;
 secret:=replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-','');
 cap_id:=gen_random_uuid(); grant_id:=gen_random_uuid();
 insert into public.apple_session_capabilities(id,token_hash,buyer_id,installation_id,environment,scope,created_at,expires_at)
 values(cap_id,encode(sha256(convert_to(secret,'UTF8')),'hex'),i.buyer_id,i.originating_installation_id,i.environment,array['verify'],t,deadline);
 insert into public.apple_listing_authorizations(id,buyer_id,environment,listing_type,listing_id,created_at,expires_at)
 values(grant_id,i.buyer_id,i.environment,i.listing_type,i.listing_id,t,deadline);
 update public.apple_ledger_revision set revision=revision+1 where id=1;
 return jsonb_build_object('capability',secret,'capabilityId',cap_id,'grantId',grant_id,'expiresAt',deadline);
end; $$;

create or replace function public.apple_release_never_started(intent_id uuid, expected_revision bigint, expected_intent jsonb, proof jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare i public.apple_purchase_intents; slot public.apple_slot_occupancies; v bigint; t timestamptz; after_i jsonb; after_slot jsonb;
begin
 perform public.lock_commercial_listings(coalesce((select jsonb_agg(jsonb_build_object('listing_type',listing_type,'listing_id',listing_id)) from public.apple_purchase_intents where id=intent_id),'[]'::jsonb));
 -- Every existing business CAS takes this same lock before writing.
 select revision into v from public.apple_ledger_revision where id=1 for update nowait;
 if expected_revision is null or v<>expected_revision then return false; end if;
 select * into strict i from public.apple_purchase_intents where id=intent_id for update;
 select * into strict slot from public.apple_slot_occupancies where purchase_intent_id=intent_id for update;
 if exists(select 1 from public.apple_never_started_releases where purchase_intent_id=intent_id) then return false; end if;
 if expected_intent is null or to_jsonb(i) is distinct from expected_intent then raise exception 'NEVER_STARTED_BINDING_CAS'; end if;
 if i.environment<>'Sandbox' or i.bundle_id<>'com.abilenevibes.app' or i.status not in ('reserved','failed')
  or i.started_at is not null or i.completed_at is not null or i.expires_at>clock_timestamp()
  or i.reconciliation_reason is not null and i.reconciliation_reason<>'WINDOW_EXPIRED_BEFORE_USER_PRESS'
  or slot.state<>'reserved' or slot.subscription_id is not null
  or row(slot.buyer_id,slot.environment,slot.listing_type,slot.listing_id,slot.slot_number)
      is distinct from row(i.buyer_id,i.environment,i.listing_type,i.listing_id,i.slot_number)
 then raise exception 'NEVER_STARTED_STATE_REJECTED'; end if;
 if not exists(select 1 from public.apple_buyers b join public.apple_installations a on a.buyer_id=b.id and a.environment=b.environment
  where b.id=i.buyer_id and b.environment=i.environment and b.bundle_id=i.bundle_id and b.app_account_token=i.app_account_token
    and b.status='active' and a.installation_id=i.originating_installation_id and a.revoked_at is null)
 then raise exception 'NEVER_STARTED_CURRENT_BINDING'; end if;
 -- Only a trusted local operator can call this function. Client assertions alone
 -- are not accepted as proof: privileges are revoked even from service_role.
 if proof is null or jsonb_typeof(proof)<>'object' or proof->>'authority' is distinct from 'LOCAL_OPERATOR_VERIFIED_V1'
  or proof->>'intentId' is distinct from i.id::text
  or proof->>'artifactSha256' is null or proof->>'artifactSha256' !~ '^[a-f0-9]{64}$'
  or (proof->>'checkedAt')::timestamptz>clock_timestamp()
  or (proof->>'checkedAt')::timestamptz<clock_timestamp()-interval '2 minutes'
  or proof->>'checkedAt' is null
  or proof->'signals' is distinct from '{"button":0,"durableMarker":0,"attemptPreference":0,"backendStart":0,"purchaseEnter":0,"transactionClaim":0,"transactions":0,"deliveries":0,"subscriptions":0,"assignments":0,"entitlements":0,"recovery":0,"ambiguous":false}'::jsonb
 then raise exception 'NEVER_STARTED_PROOF_REJECTED'; end if;
 -- Serialize with direct privileged writers too. An earlier committed writer
 -- becomes visible before the checks below; stale business CAS loses revision.
 lock table public.apple_intent_attempt_facts,public.apple_transactions,public.apple_deliveries,
 public.apple_subscriptions,public.apple_subscription_assignments,public.listing_promotion_entitlements,
 public.apple_expired_purchases,public.apple_challenges,public.apple_notification_events in share row exclusive mode;
 if exists(select 1 from public.apple_intent_attempt_facts where purchase_intent_id=i.id)
  or exists(select 1 from public.apple_transactions where app_account_token=i.app_account_token and environment=i.environment)
  or exists(select 1 from public.apple_deliveries where buyer_id=i.buyer_id and environment=i.environment)
  or exists(select 1 from public.apple_subscriptions where buyer_id=i.buyer_id and environment=i.environment)
  or exists(select 1 from public.apple_subscription_assignments where buyer_id=i.buyer_id and environment=i.environment)
  or exists(select 1 from public.listing_promotion_entitlements where listing_type=i.listing_type and listing_id=i.listing_id and environment=i.environment)
  or exists(select 1 from public.apple_expired_purchases where buyer_id=i.buyer_id and environment=i.environment)
  or exists(select 1 from public.apple_challenges where installation_id=i.originating_installation_id and purpose in ('purchase-recovery-v1','delivery-recovery-v1'))
  or exists(select 1 from public.apple_notification_events where environment=i.environment and status in ('received','processing','retry','quarantined'))
 then raise exception 'NEVER_STARTED_PURCHASE_EVIDENCE'; end if;
 t:=date_trunc('milliseconds',clock_timestamp());
 update public.apple_purchase_intents set status='failed',reconciliation_reason='WINDOW_EXPIRED_BEFORE_USER_PRESS' where id=i.id;
 update public.apple_slot_occupancies set state='released_never_started',updated_at=t where purchase_intent_id=i.id;
 select to_jsonb(x) into after_i from public.apple_purchase_intents x where id=i.id;
 select to_jsonb(x) into after_slot from public.apple_slot_occupancies x where purchase_intent_id=i.id;
 insert into public.apple_never_started_releases values(i.id,'Sandbox',to_jsonb(i),to_jsonb(slot),after_i,after_slot,proof,'WINDOW_EXPIRED_BEFORE_USER_PRESS',t,v);
 update public.apple_ledger_revision set revision=revision+1 where id=1;
 return true;
end; $$;

create or replace function public.apple_cancel_purchase(p_user uuid,p_key text,p_intent uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare i public.apple_purchase_intents; k public.apple_installation_keys; s public.apple_slot_occupancies;
begin
 perform public.lock_commercial_listings(coalesce((select jsonb_agg(jsonb_build_object('listing_type',listing_type,'listing_id',listing_id)) from public.apple_purchase_intents where id=p_intent),'[]'::jsonb));
 perform 1 from apple_ledger_revision where id=1 for update nowait;
 select * into k from apple_installation_keys where key_id=p_key and user_id=p_user and revoked_at is null;
 if not found then raise exception 'INSTALLATION_REJECTED'; end if;
 select * into i from apple_purchase_intents where id=p_intent and environment='Production' and originating_installation_id=k.installation_id for update;
 if not found then raise exception 'INTENT_REJECTED'; end if;
 if exists(select 1 from apple_cancelled_attempts where purchase_intent_id=i.id and installation_id=k.installation_id) then return jsonb_build_object('status','cancelled'); end if;
 select * into s from apple_slot_occupancies where purchase_intent_id=i.id and environment='Production' for update;
 if not found or i.status<>'purchasing' or i.started_at is null or i.completed_at is not null or s.state<>'purchasing' or s.subscription_id is not null
 or exists(select 1 from apple_transactions t where t.environment=i.environment and t.app_account_token=i.app_account_token and t.product_id=i.product_id and t.purchase_date>=i.started_at-interval '30 seconds')
 or exists(select 1 from apple_deliveries d where d.purchase_intent_id=i.id)
 or exists(select 1 from apple_subscription_assignments a where a.purchase_intent_id=i.id)
 then raise exception 'CANCELLATION_REQUIRES_EMPTY_ATTEMPT'; end if;
 insert into apple_cancelled_attempts values(i.id,k.installation_id,'Production','DEVICE_REPORTED_USER_CANCELLED',clock_timestamp());
 update apple_purchase_intents set status='canceled',reconciliation_reason='DEVICE_REPORTED_USER_CANCELLED' where id=i.id;
 update apple_slot_occupancies set state='released_cancelled',updated_at=clock_timestamp() where purchase_intent_id=i.id;
 update apple_ledger_revision set revision=revision+1 where id=1;
 return jsonb_build_object('status','cancelled');
end; $$;

create or replace function public.record_stripe_authority(p jsonb) returns text
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare old public.stripe_promotion_authority; prior jsonb; binding jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ONLY' using errcode='42501'; end if;
 if p->>'subscription_id' is null or p->>'event_id' is null or (p->>'event_created')::bigint<=0 then raise exception 'INVALID'; end if;
 perform public.lock_commercial_listings(jsonb_build_array(jsonb_build_object('listing_type',p->>'listing_type','listing_id',p->>'listing_id')));
 perform pg_advisory_xact_lock(hashtextextended('stripe-authority:'||(p->>'subscription_id'),0));
 select snapshot into prior from public.stripe_authority_receipts where event_id=p->>'event_id';
 if found then
   -- A retry may GET a newer current snapshot; it must not reapply the old event.
   return 'duplicate';
 end if;
 case p->>'listing_type'
 when 'business' then select to_jsonb(b) into binding from public.business_submissions b where id=(p->>'listing_id')::uuid;
 when 'job' then select to_jsonb(b) into binding from public.job_listings b where id=(p->>'listing_id')::uuid;
 when 'rental' then select to_jsonb(b) into binding from public.rental_listings b where id=(p->>'listing_id')::uuid;
 else raise exception 'BINDING_INVALID'; end case;
 if binding is null then raise exception 'BINDING_INVALID'; end if;
 if coalesce(binding->>'stripe_subscription_id','')<>'' and binding->>'stripe_subscription_id'<>p->>'subscription_id' then raise exception 'SUBSCRIPTION_MISMATCH'; end if;
 select * into old from public.stripe_promotion_authority where subscription_id=p->>'subscription_id' for update;
 if found then
  if old.listing_id<>(p->>'listing_id')::uuid or old.listing_type<>p->>'listing_type' or old.environment<>p->>'environment' then raise exception 'BINDING_IMMUTABLE'; end if;
  if old.status='canceled' or (p->>'event_created')::bigint<old.event_created then
   insert into public.stripe_authority_receipts values(p->>'event_id',p); return 'ignored';
  end if;
  if (p->>'event_created')::bigint=old.event_created then
   -- IDs are not an ordering sequence. Conflicting same-second evidence denies.
   if (p - 'event_id') is distinct from (old.snapshot - 'event_id') then
    update public.stripe_promotion_authority set ambiguous=true,
      status=case when p->>'status'='canceled' then 'canceled' else status end
      where subscription_id=old.subscription_id;
   end if;
   insert into public.stripe_authority_receipts values(p->>'event_id',p); return 'same_timestamp';
  end if;
 end if;
 insert into public.stripe_promotion_authority(subscription_id,listing_type,listing_id,environment,plan,status,period_end,cancel_at_period_end,event_created,event_id,snapshot)
 values(p->>'subscription_id',p->>'listing_type',(p->>'listing_id')::uuid,p->>'environment',p->>'plan',p->>'status',(p->>'period_end')::timestamptz,(p->>'cancel_at_period_end')::boolean,(p->>'event_created')::bigint,p->>'event_id',p)
 on conflict(subscription_id) do update set plan=excluded.plan,status=excluded.status,period_end=excluded.period_end,cancel_at_period_end=excluded.cancel_at_period_end,event_created=excluded.event_created,event_id=excluded.event_id,snapshot=excluded.snapshot,ambiguous=false;
 insert into public.stripe_authority_receipts values(p->>'event_id',p);
 return 'applied';
end $$;

create function public.commercial_cross_provider_conflict(p_kind text,p_id uuid,p_provider text) returns boolean
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select case when p_provider='stripe' then exists(
  select 1 from public.listing_promotion_entitlements where listing_type=p_kind and listing_id=p_id and provider='apple' and environment='Production' and status in ('active','active_nonrenewing','grace') and valid_from<=now() and valid_until>now())
 when p_provider='apple' then exists(
  select 1 from public.stripe_promotion_authority where listing_type=p_kind and listing_id=p_id and environment='Production' and (status not in ('canceled','incomplete_expired') or ambiguous))
  or exists(select 1 from public.listing_promotion_entitlements where listing_type=p_kind and listing_id=p_id and provider='stripe' and environment='Production' and status in ('active','active_nonrenewing','grace') and valid_from<=now() and valid_until>now())
  or exists(select 1 from (
    select 'business' kind,id,stripe_subscription_id from public.business_submissions union all
    select 'job',id,stripe_subscription_id from public.job_listings union all
    select 'rental',id,stripe_subscription_id from public.rental_listings
  ) x where kind=p_kind and id=p_id and coalesce(stripe_subscription_id,'')<>'')
 else true end;
$$;
revoke all on function public.commercial_cross_provider_conflict(text,uuid,text) from public,anon,authenticated,service_role;

create function public.commercial_cross_provider_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare provider_name text;
begin
 if TG_TABLE_NAME='stripe_promotion_authority' then provider_name:='stripe';
 else provider_name:=new.provider; end if;
 if new.environment='Production' and provider_name in ('apple','stripe') and new.status in ('active','active_nonrenewing','grace') and public.commercial_cross_provider_conflict(new.listing_type,new.listing_id,provider_name) then
  raise exception 'PAID_PROVIDER_RECONCILIATION_REQUIRED';
 end if;
 return new;
end $$;
revoke all on function public.commercial_cross_provider_guard() from public,anon,authenticated,service_role;
create trigger ab_commercial_cross_provider before insert or update on public.stripe_promotion_authority for each row execute function public.commercial_cross_provider_guard();
create trigger ab_commercial_cross_provider before insert or update on public.listing_promotion_entitlements for each row execute function public.commercial_cross_provider_guard();

-- Single-listing REST PATCH already owns the canonical Business row lock.
-- Do not let an older display-only Admin route reintroduce COMP over a binding.
create function public.commercial_business_projection_guard() returns trigger
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if (new.plan,new.placement_source,new.placement_expires_at) is distinct from (old.plan,old.placement_source,old.placement_expires_at)
  and new.placement_source='comp' and public.admin_comp_payment_conflict(old.id) then raise exception 'PAID_PROVIDER_BOUND'; end if;
 if (new.stripe_subscription_id,new.stripe_session_id,new.stripe_payment_intent_id,new.stripe_customer_id) is distinct from
    (old.stripe_subscription_id,old.stripe_session_id,old.stripe_payment_intent_id,old.stripe_customer_id)
  and (coalesce(new.stripe_subscription_id,'')<>'' or coalesce(new.stripe_session_id,'')<>'' or coalesce(new.stripe_payment_intent_id,'')<>'')
  and public.commercial_cross_provider_conflict('business',new.id,'stripe') then raise exception 'PAID_PROVIDER_RECONCILIATION_REQUIRED'; end if;
 return new;
end $$;
revoke all on function public.commercial_business_projection_guard() from public,anon,authenticated,service_role;
create trigger commercial_business_projection_guard before update on public.business_submissions for each row execute function public.commercial_business_projection_guard();

-- Canonical ordering for legacy webhook updates matched by subscription. Only
-- existing server-held credentials may invoke this narrow RPC. No arbitrary SQL.
create function public.stripe_patch_business(p_id uuid,p_subscription text,p_changes jsonb) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare ids uuid[]; x uuid; r public.business_submissions;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ONLY' using errcode='42501'; end if;
 if (p_id is null)=(p_subscription is null) or p_changes is null or jsonb_typeof(p_changes)<>'object' or exists(select 1 from jsonb_object_keys(p_changes) k where k not in ('payment_status','stripe_session_id','stripe_payment_intent_id','stripe_customer_id','stripe_subscription_id','paid_at','placement_expires_at')) then raise exception 'STRIPE_PATCH_INVALID'; end if;
 select array_agg(id order by id) into ids from public.business_submissions where (p_id is not null and id=p_id) or (p_subscription is not null and stripe_subscription_id=p_subscription);
 perform public.lock_commercial_listings(coalesce((select jsonb_agg(jsonb_build_object('listing_type','business','listing_id',id)) from unnest(ids) id),'[]'::jsonb));
 foreach x in array coalesce(ids,array[]::uuid[]) loop
  -- Recheck subscription binding after waiting; never mutate a rebound row.
  select b.* into r from public.business_submissions b where b.id=x and (p_id is not null or b.stripe_subscription_id=p_subscription);
  if not found then raise exception 'STRIPE_BINDING_CHANGED'; end if;
  r:=jsonb_populate_record(r,p_changes);
  update public.business_submissions set payment_status=r.payment_status,stripe_session_id=r.stripe_session_id,stripe_payment_intent_id=r.stripe_payment_intent_id,stripe_customer_id=r.stripe_customer_id,stripe_subscription_id=r.stripe_subscription_id,paid_at=r.paid_at,placement_expires_at=r.placement_expires_at where id=x;
 end loop;
end $$;
revoke all on function public.stripe_patch_business(uuid,text,jsonb) from public,anon,authenticated,service_role;
grant execute on function public.stripe_patch_business(uuid,text,jsonb) to service_role;

-- All newly created internal helpers are inaccessible regardless of creator defaults.
alter function public.lock_commercial_listings(jsonb,boolean) owner to postgres;
alter function public.commercial_apple_ledger_guard() owner to postgres;
alter function public.commercial_stripe_receipt_guard() owner to postgres;
alter function public.commercial_paid_priority(uuid,text,text,timestamptz) owner to postgres;
alter function public.commercial_payment_record_guard() owner to postgres;
alter function public.commercial_provider_row_guard() owner to postgres;
alter function public.commercial_paid_row_projection() owner to postgres;
alter function public.commercial_apple_delta(jsonb,text) owner to postgres;
alter function public.commercial_apple_listings(jsonb,jsonb) owner to postgres;
alter function public.commercial_cross_provider_conflict(text,uuid,text) owner to postgres;
alter function public.commercial_cross_provider_guard() owner to postgres;
alter function public.commercial_business_projection_guard() owner to postgres;
alter function public.stripe_patch_business(uuid,text,jsonb) owner to postgres;
-- Administrative stage metadata only; no verifier identity or evidence registration.
create schema commercial_deploy authorization postgres;
revoke all on schema commercial_deploy from public,anon,authenticated,service_role;
create table commercial_deploy.protocol(
 singleton boolean primary key default true check(singleton),
 protocol_version integer not null default 1 check(protocol_version=1),
 nonce uuid not null unique default gen_random_uuid(),
 installed_at timestamptz not null default clock_timestamp(),
 expected_project text not null default 'ymgiwjuhgvfexitynmtb',
 expected_function text not null default 'stripe-webhook',
 definitions jsonb not null,
 triggers jsonb not null,
 activated_at timestamptz
);
alter table commercial_deploy.protocol owner to postgres;
alter table commercial_deploy.protocol enable row level security;
revoke all on commercial_deploy.protocol from public,anon,authenticated,service_role;
-- Bind the installed coordinated definitions and trigger wiring, not remote Edge.
insert into commercial_deploy.protocol(definitions,triggers)
select (select jsonb_object_agg(p.oid::regprocedure::text,md5(pg_get_functiondef(p.oid)))
 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('lock_commercial_listings','commercial_paid_priority','commercial_payment_record_guard','commercial_provider_row_guard','commercial_apple_ledger_guard','commercial_stripe_receipt_guard','commercial_paid_row_projection','commercial_apple_delta','commercial_apple_listings','apple_ledger_compare_and_swap','apple_ledger_compare_and_swap_production','apple_bootstrap_complete','apple_renew_existing_purchase_permissions','apple_release_never_started','apple_cancel_purchase','record_stripe_authority','commercial_cross_provider_conflict','commercial_cross_provider_guard','commercial_business_projection_guard','stripe_patch_business','grant_admin_comp','revoke_admin_comp','admin_comp_lock_payment_sources','admin_comp_payment_conflict')),
 (select jsonb_object_agg(t.tgrelid::regclass::text||'.'||t.tgname,
 jsonb_build_object('definition',pg_get_triggerdef(t.oid),'enabled',t.tgenabled))
 from pg_trigger t where not t.tgisinternal and t.tgname like '%commercial%');
commit;
