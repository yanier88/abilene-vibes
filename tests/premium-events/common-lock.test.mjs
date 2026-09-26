import test from 'node:test';
import assert from 'node:assert/strict';
import {randomUUID} from 'node:crypto';
import {spawn} from 'node:child_process';
import {sql,sqlAsync,auth,docker} from './pg.mjs';
import {business,apple,grant,grantSQL,admin,snapshot} from './common-lock-fixture.mjs';
const quote=v=>"'"+JSON.stringify(v).replaceAll("'","''")+"'";
const lock=id=>`select lock_commercial_listings('[{"listing_type":"business","listing_id":"${id}"}]');`;
function provider(kind,id,plan='premium'){
 if(kind==='Stripe')return `set local request.jwt.claim.role='service_role';select record_stripe_authority(${quote({subscription_id:'sub_'+randomUUID(),event_id:'evt_'+randomUUID(),listing_type:'business',listing_id:id,environment:'Production',plan,status:'active',period_end:'2099-01-01',event_created:1,cancel_at_period_end:false})});`;
 let fixture=apple(id,{entitlement:true});
 if(plan==='featured')fixture=fixture.replaceAll('premium','featured').replaceAll('synthetic-group','22382531');
 const s=JSON.parse(sql(`begin;${fixture}select apple_ledger_snapshot_production();rollback;`).split('\n').find(x=>x.startsWith('{')));
 return `select apple_ledger_compare_and_swap_production(${s.version},${quote(s.state)});`;
}
function session(){
 const tag='common_'+randomUUID();
 const p=spawn(docker,['exec','-i','abilene-premium-events-local','psql','-U','postgres','-d',process.env.PREMIUM_TEST_DB,'-XAt','-v','ON_ERROR_STOP=1']);
 let out='',err='';const done=new Promise(resolve=>p.on('close',code=>resolve({code,out,err})));
 p.stdin.on('error',e=>{if(e.code!=='EPIPE')throw e;});
 p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>err+=s);
 p.stdin.write(`set application_name='${tag}';set statement_timeout='12s';\n`);
 return {tag,send:q=>p.stdin.write(q+'\n'),wait:async marker=>{const until=Date.now()+10000;while(!out.includes(marker)){if(p.exitCode!==null)throw Error(err);if(Date.now()>until)throw Error('BARRIER_TIMEOUT '+marker);await new Promise(r=>setTimeout(r,10));}},close:async()=>{if(p.exitCode===null)p.stdin.end('rollback;\n');return done;}};
}
async function blocked(tag){const until=Date.now()+6000;while(Date.now()<until){if(sql(`select exists(select 1 from pg_stat_activity where application_name='${tag}' and cardinality(pg_blocking_pids(pid))>0)`)==='t')return;await new Promise(r=>setTimeout(r,10));}throw Error('WAIT_EDGE_NOT_OBSERVED');}
const asAdmin=q=>`set local request.jwt.claim.role='authenticated';set local request.jwt.claim.sub='${admin}';${q};`;
const active=id=>sql(`select count(*) from admin_comp_authority where business_id='${id}' and status='active'`);
for(const kind of ['Apple','Stripe']){
 for(const from of ['premium','featured'])for(const to of ['premium','featured'])test(`${kind}: ${from} COMP -> paid ${to}; history and projection`,()=>{
  const id=business(),key=grant(id,randomUUID(),from);sql('begin;'+provider(kind,id,to)+'commit;');
  assert.equal(active(id),'0');assert.equal(sql(`select status from admin_comp_authority where id='${key}'`),'superseded_paid');
  assert.equal(sql(`select count(*) from admin_comp_audit where grant_id='${key}' and action='paid_priority' and actor is null and provider='${kind.toLowerCase()}'`),'1');
  assert.equal(sql(`select lower(plan)||':'||placement_source from business_submissions where id='${id}'`),to+':'+kind.toLowerCase());
  assert.throws(()=>grant(id),/PAID_PROVIDER_BOUND/);
 });
 for(const action of ['grant','revoke','legacy_clear'])for(const first of ['COMP','provider'])test(`${kind} ${action} ${first} first: same listing barrier`,async()=>{
  const id=business(),key=randomUUID();
  if(action==='revoke')grant(id,key);if(action==='legacy_clear')sql(`update business_submissions set placement_source='comp',plan='Premium' where id='${id}'`);
  const paid=provider(kind,id),comp=asAdmin(action==='grant'?grantSQL(id,key):`select revoke_admin_comp('${id}',${action==='revoke'?`'${key}'`:'null'})`);
  const a=session(),b=session();
  try{
   a.send('begin;'+(first==='COMP'?comp:paid)+"select 'HELD';");await a.wait('HELD');
   b.send('begin;'+(first==='COMP'?paid:comp)+"select 'FINISHED';commit;");await blocked(b.tag);
   a.send("commit;select 'COMMITTED';");await a.wait('COMMITTED');
   const outcome=first==='provider'&&action!=='revoke'?'deny':'pass';
   if(outcome==='pass')await b.wait('FINISHED');
   else {const r=await b.close();assert.notEqual(r.code,0);assert.match(r.err,/PAID_PROVIDER_BOUND|LEGACY_COMP_REQUIRED/);}
   assert.equal(active(id),'0');
  }finally{await a.close();await b.close();}
 });
 test(`${kind}: different listing proceeds while COMP A holds its lock`,async()=>{
  const aId=business(),bId=business(),paid=provider(kind,bId),s=session();
  try{s.send('begin;'+asAdmin(grantSQL(aId))+"select 'HELD';");await s.wait('HELD');
   const result=await sqlAsync("begin;set local statement_timeout='2s';"+paid+'commit;');assert.match(result,/COMMIT/);
  }finally{await s.close();}
 });
 test(`${kind}: simultaneous paid/grant x10, no dual authority`,async()=>{
  for(let i=0;i<10;i++){const id=business(),paid=provider(kind,id);const r=await Promise.allSettled([sqlAsync('begin;'+paid+'commit;'),sqlAsync(auth(grantSQL(id),admin))]);assert.equal(r[0].status,'fulfilled');if(r[1].status==='rejected')assert.match(r[1].reason.message,/PAID_PROVIDER_BOUND/);assert.equal(active(id),'0');}
 });
}
for(const first of ['Apple','Stripe'])test(`cross provider ${first} first: serialize and preserve winner`,async()=>{
 const id=business(),ap=provider('Apple',id),sp=provider('Stripe',id),a=session(),b=session();
 try{a.send('begin;'+(first==='Apple'?ap:sp)+"select 'HELD';");await a.wait('HELD');
 b.send('begin;'+(first==='Apple'?sp:ap)+'commit;');await blocked(b.tag);a.send("commit;select 'COMMITTED';");await a.wait('COMMITTED');
 const r=await b.close();assert.notEqual(r.code,0);assert.match(r.err,/PAID_PROVIDER_RECONCILIATION_REQUIRED/);
 assert.equal(sql(`select count(*) from stripe_promotion_authority where listing_id='${id}'`),first==='Stripe'?'1':'0');
 assert.equal(sql(`select count(*) from listing_promotion_entitlements where listing_id='${id}'`),first==='Apple'?'1':'0');
 }finally{await a.close();await b.close();}
});
test('unchanged Apple snapshot including microsecond timestamps has empty commercial delta',()=>{
 const snap=JSON.parse(sql('select apple_ledger_snapshot_production()'));
 assert.equal(sql(`select commercial_apple_listings(commercial_apple_delta(${quote(snap.state)},'Production'),${quote(snap.state)})`),'[]');
});
test('stale Apple CAS refuses writes after common listing wait',async()=>{
 const id=business(),paid=provider('Apple',id),s=session();
 try{s.send('begin;'+lock(id)+"select 'HELD';");await s.wait('HELD');
 const writer=sqlAsync('begin;'+paid+'commit;');sql('update apple_ledger_revision set revision=revision+1 where id=1');
 s.send("commit;select 'COMMITTED';");await s.wait('COMMITTED');assert.match(await writer,/\nf\n/);
 assert.equal(sql(`select count(*) from apple_purchase_intents where listing_id='${id}'`),'0');
 }finally{await s.close();}
});
test('statement timeout rolls back authority and audit; lock release after abort',async()=>{
 const id=business(),s=session();try{s.send('begin;'+lock(id)+"select 'HELD';");await s.wait('HELD');
 await assert.rejects(sqlAsync(auth(grantSQL(id),admin).replace('begin;',"begin;set local statement_timeout='150ms';")),/statement timeout/);
 assert.equal(active(id),'0');assert.equal(sql(`select count(*) from admin_comp_audit where business_id='${id}'`),'0');
 }finally{await s.close();}grant(id);assert.equal(active(id),'1');
});
test('explicit transaction rollback preserves Business, audit and authority',()=>{
 const id=business(),before=snapshot(id);sql(auth(grantSQL(id),admin).replace('commit;','rollback;'));
 assert.equal(snapshot(id),before);assert.equal(active(id),'0');assert.equal(sql(`select count(*) from admin_comp_audit where business_id='${id}'`),'0');
});
test('x10 idempotent grant and repeated revoke preserve exactly one audit per action',async()=>{
 const id=business(),key=randomUUID();await Promise.all(Array.from({length:10},()=>sqlAsync(auth(grantSQL(id,key),admin))));
 await Promise.all(Array.from({length:10},()=>sqlAsync(auth(`select revoke_admin_comp('${id}','${key}')`,admin))));
 assert.equal(sql(`select count(*) from admin_comp_audit where grant_id='${key}'`),'2');
});
test('multi-listing helper orders reversed payloads identically without deadlock',async()=>{
 const ids=[business(),business()],payload=x=>quote(x.map(id=>({listing_type:'business',listing_id:id})));
 const a=session(),b=session();try{
 a.send(`begin;select lock_commercial_listings(${payload(ids)});select 'HELD';`);await a.wait('HELD');
 b.send(`begin;select lock_commercial_listings(${payload([...ids].reverse())});select 'FINISHED';commit;`);await blocked(b.tag);
 a.send("commit;select 'COMMITTED';");await a.wait('COMMITTED');await b.wait('FINISHED');
 }finally{await a.close();await b.close();}
});
test('client cancellation rolls back a completed grant and its audit atomically',async()=>{
 const id=business(),other=business(),a=session(),b=session();try{
 a.send('begin;'+lock(other)+"select 'HELD';");await a.wait('HELD');
 b.send('begin;'+asAdmin(grantSQL(id))+lock(other)+'commit;');await blocked(b.tag);
 assert.equal(sql(`select pg_cancel_backend(pid) from pg_stat_activity where application_name='${b.tag}'`),'t');
 const r=await b.close();assert.notEqual(r.code,0);assert.match(r.err,/canceling statement due to user request/);
 assert.equal(active(id),'0');assert.equal(sql(`select count(*) from admin_comp_audit where business_id='${id}'`),'0');
 }finally{await a.close();await b.close();}
});
test('deliberately inverted external transactions: deadlock victim leaves no partial grant/audit',async()=>{
 const x=business(),y=business(),a=session(),b=session();try{
 a.send('begin;'+asAdmin(grantSQL(x))+"select 'A';");b.send('begin;'+asAdmin(grantSQL(y))+"select 'B';");await a.wait('A');await b.wait('B');
 a.send(lock(y)+'commit;');await blocked(a.tag);b.send(lock(x)+'commit;');
 const r=await Promise.all([a.close(),b.close()]);assert.equal(r.filter(x=>x.code===0).length,1);assert.equal(r.filter(x=>/deadlock detected/.test(x.err)).length,1);
 assert.equal(sql(`select count(*) from admin_comp_authority where business_id in ('${x}','${y}')`),'1');
 assert.equal(sql(`select count(*) from admin_comp_audit where business_id in ('${x}','${y}')`),'1');
 }finally{await a.close();await b.close();}
});
test('old in-flight Apple order fails NOWAIT instead of waiting ledger -> listing',async()=>{
 const id=business(),a=session(),b=session(),q=apple(id,{authorization:true});try{
 a.send('begin;'+lock(id)+"select 'HELD';");await a.wait('HELD');
 b.send('begin;select revision from apple_ledger_revision for update;'+q+'commit;');
 const r=await b.close();assert.notEqual(r.code,0);assert.match(r.err,/could not obtain lock/);
 assert.equal(sql(`select count(*) from apple_listing_authorizations where listing_id='${id}'`),'0');
 }finally{await a.close();await b.close();}
});
test('Stripe receipt retry preserves exactly one paid-priority audit',()=>{
 const id=business(),key=grant(id),p=provider('Stripe',id);sql('begin;'+p+'commit;');sql('begin;'+p+'commit;');
 assert.equal(sql(`select count(*) from admin_comp_audit where grant_id='${key}'`),'2');
 assert.equal(sql(`select count(*) from stripe_authority_receipts where snapshot->>'listing_id'='${id}'`),'1');
});
test('Stripe subscription-wide projection locks ordered UUIDs and preserves unrelated fields',()=>{
 const ids=[business(),business()],sub='sub_'+randomUUID();sql(`update business_submissions set stripe_subscription_id='${sub}' where id in ('${ids[0]}','${ids[1]}')`);
 sql(`begin;set local request.jwt.claim.role='service_role';select stripe_patch_business(null,'${sub}','{"payment_status":"canceled"}');commit;`);
 assert.equal(sql(`select count(*) from business_submissions where stripe_subscription_id='${sub}' and payment_status='canceled' and status='approved' and plan='Free'`),'2');
 assert.throws(()=>sql(`begin;set local request.jwt.claim.role='service_role';select stripe_patch_business('${ids[0]}',null,'{"plan":"Premium"}');commit;`),/STRIPE_PATCH_INVALID/);
});
test('unprivileged callers cannot invoke internal protocol or Stripe projection',()=>{
 for(const role of ['anon','authenticated'])for(const fn of ["lock_commercial_listings('[]')","stripe_patch_business(null,'sub_synthetic','{}')"])
  assert.throws(()=>sql(`set role ${role};select ${fn}`),/permission denied/);
});
for(const kind of ['Apple','Stripe'])test(`${kind} holds A: COMP B still commits independently`,async()=>{
 const x=business(),y=business(),paid=provider(kind,x),a=session();try{
 a.send('begin;'+paid+"select 'HELD';");await a.wait('HELD');
 await sqlAsync(auth(grantSQL(y),admin).replace('begin;',"begin;set local statement_timeout='2s';"));assert.equal(active(y),'1');
 }finally{await a.close();}
});
test('full Apple snapshot of existing A does not lock A when CAS changes only B',async()=>{
 const x=business(),y=business();sql('begin;'+provider('Apple',x)+'commit;');const paid=provider('Apple',y),a=session();try{
 a.send('begin;'+lock(x)+"select 'HELD';");await a.wait('HELD');
 await sqlAsync("begin;set local statement_timeout='2s';"+paid+'commit;');
 assert.equal(sql(`select count(*) from listing_promotion_entitlements where listing_id='${y}'`),'1');
 }finally{await a.close();}
});
test('legacy payment UPSERT waits for COMP Business and makes COMP fallback ineffective',async()=>{
 const id=business(),a=session(),b=session();try{
 a.send('begin;'+asAdmin(grantSQL(id))+"select 'HELD';");await a.wait('HELD');
 b.send(`begin;insert into payment_records(business_submission_id,status,stripe_charge_id)values('${id}','paid','ch_${id}') on conflict(stripe_charge_id)do update set status=excluded.status;select 'FINISHED';commit;`);await blocked(b.tag);
 a.send("commit;select 'COMMITTED';");await a.wait('COMMITTED');await b.wait('FINISHED');
 assert.equal(sql(`select admin_comp_payment_conflict('${id}')`),'t');assert.throws(()=>grant(id),/PAID_PROVIDER_BOUND/);
 }finally{await a.close();await b.close();}
});
test('legacy single Business checkout binding waits on common lock and blocks subsequent COMP',async()=>{
 const id=business(),a=session(),b=session();try{
 a.send('begin;'+asAdmin(grantSQL(id))+"select 'HELD';");await a.wait('HELD');
 b.send(`begin;update business_submissions set stripe_session_id='cs_synthetic',payment_status='checkout_started' where id='${id}';select 'FINISHED';commit;`);await blocked(b.tag);
 a.send("commit;select 'COMMITTED';");await a.wait('COMMITTED');await b.wait('FINISHED');assert.throws(()=>grant(id),/PAID_PROVIDER_BOUND/);
 }finally{await a.close();await b.close();}
});
for(const kind of ['job','rental'])test(`Stripe ${kind}: shared UUID lock preserves non-Business authority semantics`,()=>{
 const id=randomUUID();sql(`insert into ${kind}_listings(id,status,payment_status,plan)values('${id}','approved','paid','Premium')`);
 const p=provider('Stripe',id).replace('"listing_type":"business"',`"listing_type":"${kind}"`);
 sql('begin;'+p+'commit;');assert.equal(sql(`select listing_type||':'||status from stripe_promotion_authority where listing_id='${id}'`),kind+':active');
 assert.equal(sql(`select count(*) from admin_comp_audit where business_id='${id}'`),'0');
});
for(const kind of ['Apple','Stripe'])test(`${kind}: error after paid transition atomically restores COMP and audit`,()=>{
 const id=business(),key=grant(id),before=snapshot(id),paid=provider(kind,id),revision=sql('select revision from apple_ledger_revision');
 assert.throws(()=>sql('begin;'+paid+'select 1/0;commit;'),/division by zero/);
 assert.equal(snapshot(id),before);assert.equal(active(id),'1');assert.equal(sql(`select count(*) from admin_comp_audit where grant_id='${key}'`),'1');
 assert.equal(sql(`select count(*) from stripe_promotion_authority where listing_id='${id}'`),'0');
 assert.equal(sql(`select count(*) from listing_promotion_entitlements where listing_id='${id}'`),'0');assert.equal(sql('select revision from apple_ledger_revision'),revision);
});
for(const kind of ['Apple','Stripe'])for(const action of ['revoke','legacy_clear'])for(const first of ['COMP','provider'])test(`${kind} different listing ${action}, ${first} held: independent progress`,async()=>{
 const x=business(),y=business(),compId=first==='COMP'?x:y,paidId=first==='COMP'?y:x,key=randomUUID();
 if(action==='revoke')grant(compId,key);else sql(`update business_submissions set placement_source='comp',plan='Premium' where id='${compId}'`);
 const comp=asAdmin(`select revoke_admin_comp('${compId}',${action==='revoke'?`'${key}'`:'null'})`),paid=provider(kind,paidId),s=session();try{
 s.send('begin;'+(first==='COMP'?comp:paid)+"select 'HELD';");await s.wait('HELD');
 await sqlAsync("begin;set local statement_timeout='2s';"+(first==='COMP'?paid:comp)+'commit;');
 }finally{await s.close();}
});
test('real Apple multi-listing CAS with reversed arrays: one winning revision, no partial second write',async()=>{
 const ids=[business(),business()];const s=JSON.parse(sql('begin;'+ids.map(id=>apple(id,{entitlement:true})).join('')+'select apple_ledger_snapshot_production();rollback;').split('\n').find(x=>x.startsWith('{')));
 const reversed=Object.fromEntries(Object.entries(s.state).map(([k,v])=>[k,Array.isArray(v)?[...v].reverse():v]));
 const results=await Promise.all([s.state,reversed].map(state=>sqlAsync(`begin;select apple_ledger_compare_and_swap_production(${s.version},${quote(state)});commit;`)));
 assert.equal(results.filter(r=>/\nt\n/.test(r)).length,1);assert.equal(results.filter(r=>/\nf\n/.test(r)).length,1);
 assert.equal(sql(`select count(*) from listing_promotion_entitlements where listing_id in ('${ids[0]}','${ids[1]}')`),'2');
});
