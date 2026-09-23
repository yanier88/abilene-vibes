# Fase112 — reviewed change inventory

No files were staged or committed. Existing earlier-phase work remains in the working tree. This inventory distinguishes the current production graph from preserved laboratory files; do not blanket deploy or add all untracked files.

## Production Edge import graph

- `supabase/functions/_shared/apple/backend.mjs`
- `supabase/functions/_shared/apple/domain.mjs`
- `supabase/functions/_shared/apple/edge/cache.mjs`
- `supabase/functions/_shared/apple/edge/certificates.mjs`
- `supabase/functions/_shared/apple/edge/deno-transport.mjs`
- `supabase/functions/_shared/apple/edge/der.mjs`
- `supabase/functions/_shared/apple/edge/jws.mjs`
- `supabase/functions/_shared/apple/edge/ocsp.mjs`
- `supabase/functions/_shared/apple/edge/transport.mjs`
- `supabase/functions/_shared/apple/edge/verifier.mjs`
- `supabase/functions/_shared/apple/expired-reconciliation.mjs`
- `supabase/functions/_shared/apple/production/ack.mjs`
- `supabase/functions/_shared/apple/production/composition.mjs`
- `supabase/functions/_shared/apple/production/identity.mjs`
- `supabase/functions/_shared/apple/production/policy.mjs`
- `supabase/functions/_shared/apple/production/root.mjs`
- `supabase/functions/_shared/apple/production/runtime.ts`
- `supabase/functions/_shared/apple/production/trust.mjs`
- `supabase/functions/_shared/apple/production/verifier.mjs`
- `supabase/functions/_shared/apple/reconciliation.mjs`
- `supabase/functions/_shared/apple/repository.mjs`
- `supabase/functions/_shared/apple/safe-observability.mjs`
- `supabase/functions/apple-iap/index.ts`
- `supabase/functions/apple-iap-notifications/index.ts`

Runtime configuration also requires the two function deno.json files and the two named entries in supabase/config.toml. npm dependencies are pinned in package-lock.json. No Node-service runtime, private evidence, fixture or jsrsasign is in this graph.

## Native/web production integration

- `ios/App/App/AppleDeliveryACK.swift`
- `ios/App/App/AppleProductionPurchase.swift`
- `ios/App/App/AbileneBridgeViewController.swift`
- `ios/App/App.xcodeproj/project.pbxproj`
- `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme`
- `src/components/ApplePromotionPurchase.jsx`
- `src/billing/appleProjection.mjs`
- `src/App.jsx`
- `package.json`
- `package-lock.json`

## Migrations

New production additions: 202609210002_apple_production_composition.sql, 202609210003_apple_public_projection.sql, 202609210004_apple_cancelled_attempt.sql. Their earlier local dependency migrations must be reviewed against the remote applied list; see deployment preparation document. Historical Sandbox functions/tables remain preserved, not repurposed as Production endpoints.

## Tests/documentation

Include reviewed production-ack, production-identity, production-http, production-postgres-local, edge-crypto and apple-public-projection tests, native vectors and normal packaging tests. The separately pinned provider delta accounts only for reviewed Apple integration changes; original protected Android/Stripe files and baseline remain unchanged. Include the four phase112/readiness documents.

## Excluded from shipping

- Entire private-evidence directories and /private/tmp test/build outputs.
- Production ACK private original and backup (outside repositories).
- Node project and local Node host; unchanged this continuation.
- SandboxPhysicalCapture diagnostic controller (compiled out of normal Release).
- Lab entrypoints, local ACK signer, replay tools and test certificates.
- Historical lab scripts are preserved for tests/history; do not import into normal app or production entrypoints.

## Full working-tree inventory (includes earlier phases)

