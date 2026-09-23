-- Phase71 LOCAL ONLY. Not applied to any database in this phase.
-- Business backend-only wrapper: Node verifier never receives this privilege.
create function public.apple_ledger_compare_and_swap_verified(
 expected_version bigint, next_state jsonb, verification_not_after timestamptz
) returns boolean language plpgsql security definer
set search_path=pg_catalog,public,pg_temp as $$
declare applied boolean;
begin
 if verification_not_after is null or verification_not_after <= clock_timestamp()
    or verification_not_after > clock_timestamp()+interval '60 seconds' then
   raise exception 'VERIFICATION_EXPIRED_AT_COMMIT';
 end if;
 applied:=public.apple_ledger_compare_and_swap(expected_version,next_state);
 -- If waiting for the revision lock/writing consumed the window, raising rolls
 -- back ALL writes from the nested function in this transaction.
 if verification_not_after <= clock_timestamp() then
   raise exception 'VERIFICATION_EXPIRED_AT_COMMIT';
 end if;
 return applied;
end; $$;
revoke all on function public.apple_ledger_compare_and_swap_verified(bigint,jsonb,timestamptz) from public,anon,authenticated;
grant execute on function public.apple_ledger_compare_and_swap_verified(bigint,jsonb,timestamptz) to service_role;
