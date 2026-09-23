# Phase112 — final Production closure audit

Remote checks and App Store Connect inspection were read-only in this execution. No stage, commit, push, deployment, secret change, live StoreKit operation, notification send, installation or submission.

## Technical result

Production project ymgiwjuhgvfexitynmtb is ACTIVE_HEALTHY. Nine authorized migration records and effective schema match the rehearsed chain: 23 Apple tables, valid indexes/constraints/triggers, enabled RLS and service-only privileged RPCs. apple-iap and apple-iap-notifications are ACTIVE version 1; the five pre-existing functions and commercial hashes are unchanged.

App Store Connect identity, group 22382531 and the exact Featured/Premium slot01 monthly product IDs were read and matched. Production notification URL is https://ymgiwjuhgvfexitynmtb.supabase.co/functions/v1/apple-iap-notifications. Sandbox URL remains empty. Both products/group are Prepare for Submission. No notification was sent.

Normal app path reviewed: Supabase session, advertiser ownership, installation proof, server-owned stable token, signed listing capability, StoreKit catalog and explicit appAccountToken purchase option, local verified transaction guards, Production backend, durable PostgreSQL CAS/claim/subscription/assignment/entitlement, signed ACK, native CryptoKit binding/freshness validation and finish only after ACK. Recovery and manage subscriptions are wired. This is a source/build/regression audit, not a live Production purchase.

Notifications validate outer/nested signatures, OCSP, app/bundle/environment/product/group and linkage. Duplicate/replay/out-of-order handling preserves fail-closed reconciliation; invalid evidence does not confer commercial authority. Mocked policy/lifecycle cases and authentic historical offline crypto cases are distinguished in the tests.

Shared Supabase publication/moderation and approved-row reads remain shared by iOS and Android. Apple entitlement projection does not bypass moderation. Android Stripe checkout and existing Stripe webhook are preserved. No separate iOS moderation backend.

## Newly executed validation

- JavaScript regression: 674 PASS, 0 FAIL, 0 SKIP. Includes backend/domain, notification lifecycle, Edge crypto and policy, provider isolation, Android/Stripe, iOS packaging and browser-generated weather layout evidence.
- Isolated local Production PostgreSQL: 29 PASS, 0 FAIL, 0 SKIP. Includes RLS/grants, ownership, persistence, concurrency and rollback.
- Isolated local concurrency/upgrade: 19 PASS, 0 FAIL, 0 SKIP.
- Native CryptoKit ACK: 19 PASS, 0 FAIL.
- Final total: 741 PASS, 0 FAIL, 0 SKIP.

The preliminary unconfigured JS invocation reported 29 failures because the fixture environment variable and browser layout evidence were missing. Existing documented prerequisites were supplied and the full suite reran successfully. No assertions or shipping code were changed. Previous phase totals are not counted.

Normal App scheme Release build and codesign --verify --deep --strict passed. This is a locally signed iOS Release build, not an App Store archive/upload. Production URL, both products and public ACK trust are present. No diagnostic controller/private evidence/StoreKit configuration/private ACK material found in the 92-file bundle. The unused supabase-js library default string http://localhost:9999 remains; the actual client uses the explicit Production URL and capacitor has no server override. No temporary server runtime dependency exists.

Public ACK kid: abilene-apple-iap-ack-prod-v1. SPKI SHA-256: 52c735eb291c00b7c633c3a1e9e5127136c30913f54c8e09d1b09d09bd3d894a. Remote secret metadata and hashes remain unchanged except previously observed timestamps on Supabase-managed built-ins. Private key bytes were compared only in memory for accidental-copy detection and never emitted. Repository/bundle/phase112 log scan found no private ACK copies. No new pair was generated.

## Remaining manual submission work

Code/infrastructure closure is separate from submission approval. The app version and first subscription group still require normal submission preparation: screenshots, description/keywords/support URL/copyright, review contact/access information, category/age rating/content rights, a selected uploaded build, and applicable privacy/compliance declarations. The current audit did not change any of them or claim App Review approval. No additional Sandbox purchase is required by this closure.

## Commit boundary

The following is an exact proposed allowlist, NOT a stage operation. A=shipping, B=required regression/support, C=Production migration, D=documentation, F=earlier preserved unrelated-to-shipping work. Test support includes historical lab modules and four historical SQL fixture dependencies; these are NOT additional Production deploy targets. Only the previously approved nine-migration chain was applied. Its first file already exists unchanged in Git, so only eight appear as changed Production migrations. Legacy entrypoints are intentionally excluded. Private fixtures, keys, test/build evidence and temporary files are category E and outside this allowlist.

