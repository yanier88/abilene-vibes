# Phase 36 — local Apple backend implementation, NOT DEPLOYED

Base: `0e50e01ff9916345915678728f6ecbe131efb741`. The migration is **NOT APPLIED**, including locally. No Supabase, Stripe, Apple or financial remote action was performed. Nothing connects this backend to the client. Existing Stripe functions, listing helpers, UI, native bridge, packages and Android are untouched. No build/sync is required.

## Audit and identity

The existing migration `202609060001_advertiser_identity.sql` authenticates recoverable advertisers through auth.users and advertiser_profiles; it stays unchanged. Legacy owner_user_id is not sufficient Apple authorization. Business/Job/Rental use business_submissions/job_listings/rental_listings. Stripe's existing webhook writes payment_status and placement fields on those rows. Existing App.jsx helpers derive displayed plans from those fields, moderation and dates. This implementation does not call or modify them.

Apple identity is separate: server UUID buyer, stable server-generated app_account_token, unique verified app_transaction_id per bundle/environment. No auth.users dependency. A trusted installation-verifier port is required before establishing a technical session; the shipped Edge composition has none. Tokens are 256-bit random, only SHA-256 hashes persisted, with expiry/revocation and installation binding. Grants in apple_listing_authorizations must come from future authenticated listing creation/recovery. There is NO API to claim an existing listing with a client owner_id or buyer_id. AppTransaction alone is not an installation authenticator. No client login requirement is introduced.

## Files and execution boundaries

`supabase/functions/_shared/apple/` contains the reusable domain, backend orchestrator, SQL RPC repository port, Apple verifier adapter, notification/reconciliation processor and pure projection preview. `.mjs` modules execute under Node tests and can be imported by Deno TypeScript entry points. No installation or new package dependency is needed for local fixtures.

Three new entry points: apple-prepare-purchase, apple-verify-purchase, apple-notifications. All return 503 APPLE_BACKEND_NOT_CONFIGURED by default. They do not read secrets, connect to a database, or enable themselves from a request/environment test flag. A server composition change is needed after future review. supabase/config.toml is untouched; deployment/JWT gateway decisions are deferred. Tests inject local dependencies directly into handler/backend factories; no fixture module is imported by Edge code.

## Migration and persistence

One additive BEGIN/COMMIT migration creates 15 tables:

- apple_buyers
- apple_installations
- apple_session_capabilities
- apple_challenges (schema only; App Attest challenge issuance/consumption is deferred)
- apple_product_catalog
- apple_listing_authorizations
- apple_purchase_intents
- apple_slot_occupancies
- apple_subscriptions
- apple_subscription_assignments
- apple_transactions
- apple_notification_events
- listing_promotion_entitlements
- apple_deliveries
- apple_ledger_revision

Catalog: 20 candidate IDs in each environment namespace (40 rows), disabled, group IDs null. No prices are financial authority, no remote products exist by implication. Enabling products requires later reviewed actual groups; fixture groups live only in tests.

All tables use RLS with no anon/authenticated privileges/policies. Privileged RPC execute is revoked from PUBLIC, anon and authenticated. Service role remains backend-only. SECURITY DEFINER functions use pg_catalog/public search_path, fixed relation allowlists and quoted identifiers. No client-selected SQL identifiers. Environment constraints reject Xcode. The mutation RPC explicitly accepts only Sandbox and Apple entitlements; Production cannot be enabled by a request flag. Environment and chain/listing bindings have immutable triggers.

The low-volume prepared repository uses a single revision mutex and optimistic compare-and-swap: snapshot reads normalized rows; a successful CAS upserts the fixed table list in one SQL transaction and advances the revision. A conflicting version retries domain computation without external side effects. Reservations are serialized across all Sandbox buyers; delivery, transaction, subscription, assignment, entitlement and intent completion commit together before signing. No JSON duplicate ledger or per-table HTTP write sequence is used. No history is deleted by CAS. This deliberately favors correctness/reviewability over scale; it needs PostgreSQL integration/load tests and later scoped transactions before production. Direct service-role writes outside this protocol must not run concurrently.

SQL reads existing listings only, returning id/type/status and a conservative Stripe conflict flag; it never copies business contact data into the snapshot. Current Stripe subscription, pending/paid state or paid placement blocks preparing Apple. The snapshot is not a cross-provider distributed lock: simultaneous real Stripe/Apple purchases must remain disabled until a shared conflict protocol exists. These limitations are why activation is not wired.

## Intent and delivery

prepare accepts only listing_type, listing_id, requested_plan, idempotency_key plus bearer technical capability. It resolves buyer, validates grant/listing/moderation and conflict, derives the first unused slot/product, reserves atomically, and returns intent/token/product/expiry. No Apple call occurs. Matching idempotency keys return the same intent; changed payloads fail. Slot 11 fails. Slots are never automatically released, including after timeout. A separate internal markPurchasing operation records start before purchase; there is no client endpoint for it yet. Expired uncertain attempts become reconciliation.

