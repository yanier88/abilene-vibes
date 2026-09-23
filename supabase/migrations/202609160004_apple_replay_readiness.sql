-- LOCAL/staging preparation. Readiness exposes no nonce or business data.
begin;
create or replace function public.apple_verifier_replay_ready()
returns boolean language sql security definer set search_path=pg_catalog,public,pg_temp
as $$ select count(*)>=0 from (select 1 from public.apple_verifier_nonces limit 1) t $$;
revoke all on function public.apple_verifier_replay_ready() from public,anon,authenticated,service_role;
grant execute on function public.apple_verifier_replay_ready() to apple_replay_caller;
-- PostgREST must be able to assume this restricted role from its verified JWT.
do $$ begin
 if exists(select 1 from pg_roles where rolname='authenticator') then
  grant apple_replay_caller to authenticator;
 end if;
end $$;
commit;
