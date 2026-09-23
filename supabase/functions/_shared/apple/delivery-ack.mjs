// LOCAL acknowledgement contract only; not installed in iOS or any live endpoint.
import {BUNDLE,requireThat} from './domain.mjs';
const bytes=s=>Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));
export async function verifyLocalDeliveryAck(envelope,expected,publicKey,now){
 try{
 requireThat(envelope?.kind==='LOCAL.apple.delivery.v1'&&typeof envelope.signed_jws==='string'&&envelope.signed_jws.length<=16384,'ACK_INVALID');
 for(const k of ['transactionId','buyer_id','installation_id','installation_key_id','delivery_id','productId','environment'])requireThat(typeof expected[k]==='string'&&expected[k].length>0,'ACK_BINDING_REQUIRED');
 const parts=envelope.signed_jws.split('.');requireThat(parts.length===3&&parts.every(p=>/^[A-Za-z0-9_-]+$/.test(p)),'ACK_INVALID');const [h,p,s]=parts;
 const header=JSON.parse(new TextDecoder().decode(bytes(h))),claims=JSON.parse(new TextDecoder().decode(bytes(p)));
 requireThat(header.alg==='ES256'&&header.typ==='LOCAL-delivery+jwt'&&header.kid==='local-ephemeral'&&claims.iss==='abilene-apple-delivery-local'&&claims.aud===BUNDLE&&claims.schemaVersion===1&&claims.environment==='Sandbox','ACK_SCOPE');
 requireThat(Number.isSafeInteger(claims.iat)&&Number.isSafeInteger(claims.exp)&&claims.iat<=now&&now<claims.exp&&claims.exp-claims.iat<=300&&claims.issued_at===claims.iat&&Number.isFinite(Date.parse(claims.deliveredAt))&&Date.parse(claims.deliveredAt)<=now*1000,'ACK_TIME');
 requireThat(['delivered','already_delivered'].includes(claims.delivery_status)&&typeof claims.ackId==='string'&&claims.ackId.length>0&&Object.entries(expected).every(([k,v])=>claims[k]===v),'ACK_BINDING');
 requireThat(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,bytes(s),new TextEncoder().encode(h+'.'+p)),'ACK_SIGNATURE');
 return Object.freeze({finishAllowed:true,ackId:claims.ackId,deliveryId:claims.delivery_id,transactionId:claims.transactionId});
 }catch{return Object.freeze({finishAllowed:false});}
}
