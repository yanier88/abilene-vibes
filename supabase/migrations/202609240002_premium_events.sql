begin;
alter table public.event_submissions
 add column business_id uuid references public.business_submissions(id),
 add column submitted_by uuid,
 add column submission_key uuid,
 add column submission_hash text,
 add column entitlement_provider text check(entitlement_provider in ('stripe','apple')),
 add column entitlement_checked_at timestamptz;
create unique index event_submission_idempotency on public.event_submissions(submitted_by,submission_key) where submission_key is not null;
create index event_business_slots on public.event_submissions(business_id,status) where business_id is not null;

create function public.event_ends_at(p_date date,p_time text,p_end_date date,p_end_time text)
returns timestamptz language plpgsql immutable set search_path=pg_catalog,public,pg_temp as $$
begin
 return (coalesce(p_end_date,p_date)+coalesce(nullif(p_end_time,''),p_time)::time) at time zone 'America/Chicago';
exception when others then return null;
end $$;

create function public.premium_event_provider(p_business uuid) returns text
language plpgsql stable security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.business_submissions; provider text; n integer;
begin
 select * into b from public.business_submissions where id=p_business;
 if auth.uid() is null or b.id is null or b.advertiser_user_id is distinct from auth.uid() or b.status<>'approved' then return null; end if;
 -- Stripe binding excludes Apple, including unresolved/expired Stripe rows.
 if coalesce(b.stripe_subscription_id,'')<>'' then
  if exists(select 1 from public.stripe_promotion_authority a where a.subscription_id=b.stripe_subscription_id and a.listing_type='business' and a.listing_id=b.id and a.environment='Production' and a.plan='premium' and a.status='active' and not a.ambiguous and a.period_end>now()) then return 'stripe'; end if;
  return null;
 end if;
 select count(*) into n from public.apple_public_promotions() a where a.listing_type='business' and a.listing_id=b.id and a.plan='premium' and a.valid_until>now();
 if n=1 then return 'apple'; end if;
 return null;
end $$;
revoke all on function public.premium_event_provider(uuid) from public,anon;
grant execute on function public.premium_event_provider(uuid) to authenticated;

create function public.premium_event_slots(p_business uuid) returns integer
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select count(*)::integer from public.event_submissions e where business_id=p_business and status in ('pending','approved') and public.event_ends_at(event_date,event_time,end_date,end_time)>now()
$$;
revoke all on function public.premium_event_slots(uuid) from public,anon,authenticated;

create function public.premium_event_options() returns table(business_id uuid,business_name text,provider text,occupied integer,can_submit boolean)
language sql stable security definer set search_path=pg_catalog,public,pg_temp as $$
 select b.id,b.business_name,public.premium_event_provider(b.id),public.premium_event_slots(b.id),public.premium_event_provider(b.id) is not null and public.premium_event_slots(b.id)<3
 from public.business_submissions b where auth.uid() is not null and b.advertiser_user_id=auth.uid() and b.status='approved'
$$;
revoke all on function public.premium_event_options() from public,anon;
grant execute on function public.premium_event_options() to authenticated;

create function public.premium_event_guard() returns trigger language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
begin
 if TG_OP='UPDATE' and (new.business_id,new.submitted_by,new.submission_key,new.submission_hash,new.entitlement_provider,new.entitlement_checked_at) is distinct from (old.business_id,old.submitted_by,old.submission_key,old.submission_hash,old.entitlement_provider,old.entitlement_checked_at) then raise exception 'EVENT_BINDING_IMMUTABLE'; end if;
 if new.business_id is null then return new; end if;
 perform pg_advisory_xact_lock(hashtextextended('premium-events:'||new.business_id::text,0));
 if new.status not in ('pending','approved','rejected','hidden') then raise exception 'EVENT_STATUS_INVALID'; end if;
 if new.submitted_by is null or new.submission_key is null or new.entitlement_provider is null or new.entitlement_checked_at is null then raise exception 'EVENT_BINDING_REQUIRED'; end if;
 if public.event_ends_at(new.event_date,new.event_time,new.end_date,new.end_time) is null then raise exception 'EVENT_END_INVALID'; end if;
 if new.status in ('pending','approved') and public.event_ends_at(new.event_date,new.event_time,new.end_date,new.end_time)>now() and
 (select count(*) from public.event_submissions e where e.business_id=new.business_id and e.id<>new.id and e.status in ('pending','approved') and public.event_ends_at(e.event_date,e.event_time,e.end_date,e.end_time)>now())>=3 then raise exception 'EVENT_LIMIT_REACHED'; end if;
 return new;
end $$;
create trigger premium_event_guard before insert or update on public.event_submissions for each row execute function public.premium_event_guard();
revoke all on function public.premium_event_guard() from public,anon,authenticated;

