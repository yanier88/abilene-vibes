-- PHASE 39 — NOT APPLIED TO PRODUCTION. Local PostgreSQL validation only. No production authorization.
-- Additive, transactional, no business/Stripe writes, no auth.users identity.
begin;

create table public.apple_buyers (
 id uuid primary key default gen_random_uuid(), app_account_token uuid not null unique default gen_random_uuid(),
 app_transaction_id text, bundle_id text not null check(bundle_id='com.abilenevibes.app'),
 environment text not null check(environment in ('Sandbox','Production')),
 status text not null check(status in ('provisional','active','revoked')),
 created_at timestamptz not null default now(), last_verified_at timestamptz,
 unique(bundle_id,environment,app_transaction_id), unique(id,environment),
 check(status<>'active' or app_transaction_id is not null)
);
create table public.apple_installations (
 installation_id uuid primary key default gen_random_uuid(), buyer_id uuid,
 key_id text not null, attestation_status text not null check(attestation_status in ('provisional','verified','revoked')),
 environment text not null check(environment in ('Sandbox','Production')), created_at timestamptz not null default now(),
 last_seen_at timestamptz, revoked_at timestamptz, unique(environment,key_id), unique(installation_id,buyer_id,environment),
 foreign key(buyer_id,environment) references public.apple_buyers(id,environment)
);
create table public.apple_session_capabilities (
 id uuid primary key default gen_random_uuid(), token_hash text not null unique check(token_hash ~ '^[a-f0-9]{64}$'),
 buyer_id uuid not null, installation_id uuid not null, environment text not null,
 scope text[] not null check(scope <@ array['prepare','verify','reconcile']::text[]),
 expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now(),
 foreign key(installation_id,buyer_id,environment) references public.apple_installations(installation_id,buyer_id,environment),
 check(expires_at>created_at)
);
create table public.apple_challenges (
 id uuid primary key default gen_random_uuid(), nonce_hash text not null unique check(nonce_hash ~ '^[a-f0-9]{64}$'),
 installation_id uuid references public.apple_installations(installation_id),
 environment text not null check(environment in ('Sandbox','Production')), purpose text not null,
 request_digest text not null, expires_at timestamptz not null, consumed_at timestamptz, created_at timestamptz not null default now()
);
create table public.apple_product_catalog (
 product_id text not null, slot_number integer not null check(slot_number between 1 and 10),
 plan text not null check(plan in ('featured','premium')), subscription_group_id text,
 bundle_id text not null check(bundle_id='com.abilenevibes.app'), environment text not null check(environment in ('Sandbox','Production')),
 enabled boolean not null default false, created_at timestamptz not null default now(),
 primary key(environment,product_id), unique(environment,slot_number,plan), unique(environment,subscription_group_id,plan),
 check(product_id=bundle_id||'.promotion.slot'||lpad(slot_number::text,2,'0')||'.'||plan||'.monthly'),
 check(not enabled or subscription_group_id is not null)
);
insert into public.apple_product_catalog(product_id,slot_number,plan,bundle_id,environment)
 select 'com.abilenevibes.app.promotion.slot'||lpad(n::text,2,'0')||'.'||p||'.monthly',n,p,'com.abilenevibes.app',e
 from generate_series(1,10) n cross join unnest(array['featured','premium']) p cross join unnest(array['Sandbox','Production']) e;

