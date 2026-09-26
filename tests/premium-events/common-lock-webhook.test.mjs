import test from 'node:test';import assert from 'node:assert/strict';import {createHmac} from 'node:crypto';
let handler,calls=[],failPatch=false,failRecord=false;
const id='00000000-0000-0000-0000-000000000001';
const env={STRIPE_WEBHOOK_SECRET:'synthetic-signature',STRIPE_SECRET_KEY:'synthetic-key',SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-role'};
globalThis.Deno={env:{get:k=>env[k]},serve:h=>handler=h};
const sub={id:'sub_synthetic',livemode:true,status:'active',current_period_end:2000000000,metadata:{submission_id:id,plan:'Premium',catalog:'android_v2'},items:{data:[{quantity:1,price:{currency:'usd',unit_amount:6799,recurring:{interval:'month',interval_count:1}}}]}};
globalThis.fetch=async(url,o={})=>{
 const u=String(url);calls.push({url:u,method:o.method||'GET',body:o.body});
 if(u.includes('/subscriptions/'))return Response.json(sub);
 if(u.includes('/payment_intents/'))return Response.json({latest_charge:{id:'ch_synthetic',amount:6799,currency:'usd',balance_transaction:{id:'txn_synthetic',fee:100,net:6699,currency:'usd'}}});
 if(u.includes('/charges/'))return Response.json({id:'ch_synthetic',amount:6799,currency:'usd',status:'succeeded',created:100});
 if(u.includes('record_stripe_authority'))return Response.json('applied');
 if(u.includes('stripe_patch_business'))return new Response('{}',{status:failPatch==='missing'?404:failPatch?503:200});
 if(u.includes('payment_records'))return new Response('{}',{status:failRecord?503:200});
 throw Error('UNEXPECTED_TRANSPORT '+u);
};
await import('../../supabase/functions/stripe-webhook/index.ts');
const send=type=>{
 const object=type.startsWith('customer.subscription.')?sub:{id:'cs_synthetic',subscription:sub.id,client_reference_id:id,metadata:sub.metadata,payment_intent:'pi_synthetic'};
 const body=JSON.stringify({id:'evt_synthetic',created:100,livemode:true,type,data:{object}}),t='2000000000',sig=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
 return handler(new Request('https://synthetic.invalid',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${sig}`},body}));
};
for(const [type,status,bySubscription] of [['checkout.session.completed','paid',false],['checkout.session.expired','expired',false],['invoice.payment_failed','failed',true],['customer.subscription.deleted','canceled',true]])test(`${type}: coordinated Business persistence, exact selector/status`,async()=>{
 calls=[];failPatch=false;failRecord=false;assert.equal((await send(type)).status,200);
 const patch=calls.find(x=>x.url.includes('stripe_patch_business'));assert(patch);const p=JSON.parse(patch.body);
 assert.equal(p.p_id,bySubscription?null:id);assert.equal(p.p_subscription,bySubscription?sub.id:null);assert.equal(p.p_changes.payment_status,status);
 assert.equal(calls.filter(x=>x.method==='PATCH').length,0);
});
test('projection rejection is not acknowledged as successful webhook',async()=>{
 calls=[];failPatch=true;failRecord=false;await assert.rejects(send('checkout.session.expired'),/BUSINESS_PAYMENT_PERSISTENCE_FAILED/);
});
test('payment-record rejection prevents projection and acknowledgment',async()=>{
 calls=[];failPatch=false;failRecord=true;await assert.rejects(send('checkout.session.completed'),/PAYMENT_RECORD_PERSISTENCE_FAILED/);
 assert.equal(calls.filter(x=>x.url.includes('stripe_patch_business')).length,0);
});
// Missing RPC is the accidental new-Edge/old-DB intermediate state. A DB write
// already completed earlier in this event may remain; retry uses receipt keys.
test('new Edge with old DB missing projection RPC does not acknowledge success',async()=>{
 calls=[];failPatch='missing';failRecord=false;
 await assert.rejects(send('checkout.session.expired'),/BUSINESS_PAYMENT_PERSISTENCE_FAILED/);
 assert.equal(calls.some(x=>x.method==='PATCH'),false);
});
