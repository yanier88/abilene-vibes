// TEST ONLY. Never imported by Supabase entry points or shared backend modules.
import {AppleBackend} from '../../supabase/functions/_shared/apple/backend.mjs';
import {BUNDLE,emptyState,candidateCatalog,uuid,iso,sha256} from '../../supabase/functions/_shared/apple/domain.mjs';
export class MemoryRepository {
  constructor(state=emptyState()) {this.state=structuredClone(state);this.version=0;this.crashBefore=false;this.crashAfter=false;}
  async read() {return {version:this.version,state:structuredClone(this.state)};}
  async compareAndSwap(version,state) {
    if(version!==this.version)return false;
    if(this.crashBefore){this.crashBefore=false;throw new Error('TEST_CRASH_BEFORE_COMMIT');}
    this.state=structuredClone(state);this.version++;
    if(this.crashAfter){this.crashAfter=false;throw new Error('TEST_LOST_RESPONSE_AFTER_COMMIT');}
    return true;
  }
}
export class FixtureAppleVerifier {
  constructor(){this.evidence=new Map();}
  register(value){const handle='TEST-EVIDENCE-'+uuid();this.evidence.set(handle,structuredClone(value));return handle;}
  async verifyTransaction(handle){if(!this.evidence.has(handle))throw new Error('UNVERIFIED');return structuredClone(this.evidence.get(handle));}
  async verifyNotification(handle){return this.verifyTransaction(handle);}
}
const encode=s=>Buffer.from(s).toString('base64url');
// Actual WebCrypto ECDSA for testing our delivery contract, NOT Apple verification.
// Nonextractable ephemeral key; distinct envelope + issuer; cannot pass native production verifier.
export class FixtureDeliverySigner {
  static async create(){const s=new FixtureDeliverySigner();s.keys=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},false,['sign','verify']);return s;}
  async sign(claims){
    const payload={...claims,iss:'TEST-ONLY-abilene-apple-delivery'};
    const body=encode(JSON.stringify({alg:'ES256',typ:'TEST-ONLY-delivery+jwt',kid:'ephemeral-test'}))+'.'+encode(JSON.stringify(payload));
    const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},this.keys.privateKey,new TextEncoder().encode(body));
    return {kind:'TEST-ONLY.apple.delivery.v1',signed_jws:body+'.'+Buffer.from(signature).toString('base64url')};
  }
  async verify(envelope,expected,now){
    if(envelope.kind!=='TEST-ONLY.apple.delivery.v1')return false;
    try{
      const [h,p,s,...rest]=envelope.signed_jws.split('.');if(rest.length)return false;
      const header=JSON.parse(Buffer.from(h,'base64url')),c=JSON.parse(Buffer.from(p,'base64url'));
      if(header.alg!=='ES256'||header.typ!=='TEST-ONLY-delivery+jwt'||header.kid!=='ephemeral-test'||c.iss!=='TEST-ONLY-abilene-apple-delivery'||c.aud!==BUNDLE||c.environment!=='Sandbox'||c.iat>now||c.exp<=now||c.exp-c.iat>300||c.issued_at!==c.iat)return false;
      if(!Object.entries(expected).every(([k,v])=>c[k]===v))return false;
      return crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},this.keys.publicKey,Buffer.from(s,'base64url'),new TextEncoder().encode(h+'.'+p));
    }catch{return false;}
  }
}
export async function setup(){
  const store=new MemoryRepository();store.state.catalog=candidateCatalog().map(p=>({...p,enabled:true,subscription_group_id:'TEST-GROUP-'+p.slot_number}));store.state.listings=[];
  const verifier=new FixtureAppleVerifier(),signer=await FixtureDeliverySigner.create();let now=1800000000000;
  const identities=new Map();
  const backend=new AppleBackend({store,appleVerifier:verifier,signer,clock:()=>now,identityVerifier:{async verifyInstallation(handle){if(!identities.has(handle))throw new Error('INVALID_INSTALLATION_PROOF');return identities.get(handle);}}});
  async function buyer(label='A'){
    const handle='TEST-INSTALLATION-'+label;identities.set(handle,{bundle_id:BUNDLE,environment:'Sandbox',app_transaction_id:'TEST-APP-'+label,key_id:'TEST-KEY-'+label});
    return backend.establishTechnicalSession(handle);
  }
  async function listing(token,kind='business',status='approved'){
    const hash=await sha256(token),cap=store.state.capabilities.find(c=>c.token_hash===hash);
    const id=uuid();store.state.listings.push({listing_type:kind,listing_id:id,status,stripe_conflict:false});
    store.state.grants.push({id:uuid(),buyer_id:cap.buyer_id,environment:'Sandbox',listing_type:kind,listing_id:id,expires_at:iso(now+86400000),revoked_at:null,created_at:iso(now)});
    return {listing_type:kind,listing_id:id,requested_plan:'featured',idempotency_key:uuid()};
  }
  async function purchase(token,input,overrides={}){
    const prepared=await backend.prepare(token,input);await backend.markPurchasing(token,prepared.purchase_intent_id);
    const hash=await sha256(token),cap=store.state.capabilities.find(c=>c.token_hash===hash);
    const b=store.state.buyers.find(b=>b.id===cap.buyer_id);
    const id=String(++sequence);
    const t={bundle_id:BUNDLE,environment:'Sandbox',transaction_id:id,original_transaction_id:id,product_id:prepared.product_id,app_account_token:prepared.app_account_token,app_transaction_id:b.app_transaction_id,subscription_group_id:'TEST-GROUP-'+prepared.slot_number,purchase_date:iso(now),expires_date:iso(now+86400000),revocation_date:null,revocation_reason:null,ownership_type:'PURCHASED',is_upgraded:false,...overrides};
    return {t,input:{purchase_intent_id:prepared.purchase_intent_id,transaction_jws:verifier.register(t),app_transaction_jws:'TEST-APP-PROOF',idempotency_key:input.idempotency_key}};
  }
  let sequence=100;
  return {store,backend,verifier,signer,buyer,listing,purchase,now:()=>now,advance:ms=>{now+=ms;}};
}
