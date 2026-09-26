// Networkless disposable PostgreSQL only; all identities and payment references synthetic.
import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,readdirSync} from 'node:fs';
import {randomUUID} from 'node:crypto';
import {sql,sqlAsync,file,auth} from './pg.mjs';
const owner='10000000-0000-0000-0000-000000000001',admin='10000000-0000-0000-0000-000000000003';
let baseline=readFileSync('tests/premium-events/security-baseline.sql','utf8');
baseline=baseline.replace(/^create table listing_promotion_entitlements.*\n/m,'').replace(/^create table apple_subscription_assignments.*\n/m,'');
sql(baseline);
// Apply every deployed Apple migration, including binding, expired-undelivered,
// authorization history, production composition and cancellation constraints.
for(const name of readdirSync('supabase/migrations').filter(n=>n.includes('_apple_')&&n<'202609240000').sort())file(`supabase/migrations/${name}`);
sql("update apple_product_catalog set subscription_group_id='synthetic-group' where slot_number=1 and plan='premium'");
for(const name of ['202609240001_stripe_premium_authority','202609240002_premium_events','202609240003_business_ownership_claims','202609240004_event_grants_hardening'])file(`supabase/migrations/${name}.sql`);
sql(`alter table business_submissions add column stripe_session_id text,add column stripe_payment_intent_id text,add column stripe_customer_id text,add column paid_at timestamptz;`);
// Use the real legacy payment table DDL, not an invented billing model.
const paymentDDL=readFileSync('supabase-schema.sql','utf8').match(/create table if not exists public.payment_records \([\s\S]*?\n\);/)[0];sql(paymentDDL);
const seed19=`insert into auth.users values('${owner}'),('${admin}');insert into local_test_admins values('${admin}');
begin;set local request.jwt.claim.role='service_role';
insert into business_submissions(id,business_name,status,plan,payment_status,placement_source,advertiser_user_id,owner_user_id)
select ('30000000-0000-0000-0000-'||lpad(i::text,12,'0'))::uuid,'Synthetic rehearsal '||i,'approved',case when i<=4 then 'Premium' when i<=8 then 'Featured' else 'Free' end,'not_required',case when i<=8 then 'comp' else 'paid' end,'${owner}','${owner}' from generate_series(1,19)i;
insert into event_submissions(title,place,event_date,event_time,event_type,status) values('Synthetic legacy Event one','Synthetic venue','2000-01-01','10:00 AM','Event','approved'),('Synthetic legacy Event two','Synthetic venue','2000-01-02','10:00 AM','Event','approved');commit;`;
// Observed Production defaults: postgres tables broadly granted, sequences owner-only;
// supabase_admin sequences also grant anon/authenticated/service_role ALL. Rehearse both.
sql(`do $$ begin if not exists(select 1 from pg_roles where rolname='supabase_admin') then create role supabase_admin superuser; end if;end $$;
alter default privileges for role postgres in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role supabase_admin in schema public grant all on tables to anon,authenticated,service_role;
alter default privileges for role supabase_admin in schema public grant all on sequences to anon,authenticated,service_role;
alter default privileges for role supabase_admin in schema public grant execute on functions to anon,authenticated,service_role;`);
const migration=['202609250001_admin_comp_authority','202609250002_commercial_listing_protocol','202609250003_admin_comp_protocol_activation'].map(n=>readFileSync(`supabase/migrations/${n}.sql`,'utf8').replace(/^begin;/m,'').replace(/^commit;/m,'')).join('\n');
const grantSQL=(id,key=randomUUID(),plan='premium')=>`select grant_admin_comp('${id}','${plan}',30,'${key}')`;
const grant=(id,key=randomUUID(),plan='premium')=>{sql(auth(grantSQL(id,key,plan),admin));return key;};
const revoke=(id,key)=>sql(auth(`select revoke_admin_comp('${id}',${key?`'${key}'`:'null'})`,admin));
const snapshot=id=>sql(`select to_jsonb(b) from business_submissions b where id='${id}'`);
const gate=id=>sql(auth(`select coalesce(premium_event_provider('${id}'),'DENY')`,owner));
function business(){const id=randomUUID();sql(`begin;set local request.jwt.claim.role='service_role';insert into business_submissions(id,business_name,status,plan,payment_status,placement_source,advertiser_user_id,owner_user_id) values('${id}','Synthetic isolated','approved','Free','not_required','paid','${owner}','${owner}');commit;`);return id;}
function stripe(id,status='active',ambiguous=false){return `insert into stripe_promotion_authority values('sub_${randomUUID()}','business','${id}','Production','premium','${status}',now()+interval '1 day',false,1,'evt_${randomUUID()}','{}',${ambiguous});`;}
function apple(id,{state='pending',assignment=false,slot=false,authorization=false,subscriptionStatus='active',closed=false,entitlement=false,expired=false,environment='Production'}={}){
 const buyer=randomUUID(),intent=randomUUID(),sub=randomUUID(),installation=randomUUID(),token=randomUUID(),product='com.abilenevibes.app.promotion.slot01.premium.monthly';
 let q=`insert into apple_buyers(id,app_account_token,bundle_id,environment,status) values('${buyer}','${token}','com.abilenevibes.app','${environment}','provisional');`;
 if(authorization)return q+`insert into apple_listing_authorizations(buyer_id,environment,listing_type,listing_id,created_at,expires_at,revoked_at) values('${buyer}','${environment}','business','${id}',now()-interval '2 days',now()-interval '1 day',now());`;
 q+=`insert into apple_installations(installation_id,buyer_id,key_id,attestation_status,environment) values('${installation}','${buyer}','synthetic-${installation}','verified','${environment}');insert into apple_purchase_intents(id,buyer_id,listing_type,listing_id,requested_plan,slot_number,product_id,environment,idempotency_key,status,expires_at,originating_installation_id,app_account_token,bundle_id,subscription_group_id) values('${intent}','${buyer}','business','${id}','premium',1,'${product}','${environment}','${intent}','${state}',now()+interval '1 hour','${installation}','${token}','com.abilenevibes.app','synthetic-group');`;
 if(assignment||slot||entitlement){q+=`insert into apple_subscriptions(id,buyer_id,bundle_id,environment,slot_number,product_id,plan,subscription_group_id,original_transaction_id,current_transaction_id,status,period_start,period_end,verified_at) values('${sub}','${buyer}','com.abilenevibes.app','${environment}',1,'${product}','premium','synthetic-group','synthetic-${sub}','synthetic-${sub}','${subscriptionStatus}',now()-interval '1 day',now()+interval '1 day',now());`;}
 if(assignment||entitlement)q+=`insert into apple_subscription_assignments(subscription_id,buyer_id,slot_number,environment,listing_type,listing_id,purchase_intent_id,first_transaction_id,closed_at) values('${sub}','${buyer}',1,'${environment}','business','${id}','${intent}','synthetic-${sub}',${closed?'now()':'null'});`;
 if(slot)q+=`insert into apple_slot_occupancies(buyer_id,environment,slot_number,state,purchase_intent_id,subscription_id,listing_type,listing_id) values('${buyer}','${environment}',1,'occupied','${intent}','${sub}','business','${id}');`;
 if(entitlement)q+=`insert into listing_promotion_entitlements(listing_type,listing_id,provider,provider_reference,plan,status,valid_from,valid_until,auto_renew_state,environment,source_priority) values('business','${id}','apple','${sub}','premium','${subscriptionStatus}',now()-interval '1 day',now()+interval '1 day','on','${environment}',1);`;
 if(expired)q+=`update apple_purchase_intents set reconciliation_reason='VERIFIED_EXPIRED_UNDELIVERED' where id='${intent}';
 insert into apple_expired_purchases(id,provider,environment,bundle_id,transaction_id,original_transaction_id,buyer_id,installation_id,listing_type,listing_id,app_account_token,app_transaction_id,product_id,subscription_group_id,purchase_date,signed_date,expiration_date,purchase_intent_id,evidence_sha256,app_evidence_sha256,verification_status,commercial_status,reason,created_at,reconciled_at)
 values(gen_random_uuid(),'apple','Sandbox','com.abilenevibes.app','9001','9001','${buyer}','${installation}','business','${id}','${token}','synthetic-app','${product}','synthetic-group',now()-interval '3 days',now()-interval '2 days',now()-interval '1 day','${intent}',repeat('a',64),repeat('b',64),'verified','expired_undelivered','PERIOD_EXPIRED_BEFORE_DURABLE_DELIVERY',now(),now());`;
 return q;
}
const aclAssertion=`do $$ begin
 if exists(select 1 from (values('anon'),('authenticated'),('service_role')) r(name) cross join (values('USAGE'),('SELECT'),('UPDATE')) p(privilege) where has_sequence_privilege(r.name,'public.admin_comp_audit_id_seq',p.privilege)) then raise exception 'SEQUENCE_LEAK'; end if;
 if (select pg_get_userbyid(relowner) from pg_class where oid='public.admin_comp_audit_id_seq'::regclass)<>'postgres' then raise exception 'OWNER_DRIFT'; end if;
end $$;`;
test('rehearsal: fresh empty baseline applies and rollback removes new objects',()=>{
 assert.equal(sql('select count(*) from business_submissions'),'0');
 sql(`begin;${migration}${aclAssertion}rollback;`);
 assert.equal(sql("select to_regclass('admin_comp_authority') is null"),'t');
 sql(seed19);
});
test('deployment boundary: COMP disabled before and after provider migration until activation',()=>{
 const one=readFileSync('supabase/migrations/202609250001_admin_comp_authority.sql','utf8').replace(/^begin;/m,'').replace(/^commit;/m,'');
 const two=readFileSync('supabase/migrations/202609250002_commercial_listing_protocol.sql','utf8').replace(/^begin;/m,'').replace(/^commit;/m,'');
 const closed=`do $$ begin
 perform set_config('request.jwt.claim.sub','${admin}',true);
 begin perform grant_admin_comp('30000000-0000-0000-0000-000000000001','premium',30,gen_random_uuid());raise exception 'UNSAFE_ACTIVATION';
 exception when raise_exception then if sqlerrm<>'COMMERCIAL_PROTOCOL_REQUIRED' then raise;end if;end;
 end $$;`;
 const three=readFileSync('supabase/migrations/202609250003_admin_comp_protocol_activation.sql','utf8').replace(/^begin;/m,'').replace(/^commit;/m,'');
 // Database cannot attest remote Edge: explicit administrative stage is the trust boundary.
 sql('begin;'+one+two+three+'rollback;');
 sql('begin;'+one+closed+two+closed+'rollback;');
 assert.equal(sql("select to_regclass('admin_comp_authority') is null"),'t');
});
test('rehearsal: 19 Businesses, fresh/upgrade/rollback and both observed creator default ACLs',()=>{
 assert.equal(sql('select count(*) from business_submissions'),'19');
 assert.equal(sql('select count(*) from event_submissions'),'2');
 sql(stripe('30000000-0000-0000-0000-000000000013')+apple('30000000-0000-0000-0000-000000000014'));
 const preservedTables=['business_submissions','event_submissions','advertiser_profiles','business_ownership_claims','stripe_promotion_authority','apple_purchase_intents','apple_product_catalog'];
 const state=()=>JSON.stringify(preservedTables.map(t=>sql(`select coalesce(jsonb_agg(to_jsonb(x) order by to_jsonb(x)::text),'[]') from ${t} x`)));
 const preserved=state();
 const before=sql('select jsonb_agg(to_jsonb(b) order by id) from business_submissions b');
 const oldGate=sql("select pg_get_functiondef('premium_event_provider(uuid)'::regprocedure)");
 for(const role of ['postgres','supabase_admin']){
  sql(`begin;set local role ${role};${migration}${aclAssertion}rollback;`);
  assert.equal(state(),preserved);
  assert.equal(sql("select to_regclass('admin_comp_authority') is null"),'t');
  assert.equal(sql("select pg_get_functiondef('premium_event_provider(uuid)'::regprocedure)"),oldGate);
  assert.equal(sql('select jsonb_agg(to_jsonb(b) order by id) from business_submissions b'),before);
 }
 sql('begin;'+migration+'commit;');
 assert.equal(state(),preserved);
 assert.equal(sql('select jsonb_agg(to_jsonb(b) order by id) from business_submissions b'),before);
 assert.equal(sql('select count(*) from admin_comp_authority'),'0');sql(aclAssertion);
});
test('ACL: RLS, exact table/sequence rights, internal helpers inaccessible, definer/search_path',()=>{
 for(const table of ['admin_comp_authority','admin_comp_audit']){
  assert.equal(sql(`select relrowsecurity from pg_class where oid='${table}'::regclass`),'t');
  for(const role of ['anon','authenticated','service_role'])for(const priv of ['SELECT','INSERT','UPDATE','DELETE','TRUNCATE','REFERENCES','TRIGGER','MAINTAIN'])assert.equal(sql(`select has_table_privilege('${role}','${table}','${priv}')`),role==='authenticated'&&priv==='SELECT'?'t':'f');
 }
 for(const role of ['anon','authenticated','service_role']){
  for(const priv of ['USAGE','SELECT','UPDATE'])assert.equal(sql(`select has_sequence_privilege('${role}','admin_comp_audit_id_seq','${priv}')`),'f');
  assert.throws(()=>sql(`set role ${role};select nextval('admin_comp_audit_id_seq')`),/permission denied/);
  for(const fn of ['admin_comp_payment_conflict(uuid)','lock_commercial_listings(jsonb,boolean)'])assert.equal(sql(`select has_function_privilege('${role}','${fn}','EXECUTE')`),'f');
 }
 assert.equal(sql("select count(*) from pg_proc where proname in ('admin_comp_payment_conflict','lock_commercial_listings','grant_admin_comp','revoke_admin_comp') and prosecdef and proconfig @> array['search_path=pg_catalog, public, pg_temp'] and proowner='postgres'::regrole"),'4');
});
const negatives=[
 ...['stripe_subscription_id','stripe_session_id','stripe_payment_intent_id','stripe_customer_id'].map(col=>[col,id=>`update business_submissions set ${col}='synthetic' where id='${id}';`]),
 ['paid_at',id=>`update business_submissions set paid_at=now() where id='${id}';`],
 ...['pending','checkout_started','cancel_pending','paid','unknown'].map(state=>[`payment ${state}`,id=>`update business_submissions set payment_status='${state}' where id='${id}';`]),
 ['unknown/null payment',id=>`update business_submissions set payment_status=null where id='${id}';`],
 ['Stripe authority no business ref',id=>stripe(id)],['Stripe ambiguous',id=>stripe(id,'incomplete',true)],
 ['Stripe canceled history',id=>stripe(id,'canceled')],
 ['Stripe legacy payment',id=>`insert into payment_records(business_submission_id,status) values('${id}','refunded');`],
 ['Stripe receipt uppercase UUID',id=>`insert into stripe_authority_receipts values('evt_${randomUUID()}','{"listing_id":"${id.toUpperCase()}"}');`],
 ['Stripe receipt without authority',id=>`insert into stripe_authority_receipts values('evt_${randomUUID()}','{"listing_id":"${id}"}');`],
 ...['reserved','purchasing','pending','verifying','completed','canceled','failed','reconciliation'].map(state=>[`Apple intent ${state}`,id=>apple(id,{state})]),
 ['Apple authorization expired/revoked',id=>apple(id,{authorization:true})],
 ['Apple assignment closed',id=>apple(id,{assignment:true,closed:true})],
 ['Apple subscription/occupied slot',id=>apple(id,{slot:true})],
 ...['active','expired','revoked','billing_retry','reconciliation'].map(subscriptionStatus=>[`Apple subscription ${subscriptionStatus}`,id=>apple(id,{assignment:true,entitlement:true,subscriptionStatus})]),
 ['Apple checkout_started hidden publicly',id=>apple(id,{entitlement:true})+`update business_submissions set payment_status='checkout_started' where id='${id}';`],
 ['Apple cancel_pending hidden publicly',id=>apple(id,{entitlement:true})+`update business_submissions set payment_status='cancel_pending' where id='${id}';`],
 ['Apple expired-undelivered durable ledger',id=>apple(id,{state:'reconciliation',expired:true,environment:'Sandbox'})],
 ['Apple undelivered (verifying intent no delivery)',id=>apple(id,{state:'verifying',assignment:true})],
];
for(const [name,setup] of negatives)test(`negative: ${name} denies atomically`,()=>{
 const id=business();sql(setup(id));const before=snapshot(id);
 assert.throws(()=>grant(id),/PAID_PROVIDER_BOUND/);
 assert.equal(snapshot(id),before);assert.equal(sql(`select count(*) from admin_comp_authority where business_id='${id}'`),'0');assert.equal(sql(`select count(*) from admin_comp_audit where business_id='${id}'`),'0');
});
for(const [provider,setup] of [['Stripe',id=>stripe(id)],['Apple',id=>apple(id)]]){
 test(`transition: COMP to ${provider} revoke preserves every Business field, revokes COMP and audits`,()=>{
  const id=business(),key=grant(id);sql(setup(id));const before=snapshot(id);
  assert.match(gate(id),/DENY/);revoke(id,key);
  assert.equal(snapshot(id),before);assert.equal(sql(`select status from admin_comp_authority where id='${key}'`),provider==='Stripe'?'superseded_paid':'revoked');
  assert.equal(sql(`select count(*) from admin_comp_audit where grant_id='${key}' and action='${provider==='Stripe'?'paid_priority':'revoke'}'`),'1');
 });
 test(`negative: legacy_clear with ${provider} cannot clear or audit`,()=>{
  const id=business();sql(`update business_submissions set plan='Premium',placement_source='comp' where id='${id}';`+setup(id));const before=snapshot(id);
  assert.throws(()=>revoke(id,null),/PAID_PROVIDER_BOUND|LEGACY_COMP_REQUIRED/);assert.equal(snapshot(id),before);assert.equal(sql(`select count(*) from admin_comp_audit where business_id='${id}'`),'0');
 });
}
test('negative: stale snapshot isolation denied before mutations',()=>{const id=business();assert.throws(()=>sql(auth(grantSQL(id),admin).replace('begin;','begin isolation level repeatable read;')),/COMMERCIAL_READ_COMMITTED_REQUIRED/);assert.equal(sql(`select count(*) from admin_comp_authority where business_id='${id}'`),'0');});
test('positive: safe Premium/Featured, idempotency, administrator audit and owner gate',()=>{
 const id=business(),key=grant(id);assert.match(gate(id),/admin_comp/);grant(id,key);assert.equal(sql(`select count(*) from admin_comp_audit where grant_id='${key}'`),'1');
 grant(id,randomUUID(),'featured');assert.match(gate(id),/DENY/);
});
test('concurrency: grant x10 creates one grant; revoke x10 creates one revoke',async()=>{
 const id=business(),key=randomUUID();await Promise.all(Array.from({length:10},()=>sqlAsync(auth(grantSQL(id,key),admin))));
 assert.equal(sql(`select count(*) from admin_comp_audit where grant_id='${key}' and action='grant'`),'1');
 await Promise.all(Array.from({length:10},()=>sqlAsync(auth(`select revoke_admin_comp('${id}','${key}')`,admin))));
 assert.equal(sql(`select count(*) from admin_comp_audit where grant_id='${key}' and action='revoke'`),'1');assert.match(gate(id),/DENY/);
});
test('concurrency: grant/revoke race preserves replacement authority and paid isolation',async()=>{
 const id=business(),old=grant(id),key=randomUUID();await Promise.all([sqlAsync(auth(grantSQL(id,key),admin)),sqlAsync(auth(`select revoke_admin_comp('${id}','${old}')`,admin))]);
 assert.equal(sql(`select status from admin_comp_authority where id='${old}'`),'revoked');assert.equal(sql(`select status from admin_comp_authority where id='${key}'`),'active');
});
// Real CAS/Stripe RPC barriers replace the old table-lock/sleep tests in common-lock.test.mjs.