```text
 M .gitignore
 M ios/App/App.xcodeproj/project.pbxproj
 M ios/App/App/AbileneBridgeViewController.swift
 M ios/App/App/SandboxPhysicalCapture.swift
 M package-lock.json
 M package.json
 M src/App.jsx
 M supabase/config.toml
 M supabase/functions/_shared/apple/backend.mjs
 M supabase/functions/_shared/apple/domain.mjs
 M supabase/functions/_shared/apple/reconciliation.mjs
 M supabase/functions/_shared/apple/repository.mjs
 M supabase/functions/apple-notifications/index.ts
 M supabase/functions/apple-prepare-purchase/index.ts
 M supabase/functions/apple-verify-purchase/index.ts
 M tests/apple-iap/phase35-hardening.test.mjs
 M tests/apple-iap/phase49-boundary.test.mjs
?? docs/apple-iap-production-readiness.md
?? docs/phase102-expired-purchase-recovery.md
?? docs/phase103d-authorization-history.md
?? docs/phase104-timestamp-closure.md
?? docs/phase109-never-started-release.md
?? docs/phase112-change-inventory.md
?? docs/phase112-edge-compatibility.md
?? docs/phase112-final-integration-status.md
?? docs/phase71-local-supabase-node-integration.md
?? docs/phase72-local-readiness.md
?? docs/phase73-final-staging-closure.md
?? docs/phase77-installation-binding.md
?? ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme
?? ios/App/App/AppleDeliveryACK.swift
?? ios/App/App/AppleProductionPurchase.swift
?? ios/App/App/AppleRecoveryResponse.swift
?? src/billing/appleProjection.mjs
?? src/components/ApplePromotionPurchase.jsx
?? supabase/functions/_shared/apple/ack-readiness.mjs
?? supabase/functions/_shared/apple/assn-client.mjs
?? supabase/functions/_shared/apple/delivery-ack.mjs
?? supabase/functions/_shared/apple/edge/cache.mjs
?? supabase/functions/_shared/apple/edge/certificates.mjs
?? supabase/functions/_shared/apple/edge/deno-transport.mjs
?? supabase/functions/_shared/apple/edge/der.mjs
?? supabase/functions/_shared/apple/edge/jws.mjs
?? supabase/functions/_shared/apple/edge/ocsp.mjs
?? supabase/functions/_shared/apple/edge/transport.mjs
?? supabase/functions/_shared/apple/edge/verifier.mjs
?? supabase/functions/_shared/apple/expired-reconciliation.mjs
?? supabase/functions/_shared/apple/lab-recovery-router.mjs
?? supabase/functions/_shared/apple/local-ack-signer.mjs
?? supabase/functions/_shared/apple/node-verifier-client.mjs
?? supabase/functions/_shared/apple/production/ack.mjs
?? supabase/functions/_shared/apple/production/composition.mjs
?? supabase/functions/_shared/apple/production/identity.mjs
?? supabase/functions/_shared/apple/production/policy.mjs
?? supabase/functions/_shared/apple/production/root.mjs
?? supabase/functions/_shared/apple/production/runtime.ts
?? supabase/functions/_shared/apple/production/trust.mjs
?? supabase/functions/_shared/apple/production/verifier.mjs
?? supabase/functions/_shared/apple/recovery-authorization.mjs
?? supabase/functions/_shared/apple/recovery-http.mjs
?? supabase/functions/_shared/apple/restricted-replay-store.mjs
?? supabase/functions/_shared/apple/safe-observability.mjs
?? supabase/functions/_shared/apple/staging-composition.mjs
?? supabase/functions/_shared/apple/staging-entrypoint.mjs
?? supabase/functions/apple-iap-notifications/deno.json
?? supabase/functions/apple-iap-notifications/index.ts
?? supabase/functions/apple-iap/deno.json
?? supabase/functions/apple-iap/index.ts
?? supabase/functions/apple-readiness/index.ts
?? supabase/migrations/202609160001_apple_verified_commit_guard.sql
?? supabase/migrations/202609160002_apple_provider_isolation.sql
?? supabase/migrations/202609160003_apple_replay_claim.sql
?? supabase/migrations/202609160004_apple_replay_readiness.sql
?? supabase/migrations/202609160005_apple_installation_binding.sql
?? supabase/migrations/202609200001_apple_expired_undelivered.sql
?? supabase/migrations/202609200002_apple_listing_authorization_history.sql
?? supabase/migrations/202609200003_apple_authorization_timestamp_precision.sql
?? supabase/migrations/202609210001_apple_never_started_release.sql
?? supabase/migrations/202609210002_apple_production_composition.sql
?? supabase/migrations/202609210003_apple_public_projection.sql
?? supabase/migrations/202609210004_apple_cancelled_attempt.sql
?? tests/apple-backend/android-stripe-preservation-baseline-v1.json
?? tests/apple-backend/android-stripe-preservation-loader.mjs
?? tests/apple-backend/android-stripe-preservation.test.mjs
?? tests/apple-backend/apple-public-projection.test.mjs
?? tests/apple-backend/assn-fixtures.mjs
?? tests/apple-backend/assn.test.mjs
?? tests/apple-backend/authorization-history.test.mjs
?? tests/apple-backend/current-authentic-replay-fixture.mjs
?? tests/apple-backend/current-authentic-replay-loader.mjs
?? tests/apple-backend/current-authentic-replay-loader.test.mjs
?? tests/apple-backend/edge-crypto.test.mjs
?? tests/apple-backend/expired-recovery-fixtures.mjs
?? tests/apple-backend/expired-recovery.test.mjs
?? tests/apple-backend/installation-binding-fixtures.mjs
?? tests/apple-backend/installation-binding.test.mjs
?? tests/apple-backend/node-integration-fixtures.mjs
?? tests/apple-backend/node-integration.test.mjs
?? tests/apple-backend/phase102-postgres-local.mjs
?? tests/apple-backend/phase102-provider-delta.json
?? tests/apple-backend/phase103d-postgres-local.mjs
?? tests/apple-backend/phase104-postgres-local.mjs
?? tests/apple-backend/phase109-postgres-local.mjs
?? tests/apple-backend/phase109-test-sql.mjs
?? tests/apple-backend/phase112-production-provider-delta.json
?? tests/apple-backend/phase112-provider-delta.json
?? tests/apple-backend/phase72-ack-cryptokit.swift
?? tests/apple-backend/phase72-ack-local.mjs
?? tests/apple-backend/phase72-postgres-local.mjs
?? tests/apple-backend/phase72-replay-local.mjs
?? tests/apple-backend/phase72-rotation.test.mjs
?? tests/apple-backend/phase73-postgres-local.mjs
?? tests/apple-backend/phase73-readiness.test.mjs
?? tests/apple-backend/phase73-replay-local.mjs
?? tests/apple-backend/phase77-postgres-local.mjs
?? tests/apple-backend/phase95-ack-vectors.mjs
?? tests/apple-backend/phase95-provider-isolation.test.mjs
?? tests/apple-backend/phase95-regression.md
?? tests/apple-backend/post-sign-freshness.test.mjs
?? tests/apple-backend/production-ack-native.mjs
?? tests/apple-backend/production-ack-native.swift
?? tests/apple-backend/production-ack.test.mjs
?? tests/apple-backend/production-http.test.mjs
?? tests/apple-backend/production-identity.test.mjs
?? tests/apple-backend/production-postgres-local.mjs
?? tests/apple-backend/recovery-failure-matrix.test.mjs
?? tests/apple-backend/recovery-response.swift
?? tests/apple-backend/recovery-response.test.mjs
?? tests/apple-iap/production-packaging.test.mjs
```
