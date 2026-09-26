import test from 'node:test';import assert from 'node:assert/strict';import {readFileSync} from 'node:fs';import {randomUUID} from 'node:crypto';import {spawn} from 'node:child_process';
import {sql,docker} from './pg.mjs';
process.env.COMMON_DEPLOY_BASELINE_ONLY='1';
const {business,apple}=await import('./common-lock-fixture.mjs');
const two=readFileSync('supabase/migrations/202609250002_commercial_listing_protocol.sql','utf8').replace(/^begin;/m,'').replace(/^commit;/m,'');
const three=readFileSync('supabase/migrations/202609250003_admin_comp_protocol_activation.sql','utf8').replace(/^begin;/m,'').replace(/^commit;/m,'');
const quoted=x=>"'"+JSON.stringify(x).replaceAll("'","''")+"'";
function session(){const tag='deploy_'+randomUUID();const p=spawn(docker,['exec','-i','abilene-premium-events-local','psql','-U','postgres','-d',process.env.PREMIUM_TEST_DB,'-XAt','-v','ON_ERROR_STOP=1']);let out='',err='';const done=new Promise(r=>p.on('close',code=>r({code,out,err})));p.stdout.on('data',s=>out+=s);p.stderr.on('data',s=>err+=s);p.stdin.on('error',()=>{});p.stdin.write(`set application_name='${tag}';set statement_timeout='20s';\n`);return {tag,send:q=>p.stdin.write(q+'\n'),wait:async m=>{const until=Date.now()+15000;while(!out.includes(m)){if(p.exitCode!==null)throw Error(err);if(Date.now()>until)throw Error('BARRIER_TIMEOUT');await new Promise(r=>setTimeout(r,10));}},close:async()=>{if(p.exitCode===null)p.stdin.end('rollback;\n');return done;}};}
async function blocked(tag){const until=Date.now()+10000;while(Date.now()<until){if(sql(`select exists(select 1 from pg_stat_activity where application_name='${tag}' and cardinality(pg_blocking_pids(pid))>0)`)==='t')return;await new Promise(r=>setTimeout(r,10));}throw Error('LOCK_WAIT_NOT_OBSERVED');}
const originalApple=sql("select pg_get_functiondef('apple_ledger_compare_and_swap_production(bigint,jsonb)'::regprocedure)");
const originalStripe=sql("select pg_get_functiondef('record_stripe_authority(jsonb)'::regprocedure)");
const stripePayload=id=>({subscription_id:'sub_'+randomUUID(),event_id:'evt_'+randomUUID(),listing_type:'business',listing_id:id,environment:'Production',plan:'premium',status:'active',period_end:'2099-01-01',event_created:1,cancel_at_period_end:false});
test('transition fence timeout rolls back protocol installation, leaves COMP disabled',async()=>{
 const old=session();try{old.send("begin;select revision from apple_ledger_revision where id=1 for update;select 'HELD';");await old.wait('HELD');
 assert.throws(()=>sql('begin;'+two.replace("lock_timeout='5s'","lock_timeout='50ms'")+'commit;'),/lock timeout/);
 assert.equal(sql("select to_regnamespace('commercial_deploy') is null"),'t');
 assert.equal(sql("select to_regprocedure('lock_commercial_listings(jsonb,boolean)') is null"),'t');
 assert.equal(sql("select pg_get_functiondef('apple_ledger_compare_and_swap_production(bigint,jsonb)'::regprocedure)"),originalApple);
 }finally{await old.close();}
});
test('actual OLD Apple CAS and Stripe RPC drain before protocol COMMIT; dormant old body cannot bypass new trigger',async()=>{
 const stripeId=business(),dormantId=business(),dormantAppleId=business();
 const dormantSnapshot=JSON.parse(sql(`begin;${apple(dormantAppleId,{entitlement:true})}select apple_ledger_snapshot_production();rollback;`).split("\n").find(x=>x.startsWith("{")));
 const snap=JSON.parse(sql('select apple_ledger_snapshot_production()'));
 // Instrument only pauses. The old deployed function bodies, args and writes remain.
 assert.match(originalApple,/where id=1 for update;/);
 sql(originalApple.replace(/begin\n/i,"begin\n if current_setting('application_name') like 'dormant_apple_%' then perform pg_advisory_xact_lock(98104);end if;\n").replace('where id=1 for update;',"where id=1 for update; if current_setting('application_name') not like 'dormant_apple_%' then perform pg_advisory_xact_lock(98101);end if;"));
 sql(originalStripe.replace(/begin\n/i,"begin\n if current_setting('application_name') like 'dormant_%' then perform pg_advisory_xact_lock(98103); else perform 1 from stripe_promotion_authority for update; perform pg_advisory_xact_lock(98102);end if;\n"));
 const barriers=session(),ap=session(),sp=session(),dormant=session(),dormantApple=session(),ddl=session(),listing=session();
 try{
  barriers.send("begin;select pg_advisory_xact_lock(98101),pg_advisory_xact_lock(98102),pg_advisory_xact_lock(98103),pg_advisory_xact_lock(98104);select 'HELD';");await barriers.wait('HELD');
  ap.send(`begin;select apple_ledger_compare_and_swap_production(${snap.version},${quoted(snap.state)});commit;select 'APPLE_DONE';`);await blocked(ap.tag);
  sp.send(`begin;set local request.jwt.claim.role='service_role';select record_stripe_authority(${quoted(stripePayload(stripeId))});commit;select 'STRIPE_DONE';`);await blocked(sp.tag);
  // This invocation retains the OLD compiled function while no provider relation
  // lock has yet been taken. CREATE OR REPLACE is not an execution cancellation.
  dormant.send(`set application_name='dormant_${dormant.tag}';begin;set local request.jwt.claim.role='service_role';select record_stripe_authority(${quoted(stripePayload(dormantId))});commit;`);await blocked('dormant_'+dormant.tag);
  dormantApple.send(`set application_name='dormant_apple_${dormantApple.tag}';begin;select apple_ledger_compare_and_swap_production(${snap.version+1},${quoted(dormantSnapshot.state)});commit;`);await blocked('dormant_apple_'+dormantApple.tag);
  ddl.send('begin;'+two+"select 'PROTOCOL_INSTALLED';");await blocked(ddl.tag);
  // Release only the two in-flight old writers; keep dormant code paused.
  barriers.send('select pg_advisory_unlock(98101);');
  // Transaction-level barriers release together; keep dormant barrier with a
  // session lock acquired before releasing the transaction locks.
  barriers.send("select pg_advisory_lock(98103),pg_advisory_lock(98104);commit;select 'RELEASED';");await barriers.wait('RELEASED');
  await ap.wait('APPLE_DONE');await sp.wait('STRIPE_DONE');await ddl.wait('PROTOCOL_INSTALLED');
  assert.equal(sql("select to_regprocedure('lock_commercial_listings(jsonb,boolean)') is null"),'t');
  // Opposite ordering: a fresh call starts while replacement DDL still owns the
  // relation fence. It cannot write before DDL commits.
  const opposite=session();try{
   opposite.send(`begin;set local request.jwt.claim.role='service_role';select record_stripe_authority(${quoted(stripePayload(businessAfterFenceId))});commit;select 'NEW_DONE';`);
   await blocked(opposite.tag);
   ddl.send("commit;select 'DEPLOY_COMMITTED';");await ddl.wait('DEPLOY_COMMITTED');await opposite.wait('NEW_DONE');
  }finally{await opposite.close();}
  listing.send(`begin;select lock_commercial_listings('[{"listing_type":"business","listing_id":"${dormantId}"},{"listing_type":"business","listing_id":"${dormantAppleId}"}]');select 'LISTING_HELD';`);await listing.wait('LISTING_HELD');
  barriers.send("select pg_advisory_unlock(98103),pg_advisory_unlock(98104);select 'DORMANT_RELEASED';");await barriers.wait('DORMANT_RELEASED');
  const oldAppleResult=await dormantApple.close();assert.notEqual(oldAppleResult.code,0);assert.match(oldAppleResult.err,/could not obtain lock/);
  assert.equal(sql(`select count(*) from apple_purchase_intents where listing_id='${dormantAppleId}'`),'0');
  const result=await dormant.close();assert.notEqual(result.code,0);assert.match(result.err,/could not obtain lock/);
  assert.equal(sql(`select count(*) from stripe_promotion_authority where listing_id='${dormantId}'`),'0');
  assert.equal(sql(`select count(*) from stripe_promotion_authority where listing_id='${stripeId}'`),'1');
 }finally{for(const s of [barriers,ap,sp,dormant,dormantApple,ddl,listing])await s.close();}
});
const businessAfterFenceId=business();
test('new Apple CAS returns conflict when an old transaction holds revision; no listing/ledger cycle',async()=>{
 const id=business();const snap=JSON.parse(sql(`begin;${apple(id,{entitlement:true})}select apple_ledger_snapshot_production();rollback;`).split('\n').find(x=>x.startsWith('{')));
 const old=session();try{old.send("begin;select revision from apple_ledger_revision where id=1 for update;select 'REVISION_HELD';");await old.wait('REVISION_HELD');
 assert.match(sql(`begin;set local statement_timeout='2s';select apple_ledger_compare_and_swap_production(${snap.version},${quoted(snap.state)});commit;`),/\nf\n/);
 assert.equal(sql(`select count(*) from apple_purchase_intents where listing_id='${id}'`),'0');
 }finally{await old.close();}
});
for(const [name,setup,error] of [
 ['wrong protocol version',"alter table commercial_deploy.protocol drop constraint protocol_protocol_version_check;update commercial_deploy.protocol set protocol_version=2;",'COMMERCIAL_PROTOCOL_REQUIRED'],
 ['wrong project',"update commercial_deploy.protocol set expected_project='other';",'COMMERCIAL_PROTOCOL_REQUIRED'],
 ['wrong function',"update commercial_deploy.protocol set expected_function='other';",'COMMERCIAL_PROTOCOL_REQUIRED'],
 ['future installation',"update commercial_deploy.protocol set installed_at=clock_timestamp()+interval '1 day';",'COMMERCIAL_PROTOCOL_REQUIRED'],
 ['missing foundation',"alter table admin_comp_audit rename to missing_audit;",'COMMERCIAL_PROTOCOL_REQUIRED'],
 ['missing common lock',"alter function lock_commercial_listings(jsonb,boolean) rename to missing_lock;",'COMMERCIAL_PROTOCOL_REQUIRED'],
 ['missing projection',"alter function stripe_patch_business(uuid,text,jsonb) rename to missing_patch;",'COMMERCIAL_PROTOCOL_REQUIRED'],
 ['missing Apple CAS',"alter function apple_ledger_compare_and_swap_production(bigint,jsonb) rename to missing_cas;",'COMMERCIAL_PROTOCOL_REQUIRED'],
 ['altered Stripe definition',"create or replace function record_stripe_authority(p jsonb) returns text language sql as $$select 'unsafe'::text$$;",'PROTOCOL_DEFINITION_DRIFT'],
 ['altered Apple definition',"create or replace function apple_ledger_compare_and_swap(expected_version bigint,next_state jsonb) returns boolean language sql as $$select true$$;",'PROTOCOL_DEFINITION_DRIFT'],
 ['disabled guard trigger',"alter table business_submissions disable trigger commercial_business_projection_guard;",'PROTOCOL_TRIGGER_DRIFT'],
 ['empty definition metadata',"update commercial_deploy.protocol set definitions='{}';",'COMMERCIAL_PROTOCOL_REQUIRED'],
])test('explicit activation rejects '+name+' atomically',()=>{
 assert.throws(()=>sql('begin;'+setup+three+'commit;'),new RegExp(error));
 assert.equal(sql('select activated_at is null from commercial_deploy.protocol'),'t');
 assert.notEqual(sql("select to_regprocedure('admin_comp_lock_payment_sources()') is null"),'t');
});
for(const role of ['anon','authenticated','service_role'])test('application cannot activate or alter protocol: '+role,()=>{
 assert.throws(()=>sql(`begin;set local role ${role};${three}commit;`),/permission denied/);
 assert.equal(sql(`select has_table_privilege('${role}','commercial_deploy.protocol','UPDATE')`),'f');
});
test('COMP stays disabled without explicit activation, even with a fake session verification',()=>{
 assert.throws(()=>sql("begin;set local request.jwt.claim.sub='10000000-0000-0000-0000-000000000003';set local app.commercial_edge_sha256='pretend-pass';select admin_comp_lock_payment_sources();commit;"),/COMMERCIAL_PROTOCOL_REQUIRED/);
 assert.equal(sql('select activated_at is null from commercial_deploy.protocol'),'t');
 assert.equal(sql("select to_regprocedure('commercial_deploy.register_verified_edge(jsonb)') is null"),'t');
 assert.equal(sql("select to_regclass('commercial_deploy.edge_evidence') is null"),'t');
});
test('separate administrative activation is atomic, enables COMP once and rejects replay',()=>{
 sql('begin;'+three+'rollback;');assert.equal(sql('select activated_at is null from commercial_deploy.protocol'),'t');
 sql('begin;'+three+'commit;');assert.equal(sql('select activated_at is not null from commercial_deploy.protocol'),'t');
 assert.equal(sql("select to_regprocedure('admin_comp_lock_payment_sources()') is null"),'t');
 assert.throws(()=>sql('begin;'+three+'commit;'),/ACTIVATION_ALREADY_CONSUMED/);
});