-- Server-authenticated listing authorization, never client legacy owner_user_id.
-- No public endpoint grants ownership. Future attested creation/recovery must populate this.
create table public.apple_listing_authorizations (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null, environment text not null,
 listing_type text not null check(listing_type in ('business','job','rental')), listing_id uuid not null,
 expires_at timestamptz not null, revoked_at timestamptz, created_at timestamptz not null default now(),
 unique(buyer_id,environment,listing_type,listing_id), foreign key(buyer_id,environment) references public.apple_buyers(id,environment)
);
create table public.apple_purchase_intents (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null, listing_type text not null check(listing_type in ('business','job','rental')),
 listing_id uuid not null, requested_plan text not null check(requested_plan in ('featured','premium')),
 slot_number integer not null check(slot_number between 1 and 10), product_id text not null, environment text not null,
 idempotency_key text not null check(length(idempotency_key) between 1 and 128),
 status text not null check(status in ('reserved','purchasing','pending','verifying','completed','canceled','failed','reconciliation')),
 created_at timestamptz not null default now(), expires_at timestamptz not null, started_at timestamptz, completed_at timestamptz, reconciliation_reason text,
 unique(buyer_id,environment,idempotency_key), unique(id,buyer_id,environment),
 foreign key(buyer_id,environment) references public.apple_buyers(id,environment),
 foreign key(environment,product_id) references public.apple_product_catalog(environment,product_id)
);
create table public.apple_subscriptions (
 id uuid primary key default gen_random_uuid(), buyer_id uuid not null, bundle_id text not null check(bundle_id='com.abilenevibes.app'),
 environment text not null, slot_number integer not null check(slot_number between 1 and 10), product_id text not null,
 plan text not null check(plan in ('featured','premium')), subscription_group_id text not null,
 original_transaction_id text not null, current_transaction_id text not null,
 status text not null check(status in ('active','active_nonrenewing','grace','billing_retry','expired','revoked','reconciliation')),
 auto_renew_enabled boolean, period_start timestamptz not null, period_end timestamptz not null, grace_period_expires_at timestamptz,
 verified_at timestamptz not null, last_reconciled_at timestamptz, created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 last_event_signed_date bigint not null default 0,
 unique(bundle_id,environment,original_transaction_id), unique(id,buyer_id,environment), unique(buyer_id,environment,slot_number),
 foreign key(buyer_id,environment) references public.apple_buyers(id,environment),
 foreign key(environment,product_id) references public.apple_product_catalog(environment,product_id), check(period_end>period_start)
);
create table public.apple_subscription_assignments (
 id uuid primary key default gen_random_uuid(), subscription_id uuid not null unique, buyer_id uuid not null,
 slot_number integer not null check(slot_number between 1 and 10), environment text not null,
 listing_type text not null check(listing_type in ('business','job','rental')), listing_id uuid not null,
 purchase_intent_id uuid not null, first_transaction_id text not null, assigned_at timestamptz not null default now(),
 closed_at timestamptz, closure_reason text, unique(id,environment),
 foreign key(subscription_id,buyer_id,environment) references public.apple_subscriptions(id,buyer_id,environment),
 foreign key(purchase_intent_id,buyer_id,environment) references public.apple_purchase_intents(id,buyer_id,environment)
);
create table public.apple_slot_occupancies (
 buyer_id uuid not null, environment text not null, slot_number integer not null check(slot_number between 1 and 10),
 state text not null check(state in ('reserved','purchasing','occupied','reconciliation')),
 purchase_intent_id uuid not null, subscription_id uuid, listing_type text not null check(listing_type in ('business','job','rental')),
 listing_id uuid not null, updated_at timestamptz not null default now(),
 primary key(buyer_id,environment,slot_number), unique(environment,listing_type,listing_id),
 foreign key(purchase_intent_id,buyer_id,environment) references public.apple_purchase_intents(id,buyer_id,environment),
 foreign key(subscription_id,buyer_id,environment) references public.apple_subscriptions(id,buyer_id,environment)
);
create table public.apple_transactions (
 environment text not null check(environment in ('Sandbox','Production')), bundle_id text not null check(bundle_id='com.abilenevibes.app'),
 transaction_id text not null, original_transaction_id text not null, subscription_id uuid references public.apple_subscriptions(id),
 assignment_id uuid references public.apple_subscription_assignments(id), product_id text not null,
 app_account_token uuid not null, app_transaction_id text not null, subscription_group_id text not null,
 purchase_date timestamptz not null, expires_date timestamptz not null, revocation_date timestamptz, revocation_reason integer,
 ownership_type text not null, is_upgraded boolean not null,
 signed_payload_ref text, signed_payload_sha256 text not null check(signed_payload_sha256 ~ '^[a-f0-9]{64}$'),
 verification_status text not null check(verification_status='verified'), verified_at timestamptz not null, created_at timestamptz not null default now(),
 primary key(bundle_id,environment,transaction_id), foreign key(environment,product_id) references public.apple_product_catalog(environment,product_id),
 foreign key(assignment_id,environment) references public.apple_subscription_assignments(id,environment)
);
create table public.apple_notification_events (
 id uuid primary key default gen_random_uuid(), environment text not null check(environment in ('Sandbox','Production')),
 notification_uuid text not null, notification_type text not null, subtype text, signed_date bigint not null,
 payload_ref text, payload_hash text not null check(payload_hash ~ '^[a-f0-9]{64}$'),
 status text not null check(status in ('received','processing','processed','retry','quarantined')),
 attempts integer not null default 0, received_at timestamptz not null default now(), processed_at timestamptz, error_code text,
 facts jsonb not null, unique(environment,notification_uuid)
);
create table public.listing_promotion_entitlements (
 id uuid primary key default gen_random_uuid(), listing_type text not null check(listing_type in ('business','job','rental')), listing_id uuid not null,
 provider text not null check(provider in ('apple','stripe','comp')), provider_reference text not null,
 plan text not null check(plan in ('free','featured','premium')), status text not null check(status in ('active','active_nonrenewing','grace','billing_retry','expired','revoked','reconciliation')),
 valid_from timestamptz not null, valid_until timestamptz not null, auto_renew_state text not null,
 environment text not null check(environment in ('Sandbox','Production')), source_priority integer not null,
 created_at timestamptz not null default now(), updated_at timestamptz not null default now(),
 unique(provider,environment,provider_reference), check(valid_until>=valid_from)
);
create table public.apple_deliveries (
 id uuid primary key default gen_random_uuid(), bundle_id text not null, environment text not null,
 transaction_id text not null, buyer_id uuid not null, purchase_intent_id uuid not null,
 assignment_id uuid not null references public.apple_subscription_assignments(id), created_at timestamptz not null default now(),
 unique(bundle_id,environment,transaction_id),
 foreign key(bundle_id,environment,transaction_id) references public.apple_transactions(bundle_id,environment,transaction_id),
 foreign key(purchase_intent_id,buyer_id,environment) references public.apple_purchase_intents(id,buyer_id,environment)
);

