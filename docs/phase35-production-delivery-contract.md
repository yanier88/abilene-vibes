# Phase 35 — contract proposed for Phase 36, not implemented

## Trust boundary

The existing bridge remains fail-closed for production delivery. The new declaration in `src/native/productionDeliveryContract.d.ts` is documentation/type-only and is NOT accepted as finish authority. The current `UnconfiguredDeliveryVerifier` still returns false. No endpoint, database change, App Store Connect product, App Attest entitlement or secret is provisioned here.

Future production delivery must use an asymmetric backend signature, not a client-held symmetric key and not TEST HMAC. Proposed wire envelope: `{ kind: "abilene.apple.delivery.v1", signed_jws: "<compact JWS>" }`. Header: `typ=abilene.apple.delivery+jwt`, `alg=ES256`, `kid` from a pinned/controlled public-key allowlist. No `none`, HS algorithms, untrusted `jku/x5u`, or dynamically trusted keys from the response. Private keys remain server-side. Exact issuer `abilene-apple-delivery`; audience/bundle `com.abilenevibes.app`; schema_version 1. The typed claims list is exhaustive for version 1.

The native verifier must independently compare transactionId, originalTransactionId, productId, appAccountToken and environment against verified StoreKit evidence. It must bind buyer/capability, purchase intent, listing type/id, installation key and request nonce against the initiating, authenticated request — never a new caller-supplied association accompanying finish. IDs remain strings (no JS numeric conversion). The backend derives these associations from its authorized intent/ledger; client fields are not ownership authority. appAccountToken is a purchase correlation UUID, not authentication. Accountless buyers still require a server-authenticated capability; no client account/login system is added here.

Proposed time policy: integer Unix seconds, issued_at == iat, exp > iat, lifetime <= 300 seconds, maximum 30 seconds clock skew. jti and request_nonce are random, unique, transaction/delivery-bound and tracked by the backend. Expired/unknown/mismatched claims fail closed and require authenticated reconciliation, never a TEST receipt fallback. Delivery status must be delivered or already_delivered, backed by a durable atomic delivery record. A bare delivered=true or a client-decoded payload never authorizes finish.

## Future sequence

1. Obtain server challenge and prove the installation; authenticate the accountless buyer capability.
2. Authorize the listing and create/read the immutable purchase intent with server-assigned appAccountToken and expected product/group.
3. Obtain verified StoreKit evidence. Send JWS + intent ID in an authenticated, attested, nonce-bound request. Do not log JWS/capabilities.
4. Backend verifies Apple signature, chain and claims using the official library/API, exact bundle, environment, product, transaction chain, token and intent ownership. Remote product/catalog verification is a separate prerequisite; local matching strings prove nothing about App Store Connect.
5. Apply durable, idempotent delivery and the intended listing association atomically. Replay cannot reassign a listing, extend placement twice or allocate another slot. Return a signed delivery confirmation only after commit.
6. Native verifies the backend confirmation and its stored request binding. Consume nonce atomically, then call the single explicit finish route. A crash between consumption and finish requires authenticated reissue/reconciliation of the SAME committed delivery, not duplicate delivery. Do not treat a client finish acknowledgement as proof of commercial delivery.
7. Notifications/revocations, expiry, renewal and slot reuse remain distinct future backend workflows. No promotional duration is inferred simply from finish or a missing unfinished transaction.

Production and Sandbox will require separate explicit environment policies and credentials; neither is enabled here. Production endpoints must reject Xcode evidence, TEST domains, local receipts and local signing material. No downgrade/fallback to Stripe on verification failure.

## App Attest insertion points (not implemented)

- Challenge: server-generated one-time challenge with TTL, purpose, request digest and intended buyer capability binding.
- Installation attestation: generate native key, attest to challenge; backend validates Apple attestation, expected app identifier/environment and stores verified public key/installation record. App Attest is not buyer identity.
- Per-request assertion: hash challenge plus canonical method/path/body, intent and capability ID; native generates assertion. Backend validates signature, challenge freshness and increasing counter, rejecting replay.
- Capability binding: issue/use buyer capability only under the approved installation proof and server policy. Reinstallation/device recovery must be designed separately; no locally invented UUID becomes production ownership.
- If attestation is unsupported, invalid, unavailable or recovery is unresolved: production purchase authorization remains blocked. Do not invent a bypass for simulators.

Apple's guidance describes one-time challenges and assertion validation with counters: [Validating apps that connect to your server](https://developer.apple.com/documentation/devicecheck/validating-apps-that-connect-to-your-server), [Establishing your app’s integrity](https://developer.apple.com/documentation/devicecheck/establishing-your-app-s-integrity). Purchase correlation is described in [appAccountToken](https://developer.apple.com/documentation/appstoreserverapi/appaccounttoken); server signature verification is described in [Dive into App Store server APIs for In-App Purchase](https://developer.apple.com/videos/play/wwdc2025/249/).

## Local product identifiers

The preserved local catalog has 10 groups / 20 candidate identifiers. The screen's allowlist remains three. Their strings can coincide with future real product IDs: the strings alone cannot distinguish local/remote. The local scheme, compiled/runtime gates, marker and verified Xcode environment provide the separation. No assertion is made about remote product existence because App Store Connect was not queried or modified.
