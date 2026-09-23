import {Buffer} from 'node:buffer';
import {verifyAppleJws,APPLE_ROOT_G3_SHA256} from './jws.mjs';
import {VerifiedCache} from './cache.mjs';
import {sha,demand,Reject} from './ocsp.mjs';
const bundle='com.abilenevibes.app',ids=new Set(['com.abilenevibes.app.promotion.slot01.featured.monthly','com.abilenevibes.app.promotion.slot01.premium.monthly']);
const numeric=s=>typeof s==='string'&&/^\d{1,128}$/.test(s),uuid=s=>typeof s==='string'&&/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(s),iso=n=>{demand(Number.isSafeInteger(n),'SIGNED_DATE');return new Date(n).toISOString();};
export class EdgeAppleVerifier {
 #handles=new WeakMap();#facts=new WeakMap();#events=new WeakMap();#last=-Infinity;
 constructor({rootDer,environment,appAppleId,catalog,transportFactory,clock=Date.now}){
  demand(sha(rootDer)===APPLE_ROOT_G3_SHA256&&['Sandbox','Production'].includes(environment),'VERIFIER_CONFIG');
  demand(environment!=='Production'||Number.isSafeInteger(appAppleId)&&appAppleId>0,'APP_APPLE_ID_REQUIRED');
  demand(Array.isArray(catalog)&&catalog.length>0&&catalog.every(p=>ids.has(p.product)&&numeric(p.group))&&new Set(catalog.map(p=>p.product)).size===catalog.length,'CATALOG_CONFIG');
  this.rootDer=Buffer.from(rootDer);this.environment=environment;this.appAppleId=appAppleId;this.catalog=catalog.map(p=>Object.freeze({...p}));this.clock=clock;this.cache=new VerifiedCache(clock);
  this.transport=transportFactory(h=>{const p=this.#handles.get(h);demand(p,'UNTRUSTED_CERTIFICATE');return {...p,certificateDer:Buffer.from(p.certificateDer),issuerDer:Buffer.from(p.issuerDer)};});
 }
 now(){const n=this.clock();demand(Number.isSafeInteger(n)&&n>=this.#last,'CLOCK_ROLLBACK');this.#last=n;return n;}
 async signed(jws){
  const start=this.now(),r=await verifyAppleJws(jws,{rootDer:this.rootDer,now:start});let until=start+15000;
  for(let i=0;i<2;i++){
   const context={certificateDer:r.chain[i],issuerDer:r.chain[i+1],environment:this.environment};
   const h=Object.freeze({index:i});this.#handles.set(h,context);
   const revocation=await this.cache.getOrRefresh(context,()=>this.transport(h));until=Math.min(until,revocation.freshUntil);
  }
  demand(this.now()<until,'VERIFICATION_EXPIRED');return {...r,until};
 }
 transaction(t){
  demand(t.bundleId===bundle&&t.environment===this.environment,'TRANSACTION_SCOPE');
  const p=this.catalog.find(p=>p.product===t.productId);demand(p&&t.subscriptionGroupIdentifier===p.group,'PRODUCT_GROUP_SCOPE');
  demand(numeric(t.transactionId)&&numeric(t.originalTransactionId)&&numeric(t.appTransactionId)&&uuid(t.appAccountToken),'TRANSACTION_IDENTITY');
  demand(t.type==='Auto-Renewable Subscription'&&t.quantity===1&&['PURCHASED','FAMILY_SHARED'].includes(t.inAppOwnershipType),'TRANSACTION_TYPE');
  demand(Number.isSafeInteger(t.signedDate)&&t.signedDate<=this.now()+30000&&Number.isSafeInteger(t.purchaseDate)&&Number.isSafeInteger(t.expiresDate)&&t.expiresDate>t.purchaseDate,'TRANSACTION_DATE');
  demand(t.isUpgraded===undefined||typeof t.isUpgraded==='boolean','TRANSACTION_TYPE');
  demand(t.revocationDate===undefined||Number.isSafeInteger(t.revocationDate),'TRANSACTION_DATE');
  return Object.freeze({environment:t.environment,bundle_id:t.bundleId,transaction_id:t.transactionId,original_transaction_id:t.originalTransactionId,product_id:t.productId,app_account_token:t.appAccountToken.toLowerCase(),app_transaction_id:t.appTransactionId,subscription_group_id:t.subscriptionGroupIdentifier,purchase_date:iso(t.purchaseDate),expires_date:iso(t.expiresDate),revocation_date:t.revocationDate==null?null:iso(t.revocationDate),revocation_reason:t.revocationReason??null,ownership_type:t.inAppOwnershipType,is_upgraded:t.isUpgraded??false});
 }
 async verifyAppTransaction(jws){
  const a=await this.signed(jws),app=a.payload;
  demand(app.bundleId===bundle&&app.receiptType===this.environment&&numeric(app.appTransactionId),'APP_LINKAGE');
  demand(this.environment!=='Production'||app.appAppleId===this.appAppleId,'APP_IDENTITY');
  demand(Number.isSafeInteger(app.receiptCreationDate)&&app.receiptCreationDate<=this.now()+30000,'APP_DATE');
  return Object.freeze({app_transaction_id:app.appTransactionId,environment:this.environment,notAfter:a.until});
 }
 async verifyTransaction(jws,appJws,context){
  demand(context?.environment===this.environment&&context.bundle===bundle,'CONTEXT_SCOPE');
  const t=await this.signed(jws),a=await this.signed(appJws),app=a.payload;
  demand(app.bundleId===bundle&&app.receiptType===this.environment&&numeric(app.appTransactionId)&&app.appTransactionId===t.payload.appTransactionId,'APP_LINKAGE');
  demand(this.environment!=='Production'||app.appAppleId===this.appAppleId,'APP_IDENTITY');
  demand(t.chain.every((x,i)=>x.equals(a.chain[i])),'APP_CHAIN_LINKAGE');
  const normalized=this.transaction(t.payload);demand(normalized.product_id===context.product&&normalized.subscription_group_id===context.group,'CONTEXT_SCOPE');
  const at=this.now(),until=Math.min(t.until,a.until);demand(at<until,'VERIFICATION_EXPIRED');
  this.#facts.set(normalized,{...context,until,at});return normalized;
 }
 verificationDeadline(t){const p=this.#facts.get(t);demand(p,'UNVERIFIED_FACTS');return p.until;}
 assertFresh(t,now,context){const p=this.#facts.get(t);demand(p&&now>=p.at&&now<p.until&&['intentId','product','group','bundle','environment'].every(k=>p[k]===context[k]),'VERIFICATION_EXPIRED');this.now();}
 async verifyNotification(jws){
  const n=await this.signed(jws),v=n.payload,d=v.data;demand(v.version==='2.0'&&uuid(v.notificationUUID)&&Number.isSafeInteger(v.signedDate)&&v.signedDate<=this.now()+30000&&typeof v.notificationType==='string','NOTIFICATION_FORMAT');
  demand(d&&d.bundleId===bundle&&d.environment===this.environment&&(this.environment!=='Production'||d.appAppleId===this.appAppleId),'NOTIFICATION_SCOPE');
  if(v.notificationType==='TEST'){
   demand(!d.signedTransactionInfo&&!d.signedRenewalInfo,'TEST_NOTIFICATION_DATA');
   const e=Object.freeze({bundle_id:bundle,environment:this.environment,notification_uuid:v.notificationUUID,notification_type:'TEST',signed_date:v.signedDate});
   this.#events.set(e,{at:this.now(),until:n.until});return e;
  }
  const t=await this.signed(d.signedTransactionInfo),tx=this.transaction(t.payload);let until=Math.min(n.until,t.until),renewal=null;
  if(d.signedRenewalInfo){const r=await this.signed(d.signedRenewalInfo);renewal=r.payload;until=Math.min(until,r.until);demand([0,1].includes(renewal.autoRenewStatus),'RENEWAL_FORMAT');demand(renewal.environment===this.environment&&renewal.originalTransactionId===tx.original_transaction_id&&renewal.productId===tx.product_id,'RENEWAL_LINKAGE');demand(renewal.appAccountToken===undefined||renewal.appAccountToken.toLowerCase()===tx.app_account_token,'RENEWAL_TOKEN');}
  if(['DID_CHANGE_RENEWAL_STATUS','DID_FAIL_TO_RENEW','GRACE_PERIOD_EXPIRED'].includes(v.notificationType))demand(renewal,'RENEWAL_REQUIRED');
  const e=Object.freeze({bundle_id:bundle,environment:this.environment,notification_uuid:v.notificationUUID,notification_type:v.notificationType,subtype:v.subtype??null,signed_date:v.signedDate,original_transaction_id:tx.original_transaction_id,transaction_id:tx.transaction_id,product_id:tx.product_id,app_account_token:tx.app_account_token,app_transaction_id:tx.app_transaction_id,period_start:tx.purchase_date,period_end:tx.expires_date,auto_renew_enabled:renewal?.autoRenewStatus===undefined?null:renewal.autoRenewStatus===1,grace_period_expires_at:renewal?.gracePeriodExpiresDate==null?null:iso(renewal.gracePeriodExpiresDate),transaction:tx});
  const at=this.now();demand(at<until,'VERIFICATION_EXPIRED');this.#events.set(e,{at,until});return e;
 }
 notificationDeadline(e){const p=this.#events.get(e);demand(p,'UNVERIFIED_EVENT');return p.until;}
 assertNotificationFresh(e){const p=this.#events.get(e),n=this.now();demand(p&&n>=p.at&&n<p.until,'VERIFICATION_EXPIRED');}
}
