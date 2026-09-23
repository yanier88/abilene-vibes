-- Phase102: additive local-only expired purchase ledger. Never applied to live DB here.
begin;
alter table public.apple_slot_occupancies drop constraint apple_slot_occupancies_state_check;
alter table public.apple_slot_occupancies add constraint apple_slot_occupancies_state_check
 check(state in ('reserved','purchasing','occupied','reconciliation','released_expired'));
alter table public.apple_slot_occupancies drop constraint apple_slot_occupancies_environment_listing_type_listing_id_key;
create unique index apple_live_listing_slot on public.apple_slot_occupancies(environment,listing_type,listing_id) where state<>'released_expired';
create table public.apple_expired_purchases (
 id uuid primary key,
 provider text not null check(provider='apple'),
 environment text not null check(environment='Sandbox'),
 bundle_id text not null check(bundle_id='com.abilenevibes.app'),
 transaction_id text not null check(transaction_id ~ '^[0-9]{1,128}$'),
 original_transaction_id text not null check(original_transaction_id ~ '^[0-9]{1,128}$'),
 buyer_id uuid not null,
 installation_id uuid not null,
 listing_type text not null check(listing_type in ('business','job','rental')),
 listing_id uuid not null,
 app_account_token uuid not null,
 app_transaction_id text not null,
 product_id text not null,
 subscription_group_id text not null,
 purchase_date timestamptz not null,
 signed_date timestamptz not null,
 expiration_date timestamptz not null,
 purchase_intent_id uuid not null unique references public.apple_purchase_intents(id),
 evidence_sha256 text not null check(evidence_sha256 ~ '^[a-f0-9]{64}$'),
 app_evidence_sha256 text not null check(app_evidence_sha256 ~ '^[a-f0-9]{64}$'),
 verification_status text not null check(verification_status='verified'),
 commercial_status text not null check(commercial_status='expired_undelivered'),
 reason text not null check(reason='PERIOD_EXPIRED_BEFORE_DURABLE_DELIVERY'),
 created_at timestamptz not null,
 reconciled_at timestamptz not null,
 unique(bundle_id,environment,transaction_id),
 unique(bundle_id,environment,original_transaction_id),
 foreign key(installation_id,buyer_id,environment) references public.apple_installations(installation_id,buyer_id,environment),
 foreign key(buyer_id,app_account_token,environment) references public.apple_buyers(id,app_account_token,environment),
 foreign key(environment,product_id,bundle_id,subscription_group_id) references public.apple_product_catalog(environment,product_id,bundle_id,subscription_group_id),
 check(expiration_date>purchase_date and expiration_date<=reconciled_at and signed_date>=purchase_date)
);
alter table public.apple_expired_purchases enable row level security;
create trigger apple_expired_purchase_no_delete before delete on public.apple_expired_purchases
 for each row execute function public.apple_reject_delete();
revoke all on public.apple_expired_purchases from public,anon,authenticated,service_role;
create function public.apple_expired_purchase_guard() returns trigger language plpgsql
set search_path=pg_catalog,public,pg_temp as $$
begin
 if TG_OP='UPDATE' and to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'EXPIRED_PURCHASE_IMMUTABLE'; end if;
 if not exists(select 1 from public.apple_purchase_intents i where i.id=new.purchase_intent_id
  and i.status='reconciliation' and i.reconciliation_reason='VERIFIED_EXPIRED_UNDELIVERED'
  and i.completed_at is null and i.buyer_id=new.buyer_id and i.originating_installation_id=new.installation_id
  and i.app_account_token=new.app_account_token and i.listing_id=new.listing_id and i.listing_type=new.listing_type
  and i.bundle_id=new.bundle_id and i.environment=new.environment and i.product_id=new.product_id and i.subscription_group_id=new.subscription_group_id)
 then raise exception 'EXPIRED_PURCHASE_BINDING'; end if;
 if exists(select 1 from public.apple_transactions t where t.bundle_id=new.bundle_id and t.environment=new.environment and t.transaction_id=new.transaction_id)
 or exists(select 1 from public.apple_deliveries d where d.purchase_intent_id=new.purchase_intent_id)
 then raise exception 'EXPIRED_PURCHASE_DELIVERY_CONFLICT'; end if;
 return new;
end; $$;
create trigger apple_expired_purchase_guard before insert or update on public.apple_expired_purchases
 for each row execute function public.apple_expired_purchase_guard();
