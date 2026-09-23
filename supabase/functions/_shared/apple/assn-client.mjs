import {NodeAppleVerifierClient,canonical,parseCanonical,digest,hmac,hex,FEATURED_POLICY} from './node-verifier-client.mjs';
import {AppleError,requireThat} from './domain.mjs';
const path='/v1/assn/verify',audience='abilene-node-assn';
export class ASSNAppleVerifierClient extends NodeAppleVerifierClient {
 #events=new WeakMap();#last=-Infinity;
 #now(){const n=this.clock();requireThat(n>=this.#last,'ASSN_CLOCK_ROLLBACK');this.#last=n;return n;}
 notificationDeadline(e){const v=this.#events.get(e);requireThat(v,'ASSN_UNVERIFIED');return v.until;}
 assertNotificationFresh(e){const v=this.#events.get(e),now=this.#now();requireThat(v&&now>=v.at&&Math.max(now,v.received+performance.now()-v.mono)<v.until,'ASSN_EXPIRED');}
 async verifyNotification(signedPayload){
  requireThat(typeof signedPayload==='string'&&new TextEncoder().encode(signedPayload).length<=131072,'ASSN_INPUT');
  const body=canonical({signedPayload,policyId:'sandbox-assn-v1'}),start=this.#now(),requestId=crypto.randomUUID();
  const signed={schemaVersion:1,keyId:this.requestKeyId,method:'POST',path,audience,requestId,timestamp:start,nonce:hex(crypto.getRandomValues(new Uint8Array(16))),bodyHash:await digest(body)};
  const auth=btoa(String.fromCharCode(...canonical({...signed,mac:await hmac(this.requestKey,canonical(signed))}))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
  const controller=new AbortController();let timer;
  try{
   const r=await Promise.race([Promise.resolve().then(()=>this.exchange({method:'POST',path,body,auth,signal:controller.signal})),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new AppleError('ASSN_TIMEOUT',503));},this.timeoutMs);})]);
   const p=parseCanonical(r.body,32768);const fields=['schemaVersion','keyId','audience','requestId','requestBodyHash','signedPayloadHash','policyVersion','verifiedAt','freshUntil','result','failureCode','eventFacts'];
   requireThat(Object.keys(p).length===fields.length&&fields.every(k=>Object.hasOwn(p,k)),'ASSN_CONTRACT');
   requireThat(typeof r.signature==='string'&&/^[a-f0-9]{64}$/.test(r.signature),'ASSN_AUTH');
   const raw=this.responseKeys?this.responseKeys.resolve(p.keyId):this.responseKey;
   const key=await crypto.subtle.importKey('raw',raw,{name:'HMAC',hash:'SHA-256'},false,['verify']);
   requireThat(await crypto.subtle.verify('HMAC',key,Uint8Array.from(r.signature.match(/../g),x=>parseInt(x,16)),r.body),'ASSN_AUTH');
   requireThat(r.httpStatus===200&&p.schemaVersion===1&&(this.responseKeys||p.keyId==='response-v1')&&p.audience==='abilene-supabase-assn'&&p.requestId===requestId&&p.requestBodyHash===signed.bodyHash&&p.signedPayloadHash===await digest(signedPayload)&&p.policyVersion==='phase73-v1'&&p.result==='VERIFIED_FOR_RECONCILIATION'&&p.failureCode===null,'ASSN_BINDING');
   const now=this.#now();requireThat(Number.isSafeInteger(p.verifiedAt)&&Number.isSafeInteger(p.freshUntil)&&p.verifiedAt>=start&&p.verifiedAt<=now&&now<p.freshUntil&&p.freshUntil<=p.verifiedAt+60000,'ASSN_EXPIRED');
   requireThat(typeof p.eventFacts==='string','ASSN_FACTS');const e=JSON.parse(p.eventFacts);requireThat(JSON.stringify(e)===p.eventFacts&&e.bundle_id===FEATURED_POLICY.bundle&&e.environment==='Sandbox'&&e.product_id===FEATURED_POLICY.product&&e.transaction?.subscription_group_id===FEATURED_POLICY.group&&typeof e.notification_uuid==='string'&&Number.isSafeInteger(e.signed_date),'ASSN_FACTS');
   Object.freeze(e.transaction);Object.freeze(e);this.#events.set(e,{at:p.verifiedAt,until:p.freshUntil,received:now,mono:performance.now()});return e;
  }catch(e){if(e instanceof AppleError)throw e;throw new AppleError('ASSN_REJECTED',503);}finally{clearTimeout(timer);controller.abort();}
 }
}
