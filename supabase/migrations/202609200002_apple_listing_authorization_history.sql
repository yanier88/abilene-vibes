-- Phase103D: local validation only; not applied to production.
-- created_at is the durable issuance time; no historical row is rewritten.
begin;
create extension if not exists btree_gist with schema public;
alter table public.apple_listing_authorizations
 add constraint apple_authorization_valid_interval check (expires_at > created_at),
 drop constraint apple_listing_authorizations_buyer_id_environment_listing_t_key,
 add constraint apple_authorization_no_overlap exclude using gist
 (buyer_id with =, environment with =, listing_type with =, listing_id with =,
  tstzrange(created_at,expires_at,'[)') with &&) where (revoked_at is null);

create function public.apple_authorization_history_guard() returns trigger
language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if tg_op='UPDATE' then
  if (to_jsonb(new)-'revoked_at') is distinct from (to_jsonb(old)-'revoked_at')
    or (old.revoked_at is not null and new.revoked_at is distinct from old.revoked_at)
  then raise exception 'AUTHORIZATION_HISTORY_IMMUTABLE'; end if;
 end if;
 if tg_op='INSERT' and new.created_at > clock_timestamp() then
  raise exception 'AUTHORIZATION_FUTURE_ISSUANCE';
 end if;
 return new;
end; $$;
create trigger apple_authorization_history_guard before insert or update
 on public.apple_listing_authorizations for each row
 execute function public.apple_authorization_history_guard();
revoke all on function public.apple_authorization_history_guard() from public,anon,authenticated,service_role;

-- Administrative server-only renewal for an existing Featured Sandbox intent.
-- No client-supplied buyer, listing, token, TTL, or timestamps. The old records stay.
create function public.apple_renew_existing_purchase_permissions(intent_id uuid)
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
 t:=clock_timestamp(); deadline:=t+interval '15 minutes';
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
revoke all on function public.apple_renew_existing_purchase_permissions(uuid) from public,anon,authenticated;
grant execute on function public.apple_renew_existing_purchase_permissions(uuid) to service_role;
commit;
