import {AppleError} from './domain.mjs';
// Inject a trusted server-side PostgREST RPC client. Never accept it from a request.
// Both RPCs are service-role-only and Sandbox-only; no per-table non-atomic writes.
export class PostgresAppleRepository {
  constructor(rpc) {this.rpc=rpc;}
  async read() {
    const {data,error}=await this.rpc('apple_ledger_snapshot',{});
    if(error)throw new AppleError('LEDGER_UNAVAILABLE',503);
    return data;
  }
  async compareAndSwap(version,state) {
    const {data,error}=await this.rpc('apple_ledger_compare_and_swap',{expected_version:version,next_state:state});
    if(error)throw new AppleError('LEDGER_COMMIT_FAILED',503);
    return data===true;
  }
}
