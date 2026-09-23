import {setup} from './fixtures.mjs';
import {RecoveryAuthorizer} from '../../supabase/functions/_shared/apple/recovery-authorization.mjs';
import {sha256,uuid} from '../../supabase/functions/_shared/apple/domain.mjs';
export async function expiredFixture({active=false,realTime=false}={}){
 const f=await setup();if(realTime)f.advance(Date.now()-f.now());
 const token=await f.buyer(),listing=await f.listing(token),purchase=await f.purchase(token,listing);
 const t={...purchase.t,expires_date:new Date(f.now()+(active?3600000:-1)).toISOString(),purchase_date:new Date(f.now()-60000).toISOString()};
 f.store.state.intents[0].started_at=new Date(f.now()-90000).toISOString();
 const jws='TEST.'+Buffer.from(JSON.stringify({signedDate:f.now()-50000})).toString('base64url')+'.TEST';
 f.verifier.evidence.set(jws,t);purchase.input.transaction_jws=jws;purchase.t=t;
 const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 f.backend.recoveryAuthorizer=new RecoveryAuthorizer({publicKey:keys.publicKey,keyId:'test-existing',clock:f.now});
 const events=[];f.backend.log=x=>events.push(JSON.parse(x));
 async function grant(overrides={}){
  const i=f.store.state.intents[0],claims={iss:'abilene-recovery-authority',aud:'apple-delivery-recovery',jti:uuid(),iat:Math.floor(f.now()/1000),exp:Math.floor(f.now()/1000)+300,purpose:'recover-existing-purchase-v1',buyer_id:i.buyer_id,installation_id:i.originating_installation_id,purchase_intent_id:i.id,listing_type:i.listing_type,listing_id:i.listing_id,app_account_token:i.app_account_token,product_id:i.product_id,subscription_group_id:i.subscription_group_id,bundle_id:i.bundle_id,environment:i.environment,evidence_sha256:await sha256(purchase.input.transaction_jws),app_evidence_sha256:await sha256(purchase.input.app_transaction_jws),...overrides};
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),data=enc({alg:'ES256',typ:'apple-delivery-recovery+jwt',kid:'test-existing'})+'.'+enc(claims),signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(data));return data+'.'+Buffer.from(signature).toString('base64url');
 }
 return {...f,token,listing,purchase,events,grant,recover:async authorization=>f.backend.recoverExisting(token,{...purchase.input,recovery_authorization:authorization??await grant()})};
}
