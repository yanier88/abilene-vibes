-- Public commercial projection only: never exposes buyer, token, transaction or evidence.
begin;
create function public.apple_public_promotions()
returns table(listing_type text,listing_id uuid,plan text,valid_until timestamptz)
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select e.listing_type,e.listing_id,e.plan,e.valid_until
 from public.listing_promotion_entitlements e
 join public.apple_subscription_assignments a on a.subscription_id::text=e.provider_reference and a.environment=e.environment and a.closed_at is null
 join (
  select 'business' kind,id,to_jsonb(b) row from public.business_submissions b where status='approved'
  union all select 'job',id,to_jsonb(j) from public.job_listings j where status='approved'
  union all select 'rental',id,to_jsonb(r) from public.rental_listings r where status='approved'
 ) l on l.kind=e.listing_type and l.id=e.listing_id
 where e.provider='apple' and e.environment='Production' and e.status in ('active','active_nonrenewing','grace')
 and e.valid_from<=now() and e.valid_until>now()
 and coalesce(l.row->>'stripe_subscription_id','')='' and coalesce(l.row->>'placement_source','')<>'stripe' and coalesce(l.row->>'payment_status','') not in ('pending','checkout_started','cancel_pending')
 and not exists(select 1 from public.listing_promotion_entitlements x where x.provider='stripe' and x.environment='Production' and x.listing_type=e.listing_type and x.listing_id=e.listing_id and x.status in ('active','active_nonrenewing','grace') and x.valid_from<=now() and x.valid_until>now());
$$;
revoke all on function public.apple_public_promotions() from public;
grant execute on function public.apple_public_promotions() to anon,authenticated,service_role;
commit;
