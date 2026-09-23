import {compositionInput as authenticFixture} from './current-authentic-replay-fixture.mjs';
// TEST ONLY: CAS/replay/Node-result doubles. No entrypoint imports this file.
import {setup} from './fixtures.mjs';
import {NodeAppleVerifierClient,canonical,digest,FEATURED_POLICY} from '../../supabase/functions/_shared/apple/node-verifier-client.mjs';
import {RestrictedReplayStore} from '../../supabase/functions/_shared/apple/restricted-replay-store.mjs';
import {verifyLocalDeliveryAck} from '../../supabase/functions/_shared/apple/delivery-ack.mjs';
import {configure} from '/Users/yanier/Documents/abilene-apple-verifier/src/config.mjs';
import {authenticate} from '/Users/yanier/Documents/abilene-apple-verifier/src/request-auth.mjs';
import {signResponse} from '/Users/yanier/Documents/abilene-apple-verifier/src/response-auth.mjs';
import {randomBytes} from 'node:crypto';import fs from 'node:fs';
export class SharedNonceRepository{
 constructor(clock){this.clock=clock;this.entries=new Map();this.last=-Infinity;this.fail=false;}
 async claimAtomic({nonceHash,ttlMs}){if(this.fail)throw Error('storage unavailable');const now=this.clock();if(now<this.last||ttlMs!==120000)throw Error('clock/ttl');this.last=now;for(const[k,v]of this.entries)if(v<=now)this.entries.delete(k);if(this.entries.has(nonceHash))return false;if(this.entries.size>=4096)throw Error('capacity');this.entries.set(nonceHash,now+ttlMs);return true;}
}
export class LocalAckSigner{
 static async create(){const s=new LocalAckSigner();s.keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);s.calls=0;return s;}
 async sign(claims){this.calls++;const b64=b=>Buffer.from(b).toString('base64url');const h=b64(JSON.stringify({alg:'ES256',typ:'LOCAL-delivery+jwt',kid:'local-ephemeral'}));const p=b64(JSON.stringify({...claims,iss:'abilene-apple-delivery-local'}));const data=h+'.'+p;const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},this.keys.privateKey,new TextEncoder().encode(data));return {kind:'LOCAL.apple.delivery.v1',signed_jws:data+'.'+b64(sig)};}
}
export async function integration({realTime=false}={}){
 const f=await setup();if(realTime)f.advance(Date.now()-f.now());f.store.state.catalog=f.store.state.catalog.map(p=>({...p,enabled:p.plan==='featured'&&p.slot_number===1,subscription_group_id:p.plan==='featured'&&p.slot_number===1?'22382531':null}));
 const token=await f.buyer(),listing=await f.listing(token);const purchase=await f.purchase(token,listing,{subscription_group_id:'22382531'});
 // Faithful local guard: publish the whole candidate only after deadline check.
 const baseCas=f.store.compareAndSwap.bind(f.store);
 f.store.compareAndSwap=async(version,state,{notAfter}={})=>{
   if(f.store.beforePublish)await f.store.beforePublish();
   if(notAfter!==undefined&&f.now()>=notAfter)throw Error('VERIFICATION_EXPIRED_AT_COMMIT');
   return baseCas(version,state);
 };
 const signer=await LocalAckSigner.create();f.backend.signer=signer;
 const nonceRepo=new SharedNonceRepository(f.now);const replayStore=new RestrictedReplayStore(nonceRepo);
 const c=configure({requestKey:randomBytes(32),responseKey:randomBytes(32),rootDer:Buffer.from(authenticFixture.rootDer),clock:f.now,replayStore});
 const hooks={calls:0,alterRequest:null,alterClaims:null,alterResult:null,fail:null};
 async function exchange(request){hooks.calls++;if(hooks.fail)throw Error(hooks.fail);if(hooks.alterRequest)request=hooks.alterRequest(request);
 const auth=await authenticate(c,{...request,body:Buffer.from(request.body)});const t=await f.verifier.verifyTransaction(auth.input.transactionJws);
 const facts=Object.fromEntries(Object.entries(t).map(([k,v])=>[k.replace(/_([a-z])/g,(_,ch)=>ch.toUpperCase()),v??null]));
 let claims={requestId:auth.requestId,requestBodyHash:auth.requestBodyHash,transactionHash:await digest(auth.input.transactionJws),appTransactionHash:await digest(auth.input.appTransactionJws),transactionIdentityHash:await digest(t.bundle_id+'\n'+t.environment+'\n'+t.transaction_id),originalTransactionIdentityHash:await digest(t.bundle_id+'\n'+t.environment+'\n'+t.original_transaction_id),productId:t.product_id,subscriptionGroupId:t.subscription_group_id,bundleId:t.bundle_id,environment:t.environment,policyVersion:FEATURED_POLICY.policyVersion,verifiedAt:f.now(),freshUntil:f.now()+60000,result:'VERIFIED_FOR_FULFILLMENT_EVALUATION',failureCode:null,deliveryGranted:false,finishCalled:false,verifiedFacts:Buffer.from(canonical(facts)).toString()};
 if(hooks.alterClaims)claims=hooks.alterClaims(claims);let result={...signResponse(c,claims),httpStatus:200};if(hooks.alterResult)result=hooks.alterResult(result);return result;
 }
 const client=new NodeAppleVerifierClient({requestKey:c.requestKey,responseKey:c.responseKey,clock:f.now,exchange});f.backend.appleVerifier=client;
 const verify=()=>f.backend.verify(token,purchase.input);
 async function gate(result,overrides={}){const cap=f.store.state.capabilities.find(x=>x.buyer_id===f.store.state.buyers[0].id),install=f.store.state.installations.find(x=>x.installation_id===cap.installation_id);return verifyLocalDeliveryAck(result.confirmation,{transactionId:purchase.t.transaction_id,buyer_id:cap.buyer_id,installation_id:install.installation_id,installation_key_id:install.key_id,delivery_id:result.delivery_id,productId:purchase.t.product_id,environment:'Sandbox',...overrides},signer.keys.publicKey,Math.floor(f.now()/1000));}
 return {...f,token,listing,purchase,signer,nonceRepo,replayStore,config:c,hooks,client,exchange,verify,gate};
}
