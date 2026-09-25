begin;
-- RLS does not constrain TRUNCATE. Revoke every table and column grant first.
revoke all on public.event_submissions from public,anon,authenticated,service_role;
do $$ declare c record; begin
 for c in select column_name from information_schema.columns where table_schema='public' and table_name='event_submissions' loop
  execute format('revoke all (%I) on public.event_submissions from public,anon,authenticated,service_role',c.column_name);
 end loop;
end $$;
grant select on public.event_submissions to anon,authenticated;
-- All mutations, including Admin, go through checked definer contracts.
create function public.admin_write_event(p_action text,p_event uuid,p_fields jsonb default '{}'::jsonb) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare e public.event_submissions; updated public.event_submissions; b uuid;
begin
 if auth.uid() is null or not public.is_service_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_action is null or p_action not in ('create','edit','hide','restore','delete') then raise exception 'INVALID_ACTION'; end if;
 if p_fields is null or jsonb_typeof(p_fields)<>'object' or exists(select 1 from jsonb_object_keys(p_fields) k where k not in ('title','place','description','map_url','website_url','ticket_url','event_date','event_time','end_date','end_time','event_type','image_data','image_url','status')) then raise exception 'INVALID_FIELDS'; end if;
 if p_fields ? 'status' and (p_action<>'create' or p_fields->>'status' is distinct from 'approved') then raise exception 'STATUS_NOT_EDITABLE'; end if;
 if p_action<>'create' then
  select business_id into b from public.event_submissions where id=p_event;
  if b is not null then perform pg_advisory_xact_lock(hashtextextended('premium-events:'||b::text,0)); end if;
  select * into e from public.event_submissions where id=p_event for update;
  if e.id is null then raise exception 'EVENT_NOT_FOUND'; end if;
  if p_action='delete' then delete from public.event_submissions where id=e.id; return e.id; end if;
  if p_action='hide' then update public.event_submissions set status='hidden' where id=e.id; return e.id; end if;
  if p_action='restore' then
   if e.status<>'hidden' then raise exception 'HIDDEN_EVENT_REQUIRED'; end if;
   update public.event_submissions set status='approved' where id=e.id; return e.id;
  end if;
 end if;
 updated:=jsonb_populate_record(e,p_fields);
 if length(trim(coalesce(updated.title,''))) not between 1 and 160 or length(trim(coalesce(updated.place,''))) not between 1 and 240 then raise exception 'INVALID_FIELDS'; end if;
 if p_action='create' then
  insert into public.event_submissions(title,place,description,map_url,website_url,ticket_url,event_date,event_time,end_date,end_time,event_type,image_data,image_url,status)
  values(updated.title,updated.place,updated.description,updated.map_url,updated.website_url,updated.ticket_url,updated.event_date,updated.event_time,updated.end_date,updated.end_time,coalesce(updated.event_type,'Event'),updated.image_data,updated.image_url,'approved') returning id into p_event;
 else
  update public.event_submissions set title=updated.title,place=updated.place,description=updated.description,map_url=updated.map_url,website_url=updated.website_url,ticket_url=updated.ticket_url,event_date=updated.event_date,event_time=updated.event_time,end_date=updated.end_date,end_time=updated.end_time,event_type=updated.event_type,image_data=updated.image_data,image_url=updated.image_url where id=p_event;
 end if;
 return p_event;
end $$;
revoke all on function public.admin_write_event(text,uuid,jsonb) from public,anon,service_role;
grant execute on function public.admin_write_event(text,uuid,jsonb) to authenticated;
commit;