-- Cross-environment and same-chain bindings must also hold below the domain layer.
alter table public.apple_installations add unique(installation_id,environment);
alter table public.apple_challenges add foreign key(installation_id,environment) references public.apple_installations(installation_id,environment);
alter table public.apple_buyers add unique(app_account_token,app_transaction_id,environment,bundle_id);
alter table public.apple_product_catalog add unique(environment,product_id,slot_number,plan);
alter table public.apple_purchase_intents add foreign key(environment,product_id,slot_number,requested_plan) references public.apple_product_catalog(environment,product_id,slot_number,plan);
alter table public.apple_purchase_intents add unique(id,buyer_id,environment,slot_number,listing_type,listing_id);
alter table public.apple_subscriptions add unique(id,environment,bundle_id,original_transaction_id);
alter table public.apple_subscriptions add unique(id,buyer_id,environment,slot_number);
alter table public.apple_subscriptions add foreign key(environment,product_id,slot_number,plan) references public.apple_product_catalog(environment,product_id,slot_number,plan);
alter table public.apple_subscription_assignments add foreign key(subscription_id,buyer_id,environment,slot_number) references public.apple_subscriptions(id,buyer_id,environment,slot_number);
alter table public.apple_subscription_assignments add foreign key(purchase_intent_id,buyer_id,environment,slot_number,listing_type,listing_id) references public.apple_purchase_intents(id,buyer_id,environment,slot_number,listing_type,listing_id);
alter table public.apple_subscription_assignments add unique(id,subscription_id,environment);
alter table public.apple_subscription_assignments add unique(id,buyer_id,environment,purchase_intent_id);
alter table public.apple_slot_occupancies add foreign key(purchase_intent_id,buyer_id,environment,slot_number,listing_type,listing_id) references public.apple_purchase_intents(id,buyer_id,environment,slot_number,listing_type,listing_id);
alter table public.apple_slot_occupancies add foreign key(subscription_id,buyer_id,environment,slot_number) references public.apple_subscriptions(id,buyer_id,environment,slot_number);
alter table public.apple_transactions alter column subscription_id set not null, alter column assignment_id set not null;
alter table public.apple_transactions add foreign key(subscription_id,environment,bundle_id,original_transaction_id) references public.apple_subscriptions(id,environment,bundle_id,original_transaction_id);
alter table public.apple_transactions add foreign key(assignment_id,subscription_id,environment) references public.apple_subscription_assignments(id,subscription_id,environment);
alter table public.apple_transactions add foreign key(app_account_token,app_transaction_id,environment,bundle_id) references public.apple_buyers(app_account_token,app_transaction_id,environment,bundle_id);
alter table public.apple_transactions add unique(bundle_id,environment,transaction_id,assignment_id);
alter table public.apple_deliveries add foreign key(bundle_id,environment,transaction_id,assignment_id) references public.apple_transactions(bundle_id,environment,transaction_id,assignment_id);
alter table public.apple_deliveries add foreign key(assignment_id,buyer_id,environment,purchase_intent_id) references public.apple_subscription_assignments(id,buyer_id,environment,purchase_intent_id);
alter table public.apple_notification_events add check(
 (facts->>'environment' = environment and facts->>'bundle_id' = 'com.abilenevibes.app'
 and facts->>'notification_uuid' = notification_uuid) is true);

