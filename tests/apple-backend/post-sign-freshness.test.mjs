import test from 'node:test';
import assert from 'node:assert/strict';
import {integration} from './node-integration-fixtures.mjs';

for (const [name,delay,allowed] of [
  ['freshUntil minus 1 ms',59999,true],
  ['freshUntil exact',60000,false],
  ['freshUntil plus 1 ms',60001,false],
  ['valid throughout signing',1000,true],
  ['expires during signing',61000,false],
  ['clock rollback during signing',-1,false],
]) test(name,async()=>{
  const f=await integration(),sign=f.signer.sign.bind(f.signer);
  f.signer.sign=async claims=>{f.advance(delay);return sign(claims);};
  let response;
  if(allowed){response=await f.verify();assert.equal((await f.gate(response)).finishAllowed,true);}
  else await assert.rejects(async()=>{response=await f.verify();},e=>['NODE_RESPONSE_EXPIRED','VERIFICATION_CLOCK_ROLLBACK'].includes(e.code));
  if(!allowed)assert.equal(response,undefined);
  for(const key of ['deliveries','transactions','entitlements','assignments'])assert.equal(f.store.state[key].length,1,key);
  assert.equal(f.hooks.calls,1,'no automatic re-verification');
});

test('expired post-sign ack preserves delivery and explicit recovery reuses it',async()=>{
  const f=await integration(),sign=f.signer.sign.bind(f.signer);
  f.signer.sign=async claims=>{f.advance(61000);return sign(claims);};
  await assert.rejects(f.verify(),e=>e.code==='NODE_RESPONSE_EXPIRED');
  const id=f.store.state.deliveries[0].id;
  assert.equal(f.hooks.calls,1);
  f.signer.sign=sign;
  const recovered=await f.verify();
  assert.equal(recovered.delivery_id,id);
  assert.equal(recovered.status,'already_delivered');
  assert.equal((await f.gate(recovered)).finishAllowed,true);
  assert.equal(f.hooks.calls,2);
  for(const key of ['deliveries','transactions','entitlements','assignments'])assert.equal(f.store.state[key].length,1,key);
});
