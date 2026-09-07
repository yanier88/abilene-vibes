# Phase 26B — production validation, not closed

> Current product decision (Phase 30, 2026-09-07): no customer account UI will ship.
> Registration/password-recovery acceptance work below is historical, not a task
> to resume. Keep applied security protections. See `phase30-consolidation.md`.
> APPLIED MANUALLY TO PRODUCTION — 2026-09-06, Phase 26B.
> Project ref: ymgiwjuhgvfexitynmtb. NO RE-RUN.

Project: Abilene Vibes / abilene-vibes / main PRODUCTION,
`ymgiwjuhgvfexitynmtb`. Safari Computer Use worked after permissions were granted.

## Audit before writes

Inspected real columns, constraints, RLS, grants, six owner RPCs, eight Jobs/Rentals
Admin RPCs and four Admin allowlist helpers. Profiles and identity markers did not
exist. Existing owners are TEXT; listing IDs are UUID. RLS was already enabled.
All six owner bodies and eight Admin bodies matched local historical SQL after
whitespace normalization. Existing business Admin policies remain unchanged.

Production Jobs insert policy is `Allow public pending job inserts`, not the
prepared `Allow public free job inserts`. Corrected only the new migration's
policy name; preserved actual predicate. Rentals placement_source permits null,
`stripe`, `comp`. No payment_status check constraint was found in these tables.
Existing broad TRIGGER/TRUNCATE/REFERENCES grants were not changed or exercised.

## Applied SQL

Applied exactly `supabase/migrations/202609060001_advertiser_identity.sql` once
through SQL Editor, as one BEGIN/COMMIT transaction. Result: Success, no rows
returned. SHA256:
`843fda06b9c21dfd3784cbf32f719cf4eac2f6cba4a4d70f5f168cdc9b37fb2c`.
No historical scripts or backfill were executed. Manual SQL Editor execution
does not register this migration automatically in the CLI migration ledger.
Do not apply it again.

Verified profiles PK/FK/UNIQUE, server UUID default, RLS/self SELECT only;
three nullable marker FKs, three owner policies, three insert/update triggers,
and six guarded owner RPCs. No historical ownership was rewritten.

## Edge ownership only

Downloaded original production source; index.ts matched HEAD byte for byte.
Added `ownership.ts` and integrated it at request verification and sanitized
Job/Rental insertion. User tokens are verified by GET /auth/v1/user. The verified
ID replaces both owner fields; a supplied marker is never trusted. Public/legacy
requests retain the old owner string. Invalid sessions fail closed. verify_jwt
remains false, verified in dashboard.

Initial deployment exposed a real compatibility issue: the frontend public key
differs from the injected Edge anon key. A deliberately invalid request returned
401 instead of the expected validation 400. Verified the existing frontend key
with a public PostgREST read (HTTP 200), then pinned its exact SHA256 for this
project in the helper. No key value is stored or reported; no unverified claims
or token prefixes are accepted. A future frontend key rotation requires reviewing
this exact compatibility pin. Deployed the helper correction and downloaded
the final source: both files match local bytes.

Final live HTTP tests, no listing insert or Stripe call possible:
- Known frontend public bearer + deliberately invalid rental request: HTTP 400,
  `Invalid paid rental plan request.` (expected).
- Forged session bearer + same invalid request: HTTP 401,
  `Invalid or expired session.` (expected).

No change to prices, Price IDs, subscription mode, return URLs, Stripe metadata,
webhook, payment amounts or activation/expiration logic.

## Real database tests

SQL transactions used temporary fixture users without passwords/login, temporary
tables and fixture listings, SET LOCAL role/claims, and ROLLBACK. These are real
database/RLS tests, not proof of actual Auth signup/login or signed user JWTs.

Nine checks passed: server ownership overrides forged owner; generated profile
token and no Admin; token update denied; B cannot read A pending profile/listing;
B cannot mutate A with known owner; A cannot mutate B; A can manage own fixture;
anonymous cannot mutate marked rows; anonymous listing reads succeed.
Mutating RPC checks exercised Business hide, Job hide and Rental delete on fixtures.
The other guarded update RPCs were audited, not individually exercised here.

Second transaction verified service-role Job/Rental markers + profile creation,
rejection of mismatching verified owner and marker, and anonymous legacy Business
owner compatibility with injected marker stripped. No Stripe session was created.

Cleanup query confirmed zero phase26b test users/businesses/jobs/rentals and zero
remaining profiles. All fixtures were rolled back, not committed then deleted.

Public read counts matched for anon/authenticated: Businesses 11, Jobs 1,
Rentals 0, Marketplace 2. Marketplace anon direct table SELECT is denied by its
existing grants; the app's actual `list_marketplace_listings('')` read RPC succeeds
for both roles. No grant was changed to bypass that restriction.

## Password recovery

Site URL remains `http://localhost:3000`. There were no Redirect URLs.
Added only the authorized exact recovery URL and verified total URLs = 1:
`https://yanier88.github.io/abilene-vibes/?page=advertiser&recovery=1`.
No Site URL/email/SMTP/provider changes. The signup return URL without recovery
and deployed web account route remain to be reviewed. This is not an end-to-end
email recovery test or a deployment of the account UI to the public website.

## Pending acceptance

Do not declare Phase 26B closed: actual temporary-account signup/login and email
recovery, signed-user-JWT Edge integration, full six-RPC A/B matrix and Admin UI
login/four-section checks still require completion. Successful paid Job/Rental
requests create real Checkout sessions; none were executed merely for ownership.
Do not use owner personal credentials or call Stripe for a gratuitous test.

No shared frontend or native code was changed in Phase 26B. Prior Phase 26 source
changes are retained. Final local test/build results are reported separately.

## Final checks in this continuation

- 17 tests passed (10 existing frontend identity tests + 7 Edge ownership tests).
- ESLint passed for changed JS/JSX and both test files; Babel emitted only its
  existing large-source formatting note. TypeScript helper is exercised by Node
  strip-types tests; full Edge deployment compiled successfully in Supabase.
- git diff --check passed.
- One npm run build succeeded with the existing production public configuration
  supplied only to that process. No .env created. Vite warned about >500 kB chunks.
- Build snapshots confirm android/, ios/, src/ and dist-admin/ unchanged by build.
- No cap sync: no shared source changed in this continuation.
- Public Admin opened in Safari and showed Sign in / EMAIL / PASSWORD / OPEN ADMIN.
  Stopped for human login; four authenticated sections were not inspected here.
  User should log in directly in Safari, never send credentials in chat.
- Three source-only ZIPs downloaded through Supabase UI remain outside the repo
  in Downloads; no environment secrets were downloaded or displayed.
- No commit, push, native build, IAP/StoreKit work or financial Stripe action.
