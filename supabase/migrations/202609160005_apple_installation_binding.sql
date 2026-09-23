-- Phase77 LOCAL ONLY. Additive; never infer the origin of legacy intents.
begin;
alter table public.apple_purchase_intents
 add column originating_installation_id uuid,
 add column app_account_token uuid,
 add column bundle_id text,
 add column subscription_group_id text;

alter table public.apple_buyers add constraint apple_buyer_intent_token_unique unique(id,app_account_token,environment);
alter table public.apple_product_catalog add constraint apple_catalog_intent_scope_unique unique(environment,product_id,bundle_id,subscription_group_id);
alter table public.apple_purchase_intents
 add constraint apple_intent_installation_fk foreign key(originating_installation_id,buyer_id,environment)
 references public.apple_installations(installation_id,buyer_id,environment),
 add constraint apple_intent_token_fk foreign key(buyer_id,app_account_token,environment)
 references public.apple_buyers(id,app_account_token,environment),
 add constraint apple_intent_catalog_scope_fk foreign key(environment,product_id,bundle_id,subscription_group_id)
 references public.apple_product_catalog(environment,product_id,bundle_id,subscription_group_id),
 add constraint apple_intent_binding_complete check(
  (originating_installation_id is null and app_account_token is null and bundle_id is null and subscription_group_id is null)
  or (originating_installation_id is not null and app_account_token is not null and bundle_id='com.abilenevibes.app' and subscription_group_id is not null));
create index apple_intent_originating_installation on public.apple_purchase_intents(originating_installation_id);

create function public.apple_intent_installation_guard()
returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if TG_OP='UPDATE' then
  if row(new.originating_installation_id,new.app_account_token,new.bundle_id,new.subscription_group_id)
    is distinct from row(old.originating_installation_id,old.app_account_token,old.bundle_id,old.subscription_group_id)
  then raise exception 'INTENT_BINDING_IMMUTABLE'; end if;
  if old.originating_installation_id is null and to_jsonb(new) is distinct from to_jsonb(old)
  then raise exception 'LEGACY_INTENT_BINDING_REQUIRED'; end if;
 elsif new.originating_installation_id is null and not exists(
  select 1 from public.apple_purchase_intents i where i.id=new.id and i.originating_installation_id is null and to_jsonb(i)=to_jsonb(new)) then
  raise exception 'INTENT_BINDING_REQUIRED';
 end if;
 return new;
end; $$;
create trigger apple_intent_installation_guard before insert or update on public.apple_purchase_intents
 for each row execute function public.apple_intent_installation_guard();

create function public.apple_delivery_installation_guard()
returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if not exists(select 1 from public.apple_deliveries d where d.id=new.id and to_jsonb(d)=to_jsonb(new)) and not exists(select 1 from public.apple_purchase_intents i
  where i.id=new.purchase_intent_id and i.buyer_id=new.buyer_id and i.environment=new.environment
  and i.originating_installation_id is not null and i.app_account_token is not null
  and i.bundle_id=new.bundle_id and i.subscription_group_id is not null)
 then raise exception 'DELIVERY_INTENT_BINDING_REQUIRED' using errcode='23503'; end if;
 return new;
end; $$;
create trigger apple_delivery_installation_guard before insert on public.apple_deliveries
 for each row execute function public.apple_delivery_installation_guard();

-- Recovery authorizations are consumed once in the same guarded CAS as recovery.
-- Scope proof is a server-verified signature, never a client authority boolean.
create function public.apple_recovery_consumption_guard()
returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if TG_OP='UPDATE' and old.purpose='delivery-recovery-v1' and to_jsonb(new) is distinct from to_jsonb(old)
 then raise exception 'RECOVERY_AUTHORIZATION_IMMUTABLE'; end if;
 if new.purpose='delivery-recovery-v1' and
  (new.installation_id is null or new.consumed_at is null or new.expires_at<=new.consumed_at
   or new.request_digest !~ '^[a-f0-9]{64}$')
 then raise exception 'RECOVERY_AUTHORIZATION_INVALID'; end if;
 return new;
end; $$;
create trigger apple_recovery_consumption_guard before insert or update on public.apple_challenges
 for each row execute function public.apple_recovery_consumption_guard();
revoke all on function public.apple_intent_installation_guard() from public,anon,authenticated,service_role;
revoke all on function public.apple_delivery_installation_guard() from public,anon,authenticated,service_role;
revoke all on function public.apple_recovery_consumption_guard() from public,anon,authenticated,service_role;
-- Existing snapshot/CAS enumerate physical columns dynamically, preserving the new
-- context. Existing RLS and service-role-only RPC privileges remain unchanged.
commit;
