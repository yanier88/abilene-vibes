import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {sql,sqlAsync,file,auth} from './pg.mjs';
const A='10000000-0000-0000-0000-000000000001', B='10000000-0000-0000-0000-000000000002', admin='10000000-0000-0000-0000-000000000003';
file('tests/premium-events/security-baseline.sql');
file('supabase/migrations/202609210003_apple_public_projection.sql');
const migrations=['202609240001_stripe_premium_authority','202609240002_premium_events','202609240003_business_ownership_claims','202609240004_event_grants_hardening'];
const combined=migrations.map(n=>readFileSync(`supabase/migrations/${n}.sql`,'utf8').replace(/^begin;/m,'').replace(/^commit;/m,'')).join('\n');
test('production event grants reproduced including non-RLS TRUNCATE',()=>{
 for(const [r,grants] of [['anon',['SELECT','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']],['authenticated',['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']],['service_role',['TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']]])
  for(const g of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN']) assert.equal(sql(`select has_table_privilege('${r}','event_submissions','${g}')`),grants.includes(g)?'t':'f');
 sql('begin;set local role anon;truncate event_submissions;rollback;');
});
test('fresh full migration sequence and transactional rollback',()=>{
 sql('begin;'+combined+'rollback;');
 assert.equal(sql("select to_regclass('public.business_ownership_claims') is null"),'t');
 assert.equal(sql("select has_table_privilege('anon','event_submissions','TRUNCATE')"),'t');
});
let originalBusinesses, originalEvents;
test('upgrade preserves 19 unbound businesses and two ended events byte-for-byte',()=>{
 sql(`insert into auth.users values('${A}'),('${B}'),('${admin}');insert into local_test_admins values('${admin}');
 insert into business_submissions(id,business_name,status,plan,owner_user_id,payment_status,placement_source,placement_expires_at)
 select ('20000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'Synthetic business '||i,case when i between 5 and 8 then 'rejected' else 'approved' end,case when i<=8 then 'Premium' else 'Free' end,case when i<=11 then 'legacy-device-'||i end,case when i<=4 then 'not_required' else 'pending' end,case when i<=4 then 'comp' else 'paid' end,'2099-01-01' from generate_series(1,19)i;
 insert into event_submissions(title,place,event_date,event_time,event_type,status) values('Legacy one','Synthetic venue','2000-01-01','10:00 AM','Event','approved'),('Legacy two','Synthetic venue','2000-01-02','11:00 AM','Event','approved');`);
 originalBusinesses=sql('select jsonb_agg(to_jsonb(b) order by id) from business_submissions b');
 originalEvents=sql('select jsonb_agg(to_jsonb(e) order by id) from event_submissions e');
 // Roll back the full upgrade against populated data first.
 sql('begin;'+combined+'rollback;');
 assert.equal(sql('select jsonb_agg(to_jsonb(b) order by id) from business_submissions b'),originalBusinesses);
 for(const n of migrations)file(`supabase/migrations/${n}.sql`);
 assert.equal(sql('select jsonb_agg(to_jsonb(b) order by id) from business_submissions b'),originalBusinesses);
 assert.equal(sql("select jsonb_agg(to_jsonb(e)-array['business_id','submitted_by','submission_key','submission_hash','entitlement_provider','entitlement_checked_at'] order by id) from event_submissions e"),originalEvents);
});
for(const role of ['anon','authenticated','service_role'])for(const [op,q] of [
 ['insert',"insert into event_submissions(title,place,event_date,event_time,event_type) values('x','y','2099-01-01','10:00','Event')"],
 ['update',"update event_submissions set status='approved'"],['delete','delete from event_submissions'],['truncate','truncate event_submissions']])
 test(`${role} direct event ${op} denied`,()=>assert.throws(()=>sql(`begin;set local role ${role};${q};commit;`),/permission denied/));
test('all event privileges minimal; table and column grants checked',()=>{
 for(const role of ['anon','authenticated','service_role']) for(const g of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])
 assert.equal(sql(`select has_table_privilege('${role}','event_submissions','${g}')`),g==='SELECT'&&role!=='service_role'?'t':'f');
 assert.equal(sql("select count(*) from information_schema.column_privileges where table_name='event_submissions' and grantee in ('anon','authenticated','service_role') and privilege_type<>'SELECT'"),'0');
});
const insertBusiness=(id,other=B)=>`insert into business_submissions(id,business_name,status,plan,placement_source,payment_status,content_rights_confirmed,advertiser_user_id,owner_user_id) values('${id}','New advertiser','pending','Premium','paid','pending',true,'${other}','client-other')`;
const legacy=n=>`20000000-0000-0000-0000-${String(n).padStart(12,'0')}`;
const uuidResult=s=>s.split('\n').find(x=>/^[a-f0-9-]{36}$/.test(x));
const request=(id,who=A)=>uuidResult(sql(auth(`select request_business_claim('${id}','Verified by administrator separately')`,who)));
test('anonymous protected business insert requires auth',()=>assert.throws(()=>sql(`set role anon;${insertBusiness(randomUUID())}`),/AUTH_REQUIRED/));
test('new authenticated submission overwrites client owner and preserves it on Admin approval',()=>{
 const id=randomUUID();sql(auth(insertBusiness(id),A));
 assert.equal(sql(`select advertiser_user_id||':'||owner_user_id from business_submissions where id='${id}'`),A+':'+A);
 sql(auth(`update business_submissions set status='approved' where id='${id}'`,admin));
 assert.equal(sql(`select advertiser_user_id from business_submissions where id='${id}'`),A);
});
test('unowned claim pending only; duplicate idempotent',()=>{
 const id=request(legacy(1)); assert.equal(request(legacy(1)),id);
 assert.equal(sql(`select advertiser_user_id is null from business_submissions where id='${legacy(1)}'`),'t');
 assert.equal(sql(`select status from business_ownership_claims where id='${id}'`),'pending');
 for(const who of [A,B])for(const status of ['approved','rejected'])assert.throws(()=>sql(auth(`select review_business_claim('${id}','${status}','Independent verification')`,who)),/ADMIN_REQUIRED/);
});
test('direct owner mutation blocked even for admin outside audited RPC',()=>{
 sql(auth('select ensure_advertiser_profile()',B));
 assert.throws(()=>sql(auth(`update business_submissions set advertiser_user_id='${B}' where id='${legacy(1)}'`,admin)),/Ownership claims/);
 sql(auth(`update business_submissions set advertiser_user_id='${A}' where id='${legacy(1)}'`,A));
 assert.equal(sql(`select advertiser_user_id is null from business_submissions where id='${legacy(1)}'`),'t');
});
test('Admin approves only pending claim, records durable audit; overwrite denied',()=>{
 const id=request(legacy(1));sql(auth(`select review_business_claim('${id}','approved','Independently verified authority')`,admin));
 assert.equal(sql(`select advertiser_user_id from business_submissions where id='${legacy(1)}'`),A);
 assert.equal(sql(`select count(*) from business_ownership_audit where claim_id='${id}' and actor='${admin}'`),'1');
 assert.throws(()=>request(legacy(1),B),/UNOWNED/);
 assert.throws(()=>sql(auth(`select review_business_claim('${id}','approved','Repeat verification attempt')`,admin)),/PENDING/);
});
test('rejection preserves owner and claim history',()=>{
 const id=request(legacy(2));sql(auth(`select review_business_claim('${id}','rejected','Unable to verify authority')`,admin));
 assert.equal(sql(`select status from business_ownership_claims where id='${id}'`),'rejected');
 assert.equal(sql(`select advertiser_user_id is null from business_submissions where id='${legacy(2)}'`),'t');
});
for(const n of [2,10])test(`concurrent claims x${n} and competing approvals assign only once`,async()=>{
 const target=legacy(n===2?3:4);
 const requests=await Promise.all(Array.from({length:n},(_,i)=>sqlAsync(auth(`select request_business_claim('${target}','Independent evidence review')`,i%2?A:B))));
 const ids=[...new Set(requests.map(uuidResult))];assert.equal(ids.length,2);
 const results=await Promise.allSettled(ids.map(id=>sqlAsync(auth(`select review_business_claim('${id}','approved','Independent authority review')`,admin))));
 assert.equal(results.filter(x=>x.status==='fulfilled').length,1);
 assert.equal(sql(`select count(*) from business_ownership_audit where business_id='${target}'`),'1');
});
test('transfer requires admin, expected existing owner and audit reason',()=>{
 const q=`select transfer_business_owner('${legacy(1)}','${A}','${B}','Explicit transfer independently verified')`;
 assert.throws(()=>sql(auth(q,A)),/ADMIN_REQUIRED/);
 assert.throws(()=>sql(auth(`select transfer_business_owner('${legacy(1)}','${B}','${A}','Explicit transfer verified')`,admin)),/MISMATCH/);
 sql(auth(q,admin));assert.equal(sql(`select advertiser_user_id from business_submissions where id='${legacy(1)}'`),B);
 assert.throws(()=>sql(auth(q,admin)),/MISMATCH/);
});
for(const role of ['anon','authenticated'])test(`${role} claim/audit direct writes and truncate denied`,()=>{
 for(const table of ['business_ownership_claims','business_ownership_audit'])for(const statement of [`delete from ${table}`,`update ${table} set id=gen_random_uuid()`,`truncate ${table}`,`insert into ${table}(id) values(gen_random_uuid())`])assert.throws(()=>sql(`set role ${role};${statement}`),/permission denied/);
});
test('claim RLS separates advertisers and admin can see queue',()=>{
 assert.equal(sql(auth(`select count(*) from business_ownership_claims where claimant<>'${A}'`,A)).split('\n').includes('0'),true);
 assert.throws(()=>sql('set role anon;select * from business_ownership_claims'),/permission denied/);
 assert.match(sql(auth('select count(*)>0 from business_ownership_claims',admin)),/\nt\n/);
});
test('comp without paid provider remains denied, legacy owner text cannot grant Events',()=>{
 for(const id of [legacy(2),legacy(9)])assert.match(sql(auth(`select coalesce(premium_event_provider('${id}'),'DENY')`,A)),/DENY/);
 // Owned comp also stays denied.
 assert.match(sql(auth(`select coalesce(premium_event_provider('${legacy(1)}'),'DENY')`,B)),/DENY/);
});
test('admin Event CRUD RPC works, non-admin cannot call it, ended events stay nonpublic',()=>{
 const fields=JSON.stringify({title:'Admin event',place:'Venue',event_date:'2099-01-01',event_time:'10:00 AM'});
 assert.throws(()=>sql(auth(`select admin_write_event('create',null,'${fields}')`,A)),/ADMIN_REQUIRED/);
 const id=uuidResult(sql(auth(`select admin_write_event('create',null,'${fields}')`,admin)));
 assert.equal(sql('set role anon;select count(*) from event_submissions'),'SET\n1');
 sql(auth(`select admin_write_event('edit','${id}','{"title":"Edited"}'); select admin_write_event('hide','${id}')`,admin));
 assert.equal(sql('set role anon;select count(*) from event_submissions'),'SET\n0');
 sql(auth(`select admin_write_event('restore','${id}');select admin_write_event('delete','${id}')`,admin));
 assert.equal(sql('select count(*) from event_submissions'),'2');
});
test('claim-approved Stripe owner can submit; foreign owner and client provider rejected',()=>{
 const id=legacy(9),claim=request(id,A);sql(auth(`select review_business_claim('${claim}','approved','Verified registered business authority')`,admin));
 sql(`update business_submissions set stripe_subscription_id='sub_claimed' where id='${id}';insert into stripe_promotion_authority(subscription_id,listing_type,listing_id,environment,plan,status,period_end,cancel_at_period_end,event_created,event_id,snapshot) values('sub_claimed','business','${id}','Production','premium','active','2099-01-01',false,123,'evt_claimed','{}')`);
 const f=JSON.stringify({title:'Claim owner event',place:'Venue',event_date:'2099-01-01',event_time:'10:00 AM'});
 const q=`select submit_premium_event('${id}','${randomUUID()}','${f}')`;
 assert.throws(()=>sql(auth(q,B)),/OWNER_REQUIRED/);
 const event=uuidResult(sql(auth(q,A)));assert.equal(sql(`select status from event_submissions where id='${event}'`),'pending');
 assert.throws(()=>sql(auth(`select submit_premium_event('${id}','${randomUUID()}','${JSON.stringify({...JSON.parse(f),entitlement_provider:'apple'})}')`,A)),/INVALID_FIELDS/);
 sql(auth(`select moderate_premium_event('${event}','approved')`,admin));
 assert.equal(sql(`set role anon;select count(*) from event_submissions where id='${event}'`),'SET\n1');
});
test('client may not approve a business on insert and cannot tamper claim target',()=>{
 assert.throws(()=>sql(auth(insertBusiness(randomUUID()).replace("'pending','Premium'","'approved','Premium'"),A)),/row-level security/);
 assert.throws(()=>sql(auth(`update business_ownership_claims set claimant='${B}'`,A)),/permission denied/);
 for(const role of ['anon','authenticated'])assert.throws(()=>sql(`set role ${role};truncate business_submissions cascade`),/permission denied/);
});

for (const [i,plan] of [[14,'Free'],[15,'Featured'],[16,'Premium']]) test(`approved claim ${plan} without authority never grants Events`,()=>{
 const id=legacy(i);sql(`update business_submissions set plan='${plan}' where id='${id}'`);
 const claim=request(id,A);sql(auth(`select review_business_claim('${claim}','approved','Independently verified representative')`,admin));
 assert.equal(sql(`select advertiser_user_id='${A}' from business_submissions where id='${id}'`),'t');
 assert.match(sql(auth(`select coalesce(premium_event_provider('${id}'),'DENY')`,A)),/DENY/);
 assert.throws(()=>sql(auth(`select submit_premium_event('${id}','${randomUUID()}','{"title":"Synthetic event","place":"Synthetic venue","event_date":"2099-01-01","event_time":"10:00 AM"}')`,A)));
 assert.equal(sql(`select count(*) from listing_promotion_entitlements where listing_id='${id}'`),'0');
});
