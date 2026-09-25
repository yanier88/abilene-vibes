import test from 'node:test';
import assert from 'node:assert/strict';
import {createHmac} from 'node:crypto';
let handler, current, authority, calls, job, seen, wrongBinding=false;
const id='00000000-0000-0000-0000-000000000055';
const env={STRIPE_WEBHOOK_SECRET:'unit-only-secret',STRIPE_SECRET_KEY:'unit-only-key',SUPABASE_URL:'https://unit.invalid',SUPABASE_SERVICE_ROLE_KEY:'unit-only-role'};
globalThis.Deno={env:{get:k=>env[k]},serve:h=>handler=h};
function reset(){
 current={id:'sub_job',livemode:true,status:'active',current_period_end:2000000000,metadata:{listing_type:'job',job_id:id,plan:'Premium',catalog:'android_v2'},items:{data:[{quantity:1,price:{currency:'usd',unit_amount:6799,recurring:{interval:'month',interval_count:1}}}]}};
 authority=null;calls=[];seen=new Set();wrongBinding=false;job={status:'approved',payment_status:'paid'};
}
// Transport mock exercises the real signed handler; PostgreSQL ordering is tested separately.
globalThis.fetch=async(url,options={})=>{
 const u=String(url);calls.push({url:u,method:options.method||'GET',body:options.body});
 if(u.includes('/subscriptions/'))return Response.json(current);
 if(u.includes('/invoices/'))return Response.json({id:'in_unit',subscription:current.id,metadata:current.metadata,created:100,status_transitions:{paid_at:100}});
 if(u.includes('record_stripe_authority')){
  const {p}=JSON.parse(options.body);
  if(seen.has(p.event_id))return Response.json('duplicate');seen.add(p.event_id);
  if(authority&&(authority.status==='canceled'||p.event_created<authority.event_created))return Response.json('ignored');
  if(authority&&p.event_created===authority.event_created)return Response.json('same_timestamp');
  authority=p;return Response.json('applied');
 }
 if(u.includes('/job_listings')&&options.method==='PATCH'){Object.assign(job,JSON.parse(options.body));return Response.json({});}
 if(u.includes('/job_listings'))return Response.json([{id:wrongBinding?'00000000-0000-0000-0000-000000000099':id}]);
 if(u.includes('/business_submissions')&&!options.method)return Response.json([]);
 if(u.includes('api.stripe.com'))return Response.json({});
 throw Error('Unexpected transport '+u);
};
await import('../../supabase/functions/stripe-webhook/index.ts');
async function send(type,created=100,eventId=`evt_${type}_${created}`){
 const object=type.startsWith('invoice.')?{id:'in_unit',subscription:current.id,metadata:current.metadata}:current;
 const body=JSON.stringify({id:eventId,type,created,livemode:true,data:{object}}),t='2000000000';
 const signature=createHmac('sha256',env.STRIPE_WEBHOOK_SECRET).update(`${t}.${body}`).digest('hex');
 return handler(new Request('https://unit.invalid',{method:'POST',headers:{'stripe-signature':`t=${t},v1=${signature}`},body}));
}
const patches=()=>calls.filter(x=>x.method==='PATCH');
test('active Job update preserves normal visibility',async()=>{reset();assert.equal((await send('customer.subscription.updated')).status,200);assert.equal(job.status,'approved');assert.equal(patches().length,0);});
test('scheduled cancellation does not prematurely hide active Job',async()=>{reset();current.cancel_at_period_end=true;assert.equal((await send('customer.subscription.updated')).status,200);assert.equal(job.status,'approved');assert.equal(authority.status,'active');assert.equal(patches().length,0);});
test('terminal deletion preserves exact Production Job patch',async()=>{reset();current.status='canceled';assert.equal((await send('customer.subscription.deleted',200)).status,200);assert.deepEqual(job,{payment_status:'canceled',status:'hidden'});assert.deepEqual(JSON.parse(patches()[0].body),{payment_status:'canceled',status:'hidden'});});
test('duplicate terminal deletion is idempotent',async()=>{reset();current.status='canceled';await send('customer.subscription.deleted',200);await send('customer.subscription.deleted',200);assert.deepEqual(job,{payment_status:'canceled',status:'hidden'});assert.equal(seen.size,1);});
test('older paid after terminal cannot revive Job or paid status',async()=>{reset();current.status='canceled';await send('customer.subscription.deleted',200);calls=[];await send('invoice.paid',100);assert.deepEqual(job,{payment_status:'canceled',status:'hidden'});assert.equal(patches().length,0);});
test('older active update after terminal remains canceled',async()=>{reset();current.status='canceled';await send('customer.subscription.deleted',200);current.status='active';calls=[];await send('customer.subscription.updated',100);assert.deepEqual(job,{payment_status:'canceled',status:'hidden'});assert.equal(patches().length,0);});
test('newer event cannot resurrect same terminal subscription',async()=>{reset();current.status='canceled';await send('customer.subscription.deleted',200);current.status='active';calls=[];await send('invoice.paid',300);assert.deepEqual(job,{payment_status:'canceled',status:'hidden'});assert.equal(patches().length,0);});
test('payment failure preserves Production failed status without hiding',async()=>{reset();current.status='past_due';assert.equal((await send('invoice.payment_failed')).status,200);assert.deepEqual(job,{status:'approved',payment_status:'failed'});});
test('genuinely newer active payment recovers nonterminal past_due',async()=>{reset();current.status='past_due';await send('invoice.payment_failed',100);current.status='active';assert.equal((await send('invoice.paid',200)).status,200);assert.equal(job.payment_status,'paid');assert.equal(job.status,'approved');assert.equal(authority.status,'active');});
test('wrong Job binding fails closed before any Job patch',async()=>{reset();current.status='canceled';wrongBinding=true;assert.equal((await send('customer.subscription.deleted')).status,503);assert.equal(patches().length,0);});
