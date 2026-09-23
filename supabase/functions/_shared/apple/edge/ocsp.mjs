import {createHash} from 'node:crypto';
import {Buffer} from 'node:buffer';
import {PortableCertificate as X509Certificate,verifySignature} from './certificates.mjs';
import {OCSPResponse,BasicOCSPResponse} from 'pkijs';
import {schema,encoded,algorithmNames} from './certificates.mjs';
export const sha=b=>createHash('sha256').update(b).digest('hex');
export const POLICY=Object.freeze({version:'phase66-v1',skew:60000,ttl:900000,maxBytes:65536});
export class Reject extends Error {constructor(code){super(code);this.code=code;}}
export function demand(ok,code){if(!ok)throw new Reject(code);}
export const time=t=>{const n=typeof t==='number'?t:Date.parse(t);demand(Number.isFinite(n),'INVALID_CLOCK');return n;};
export function statusConsumer(s){demand(s==='good','REJECT_'+String(s).toUpperCase());return 'GOOD';}
export {derTree} from './der.mjs';
import {derTree} from './der.mjs';
function ocspTime(s){demand(typeof s==='string'&&/^\d{14}Z$/.test(s),'REJECT_TIME');const iso=s.replace(/^(\d{4})(\d{2})(\d{2})(\d{2})(\d{2})(\d{2})Z$/,'$1-$2-$3T$4:$5:$6Z');const n=Date.parse(iso);demand(Number.isFinite(n)&&new Date(n).toISOString().replace(/[-:]/g,'').replace('.000','')===s.slice(0,8)+'T'+s.slice(8),'REJECT_TIME');return n;}
export function certID(target,issuer){return {alg:'sha256',issname:createHash('sha256').update(Buffer.from(issuer.subject,'hex')).digest('hex'),isskey:createHash('sha256').update(issuer.keyBits).digest('hex'),sbjsn:target.serial};}
function parseResponse(b){
 const outer=new OCSPResponse({schema:schema(b)}),inner=new BasicOCSPResponse({schema:schema(outer.responseBytes.response.valueBlock.valueHexView)}),r=inner.tbsResponseData;
 const hex=x=>Buffer.from(x.valueBlock.valueHexView).toString('hex');
 const stamp=d=>d.toISOString().replace(/[-:]/g,'').replace('T','').replace('.000','');
 return {resstatus:outer.responseStatus.valueBlock.valueDec,restype:outer.responseBytes.responseType==='1.3.6.1.5.5.7.48.1.1'?'ocspBasic':'other',version:r.version,prodat:stamp(r.producedAt),respid:r.responderID.valueBlock?{key:hex(r.responderID)}:{name:{der:encoded(r.responderID.toSchema()).toString('hex')}},alg:algorithmNames[inner.signatureAlgorithm.algorithmId],certs:(inner.certs??[]).map(c=>encoded(c.toSchema()).toString('hex')),array:r.responses.map(x=>({certid:{alg:x.certID.hashAlgorithm.algorithmId==='2.16.840.1.101.3.4.2.1'?'sha256':'unsupported',issname:hex(x.certID.issuerNameHash),isskey:hex(x.certID.issuerKeyHash),sbjsn:hex(x.certID.serialNumber)},status:{status:({0:'good',1:'revoked',2:'unknown'})[x.certStatus.idBlock.tagNumber]},thisupdate:stamp(x.thisUpdate),nextupdate:x.nextUpdate?stamp(x.nextUpdate):null}))};
}
function validAt(c,n){return Date.parse(c.validFrom)<=n&&n<=Date.parse(c.validTo);}
const verified=new WeakSet();
export function isVerified(r){return verified.has(r);}
function deepFreeze(o){if(o&&typeof o==='object'){Object.values(o).forEach(deepFreeze);Object.freeze(o);}return o;}
export async function verifyOcsp({responseDer,certificateDer,issuerDer,environment,evaluationTime,policy=POLICY}){
 try{
 demand(policy===POLICY,'REJECT_POLICY');demand(['Sandbox','Production'].includes(environment),'REJECT_ENVIRONMENT');const now=time(evaluationTime);
 const b=Buffer.from(responseDer);demand(b.length>0&&b.length<=policy.maxBytes,'REJECT_PARSE');
 const outer=derTree(b);demand(outer.tag===48&&outer.children.length===2,'REJECT_PARSE');
 const [status,wrap]=outer.children;demand(status.tag===10&&status.end-status.value===1&&b[status.value]===0,'REJECT_RESPONSE_STATUS');
 demand(wrap.tag===160&&wrap.children.length===1,'REJECT_PARSE');const response=wrap.children[0];
 demand(response.tag===48&&response.children.length===2,'REJECT_PARSE');const [oid,oct]=response.children;
 demand(oid.tag===6&&b.subarray(oid.value,oid.end).toString('hex')==='2b0601050507300101'&&oct.tag===4,'REJECT_PARSE');
 const basic=b.subarray(oct.value,oct.end),tree=derTree(basic);demand(tree.tag===48&&[3,4].includes(tree.children.length),'REJECT_PARSE');
 const [data,algorithm,sig,certs]=tree.children;demand(data.tag===48&&algorithm.tag===48&&sig.tag===3&&basic[sig.value]===0&&(!certs||certs.tag===160),'REJECT_PARSE');
 // Reject unsupported critical response/single extensions, including those the high-level parser ignores.
 function walk(n){if(n.tag===48&&n.children[0]?.tag===6&&n.children[1]?.tag===1)demand(basic[n.children[1].value]===0,'REJECT_CRITICAL_EXTENSION');n.children.forEach(walk);}walk(data);
 // Validate the exact supported ResponseData/SingleResponse schema before parsing fields.
 const dc=[...data.children];
 if(dc[0]?.tag===160){const ver=dc.shift();demand(ver.children.length===1&&ver.children[0].tag===2&&ver.children[0].end-ver.children[0].value===1&&basic[ver.children[0].value]===0,'REJECT_VERSION');}
 demand([3,4].includes(dc.length)&&[161,162].includes(dc[0]?.tag)&&dc[1]?.tag===24&&dc[2]?.tag===48&&(!dc[3]||dc[3].tag===161),'REJECT_PARSE');
 demand(dc[2].children.length===1,'REJECT_SINGLE_RESPONSE_COUNT');
 const sc=dc[2].children[0];demand(sc.tag===48,'REJECT_PARSE');const fields=sc.children;
 demand(fields.length>=3&&fields.length<=5&&fields[0].tag===48&&[128,161,130].includes(fields[1].tag)&&fields[2].tag===24,'REJECT_PARSE');
 demand(fields[3]?.tag===160,'REJECT_MISSING_NEXT_UPDATE');
 demand(fields[3].children.length===1&&fields[3].children[0].tag===24&&(!fields[4]||fields[4].tag===161),'REJECT_PARSE');
 const ci=fields[0].children;demand(ci.length===4&&ci[0].tag===48&&ci[1].tag===4&&ci[2].tag===4&&ci[3].tag===2,'REJECT_PARSE');
 const p=parseResponse(b);
 demand(p.resstatus===0&&p.restype==='ocspBasic'&&(!p.version||p.version===0),'REJECT_RESPONSE_STATUS');
 demand(p.array?.length===1,'REJECT_SINGLE_RESPONSE_COUNT');
 const target=new X509Certificate(certificateDer),issuer=new X509Certificate(issuerDer);
 demand(target.checkIssued(issuer)&&await target.verify(issuer)&&issuer.ca,'REJECT_PAIRING_MISMATCH');
 const expected=certID(target,issuer);const item=p.array[0];
 demand(['alg','issname','isskey','sbjsn'].every(k=>expected[k]===item.certid[k]),'REJECT_PAIRING_MISMATCH');
 const candidates=[Buffer.from(issuerDer),...(p.certs||[]).map(h=>Buffer.from(h,'hex'))];const unique=new Map(candidates.map(c=>[sha(c),c]));
 const matches=[...unique.values()].filter(c=>{const x=new X509Certificate(c);return p.respid?.key?createHash('sha1').update(x.keyBits).digest('hex')===p.respid.key:p.respid?.name?.der===x.subject;});
 demand(matches.length===1,'REJECT_RESPONDER_IDENTITY');const signerDer=matches[0],signer=new X509Certificate(signerDer),sx=signer;
 demand(validAt(signer,now),'REJECT_RESPONDER_TIME');
 demand(validAt(target,now)&&validAt(issuer,now),'REJECT_CERTIFICATE_TIME');
 if(!signerDer.equals(Buffer.from(issuerDer))){
 demand(signer.checkIssued(issuer)&&await signer.verify(issuer),'REJECT_RESPONDER_AUTHORIZATION');
 demand(sx.ext('2.5.29.37')?.parsedValue?.keyPurposes?.includes('1.3.6.1.5.5.7.3.9')&&sx.keyUsage('digitalSignature'),'REJECT_RESPONDER_AUTHORIZATION');
 const nc=sx.ext('1.3.6.1.5.5.7.48.1.5');demand(nc&&Buffer.from(nc.extnValue.valueBlock.valueHexView).toString('hex')==='0500','REJECT_RESPONDER_AUTHORIZATION');
 }
 const allowed={SHA256withECDSA:'sha256',SHA384withECDSA:'sha384',SHA256withRSA:'sha256',SHA384withRSA:'sha384'};
 demand(allowed[p.alg],'REJECT_SIGNATURE_ALGORITHM');
 demand(await verifySignature(p.alg,basic.subarray(data.start,data.end),signer,basic.subarray(sig.value+1,sig.end)),'REJECT_BAD_SIGNATURE');
 const state=statusConsumer(item.status?.status);
 const produced=ocspTime(p.prodat),from=ocspTime(item.thisupdate);demand(item.nextupdate,'REJECT_MISSING_NEXT_UPDATE');const until=ocspTime(item.nextupdate);
 demand(from<=until&&produced>=from-policy.skew&&produced<=until,'REJECT_TIME');
 demand(from<=now+policy.skew&&produced<=now+policy.skew,'REJECT_FUTURE');demand(until>=now-policy.skew,'REJECT_STALE');
 const r=deepFreeze({certificateSha256:sha(certificateDer),issuerSha256:sha(issuerDer),environment,policyVersion:policy.version,certID:{...item.certid},status:state,responderIdentitySha256:sha(signerDer),signatureVerified:true,authorizationVerified:true,producedAt:produced,thisUpdate:from,nextUpdate:until,evaluatedAt:now,freshUntil:Math.min(now+policy.ttl,until,Date.parse(signer.validTo),Date.parse(target.validTo),Date.parse(issuer.validTo)),pairing:'EXACT_PAIR',responseSha256:sha(b)});
 verified.add(r);return r;
 }catch(e){if(e instanceof Reject)throw e;if(typeof e?.code==='string'&&e.code.startsWith('CERT_'))throw new Reject(e.code);throw new Reject('REJECT_PARSE');}
}
