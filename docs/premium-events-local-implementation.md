# Premium Events — local implementation

No Production mutation, purchase, phone installation, commit or push is part of this work.

## Audit and authority

The existing `event_submissions` table had admin-only creation (`approved`), edit/delete,
hide/restore, public approved reads, and client date pruning in America/Chicago. It had
no business binding, pending business queue, entitlement gate or quota. The shared App
renders both platforms; the existing Admin loader already included Events.

Stripe's old webhook writes listing display fields from checkout completion, checkout
expiration, paid/succeeded invoices, failed invoices and subscription deletion. They
remain for compatibility, but are **not authority for the new Events benefit**.
They do not encode ordering, and a late invoice can overwrite `canceled` with `paid`.
No Production occurrence is asserted.

The webhook now also handles subscription created/updated/deleted, obtains the current
subscription by authenticated GET, checks environment, server metadata binding and
recurring price against the existing catalog/configuration, and writes a service-only
snapshot. No prices or checkout calls changed. A failure returns 503 so Stripe can retry.
Unknown/incomplete subscription metadata is not guessed; deployment needs readiness
checks for existing subscriptions. Existing projection writes are not transactional
with the new authority: retries are safe for the authority and retain legacy behavior.

SQL serializes by subscription, receipts deduplicate event IDs, older event.created
cannot overwrite newer state, and conflicting snapshots in the same second deny access.
Event IDs are not treated as a sortable sequence. A canceled subscription ID is terminal;
a different real subscription must establish a new valid listing binding. A newer
verified active state may recover from past_due, but never resurrect a canceled ID.

Only `active`, unambiguous, Production Premium with a future authorized end permits
Events. `cancel_at_period_end` does not remove access early. The end is capped by
period end, scheduled cancel_at and ended_at when supplied. Trials, paused collection,
unpaid/past_due and unknown prices fail closed. No benefit period is fabricated with
oneMonthAfter. Historical rows are not backfilled as active.

