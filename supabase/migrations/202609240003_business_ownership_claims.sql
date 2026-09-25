begin;
-- Ownership must not be bypassed using non-RLS table operations.
revoke truncate,references,trigger,maintain on public.business_submissions from public,anon,authenticated;

create table public.business_ownership_claims (
 id uuid primary key default gen_random_uuid(),
 business_id uuid not null references public.business_submissions(id),
 claimant uuid not null references public.advertiser_profiles(user_id),
 evidence text not null check(length(trim(evidence)) between 10 and 2000),
 status text not null default 'pending' check(status in ('pending','approved','rejected')),
 created_at timestamptz not null default now(), reviewed_at timestamptz,
 reviewed_by uuid references auth.users(id), review_note text
);
create unique index business_claim_pending on public.business_ownership_claims(business_id,claimant) where status='pending';
create table public.business_ownership_audit (
 id uuid primary key default gen_random_uuid(), business_id uuid not null references public.business_submissions(id),
 old_owner uuid, new_owner uuid not null references public.advertiser_profiles(user_id),
 actor uuid not null references auth.users(id), claim_id uuid references public.business_ownership_claims(id),
 reason text not null check(length(trim(reason)) between 10 and 2000),
 transaction_id bigint not null default txid_current(), created_at timestamptz not null default now()
);
alter table public.business_ownership_claims enable row level security;
alter table public.business_ownership_audit enable row level security;
revoke all on public.business_ownership_claims,public.business_ownership_audit from public,anon,authenticated,service_role;
grant select on public.business_ownership_claims,public.business_ownership_audit to authenticated;
create policy claim_read on public.business_ownership_claims for select to authenticated using(claimant=auth.uid() or public.is_service_admin());
create policy ownership_audit_admin_read on public.business_ownership_audit for select to authenticated using(public.is_service_admin());
create or replace function public.advertiser_listing_identity_guard()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if TG_OP = 'INSERT' then
    if TG_TABLE_NAME='business_submissions' and auth.uid() is null and auth.role() is distinct from 'service_role' then
      raise exception 'AUTH_REQUIRED' using errcode='42501';
    end if;
    if auth.uid() is not null then
      perform public.ensure_advertiser_profile();
      new.advertiser_user_id := auth.uid();
      new.owner_user_id := auth.uid()::text;
    elsif auth.role() = 'service_role' and new.advertiser_user_id is not null then
      -- Only trusted server code may supply this marker after verifying Auth.
      -- Edge sanitizers must never copy advertiser_user_id from request payloads.
      if new.owner_user_id is distinct from new.advertiser_user_id::text then
        raise exception 'Verified ownership mismatch' using errcode = '42501';
      end if;
      insert into public.advertiser_profiles(user_id) values (new.advertiser_user_id)
      on conflict (user_id) do nothing;
    else
      new.advertiser_user_id := null;
    end if;
  else
    if new.advertiser_user_id is distinct from old.advertiser_user_id then
      if TG_TABLE_NAME<>'business_submissions' or not exists (
        select 1 from public.business_ownership_audit a
        where a.business_id=old.id and a.old_owner is not distinct from old.advertiser_user_id
        and a.new_owner=new.advertiser_user_id and a.actor=auth.uid()
        and a.transaction_id=txid_current() and public.is_service_admin()
      ) then raise exception 'Ownership claims are not enabled' using errcode='42501'; end if;
    end if;
    if old.advertiser_user_id is not null and new.advertiser_user_id is not distinct from old.advertiser_user_id and new.owner_user_id is distinct from old.owner_user_id then
      raise exception 'Authenticated ownership is immutable' using errcode = '42501';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.advertiser_listing_identity_guard() from public, anon, authenticated;


create function public.request_business_claim(p_business uuid,p_evidence text) returns uuid
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare result uuid; b public.business_submissions;
begin
 if auth.uid() is null then raise exception 'AUTH_REQUIRED' using errcode='42501'; end if;
 perform public.ensure_advertiser_profile();
 select * into b from public.business_submissions where id=p_business for update;
 if b.id is null or b.status<>'approved' or b.advertiser_user_id is not null then raise exception 'UNOWNED_APPROVED_BUSINESS_REQUIRED'; end if;
 select id into result from public.business_ownership_claims where business_id=p_business and claimant=auth.uid() and status='pending';
 if result is not null then return result; end if;
 insert into public.business_ownership_claims(business_id,claimant,evidence) values(p_business,auth.uid(),p_evidence) returning id into result;
 return result;
end $$;
create function public.review_business_claim(p_claim uuid,p_status text,p_note text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare c public.business_ownership_claims; b public.business_submissions;
begin
 if auth.uid() is null or not public.is_service_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 if p_status not in ('approved','rejected') or p_status is null or length(trim(coalesce(p_note,''))) not between 10 and 2000 then raise exception 'INVALID_REVIEW'; end if;
 select * into c from public.business_ownership_claims where id=p_claim;
 select * into b from public.business_submissions where id=c.business_id for update;
 select * into c from public.business_ownership_claims where id=p_claim for update;
 if c.id is null or c.status<>'pending' then raise exception 'PENDING_CLAIM_REQUIRED'; end if;
 if p_status='approved' then
  if b.advertiser_user_id is not null then raise exception 'OWNER_ALREADY_BOUND'; end if;
  if not exists(select 1 from public.advertiser_profiles where user_id=c.claimant) then raise exception 'PROFILE_REQUIRED'; end if;
  insert into public.business_ownership_audit(business_id,old_owner,new_owner,actor,claim_id,reason) values(b.id,null,c.claimant,auth.uid(),c.id,p_note);
  update public.business_submissions set advertiser_user_id=c.claimant,owner_user_id=c.claimant::text where id=b.id;
 end if;
 update public.business_ownership_claims set status=p_status,reviewed_by=auth.uid(),reviewed_at=now(),review_note=p_note where id=c.id;
end $$;
create function public.transfer_business_owner(p_business uuid,p_expected_owner uuid,p_new_owner uuid,p_reason text) returns void
language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare b public.business_submissions;
begin
 if auth.uid() is null or not public.is_service_admin() then raise exception 'ADMIN_REQUIRED' using errcode='42501'; end if;
 select * into b from public.business_submissions where id=p_business for update;
 if b.id is null or p_expected_owner is null or b.advertiser_user_id is distinct from p_expected_owner or p_new_owner is null or p_new_owner=p_expected_owner then raise exception 'TRANSFER_BINDING_MISMATCH'; end if;
 if not exists(select 1 from public.advertiser_profiles where user_id=p_new_owner) then raise exception 'PROFILE_REQUIRED'; end if;
 insert into public.business_ownership_audit(business_id,old_owner,new_owner,actor,reason) values(b.id,b.advertiser_user_id,p_new_owner,auth.uid(),p_reason);
 update public.business_submissions set advertiser_user_id=p_new_owner,owner_user_id=p_new_owner::text where id=b.id;
end $$;
revoke all on function public.request_business_claim(uuid,text),public.review_business_claim(uuid,text,text),public.transfer_business_owner(uuid,uuid,uuid,text) from public,anon,service_role;
grant execute on function public.request_business_claim(uuid,text),public.review_business_claim(uuid,text,text),public.transfer_business_owner(uuid,uuid,uuid,text) to authenticated;
commit;