create function public.apple_expired_delivery_guard() returns trigger language plpgsql
set search_path=pg_catalog,public,pg_temp as $$
begin
 if exists(select 1 from public.apple_expired_purchases p where p.bundle_id=new.bundle_id and p.environment=new.environment and p.transaction_id=new.transaction_id)
 then raise exception 'TRANSACTION_RECONCILED_EXPIRED'; end if;
 return new;
end; $$;
create trigger apple_expired_delivery_guard before insert or update on public.apple_transactions
 for each row execute function public.apple_expired_delivery_guard();
revoke all on function public.apple_expired_purchase_guard() from public,anon,authenticated,service_role;
revoke all on function public.apple_expired_delivery_guard() from public,anon,authenticated,service_role;
create function public.apple_released_slot_guard() returns trigger language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
begin
 if new.state='released_expired' and not exists(select 1 from public.apple_expired_purchases p
  where p.purchase_intent_id=new.purchase_intent_id and p.buyer_id=new.buyer_id and p.environment=new.environment)
 then raise exception 'EXPIRED_RELEASE_REQUIRES_RECORD'; end if;
 return new;
end; $$;
create constraint trigger apple_released_slot_guard after insert or update on public.apple_slot_occupancies
 deferrable initially deferred for each row execute function public.apple_released_slot_guard();
revoke all on function public.apple_released_slot_guard() from public,anon,authenticated,service_role;
-- A released occupancy may be reused, but its old intent and financial record
-- remain immutable. All other ownership/binding transitions retain the old rule.
create function public.apple_slot_reuse_guard() returns trigger language plpgsql
set search_path=pg_catalog,public,pg_temp as $$
begin
 if row(new.buyer_id,new.environment,new.slot_number) is distinct from row(old.buyer_id,old.environment,old.slot_number)
 then raise exception 'IMMUTABLE_APPLE_BINDING'; end if;
 if old.state='released_expired' and new.state='reserved' and old.subscription_id is null and new.subscription_id is null
 and old.purchase_intent_id<>new.purchase_intent_id
 and exists(select 1 from public.apple_expired_purchases p where p.purchase_intent_id=old.purchase_intent_id and p.buyer_id=old.buyer_id and p.environment=old.environment)
 and exists(select 1 from public.apple_purchase_intents i where i.id=new.purchase_intent_id and i.status='reserved'
  and i.buyer_id=new.buyer_id and i.environment=new.environment and i.slot_number=new.slot_number
  and i.listing_type=new.listing_type and i.listing_id=new.listing_id and i.originating_installation_id is not null)
 then return new; end if;
 if row(new.listing_type,new.listing_id,new.purchase_intent_id) is distinct from row(old.listing_type,old.listing_id,old.purchase_intent_id)
 then raise exception 'IMMUTABLE_APPLE_BINDING'; end if;
 return new;
end; $$;
drop trigger apple_slot_binding on public.apple_slot_occupancies;
create trigger apple_slot_binding before update on public.apple_slot_occupancies
 for each row execute function public.apple_slot_reuse_guard();
revoke all on function public.apple_slot_reuse_guard() from public,anon,authenticated,service_role;
create or replace function public.apple_recovery_consumption_guard()
returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if TG_OP='UPDATE' and old.purpose in ('delivery-recovery-v1','purchase-recovery-v1') and to_jsonb(new) is distinct from to_jsonb(old)
 then raise exception 'RECOVERY_AUTHORIZATION_IMMUTABLE'; end if;
 if new.purpose in ('delivery-recovery-v1','purchase-recovery-v1') and
  (new.installation_id is null or new.consumed_at is null or new.expires_at<=new.consumed_at or new.request_digest !~ '^[a-f0-9]{64}$')
 then raise exception 'RECOVERY_AUTHORIZATION_INVALID'; end if;
 return new;
end; $$;
create or replace function public.apple_ledger_snapshot()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb := '{}'::jsonb; spec text[]; pairs text[][] := array[
 ['buyers','apple_buyers'],['installations','apple_installations'],['capabilities','apple_session_capabilities'],['challenges','apple_challenges'],
 ['catalog','apple_product_catalog'],['grants','apple_listing_authorizations'],['intents','apple_purchase_intents'],['slots','apple_slot_occupancies'],
 ['subscriptions','apple_subscriptions'],['assignments','apple_subscription_assignments'],['transactions','apple_transactions'],
 ['notifications','apple_notification_events'],['entitlements','listing_promotion_entitlements'],['deliveries','apple_deliveries'],['expired_purchases','apple_expired_purchases']];
 rows jsonb; v bigint; date_col record;
