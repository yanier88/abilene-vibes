import {composeSandboxStaging} from './staging-composition.mjs';
import {LocalPersistentAckSigner} from './local-ack-signer.mjs';
import {ackReadiness} from './ack-readiness.mjs';
const decode=s=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
function ring(text){const list=JSON.parse(text);if(!Array.isArray(list)||list.length<1||list.length>2)throw Error();let last=-Infinity;const entries=list.map(e=>{if(typeof e.id!=='string'||!/^[a-f0-9]{64,}$/.test(e.keyHex)||e.keyHex.length%2||!Number.isSafeInteger(e.notBefore)||!Number.isSafeInteger(e.notAfter)||e.notBefore>=e.notAfter)throw Error();return {...e,key:Uint8Array.from(e.keyHex.match(/../g),x=>parseInt(x,16))};});if(new Set(entries.map(x=>x.id)).size!==entries.length)throw Error();return {entries,resolve(id){const now=Date.now();if(now<last)throw Error();last=now;const e=entries.find(x=>x.id===id);if(!e||now<e.notBefore||now>=e.notAfter)throw Error();return e.key;},current(){return {id:entries[0].id,key:this.resolve(entries[0].id)};}};}
// No network or key initialization occurs without explicit server-side Sandbox scope.
export function stagingHandler(kind,env,fallback,fetcher=fetch){
 let configured;
 return async request=>{
  if(env('APPLE_BACKEND_SCOPE')!=='SandboxStaging')return fallback(request);
  try{
   if(!configured)configured=(async()=>{
    const requests=ring(env('APPLE_REQUEST_KEYS_JSON')),responses=ring(env('APPLE_RESPONSE_KEYS_JSON'));
    for(const a of requests.entries)for(const b of responses.entries)if(a.keyHex===b.keyHex)throw Error();
    const privateKey=decode(env('APPLE_ACK_PKCS8_BASE64'));
    const url=new URL(env('SUPABASE_URL'));if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error();
    const service=env('SUPABASE_SERVICE_ROLE_KEY');if(!service)throw Error();
    const rpc=async(name,args)=>{try{if(!['apple_ledger_snapshot','apple_ledger_compare_and_swap','apple_ledger_compare_and_swap_verified'].includes(name))throw Error();const r=await fetcher(new URL('/rest/v1/rpc/'+name,url),{method:'POST',redirect:'error',signal:AbortSignal.timeout(15000),headers:{apikey:service,authorization:'Bearer '+service,'content-type':'application/json'},body:JSON.stringify(args)});if(!r.ok)return {error:{code:'LEDGER_UNAVAILABLE'}};return {data:await r.json()};}catch{return {error:{code:'LEDGER_UNAVAILABLE'}};}};
    if(kind==='readiness'){
     requests.current();responses.current();
     const signer=await LocalPersistentAckSigner.fromPKCS8(privateKey),publicKey=await crypto.subtle.importKey('spki',decode(env('APPLE_ACK_PUBLIC_SPKI_BASE64')),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
     const probe=ackReadiness({signer,publicKey,token:env('APPLE_ACK_READY_TOKEN')});
     return async req=>{const answer=await probe(req);if(answer.status!==200)return answer;const snapshot=await rpc('apple_ledger_snapshot',{});const enabled=snapshot.data?.state?.catalog?.some(p=>p.enabled&&p.environment==='Sandbox'&&p.bundle_id==='com.abilenevibes.app'&&p.product_id==='com.abilenevibes.app.promotion.slot01.featured.monthly'&&p.subscription_group_id==='22382531');return enabled?answer:new Response('NOT_READY',{status:503});};
    }
    const current=requests.current();const composition=await composeSandboxStaging({rpc,requestKey:current.key,requestKeyId:current.id,responseKey:responses.current().key,responseKeys:responses,ackPKCS8:privateKey,nodeURL:env('APPLE_NODE_URL'),fetcher});return composition[kind];
   })();
   return await (await configured)(request);
  }catch{configured=undefined;return new Response(JSON.stringify({error:'APPLE_STAGING_NOT_READY'}),{status:503,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});}
 };
}
