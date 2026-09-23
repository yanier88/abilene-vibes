-- LOCAL/staging preparation only. No general service-role credential for Node.
begin;
do $$ begin
 if not exists(select 1 from pg_roles where rolname='apple_replay_caller') then
  create role apple_replay_caller nologin;
 end if;
end $$;
create table if not exists public.apple_verifier_nonces (
 nonce_hash text primary key check(nonce_hash ~ '^[0-9a-f]{64}$'),
 request_hash text not null unique check(request_hash ~ '^[0-9a-f]{64}$'),
 body_hash text not null check(body_hash ~ '^[0-9a-f]{64}$'),
 expires_at timestamptz not null,
 created_at timestamptz not null default clock_timestamp(),
 check(expires_at >= created_at + interval '120 seconds')
);
alter table public.apple_verifier_nonces enable row level security;
revoke all on public.apple_verifier_nonces from public,anon,authenticated,service_role,apple_replay_caller;
create or replace function public.apple_verifier_claim_nonce(nonce_hash_input text,request_hash_input text,body_hash_input text)
returns boolean language plpgsql security definer set search_path=pg_catalog,public,pg_temp as $$
declare stamp timestamptz; inserted integer;
begin
 if nonce_hash_input is null or nonce_hash_input !~ '^[0-9a-f]{64}$'
 or request_hash_input is null or request_hash_input !~ '^[0-9a-f]{64}$'
 or body_hash_input is null or body_hash_input !~ '^[0-9a-f]{64}$' then
  raise exception 'INVALID_REPLAY_CLAIM';
 end if;
 -- Technical table only; serialization also makes expiry cleanup race-free.
 lock table public.apple_verifier_nonces in share row exclusive mode;
 stamp:=clock_timestamp();
 if exists(select 1 from public.apple_verifier_nonces where created_at>stamp) then
  raise exception 'REPLAY_CLOCK_ROLLBACK';
 end if;
 delete from public.apple_verifier_nonces where expires_at<=stamp;
 if (select count(*) from public.apple_verifier_nonces)>=100000 then
  raise exception 'REPLAY_CAPACITY';
 end if;
 insert into public.apple_verifier_nonces(nonce_hash,request_hash,body_hash,created_at,expires_at)
 values(nonce_hash_input,request_hash_input,body_hash_input,stamp,stamp+interval '120 seconds')
 on conflict do nothing;
 get diagnostics inserted=row_count;
 return inserted=1;
end $$;
revoke all on function public.apple_verifier_claim_nonce(text,text,text) from public,anon,authenticated,service_role;
grant usage on schema public to apple_replay_caller;
grant execute on function public.apple_verifier_claim_nonce(text,text,text) to apple_replay_caller;
commit;
