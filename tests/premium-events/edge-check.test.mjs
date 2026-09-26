import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync,writeFileSync,mkdirSync,mkdtempSync,rmSync} from 'node:fs';
import {join,dirname} from 'node:path';
import {tmpdir} from 'node:os';
import {checkEdge} from '../../scripts/commercial-deploy/check-edge.mjs';
import {expected} from '../../scripts/commercial-deploy/verify-artifact.mjs';
const stamp=Date.now()-1000;
const metadata={id:expected.id,slug:expected.function,version:25,status:'ACTIVE',updated_at:stamp,ezbr_sha256:'a'.repeat(64),verify_jwt:false,import_map:false};
function fixture(mode){
 const calls=[];let dir;
 const run=(bin,args,opts)=>{
  calls.push(args);dir=opts.cwd;
  assert.equal(bin,process.execPath);assert.equal(args[0],'functions');
  assert.equal(args[args.indexOf('--project-ref')+1],expected.project);
  if(args[1]==='list')return JSON.stringify([{...metadata,...(mode==='version'?{version:26}:{})}]);
  assert.equal(args[1],'download');assert(args.includes('--use-api'));
  if(mode==='download')throw Error('synthetic transport failure');
  for(const p of Object.keys(expected.files)){
   if(mode==='missing'&&p.endsWith('authority.mjs'))continue;
   mkdirSync(dirname(join(dir,p)),{recursive:true});
   writeFileSync(join(dir,p),mode==='hash'&&p.endsWith('index.ts')?'altered':readFileSync(p));
  }
  return '';
 };
 return {calls,run,cleanup:()=>{if(dir)rmSync(dir,{recursive:true,force:true});}};
}
for(const [name,mode] of [['wrong hash','hash'],['unexpected exact version','version'],['download failure','download'],['missing remote dependency','missing']])test('administrative checker STOP: '+name,()=>{
 const f=fixture(mode);try{assert.throws(()=>checkEdge({cli:process.execPath,version:25,deployedAfter:new Date(stamp).toISOString(),run:f.run}));
 assert(f.calls.every(a=>a[0]==='functions'&&['list','download'].includes(a[1])));
 }finally{f.cleanup();}
});
test('PASS writes only local metadata; all commands are canonical read-only and never activate',()=>{
 const f=fixture();try{
 const r=checkEdge({cli:process.execPath,version:25,deployedAfter:new Date(stamp).toISOString(),run:f.run});
 assert.equal(r.manifest.version,25);assert.equal(JSON.parse(readFileSync(r.path)).manifest_hash,'745d4238cd17c1bc7d9602fd3202705a059ae4fa60e1d0d5933b56e6f68cdb65');
 assert.deepEqual(f.calls.map(a=>a[1]),['list','download','list']);
 assert(f.calls[1].includes('--use-api'));
 }finally{f.cleanup();}
});
test('missing CLI stops before any remote command',()=>{
 assert.throws(()=>checkEdge({version:25,deployedAfter:new Date(stamp).toISOString(),run:()=>assert.fail('must not execute')}),/EXECUTABLE_REQUIRED/);
});
test('missing local dependency stops before any remote command',()=>{
 const root=mkdtempSync(join(tmpdir(),'edge-missing-local-'));
 try{assert.throws(()=>checkEdge({root,cli:process.execPath,version:25,deployedAfter:new Date(stamp).toISOString(),run:()=>assert.fail('must not execute')}),/ENOENT/);}
 finally{rmSync(root,{recursive:true,force:true});}
});
test('candidate contains no verifier identity/evidence and checker cannot execute activation SQL',()=>{
 for(const f of ['supabase/migrations/202609250002_commercial_listing_protocol.sql','supabase/migrations/202609250003_admin_comp_protocol_activation.sql','scripts/commercial-deploy/check-edge.mjs']){
  assert.doesNotMatch(readFileSync(f,'utf8'),/commercial_edge_verifier|register_verified_edge|edge_evidence|PGSERVICE|passfile/);
 }
 const script=readFileSync('scripts/commercial-deploy/check-edge.mjs','utf8');
 assert.doesNotMatch(script,/'db'|'deploy'|'push'|250003|psql/);
});

test('changed local migration stops before any remote command',()=>{
 const root=mkdtempSync(join(tmpdir(),'edge-changed-candidate-'));
 try{
 const approved=JSON.parse(readFileSync('scripts/commercial-deploy/approved-candidate.json','utf8'));
 for(const p of Object.keys(approved)){mkdirSync(dirname(join(root,p)),{recursive:true});writeFileSync(join(root,p),readFileSync(p));}
 writeFileSync(join(root,'supabase/migrations/202609250003_admin_comp_protocol_activation.sql'),'altered');
 assert.throws(()=>checkEdge({root,cli:process.execPath,version:25,deployedAfter:new Date(stamp).toISOString(),run:()=>assert.fail('must not execute')}),/LOCAL_CANDIDATE_MISMATCH/);
 }finally{rmSync(root,{recursive:true,force:true});}
});
