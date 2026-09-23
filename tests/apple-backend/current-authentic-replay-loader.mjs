// Test-only, pinned historical evidence. Never authorizes a current purchase.
import fs from 'node:fs';
import path from 'node:path';
import {createHash} from 'node:crypto';
import {isDeepStrictEqual} from 'node:util';
const EXPECTED = {
  "schemaVersion": 1,
  "fixtureId": "CURRENT_AUTHENTIC_REPLAY_FIXTURE_V1",
  "createdAt": "2026-09-20T07:03:29.207Z",
  "purpose": "OFFLINE_HISTORICAL_TEST_REPLAY_NOT_CURRENT_AUTHORIZATION",
  "historicalEvaluationTime": 1789523793134,
  "runtimeBaseline": "22.23.2",
  "AppleLibraryVersion": "3.1.0",
  "policyVersion": "phase70-v1",
  "ocspPolicyVersion": "phase66-v1",
  "mapping": {
    "productId": "com.abilenevibes.app.promotion.slot01.featured.monthly",
    "subscriptionGroupId": "22382531",
    "bundleId": "com.abilenevibes.app",
    "environment": "Sandbox"
  },
  "expected": {
    "officialTransaction": "PASS",
    "officialAppTransaction": "PASS",
    "linkage": "PASS",
    "leafOCSP": "GOOD/EXACT_PAIR",
    "intermediateOCSP": "GOOD/EXACT_PAIR",
    "historicalFreshness": "PASS",
    "deliveryGranted": false,
    "finishCalled": false
  },
  "inputs": [
    {
      "logicalName": "transactionJws",
      "relativePath": "inputs/transactionJws.jws",
      "size": 5674,
      "sha256": "417dfb0e9bf6d12e669a3c39f1e91c16dd020a4c576433c2c3e0a2d6d98751d2",
      "sourceClassification": "AUTHENTIC_APPLE_HISTORICAL",
      "provenanceReference": "provenance.json#transactionJws"
    },
    {
      "logicalName": "appTransactionJws",
      "relativePath": "inputs/appTransactionJws.jws",
      "size": 5083,
      "sha256": "b487e58282443d4adadd5e5fa8974b0820470d46630039f189f63138bdfc97d4",
      "sourceClassification": "AUTHENTIC_APPLE_HISTORICAL",
      "provenanceReference": "provenance.json#appTransactionJws"
    },
    {
      "logicalName": "rootDer",
      "relativePath": "inputs/rootDer.der",
      "size": 583,
      "sha256": "63343abfb89a6a03ebb57e9b3f5fa7be7c4f5c756f3017b3a8c488c3653e9179",
      "sourceClassification": "AUTHENTIC_APPLE_HISTORICAL",
      "provenanceReference": "provenance.json#rootDer"
    },
    {
      "logicalName": "leafDer",
      "relativePath": "inputs/leafDer.der",
      "size": 1077,
      "sha256": "4c381556c16121e605d1fc2eef6d0de4e072ed65964fe72f575f19711e84c417",
      "sourceClassification": "AUTHENTIC_APPLE_HISTORICAL",
      "provenanceReference": "provenance.json#leafDer"
    },
    {
      "logicalName": "intermediateDer",
      "relativePath": "inputs/intermediateDer.der",
      "size": 794,
      "sha256": "bdd4ed6e74691f0c2bfd01be0296197af1379e0418e2d300efa9c3bef642ca30",
      "sourceClassification": "AUTHENTIC_APPLE_HISTORICAL",
      "provenanceReference": "provenance.json#intermediateDer"
    },
    {
      "logicalName": "leafResponse",
      "relativePath": "inputs/leafResponse.der",
      "size": 1854,
      "sha256": "fadaa1911602c8589d0662ea0a169b2a1c485275e4ca4eb804b1e3ba2cdf21c5",
      "sourceClassification": "AUTHENTIC_APPLE_HISTORICAL",
      "provenanceReference": "provenance.json#leafResponse"
    },
    {
      "logicalName": "intermediateResponse",
      "relativePath": "inputs/intermediateResponse.der",
      "size": 935,
      "sha256": "5edb70f2208859a5a8dfebcadd84ae9bf39c10ab4b1d193deecf1fc9f4f5c797",
      "sourceClassification": "AUTHENTIC_APPLE_HISTORICAL",
      "provenanceReference": "provenance.json#intermediateResponse"
    }
  ]
};
const reject=()=>{throw new Error('AUTHENTIC_FIXTURE_REJECTED');};
export function loadCurrentAuthenticReplay(directory) {
 try {
  if(typeof directory!=='string'||!path.isAbsolute(directory))reject();
  const checkDir=p=>{const s=fs.lstatSync(p);if(!s.isDirectory()||s.isSymbolicLink()||(s.mode&0o777)!==0o700)reject();};
  checkDir(directory);checkDir(path.join(directory,'inputs'));
  const read=(name,max)=>{const p=path.join(directory,name);const s=fs.lstatSync(p);if(!s.isFile()||s.isSymbolicLink()||s.size>max||(s.mode&0o777)!==0o600)reject();return fs.readFileSync(p);};
  const manifest=JSON.parse(read('manifest.json',16384).toString('utf8'));
  // Independent pins cover schema, mapping, policies, classification and every input hash.
  if(!isDeepStrictEqual(manifest,EXPECTED))reject();
  const values={};
  for(const item of EXPECTED.inputs){
   const bytes=read(item.relativePath,item.size);
   if(bytes.length!==item.size||createHash('sha256').update(bytes).digest('hex')!==item.sha256)reject();
   values[item.logicalName]=item.logicalName.endsWith('Jws')?bytes.toString('utf8'):bytes;
  }
  const NOW=EXPECTED.historicalEvaluationTime;
  const compositionInput={...values,evaluationTime:NOW};
  const responses=[values.leafResponse,values.intermediateResponse];
  const contexts=[{certificateDer:values.leafDer,issuerDer:values.intermediateDer,environment:'Sandbox'},{certificateDer:values.intermediateDer,issuerDer:values.rootDer,environment:'Sandbox'}];
  return {classification:'AUTHENTIC_APPLE_HISTORICAL',manifest,compositionInput,responses,contexts,NOW};
 }catch{reject();}
}
