import {Buffer} from 'node:buffer';
import {POLICY,sha,time,demand,Reject,isVerified,verifyOcsp} from './ocsp.mjs';
export const cacheKey=c=>JSON.stringify([sha(c.certificateDer),sha(c.issuerDer),c.environment,POLICY.version]);
export class VerifiedCache{
 #entries=new Map();#pending=new Map();#last=-Infinity;#epoch=0;
 constructor(clock){this.clock=clock;}
 #now(){const n=time(this.clock());if(n<this.#last){this.#entries.clear();this.#epoch++;throw new Reject('CLOCK_ROLLBACK');}this.#last=n;return n;}
 get size(){return this.#entries.size;}get pendingCount(){return this.#pending.size;}
 read(context){const n=this.#now(),key=cacheKey(context),r=this.#entries.get(key);if(!r)return null;if(n>=r.freshUntil||n<r.evaluatedAt){this.#entries.delete(key);return null;}return r;}
 async getOrRefresh(context,loader){
 context={certificateDer:Buffer.from(context.certificateDer),issuerDer:Buffer.from(context.issuerDer),environment:context.environment};
 const hit=this.read(context);if(hit)return hit;const key=cacheKey(context);if(this.#pending.has(key))return this.#pending.get(key);
 demand(this.#pending.size<32,'PENDING_CAPACITY');const epoch=this.#epoch;
 const promise=Promise.resolve().then(async()=>{
  const responseDer=await loader();const n=this.#now();demand(epoch===this.#epoch,'CLOCK_ROLLBACK');
  // The cache cannot accept a caller-supplied "verified" boolean or object.
  const r=await verifyOcsp({...context,responseDer,evaluationTime:n});
  const after=this.#now();demand(epoch===this.#epoch&&isVerified(r)&&r.status==='GOOD'&&after<r.freshUntil,'REVERIFY_REQUIRED');
  demand(cacheKey({certificateDer:context.certificateDer,issuerDer:context.issuerDer,environment:r.environment})===key,'CACHE_SCOPE');
  if(this.#entries.size>=32)this.#entries.delete(this.#entries.keys().next().value);
  this.#entries.set(key,r);return r;
 }).finally(()=>this.#pending.delete(key));this.#pending.set(key,promise);return promise;
 }
}
