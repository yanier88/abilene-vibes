// Run only after the authorized normal build and iOS sync; these inspect real artifacts.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readdirSync, readFileSync, existsSync } from 'node:fs';
import { createHash } from 'node:crypto';
const root = new URL('../../',import.meta.url);
function files(dir){return readdirSync(dir,{withFileTypes:true}).flatMap(d=>d.isDirectory()?files(new URL(d.name+'/',dir)):[new URL(d.name,dir)]);}
for(const path of ['dist/','ios/App/App/public/']){
 test(`${path} has no local marker, screen chunk, or laboratory code`,()=>{
  const dir=new URL(path,root);assert.equal(existsSync(new URL('apple-iap-local-test.json',dir)),false);
  const assets=files(dir).filter(p=>/\.(js|html)$/.test(p.pathname));assert.ok(assets.length>0);
  for(const p of assets){assert.ok(!/AppleIAPLocalTest/.test(p.pathname));assert.doesNotMatch(readFileSync(p,'utf8'),/Apple IAP Local Test|XCODE-TEST\.|synthetic TEST delivery|knownPendingFinish|--abilene-iap-local-test/);}
 });
}
test('final copied iOS web files equal the normal dist files byte-for-byte',()=>{
 const source=new URL('dist/',root),dest=new URL('ios/App/App/public/',root);
 for(const file of files(source)){const relative=file.pathname.slice(source.pathname.length);assert.equal(createHash('sha256').update(readFileSync(new URL(relative,dest))).digest('hex'),createHash('sha256').update(readFileSync(file)).digest('hex'),relative);}
});