begin
 select revision into v from public.apple_ledger_revision where id=1 for share;
 foreach spec slice 1 in array pairs loop
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where environment=''Sandbox''%s',spec[2],case when spec[1]='entitlements' then ' and provider=''apple''' else '' end) into rows;
  -- Domain/Apple facts use JavaScript ISO milliseconds; PostgreSQL JSON otherwise
  -- emits +00:00 and drops .000, breaking strict replay equality after persistence.
  for date_col in select attname from pg_attribute where attrelid=format('public.%I',spec[2])::regclass and atttypid='timestamptz'::regtype and attnum>0 and not attisdropped loop
   select coalesce(jsonb_agg(x || jsonb_build_object(date_col.attname,
    to_char((x->>date_col.attname)::timestamptz at time zone 'UTC','YYYY-MM-DD"T"HH24:MI:SS.MS"Z"'))),'[]'::jsonb)
   into rows from jsonb_array_elements(rows) x;
  end loop;
  result:=jsonb_set(result,array[spec[1]],rows);
 end loop;
 -- Existing listings are read only. Unknown/pending Stripe financial state blocks prepare.
 select coalesce(jsonb_agg(jsonb_build_object('listing_type',kind,'listing_id',record_json->>'id','status',record_json->>'status',
  'stripe_conflict',coalesce(record_json->>'stripe_subscription_id','')<>'' or coalesce(record_json->>'payment_status','') in ('pending','checkout_started','paid','cancel_pending') or coalesce(record_json->>'placement_source','') in ('stripe','paid') or exists(select 1 from public.listing_promotion_entitlements e where e.environment='Sandbox' and e.provider='stripe' and e.listing_type=kind and e.listing_id::text=record_json->>'id' and e.status in ('active','active_nonrenewing','grace') and e.valid_from<=clock_timestamp() and e.valid_until>clock_timestamp()))),'[]'::jsonb)
 into rows from (
  select 'business' kind,to_jsonb(b) record_json from public.business_submissions b
  union all select 'job',to_jsonb(j) from public.job_listings j
  union all select 'rental',to_jsonb(r) from public.rental_listings r
 ) listings;
 result:=jsonb_set(result,array['listings'],rows);
 return jsonb_build_object('version',v,'state',result);
end; $$;

create or replace function public.apple_ledger_compare_and_swap(expected_version bigint, next_state jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare v bigint; spec text[]; payload jsonb; columns_sql text; updates_sql text; pk_sql text;
 pairs text[][] := array[
 ['buyers','apple_buyers','id'],['installations','apple_installations','installation_id'],['capabilities','apple_session_capabilities','id'],['challenges','apple_challenges','id'],
 ['catalog','apple_product_catalog','environment,product_id'],['grants','apple_listing_authorizations','id'],['intents','apple_purchase_intents','id'],
 ['subscriptions','apple_subscriptions','id'],['assignments','apple_subscription_assignments','id'],['slots','apple_slot_occupancies','buyer_id,environment,slot_number'],
 ['transactions','apple_transactions','bundle_id,environment,transaction_id'],['notifications','apple_notification_events','id'],
 ['entitlements','listing_promotion_entitlements','id'],['deliveries','apple_deliveries','id'],['expired_purchases','apple_expired_purchases','id']];
begin
 select revision into v from public.apple_ledger_revision where id=1 for update;
 if expected_version is null or next_state is null or jsonb_typeof(next_state)<>'object' then raise exception 'INVALID_STATE'; end if;
 if v<>expected_version then return false; end if;
 -- Serialize with entitlement writers while checking new Apple work. No foreign
 -- provider row is changed. Existing unrelated Apple rows do not block this CAS.
 lock table public.listing_promotion_entitlements in share row exclusive mode;
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
  payload:=next_state->spec[1];
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
end; $$;


revoke all on function public.apple_ledger_snapshot() from public,anon,authenticated;
revoke all on function public.apple_ledger_compare_and_swap(bigint,jsonb) from public,anon,authenticated;
grant execute on function public.apple_ledger_snapshot() to service_role;
grant execute on function public.apple_ledger_compare_and_swap(bigint,jsonb) to service_role;
commit;
