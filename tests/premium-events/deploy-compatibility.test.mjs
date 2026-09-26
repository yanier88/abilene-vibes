// Actual v24 source (hash pinned to the last read-only remote download), signed
// HTTP event path, synthetic transport and real disposable PostgreSQL protocol.
import test from 'node:test';import assert from 'node:assert/strict';import {createHash,createHmac,randomUUID} from 'node:crypto';
import {execFileSync} from 'node:child_process';import {stripTypeScriptTypes} from 'node:module';import {pathToFileURL} from 'node:url';import {resolve} from 'node:path';
import {sql,file,service} from './pg.mjs';
process.env.COMMON_DEPLOY_BASELINE_ONLY='1';const {business}=await import('./common-lock-fixture.mjs');file('supabase/migrations/202609250002_commercial_listing_protocol.sql');
const old=execFileSync('git',['show','9d54e5155fb6f995ec9faa8bae06e6461e0e26b9:supabase/functions/stripe-webhook/index.ts'],{encoding:'utf8'});
assert.equal(createHash('sha256').update(old).digest('hex'),'3363964718be632769eac56c2366815f5fd671aa127bd4fb41c9868a0c5c6b0d');
let handler;const env={STRIPE_WEBHOOK_SECRET:'synthetic-only',STRIPE_SECRET_KEY:'synthetic-key',SUPABASE_URL:'https://synthetic.invalid',SUPABASE_SERVICE_ROLE_KEY:'synthetic-role'};
globalThis.Deno={env:{get:k=>env[k]},serve:h=>handler=h};
const id=business();const sub={id:'sub_'+randomUUID(),livemode:true,status:'active',current_period_end:2000000000,metadata:{submission_id:id,plan:'Premium',catalog:'android_v2'},items:{data:[{quantity:1,price:{currency:'usd',unit_amount:6799,recurring:{interval:'month',interval_count:1}}}]}};
let authorityWrites=0,patches=0;
const literal=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'";
globalThis.fetch=async(url,o={})=>{
 const u=String(url);if(u.includes('api.stripe.com'))return Response.json(sub);
 if(u.includes('record_stripe_authority')){try{const p=JSON.parse(o.body).p;sql(service(`select record_stripe_authority(${literal(p)}::jsonb)`));authorityWrites++;return Response.json('applied');}catch{return new Response('{}',{status:409});}}
 if(u.includes('/business_submissions')&&o.method==='PATCH'){
  const p=JSON.parse(o.body);assert.deepEqual(Object.keys(p),['payment_status']);
  // Production service_role REST writes bypass RLS; keep the fixture's global
  // role unchanged and reproduce that privilege with the local DB owner.
  sql(`begin;set local request.jwt.claim.role='service_role';update business_submissions set payment_status=(${literal(p)}::jsonb->>'payment_status') where id='${id}';commit;`);patches++;return Response.json({});
 }
 throw Error('UNEXPECTED_TRANSPORT');
};
const code=stripTypeScriptTypes(old).replace('"./authority.mjs"',JSON.stringify(pathToFileURL(resolve('supabase/functions/stripe-webhook/authority.mjs')).href));
await import('data:text/javascript;base64,'+Buffer.from(code).toString('base64'));
const send=type=>{const object=type==='checkout.session.expired'?{id:'cs_synthetic',client_reference_id:id,metadata:sub.metadata}:sub;
 const body=JSON.stringify({id:'evt_'+randomUUID(),created:100,livemode:true,type,data:{object}}),t=String(Math.floor(Date.now()/1000)),sig=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
 return handler(new Request('https://synthetic.invalid',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${sig}`},body}));};
test('old deployed v24 signed subscription event uses new DB protocol while COMP disabled',async()=>{
 assert.equal((await send('customer.subscription.updated')).status,200);assert.equal(authorityWrites,1);
 assert.equal(sql(`select count(*) from stripe_promotion_authority where listing_id='${id}'`),'1');
 assert.equal(sql('select count(*) from admin_comp_authority'),'0');
 assert.equal(sql('select activated_at is null from commercial_deploy.protocol'),'t');
});
test('old deployed v24 direct Business PATCH remains compatible with new row guard',async()=>{
 assert.equal((await send('checkout.session.expired')).status,200);assert.equal(patches,1);
 assert.equal(sql(`select payment_status from business_submissions where id='${id}'`),'expired');
 assert.equal(sql('select count(*) from admin_comp_authority'),'0');
});
