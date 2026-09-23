import * as A from 'asn1js';
import {Certificate} from 'pkijs';
import {p256,p384} from '@noble/curves/nist.js';
import {Buffer} from 'node:buffer';
import {derTree} from './der.mjs';
export class CertificateError extends Error {constructor(code){super(code);this.code=code;}}
const need=(ok,code)=>{if(!ok)throw new CertificateError(code);};
export const bytes=x=>Buffer.from(x);
export function schema(bytes){const b=Buffer.from(bytes);derTree(b);const r=A.fromBER(b);need(r.offset===b.length,'CERT_FORMAT');return r.result;}
export const encoded=x=>Buffer.from(x.toBER(false));
export const algorithmNames=Object.freeze({'1.2.840.10045.4.3.2':'SHA256withECDSA','1.2.840.10045.4.3.3':'SHA384withECDSA','1.2.840.113549.1.1.11':'SHA256withRSA','1.2.840.113549.1.1.12':'SHA384withRSA'});
export function ecdsaRaw(der,size){
 const b=Buffer.from(der),root=derTree(b);need(root.tag===48&&root.children.length===2,'CERT_SIGNATURE_FORMAT');const out=new Uint8Array(2*size);
 root.children.forEach((n,i)=>{need(n.tag===2,'CERT_SIGNATURE_FORMAT');let v=b.subarray(n.value,n.end);need(v.length&&!(v[0]&128),'CERT_SIGNATURE_FORMAT');if(v.length>1&&v[0]===0)v=v.subarray(1);need(v.length<=size,'CERT_SIGNATURE_FORMAT');out.set(v,size*(i+1)-v.length);});return out;
}
const curves={'1.2.840.10045.3.1.7':['P-256',32,p256,'secp256r1'],'1.3.132.0.34':['P-384',48,p384,'secp384r1']};
const algorithms={SHA256withECDSA:['ECDSA','SHA-256'],SHA384withECDSA:['ECDSA','SHA-384'],SHA256withRSA:['RSASSA-PKCS1-v1_5','SHA-256'],SHA384withRSA:['RSASSA-PKCS1-v1_5','SHA-384']};
export async function verifySignature(algorithm,data,certificate,signature){
 const a=algorithms[algorithm];need(a,'CERT_SIGNATURE_ALGORITHM');const curve=certificate.curve;
 if(a[0]==='ECDSA')need(curve,'CERT_KEY_CURVE');
 const raw=a[0]==='ECDSA'?ecdsaRaw(signature,curve[1]):signature;
 // Explicit algorithm dispatch, never a fallback after rejection. Only verification.
 if(a[0]==='ECDSA'&&((curve[0]==='P-384'&&a[1]==='SHA-256')||(curve[0]==='P-256'&&a[1]==='SHA-384'))){
  const digest=new Uint8Array(await crypto.subtle.digest(a[1],data));
  return curve[2].verify(raw,digest,certificate.keyBits,{prehash:false,lowS:false});
 }
 if(a[0]!=='ECDSA'){const rsa=schema(certificate.keyBits);const modulus=rsa.valueBlock.value[0]?.valueBlock.valueHexView;need(modulus&&modulus.length>=256,'CERT_KEY_SIZE');}
 const spec=a[0]==='ECDSA'?{name:'ECDSA',namedCurve:curve[0]}:{name:a[0],hash:a[1]};
 const key=await crypto.subtle.importKey('spki',certificate.spki,spec,false,['verify']);
 return crypto.subtle.verify({name:a[0],hash:a[1]},key,raw,data);
}
export class PortableCertificate {
 constructor(value){
  this.raw=Buffer.from(value);need(this.raw.length>0&&this.raw.length<=16384,'CERT_SIZE');
  const c=this.cert=new Certificate({schema:schema(this.raw)}),t=derTree(this.raw);
  need(t.tag===48&&t.children.length===3,'CERT_FORMAT');this.tbs=this.raw.subarray(t.children[0].start,t.children[0].end);
  need(c.signature.algorithmId===c.signatureAlgorithm.algorithmId&&encoded(c.signature.toSchema()).equals(encoded(c.signatureAlgorithm.toSchema())),'CERT_ALGORITHM_MISMATCH');
  this.algorithm=algorithmNames[c.signatureAlgorithm.algorithmId];need(this.algorithm,'CERT_SIGNATURE_ALGORITHM');this.signature=Buffer.from(c.signatureValue.valueBlock.valueHexView);
  this.extensions=c.extensions??[];need(new Set(this.extensions.map(e=>e.extnID)).size===this.extensions.length,'CERT_DUPLICATE_EXTENSION');
  this.ca=this.ext('2.5.29.19')?.parsedValue?.cA===true;
  this.validFrom=c.notBefore.value.toISOString();this.validTo=c.notAfter.value.toISOString();
  this.subject=encoded(c.subject.toSchema()).toString('hex');this.issuer=encoded(c.issuer.toSchema()).toString('hex');
  this.spki=encoded(c.subjectPublicKeyInfo.toSchema());this.keyBits=Buffer.from(c.subjectPublicKeyInfo.subjectPublicKey.valueBlock.valueHexView);
  this.curve=curves[c.subjectPublicKeyInfo.algorithm.algorithmParams?.valueBlock?.toString()];
  this.serial=Buffer.from(c.serialNumber.valueBlock.valueHexView).toString('hex');
 }
 ext(oid){return this.extensions.find(e=>e.extnID===oid);}
 keyUsage(name){const b=this.ext('2.5.29.15')?.parsedValue?.valueBlock?.valueHexView;const masks={digitalSignature:128,keyCertSign:4};return !!(b?.[0]&masks[name]);}
 checkIssued(issuer){return this.issuer===issuer.subject;}
 async verify(issuer){return this.checkIssued(issuer)&&await verifySignature(this.algorithm,this.tbs,issuer,this.signature);}
 get infoAccess(){return (this.ext('1.3.6.1.5.5.7.1.1')?.parsedValue?.accessDescriptions??[]).filter(x=>x.accessMethod==='1.3.6.1.5.5.7.48.1'&&x.accessLocation.type===6).map(x=>'OCSP - URI:'+x.accessLocation.value).join('\n');}
}