-- Prepared low-volume Sandbox repository: normalized rows, no duplicate JSON state ledger.
-- A revision mutex + CAS serializes reservations and multi-table delivery across processes.
-- Client cannot call these RPCs. Production is explicitly rejected by the write routine.
create table public.apple_ledger_revision (id integer primary key check(id=1), revision bigint not null default 0);
insert into public.apple_ledger_revision(id) values(1);

create function public.apple_ledger_snapshot()
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
  execute format('select coalesce(jsonb_agg(to_jsonb(t)),''[]''::jsonb) from public.%I t where environment=''Sandbox''',spec[2]) into rows;
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
  'stripe_conflict',coalesce(record_json->>'stripe_subscription_id','')<>'' or coalesce(record_json->>'payment_status','') in ('pending','checkout_started','paid','cancel_pending') or coalesce(record_json->>'placement_source','') in ('stripe','paid'))),'[]'::jsonb)
 into rows from (
  select 'business' kind,to_jsonb(b) record_json from public.business_submissions b
  union all select 'job',to_jsonb(j) from public.job_listings j
  union all select 'rental',to_jsonb(r) from public.rental_listings r
 ) listings;
 result:=jsonb_set(result,array['listings'],rows);
 return jsonb_build_object('version',v,'state',result);
end; $$;

create function public.apple_ledger_compare_and_swap(expected_version bigint, next_state jsonb)
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

-- A valid token must belong to the buyer of this chain, not merely any buyer.
create function public.apple_financial_binding()
returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if TG_TABLE_NAME='apple_transactions' then
  if not exists(select 1 from public.apple_subscriptions s join public.apple_buyers b
   on b.id=s.buyer_id and b.environment=s.environment
   where s.id=new.subscription_id and s.environment=new.environment and s.bundle_id=new.bundle_id
   and b.app_account_token=new.app_account_token and b.app_transaction_id=new.app_transaction_id)
  then raise exception 'TRANSACTION_BUYER_MISMATCH' using errcode='23503'; end if;
 elsif new.provider='apple' then
  if not exists(select 1 from public.apple_subscriptions s join public.apple_subscription_assignments a
   on a.subscription_id=s.id and a.environment=s.environment
   where s.id::text=new.provider_reference and s.environment=new.environment
   and a.listing_type=new.listing_type and a.listing_id=new.listing_id and s.plan=new.plan)
  then raise exception 'ENTITLEMENT_ASSIGNMENT_MISMATCH' using errcode='23503'; end if;
 end if;
 return new;
end; $$;
revoke all on function public.apple_financial_binding() from public,anon,authenticated,service_role;
create trigger apple_transaction_buyer before insert or update on public.apple_transactions for each row execute function public.apple_financial_binding();
create trigger apple_entitlement_assignment before insert or update on public.listing_promotion_entitlements for each row execute function public.apple_financial_binding();

-- A ledger operator must not erase financial history, even accidentally.
-- Trusted schema owners/superusers can still alter/drop objects: administrative boundary.
create function public.apple_reject_delete()
returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin raise exception 'APPLE_HISTORY_DELETE_FORBIDDEN'; end; $$;
revoke all on function public.apple_reject_delete() from public,anon,authenticated,service_role;

-- Immutable ownership/chain/event bindings, including service-role accidental rewrites.
create function public.apple_immutable_binding()
returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
declare column_name text;
begin
 foreach column_name in array TG_ARGV loop
  if to_jsonb(new)->column_name is distinct from to_jsonb(old)->column_name then raise exception 'IMMUTABLE_APPLE_BINDING'; end if;
 end loop;
 return new;
