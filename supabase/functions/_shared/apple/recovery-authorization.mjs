// Server-injected administrative recovery authority. No client key or trust flag.
import {requireThat} from './domain.mjs';
const decode=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export class RecoveryAuthorizer {
  constructor({publicKey,keyId,clock=Date.now}) {requireThat(publicKey&&typeof keyId==='string'&&keyId.length>0,'RECOVERY_CONFIG_INVALID');Object.assign(this,{publicKey,keyId,clock});}
  async verifyAuthorization(jws,expected) {
    try {
      requireThat(typeof jws==='string'&&jws.length<=16384,'RECOVERY_AUTHORIZATION_REJECTED',403);
      const parts=jws.split('.');requireThat(parts.length===3&&parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)),'RECOVERY_AUTHORIZATION_REJECTED',403);
      const [h,p,s]=parts,header=JSON.parse(new TextDecoder().decode(decode(h))),claims=JSON.parse(new TextDecoder().decode(decode(p)));
      requireThat(header.alg==='ES256'&&header.typ==='apple-delivery-recovery+jwt'&&header.kid===this.keyId,'RECOVERY_AUTHORIZATION_REJECTED',403);
      requireThat(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},this.publicKey,decode(s),new TextEncoder().encode(h+'.'+p)),'RECOVERY_AUTHORIZATION_REJECTED',403);
      const now=this.clock();
      requireThat(claims.iss==='abilene-recovery-authority'&&claims.aud==='apple-delivery-recovery'&&claims.environment==='Sandbox'&&typeof claims.jti==='string'&&/^[0-9a-f-]{36}$/.test(claims.jti),'RECOVERY_AUTHORIZATION_REJECTED',403);
      requireThat(Number.isSafeInteger(claims.iat)&&Number.isSafeInteger(claims.exp)&&claims.iat*1000<=now&&now<claims.exp*1000&&claims.exp>claims.iat&&claims.exp-claims.iat<=300,'RECOVERY_AUTHORIZATION_REJECTED',403);
      requireThat(Object.entries(expected).every(([k,v])=>claims[k]===v),'RECOVERY_AUTHORIZATION_REJECTED',403);
      return Object.freeze({authorization_id:claims.jti,expires_at:claims.exp*1000});
    } catch {requireThat(false,'RECOVERY_AUTHORIZATION_REJECTED',403);}
  }
}
