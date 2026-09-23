import {EdgeAppleVerifier} from '../edge/verifier.mjs';
import {createDenoTransport} from '../edge/deno-transport.mjs';
import {serverPolicy} from './policy.mjs';
// Only server configuration selects the deployment environment. Never pass
// request data to this factory; each deployment has a single verifier scope.
export function createAppleVerifier({rootDer,environment='Production',clock=Date.now}){
 const policy=serverPolicy(environment);
 return new EdgeAppleVerifier({rootDer,environment:policy.environment,appAppleId:policy.appAppleId,catalog:policy.catalog,clock,transportFactory:resolve=>createDenoTransport({enabled:true,pairResolver:resolve})});
}