Historical local-only readiness documents describe their execution-time state; this final report supersedes their remote deployment status.

### Exact proposed stage allowlist

```text
.gitignore
docs/apple-iap-production-readiness.md
docs/phase112-change-inventory.md
docs/phase112-edge-compatibility.md
docs/phase112-final-integration-status.md
docs/phase112-production-closure-audit.md
ios/App/App.xcodeproj/project.pbxproj
ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme
ios/App/App/AbileneBridgeViewController.swift
ios/App/App/AppleDeliveryACK.swift
ios/App/App/AppleProductionPurchase.swift
ios/App/App/AppleRecoveryResponse.swift
ios/App/App/SandboxPhysicalCapture.swift
package-lock.json
package.json
src/App.jsx
src/billing/appleProjection.mjs
src/components/ApplePromotionPurchase.jsx
supabase/config.toml
supabase/functions/_shared/apple/ack-readiness.mjs
supabase/functions/_shared/apple/assn-client.mjs
supabase/functions/_shared/apple/backend.mjs
supabase/functions/_shared/apple/delivery-ack.mjs
supabase/functions/_shared/apple/domain.mjs
supabase/functions/_shared/apple/edge/cache.mjs
supabase/functions/_shared/apple/edge/certificates.mjs
supabase/functions/_shared/apple/edge/deno-transport.mjs
supabase/functions/_shared/apple/edge/der.mjs
supabase/functions/_shared/apple/edge/jws.mjs
supabase/functions/_shared/apple/edge/ocsp.mjs
supabase/functions/_shared/apple/edge/transport.mjs
supabase/functions/_shared/apple/edge/verifier.mjs
supabase/functions/_shared/apple/expired-reconciliation.mjs
supabase/functions/_shared/apple/lab-recovery-router.mjs
supabase/functions/_shared/apple/local-ack-signer.mjs
supabase/functions/_shared/apple/node-verifier-client.mjs
supabase/functions/_shared/apple/production/ack.mjs
supabase/functions/_shared/apple/production/composition.mjs
supabase/functions/_shared/apple/production/identity.mjs
supabase/functions/_shared/apple/production/policy.mjs
supabase/functions/_shared/apple/production/root.mjs
supabase/functions/_shared/apple/production/runtime.ts
supabase/functions/_shared/apple/production/trust.mjs
supabase/functions/_shared/apple/production/verifier.mjs
supabase/functions/_shared/apple/reconciliation.mjs
supabase/functions/_shared/apple/recovery-authorization.mjs
supabase/functions/_shared/apple/recovery-http.mjs
supabase/functions/_shared/apple/repository.mjs
supabase/functions/_shared/apple/restricted-replay-store.mjs
supabase/functions/_shared/apple/safe-observability.mjs
supabase/functions/_shared/apple/staging-composition.mjs
supabase/functions/_shared/apple/staging-entrypoint.mjs
supabase/functions/apple-iap-notifications/deno.json
supabase/functions/apple-iap-notifications/index.ts
supabase/functions/apple-iap/deno.json
supabase/functions/apple-iap/index.ts
supabase/migrations/202609160001_apple_verified_commit_guard.sql
supabase/migrations/202609160002_apple_provider_isolation.sql
supabase/migrations/202609160003_apple_replay_claim.sql
supabase/migrations/202609160004_apple_replay_readiness.sql
supabase/migrations/202609160005_apple_installation_binding.sql
supabase/migrations/202609200001_apple_expired_undelivered.sql
supabase/migrations/202609200002_apple_listing_authorization_history.sql
supabase/migrations/202609200003_apple_authorization_timestamp_precision.sql
supabase/migrations/202609210001_apple_never_started_release.sql
supabase/migrations/202609210002_apple_production_composition.sql
supabase/migrations/202609210003_apple_public_projection.sql
supabase/migrations/202609210004_apple_cancelled_attempt.sql
tests/android-pricing.test.mjs
tests/apple-backend/android-stripe-preservation-baseline-v1.json
tests/apple-backend/android-stripe-preservation-loader.mjs
tests/apple-backend/android-stripe-preservation.test.mjs
tests/apple-backend/apple-public-projection.test.mjs
tests/apple-backend/assn-fixtures.mjs
tests/apple-backend/assn.test.mjs
tests/apple-backend/authorization-history.test.mjs
tests/apple-backend/current-authentic-replay-fixture.mjs
tests/apple-backend/current-authentic-replay-loader.mjs
tests/apple-backend/current-authentic-replay-loader.test.mjs
tests/apple-backend/edge-crypto.test.mjs
tests/apple-backend/expired-recovery-fixtures.mjs
tests/apple-backend/expired-recovery.test.mjs
tests/apple-backend/installation-binding-fixtures.mjs
tests/apple-backend/installation-binding.test.mjs
tests/apple-backend/node-integration-fixtures.mjs
tests/apple-backend/node-integration.test.mjs
tests/apple-backend/phase102-postgres-local.mjs
tests/apple-backend/phase102-provider-delta.json
tests/apple-backend/phase103d-postgres-local.mjs
tests/apple-backend/phase104-postgres-local.mjs
tests/apple-backend/phase109-postgres-local.mjs
tests/apple-backend/phase109-test-sql.mjs
tests/apple-backend/phase112-production-provider-delta.json
tests/apple-backend/phase112-provider-delta.json
tests/apple-backend/phase72-ack-cryptokit.swift
tests/apple-backend/phase72-ack-local.mjs
tests/apple-backend/phase72-postgres-local.mjs
tests/apple-backend/phase72-replay-local.mjs
tests/apple-backend/phase72-rotation.test.mjs
tests/apple-backend/phase73-postgres-local.mjs
tests/apple-backend/phase73-readiness.test.mjs
tests/apple-backend/phase73-replay-local.mjs
tests/apple-backend/phase77-postgres-local.mjs
tests/apple-backend/phase95-ack-vectors.mjs
tests/apple-backend/phase95-provider-isolation.test.mjs
tests/apple-backend/phase95-regression.md
tests/apple-backend/post-sign-freshness.test.mjs
tests/apple-backend/production-ack-native.mjs
tests/apple-backend/production-ack-native.swift
tests/apple-backend/production-ack.test.mjs
tests/apple-backend/production-http.test.mjs
tests/apple-backend/production-identity.test.mjs
tests/apple-backend/production-postgres-local.mjs
tests/apple-backend/recovery-failure-matrix.test.mjs
tests/apple-backend/recovery-response.swift
tests/apple-backend/recovery-response.test.mjs
tests/apple-iap/phase35-hardening.test.mjs
tests/apple-iap/phase49-boundary.test.mjs
tests/apple-iap/production-packaging.test.mjs
```

