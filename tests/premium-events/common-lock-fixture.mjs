// Networkless disposable PostgreSQL only; all identities and payment references synthetic.


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

sql(seed19);
file('supabase/migrations/202609250001_admin_comp_authority.sql');
if(process.env.COMMON_DEPLOY_BASELINE_ONLY!=='1'){
file('supabase/migrations/202609250002_commercial_listing_protocol.sql');
sql('begin;'+readFileSync('supabase/migrations/202609250003_admin_comp_protocol_activation.sql','utf8').replace(/^begin;/m,'').replace(/^commit;/m,'')+'commit;');
}
export {owner,admin,business,apple,stripe,grant,grantSQL,revoke,gate,snapshot};
