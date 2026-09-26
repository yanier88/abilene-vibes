# Admin COMP authority — local implementation, not deployed

> Current protocol and deployment order: [Common listing protocol](admin-comp-common-lock.md).
> The table-lock candidate described below is historical and superseded; do not deploy it.
> COMP activation now requires 250001 → 250002 → verified coordinated Edge → 250003.

## Existing production architecture (read-only audit)

Business COMP grant and clear used direct `business_submissions` updates. RLS permits authenticated administrators via `is_service_admin()` or `is_business_admin()`; both inspected helpers use the same `admin_users` membership check. Grant wrote plan, approved status, not_required payment, comp source and browser-computed expiry. There was no dedicated COMP grant RPC, actor/start timestamp or durable COMP audit. Public benefit display consumes those legacy fields; Premium Events deliberately accepts only paid authority.

Observed aggregates: 4 Premium COMP labels unexpired; 4 Featured COMP labels, 3 unexpired. All 8 have expiration values. Zero `listing_promotion_entitlements` rows with provider comp. These labels do not establish who granted them or historical provenance. No backfill is permitted.

## New local model

`admin_comp_authority` stores one active grant per Business with source admin_comp, plan, starts_at/expires_at, granted_by/granted_at, status and revocation actor/time. `admin_comp_audit` appends grant, supersede, revoke and explicit legacy_clear actions. Legacy_clear records only today's authorized removal; it never fabricates a past grant.

Only authenticated `is_service_admin()` can invoke grant/revoke. Table writes are unavailable to anon, advertiser and service_role through ordinary API grants. SECURITY DEFINER functions use fixed search_path and lock the Business row, matching event submission locking. Grants use a caller-generated idempotency UUID: exact replay returns the same grant without extending or resurrecting it; conflicting parameters fail. Revoke targets an exact grant ID; stale revocation cannot remove a replacement.

Admin grant/revoke controls use these RPCs locally. The grant also updates existing commercial display fields atomically, preserving Featured/Premium display benefits and expiry. No ownership assignment is performed. Paid-provider bindings block a COMP grant rather than silently changing providers. Jobs and Rentals are unchanged; this authority is for Businesses/Premium Events.

The existing server Premium Events gate adds active, started, unexpired Premium COMP as a separate source after paid-provider checks. Owner, approved Business and 3 simultaneous active/pending slots remain mandatory. Featured COMP is never Premium. Existing approved events retain their previous lifetime after revocation. Frontend accepts admin_comp only from the existing owner-scoped options RPC.

## Production preflight / future test — NOT AUTHORIZED NOW

Review migration against current schema, constraints, RLS, provider bindings and legacy rows; rehearse on a disposable schema. Apply only after explicit deployment authorization. Deploy migration before the corresponding frontend/Admin, then verify read-only.

For you Darling: owner reports ownership APPROVED. Preserve its current no-authority → PREMIUM FEATURE result until a separately authorized Admin grant. After controlled deployment and authorization: grant one finite Premium COMP, owner reads options, submit one Event pending, authorized Admin reviews, verify public projection and slot enforcement. No step executed during this local task. No automatic cleanup; future revoke/cancel actions require authorization and retain audit history.

Admin dashboard/sidebar redesign remains deferred. Existing local Claims accessibility work is preserved, not deployed.

## Payment-isolation security closure (local only)

The undeployed `202609250001_admin_comp_authority.sql` is corrected in place;
its purpose and migration identity are unchanged. Previous SHA-256
`0f74c65eaeaa830f2932823c1430cdaf40d7bf78bbe5d60e4a96a6c5e7c1aabf`
is superseded before any deployment by
`9bfe95b2e437c4cbfff502728120152a95f5da7d1d74219aaff9e94d76a6e39b`.
No Production migration, COMP grant, Event, provider request or deployment
was performed during this closure.

### One conservative payment-conflict predicate

`admin_comp_payment_conflict(uuid)` is internal (no client/backend EXECUTE).
It reads actual underlying sources, without using public projection absence:

- Business Stripe subscription/session/payment-intent/customer references,
  `paid_at`, and ambiguous payment/source labels. Only `not_required` with a
  known `paid` or `comp` source can qualify for a new COMP grant.
- `payment_records.business_submission_id`, `stripe_promotion_authority`,
  and `stripe_authority_receipts.snapshot.listing_id` (case-normalized UUID
  text; malformed JSON identifiers are not cast or treated as authority).
- Apple listing authorizations, purchase intents, subscription assignments,
  slot occupancies, expired purchases and non-COMP listing entitlements.
  Subscription/transaction/delivery linkage runs through those intents,
  assignments and slots; there is no invented subscription listing column.

There are no status, environment, closed-at or expiration filters in the
binding scans. Historical, terminal, undelivered and transitional evidence
blocks COMP too. `checkout_started` and `cancel_pending` are Business payment
states, not invented Apple intent states. An expired/revoked Apple listing
**authorization alone** deliberately blocks automatic COMP. Historical binding
resolution requires a separate future design/authorization, not deletion or
fallback to public projection absence.