### Every accumulated changed/new file

| Class | File | Stage later |
|---|---|---|
| A | `.gitignore` | YES |
| D | `docs/apple-iap-production-readiness.md` | YES |
| F | `docs/phase102-expired-purchase-recovery.md` | NO — preserve |
| F | `docs/phase103d-authorization-history.md` | NO — preserve |
| F | `docs/phase104-timestamp-closure.md` | NO — preserve |
| F | `docs/phase109-never-started-release.md` | NO — preserve |
| D | `docs/phase112-change-inventory.md` | YES |
| D | `docs/phase112-edge-compatibility.md` | YES |
| D | `docs/phase112-final-integration-status.md` | YES |
| D | `docs/phase112-production-closure-audit.md` | YES |
| F | `docs/phase71-local-supabase-node-integration.md` | NO — preserve |
| F | `docs/phase72-local-readiness.md` | NO — preserve |
| F | `docs/phase73-final-staging-closure.md` | NO — preserve |
| F | `docs/phase77-installation-binding.md` | NO — preserve |
| A | `ios/App/App.xcodeproj/project.pbxproj` | YES |
| A | `ios/App/App.xcodeproj/xcshareddata/xcschemes/App.xcscheme` | YES |
| A | `ios/App/App/AbileneBridgeViewController.swift` | YES |
| A | `ios/App/App/AppleDeliveryACK.swift` | YES |
| A | `ios/App/App/AppleProductionPurchase.swift` | YES |
| B | `ios/App/App/AppleRecoveryResponse.swift` | YES |
| B | `ios/App/App/SandboxPhysicalCapture.swift` | YES |
| A | `package-lock.json` | YES |
| A | `package.json` | YES |
| A | `src/App.jsx` | YES |
| A | `src/billing/appleProjection.mjs` | YES |
| A | `src/components/ApplePromotionPurchase.jsx` | YES |
| A | `supabase/config.toml` | YES |
| B | `supabase/functions/_shared/apple/ack-readiness.mjs` | YES |
| B | `supabase/functions/_shared/apple/assn-client.mjs` | YES |
| A | `supabase/functions/_shared/apple/backend.mjs` | YES |
| B | `supabase/functions/_shared/apple/delivery-ack.mjs` | YES |
| A | `supabase/functions/_shared/apple/domain.mjs` | YES |
| A | `supabase/functions/_shared/apple/edge/cache.mjs` | YES |
| A | `supabase/functions/_shared/apple/edge/certificates.mjs` | YES |
| A | `supabase/functions/_shared/apple/edge/deno-transport.mjs` | YES |
| A | `supabase/functions/_shared/apple/edge/der.mjs` | YES |
| A | `supabase/functions/_shared/apple/edge/jws.mjs` | YES |
| A | `supabase/functions/_shared/apple/edge/ocsp.mjs` | YES |
| A | `supabase/functions/_shared/apple/edge/transport.mjs` | YES |
| A | `supabase/functions/_shared/apple/edge/verifier.mjs` | YES |
| A | `supabase/functions/_shared/apple/expired-reconciliation.mjs` | YES |
| B | `supabase/functions/_shared/apple/lab-recovery-router.mjs` | YES |
| B | `supabase/functions/_shared/apple/local-ack-signer.mjs` | YES |
| B | `supabase/functions/_shared/apple/node-verifier-client.mjs` | YES |
| A | `supabase/functions/_shared/apple/production/ack.mjs` | YES |
| A | `supabase/functions/_shared/apple/production/composition.mjs` | YES |
| A | `supabase/functions/_shared/apple/production/identity.mjs` | YES |
| A | `supabase/functions/_shared/apple/production/policy.mjs` | YES |
| A | `supabase/functions/_shared/apple/production/root.mjs` | YES |
| A | `supabase/functions/_shared/apple/production/runtime.ts` | YES |
| A | `supabase/functions/_shared/apple/production/trust.mjs` | YES |
| A | `supabase/functions/_shared/apple/production/verifier.mjs` | YES |
| A | `supabase/functions/_shared/apple/reconciliation.mjs` | YES |
| B | `supabase/functions/_shared/apple/recovery-authorization.mjs` | YES |
| B | `supabase/functions/_shared/apple/recovery-http.mjs` | YES |
| A | `supabase/functions/_shared/apple/repository.mjs` | YES |
| B | `supabase/functions/_shared/apple/restricted-replay-store.mjs` | YES |
| A | `supabase/functions/_shared/apple/safe-observability.mjs` | YES |
| B | `supabase/functions/_shared/apple/staging-composition.mjs` | YES |
| B | `supabase/functions/_shared/apple/staging-entrypoint.mjs` | YES |
| A | `supabase/functions/apple-iap-notifications/deno.json` | YES |
| A | `supabase/functions/apple-iap-notifications/index.ts` | YES |
| A | `supabase/functions/apple-iap/deno.json` | YES |
| A | `supabase/functions/apple-iap/index.ts` | YES |
| F | `supabase/functions/apple-notifications/index.ts` | NO — preserve |
| F | `supabase/functions/apple-prepare-purchase/index.ts` | NO — preserve |
| F | `supabase/functions/apple-readiness/index.ts` | NO — preserve |
| F | `supabase/functions/apple-verify-purchase/index.ts` | NO — preserve |
| B | `supabase/migrations/202609160001_apple_verified_commit_guard.sql` | YES |
| B | `supabase/migrations/202609160002_apple_provider_isolation.sql` | YES |
| B | `supabase/migrations/202609160003_apple_replay_claim.sql` | YES |
| B | `supabase/migrations/202609160004_apple_replay_readiness.sql` | YES |
| C | `supabase/migrations/202609160005_apple_installation_binding.sql` | YES |
| C | `supabase/migrations/202609200001_apple_expired_undelivered.sql` | YES |
| C | `supabase/migrations/202609200002_apple_listing_authorization_history.sql` | YES |
| C | `supabase/migrations/202609200003_apple_authorization_timestamp_precision.sql` | YES |
| C | `supabase/migrations/202609210001_apple_never_started_release.sql` | YES |
| C | `supabase/migrations/202609210002_apple_production_composition.sql` | YES |
| C | `supabase/migrations/202609210003_apple_public_projection.sql` | YES |
| C | `supabase/migrations/202609210004_apple_cancelled_attempt.sql` | YES |
| B | `tests/android-pricing.test.mjs` | YES |
| B | `tests/apple-backend/android-stripe-preservation-baseline-v1.json` | YES |
| B | `tests/apple-backend/android-stripe-preservation-loader.mjs` | YES |
| B | `tests/apple-backend/android-stripe-preservation.test.mjs` | YES |
| B | `tests/apple-backend/apple-public-projection.test.mjs` | YES |
| B | `tests/apple-backend/assn-fixtures.mjs` | YES |
| B | `tests/apple-backend/assn.test.mjs` | YES |
| B | `tests/apple-backend/authorization-history.test.mjs` | YES |
| B | `tests/apple-backend/current-authentic-replay-fixture.mjs` | YES |
| B | `tests/apple-backend/current-authentic-replay-loader.mjs` | YES |
| B | `tests/apple-backend/current-authentic-replay-loader.test.mjs` | YES |
| B | `tests/apple-backend/edge-crypto.test.mjs` | YES |
| B | `tests/apple-backend/expired-recovery-fixtures.mjs` | YES |
| B | `tests/apple-backend/expired-recovery.test.mjs` | YES |
| B | `tests/apple-backend/installation-binding-fixtures.mjs` | YES |
| B | `tests/apple-backend/installation-binding.test.mjs` | YES |
| B | `tests/apple-backend/node-integration-fixtures.mjs` | YES |
| B | `tests/apple-backend/node-integration.test.mjs` | YES |
| B | `tests/apple-backend/phase102-postgres-local.mjs` | YES |
| B | `tests/apple-backend/phase102-provider-delta.json` | YES |
| B | `tests/apple-backend/phase103d-postgres-local.mjs` | YES |
| B | `tests/apple-backend/phase104-postgres-local.mjs` | YES |
| B | `tests/apple-backend/phase109-postgres-local.mjs` | YES |
| B | `tests/apple-backend/phase109-test-sql.mjs` | YES |
| B | `tests/apple-backend/phase112-production-provider-delta.json` | YES |
| B | `tests/apple-backend/phase112-provider-delta.json` | YES |
| B | `tests/apple-backend/phase72-ack-cryptokit.swift` | YES |
| B | `tests/apple-backend/phase72-ack-local.mjs` | YES |
| B | `tests/apple-backend/phase72-postgres-local.mjs` | YES |
| B | `tests/apple-backend/phase72-replay-local.mjs` | YES |
| B | `tests/apple-backend/phase72-rotation.test.mjs` | YES |
| B | `tests/apple-backend/phase73-postgres-local.mjs` | YES |
| B | `tests/apple-backend/phase73-readiness.test.mjs` | YES |
| B | `tests/apple-backend/phase73-replay-local.mjs` | YES |
| B | `tests/apple-backend/phase77-postgres-local.mjs` | YES |
| B | `tests/apple-backend/phase95-ack-vectors.mjs` | YES |
| B | `tests/apple-backend/phase95-provider-isolation.test.mjs` | YES |
| B | `tests/apple-backend/phase95-regression.md` | YES |
| B | `tests/apple-backend/post-sign-freshness.test.mjs` | YES |
| B | `tests/apple-backend/production-ack-native.mjs` | YES |
| B | `tests/apple-backend/production-ack-native.swift` | YES |
| B | `tests/apple-backend/production-ack.test.mjs` | YES |
| B | `tests/apple-backend/production-http.test.mjs` | YES |
| B | `tests/apple-backend/production-identity.test.mjs` | YES |
| B | `tests/apple-backend/production-postgres-local.mjs` | YES |
| B | `tests/apple-backend/recovery-failure-matrix.test.mjs` | YES |
| B | `tests/apple-backend/recovery-response.swift` | YES |
| B | `tests/apple-backend/recovery-response.test.mjs` | YES |
| B | `tests/apple-iap/phase35-hardening.test.mjs` | YES |
| B | `tests/apple-iap/phase49-boundary.test.mjs` | YES |
| B | `tests/apple-iap/production-packaging.test.mjs` | YES |
