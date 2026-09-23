import http from 'node:http';import https from 'node:https';import dns from 'node:dns/promises';import {isIP} from 'node:net';import {PortableCertificate as X509Certificate} from './certificates.mjs';import * as A from 'asn1js';
import {certID} from './ocsp.mjs';
import {Reject,demand} from './ocsp.mjs';import {Buffer} from 'node:buffer';
const pairBytes=()=>{throw new Error('UNTRUSTED_CERTIFICATE');};
export function validateUrl(value){let u;try{u=new URL(value);}catch{throw new Reject('INVALID_OCSP_URL');}
 demand(['http:','https:'].includes(u.protocol)&&!u.username&&!u.password&&!u.hash&&!u.search&&!u.port&&u.hostname==='ocsp.apple.com'&&/^\/ocsp03-[a-z0-9]+$/.test(u.pathname),'SSRF_REJECTED');return u;
}
export function isPublicAddress(address){
 // Conservative IPv4-only egress. No IPv6/mapped/local address is accepted.
 if(isIP(address)!==4)return false;const [a,b,c]=address.split('.').map(Number);
 return !(a===0||a===10||a===127||a>=224||(a===100&&b>=64&&b<=127)||(a===169&&b===254)||(a===172&&b>=16&&b<=31)||(a===192&&(b===168||b===0||b===88&&c===99))||(a===198&&(b===18||b===19||b===51&&c===100))||(a===203&&b===0&&c===113));
}
export function validatedRequest(handle,pairResolver=pairBytes){const pair=pairResolver(handle),cert=new X509Certificate(pair.certificateDer),issuer=new X509Certificate(pair.issuerDer);
 const matches=[...(cert.infoAccess??'').matchAll(/^OCSP - URI:(.+)$/gm)];demand(matches.length===1,'INVALID_OCSP_URL');const url=validateUrl(matches[0][1]);
 const id=certID(cert,issuer),seq=(...value)=>new A.Sequence({value}),oct=h=>new A.OctetString({valueHex:Buffer.from(h,'hex')}),alg=seq(new A.ObjectIdentifier({value:'2.16.840.1.101.3.4.2.1'}),new A.Null());
 const request=seq(seq(seq(seq(seq(alg,oct(id.issname),oct(id.isskey),new A.Integer({valueHex:Buffer.from(id.sbjsn,'hex')}))))));
 const body=Buffer.from(request.toBER(false));return {url,body};
}
function send({url,body,address,signal}){return new Promise((resolve,reject)=>{
 const driver=url.protocol==='https:'?https:http;
 const req=driver.request(url,{method:'POST',agent:false,signal,lookup:(_host,options,cb)=>options.all?cb(null,[{address,family:4}]):cb(null,address,4),headers:{'Content-Type':'application/ocsp-request','Accept':'application/ocsp-response','Content-Length':body.length}},res=>resolve({status:res.statusCode,headers:res.headers,stream:res}));
 req.on('error',reject);req.end(body);
 });}
// Injected resolver/exchange are test capabilities, never request parameters.
export function createTransport({resolve=(host)=>dns.lookup(host,{all:true}),exchange=send,enabled=false,timeoutMs=5000,pairResolver=pairBytes}={}){
 demand(Number.isFinite(timeoutMs)&&timeoutMs>0&&timeoutMs<=5000,'CONFIG_INVALID');
 return async(handle,{signal:parentSignal}={})=>{
 demand(enabled,'UNAVAILABLE');const request=validatedRequest(handle,pairResolver);const controller=new AbortController();let timer;
 const abort=()=>controller.abort();parentSignal?.addEventListener('abort',abort,{once:true});if(parentSignal?.aborted)controller.abort();
 try{return await Promise.race([
  (async()=>{const addresses=await resolve(request.url.hostname);demand(!controller.signal.aborted,'TIMEOUT');demand(addresses.length>0&&addresses.length<=32&&addresses.every(x=>isPublicAddress(x.address)),'SSRF_REJECTED');
   const r=await exchange({...request,address:addresses[0].address,signal:controller.signal});demand(!controller.signal.aborted,'TIMEOUT');
   demand(r.status<300||r.status>=400,'REDIRECT');demand(r.status===200,'UNAVAILABLE');
   if(r.headers?.['content-length']!==undefined)demand(/^\d+$/.test(String(r.headers['content-length']))&&Number(r.headers['content-length'])<=65536,'RESPONSE_TOO_LARGE');
   demand(String(r.headers?.['content-type']??'').split(';')[0].trim().toLowerCase()==='application/ocsp-response','UNAVAILABLE');
   let size=0;const chunks=[];for await(const chunk of r.stream){demand(!controller.signal.aborted,'TIMEOUT');const b=Buffer.from(chunk);size+=b.length;demand(size<=65536,'RESPONSE_TOO_LARGE');chunks.push(b);}demand(size>0,'UNAVAILABLE');return Buffer.concat(chunks);
  })(),new Promise((_,reject)=>{timer=setTimeout(()=>{controller.abort();reject(new Reject('TIMEOUT'));},timeoutMs);})
 ]);}catch(e){if(e instanceof Reject)throw e;throw new Reject(controller.signal.aborted?'TIMEOUT':'UNAVAILABLE');}finally{clearTimeout(timer);controller.abort();parentSignal?.removeEventListener('abort',abort);}
 };
}
