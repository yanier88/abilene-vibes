import {BUNDLE,AppleError,requireThat,uuid,iso,sha256,exactInput,sandbox,authenticate,reserve,start,deliverApplePurchase} from './domain.mjs';
import {recordNotification,processNotification,reconcile} from './reconciliation.mjs';

// Dependencies are server composition, never request payload or environment flags.
// Public Edge entry points intentionally do NOT instantiate a live backend yet.
export class AppleBackend {
  constructor({store,identityVerifier,appleVerifier,signer,clock=Date.now}) {
    Object.assign(this,{store,identityVerifier,appleVerifier,signer,clock});
  }
  async change(operation) {
    // Compare-and-swap retries have no external side effects: signing is after commit.
    for(let retry=0;retry<32;retry++) {
      const {version,state}=await this.store.read();
      const result=await operation(state,this.clock());
      if(await this.store.compareAndSwap(version,state))return result;
    }
    throw new AppleError('CONCURRENT_RETRY_REQUIRED',503);
  }
  async establishTechnicalSession(evidence) {
    requireThat(this.identityVerifier,'IDENTITY_NOT_CONFIGURED',503);
    const identity=await this.identityVerifier.verifyInstallation(evidence);
    sandbox(identity.environment);
    requireThat(identity.bundle_id===BUNDLE && identity.app_transaction_id && identity.key_id,'IDENTITY_REJECTED',401);
    const token=Array.from(crypto.getRandomValues(new Uint8Array(32)),x=>x.toString(16).padStart(2,'0')).join('');
    const hash=await sha256(token);
    await this.change((s,now)=>{
      let b=s.buyers.find(x=>x.bundle_id===BUNDLE && x.environment===identity.environment && x.app_transaction_id===identity.app_transaction_id);
      if(!b){b={id:uuid(),app_account_token:uuid(),app_transaction_id:identity.app_transaction_id,bundle_id:BUNDLE,environment:identity.environment,status:'active',created_at:iso(now),last_verified_at:iso(now)};s.buyers.push(b);}
      requireThat(b.status==='active','BUYER_DISABLED',401);b.last_verified_at=iso(now);
      let i=s.installations.find(x=>x.key_id===identity.key_id && x.environment===identity.environment);
      if(i) requireThat(i.buyer_id===b.id && !i.revoked_at,'INSTALLATION_CONFLICT',401);
      else {i={installation_id:uuid(),buyer_id:b.id,key_id:identity.key_id,attestation_status:'verified',environment:identity.environment,created_at:iso(now),last_seen_at:iso(now),revoked_at:null};s.installations.push(i);}
      s.capabilities.push({id:uuid(),token_hash:hash,buyer_id:b.id,installation_id:i.installation_id,environment:b.environment,scope:['prepare','verify','reconcile'],expires_at:iso(now+900000),revoked_at:null,created_at:iso(now)});
    });
    return token; // Only returned to caller; never stored or logged. No public bootstrap route yet.
  }
  async prepare(token,input) {
    const hash=await sha256(token);
    return this.change((s,now)=>{
      const a=authenticate(s,hash,'prepare',now),i=reserve(s,a,input,now);
      return {purchase_intent_id:i.id,slot_number:i.slot_number,product_id:i.product_id,app_account_token:a.buyer.app_account_token,expires_at:i.expires_at};
    });
  }
  async markPurchasing(token,id) {
    const hash=await sha256(token);
    return this.change((s,now)=>start(s,authenticate(s,hash,'prepare',now),id,now));
  }
  async verify(token,input) {
    exactInput(input,['purchase_intent_id','transaction_jws','app_transaction_jws','idempotency_key']);
    requireThat(this.appleVerifier && this.signer,'VERIFICATION_NOT_CONFIGURED',503);
    const hash=await sha256(token),snapshot=await this.store.read();
    authenticate(snapshot.state,hash,'verify',this.clock()); // Reject unauthenticated work before verification.
    const t=await this.appleVerifier.verifyTransaction(input.transaction_jws,input.app_transaction_jws);
    const payloadHash=await sha256(input.transaction_jws);
    const result=await this.change((s,now)=>{
      const a=authenticate(s,hash,'verify',now);
      const i=s.intents.find(x=>x.id===input.purchase_intent_id && x.buyer_id===a.buyer.id && x.environment===a.buyer.environment);
      requireThat(i,'INTENT_NOT_FOUND',404);
      requireThat(input.idempotency_key===i.idempotency_key,'IDEMPOTENCY_CONFLICT');
      const r=deliverApplePurchase(s,a,i,t,payloadHash,now);
      if(r.status==='reconciliation')return r;
      return {...r,claims:{iss:'abilene-apple-delivery',aud:BUNDLE,schema_version:1,transactionId:t.transaction_id,originalTransactionId:t.original_transaction_id,productId:t.product_id,buyer_id:a.buyer.id,appAccountToken:a.buyer.app_account_token,buyer_capability_id:a.capability.id,purchase_intent_id:i.id,listing_type:i.listing_type,listing_id:i.listing_id,environment:a.buyer.environment,delivery_id:r.delivery.id,installation_key_id:a.installation.key_id,request_nonce:uuid(),delivery_status:r.status}};
    });
    if(result.status==='reconciliation')return result;
    // Durable CAS/RPC transaction completed before any confirmation is signed.
    const issued=Math.floor(this.clock()/1000);
    return {status:result.status,delivery_id:result.delivery.id,confirmation:await this.signer.sign({...result.claims,issued_at:issued,iat:issued,exp:issued+300,jti:uuid()})};
  }
  async notification(signedPayload) {
    requireThat(this.appleVerifier,'VERIFICATION_NOT_CONFIGURED',503);
    const event=await this.appleVerifier.verifyNotification(signedPayload);
    const hash=await sha256(signedPayload);
    return this.change((s,now)=>{
      const n=recordNotification(s,event,hash,now);processNotification(s,n,now);
      return {notification_uuid:n.notification_uuid,status:n.status};
    });
  }
  async reconciliation(token) {
    const hash=await sha256(token);
    return this.change((s,now)=>{authenticate(s,hash,'reconcile',now);return reconcile(s,now);});
  }
}
