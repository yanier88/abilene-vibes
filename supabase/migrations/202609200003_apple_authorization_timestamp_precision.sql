-- Phase104. Additive function changes; historical timestamp values stay exact.
begin;
-- New authorization rows use UTC millisecond precision. Upsert candidates for an
-- existing identity are not rounded: the unchanged immutability guard checks them.
create function public.apple_authorization_canonical_write() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if not exists(select 1 from public.apple_listing_authorizations where id=new.id) then
  if new.created_at>clock_timestamp() then raise exception 'AUTHORIZATION_FUTURE_ISSUANCE'; end if;
  new.created_at:=date_trunc('milliseconds',new.created_at);
  new.expires_at:=date_trunc('milliseconds',new.expires_at);
  new.revoked_at:=date_trunc('milliseconds',new.revoked_at);
 end if;
 return new;
end; $$;
create trigger apple_authorization_canonical_write before insert
 on public.apple_listing_authorizations for each row execute function public.apple_authorization_canonical_write();
revoke all on function public.apple_authorization_canonical_write() from public,anon,authenticated,service_role;
-- Only authorization/capability legacy values may retain submillisecond precision
-- in their JSON string. JavaScript must preserve those strings through CAS.
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
    to_char((x->>date_col.attname)::timestamptz at time zone 'UTC',
     case when spec[1] in ('grants','capabilities')
       and (x->>date_col.attname)::timestamptz <> date_trunc('milliseconds',(x->>date_col.attname)::timestamptz)
     then 'YYYY-MM-DD"T"HH24:MI:SS.US"Z"' else 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"' end))),'[]'::jsonb)
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

create or replace function public.apple_renew_existing_purchase_permissions(intent_id uuid)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare i public.apple_purchase_intents; b public.apple_buyers;
 t timestamptz; deadline timestamptz; secret text; cap_id uuid; grant_id uuid; listing_ok boolean;
begin
 -- Same lock order as the ledger CAS; prevents a stale CAS from losing new rows.
 perform 1 from public.apple_ledger_revision where id=1 for update;
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
commit;
