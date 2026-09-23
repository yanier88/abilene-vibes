import {APPLE_POLICY} from './policy.mjs';
const enc=new TextEncoder(),dec=new TextDecoder('utf-8',{fatal:true});
const need=(ok,code)=>{if(!ok)throw Error(code);};
const b64=b=>btoa(String.fromCharCode(...new Uint8Array(b))).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');
const unb64=s=>{need(typeof s==='string'&&/^[A-Za-z0-9_-]+$/.test(s),'ACK_FORMAT');const b=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));need(b64(b)===s,'ACK_FORMAT');return b;};
export const ACK_BINDINGS=Object.freeze(['transactionId','originalTransactionId','delivery_id','buyer_id','installation_id','installation_key_id','listing_type','listing_id','productId','environment','appAccountToken','purchase_intent_id']);
function validateClaims(c,environment,now){
 need(c&&c.iss==='abilene-apple-delivery'&&c.aud===APPLE_POLICY.bundleId&&c.schemaVersion===1&&c.environment===environment,'ACK_SCOPE');
 need(ACK_BINDINGS.every(k=>typeof c[k]==='string'&&c[k].length>0&&c[k].length<=256),'ACK_BINDING');
 need(Number.isSafeInteger(c.iat)&&Number.isSafeInteger(c.exp)&&c.issued_at===c.iat&&c.iat<=now&&now<c.exp&&c.exp>c.iat&&c.exp-c.iat<=300,'ACK_TIME');
 need(['delivered','already_delivered'].includes(c.delivery_status)&&typeof c.ackId==='string'&&c.ackId.length>0&&Number.isFinite(Date.parse(c.deliveredAt))&&Date.parse(c.deliveredAt)<=now*1000,'ACK_DELIVERY');
}
export class ProductionAckSigner{
 #key;#kid;#environment;#clock;
 static async create({pkcs8,kid,environment='Production',clock=Date.now}){
  need(/^[A-Za-z0-9_-]{8,80}$/.test(kid)&&!kid.startsWith('local-')&&['Production','Sandbox'].includes(environment),'ACK_CONFIG');
  const s=new ProductionAckSigner();s.#key=await crypto.subtle.importKey('pkcs8',pkcs8,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);s.#kid=kid;s.#environment=environment;s.#clock=clock;return s;
 }
 async sign(claims){
  validateClaims(claims,this.#environment,Math.floor(this.#clock()/1000));
  const h=b64(enc.encode(JSON.stringify({alg:'ES256',typ:'abilene-delivery+jwt',kid:this.#kid}))),p=b64(enc.encode(JSON.stringify(claims))),input=h+'.'+p;
  const signature=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},this.#key,enc.encode(input));
  validateClaims(claims,this.#environment,Math.floor(this.#clock()/1000));
  return Object.freeze({kind:'apple.delivery.v1',signed_jws:input+'.'+b64(signature)});
 }
}
export async function verifyProductionAck(envelope,expected,{keys,environment='Production',now=Math.floor(Date.now()/1000)}){
 try{
  need(envelope?.kind==='apple.delivery.v1'&&typeof envelope.signed_jws==='string'&&envelope.signed_jws.length<=16384,'ACK_FORMAT');
  const parts=envelope.signed_jws.split('.');need(parts.length===3,'ACK_FORMAT');
  const [h,p,s]=parts,header=JSON.parse(dec.decode(unb64(h))),claims=JSON.parse(dec.decode(unb64(p))),key=keys[header.kid];
  need(key&&header.alg==='ES256'&&header.typ==='abilene-delivery+jwt'&&Object.keys(header).every(k=>['alg','typ','kid'].includes(k)),'ACK_KEY');
  need(ACK_BINDINGS.every(k=>typeof expected[k]==='string'&&expected[k]===claims[k]),'ACK_BINDING');
  validateClaims(claims,environment,now);
  need(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,unb64(s),enc.encode(h+'.'+p)),'ACK_SIGNATURE');
  return Object.freeze({finishAllowed:true,transactionId:claims.transactionId,deliveryId:claims.delivery_id});
 }catch{return Object.freeze({finishAllowed:false});}
}
