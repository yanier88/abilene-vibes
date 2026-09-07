# Phase 30 — consolidation, 2026-09-07

## Product decision

Customers do not need an Abilene Vibes account. AdvertiserAccount UI is removed
locally and must not ship. More no longer exposes registration/login/My Listings.
Password recovery code exclusive to that component is removed with it.
Admin login and its verified allowlist are retained; ordinary Auth sessions do
not become Admin. Existing marked ownership and legacy compatibility remain.

`advertiser_profiles` is applied infrastructure, dormant for customers without
login, not an anonymous Apple identity table. Its triggers may still execute for
legitimate authenticated operations. Keep `advertiser_user_id`, guarded owner RPCs,
RLS, verifiedAdminSession, canManageListing, readWithIdentity and Edge ownership.

The remote recovery redirect
`https://yanier88.github.io/abilene-vibes/?page=advertiser&recovery=1`
is deliberately untouched. It can remain temporarily unused. Do not resume
registration tests or change Auth settings as part of this consolidation.

Apple IAP/StoreKit and anonymous Apple identity are NOT implemented. The six files
under `tests/apple-iap/` remain TEST/SYNTHETIC/LOCAL PROTOTYPE, disconnected from
the product. Android keeps Stripe and no mandatory customer login. Prices and
Price IDs have NOT changed; $24.99/$67.99 remain future product targets only.

## Migration — APPLIED MANUALLY TO PRODUCTION — NO RE-RUN

- File: `supabase/migrations/202609060001_advertiser_identity.sql`.
- Project ref: `ymgiwjuhgvfexitynmtb`.
- Application: 2026-09-06, Phase 26B, SQL Editor (prior phase record).
- SHA-256: `843fda06b9c21dfd3784cbf32f719cf4eac2f6cba4a4d70f5f168cdc9b37fb2c`.
- Hash verified locally again in Phase 30; SQL bytes are unchanged.

The file is local migration history; it is not proof of a remote CLI ledger entry.
Manual SQL Editor application does not automatically establish that entry. No CLI
executable is available in the current PATH, and no local linked-project metadata
was found. Phase 30 does not claim that it verified the live remote ledger.

Later, with separate authorization and a verified link to the exact project:
1. Read `supabase migration list --linked`.
2. Confirm the existing schema matches the applied migration, without replaying it.
3. ONLY if version 202609060001 is missing from the ledger, use
   `supabase migration repair 202609060001 --status applied --linked`.
4. Read `supabase migration list --linked` again.

Repair writes migration bookkeeping; it does not replay this migration's schema
SQL. It is still a remote write and is NOT authorized/executed in Phase 30.
Do not run db push, db reset, migration up or db pull to solve this blindly.
If the version is already registered, make no repair. Timestamp presence alone
does not establish content equality. Never place a database password in this doc.

Source: [Supabase migration history](https://supabase.com/docs/guides/deployment/database-migrations).

## Edge review

The pending index.ts diff introduces only resolveCheckoutOwner/verifiedOwnership
and CheckoutAuthError integration. Job/Rental owner markers are server-derived;
invalid sessions fail closed. The helper accepts exact configured public keys or
the existing project-specific public-key SHA-256 pin, not unverified JWT claims.
No change to prices, Price IDs, subscription mode, success/cancel URLs, webhook,
cancel-subscription, payment-return, or promotion financial behavior.
The pin requires review on a future public-key rotation; do not loosen it now.

## Verification scope

Retain the 10 frontend ownership/Admin tests, 7 Edge tests and 47 local Apple tests.
None of those 17 hardening tests imports AdvertiserAccount or requires its UI.
Run lint before the single authorized build, then sync iOS only on build success.
Supply public production build variables to that process only; do not create .env.
Build/sync verification is not a production Admin login or real payment test.

Completed locally in Phase 30:
- 64 tests passed: 10 frontend hardening, 7 Edge ownership, 47 Apple laboratory.
- ESLint passed after removing `isAdmin`, a derived boolean whose only consumer
  was the deleted component; Admin session authorization remains untouched.
- One `npm run build` succeeded; only the existing large-chunk warning remained.
- `npx cap sync ios` succeeded; only @capacitor/app 8.1.0 was detected.
- Compiled dist and its iOS copy contain no account UI/route/RPC call strings;
  Admin login and the production Supabase project identifier remain present.
- All dist files match their iOS copies byte for byte.
- Before/after SHA-256 comparison: Android (54 files), dist-admin (62), Supabase
  functions (7), Apple laboratory (6), public images/assets and src/assets unchanged.
- Native iOS files outside generated public resources, App.css, main.jsx, package
  files and migration unchanged. No .env created.
- More/account removal was checked structurally in source and compiled output;
  no new full simulator or authenticated Admin runtime test was performed.

Only existing source file changed this phase: App.jsx, 13 account-only lines removed.
The two untracked account component files were deleted; historical docs were
annotated and this consolidation record added. Generated dist/iOS asset hashes
changed as expected. No existing tests needed removal or modification.

Historical Phase 26/26B reports are preserved with superseding notices. Backend
RPC names and recovery URLs in those reports/SQL are intentional documentation
or dormant infrastructure, not public frontend routes.

No commit, push, SQL execution, deployment, native Android change or product IAP
integration is part of this phase. Future commit review must include the retained
hardening, applied migration record, consolidated documentation and local tests
as a coherent whole, without the removed account UI.
