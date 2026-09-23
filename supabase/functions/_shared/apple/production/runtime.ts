import {createClient} from 'npm:@supabase/supabase-js@2.106.1';
import {composeProduction} from './composition.mjs';
import {ROOT_G3_BASE64} from './root.mjs';
import {ACK_KID,ACK_PUBLIC_SPKI_BASE64} from './trust.mjs';
export async function productionRuntime(){
 const required=(name:string)=>{const value=Deno.env.get(name);if(!value)throw Error('PRODUCTION_CONFIGURATION_REQUIRED');return value;};
 const url=required('SUPABASE_URL');if(new URL(url).protocol!=='https:')throw Error('HTTPS_REQUIRED');
 const client=createClient(url,required('SUPABASE_SERVICE_ROLE_KEY'),{auth:{persistSession:false,autoRefreshToken:false}});
 const db={rpc:async(name:string,args:object)=>{const r=await client.rpc(name,args);if(r.error)throw Error('DATABASE_REJECTED');return r.data;},
 challenge:async(id:string)=>{const r=await client.from('apple_bootstrap_challenges').select('*').eq('id',id).maybeSingle();if(r.error)throw Error('DATABASE_REJECTED');return r.data;},
 installation:async(id:string)=>{const r=await client.from('apple_installation_keys').select('*').eq('key_id',id).maybeSingle();if(r.error)throw Error('DATABASE_REJECTED');return r.data;}};
 const decode=(s:string)=>Uint8Array.from(atob(s),c=>c.charCodeAt(0));
 const ackPrivate=decode(required('APPLE_ACK_PRIVATE_PKCS8_BASE64')),kid=required('APPLE_ACK_KID');
 if(kid!==ACK_KID)throw Error('ACK_TRUST_MISMATCH');
 const secret=await crypto.subtle.importKey('pkcs8',ackPrivate,{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const publicKey=await crypto.subtle.importKey('spki',decode(ACK_PUBLIC_SPKI_BASE64),{name:'ECDSA',namedCurve:'P-256'},false,['verify']);
 const probe=new TextEncoder().encode('abilene-production-ack-key-consistency-v1');
 if(!await crypto.subtle.verify({name:'ECDSA',hash:'SHA-256'},publicKey,await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},secret,probe),probe))throw Error('ACK_TRUST_MISMATCH');
 return composeProduction({db,auth:async(jwt:string)=>{const {data,error}=await client.auth.getUser(jwt);return error?null:data.user;},rootDer:decode(ROOT_G3_BASE64),ackPrivate,kid});
}
