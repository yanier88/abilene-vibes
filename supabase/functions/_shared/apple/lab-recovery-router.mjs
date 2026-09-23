import {recoveryHandler} from './recovery-http.mjs';
// Explicit laboratory router. Construction does not listen or issue credentials.
// Caller must provide a configured backend and a current server-issued capability.
export function labRecoveryRouter(backend,options={}){
 const recover=recoveryHandler(backend,options);
 const verify=recoveryHandler(backend,{...options,mode:'NEW_PURCHASE_VERIFY'});
 return request=>{
  const path=new URL(request.url).pathname;
  if(path==='/e2e/recover-existing')return recover(request);
  if(path==='/e2e/verify')return verify(request);
  return new Response(JSON.stringify({schemaVersion:1,correlationId:crypto.randomUUID(),status:'error',stage:'REQUEST',safeCode:'ROUTE_NOT_ALLOWED'}),{status:404,headers:{'content-type':'application/json','cache-control':'no-store'}});
 };
}
