// TEST ONLY: real ECDSA recovery authorizations and existing integration doubles.
import {integration} from './node-integration-fixtures.mjs';
import {RecoveryAuthorizer} from '../../supabase/functions/_shared/apple/recovery-authorization.mjs';
import {BUNDLE,uuid,sha256} from '../../supabase/functions/_shared/apple/domain.mjs';
export async function bindingFixture(options={}){
 const f=await integration(options);const keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);
 f.backend.recoveryAuthorizer=new RecoveryAuthorizer({publicKey:keys.publicKey,keyId:'test-recovery-authority',clock:f.now});
 async function installation(key='TEST-NEW-INSTALLATION',buyer=f.store.state.buyers[0]){
  f.backend.identityVerifier={verifyInstallation:async()=>({bundle_id:BUNDLE,environment:buyer.environment,app_transaction_id:buyer.app_transaction_id,key_id:key})};
  return f.backend.establishTechnicalSession('TEST-VERIFIED-INSTALLATION');
 }
 async function grant(token,overrides={}){
  const hash=await sha256(token),cap=f.store.state.capabilities.find(c=>c.token_hash===hash),i=f.store.state.intents[0],d=f.store.state.deliveries[0],sub=f.store.state.subscriptions[0];
  const now=Math.floor(f.now()/1000),claims={iss:'abilene-recovery-authority',aud:'apple-delivery-recovery',jti:uuid(),iat:now,exp:now+300,buyer_id:cap.buyer_id,installation_id:cap.installation_id,purchase_intent_id:i.id,delivery_id:d?.id??uuid(),original_transaction_id:sub?.original_transaction_id??'999',listing_type:i.listing_type,listing_id:i.listing_id,app_account_token:i.app_account_token,product_id:i.product_id,subscription_group_id:i.subscription_group_id,bundle_id:i.bundle_id,environment:i.environment,...overrides};
  const enc=x=>Buffer.from(JSON.stringify(x)).toString('base64url'),h=enc({alg:'ES256',typ:'apple-delivery-recovery+jwt',kid:'test-recovery-authority'}),p=enc(claims),data=h+'.'+p;
  const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},keys.privateKey,new TextEncoder().encode(data));return data+'.'+Buffer.from(sig).toString('base64url');
 }
 return {...f,installation,grant,recover:(token,grant)=>f.backend.recover(token,{...f.purchase.input,recovery_authorization:grant})};
}
