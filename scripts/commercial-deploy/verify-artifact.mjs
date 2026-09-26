import {createHash} from 'node:crypto';
export const expected = Object.freeze({
 project:'ymgiwjuhgvfexitynmtb', function:'stripe-webhook', id:'5efc6c89-36fa-46bc-aa03-37ec5caf097c',
 files:{
 'supabase/functions/stripe-webhook/index.ts':'3ae8080d872ff607efbcb04e0c787fe69da1b57103ce9f9d1d11a9c10ef66da6',
 'supabase/functions/stripe-webhook/authority.mjs':'8f1b1e9102448982bffc5c5336f160c24061f769c7de05e3641f50c52a9a6035',
 'supabase/functions/create-checkout-session/pricing.mjs':'633cd5837a35cdad43bc717201fde2eff5d089b26f31a5723bc9d6465d982153',
 }
});
const hash=x=>createHash('sha256').update(x).digest('hex');
// readRemoteBytes is bound ONLY to the fresh download directory by the CLI.
export function verifyArtifact(before, after, readRemoteBytes, protocol, now=Date.now()) {
 if(protocol.expected_project!==expected.project||protocol.expected_function!==expected.function
 ||protocol.expected_source_hash!==expected.files['supabase/functions/stripe-webhook/index.ts']
 ||protocol.activated_at||!Number.isFinite(Date.parse(protocol.installed_at)))throw Error('PROTOCOL_SCOPE');
 const metadata=m=>JSON.stringify([m.id,m.slug,m.version,m.status,m.updated_at,m.ezbr_sha256,m.verify_jwt,m.import_map]);
 if(metadata(before)!==metadata(after))throw Error('REMOTE_CHANGED_DURING_VERIFICATION');
 if(before.id!==expected.id||before.slug!==expected.function||before.status!=='ACTIVE'
 ||!Number.isInteger(before.version)||before.version<=24||before.verify_jwt!==false||before.import_map!==false
 ||!Number.isFinite(before.updated_at)||before.updated_at<Date.parse(protocol.installed_at)||before.updated_at>now
 ||!/^[a-f0-9]{64}$/.test(before.ezbr_sha256||''))throw Error('REMOTE_METADATA_REJECTED');
 const manifest=Object.entries(expected.files).map(([path,want])=>{
  const actual=hash(readRemoteBytes(path));if(actual!==want)throw Error('REMOTE_ARTIFACT_MISMATCH');return {path,sha256:actual};
 });
 if(hash(JSON.stringify(manifest))!=='745d4238cd17c1bc7d9602fd3202705a059ae4fa60e1d0d5933b56e6f68cdb65')throw Error('MANIFEST_MISMATCH');
 return {project_ref:expected.project,function_name:expected.function,
 version:before.version,deployment_id:before.id,deployed_at:new Date(before.updated_at).toISOString(),
 verified_at:new Date(now).toISOString(),source_hash:manifest[0].sha256,artifact_hash:before.ezbr_sha256,
 manifest_hash:hash(JSON.stringify(manifest)),verification_method:'management-cli-download-v1'};
}
