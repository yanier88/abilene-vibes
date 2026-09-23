# Fase112 — local production integration closure

This document supersedes the earlier incomplete integration reports in this directory. No deployment, remote secret change, App Store Connect action, app installation, live StoreKit call, commit or push was performed.

## Implemented normal path

Supabase Auth JWT verification → advertiser profile / server-owned listing → P256 installation proof → independently verified AppTransaction → stable advertiser appAccountToken → one of the two confirmed slot01 products → durable purchase intent → StoreKit verified result → Edge Apple certificate/JWS/OCSP verification → commercial checks → atomic PostgreSQL claim, assignment, subscription and entitlement → ES256 ACK after commit → pinned CryptoKit verification → finish.

- Numeric app ID: 6811679667; bundle: com.abilenevibes.app.
- Group: 22382531, Promotion Slot 01.
- Featured: com.abilenevibes.app.promotion.slot01.featured.monthly, level 2.
- Premium: com.abilenevibes.app.promotion.slot01.premium.monthly, level 1.
- Both monthly; displayed prices come from StoreKit. App code does not set Apple's charge price.
- Server runtime selects Production; request input cannot select Sandbox. Sandbox/lab execution is separate and cannot grant public Production benefits. This is not a claim that App Review has approved this environment policy or the app.

## ACK trust

A single dedicated P256 pair was generated. Private storage and independent backup are under the user's Library/Application Support/AbilenePrivate directory, outside both repositories and temporary directories. Directory permissions 0700, private files 0600. No private bytes are documented here.

Public kid: `abilene-apple-iap-ack-prod-v1`.
Public SPKI SHA-256: `52c735eb291c00b7c633c3a1e9e5127136c30913f54c8e09d1b09d09bd3d894a`.

`production/trust.mjs` and `AppleACKTrust` pin the public material. Runtime checks private/public correspondence before serving commerce. Unknown kid, wrong key, changed bindings, future/expired ACK and tampered signatures reject. Rotation requires a reviewed application trust update before switching the server kid; no dynamic response-supplied root.

## Identity and durable recovery

The installation key is a device-local, per-authenticated-user P256 key in Keychain (WhenUnlockedThisDeviceOnly). It is not the ACK signing key. The backend validates Supabase JWT independently, challenges possession, verifies AppTransaction and checks authoritative advertiser_user_id. Listing IDs and legacy visitor keys are never authority. Requests have signed action/payload/nonce/timestamp; PostgreSQL atomically consumes each nonce. Revoked or other-user keys reject.

Pending purchase evidence stays in private Keychain. Recovery after a committed delivery and lost response re-verifies the same evidence, returns the same durable delivery and a fresh ACK, without another purchase. Native recovery validates ACK before finish. A crash after finish but before clearing Keychain can reconcile the stored evidence and clear it after a fresh valid ACK without issuing finish again.

A signed device report of `.userCancelled` can release only its empty Production reservation. It is labeled DEVICE_REPORTED_USER_CANCELLED, **not** cryptographic proof that Apple issued no transaction. Audit and canceled intent remain; completed/claimed attempts reject cancellation. Late evidence for a canceled intent cannot gain benefits. Unknown/pending/interrupted attempts are never automatically canceled, retried or converted into deliveries; they remain recoverable and fail closed if there is no verifiable transaction. New installation recovery does not silently transfer an old intent's installation binding.

## Lifecycle and public UI

V2 notifications verify the outer and nested signed payloads, OCSP, environment, app, product/group, lineage and token. Renewals update known assignments atomically; same-group upgrades can take effect immediately and downgrades wait for a signed renewal. Expiration/refund/revocation remove public benefits while retaining history. Duplicates are idempotent, altered replays reject, out-of-order conflicts quarantine. A verified TEST notification is recorded without commerce authority. Unknown assignment returns retry (HTTP 503), not an invented entitlement.

The public RPC returns only listing type/id, plan and expiration for approved active Production Apple entitlements. Android checkout and Stripe provider writes remain unchanged. The normal UI uses sign-in, owned listing selection, StoreKit prices, subscription, recovery, manage subscriptions and existing terms/privacy navigation. It receives no transaction evidence or ACK secrets.

## Validation

- Main shipping/model/crypto regression: **570 PASS, 0 FAIL, 0 SKIP**.
- Local isolated PostgreSQL: **29 PASS, 0 FAIL, 0 SKIP**. Fresh migration, representative upgrade, atomic failure rollback, privileges/RLS, ownership, nonce x10, delivery x10, cancellation x10, duplicate recovery, lifecycle and historical preservation.
- Native CryptoKit: **19 PASS, 0 FAIL** with ephemeral test keys.
- Total of those suites: **618** passing cases. Runtime/packaging probes are reported separately, not double-counted.
- Actual Edge v1.76.2 local worker: composition loads, invalid auth rejects, unverified notification rejects, missing production configuration fails closed. Prior same-runtime public Apple OCSP probes verified both exact pairs and rejected altered signatures.
- Web build/copy and App / Release build pass. No installation/launch/archive.

Cryptographic tests include authentic preserved Apple Sandbox evidence and synthetic negative fixtures. Production HTTP/domain/lifecycle tests use explicitly mocked already-verified facts; no new Apple Production transaction or live production E2E is claimed. The local PostgreSQL upgrade uses a representative schema, not a fetched copy of the remote database. Deployment preparation must compare remote migration state before changing it.

## Deployment preparation only

Read `apple-iap-production-readiness.md`. The remaining remote work is deliberately unexecuted. No external Node host is required by this implementation. Existing Supabase quotas still govern future usage; local work incurred no additional fixed hosting cost.
