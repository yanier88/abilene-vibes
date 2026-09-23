// Server-injected transport/config only. No Node crypto imports in the Edge boundary.
import {AppleError,requireThat} from './domain.mjs';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
export function canonical(o){requireThat(o&&Object.getPrototypeOf(o)===Object.prototype,'NODE_INVALID_CONTRACT');const sorted={};for(const k of Object.keys(o).sort()){requireThat(/^[a-zA-Z][a-zA-Z0-9]*$/.test(k)&&!['__proto__','constructor','prototype'].includes(k),'NODE_INVALID_CONTRACT');const v=o[k];requireThat(v===null||typeof v==='string'||typeof v==='boolean'||Number.isSafeInteger(v),'NODE_INVALID_CONTRACT');sorted[k]=v;}return enc.encode(JSON.stringify(sorted));}
const equalBytes=(a,b)=>a.length===b.length&&a.every((x,i)=>x===b[i]);
export function parseCanonical(bytes,limit=16384){requireThat(bytes instanceof Uint8Array&&bytes.length<=limit,'NODE_INVALID_CONTRACT');let p;try{p=JSON.parse(dec.decode(bytes));}catch{throw new AppleError('NODE_INVALID_CONTRACT');}requireThat(equalBytes(canonical(p),bytes),'NODE_INVALID_CONTRACT');return p;}
export const hex=b=>Array.from(new Uint8Array(b),x=>x.toString(16).padStart(2,'0')).join('');
export const digest=async b=>hex(await crypto.subtle.digest('SHA-256',typeof b==='string'?enc.encode(b):b));
const unhex=s=>{requireThat(typeof s==='string'&&/^[a-f0-9]{64}$/.test(s),'NODE_AUTH_FAILED');return Uint8Array.from(s.match(/../g),x=>parseInt(x,16));};
export async function hmac(key,body){const k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['sign']);return hex(await crypto.subtle.sign('HMAC',k,body));}
async function checkHmac(key,body,signature){const sig=unhex(signature),k=await crypto.subtle.importKey('raw',key,{name:'HMAC',hash:'SHA-256'},false,['verify']);requireThat(await crypto.subtle.verify('HMAC',k,sig,body),'NODE_AUTH_FAILED');}
const b64=b=>btoa(Array.from(b,x=>String.fromCharCode(x)).join('')).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
export const FEATURED_POLICY=Object.freeze({policyId:'sandbox-featured-v1',policyVersion:'phase70-v1',bundle:'com.abilenevibes.app',environment:'Sandbox',product:'com.abilenevibes.app.promotion.slot01.featured.monthly',group:'22382531'});
const responseFields=['schemaVersion','keyId','audience','requestId','requestBodyHash','transactionHash','appTransactionHash','transactionIdentityHash','originalTransactionIdentityHash','productId','subscriptionGroupId','bundleId','environment','policyVersion','verifiedAt','freshUntil','result','failureCode','deliveryGranted','finishCalled','verifiedFacts'];
const factMap={environment:'environment',bundleId:'bundle_id',transactionId:'transaction_id',originalTransactionId:'original_transaction_id',productId:'product_id',appAccountToken:'app_account_token',appTransactionId:'app_transaction_id',subscriptionGroupId:'subscription_group_id',purchaseDate:'purchase_date',expiresDate:'expires_date',revocationDate:'revocation_date',revocationReason:'revocation_reason',ownershipType:'ownership_type',isUpgraded:'is_upgraded'};
export class NodeAppleVerifierClient{
 #validated=new WeakMap();
 constructor({requestKey,responseKey,requestKeyId="request-v1",responseKeys=null,exchange,clock=Date.now,timeoutMs=15000}){requireThat(requestKey?.length>=32&&responseKey?.length>=32&&!equalBytes(requestKey,responseKey)&&typeof exchange==='function'&&timeoutMs>0&&timeoutMs<=15000,'NODE_CONFIG_INVALID');requireThat(typeof requestKeyId==='string'&&(!responseKeys||typeof responseKeys.resolve==='function'),'NODE_CONFIG_INVALID');this.requestKeyId=requestKeyId;this.responseKeys=responseKeys;this.requestKey=new Uint8Array(requestKey);this.responseKey=new Uint8Array(responseKey);this.exchange=exchange;this.clock=clock;this.timeoutMs=timeoutMs;}
 verificationDeadline(t){const p=this.#validated.get(t);requireThat(p,'NODE_UNVERIFIED_FACTS');return p.freshUntil;}
 assertFresh(t,now,context){const p=this.#validated.get(t);requireThat(p&&p.verifiedAt<=now&&now<p.freshUntil,'NODE_RESPONSE_EXPIRED');requireThat(context&&context.intentId===p.intentId&&context.product===p.product&&context.group===p.group&&context.bundle===p.bundle&&context.environment===p.environment,'NODE_CONTEXT_MISMATCH');}
 async verifyTransaction(transactionJws,appTransactionJws,context){
 const emit=context?.emit??(()=>{});let stage='NODE';
 const policy=FEATURED_POLICY;requireThat(context&&['product','group','bundle','environment'].every(k=>context[k]===policy[k]),'NODE_POLICY_NOT_CONFIGURED',503);
 requireThat(typeof transactionJws==='string'&&typeof appTransactionJws==='string'&&enc.encode(transactionJws).length<=65536&&enc.encode(appTransactionJws).length<=65536,'NODE_INVALID_CONTRACT');
 const body=canonical({transactionJws,appTransactionJws,purchaseIntentId:context.intentId,policyId:policy.policyId});const requestId=crypto.randomUUID(),nonce=hex(crypto.getRandomValues(new Uint8Array(16))),timestamp=this.clock();
 emit('NODE','ENTER','OK',{nodeRequestId:requestId});const signed={schemaVersion:1,keyId:this.requestKeyId,method:'POST',path:'/v1/verify',audience:'abilene-node-verifier',requestId,timestamp,nonce,bodyHash:await digest(body)};
 const auth=b64(canonical({...signed,mac:await hmac(this.requestKey,canonical(signed))}));let timer;const controller=new AbortController();
 try{
 const r=await Promise.race([Promise.resolve().then(()=>this.exchange({method:'POST',path:'/v1/verify',body,auth,signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AppleError('NODE_TIMEOUT',503));},this.timeoutMs);})]);
 emit('NODE','PASS','OK',{httpStatus:r.httpStatus,responseSize:r.body.length});
 const p=parseCanonical(r.body);requireThat(Object.keys(p).length===responseFields.length&&responseFields.every(k=>Object.hasOwn(p,k)),'NODE_INVALID_CONTRACT');const responseKey=this.responseKeys?this.responseKeys.resolve(p.keyId):this.responseKey;stage='NODE_HMAC';await checkHmac(responseKey,r.body,r.signature);emit(stage,'PASS');stage='NODE';
 requireThat(r.httpStatus===200&&p.schemaVersion===1&&(this.responseKeys||p.keyId==='response-v1')&&p.audience==='abilene-supabase-boundary'&&p.requestId===requestId&&p.requestBodyHash===signed.bodyHash,'NODE_RESPONSE_BINDING');
 stage='NODE_FRESHNESS';const now=this.clock();requireThat(Number.isSafeInteger(p.verifiedAt)&&Number.isSafeInteger(p.freshUntil)&&p.verifiedAt>=timestamp&&p.verifiedAt<=now&&now<p.freshUntil&&p.freshUntil<=p.verifiedAt+60000,'NODE_RESPONSE_EXPIRED');emit(stage,'PASS');stage='POLICY';
 requireThat(p.transactionHash===await digest(transactionJws)&&p.appTransactionHash===await digest(appTransactionJws),'NODE_EVIDENCE_BINDING');
 requireThat(p.result==='VERIFIED_FOR_FULFILLMENT_EVALUATION'&&p.failureCode===null&&p.deliveryGranted===false&&p.finishCalled===false,'NODE_REJECTED');
 requireThat(p.productId===policy.product&&p.subscriptionGroupId===policy.group&&p.bundleId===policy.bundle&&p.environment===policy.environment&&p.policyVersion===policy.policyVersion,'NODE_POLICY_MISMATCH');
 requireThat(typeof p.verifiedFacts==='string','NODE_FACTS_MISSING');const facts=parseCanonical(enc.encode(p.verifiedFacts),8192);
 requireThat(Object.keys(facts).length===Object.keys(factMap).length&&Object.keys(factMap).every(k=>Object.hasOwn(facts,k)),'NODE_INVALID_FACTS');
 requireThat(typeof facts.transactionId==='string'&&/^\d+$/.test(facts.transactionId)&&typeof facts.originalTransactionId==='string'&&/^\d+$/.test(facts.originalTransactionId)&&typeof facts.isUpgraded==='boolean','NODE_INVALID_FACTS');
 requireThat(facts.bundleId===p.bundleId&&facts.environment===p.environment&&facts.productId===p.productId&&facts.subscriptionGroupId===p.subscriptionGroupId,'NODE_FACTS_BINDING');
 requireThat(p.transactionIdentityHash===await digest(facts.bundleId+'\n'+facts.environment+'\n'+facts.transactionId)&&p.originalTransactionIdentityHash===await digest(facts.bundleId+'\n'+facts.environment+'\n'+facts.originalTransactionId),'NODE_IDENTITY_BINDING');
 const t=Object.freeze(Object.fromEntries(Object.entries(factMap).map(([from,to])=>[to,facts[from]])));this.#validated.set(t,{...context,verifiedAt:p.verifiedAt,freshUntil:p.freshUntil});emit('POLICY','PASS');return t;
 }catch(e){emit(stage,'FAIL',e?.code??'UNAVAILABLE');if(e instanceof AppleError){e.safeStage=stage;throw e;}throw new AppleError('NODE_UNAVAILABLE',503);}finally{clearTimeout(timer);controller.abort();}
 }
 async verifyNotification(){throw new AppleError('NODE_NOTIFICATIONS_NOT_CONFIGURED',503);}
}