verify requires authentic capability, strict input, an injected Apple verifier and signer. It checks bundle/environment, IDs as strings, buyer token/AppTransaction, product/group, dates, ownership, revocation, upgrade and started intent. It rejects arbitrary verified:true. The exact transaction replay returns the existing delivery, never extends time or changes listing. Known-chain/new-intent ambiguity is reconciliation. V1 does not implement chain reassignment or indefinite slot reuse. Recovery of late pending purchases/known-chain resumes is conservative and requires later reconciliation, not guessed delivery.

Delivery acknowledgements are built only after repository commit. Claims follow the phase35 contract, including capability ID, binding fields, installation key, nonce, delivery ID/status and 300-second lifetime. The test signer uses ephemeral nonextractable WebCrypto ECDSA P-256 keys and an explicitly different TEST-ONLY envelope, issuer and typ. It never fabricates ProductionDeliveryConfirmation. A production asymmetric signer, pinned native verifier, authenticated request-nonce/challenge binding, persistent replay protocol and delivery recovery remain unconfigured. The native verifier has not changed and rejects these confirmations.

## Apple verification/runtime

The official Node library source currently reports 3.1.0; its README lists Node 16+. It uses Node X509Certificate/KeyObject, certificate chain checks, OCSP and dependencies including jsonwebtoken/jsrsasign/node-fetch. Supabase supports npm/Node APIs, but that alone does not certify this library in the deployed Edge runtime. Neither Deno nor PostgreSQL is installed in this environment. No dependency was installed to pretend compatibility.

The adapter delegates transaction, AppTransaction, outer notification and inner transaction/renewal signature verification to an injected official SignedDataVerifier; it does not implement certificate/JWS crypto. Default verifier fails closed. Root certificates, exact bundle/environment configuration and online checks must be server controlled. A .p8 API key is distinct from the public roots needed to verify JWS. Future strategy: validate the official pinned package in a dedicated Node service or prove the exact Deno runtime compatible first, then connect through an authenticated server boundary. No fallback to decoded JSON is allowed. This adapter's compatibility is reviewed from APIs, not certified by real signed payload execution.

Primary sources consulted:
- https://github.com/apple/app-store-server-library-node
- https://github.com/apple/app-store-server-library-node/blob/main/package.json
- https://github.com/apple/app-store-server-library-node/blob/main/jws_verification.ts
- https://supabase.com/docs/guides/functions/dependencies
- https://supabase.com/blog/edge-functions-node-npm

## Notifications/reconciliation/projection

Only verifier-produced facts reach the event ledger. The endpoint does not accept arbitrary JSON as authority. UUID+environment and payload hash provide idempotency; a mismatching duplicate is rejected. Unknown assignments are retry, unsupported/mismatched facts quarantined. Notification-before-client-verify remains unassigned until durable binding exists. Reconciliation retries held events in signed-date order, but does not claim signedDate solves all Apple history: out-of-order/conflicting evidence stays quarantined and requires Server API. Refund/revoke cannot be silently undone by later renewal; noncurrent terminal events block for reconciliation. Signed renewal periods are copied, never plus-30-days. Renewals create distinct transaction/delivery rows but update the existing subscription entitlement.

The notification ledger retains sanitized verified facts plus SHA-256, not raw JWS. This is not a substitute for future private evidence retention/Server API retrieval. No logger prints evidence. All notification facts are backend-only.

The pure resolveEffectivePromotion preview respects moderation, Premium > Featured > Free, chooses one validity period without summing, does not let inferior comp downgrade paid, reports overlapping paid providers and filters environment. It is not connected to App.jsx or any database listing write. Hidden/deleted listings are never recreated. Sandbox entitlements have no public activation path.

## Validation limits / Phase 37

Node tests exercise the actual backend modules with a versioned in-memory CAS repository, real WebCrypto TEST signatures, deterministic verifier registry and injected crashes/concurrency. This does NOT prove PostgreSQL locks/RLS, persistence after process/host loss, Deno execution, Apple signatures/OCSP, App Attest or real purchases. SQL checks are static only. All these are prerequisites for any deployment, not implied by passing fixtures.

Executed validation: 51 new backend cases plus 87 existing Node cases = 138 passed; 26 unchanged Swift security checks passed (164 distinct checks overall). ESLint passed for all new .mjs modules/tests. Node syntax checks passed for the three TypeScript entry points; these are not Deno runtime checks. No web/native/Android build, sync, SQL execution, dependency installation, commit or push occurred.

Phase 37 should first validate the NOT APPLIED migration/RPCs in an isolated local PostgreSQL instance, including cross-process CAS, rollback, environment FKs, RLS/service-role privileges and concurrent listing changes; then validate the official verifier runtime against official signed test vectors. Do not apply production SQL, deploy, enable catalog entries or wire client purchases until that review plus installation/listing authority and signing protocols are complete. Sandbox/device terminal finish remains a separate later authorization. No further local finish experiment is proposed.
