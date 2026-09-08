# Phase 35 — hardening, local validation and final normal assets

## Separation and cleanup

Preserved the native bridge/controller/storyboard and the internal React laboratory. Moved the byte-identical local catalog to ios/App/StoreKitDevelopment/AbileneLocal.storekit and updated scheme/test/project references. Removed only the two obsolete XCTest/host targets and their 24 exclusive pbx objects, LocalHost.swift, StoreKitLocalTests.swift, LocalDevelopment.entitlements, obsolete README and StoreKitLocal.xcscheme. App/project Debug and Release build settings are unchanged. The external phase33 laboratory is untouched.

## Gates

Local entry requires the web flag plus native Capacitor iOS. Compile-time false removes the laboratory dynamic import from the normal Vite bundle. Only a flagged build emits apple-iap-local-test.json; the native service independently reads that packaged marker. Native catalog/purchase/sync require Debug simulator, explicit launch argument, marker, verified Xcode AppTransaction and exact bundle. Purchase products are restricted to three. Until a production implementation is authorized, direct native calls outside this context fail closed rather than reaching real Apple purchasing. A blocked local screen renders no purchase controls.

## TEST receipts

LocalStoreKitSecurity.swift contains the exact authority used by native code and executable Swift unit tests. It is compiled only for DEBUG simulator (or an explicit macOS unit-test define); a no-DEBUG object contains no receipt authority/HMAC/key symbols. The key lives only in native process memory. Receipts bind TEST domain, transaction/original IDs, product, bundle, environment, account token, random nonce and 300-second validity. Exact issuance registry + HMAC + metadata + time + native gate are validated atomically by an actor. Consumption happens once before the explicit StoreKit finish call. Concurrent replay has one winner; further issuance for that transaction is blocked in the same session. Restart destroys the key/registry: old receipts fail, and verified reconciliation may issue a new session receipt. This is NOT persistent production replay protection.

## Reconciler

mergeKnown is the single classifier. It consumes purchase, updates, unfinished, current entitlements, sync and known session state. Flags are orthogonal:
- knownPendingFinish: positive pending evidence, not inferred from entitlement alone.
- entitlementActive: latest entitlement snapshot, independent of delivery/finish.
- recoveredAfterSync: observed in a sync response.
- explicitlyFinished: the explicit native finish call returned success, not a server delivery guarantee.
- reconciliationRequired: missing or contradictory evidence. Includes unfinished returning a transaction AFTER an explicit finish acknowledgement.

Empty unfinished never marks all finished or deletes prior pending evidence. The UI keeps acknowledged finish and conflicting evidence visible. The one-time authority does not silently retry finish or mint another receipt for a consumed transaction during that session.

## Restart test observed in the real App

Used the already verified, unfinished purchases 4 and 5 from phase34; no new purchase was needed. Stopped/relaunched App with the hardened native bridge and intermediate flagged web assets. Initial session memory was empty. Entitlements recovered 4 and 5; unfinished returned []. Classification: entitlementActive=true, knownPendingFinish=false, reconciliationRequired=true. Explicit Xcode simulated-auth Sync returned both unfinished; flags became knownPendingFinish=true, recoveredAfterSync=true, reconciliationRequired=false.

After refreshing read evidence and selecting 5, explicit finish with the new receipt returned finished=true. HOWEVER, Transaction Manager retained the unfinished warning, and another authenticated local sync returned 5 again. The classifier correctly kept explicitlyFinished=true (acknowledgement) AND reconciliationRequired=true (contradiction). Transaction 4 was not finished. No retry, new purchase, receipt bypass or automatic correction was performed. Native finish is nonthrowing; its acknowledgement alone is not independent proof that StoreKit's pending state cleared. The cause of this observed discrepancy is not established. Phase35 must not be declared fully validated for restart+terminal-finish while this remains unresolved.

No Code=3 or signing investigation, no SKTestSession, no new external laboratory, no remote mutations.

## Production preparation

See phase35-production-delivery-contract.md and src/native/productionDeliveryContract.d.ts. These are design/types only. UnconfiguredDeliveryVerifier still rejects all production delivery confirmations. App Attest is documented, not implemented. Product strings alone do not distinguish Xcode from real products; verified environment and configuration gates provide the separation. Remote product existence is not claimed.

## Build order

An intermediate flagged web build/sync and native Debug build were necessary to test the hardened code. After tests, exactly one final normal npm run build must omit VITE_APPLE_IAP_LOCAL_TEST, followed by cap sync ios. normal-bundle.test.mjs inspects both actual output trees for absence of marker/screen/test code and equality of copied assets. Never sync Android or publish intermediate local assets.

## Final verification

84 JS/model/bridge/reconciler tests passed, 26 executable Swift security checks passed, and 3 artifact tests passed: 113 total, zero failures. Additionally, compiling the security helper without DEBUG and inspecting its object symbols confirmed no LocalTestReceiptAuthority, LocalReceiptTransaction, SymmetricKey or HMAC symbols. This is a helper exclusion check, not an iOS Release/Archive build.

Exactly one final normal build (env -u VITE_APPLE_IAP_LOCAL_TEST) and final cap sync ios succeeded. Both dist and ios/App/App/public lack the local marker, screen chunk and test-code strings; copied web files match SHA256. App execution was stopped before the final normal build. The normal resources were not installed/launched on the simulator, and no final native .app rebuild is claimed. The previously installed simulator build remains an intermediate laboratory artifact, stopped; it must not be confused with the final normal repository resources.

Android (54 files), Supabase (9 files), dist-admin (62 files), App.jsx, App.css, package files, root Capacitor configuration, storyboard and bridge controller are unchanged from the phase35 baseline. HEAD remains 386628df6d46e7956bc3220e366170121ed7d9ce. No staging, commit, push or remote operation occurred against application services. All production delivery/App Attest interfaces remain unimplemented.

Closure: implementation/tests/normal assets are consolidated, but full functional closure remains pending independent terminal-finish verification for recovered transaction 5. Do not start production Apple delivery merely because unit tests pass.
