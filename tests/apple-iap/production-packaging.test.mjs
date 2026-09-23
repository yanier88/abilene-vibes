import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const read=p=>fs.readFileSync(new URL('../../'+p,import.meta.url),'utf8');
test('normal App scheme has no diagnostic launch options or local StoreKit configuration',()=>{
 const s=read('ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme');
 assert.match(s,/BlueprintIdentifier="504EC3031FED79650016851F"/);
 assert.doesNotMatch(s,/CommandLineArgument |EnvironmentVariable |StoreKitConfigurationFileReference|phase\d|sandbox-capture/i);
});
test('normal promotion catalog does not depend on capture harness product definitions',()=>{
 const s=read('ios/App/App/AbileneBridgeViewController.swift');
 const ui=s.slice(s.indexOf('private enum ApplePromotionCatalog'));
 assert.doesNotMatch(ui,/SandboxCaptureGate/);
 assert.match(ui,/product\.displayPrice/);
 assert.match(ui,/ApplePromotionCatalog\.products/);
});