create function public.submit_premium_event(p_business uuid,p_key uuid,p_fields jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare provider text; existing public.event_submissions; result uuid; ends timestamptz; starts timestamptz;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 if p_key is null or jsonb_typeof(p_fields)<>'object' or exists(select 1 from jsonb_object_keys(p_fields) k where k not in ('title','place','description','map_url','website_url','ticket_url','event_date','event_time','end_date','end_time','image_data')) then raise exception 'INVALID_FIELDS'; end if;
 if not exists(select 1 from public.business_submissions where id=p_business and advertiser_user_id=auth.uid()) then raise exception 'OWNER_REQUIRED' using errcode='42501'; end if;
 perform pg_advisory_xact_lock(hashtextextended('premium-events:'||p_business::text,0));
 select * into existing from public.event_submissions where submitted_by=auth.uid() and submission_key=p_key;
 if found then
  if existing.business_id<>p_business or existing.submission_hash is distinct from md5(p_fields::text) then raise exception 'IDEMPOTENCY_BINDING_MISMATCH'; end if;
  return existing.id;
 end if;
 provider:=public.premium_event_provider(p_business);
 if provider is null then raise exception 'PREMIUM_REQUIRED' using errcode='42501'; end if;
 if length(trim(coalesce(p_fields->>'title',''))) not between 1 and 160 or length(trim(coalesce(p_fields->>'place',''))) not between 1 and 240 or length(coalesce(p_fields->>'description',''))>5000 or octet_length(coalesce(p_fields->>'image_data',''))>2000000 then raise exception 'INVALID_FIELDS'; end if;
 if exists(select 1 from jsonb_each_text(p_fields) x where key in ('website_url','ticket_url') and value<>'' and (length(value)>2048 or value !~ '^https?://[^[:space:]]+$')) then raise exception 'INVALID_URL'; end if;
 if coalesce(p_fields->>'image_data','')<>'' and (p_fields->>'image_data') !~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$' then raise exception 'INVALID_IMAGE'; end if;
 starts:=public.event_ends_at((p_fields->>'event_date')::date,p_fields->>'event_time',null,null);
 ends:=public.event_ends_at((p_fields->>'event_date')::date,p_fields->>'event_time',nullif(p_fields->>'end_date','')::date,p_fields->>'end_time');
 if starts is null or ends is null or ends<=now() or ends<starts then raise exception 'INVALID_DATES'; end if;
 insert into public.event_submissions(title,place,description,map_url,website_url,ticket_url,event_date,event_time,end_date,end_time,event_type,image_data,status,business_id,submitted_by,submission_key,submission_hash,entitlement_provider,entitlement_checked_at)
 values(trim(p_fields->>'title'),trim(p_fields->>'place'),p_fields->>'description',p_fields->>'map_url',p_fields->>'website_url',p_fields->>'ticket_url',(p_fields->>'event_date')::date,p_fields->>'event_time',nullif(p_fields->>'end_date','')::date,nullif(p_fields->>'end_time',''),'Event',p_fields->>'image_data','pending',p_business,auth.uid(),p_key,md5(p_fields::text),provider,now()) returning id into result;
 return result;
end $$;
revoke all on function public.submit_premium_event(uuid,uuid,jsonb) from public,anon;
grant execute on function public.submit_premium_event(uuid,uuid,jsonb) to authenticated;

create function public.moderate_premium_event(p_event uuid,p_status text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare e public.event_submissions;
begin
 if not public.is_service_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_status not in ('approved','rejected') then raise exception 'INVALID_STATUS'; end if;
 select * into e from public.event_submissions where id=p_event;
 if e.business_id is null then raise exception 'SUBMISSION_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('premium-events:'||e.business_id::text,0));
 select * into e from public.event_submissions where id=p_event for update;
 if e.status<>'pending' then raise exception 'NOT_PENDING'; end if;
 if p_status='approved' and (e.entitlement_checked_at is null or public.event_ends_at(e.event_date,e.event_time,e.end_date,e.end_time)<=now()) then raise exception 'NOT_ELIGIBLE'; end if;
 update public.event_submissions set status=p_status where id=p_event;
end $$;
revoke all on function public.moderate_premium_event(uuid,text) from public,anon;
grant execute on function public.moderate_premium_event(uuid,text) to authenticated;

create function public.cancel_premium_event(p_event uuid) returns void language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b uuid;
begin
 select business_id into b from public.event_submissions where id=p_event and submitted_by=auth.uid();
 if auth.uid() is null or b is null then raise exception 'OWNER_REQUIRED'; end if;
 perform pg_advisory_xact_lock(hashtextextended('premium-events:'||b::text,0));
 update public.event_submissions set status='hidden' where id=p_event and submitted_by=auth.uid();
end $$;
revoke all on function public.cancel_premium_event(uuid) from public,anon;
grant execute on function public.cancel_premium_event(uuid) to authenticated;

drop policy "Allow public approved event reads" on public.event_submissions;
create policy "Allow public approved event reads" on public.event_submissions for select to anon,authenticated
 using(status='approved' and public.event_ends_at(event_date,event_time,end_date,end_time)>now());
create policy event_owner_read on public.event_submissions for select to authenticated using(submitted_by=auth.uid());
commit;
