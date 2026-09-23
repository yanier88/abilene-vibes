import {Buffer} from 'node:buffer';
import {PortableCertificate} from './certificates.mjs';
import {sha,demand,derTree} from './ocsp.mjs';
export const APPLE_ROOT_G3_SHA256='63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179';
const decode=s=>{demand(typeof s==='string'&&/^[A-Za-z0-9_-]+$/.test(s),'JWS_ENCODING');const b=Buffer.from(s,'base64url');demand(b.toString('base64url')===s,'JWS_ENCODING');return b;};
function object(b){let p;try{p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(b));}catch{demand(false,'JWS_JSON');}demand(p&&typeof p==='object'&&!Array.isArray(p),'JWS_JSON');return p;}
const critical=new Set(['2.5.29.19','2.5.29.15']);
function certificatePolicy(c,index,at){
 derTree(c.raw);
 demand(Date.parse(c.validFrom)<=at&&at<=Date.parse(c.validTo),'CERTIFICATE_TIME');
 const extensions=c.extensions;demand(new Set(extensions.map(e=>e.extnID)).size===extensions.length,'DUPLICATE_EXTENSION');
 demand(extensions.every(e=>!e.critical||critical.has(e.extnID)),'UNSUPPORTED_CRITICAL_EXTENSION');
 const usages=['digitalSignature','keyCertSign'].filter(n=>c.keyUsage(n));
 if(index===0){demand(!c.ca&&usages.includes('digitalSignature')&&!!c.ext('1.2.840.113635.100.6.11.1'),'APPLE_LEAF_POLICY');}
 else {demand(c.ca&&usages.includes('keyCertSign'),'APPLE_CA_POLICY');const length=c.ext('2.5.29.19')?.parsedValue?.pathLenConstraint;demand(length===undefined||Number.isInteger(length)&&length>=index-1,'CA_PATH_LENGTH');}
 if(index===1)demand(!!c.ext('1.2.840.113635.100.6.2.1'),'APPLE_INTERMEDIATE_POLICY');
}
// Only signed payloads leave this function. No transport body or client boolean
// can declare a certificate or transaction verified.
export async function verifyAppleJws(jws,{rootDer,now=Date.now(),maxBytes=65536}={}){
 demand(rootDer&&sha(rootDer)===APPLE_ROOT_G3_SHA256,'TRUST_ROOT');
 demand(typeof jws==='string'&&Buffer.byteLength(jws)<=maxBytes&&Number.isSafeInteger(now),'JWS_SIZE');
 const parts=jws.split('.');demand(parts.length===3,'JWS_FORMAT');const [h,p,s]=parts;
 const header=object(decode(h));demand(header.alg==='ES256'&&Array.isArray(header.x5c)&&header.x5c.length===3,'JWS_HEADER');
 demand(Object.keys(header).every(k=>['alg','x5c','typ'].includes(k)),'JWS_HEADER');
 const ders=header.x5c.map(c=>{demand(typeof c==='string'&&c.length<=22000&&/^[A-Za-z0-9+/]+={0,2}$/.test(c),'CHAIN_ENCODING');const b=Buffer.from(c,'base64');demand(b.toString('base64')===c,'CHAIN_ENCODING');return b;});
 demand(ders[2].equals(Buffer.from(rootDer)),'TRUST_ROOT');const chain=ders.map(b=>new PortableCertificate(b));
 for(let i=0;i<3;i++)certificatePolicy(chain[i],i,now);
 demand(await chain[0].verify(chain[1])&&await chain[1].verify(chain[2]),'CHAIN_SIGNATURE');
 demand(chain[0].curve?.[0]==='P-256','JWS_KEY');
 const key=await crypto.subtle.importKey('spki',chain[0].spki,{name:'ECDSA',namedCurve:'P-256'},false,['verify']);const signature=decode(s);demand(signature.length===64,'JWS_SIGNATURE');
 demand(await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},key,signature,Buffer.from(h+'.'+p)),'JWS_SIGNATURE');
 const payload=object(decode(p));return {payload,chain:ders};
}