test('snapshot keyset pages cover each row once, preserve counts/hash and never output row data',async()=>{
 const {pageQuery,schemaQuery}=await import('../../scripts/commercial-deploy/snapshot-plan.mjs');
 const query=(cursor,limit)=>{let q=pageQuery('public','business_submissions',['id'],cursor,limit);if(cursor)q=q.replace('$1',quoted(cursor));
 // Wrap the single SELECT result as JSON through psql's separator-free output.
 q=q.replace('select count(*) as row_count,','select json_build_object(\'row_count\',count(*),\'page_hash\',').replace(' as page_hash,',",'private_memory_cursor',").replace(' as private_memory_cursor\n from page p;',") from page p;");
 return JSON.parse(sql(q).split('\n').find(x=>x.startsWith('{')));};
 let cursor=null,count=0;const hashes=[];
 for(let i=0;i<100;i++){const result=query(cursor,3);assert(result.row_count<=3);assert.match(result.page_hash,/^[a-f0-9]{64}$/);if(!result.row_count)break;
 count+=result.row_count;hashes.push(result.page_hash);cursor=result.private_memory_cursor;}
 assert.equal(count,Number(sql('select count(*) from business_submissions')));
 assert.equal(schemaQuery('public','business_submissions').includes('begin read only'),true);
 const signature=sql(schemaQuery('public','business_submissions')).split('\n').find(x=>/^[a-f0-9]{64}$/.test(x));assert(signature);
 assert.equal(query(null,3).page_hash,hashes[0]);
 assert.throws(()=>pageQuery('public','x;drop table y', ['id']),/IDENTIFIER/);
 assert.throws(()=>pageQuery('public','business_submissions',['id'],null,1001),/BOUNDED/);
});