Grant denies before authority/audit/commercial writes. Same-key replay only
returns the previous identity; it cannot extend or resurrect a grant.
Legacy clear denies atomically on any conflict. Revoke always revokes the exact
COMP grant and writes its audit, but leaves **every Business field intact** if
there is a current conflict, even when the display source still says `comp`.
Paid-provider positive Event policy is retained; the final COMP fallback now
also checks this predicate, so a later provider binding cannot inherit COMP
Event eligibility. An existing approved Event is not removed.

### Concurrency and deployment implications

`admin_comp_lock_payment_sources()` requires authenticated admin identity and
READ COMMITTED, and obtains SHARE ROW EXCLUSIVE locks on Business and all
binding-source tables before locking/reading the Business. Existing Apple and
Stripe writers do not share a listing advisory lock; a Business row lock alone
cannot prevent an authority INSERT phantom. The table locks therefore serialize
COMP mutations and block concurrent provider writes until commit. After waiting,
the next statement sees committed provider data. Repeatable-read/serializable
snapshots are deliberately rejected instead of risking a stale absence result.

This is intentionally conservative for low-volume administrative mutations.
**Tradeoff:** unrelated provider/Business writes can wait briefly, including
Jobs/Rentals writes to shared authority tables. Existing reverse lock ordering
can produce a PostgreSQL deadlock; one transaction aborts safely. No retries or
bypass are added. Future Production preflight must assess contention, transaction
timeouts and the deployment role. This is not an assertion of zero latency
impact or a throughput benchmark. No existing payment writer is replaced.

### Ownership, RLS and identity sequence

New tables and all new helper/RPC functions are explicitly owned by postgres.
The identity sequence follows the audit table owner. Table privileges are
revoked from PUBLIC/anon/authenticated/service_role, with authenticated SELECT
restored behind admin-only RLS. Sequence USAGE/SELECT/UPDATE are explicitly
revoked from all those roles, including service_role. The postgres-owned
SECURITY DEFINER RPC supplies the required audit insertion; an Admin client
never needs sequence access. The internal detector cannot disclose binding
existence through a direct client RPC. Fixed search_path and schema-qualified
relations are used; no dynamic SQL is introduced in these functions.

### Reproducible local verification

`node tests/premium-events/run-local.mjs` checks the exact disposable Docker
container/image, no network and no bind mounts, then recreates only test DBs.
The additional `comp-isolation.test.mjs` applies all deployed Apple migrations
from the repository, real payment_records DDL, Stripe/Premium Events/Claims
migrations, and synthetic identity/Business fixtures. This is equivalence of
relevant schema/constraints/policies/ACLs, **not a Production data clone**.
It rehearses an empty baseline and a 19-Business upgrade with legacy labels,
owner markers, Stripe and Apple bindings, transactional rollback, both observed
creator default-ACL variants, exact sequence rights, grant/revoke x10, races,
and observed blocking via pg_locks. No constraint is disabled for a test.
The existing positive suite covers Premium slots 0–2, slot 3 denial, expiration,
revocation, owner checks, Featured denial and approved-Event preservation.

The broad regression initially found the expected old App.jsx preservation
hash. The reviewed delta is restricted to existing local COMP RPC integration,
Premium Events UX entry and Claims presentation. `admin-comp-provider-delta.json`
pins those exact bytes and chains to the previous approved hash; the other 64
protected paths remain unchanged. This is not a blanket exclusion of App.jsx.
A second preliminary failure was the local HTTP listener's sandbox permission;
it was rerun with local listening authorized. Neither required a Production or
payment-code change.

For you Darling retains the prior read-only audit's approved ownership and
legacy label, without authoritative Premium or Event eligibility. No live read
or mutation was needed here. Pending Admin redesign remains outside this work.

Local logs and build outputs are under
`/private/tmp/admin-comp-security-closure/` and are not repository artifacts.

A final repeat also exposed a preexisting nondeterministic OCSP test: it assumed
parallel verification completion followed request order. The test now releases
and awaits entry 0 before the remaining 31; it still checks pending capacity 32,
rejection of request 33, cache size 32 and eviction of the proven oldest entry.
Only test synchronization changed; crypto/cache implementation was preserved.

### Final local results

- PostgreSQL: 160 PASS / 0 FAIL / 0 SKIP (13 authority, 29 Events,
  35 ownership/security, 29 COMP, 54 isolation/rehearsal/concurrency).
- JavaScript/browser-source regression: 820 PASS / 0 FAIL / 0 SKIP,
  including 12 freshly observed weather layout cases.
- Combined: **980 PASS / 0 FAIL / 0 SKIP** in final runs.
- Shared, Admin and normal iOS Release builds: PASS. No installation.
  Android not run: local JDK and Android SDK absent; none installed.
- Twelve excluded F hashes unchanged. Existing UI hashes unchanged by this
  operation. Git diff check PASS; index empty; no commit/push.
- Closure modifies only this document, the undeployed COMP migration,
  comp-db/comp-isolation/run-local tests, the pinned App.jsx test delta/loader,
  and the OCSP test synchronization. No application UI or payment code changed
  during this closure.
- Local ready for a newly authorized Production read-only preflight. No deploy
  authorization is inferred from these results.
