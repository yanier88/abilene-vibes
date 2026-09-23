import {recoveryHandler} from './recovery-http.mjs';
import {AppleBackend} from './backend.mjs';
import {PostgresAppleRepository} from './repository.mjs';
import {ASSNAppleVerifierClient} from './assn-client.mjs';
import {LocalPersistentAckSigner} from './local-ack-signer.mjs';
import {handler} from './http.mjs';
// Server-only dependency injection. Missing configuration never activates endpoints.
export async function composeSandboxStaging({rpc,requestKey,responseKey,requestKeyId,responseKeys,ackPKCS8,nodeURL,recoveryAuthorizer,log=console.log,fetcher=fetch}){
 const url=new URL(nodeURL);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash||url.pathname!=='/')throw Error('STAGING_URL_INVALID');
 const signer=await LocalPersistentAckSigner.fromPKCS8(ackPKCS8);
 const verifier=new ASSNAppleVerifierClient({requestKey,responseKey,requestKeyId,responseKeys,exchange:async r=>{const res=await fetcher(new URL(r.path,url),{method:'POST',redirect:'error',signal:r.signal,headers:{'content-type':'application/json','x-av-auth':r.auth},body:r.body});const reader=res.body.getReader(),chunks=[];let size=0;while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>32768){await reader.cancel();throw Error('NODE_RESPONSE_LIMIT');}chunks.push(value);}const body=new Uint8Array(size);let offset=0;for(const b of chunks){body.set(b,offset);offset+=b.length;}return {body,signature:res.headers.get('x-av-response-mac'),httpStatus:res.status};}});
 const backend=new AppleBackend({store:new PostgresAppleRepository(rpc),appleVerifier:verifier,signer,recoveryAuthorizer,log});
 return {backend,recoverExisting:recoveryHandler(backend,{log}),verifyV1:recoveryHandler(backend,{mode:'NEW_PURCHASE_VERIFY',log}),prepare:handler('prepare',backend),verify:handler('verify',backend),notifications:handler('notifications',backend)};
}
