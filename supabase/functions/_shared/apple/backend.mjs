import {reconcileExpired} from './expired-reconciliation.mjs';
import {observer} from './safe-observability.mjs';
import {BUNDLE,AppleError,requireThat,uuid,iso,sha256,exactInput,sandbox,authenticate,reserve,start,deliverApplePurchase,listingFor,intentBinding,recoverExistingDelivery} from './domain.mjs';
import {recordNotification,processNotification,reconcile} from './reconciliation.mjs';

// Dependencies are server composition, never request payload or environment flags.
// Public Edge entry points intentionally do NOT instantiate a live backend yet.
export class AppleBackend {
  constructor({store,identityVerifier,appleVerifier,signer,recoveryAuthorizer,log=()=>{},clock=Date.now,environment='Sandbox'}) {
    requireThat(['Sandbox','Production'].includes(environment),'ENVIRONMENT_DISABLED',503);
    Object.assign(this,{store,identityVerifier,appleVerifier,signer,recoveryAuthorizer,log,clock,environment});
  }
  async change(operation,commitGuard={},emit=()=>{}) {
    // Compare-and-swap retries have no external side effects: signing is after commit.
    for(let retry=0;retry<32;retry++) {
      const {version,state}=await this.store.read();
      let result;
      try{result=await operation(state,this.clock());emit('CLAIM','PASS');}
      catch(e){emit('CLAIM','FAIL',e?.code??'REJECTED');emit('DB','NOT_REACHED','REJECTED');throw e;}
      emit('CAS','ENTER');emit('DB','ENTER');
      try{
        if(await this.store.compareAndSwap(version,state,commitGuard)){emit('CAS','PASS');emit('DB','PASS','COMMIT');return result;}
        emit('CAS','FAIL','CONFLICT');
      }catch(e){emit('CAS','FAIL',e?.code??'REJECTED');emit('DB','FAIL',e.commitState==='ROLLED_BACK'?'ROLLBACK':'COMMIT_UNKNOWN');throw e;}
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
      const a=authenticate(s,hash,'prepare',now,this.environment),i=reserve(s,a,input,now);
      return {purchase_intent_id:i.id,slot_number:i.slot_number,product_id:i.product_id,app_account_token:a.buyer.app_account_token,expires_at:i.expires_at};
    });
  }
  async markPurchasing(token,id) {
    const hash=await sha256(token);
    return this.change((s,now)=>start(s,authenticate(s,hash,'prepare',now,this.environment),id,now));
  }
  async verify(token,input,trace) { return this.#verify(token,input,undefined,false,trace); }
  async recover(token,input) {
    exactInput(input,['purchase_intent_id','transaction_jws','app_transaction_jws','idempotency_key','recovery_authorization']);
    requireThat(this.recoveryAuthorizer,'RECOVERY_NOT_CONFIGURED',503);
    const {recovery_authorization,...purchase}=input;
    return this.#verify(token,purchase,recovery_authorization);
  }
  async recoverExisting(token,input,trace) {
    exactInput(input,['purchase_intent_id','transaction_jws','app_transaction_jws','idempotency_key','recovery_authorization']);
    requireThat(this.recoveryAuthorizer,'RECOVERY_NOT_CONFIGURED',503);
    const {recovery_authorization,...purchase}=input;
    return this.#verify(token,purchase,recovery_authorization,true,trace);
  }
  async #verify(token,input,recoveryAuthorization,existing=false,trace) {
    const emit=trace??observer(this.log,undefined,existing?'recover-existing':'verify');
    let stage='AUTH';
    try {
    exactInput(input,['purchase_intent_id','transaction_jws','app_transaction_jws','idempotency_key']);
    requireThat(this.appleVerifier && this.signer,'VERIFICATION_NOT_CONFIGURED',503);
    const hash=await sha256(token),snapshot=await this.store.read();
    const resolve=(s,now)=>{
      const a=authenticate(s,hash,'verify',now,this.environment);
      const i=s.intents.find(x=>x.id===input.purchase_intent_id&&x.buyer_id===a.buyer.id&&x.environment===a.buyer.environment);
      requireThat(i,'INTENT_NOT_FOUND',404);requireThat(input.idempotency_key===i.idempotency_key,'IDEMPOTENCY_CONFLICT');
      intentBinding(a,i,{recovery:recoveryAuthorization!==undefined&&!existing});
      listingFor(s,a.buyer,i.listing_type,i.listing_id,now);
      const p=s.catalog.find(p=>p.product_id===i.product_id&&p.environment===a.buyer.environment&&p.bundle_id===BUNDLE&&p.enabled&&p.subscription_group_id);
      requireThat(p && p.subscription_group_id===i.subscription_group_id && p.bundle_id===i.bundle_id,'CATALOG_NOT_CONFIGURED',503);
      return {a,i,context:{intentId:i.id,bundle:BUNDLE,environment:a.buyer.environment,product:p.product_id,group:p.subscription_group_id}};
    };
    if(existing)requireThat(Array.isArray(snapshot.state.expired_purchases),'RECOVERY_SCHEMA_REQUIRED',503);
    const initial=resolve(snapshot.state,this.clock());emit('AUTH','PASS');
    const evidenceHash=await sha256(input.transaction_jws),appEvidenceHash=await sha256(input.app_transaction_jws);
    const recoveryContext=(s,{a,i})=>{
      if(existing)return {purpose:'recover-existing-purchase-v1',buyer_id:a.buyer.id,installation_id:a.installation.installation_id,purchase_intent_id:i.id,listing_type:i.listing_type,listing_id:i.listing_id,app_account_token:i.app_account_token,product_id:i.product_id,subscription_group_id:i.subscription_group_id,bundle_id:i.bundle_id,environment:i.environment,evidence_sha256:evidenceHash,app_evidence_sha256:appEvidenceHash};
      requireThat(i.status==='completed','RECOVERY_REQUIRES_DELIVERY');
      const d=s.deliveries.find(d=>d.purchase_intent_id===i.id && d.buyer_id===a.buyer.id && d.environment===i.environment);
      const assignment=d&&s.assignments.find(x=>x.id===d.assignment_id && x.purchase_intent_id===i.id && x.buyer_id===a.buyer.id && x.listing_id===i.listing_id && x.listing_type===i.listing_type && !x.closed_at);
      const sub=assignment&&s.subscriptions.find(x=>x.id===assignment.subscription_id && x.buyer_id===a.buyer.id && x.environment===i.environment && x.bundle_id===i.bundle_id && x.product_id===i.product_id);
      requireThat(d && assignment && sub && !['revoked','reconciliation','expired'].includes(sub.status),'RECOVERY_REQUIRES_DELIVERY');
      return {buyer_id:a.buyer.id,installation_id:a.installation.installation_id,purchase_intent_id:i.id,delivery_id:d.id,original_transaction_id:sub.original_transaction_id,listing_type:i.listing_type,listing_id:i.listing_id,app_account_token:i.app_account_token,product_id:i.product_id,subscription_group_id:i.subscription_group_id,bundle_id:i.bundle_id,environment:i.environment};
    };
    let recoveryProof,recoveryHash,recoveryDigest;
    if(recoveryAuthorization!==undefined){
      const expected=recoveryContext(snapshot.state,initial);
      recoveryProof=await this.recoveryAuthorizer.verifyAuthorization(recoveryAuthorization,expected);
      requireThat(recoveryProof && typeof recoveryProof.authorization_id==='string' && /^[0-9a-f-]{36}$/.test(recoveryProof.authorization_id) && Number.isSafeInteger(recoveryProof.expires_at) && this.clock()<recoveryProof.expires_at && recoveryProof.expires_at<=this.clock()+300000,'RECOVERY_AUTHORIZATION_REJECTED',403);
      recoveryHash=await sha256(recoveryProof.authorization_id);
      recoveryDigest=await sha256(JSON.stringify(expected));
      requireThat(!snapshot.state.challenges.some(c=>c.nonce_hash===recoveryHash),'RECOVERY_AUTHORIZATION_REPLAY',403);
    }
    stage='NODE';emit(stage,'ENTER');
    const t=await this.appleVerifier.verifyTransaction(input.transaction_jws,input.app_transaction_jws,{...initial.context,emit});emit(stage,'PASS');
    // Read signedDate only after the exact JWS passed the server verifier. Never logs payload.
    let signedDate;if(existing){try{signedDate=JSON.parse(new TextDecoder().decode(Uint8Array.from(atob(input.transaction_jws.split('.')[1].replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0)))).signedDate;}catch{throw new AppleError('TRANSACTION_SIGNED_DATE');}}
    stage='DB';
    const payloadHash=await sha256(input.transaction_jws);
    const result=await this.change(async(s,now)=>{
      const resolved=resolve(s,now),{a,i,context}=resolved;
      if(this.appleVerifier.assertFresh)this.appleVerifier.assertFresh(t,now,context);
      let r;
      if(recoveryProof){
        requireThat(now<recoveryProof.expires_at,'RECOVERY_AUTHORIZATION_EXPIRED',403);
        requireThat(await sha256(JSON.stringify(recoveryContext(s,resolved)))===recoveryDigest,'RECOVERY_BINDING_MISMATCH',403);
        requireThat(!s.challenges.some(c=>c.nonce_hash===recoveryHash),'RECOVERY_AUTHORIZATION_REPLAY',403);
        if(existing){
          if(Date.parse(t.expires_date)<=now&&!s.transactions.some(x=>x.bundle_id===t.bundle_id&&x.environment===t.environment&&x.transaction_id===t.transaction_id)) r=reconcileExpired(s,a,i,t,payloadHash,appEvidenceHash,signedDate,now);
          else r=deliverApplePurchase(s,a,i,t,payloadHash,now);
        }else r=recoverExistingDelivery(s,a,i,t,now);
        s.challenges.push({id:uuid(),nonce_hash:recoveryHash,installation_id:a.installation.installation_id,environment:i.environment,purpose:existing?'purchase-recovery-v1':'delivery-recovery-v1',request_digest:recoveryDigest,expires_at:iso(recoveryProof.expires_at),created_at:iso(now),consumed_at:iso(now)});
      } else r=deliverApplePurchase(s,a,i,t,payloadHash,now);
      if(r.status==='reconciliation'||r.status==='verified_expired_undelivered')return r;
      return {...r,claims:{iss:'abilene-apple-delivery',aud:BUNDLE,schema_version:1,schemaVersion:1,ackId:uuid(),deliveredAt:r.delivery.created_at,installation_id:a.installation.installation_id,transactionId:t.transaction_id,originalTransactionId:t.original_transaction_id,productId:t.product_id,buyer_id:a.buyer.id,appAccountToken:a.buyer.app_account_token,buyer_capability_id:a.capability.id,purchase_intent_id:i.id,listing_type:i.listing_type,listing_id:i.listing_id,environment:a.buyer.environment,delivery_id:r.delivery.id,installation_key_id:a.installation.key_id,request_nonce:uuid(),delivery_status:r.status}};
    },this.appleVerifier.verificationDeadline?{notAfter:Math.min(this.appleVerifier.verificationDeadline(t),recoveryProof?.expires_at??Infinity)}:recoveryProof?{notAfter:recoveryProof.expires_at}:{},emit);
    if(result.status==='reconciliation'||result.status==='verified_expired_undelivered'){emit('COMMERCIAL','PASS',result.commercialState??'REJECTED');emit('ACK','NOT_REACHED','NOT_ISSUED');return result;}
    emit('COMMERCIAL','PASS',result.status==='already_delivered'?'VERIFIED_ALREADY_DELIVERED':'VERIFIED_ACTIVE_DELIVERABLE');stage='ACK';
    // Durable CAS/RPC transaction completed before any confirmation is signed.
    if(this.appleVerifier.assertFresh)this.appleVerifier.assertFresh(t,this.clock(),initial.context);
    const signingStarted=this.clock(),monotonicStarted=performance.now();
    const issued=Math.floor(signingStarted/1000);
    const confirmation=await this.signer.sign({...result.claims,issued_at:issued,iat:issued,exp:issued+300,jti:uuid()});
    // Signing can outlive verification. Keep committed delivery for explicit recovery,
    // but never publish this acknowledgement after expiry or clock rollback.
    const completed=this.clock();
    requireThat(completed>=signingStarted,'VERIFICATION_CLOCK_ROLLBACK',503);
    if(recoveryProof)requireThat(completed<recoveryProof.expires_at,'RECOVERY_AUTHORIZATION_EXPIRED',403);
    if(this.appleVerifier.assertFresh)this.appleVerifier.assertFresh(t,Math.max(completed,signingStarted+performance.now()-monotonicStarted),initial.context);
    emit('ACK','PASS','ISSUED');
    return {status:result.status,delivery_id:result.delivery.id,confirmation};
    }catch(e){emit(e.safeStage??stage,'FAIL',e?.code??'REJECTED');if(e instanceof AppleError)e.safeStage??=stage;throw e;}
  }
  async notification(signedPayload) {
    requireThat(this.appleVerifier,'VERIFICATION_NOT_CONFIGURED',503);
    const event=await this.appleVerifier.verifyNotification(signedPayload);
    const hash=await sha256(signedPayload);
    const result=await this.change((s,now)=>{
      if(this.appleVerifier.assertNotificationFresh)this.appleVerifier.assertNotificationFresh(event);
      const facts=this.appleVerifier.assertNotificationFresh?{...event,verification_source:'ASSN_NODE'}:event;
      const n=recordNotification(s,facts,hash,now,this.environment);processNotification(s,n,now);
      return {notification_uuid:n.notification_uuid,status:n.status};
    },this.appleVerifier.notificationDeadline?{notAfter:this.appleVerifier.notificationDeadline(event)}:{});
    if(this.appleVerifier.assertNotificationFresh)this.appleVerifier.assertNotificationFresh(event);
    return result;
  }
  async reconciliation(token) {
    const hash=await sha256(token);
    return this.change((s,now)=>{authenticate(s,hash,'reconcile',now,this.environment);return reconcile(s,now);});
  }
}
