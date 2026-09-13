import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
const read = path => readFileSync(new URL('../../' + path, import.meta.url), 'utf8');
const capture = read('ios/App/App/SandboxPhysicalCapture.swift');
const bridge = read('ios/App/App/AbileneBridgeViewController.swift');
test('capture implementation is physically compiled out of simulator and Release', () => {
  assert.ok(capture.startsWith('#if DEBUG && os(iOS) && !targetEnvironment(simulator)\n'));
  assert.match(capture, /ABILENE_SANDBOX_CAPTURE.*CAPTURE_ONLY_SANDBOX/);
  assert.match(capture, /--abilene-iap-local-test/);
  assert.match(capture, /apple-iap-local-test/);
});
test('no capture delivery, finish, JS exposure or custom network client', () => {
  assert.doesNotMatch(capture, /\.finish\s*\(|URLSession|fetch\(|call\.resolve|notifyListeners|Supabase|https:\/\//);
  assert.match(capture, /"deliveryGranted": false, "finishCalled": false/);
});
test('purchase requires visible cached product, manual confirmation and fresh verified app', () => {
  const buy = capture.slice(capture.indexOf('func buy('), capture.indexOf('private func capture('));
  assert.match(buy, /guard confirmedByUser/);
  assert.match(buy, /guard !purchaseAttempted/);
  assert.match(buy, /let product = products\[id\]/);
  assert.ok(buy.indexOf('guard purchaseAttempt.reserve()') < buy.indexOf('try await verifyApp()'));
  assert.ok(buy.indexOf('try await verifyApp()') < buy.indexOf('try await product.purchase('));
  assert.match(capture, /expectedProduct == t.productID && t.appAccountToken == correlationToken/);
});
test('cancelled updates stop before capturing or reporting resumed results', () => {
  assert.match(capture, /let result = try await AppTransaction.shared\s+try Task.checkCancellation\(\)/);
  const updates = capture.slice(capture.indexOf('func startUpdates('), capture.indexOf('var exportLocation:'));
  assert.match(updates, /let gate = try await self.verifyApp\(\)\s+guard !Task.isCancelled else \{ break \}/);
  assert.match(updates, /catch \{\s+guard !Task.isCancelled else \{ break \}/);
});
test('temporary evidence protection and sanitized errors', () => {
  assert.match(capture, /temporaryDirectory/);
  assert.match(capture, /posixPermissions: 0o700/);
  assert.match(capture, /posixPermissions: 0o600/);
  assert.match(capture, /\.completeFileProtection/);
  assert.match(capture, /isExcludedFromBackup = true/);
  assert.doesNotMatch(capture, /print\(|NSLog|localizedDescription/);
});
test('capture mode returns before loading the web application', () => {
  const body = bridge.slice(bridge.indexOf('override func viewDidLoad()'), bridge.indexOf('override func instanceDescriptor()'));
  assert.match(body, /if SandboxPhysicalRuntime.requested/);
  assert.ok(body.indexOf('return') < body.indexOf('super.viewDidLoad()'));
});
test('new scheme has no Xcode catalog and no archive build entry', () => {
  const scheme = read('ios/App/App.xcodeproj/xcshareddata/xcschemes/AbileneSandboxCapture.xcscheme');
  assert.doesNotMatch(scheme, /StoreKitConfigurationFileReference|AbileneLocal\.storekit|--abilene-iap-local-test/);
  assert.match(scheme, /--abilene-sandbox-capture/);
  assert.match(scheme, /buildForArchiving="NO"/);
  assert.match(scheme, /buildConfiguration="Debug"/);
});
test('original Xcode lab, explicit finish authority, bridge plugin and web entry remain byte-identical', () => {
  for (const path of ['ios/App/App/AbileneStoreKitService.swift', 'ios/App/App/LocalStoreKitSecurity.swift',
    'ios/App/App/AbileneStoreKitPlugin.swift', 'src/native/abileneStoreKit.js', 'src/main.jsx',
    'ios/App/App.xcodeproj/xcshareddata/xcschemes/AbileneIAPLocal.xcscheme']) {
    assert.equal(read(path), execFileSync('git', ['show', `305855a2799e87629442a08bb42b9fe6f04ca021:${path}`], { encoding: 'utf8' }));
  }
});
test('all three public Apple entrypoints remain closed by construction', () => {
  for (const [file, kind] of [['apple-prepare-purchase', 'prepare'], ['apple-verify-purchase', 'verify'], ['apple-notifications', 'notifications']]) {
    assert.ok(read(`supabase/functions/${file}/index.ts`).includes(`Deno.serve(handler('${kind}'))`));
  }
  assert.match(read('supabase/functions/_shared/apple/http.mjs'), /if\(!backend\)return response\(\{error:'APPLE_BACKEND_NOT_CONFIGURED'\},503\)/);
});
