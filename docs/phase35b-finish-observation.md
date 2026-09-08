# Phase 35B — bounded Xcode finish observation

Outcome C: local inconsistency reproduced and bounded; terminal validation remains for a separately authorized physical-device/Sandbox phase. This is not proof of an Apple implementation defect or production failure. No reconciliation change was justified.

## Scope and implementation

Xcode 26.6, iOS 26.5 Simulator, iPhone 17, com.abilenevibes.app. One existing local transaction, ID 4 / original ID 4 / com.abilenevibes.app.promotion.slot02.featured.monthly. No new purchase; one finish call only. No SKTestSession, signing changes, backend, real payment, or remote configuration.

The actor stores the complete verified StoreKit.Transaction value in pending, keyed by ID. Purchase, unfinished (including the iteration inside sync), or updates replace that value. Entitlements do not populate pending. Finish captures that value and its acquisition provenance, verifies the TEST receipt against the same value, then calls await transaction.finish() exactly once. The plugin's finished:true acknowledges this return; it is not an independent confirmation that the StoreKit queue or Transaction Manager changed.

Added opt-in DEBUG + simulator + Xcode-environment diagnostic metadata only in AbileneStoreKitService.swift. The launch argument --abilene-iap-trace-transaction=4 was enabled for the observation, then removed. No JWS, receipt, HMAC key, or full account token was logged. No purchase/finish/reconciliation behavior changed.

## Observation (Unix milliseconds)

The requested independent unfinished acquisition did not return ID 4. A preparatory Xcode-only sync was necessary. Its actual Transaction.unfinished iteration returned ID 4, traced with source=sync. A further independent unfinished query was empty BEFORE finish. Thus empty queries cannot be attributed to finish in this observation.

| Event | Timestamp | ID 4 present |
| --- | ---: | --- |
| Initial unfinished | 1788835031127.554 | false |
| Acquired by sync's unfinished iteration | 1788835049919.467 | true |
| Sync query returned | 1788835049926.585 | true |
| Independent unfinished before finish | 1788835061730.710 | false |
| finishCall, captured source=sync | 1788835108654.406 | same captured Transaction |
| finishReturned | 1788835108658.486 | return after approximately 4.08 ms |
| Unfinished at +11.16 seconds | 1788835119821.540 | false |
| Unfinished at +35.62 seconds | 1788835144283.277 | false |
| Unfinished at +63.72 seconds | 1788835172374.772 | false |
| Post-finish sync acquisition at +84.88 seconds | 1788835193535.689 | true |
| Post-finish sync query returned | 1788835193542.591 | true |
| Independent unfinished after sync at +91.38 seconds | 1788835200037.779 | false |

Both acquisitions and the value used by finish matched transactionId, originalTransactionId, productId, purchaseDate=1788821585427, expirationDate=1791413585427, environment=Xcode, verification=verified, and appAccountToken (compared privately; only equality and presence booleans emitted). sameEventAsFirst=true and accountTokenMatchesFirst=true. This rules out a different observed event/product/chain; it cannot inspect StoreKit's opaque internal state or prove/disprove an internally stale representation.

Transaction Manager retained the unfinished warning before finish, immediately after the click, after roughly 35 and 64 seconds, and after the final sync. No Manager actions mutated transactions. No delayed disappearance was observed. The local UI retained explicitlyFinished=true and reconciliationRequired=true after the conflict; finish was not repeated. Entitlement remained active and was not used as evidence of unfinished delivery.

## Official documentation

- https://developer.apple.com/documentation/storekit/transaction/finish(): async finish indicates delivered content/service. It has no throwing result or explicit next-query timing guarantee.
- https://developer.apple.com/documentation/storekit/transaction/unfinished: describes unfinished transactions as unfinished until finish is called. This conceptual contract does not document the reproduced behavior as expected or provide a propagation deadline.
- https://developer.apple.com/documentation/storekit/transaction/updates: unfinished transactions are emitted at launch; same-device successful purchases are also delivered directly through purchase.
- https://developer.apple.com/documentation/storekit/transaction/currententitlements: active auto-renewable subscription entitlements are independent of delivery acknowledgement; finish does not cancel a subscription.
- https://developer.apple.com/documentation/xcode/setting-up-storekit-testing-in-xcode/: local StoreKit testing uses Xcode data without App Store server connectivity.

The consulted primary pages do not explicitly guarantee immediate, linearizable removal from the next unfinished iteration after await finish. This absence alone does not demonstrate delayed propagation. No delay window was added on speculation.

## Next phase

Do not add automatic finish retries or treat a native return as definitive queue reconciliation. Preserve receipt validation, idempotent delivery, and explicit reconciliation. Plan one separately authorized physical-device/Sandbox terminal test with real StoreKit verification and server delivery acknowledgement before enabling production purchasing. Do not open another local experiment to explain this result. Existing local TEST receipts remain unsuitable for production.

## Validation and final artifacts

84 existing JavaScript tests passed, including bridge and reconciliation invariants; the unchanged Swift receipt-security executable passed all 26 checks; 3 normal-bundle checks passed (113 total). App Debug simulator build succeeded. The only native build warning reported skipped AppIntents metadata extraction. Vite reported its existing large-chunk warning.

The laboratory web build was used only for this local observation. Afterwards a normal web build and iOS-only sync restored dist and App/public byte-for-byte to the initial normal resources, with no laboratory marker or chunk. The simulator process was stopped; the already installed simulator binary remains the diagnostic build, not a newly installed normal build. No claim of a final normal simulator installation is made.

The starting filesystem hash comparison found only AbileneStoreKitService.swift changed plus this new report, excluding four ignored Xcode/Finder UI-state files. The temporary scheme argument was removed and the scheme matches its starting hash. Android, Supabase, Stripe sources, Admin artifacts, shared application UI, package manifests, catalog, signing, and existing project configuration stayed unchanged from phase start. Prior uncommitted phases remain in the working tree. No commit or push.
