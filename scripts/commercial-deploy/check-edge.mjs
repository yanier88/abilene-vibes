// Administrative READ-ONLY check. No deploy, SQL execution or activation capability.
import {createHash} from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {mkdtempSync,readFileSync,chmodSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {pathToFileURL} from 'node:url';
import {expected,verifyArtifact} from './verify-artifact.mjs';
import {resolveExecutable,canonicalDownloadArgs,requireCanonicalDownload} from './tooling.mjs';
const approved=JSON.parse(readFileSync(new URL('./approved-candidate.json',import.meta.url),'utf8'));
export function checkEdge({cli,version,deployedAfter,root=process.cwd(),run=execFileSync}) {
 const executable=resolveExecutable('SUPABASE',cli);
 if(!Number.isInteger(version)||version<=24||!Number.isFinite(Date.parse(deployedAfter))||Date.parse(deployedAfter)>Date.now())throw Error('DEPLOY_SCOPE_REQUIRED');
 const scope={installed_at:deployedAfter,expected_project:expected.project,expected_function:expected.function,expected_source_hash:expected.files['supabase/functions/stripe-webhook/index.ts']};
 // Check all approved candidate migrations and Edge inputs before remote access.
 for(const [path,digest] of Object.entries(approved)){
  if(createHash('sha256').update(readFileSync(join(root,path))).digest('hex')!==digest)throw Error('LOCAL_CANDIDATE_MISMATCH');
 }
 // Check approved local inputs before accessing the remote project.
 const localMetadata={id:expected.id,slug:expected.function,version,status:'ACTIVE',updated_at:Date.parse(deployedAfter),ezbr_sha256:'0'.repeat(64),verify_jwt:false,import_map:false};
 verifyArtifact(localMetadata,localMetadata,p=>readFileSync(join(root,p)),scope);
 const dir=mkdtempSync(join(tmpdir(),'commercial-edge-check-'));chmodSync(dir,0o700);
 const call=args=>run(executable,args,{cwd:dir,encoding:'utf8',stdio:['pipe','pipe','pipe'],timeout:60000});
 const metadata=()=>{
  const rows=JSON.parse(call(['functions','list','--project-ref',expected.project,'--output','json']));
  const found=rows.filter(x=>x.slug===expected.function);
  if(found.length!==1||found[0].version!==version)throw Error('EXACT_VERSION_REQUIRED');
  return found[0];
 };
 const before=metadata();
 call(requireCanonicalDownload(canonicalDownloadArgs(expected.function,expected.project)));
 const after=metadata();
 const manifest=verifyArtifact(before,after,p=>readFileSync(join(dir,p)),scope);
 writeFileSync(join(dir,'verified-manifest.json'),JSON.stringify(manifest,null,2),{mode:0o600});
 return {manifest,path:join(dir,'verified-manifest.json')};
}
if(process.argv[1]&&import.meta.url===pathToFileURL(resolve(process.argv[1])).href){
 try {
  const args=process.argv.slice(2);
  if(args.length!==5||args[0]!=='--verify-remote'||args[1]!=='--expected-version'||args[3]!=='--deployed-after')throw Error();
  const result=checkEdge({cli:process.env.COMMERCIAL_SUPABASE_EXECUTABLE,version:Number(args[2]),deployedAfter:args[4]});
  console.log('REMOTE EDGE VERIFICATION PASS; activation NOT executed; manifest: '+result.path);
 } catch {console.error('STOP: EDGE VERIFICATION FAILED; COMP MUST REMAIN DISABLED');process.exitCode=1;}
}
