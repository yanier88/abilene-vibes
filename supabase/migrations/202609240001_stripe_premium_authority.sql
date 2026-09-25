begin;
-- No historical row is guessed active. Existing paid listings keep their old
-- display projection but cannot use new benefits until a verified snapshot arrives.
create table public.stripe_promotion_authority (
 subscription_id text primary key,
 listing_type text not null check(listing_type in ('business','job','rental')),
 listing_id uuid not null,
 environment text not null check(environment in ('Production','Sandbox')),
 plan text not null check(plan in ('free','featured','premium')),
 status text not null,
 period_end timestamptz,
 cancel_at_period_end boolean not null,
 event_created bigint not null,
 event_id text not null,
 snapshot jsonb not null,
 ambiguous boolean not null default false
);
create table public.stripe_authority_receipts(event_id text primary key, snapshot jsonb not null);
alter table public.stripe_promotion_authority enable row level security;
alter table public.stripe_authority_receipts enable row level security;
revoke all on public.stripe_promotion_authority,public.stripe_authority_receipts from public,anon,authenticated;
create function public.record_stripe_authority(p jsonb) returns text
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare old public.stripe_promotion_authority; prior jsonb; binding jsonb;
begin
 if auth.role() is distinct from 'service_role' then raise exception 'SERVICE_ONLY' using errcode='42501'; end if;
 if p->>'subscription_id' is null or p->>'event_id' is null or (p->>'event_created')::bigint<=0 then raise exception 'INVALID'; end if;
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
revoke all on function public.record_stripe_authority(jsonb) from public,anon,authenticated;
grant execute on function public.record_stripe_authority(jsonb) to service_role;
commit;