Sources: [Stripe webhook ordering/duplicates](https://docs.stripe.com/webhooks),
[Stripe cancellation semantics](https://docs.stripe.com/billing/subscriptions/cancel).
As with any webhook projection, decisions reflect verified provider state received;
this is not a guarantee that an undelivered provider event is already known locally.

## Events

Two forward migrations add the Stripe authority and extend the existing Events table.
The gate requires authenticated `advertiser_user_id`, an approved business, and either
matching Stripe authority or the existing Apple Production public projection. Stripe
binding takes precedence even when ineligible; Apple cannot bypass it. Legacy device
owner strings never establish event ownership. Comp listings do not receive this paid
benefit. No Apple code, migration, ACK, notification or checkout code changed.

New business submissions use a service-definer RPC, fixed `pending`, immutable binding,
server-checked fields/dates and an owner-scoped UUID key with payload consistency hash.
The hash is an idempotency check, not authentication. Retry of the same submission returns
its original ID even if eligibility subsequently expires. Different payloads with that
key are rejected. An advisory transaction lock per business serializes the quota and
admin changes that could reoccupy capacity. Pending and approved, unended records count;
rejected, hidden (the existing cancellation state), deleted and ended records do not.
The same three slots apply across providers.

The normal Events screen uses one component on Android/iPhone, showing backend eligibility,
a shared event-fields form, safe errors, login, submission and owner cancellation. The
promotion-plans button only navigates the existing route; no payment starts automatically.
A failed submission retains its key for safe retry. Date/time inputs use Abilene time.

Pending Events join both existing Admin load paths; authorized administrators approve or
reject, while existing direct administrative creation/edit/hide/delete remain available.
No notification transport was added. Pending/approved/rejected transitions can feed a
future notification design. Approval checks captured eligibility and event validity;
subsequent Premium expiration does not remove an approved event or authorize new events.
Public RLS now checks approved and end time, independent of current Premium.

## Before any Production authorization

1. Read-only schema/history preflight; verify actual policies and grants match prerequisites.
2. Audit existing approved event dates/times: malformed end times fail closed under the new
   public policy. Do not deploy blindly or rewrite historical events automatically.
3. Verify Stripe subscription metadata, listing bindings and enabled event types, price
   configuration and historical reconciliation procedure. No existing row is auto-entitled.
4. Apply the authority migration before updating the webhook; reconcile verified historical
   snapshots with an explicitly authorized process. Then apply Events migration and UI.
5. No rollout is authorized by this document. Test the shared UI on devices before release.

## Reproducible local validation

Disposable container only: `abilene-premium-events-local`, image `postgres:17-bookworm`,
network `none`, no host ports. `node tests/premium-events/run-local.mjs` recreates only its
`premium_events_test` database. It applies the two new migrations and the unchanged real
Apple projection against minimal baseline tables/RLS/auth fixtures. These tests exercise
real PostgreSQL locks/RLS, not an in-memory quota model. They are not a full Production
schema rehearsal. Webhook tests use mocked HTTP and never contact Stripe/Supabase.

- `node --test tests/premium-events/stripe.test.mjs tests/premium-events/ui.test.mjs`
- `node --experimental-strip-types --test tests/premium-events/webhook.test.mjs`
- `node tests/premium-events/run-local.mjs`
- Existing Admin session, advertiser identity, checkout ownership, Android pricing and
  Apple normal-package tests are also run.

Android native build requires Java/Android SDK, absent on this Mac. iOS uses normal App /
Release, no StoreKit configuration or harness; no installation is performed.

## Local ownership and grants closure (2026-09-24)

Additional forward migrations, in order (001 and 002 remain byte-for-byte unchanged):

1. `202609240001_stripe_premium_authority.sql`
2. `202609240002_premium_events.sql`
3. `202609240003_business_ownership_claims.sql`
4. `202609240004_event_grants_hardening.sql`

The shared advertiser account panel uses existing Supabase Auth (sign-up, sign-in,
validated restoration, sign-out) and `ensure_advertiser_profile`. Public navigation
requires no account. Business submission captures its form before async validation,
then validates the user and profile before inserting. The database trigger independently
rejects anonymous new Business inserts, sets authenticated ownership from `auth.uid()`,
and preserves the existing trusted service-role path. No existing row is backfilled.
A client-supplied owner cannot override the authenticated identity. Approval preserves
that binding. Legacy editing capabilities are unchanged; legacy identity grants no
Premium Event benefit.

An authenticated advertiser can request a claim on an approved, unbound business.
The request establishes only a pending record. Duplicate pending requests from the same
advertiser return the existing claim; different advertisers may submit competing claims.
Admin sees Pending Business Claims in the existing Businesses tab, loaded by the same
initial/Refresh loader. Approval requires `is_service_admin`, a pending claim, an existing
profile, a still-unbound locked business and a review note. Admin must independently
verify authority; matching email, contact information or a visitor key is insufficient.
Rejection preserves the request and leaves ownership unchanged.

Ownership changes require a protected audit row in the same database transaction,
matching the old owner, new owner, business and authenticated administrator. The audit
is inaccessible for client writes, including authenticated Admin. No client-set GUC
permits bypassing the guard. A separate Admin-only transfer RPC requires the expected
current owner, existing new profile and a reason; stale owners and silent overwrites
fail. Claim decisions and ownership changes remain durable. Account creation alone
never claims an existing business. The four observed comp Premium businesses remain
comp and receive no paid Events entitlement merely because they are comp.

The local baseline reproduces observed event/business grants, including TRUNCATE,
REFERENCES, TRIGGER and PostgreSQL 17 MAINTAIN. Event hardening revokes all table and
column grants, then restores only SELECT to anon/authenticated with existing RLS.
No direct Event write is granted even to authenticated Admin; create/edit/hide/restore/
delete use `admin_write_event`, and moderation uses the existing checked RPC. No service
Event table privilege is required by these contracts. Dangerous non-RLS Business table
privileges are also removed from clients. Claim/audit tables have no client direct DML.

### Local verification and boundaries

- Disposable PostgreSQL 17 container: network `none`, no host binds or published ports.
- Exact four-migration sequence exercised on empty and populated baselines, including
  transactional rollback. Synthetic baseline: 19 unbound businesses, 11 legacy owner
  strings, 8 null legacy owners, four approved comp Premium, four rejected Premium,
  and two ended approved events. Initial migration application preserves all original
  business values and original event columns; no Production PII is copied.
- Authority/Event tests: 41 passing; ownership/grants/rehearsal: 32 passing. Includes
  x1/x2/x10 event concurrency, same-key deduplication, x2/x10 claims and competing
  approvals, expected-owner transfers, role privileges and client negative matrix.
- Relevant shared/Admin/native/packaging unit tests: 244 passing. Apple backend and
  notification regression: 486 passing using the existing private authentic fixture.
  Stripe webhook HTTP mocks: 3 passing. Total: 806 passing, zero failures/skips.
- Auth SDK tests are local controlled mocks; no real account was registered, no real
  credentials were entered and no remote Auth configuration is asserted verified.
- Weather browser evidence was regenerated from current source: 12/12 cases passed.
  Historical Android/Stripe preservation pins remain unchanged; a separately pinned
  two-file reviewed delta covers App.jsx and the authorized Stripe webhook addition.
- Shared web, Admin and normal iOS App Release builds passed. No installation or purchase.
  Android build was not executed because Java/SDK are unavailable.

Transactional rollback is verified before commit. After a future Production commit,
do not restore broad grants or drop claims/audit records to roll back application UI;
retain security and history, stop the rollout, and use a reviewed forward repair.
Future preflight must revalidate schema drift and remote Auth/email settings, and inspect
Stripe endpoint subscriptions. Required Stripe events remain the seven listed in
`authority.mjs`; no remote Stripe configuration was changed or verified in this work.
Do not deploy UI before its RPC/migration dependencies are available. No Production
write, remote deployment, stage, commit, push or StoreKit action occurred.

## Jobs webhook reconciliation (local only)

Production v23 downloaded during the read-only preflight is the behavioral baseline.
Git commit `6c92c833765d904c675cf65059b8219617963d64` (2026-08-21) removed
`status: "hidden"` from the Job subscription-deleted patch. This predates Premium
Events. The terminal patch is restored: exactly `payment_status: "canceled"` and
`status: "hidden"`. All legacy handlers from checkout completion to the end of the
file now match the downloaded Production source byte-for-byte.

The additive authority path also consumes the RPC decision for Jobs: ignored stale
snapshots cannot proceed into legacy lifecycle writes. Nonterminal events cannot revive
a canceled subscription, ambiguous same-timestamp state cannot authorize paid projection,
and paid projection requires canonical active state. Duplicate terminal notifications
can reapply the same idempotent hide patch. Scheduled cancellation while active does not
hide. Job routing and resolved listing identity must match canonical subscription metadata;
mismatch returns 503 before a Job patch. The authority module and four migrations are
unchanged. Existing nonterminal payment-failure behavior remains `failed`, without hiding.

Tests: ten real-handler tests with mocked transports plus a PostgreSQL Job-binding/
terminal-state test. Full final regression: 817 PASS / 0 FAIL / 0 SKIP (244 shared/native/
Admin tests, 486 Apple backend tests, 13 webhook tests, 74 PostgreSQL tests). An existing
OCSP concurrent-completion/eviction assertion failed during parallel execution; the entire
Apple suite passed sequentially without modifying crypto code or assertions. No new
application build is required: no shared/Admin/native inputs changed. No remote reads,
login, writes, deployments, purchases, stage, commit or push in this reconciliation.
The seven Stripe endpoint event settings still require a separately authorized read-only
audit after the user signs into Stripe Dashboard manually.
