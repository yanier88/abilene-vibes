-- Phase109: local Sandbox administrative release. No public/client release API.
begin;
alter table public.apple_slot_occupancies drop constraint apple_slot_occupancies_state_check;
alter table public.apple_slot_occupancies add constraint apple_slot_occupancies_state_check
 check(state in ('reserved','purchasing','occupied','reconciliation','released_expired','released_never_started'));
drop index public.apple_live_listing_slot;
create unique index apple_live_listing_slot on public.apple_slot_occupancies(environment,listing_type,listing_id)
 where state not in ('released_expired','released_never_started');
-- The occupancy is a reusable current-slot projection. This append-only ledger
-- preserves the complete old reservation, intent, bindings and proof forever.
create table public.apple_never_started_releases (
 purchase_intent_id uuid primary key references public.apple_purchase_intents(id),
 environment text not null check(environment='Sandbox'),
 intent_before jsonb not null,
 reservation_before jsonb not null,
 intent_after jsonb not null,
 reservation_after jsonb not null,
 absence_evidence jsonb not null,
 reason text not null check(reason='WINDOW_EXPIRED_BEFORE_USER_PRESS'),
 released_at timestamptz not null,
 previous_revision bigint not null
);
create table public.apple_intent_attempt_facts (
 id uuid primary key,
 purchase_intent_id uuid not null references public.apple_purchase_intents(id),
 kind text not null check(kind in ('button','durable_marker','attempt_preference','backend_start','purchase_enter','transaction_claim','ambiguous')),
 observed_at timestamptz not null default clock_timestamp()
);
alter table public.apple_never_started_releases enable row level security;
alter table public.apple_intent_attempt_facts enable row level security;
revoke all on public.apple_never_started_releases,public.apple_intent_attempt_facts from public,anon,authenticated,service_role;
create function public.apple_never_started_immutable() returns trigger language plpgsql
set search_path=pg_catalog,public,pg_temp as $$
begin
 raise exception 'NEVER_STARTED_HISTORY_IMMUTABLE';
end; $$;
create trigger apple_never_started_immutable before update or delete on public.apple_never_started_releases
 for each row execute function public.apple_never_started_immutable();
create trigger apple_attempt_fact_immutable before update or delete on public.apple_intent_attempt_facts
 for each row execute function public.apple_never_started_immutable();
-- A late contradictory fact cannot silently coexist with a release. Reject it
-- for explicit reconciliation; never grant delivery based on a released intent.
create function public.apple_never_started_terminal_guard() returns trigger language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
begin
 perform 1 from public.apple_ledger_revision where id=1 for update;
 if TG_TABLE_NAME='apple_purchase_intents' then
  if exists(select 1 from public.apple_never_started_releases r where r.purchase_intent_id=old.id)
     and to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'NEVER_STARTED_INTENT_TERMINAL'; end if;
 elsif exists(select 1 from public.apple_never_started_releases r where r.purchase_intent_id=new.purchase_intent_id) then
  raise exception 'NEVER_STARTED_LATE_EVIDENCE_REQUIRES_RECONCILIATION';
 end if;
 return new;
end; $$;
create trigger apple_never_started_terminal before update on public.apple_purchase_intents
 for each row execute function public.apple_never_started_terminal_guard();
create trigger apple_never_started_attempt before insert on public.apple_intent_attempt_facts
 for each row execute function public.apple_never_started_terminal_guard();
create trigger apple_never_started_delivery before insert or update on public.apple_deliveries
 for each row execute function public.apple_never_started_terminal_guard();
create trigger apple_never_started_assignment before insert or update on public.apple_subscription_assignments
 for each row execute function public.apple_never_started_terminal_guard();

create function public.apple_release_never_started(intent_id uuid, expected_revision bigint, expected_intent jsonb, proof jsonb)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare i public.apple_purchase_intents; slot public.apple_slot_occupancies; v bigint; t timestamptz; after_i jsonb; after_slot jsonb;
begin
 -- Every existing business CAS takes this same lock before writing.
 select revision into v from public.apple_ledger_revision where id=1 for update;
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
revoke all on function public.apple_release_never_started(uuid,bigint,jsonb,jsonb) from public,anon,authenticated,service_role;
revoke all on function public.apple_never_started_terminal_guard(),public.apple_never_started_immutable() from public,anon,authenticated,service_role;
-- Keep the original expired-purchase predicate unchanged, add a separate proof.
create or replace function public.apple_released_slot_guard() returns trigger language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
begin
 if new.state='released_expired' and not exists(select 1 from public.apple_expired_purchases p
  where p.purchase_intent_id=new.purchase_intent_id and p.buyer_id=new.buyer_id and p.environment=new.environment)
 then raise exception 'EXPIRED_RELEASE_REQUIRES_RECORD'; end if;
 if new.state='released_never_started' and not exists(select 1 from public.apple_never_started_releases r
  join public.apple_purchase_intents i on i.id=r.purchase_intent_id
  where r.purchase_intent_id=new.purchase_intent_id and r.reservation_after=to_jsonb(new)
  and i.status='failed' and i.started_at is null and i.completed_at is null and i.reconciliation_reason=r.reason)
 then raise exception 'NEVER_STARTED_RELEASE_REQUIRES_AUDIT'; end if;
 return new;
end; $$;
create or replace function public.apple_slot_reuse_guard() returns trigger language plpgsql
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
 if old.state='released_never_started' then
  if new.state='reserved' and old.subscription_id is null and new.subscription_id is null and old.purchase_intent_id<>new.purchase_intent_id
   and exists(select 1 from public.apple_never_started_releases r join public.apple_purchase_intents i on i.id=new.purchase_intent_id
    where r.purchase_intent_id=old.purchase_intent_id and r.reservation_after=to_jsonb(old)
     and i.status='reserved' and i.started_at is null and i.completed_at is null
     and i.buyer_id=new.buyer_id and i.environment=new.environment and i.slot_number=new.slot_number
     and i.listing_type=new.listing_type and i.listing_id=new.listing_id
     and i.originating_installation_id::text=r.intent_after->>'originating_installation_id'
     and i.app_account_token::text=r.intent_after->>'app_account_token'
     and i.listing_id::text=r.intent_after->>'listing_id'
     and i.idempotency_key<>r.intent_after->>'idempotency_key') then return new; end if;
  if to_jsonb(new) is distinct from to_jsonb(old) then raise exception 'NEVER_STARTED_RESERVATION_IMMUTABLE'; end if;
 end if;
 if row(new.listing_type,new.listing_id,new.purchase_intent_id) is distinct from row(old.listing_type,old.listing_id,old.purchase_intent_id)
 then raise exception 'IMMUTABLE_APPLE_BINDING'; end if;
 return new;
end; $$;
commit;
