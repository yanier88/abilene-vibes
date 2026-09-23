import {AppleBackend} from '../backend.mjs';
import {PostgresAppleRepository} from '../repository.mjs';
import {sha256,requireThat} from '../domain.mjs';
import {ProductionAckSigner} from './ack.mjs';
import {ProductionIdentity} from './identity.mjs';
import {createAppleVerifier} from './verifier.mjs';
export async function composeProduction({db,auth,rootDer,ackPrivate,kid,clock=Date.now,verifier=createAppleVerifier({rootDer})}){
 const signer=await ProductionAckSigner.create({pkcs8:ackPrivate,kid,clock}),store=new PostgresAppleRepository(async(name,args)=>{try{return {data:await db.rpc(name,args)};}catch{return {error:{code:'UNKNOWN'}};}},{environment:'Production'});
 const backend=new AppleBackend({store,appleVerifier:verifier,signer,clock,environment:'Production'}),identity=new ProductionIdentity({db,verifier,clock});
 async function dispatch(user,action,input){
  if(action==='challenge')return identity.challenge(user,input);
  if(action==='bootstrap')return identity.complete(user,input);
  const {installation,payload}=await identity.request(user,action,input),{version,state}=await store.read();
  const hash=await sha256(payload.capability??''),c=state.capabilities.find(c=>c.token_hash===hash);
  requireThat(c&&c.installation_id===installation.installation_id&&c.environment==='Production','CAPABILITY_REJECTED',401);
  const {capability,...data}=payload;
  if(action==='cancel'){await backend.reconciliation(capability);requireThat(Object.keys(data).length===1&&typeof data.purchase_intent_id==='string','REQUEST_INVALID',400);return db.rpc('apple_cancel_purchase',{p_user:user.id,p_key:input.key_id,p_intent:data.purchase_intent_id});}
  if(action==='prepare')return backend.prepare(capability,data);
  if(action==='start'){await backend.markPurchasing(capability,data.purchase_intent_id);return {status:'purchasing'};}
  if(action==='verify'||action==='recover')return backend.verify(capability,data);
  if(action==='status'){await backend.reconciliation(capability);return {status:'reconciled'};}
  requireThat(false,'ACTION_REJECTED',400);
 }
 const response=(body,status=200)=>new Response(JSON.stringify(body),{status,headers:{'content-type':'application/json','cache-control':'no-store'}});
 async function handler(req,notification=false){
  try{
   requireThat(req.method==='POST','METHOD_REJECTED',405);const reader=req.body?.getReader();requireThat(reader,'REQUEST_INVALID',400);let size=0;const chunks=[];while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>262144){await reader.cancel();requireThat(false,'REQUEST_TOO_LARGE',413);}chunks.push(value);}const bytes=new Uint8Array(size);let offset=0;for(const c of chunks){bytes.set(c,offset);offset+=c.length;}const body=JSON.parse(new TextDecoder('utf-8',{fatal:true}).decode(bytes));
   if(notification){requireThat(typeof body.signedPayload==='string','REQUEST_INVALID',400);const result=await backend.notification(body.signedPayload);return response(result,result.status==='retry'?503:200);}
   const bearer=req.headers.get('authorization');requireThat(bearer?.startsWith('Bearer '),'AUTH_REQUIRED',401);const user=await auth(bearer.slice(7));requireThat(user?.id,'AUTH_REJECTED',401);
   requireThat(['challenge','bootstrap','prepare','start','verify','recover','status','cancel'].includes(body.action),'ACTION_REJECTED',400);
   return response(await dispatch(user,body.action,body.input));
  }catch(e){return response({error:'Purchase could not be completed safely. Please try again.',code:typeof e?.code==='string'&&/^[A-Z_]{1,64}$/.test(e.code)?e.code:'REQUEST_REJECTED'},e?.status??409);}
 }
 return {backend,identity,handle:req=>handler(req),notifications:req=>handler(req,true)};
}
