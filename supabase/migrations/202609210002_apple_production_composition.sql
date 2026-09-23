-- Fase112: Production-scoped RPCs. Existing Sandbox functions remain unchanged.
begin;

create or replace function public.apple_ledger_snapshot_production()
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
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where environment=''Production''%s',spec[2],case when spec[1]='entitlements' then ' and provider=''apple''' else '' end) into rows;
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
  'stripe_conflict',coalesce(record_json->>'stripe_subscription_id','')<>'' or coalesce(record_json->>'payment_status','') in ('pending','checkout_started','paid','cancel_pending') or coalesce(record_json->>'placement_source','')='stripe' or exists(select 1 from public.listing_promotion_entitlements e where e.environment='Production' and e.provider='stripe' and e.listing_type=kind and e.listing_id::text=record_json->>'id' and e.status in ('active','active_nonrenewing','grace') and e.valid_from<=clock_timestamp() and e.valid_until>clock_timestamp()))),'[]'::jsonb)
 into rows from (
  select 'business' kind,to_jsonb(b) record_json from public.business_submissions b
  union all select 'job',to_jsonb(j) from public.job_listings j
  union all select 'rental',to_jsonb(r) from public.rental_listings r
 ) listings;
 result:=jsonb_set(result,array['listings'],rows);
 return jsonb_build_object('version',v,'state',result);
end; $$;

create or replace function public.apple_ledger_compare_and_swap_production(expected_version bigint, next_state jsonb)
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
   where e.environment='Production' and e.provider='stripe'
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
end; $$;

create function public.apple_ledger_compare_and_swap_verified_production(
 expected_version bigint, next_state jsonb, verification_not_after timestamptz
) returns boolean language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
declare applied boolean;
begin
 if verification_not_after is null or verification_not_after <= clock_timestamp()
    or verification_not_after > clock_timestamp()+interval '60 seconds' then
   raise exception 'VERIFICATION_EXPIRED_AT_COMMIT';
 end if;
 applied:=public.apple_ledger_compare_and_swap_production(expected_version,next_state);
 -- If waiting for the revision lock/writing consumed the window, raising rolls
 -- back ALL writes from the nested function in this transaction.
 if verification_not_after <= clock_timestamp() then
   raise exception 'VERIFICATION_EXPIRED_AT_COMMIT';
 end if;
 return applied;
end; $$;
revoke all on function public.apple_ledger_snapshot_production(),public.apple_ledger_compare_and_swap_production(bigint,jsonb),public.apple_ledger_compare_and_swap_verified_production(bigint,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.apple_ledger_snapshot_production(),public.apple_ledger_compare_and_swap_production(bigint,jsonb),public.apple_ledger_compare_and_swap_verified_production(bigint,jsonb,timestamptz) to service_role;

update public.apple_product_catalog set enabled=true,subscription_group_id='22382531'
 where environment='Production' and slot_number=1 and product_id in (
 'com.abilenevibes.app.promotion.slot01.featured.monthly','com.abilenevibes.app.promotion.slot01.premium.monthly');

create table public.apple_advertiser_buyers (
 user_id uuid not null references public.advertiser_profiles(user_id),
 environment text not null check(environment='Production'),
 buyer_id uuid not null unique references public.apple_buyers(id),
 primary key(user_id,environment)
);
create table public.apple_installation_keys (
 key_id text primary key check(key_id ~ '^[a-f0-9]{64}$'),
 user_id uuid not null references auth.users(id),
 public_spki text not null check(length(public_spki)<1024),
 installation_id uuid not null unique references public.apple_installations(installation_id),
 revoked_at timestamptz
);
create table public.apple_bootstrap_challenges (
 id uuid primary key default gen_random_uuid(),user_id uuid not null references auth.users(id),
 key_id text not null,public_spki text not null,nonce text not null unique,
 created_at timestamptz not null default clock_timestamp(),expires_at timestamptz not null,
 consumed_at timestamptz,check(expires_at>created_at)
);
create table public.apple_installation_request_nonces (
 key_id text not null references public.apple_installation_keys(key_id),nonce uuid not null,
 created_at timestamptz not null default clock_timestamp(),primary key(key_id,nonce)
);
alter table public.apple_advertiser_buyers enable row level security;
alter table public.apple_installation_keys enable row level security;
alter table public.apple_bootstrap_challenges enable row level security;
alter table public.apple_installation_request_nonces enable row level security;
revoke all on public.apple_advertiser_buyers,public.apple_installation_keys,public.apple_bootstrap_challenges,public.apple_installation_request_nonces from public,anon,authenticated;
grant all on public.apple_advertiser_buyers,public.apple_installation_keys,public.apple_bootstrap_challenges,public.apple_installation_request_nonces to service_role;

create function public.apple_bootstrap_challenge(p_user uuid,p_key text,p_spki text)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare c public.apple_bootstrap_challenges;
begin
 if p_key !~ '^[a-f0-9]{64}$' or length(p_spki)>1024 then raise exception 'INSTALLATION_KEY_INVALID';end if;
 if (select count(*) from public.apple_bootstrap_challenges where user_id=p_user and created_at>clock_timestamp()-interval '1 minute')>=10 then raise exception 'RATE_LIMIT';end if;
 insert into public.apple_bootstrap_challenges(user_id,key_id,public_spki,nonce,expires_at)
 values(p_user,p_key,p_spki,replace(gen_random_uuid()::text,'-','')||replace(gen_random_uuid()::text,'-',''),clock_timestamp()+interval '2 minutes') returning * into c;
 return jsonb_build_object('challenge_id',c.id,'nonce',c.nonce,'expires_at',c.expires_at);
end; $$;

create function public.apple_bootstrap_complete(p_user uuid,p_challenge uuid,p_app_transaction text,p_listing_type text,p_listing uuid,p_not_after timestamptz)
returns jsonb language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare c public.apple_bootstrap_challenges; b public.apple_buyers; i public.apple_installations; k public.apple_installation_keys;
 profile_token uuid; owner_id uuid; listing_status text; secret text; t timestamptz; cap uuid;
begin
 perform 1 from public.apple_ledger_revision where id=1 for update;
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

create function public.apple_consume_installation_nonce(p_user uuid,p_key text,p_nonce uuid,p_issued bigint)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if abs(extract(epoch from clock_timestamp())*1000-p_issued)>120000 then raise exception 'REQUEST_EXPIRED';end if;
 if not exists(select 1 from public.apple_installation_keys k join public.apple_installations i on i.installation_id=k.installation_id where k.key_id=p_key and k.user_id=p_user and k.revoked_at is null and i.revoked_at is null) then raise exception 'INSTALLATION_REJECTED';end if;
 insert into public.apple_installation_request_nonces(key_id,nonce) values(p_key,p_nonce);return true;
end; $$;
revoke all on function public.apple_bootstrap_challenge(uuid,text,text),public.apple_bootstrap_complete(uuid,uuid,text,text,uuid,timestamptz),public.apple_consume_installation_nonce(uuid,text,uuid,bigint) from public,anon,authenticated;
grant execute on function public.apple_bootstrap_challenge(uuid,text,text),public.apple_bootstrap_complete(uuid,uuid,text,text,uuid,timestamptz),public.apple_consume_installation_nonce(uuid,text,uuid,bigint) to service_role;
commit;
