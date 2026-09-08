> Historical phase34 record. Current gates, cleanup and phase35 validation limitations are documented in docs/phase35-hardening.md. The previous host/XCTest files were removed in phase35.

# Phase 34 — internal Xcode laboratory

Not a checkout, promotion activator, backend verifier, or production entitlement implementation.

Entry requires a web build with `VITE_APPLE_IAP_LOCAL_TEST=true`, native Capacitor iOS, and verified native AppTransaction with environment `Xcode`. Native activation additionally requires Debug, simulator and the `--abilene-iap-local-test` launch argument provided only by the `AbileneIAPLocal` scheme. Normal App/Release/Archive configuration remains unchanged. A laboratory asset build with a failed native gate shows a locked screen, with no Stripe fallback. Without the web flag, the regular App is loaded. Android always takes the regular App branch.

The laboratory loads only the three named products from the existing AbileneLocal.storekit catalog. Prices come from StoreKit. Its TEST UUID and transaction history are memory-only. It does not import the production App or call Supabase/Edge Functions. No JWS, account token or delivery receipt is rendered or logged.

Native synthetic delivery uses a fresh in-memory HMAC-SHA256 key. The payload binds TEST domain, transaction ID, product and bundle. Only verified Xcode transactions from the three permitted products receive the opaque confirmation. Finish validates the HMAC, exact transaction ID, bundle, product, transaction environment and a fresh verified Xcode AppTransaction. The normal service still uses UnconfiguredDeliveryVerifier (always false). Synthetic delivery code is excluded from non-Debug and physical-device builds. It is not server delivery evidence.

Purchase, updates, entitlements and sync never finish. The button is the only UI finish caller. Empty unfinished results never clear known transactions or mark delivery complete. Entitlements alone do not prove unfinished status; finish may require recovery through sync if the native pending map lacks the transaction. After relaunch, the memory key/history disappear; reconciliation can issue new local receipts, but cannot establish historic delivery. This is intentionally not production recovery.

Exit/unmount removes the JS listener and stops the native updates task. StoreKitLocalHost/entitlements/old XCTest scheme remain intact for review; the new scheme does not run those targets or SKTestSession. A later cleanup may remove those isolated failed experiments after explicit review.

## Observed local validation — 2026-09-07

App target, AbileneIAPLocal scheme, Debug, iPhone 17 / iOS 26.5. Verified Xcode gate passed. StoreKit returned the three requested products ($24.99 Featured; $67.99 Premium in this local catalog).

- Slot01 Featured: transaction 3 / original 3; verified purchase, entitlement, unfinished and update. Manager displayed its not-finished warning. Explicit button returned finished=true for 3; warning disappeared; subsequent unfinished was empty.
- Slot02 Featured: transaction 4 / original 4; verified purchase and update. Entitlements contained 4 and 3 simultaneously in different subscription groups.
- Slot01 Premium upgrade: transaction 5 / original 3, same group as Featured. Local sheet explicitly described an immediate upgrade. Entitlements contained 5 and 4. No automatic finish.
- After upgrade, unfinished returned [] although Manager marked 4 and 5 unfinished. Known state retained them as pending. Explicit AppStore.sync with simulated Xcode authentication returned both 5 and 4 in unfinished and entitlements. The limitation from phase33G is reproduced.
- Exit invoked listener removal and stopTransactionUpdates; closed screen disabled controls. Transactions 4 and 5 remain unfinished intentionally, exclusively in Xcode local testing.

Tests: 75 passed (64 baseline = 10 frontend + 7 ownership + 47 Apple model, plus 4 existing bridge + 7 new local-screen tests). The 47 Apple tests are part of the 64, not an additional 47. New native guard/HMAC test checks source invariants; it is not an execution of adversarial Swift receipt tests. Positive HMAC validation/finish was exercised through the real bridge.

One npm run build and one cap sync ios succeeded; native xcodebuild and Xcode Run succeeded. No SKTestSession. The generated web/iOS assets currently carry the local lab flag and must not be shipped as production assets. A future authorized normal build must omit that flag before release validation.
