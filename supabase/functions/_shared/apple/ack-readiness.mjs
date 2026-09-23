// Internal Sandbox readiness, not a delivery endpoint. Never exposes signed data.
export function ackReadiness({signer,publicKey,token}){
 if(typeof token!=='string'||token.length<32)throw Error('READINESS_CONFIG');
 return async req=>{
  if(req.method!=='GET'||req.headers.get('authorization')!=='Bearer '+token)return new Response('DENIED',{status:403});
  try{const envelope=await signer.sign({purpose:'READINESS',nonce:crypto.randomUUID()});const [h,p,s]=envelope.signed_jws.split('.');const sig=Uint8Array.from(atob(s.replace(/-/g,'+').replace(/_/g,'/')),c=>c.charCodeAt(0));const ok=await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,sig,new TextEncoder().encode(h+'.'+p));return new Response(ok?'READY':'NOT_READY',{status:ok?200:503,headers:{'Cache-Control':'no-store'}});}catch{return new Response('NOT_READY',{status:503});}
 };
}