end; $$;
create trigger apple_buyer_binding before update on public.apple_buyers for each row execute function public.apple_immutable_binding('app_account_token','bundle_id','environment','app_transaction_id');
create trigger apple_assignment_binding before update on public.apple_subscription_assignments for each row execute function public.apple_immutable_binding('subscription_id','buyer_id','environment','listing_type','listing_id','slot_number','purchase_intent_id','first_transaction_id','assigned_at');
create trigger apple_subscription_binding before update on public.apple_subscriptions for each row execute function public.apple_immutable_binding('buyer_id','bundle_id','environment','original_transaction_id','slot_number');
create trigger apple_transaction_binding before update on public.apple_transactions for each row execute function public.apple_immutable_binding('bundle_id','environment','transaction_id','original_transaction_id','product_id','app_account_token','app_transaction_id','subscription_id','assignment_id','purchase_date','expires_date','signed_payload_sha256');
create trigger apple_delivery_binding before update on public.apple_deliveries for each row execute function public.apple_immutable_binding('bundle_id','environment','transaction_id','buyer_id','purchase_intent_id','assignment_id');
create trigger apple_intent_binding before update on public.apple_purchase_intents for each row execute function public.apple_immutable_binding('buyer_id','environment','listing_type','listing_id','slot_number','product_id','requested_plan','idempotency_key');
create trigger apple_slot_binding before update on public.apple_slot_occupancies for each row execute function public.apple_immutable_binding('buyer_id','environment','slot_number','listing_type','listing_id','purchase_intent_id');
create trigger apple_entitlement_binding before update on public.listing_promotion_entitlements for each row execute function public.apple_immutable_binding('provider','environment','provider_reference','listing_type','listing_id');

create trigger apple_notification_binding before update on public.apple_notification_events for each row execute function public.apple_immutable_binding('notification_uuid','notification_type','subtype','signed_date','payload_hash','facts');
create trigger apple_installation_binding before update on public.apple_installations for each row execute function public.apple_immutable_binding('buyer_id','key_id');
create trigger apple_capability_binding before update on public.apple_session_capabilities for each row execute function public.apple_immutable_binding('buyer_id','installation_id','token_hash');
create trigger apple_challenge_binding before update on public.apple_challenges for each row execute function public.apple_immutable_binding('installation_id','nonce_hash','purpose','request_digest');

-- Require a trusted migration owner and a non-writable public schema for callers.
-- Do not change privileges of unrelated production schema objects implicitly.
do $$ begin
 if current_user in ('anon','authenticated','service_role') or
 exists(select 1 from pg_roles r where r.rolname in ('anon','authenticated','service_role')
 and has_schema_privilege(r.oid,'public','CREATE')) then raise exception 'UNSAFE_APPLE_SCHEMA_OWNER_OR_CREATE'; end if;
end; $$;

do $$ declare t text; pk_args text; begin
 foreach t in array array['apple_buyers','apple_installations','apple_session_capabilities','apple_challenges','apple_product_catalog','apple_listing_authorizations','apple_purchase_intents','apple_slot_occupancies','apple_subscriptions','apple_subscription_assignments','apple_transactions','apple_notification_events','listing_promotion_entitlements','apple_deliveries','apple_ledger_revision'] loop
  execute format('alter table public.%I enable row level security',t);
  select string_agg(quote_literal(a.attname),',' order by a.attnum) into pk_args
  from pg_index i join pg_attribute a on a.attrelid=i.indrelid and a.attnum=any(i.indkey)
  where i.indrelid=format('public.%I',t)::regclass and i.indisprimary;
  execute format('create trigger apple_primary_key_immutable before update on public.%I for each row execute function public.apple_immutable_binding(%s)',t,pk_args);
  execute format('revoke all on public.%I from public,anon,authenticated',t);
  execute format('revoke all on public.%I from service_role',t);
  execute format('create trigger apple_no_delete before delete on public.%I for each statement execute function public.apple_reject_delete()',t);
  execute format('create trigger apple_no_truncate before truncate on public.%I for each statement execute function public.apple_reject_delete()',t);
  if t<>'apple_ledger_revision' then
   execute format('create trigger apple_environment_immutable before update on public.%I for each row execute function public.apple_immutable_binding(''environment'')',t);
  end if;
 end loop;
end; $$;
revoke all on function public.apple_ledger_snapshot() from public,anon,authenticated;
revoke all on function public.apple_ledger_compare_and_swap(bigint,jsonb) from public,anon,authenticated;
revoke all on function public.apple_immutable_binding() from public,anon,authenticated;
grant execute on function public.apple_ledger_snapshot() to service_role;
grant execute on function public.apple_ledger_compare_and_swap(bigint,jsonb) to service_role;
commit;
