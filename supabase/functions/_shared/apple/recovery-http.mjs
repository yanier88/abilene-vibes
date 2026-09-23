import {AppleError} from './domain.mjs';
import {observer,STAGES} from './safe-observability.mjs';
// New, explicit v1 contract; legacy endpoints keep their existing contract.
const safeCodes=new Set(['CAPABILITY_REJECTED','RECOVERY_NOT_CONFIGURED','RECOVERY_AUTHORIZATION_REJECTED','RECOVERY_AUTHORIZATION_EXPIRED','RECOVERY_AUTHORIZATION_REPLAY','RECOVERY_BINDING_MISMATCH','TRANSACTION_DATES','TRANSACTION_SIGNED_DATE','INSTALLATION_MISMATCH','BUYER_MISMATCH','PRODUCT_MISMATCH','GROUP_MISMATCH','TRANSACTION_SCOPE','TRANSACTION_NOT_ELIGIBLE','INTENT_NOT_FOUND','INTENT_BINDING_MISMATCH','LISTING_UNAUTHORIZED','STRIPE_CONFLICT','NODE_UNAVAILABLE','NODE_TIMEOUT','NODE_AUTH_FAILED','NODE_RESPONSE_BINDING','NODE_RESPONSE_EXPIRED','NODE_REJECTED','NODE_INVALID_CONTRACT','LEDGER_COMMIT_FAILED','LEDGER_UNAVAILABLE','CONCURRENT_RETRY_REQUIRED']);
export function recoveryHandler(backend,{mode='RECOVER_EXISTING_PURCHASE',log=console.log}={}){
 return async request=>{
  const correlationId=crypto.randomUUID(),emit=observer(log,correlationId,mode==='RECOVER_EXISTING_PURCHASE'?'recover-existing':'verify');let stage='REQUEST';
  const response=(body,status)=>{const text=JSON.stringify({schemaVersion:1,correlationId,...body});emit('RESPONSE',status===200?'PASS':'FAIL',status===200?'OK':'REJECTED',{httpStatus:status,responseSize:new TextEncoder().encode(text).length,contentType:'JSON'});return new Response(text,{status,headers:{'content-type':'application/json','cache-control':'no-store'}});};
  const reject=(safeCode,http=400)=>response({status:'error',stage,safeCode},http);
  emit('REQUEST','ENTER');
  if(request.method!=='POST')return reject('METHOD_NOT_ALLOWED',405);
  if(!backend)return reject('BACKEND_NOT_CONFIGURED',503);
  try{
   const bytes=await request.arrayBuffer();if(bytes.byteLength>131072)return reject('BODY_TOO_LARGE',413);
   if(!(request.headers.get('content-type')??'').toLowerCase().startsWith('application/json'))return reject('CONTENT_TYPE',415);
   let input;try{input=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));}catch{return reject('JSON_INVALID');}
   stage='AUTH';const match=/^Bearer ([a-f0-9]{64})$/.exec(request.headers.get('authorization')??'');if(!match)return reject('CAPABILITY_REJECTED',401);
   const result=mode==='RECOVER_EXISTING_PURCHASE'?await backend.recoverExisting(match[1],input,emit):await backend.verify(match[1],input,emit);
   if(result.status==='verified_expired_undelivered')return response({status:'verified_expired_undelivered',verification:'verified',delivery:null,ack:null,finishAuthorized:false},200);
   if(!['delivered','already_delivered'].includes(result.status)||!result.delivery_id||!result.confirmation)throw new AppleError('DELIVERY_NOT_GRANTED');
   return response({status:result.status==='already_delivered'?'verified_already_delivered':'delivered_active',verification:'verified',delivery:{id:result.delivery_id},ack:result.confirmation,finishAuthorized:true},200);
  }catch(e){stage=STAGES.has(e.safeStage)?e.safeStage:stage;emit(stage,'FAIL','REJECTED');return reject(e instanceof AppleError&&safeCodes.has(e.code)?e.code:'REQUEST_REJECTED',e instanceof AppleError?e.status:500);}
 };
}
// Pure reusable client acceptance. Native ACK cryptography is still required after this.
export function classifyRecoveryResponse({httpStatus,contentType,body}){
 const fail=(code,stage='RESPONSE')=>({kind:'REJECTED',httpStatus,stage,safeCode:code,finishAuthorized:false});
 if(!(body instanceof Uint8Array)||body.length>32768)return fail('BACKEND_BODY_TOO_LARGE');
 if(!/^application\/json(?:\s*;|$)/i.test(contentType??''))return fail('BACKEND_CONTENT_TYPE_FAIL');
 let p;try{p=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(body));}catch{return fail('BACKEND_JSON_FAIL');}
 if(!p||p.schemaVersion!==1||typeof p.correlationId!=='string'||!/^[a-f0-9-]{36}$/i.test(p.correlationId))return fail('BACKEND_SCHEMA_FAIL');
 if(httpStatus!==200)return {...fail('BACKEND_HTTP_STATUS_FAIL',STAGES.has(p.stage)?p.stage:'RESPONSE'),serverSafeCode:safeCodes.has(p.safeCode)?p.safeCode:'REQUEST_REJECTED',status:p.status==='error'?'error':'invalid'};
 if(p.status==='verified_expired_undelivered'&&p.verification==='verified'&&p.delivery===null&&p.ack===null&&p.finishAuthorized===false)return {kind:'VERIFIED_EXPIRED_UNDELIVERED',httpStatus,status:p.status,finishAuthorized:false};
 if(['delivered_active','verified_already_delivered'].includes(p.status)&&p.verification==='verified'&&typeof p.delivery?.id==='string'&&p.ack?.kind==='LOCAL.apple.delivery.v1'&&typeof p.ack?.signed_jws==='string'&&p.finishAuthorized===true)return {kind:'DELIVERED_ACTIVE',httpStatus,status:p.status,finishAuthorized:false,requiresCryptoKitACK:true};
 return fail('BACKEND_SCHEMA_FAIL');
}
