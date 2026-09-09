import {AppleError,exactInput} from './domain.mjs';
export function handler(kind,backend=null) {
  return async request=>{
    const response=(body,status)=>new Response(JSON.stringify(body),{status,headers:{'Content-Type':'application/json','Cache-Control':'no-store'}});
    if(request.method!=='POST')return response({error:'METHOD_NOT_ALLOWED'},405);
    // No env toggle or fixture escape hatch. Deployment of these files cannot activate payments.
    if(!backend)return response({error:'APPLE_BACKEND_NOT_CONFIGURED'},503);
    try {
      const text=await request.text();
      if(new TextEncoder().encode(text).length>131072)return response({error:'BODY_TOO_LARGE'},413);
      const input=JSON.parse(text);
      if(kind==='notifications') {
        exactInput(input,['signedPayload']);
        return response(await backend.notification(input.signedPayload),200);
      }
      const match=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')??'');
      if(!match)return response({error:'CAPABILITY_REJECTED'},401);
      return response(await backend[kind](match[1],input),200);
    }catch(e) {
      // Never echo payloads, underlying errors, credentials, or signed evidence.
      return response({error:e instanceof AppleError?e.code:'REQUEST_REJECTED'},e instanceof AppleError?e.status:400);
    }
  };
}
