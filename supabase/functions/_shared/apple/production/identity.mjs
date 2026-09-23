import {sha256,requireThat} from '../domain.mjs';
const enc=new TextEncoder();
const decode=s=>{requireThat(typeof s==='string'&&/^[A-Za-z0-9+/]+={0,2}$/.test(s)&&s.length<=1024,'INSTALLATION_KEY_INVALID',400);return Uint8Array.from(atob(s),c=>c.charCodeAt(0));};
export async function installationKey(spki){const bytes=decode(spki);const key=await crypto.subtle.importKey('spki',bytes,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);const digest=await crypto.subtle.digest('SHA-256',bytes);return {key,id:[...new Uint8Array(digest)].map(x=>x.toString(16).padStart(2,'0')).join('')};}
export async function verifyProof(spki,signature,message){try{const {key}=await installationKey(spki);requireThat(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,decode(signature),enc.encode(message)),'INSTALLATION_PROOF_REJECTED',401);}catch{requireThat(false,'INSTALLATION_PROOF_REJECTED',401);}}
export class ProductionIdentity {
 constructor({db,verifier,clock=Date.now}){Object.assign(this,{db,verifier,clock});}
 async challenge(user,input){const k=await installationKey(input.public_spki);return this.db.rpc('apple_bootstrap_challenge',{p_user:user.id,p_key:k.id,p_spki:input.public_spki});}
 async complete(user,input){
  const c=await this.db.challenge(input.challenge_id);requireThat(c&&c.user_id===user.id&&!c.consumed_at&&Date.parse(c.expires_at)>this.clock(),'CHALLENGE_REJECTED',401);
  const message=JSON.stringify(['apple-bootstrap-v1',c.id,c.nonce,input.listing_type,input.listing_id,await sha256(input.app_transaction_jws)]);
  await verifyProof(c.public_spki,input.signature,message);
  const a=await this.verifier.verifyAppTransaction(input.app_transaction_jws);
  return this.db.rpc('apple_bootstrap_complete',{p_user:user.id,p_challenge:c.id,p_app_transaction:a.app_transaction_id,p_listing_type:input.listing_type,p_listing:input.listing_id,p_not_after:new Date(a.notAfter).toISOString()});
 }
 async request(user,action,input){
  requireThat(typeof input.payload_text==='string'&&input.payload_text.length<=180000&&typeof input.nonce==='string'&&Number.isSafeInteger(input.issued_at),'REQUEST_INVALID',400);
  const k=await this.db.installation(input.key_id);requireThat(k&&k.key_id===input.key_id&&k.installation_id&&k.user_id===user.id&&!k.revoked_at,'INSTALLATION_REJECTED',401);
  requireThat(Math.abs(this.clock()-input.issued_at)<=120000,'REQUEST_EXPIRED',401);
  const message=JSON.stringify(['apple-request-v1',action,input.nonce,String(input.issued_at),await sha256(input.payload_text)]);
  await verifyProof(k.public_spki,input.signature,message);
  await this.db.rpc('apple_consume_installation_nonce',{p_user:user.id,p_key:k.key_id,p_nonce:input.nonce,p_issued:input.issued_at});
  const payload=JSON.parse(input.payload_text);requireThat(payload&&typeof payload==='object'&&!Array.isArray(payload),'REQUEST_INVALID',400);
  return {installation:k,payload};
 }
}
