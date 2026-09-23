-- Fase72 LOCAL corrective migration. Function definitions only; no data writes.
begin;
create or replace function public.apple_ledger_snapshot()
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result jsonb := '{}'::jsonb; spec text[]; pairs text[][] := array[
 ['buyers','apple_buyers'],['installations','apple_installations'],['capabilities','apple_session_capabilities'],['challenges','apple_challenges'],
 ['catalog','apple_product_catalog'],['grants','apple_listing_authorizations'],['intents','apple_purchase_intents'],['slots','apple_slot_occupancies'],
 ['subscriptions','apple_subscriptions'],['assignments','apple_subscription_assignments'],['transactions','apple_transactions'],
 ['notifications','apple_notification_events'],['entitlements','listing_promotion_entitlements'],['deliveries','apple_deliveries']];
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
 ['entitlements','listing_promotion_entitlements','id'],['deliveries','apple_deliveries','id']];
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
