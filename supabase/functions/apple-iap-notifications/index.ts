import {productionRuntime} from '../_shared/apple/production/runtime.ts';
let composition:ReturnType<typeof productionRuntime>|undefined;
Deno.serve(async req=>{try{composition??=productionRuntime();return (await composition).notifications(req);}catch{composition=undefined;return new Response('Unavailable',{status:503});}});
