// LOCAL-only persistent test signer. Private PKCS8 bytes are injected from secure
// local storage; this module performs no filesystem/network access and logs nothing.
export class LocalPersistentAckSigner {
 static async fromPKCS8(bytes){const s=new LocalPersistentAckSigner();s.key=await crypto.subtle.importKey('pkcs8',bytes,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);return s;}
 async sign(claims){const b64=bytes=>btoa(String.fromCharCode(...bytes)).replace(/=/g,'').replace(/\+/g,'-').replace(/\//g,'_');const enc=new TextEncoder();const h=b64(enc.encode(JSON.stringify({alg:'ES256',typ:'LOCAL-delivery+jwt',kid:'local-ephemeral'})));const p=b64(enc.encode(JSON.stringify({...claims,iss:'abilene-apple-delivery-local'})));const input=h+'.'+p;const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},this.key,enc.encode(input));return {kind:'LOCAL.apple.delivery.v1',signed_jws:input+'.'+b64(new Uint8Array(sig))};}
}
