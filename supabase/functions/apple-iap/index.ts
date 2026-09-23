import {productionRuntime} from '../_shared/apple/production/runtime.ts';
let composition:ReturnType<typeof productionRuntime>|undefined;
Deno.serve(async req=>{try{composition??=productionRuntime();return (await composition).handle(req);}catch{composition=undefined;return new Response(JSON.stringify({error:'Purchases are temporarily unavailable.'}),{status:503,headers:{'content-type':'application/json','cache-control':'no-store'}});}});
