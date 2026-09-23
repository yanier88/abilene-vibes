import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, writeFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
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
  const verify = capture.slice(capture.indexOf('private func verifyApp('), capture.indexOf('func prepare('));
  assert.ok(verify.indexOf('try Task.checkCancellation()') > verify.indexOf('try await AppTransaction.shared'));
  assert.ok(verify.indexOf('try Task.checkCancellation()') < verify.indexOf('guard case .verified'));
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
  assert.doesNotMatch(capture, /NSLog|localizedDescription/);
  assert.equal((capture.match(/print\(/g) ?? []).length, 1);
  assert.match(capture, /print\("\[StoreKitCatalog\] " \+ line\)/);
  for (const line of capture.split('\n').filter(line => line.includes('recordCatalog('))) {
    assert.doesNotMatch(line, /jwsRepresentation|appAccountToken|correlationToken|x5c|expirationDate|revocationDate|ownershipType/);
  }
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

test('first Featured purchase is gated before reservation and purchase, and UI cannot buy Premium', () => {
  const buy = capture.slice(capture.indexOf('func buy('), capture.indexOf('private func capture('));
  assert.ok(buy.indexOf('guard FirstFeaturedSandboxPurchase.allows(id)') < buy.indexOf('guard purchaseAttempt.reserve()'));
  assert.ok(buy.indexOf('guard purchaseAttempt.reserve()') < buy.indexOf('product.purchase('));
  assert.match(buy, /throw FirstFeaturedPurchaseError.notFeatured/);
  assert.match(capture, /PURCHASE_BLOCKED_NOT_FEATURED/);
  assert.match(buy, /expectedProduct: FirstFeaturedSandboxPurchase.productID/);
  assert.match(capture, /guard case .verified\(let t\)/);
  const ui = capture.slice(capture.indexOf('for product in products {'), capture.indexOf('addButton("Capture Entitlements'));
  assert.match(ui, /guard FirstFeaturedSandboxPurchase.allows\(product.id\) else \{[\s\S]*let evidence = UILabel\(\)[\s\S]*continue\s+\}/);
  assert.ok(ui.indexOf('continue') < ui.indexOf('self.addButton('));
  assert.match(capture, /Product.products\(for: SandboxCaptureGate.products\)/);
});

test('actual Swift policy rejects other IDs and private metadata serializes dates, nulls and ownership', () => {
  const policy = capture.slice(capture.indexOf('private enum FirstFeaturedSandboxPurchase {'), capture.indexOf('private enum FirstFeaturedPurchaseError'));
  const dir = mkdtempSync(join(tmpdir(), 'abilene-featured-policy-'));
  try {
    const path = join(dir, 'main.swift');
    writeFileSync(path, 'import Foundation\n' + policy + `
let present = FirstFeaturedSandboxPurchase.privateMetadata(expirationDate: Date(timeIntervalSince1970: 1700000000), ownershipType: "PURCHASED", revocationDate: Date(timeIntervalSince1970: 1700000100))
let absent = FirstFeaturedSandboxPurchase.privateMetadata(expirationDate: nil, ownershipType: "PURCHASED", revocationDate: nil)
let output: [String: Any] = ["featured": FirstFeaturedSandboxPurchase.allows("com.abilenevibes.app.promotion.slot01.featured.monthly"), "premium": FirstFeaturedSandboxPurchase.allows("com.abilenevibes.app.promotion.slot01.premium.monthly"), "unknown": FirstFeaturedSandboxPurchase.allows("unknown"), "present": present, "absent": absent]
let data = try JSONSerialization.data(withJSONObject: output)
print(String(decoding: data, as: UTF8.self))
`);
    const result = JSON.parse(execFileSync('swift', ['-module-cache-path', join(dir, 'cache'), path], { encoding: 'utf8', timeout: 60000 }));
    assert.equal(result.featured, true);
    assert.equal(result.premium, false);
    assert.equal(result.unknown, false);
    assert.equal(result.present.expirationDate, 1700000000000);
    assert.equal(result.absent.expirationDate, null);
    assert.equal(result.present.revocationDate, 1700000100000);
    assert.equal(result.absent.revocationDate, null);
    assert.equal(result.present.ownershipType, 'PURCHASED');
    assert.match(capture, /privateMetadata\(expirationDate: t.expirationDate,\s+ownershipType: t.ownershipType.rawValue, revocationDate: t.revocationDate\)/);
    assert.match(capture, /"deliveryGranted": false, "finishCalled": false/);
  } finally { rmSync(dir, { recursive: true, force: true }); }
});

test('purchase result diagnostics preserve branches, safe errors and a single attempt', () => {
  const buy = capture.slice(capture.indexOf('func buy('), capture.indexOf('private func capture('));
  assert.match(buy, /case \.success\(let result\):\s+recordCatalog\("PURCHASE_RESULT = SUCCESS"\)/);
  assert.match(buy, /case \.verified: recordCatalog\("PURCHASE_SUCCESS_VERIFICATION = VERIFIED"\)/);
  assert.match(buy, /case \.unverified: recordCatalog\("PURCHASE_SUCCESS_VERIFICATION = UNVERIFIED"\)/);
  assert.match(buy, /case \.userCancelled:\s+recordCatalog\("PURCHASE_RESULT = USER_CANCELLED"\)\s+return "Cancelled\. No automatic retry\."/);
  assert.match(buy, /case \.pending:\s+recordCatalog\("PURCHASE_RESULT = PENDING"\)\s+return "Pending\./);
  assert.match(buy, /@unknown default:\s+recordCatalog\("PURCHASE_RESULT = UNKNOWN"\)\s+throw SandboxCaptureError.transactionRejected/);
  assert.match(buy, /catch \{\s+recordCatalog\("PURCHASE_RESULT = ERROR"\)\s+recordCatalog\(SandboxStoreKitDiagnostic.summary\(error\)\)\s+throw error\s+\}\s+switch purchaseResult/);
  assert.equal((buy.match(/product\.purchase\(/g) ?? []).length, 1);
  assert.equal((buy.match(/purchaseAttempt.reserve\(\)/g) ?? []).length, 1);
  const buyWithoutComments = buy.replace(/"(?:\\.|[^"\\])*"|\/\/[^\n]*|\/\*[\s\S]*?\*\//g,
    token => token.startsWith('"') ? token : ' ');
  assert.doesNotMatch(buyWithoutComments, /\b(?:while|repeat)\b|purchaseAttempt\s*=|\.finish\(|AppStore.sync|startUpdates/);
  const errorCatch = buy.slice(buy.indexOf('catch {'), buy.indexOf('switch purchaseResult'));
  assert.doesNotMatch(errorCatch, /capture\(|userInfo|localizedDescription|jwsRepresentation|appAccountToken/);
  assert.match(capture, /"deliveryGranted": false, "finishCalled": false/);
});
