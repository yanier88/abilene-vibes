import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import {integration} from './node-integration-fixtures.mjs';
test('unrelated Stripe entitlement permits Apple and remains byte-for-byte intact',async()=>{
 const f=await integration();
 const stripe={id:'stripe-unrelated',listing_type:'business',listing_id:'other-listing',provider:'stripe',provider_reference:'synthetic-stripe',plan:'premium',status:'active',valid_from:new Date(f.now()-1000).toISOString(),valid_until:new Date(f.now()+86400000).toISOString(),environment:'Sandbox'};
 f.store.state.entitlements.push(structuredClone(stripe));
 const originalFetch=globalThis.fetch;let outbound=0;globalThis.fetch=()=>{outbound++;throw Error('Remote request forbidden');};
 try{await f.verify();assert.equal(outbound,0);}finally{globalThis.fetch=originalFetch;}
 assert.deepEqual(f.store.state.entitlements.filter(e=>e.provider==='stripe'),[stripe]);
 assert.equal(f.store.state.deliveries.length,1);
});
test('same-listing Stripe conflict rejects before Node verification and mutation',async()=>{
 const f=await integration();f.store.state.listings[0].stripe_conflict=true;
 const before=structuredClone(f.store.state);const calls=f.hooks.calls;
 await assert.rejects(f.verify(),e=>e.code==='STRIPE_CONFLICT');
 assert.deepEqual(f.store.state,before);assert.equal(f.hooks.calls,calls);
});
test('Stripe handlers have no Apple verifier or credential dependency',()=>{
 for(const p of ['supabase/functions/create-checkout-session/index.ts','supabase/functions/create-checkout-session/pricing.mjs','supabase/functions/stripe-webhook/index.ts','supabase/functions/payment-return/index.ts']){
  const s=fs.readFileSync(p,'utf8');assert.doesNotMatch(s,/NodeAppleVerifierClient|verifyAndDecodeTransaction|APPLE_PRIVATE_KEY|APPLE_ISSUER_ID|APPLE_KEY_ID/);
 }
});
