import {AppleError} from './domain.mjs';
// Inject a trusted server-side PostgREST RPC client. Never accept it from a request.
// Both RPCs are service-role-only and Sandbox-only; no per-table non-atomic writes.
export class PostgresAppleRepository {
  constructor(rpc,{environment='Sandbox'}={}) {if(!['Sandbox','Production'].includes(environment))throw new AppleError('ENVIRONMENT_DISABLED');this.rpc=rpc;this.suffix=environment==='Production'?'_production':'';}
  async read() {
    const {data,error}=await this.rpc('apple_ledger_snapshot'+this.suffix,{});
    if(error)throw new AppleError('LEDGER_UNAVAILABLE',503);
    return data;
  }
  async compareAndSwap(version,state,{notAfter}={}) {
    if(notAfter!==undefined && !Number.isSafeInteger(notAfter))throw new AppleError('VERIFICATION_DEADLINE_INVALID',503);
    const guarded=notAfter!==undefined;
    const {data,error}=await this.rpc((guarded?'apple_ledger_compare_and_swap_verified':'apple_ledger_compare_and_swap')+this.suffix,{expected_version:version,next_state:state,...(guarded?{verification_not_after:new Date(notAfter).toISOString()}:{})});
    if(error){const failure=new AppleError('LEDGER_COMMIT_FAILED',503);
      // SQL rejection proves rollback; transport/adapter failures can lose a commit response.
      failure.commitState=['23503','23505','23514','40001','40P01','P0001'].includes(error.code)?'ROLLED_BACK':'UNKNOWN';
      throw failure;}
    return data===true;
  }
}
