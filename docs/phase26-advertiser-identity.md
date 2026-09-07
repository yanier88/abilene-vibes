# Phase 26 — historical implementation record

> SUPERSEDED FOR PRODUCT DECISIONS by `phase30-consolidation.md` (2026-09-07).
> AdvertiserAccount UI has been removed locally and will not ship. Customers do
> not need an Abilene Vibes account. Admin/ownership hardening is retained.
> The migration was APPLIED MANUALLY TO PRODUCTION in Phase 26B on 2026-09-06.
> Project ref: ymgiwjuhgvfexitynmtb. NO RE-RUN.
> Text below records the original Phase 26 state, not current deployment commands.

> Historical Phase 26 report. The production audit, migration application,
> ownership-only Edge deployment and remaining acceptance gaps from Phase 26B
> are recorded in `phase26b-production-validation.md`. That report supersedes
> the deployment/paid-ownership/redirect status below; do not rerun the migration.

## Historical deployment gate (not current instructions)

Do not deploy the new account UI before reviewing/applying the SQL on an isolated Supabase project and completing the acceptance matrix below. The migration has NOT been executed against production. There is no local PostgreSQL/Supabase runtime installed for SQL integration tests.

Migration: `supabase/migrations/202609060001_advertiser_identity.sql`.
It is a one-time transaction, not an idempotent bootstrap. Check the deployed table definitions, grants, policy names and all six owner RPC signatures/bodies against the local scripts before applying it. Missing policy names cause rollback. Reconcile drift instead of rerunning old schema scripts. Do not apply migrations with the historical SQL scripts afterward, as those may replace guarded functions.

## Identity

The main client now persists Supabase sessions. `authSession` is independent of `adminSession`, which is assigned only after `is_service_admin()` returns boolean true. Existing admin data policies remain authoritative; registering never inserts into admin_users. Logout removes the Supabase session, not the legacy visitor key.

More → Advertiser account offers registration, login, logout and password recovery. `ensure_advertiser_profile()` creates a UUID token on the database using auth.uid(), not parameters. Both the account screen and insert trigger call it. No claim is implemented. Existing users get profiles when they open this screen or insert a listing; there is no blanket historical backfill.

Email confirmation follows the existing Supabase setting. No SMTP/auth setting was changed. Verify that confirmation is enabled before any future payment launch. Password recovery and account deletion policy must be reviewed before App Store release; this phase does not add deletion or IAP.

## Ownership

The additive `advertiser_user_id` column is a server-set marker, distinct from legacy TEXT owner_user_id. Authenticated direct inserts into Business/Job/Rental are forced to the JWT user. The trigger prevents changing the marker or authenticated ownership. The six owner RPCs guard marked rows using auth.uid() before the original business logic. Unmarked legacy rows keep the existing comparison temporarily; this is NOT a repair of historical ID-based access.

The public UI treats only a matching marker as authenticated ownership. Matching visitorKey remains legacy/device access; the account screen labels those rows as candidates and only queries publicly readable records. It does not expose other users' pending rows. UUID-shaped old owner IDs are not automatically promoted to authenticated ownership.

### Deliberate boundary: paid Job/Rental insertion

The protected `create-checkout-session` function creates paid Jobs/Rentals with service role and client-supplied ownership, without validating the end user. This phase does not change that function, checkout calls, or prices. The trigger intentionally does NOT infer authenticated ownership for these service-created rows. They therefore do not appear as verified owned listings. Signing in can make such rows use a user UUID as legacy owner; that UUID is NOT sufficient evidence for recovery. This limitation must be resolved in a separately authorized payment boundary review. Do not advertise full ownership recovery for paid Jobs/Rentals yet.

Business inserts already originate in the user client, before Stripe checkout, and receive the marker when authenticated. Stripe's subsequent payment updates preserve it.

## Policies

Expand only named, audited public read policies to authenticated: Business, Jobs, Gallery, hidden static records, likes, reviews, news and Marketplace. Rentals/Events already allow authenticated reads in local SQL. Preserve public predicates. Extend existing anonymous insert predicates for Jobs/likes/tracking and required table grants so login does not remove ordinary public interactions. No authenticated general moderation policy is introduced.

Profiles: self-read only, no client write; service role has access. Owner markers have self-read policies to recover pending/hidden authenticated listings; no client update policy is added. Admin uses existing allowlist. `advertiser_my_listings()` returns only the JWT owner's marked Business/Job/Rental rows.

## Recovery configuration required

Web redirects use the current web origin/path with `?page=advertiser`; recovery adds `&recovery=1`. Native requests point to:

- https://yanier88.github.io/abilene-vibes/?page=advertiser
- https://yanier88.github.io/abilene-vibes/?page=advertiser&recovery=1

Add the exact deployed destinations to Supabase Auth Redirect URLs, review Site URL and email templates, and deploy the new web account page only with authorization. None was done here. The current deployed website may not yet implement this route. Native recovery deliberately finishes in the browser, followed by password login on iPhone. There is no new custom scheme/universal link/appUrlOpen. Do not claim automatic return to the native app. A recovery URL alone is not authentication: updateUser requires a valid session. Supabase handles the emailed token; no custom token parsing/logging was added.

## Automated checks

`node --test tests/advertiser-identity.test.mjs` covers frontend ownership classification, legacy survival, authorization fail-closed, Admin allowlist response and schema fallback. These are unit tests, NOT RLS/database/browser integration tests.

`node_modules/.bin/eslint src/App.jsx src/auth/*.js src/auth/*.jsx` checks changed JS/JSX.

## Required isolated acceptance tests (not yet executed)

Use an isolated Supabase project with matching schema, two normal confirmed test users A/B, one allowlisted Admin and one legacy fixture per type. Never use real customer records.

1. Before migration, snapshot approved reads and legacy edits. Apply migration once; check no historical row receives advertiser_user_id.
2. Anon reads remain identical; login A sees the same public content and only A's private rows.
3. Register/login A; ensure profile twice; assert one token unchanged. Attempt UPDATE/INSERT/DELETE profile as authenticated and anon: denied. Service role can access.
4. Direct inserts of each type with owner_user_id=B and advertiser_user_id=B while JWT=A must store A in both fields. Financial/status insert predicates still apply.
5. Call each of the six RPCs as B and anon with A's correct owner_id: denied for marked rows. As A with correct request: allowed for appropriate editorial state. Update the marker: denied.
6. Legacy owner RPCs retain their prior behavior with device key; login/logout preserves localStorage key. Candidate listings are never claimed.
7. Verify Admin login, refresh and all existing moderation reads; A cannot gain Admin through page URL, session, profile or request metadata.
8. Reset email on web and iPhone, set password in browser, login from second phone, recover same profile/marked listings. Expired/invalid reset links must not authorize a password change.
9. Paid Jobs/Rentals remain a documented unverified-ownership exception; do not use this phase as payment ownership signoff.
10. Compare Stripe endpoints, prices, promotion helpers, Home/Lobby, Safe Area and native Android against HEAD. No Android sync.

No commit, push, native build or Xcode required in this phase. Source build is authorized once; sync only iOS after success.
