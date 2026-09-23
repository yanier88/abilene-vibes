begin;
-- A device-signed USER_CANCELLED assertion is not a verified Apple transaction.
-- It can release only that installation's empty Production reservation. It cannot
-- erase history, undo delivery, authorize finish, or accept a late transaction.
alter table public.apple_slot_occupancies drop constraint apple_slot_occupancies_state_check;
alter table public.apple_slot_occupancies add constraint apple_slot_occupancies_state_check check(state in ('reserved','purchasing','occupied','reconciliation','released_expired','released_never_started','released_cancelled'));
create table public.apple_cancelled_attempts (
 purchase_intent_id uuid primary key references public.apple_purchase_intents(id),
 installation_id uuid not null references public.apple_installations(installation_id),
 environment text not null check(environment='Production'),
 reason text not null check(reason='DEVICE_REPORTED_USER_CANCELLED'),
 created_at timestamptz not null default clock_timestamp()
);
alter table public.apple_cancelled_attempts enable row level security;
revoke all on public.apple_cancelled_attempts from public,anon,authenticated;
grant select on public.apple_cancelled_attempts to service_role;
create function public.apple_cancel_purchase(p_user uuid,p_key text,p_intent uuid) returns jsonb
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare i public.apple_purchase_intents; k public.apple_installation_keys; s public.apple_slot_occupancies;
begin
 perform 1 from apple_ledger_revision where id=1 for update;
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
revoke all on function public.apple_cancel_purchase(uuid,text,uuid) from public,anon,authenticated;
grant execute on function public.apple_cancel_purchase(uuid,text,uuid) to service_role;
-- Preserve the historical guard as an independently named trigger function.
alter function public.apple_slot_reuse_guard() rename to apple_slot_historical_reuse_guard;
create function public.apple_slot_reuse_guard() returns trigger language plpgsql set search_path=pg_catalog,public,pg_temp as $$
begin
 if new.state='released_cancelled' and not exists(select 1 from apple_cancelled_attempts a join apple_purchase_intents i on i.id=a.purchase_intent_id where a.purchase_intent_id=new.purchase_intent_id and i.status='canceled' and i.environment='Production') then raise exception 'CANCEL_RELEASE_REQUIRES_AUDIT'; end if;
 if old.state='released_cancelled' then
  if row(new.buyer_id,new.environment,new.slot_number) is distinct from row(old.buyer_id,old.environment,old.slot_number) then raise exception 'IMMUTABLE_APPLE_BINDING'; end if;
  if new.state='reserved' and old.subscription_id is null and new.subscription_id is null and old.purchase_intent_id<>new.purchase_intent_id
  and exists(select 1 from apple_cancelled_attempts a join apple_purchase_intents i on i.id=new.purchase_intent_id where a.purchase_intent_id=old.purchase_intent_id and i.environment='Production' and i.buyer_id=new.buyer_id and i.slot_number=new.slot_number and i.listing_type=new.listing_type and i.listing_id=new.listing_id and i.status='reserved' and i.started_at is null)
  then return new; end if;
  if to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'CANCELLED_SLOT_IMMUTABLE'; end if;
 end if;
 return new;
end; $$;
-- Historical guard is still attached to its original trigger. Permit only the
-- audited new branch there, leaving every old branch byte-for-byte intact.
DO $migration$
declare definition text;
begin
 select pg_get_functiondef('public.apple_slot_historical_reuse_guard()'::regprocedure) into definition;
 definition:=replace(definition,E'begin\n',E'begin\n if old.state=''released_cancelled'' then return new; end if;\n');
 execute definition;
end; $migration$;
create trigger apple_cancelled_slot_guard before update on public.apple_slot_occupancies for each row execute function public.apple_slot_reuse_guard();
revoke all on function public.apple_slot_reuse_guard() from public,anon,authenticated,service_role;
commit;
