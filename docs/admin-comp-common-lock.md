# Common commercial listing protocol — local candidate only

No Production access or mutation, deployment, COMP grant, Event, purchase, commit or push was performed. All database evidence comes from synthetic databases inside `abilene-premium-events-local` (`postgres:17-bookworm`, network `none`, no host bind mounts). The previous global-table COMP candidate is superseded.

## Identity and permission boundary

`lock_commercial_listings(jsonb, boolean)` locks the **actual listing PK row** with `FOR UPDATE`. Identity is `(listing_type, UUID)` in business_submissions, job_listings or rental_listings. There is no UUID truncation, hashing collision, email, subscription or plan in the common identity. Locks last until transaction end; no early unlock API exists. The entire distinct set is sorted by listing_type then native UUID before acquisition. READ COMMITTED is required. Internal helpers have fixed `pg_catalog,public,pg_temp` search_path, postgres ownership and no PUBLIC/anon/authenticated/service_role EXECUTE. No new client authority is exposed.

Canonical RPCs are one operation per transaction. Arbitrary privileged SQL transactions that combine unrelated RPCs in reverse order are outside this contract; the deliberate deadlock-victim test proves atomic rollback for such misuse, not permission to use it.

## Wait-order graph

- `L(sorted listing rows) → Stripe subscription advisory → Stripe authority row → receipt`.
- `L(sorted listing rows) → Apple revision → Apple rows / FK checks`.
- `L(Business) → COMP authority → audit / same Business projection`.
- `L(sorted Businesses) → webhook Business projection`.
- Legacy single-listing checkout/cancel REST UPDATE already owns the same Business row. Its field scope is unchanged.
- Legacy payment_records UPSERT: BEFORE INSERT takes Business lock before payment conflict-row lookup. Direct UPDATE uses NOWAIT and rejects Business rebinding.
- Defensive provider/receipt row triggers take listing locks with NOWAIT: an unsupported direct writer or old in-flight function cannot wait in reverse order.
- Defensive Apple guards take revision with NOWAIT before the older terminal-history trigger can wait for it. Canonical functions already own revision; direct/old ordering aborts atomically on contention.
- Ownership claims keep Business → claim row; Events keep their existing per-Business slot advisory → Event row. COMP/provider RPCs do not wait on that Event advisory.

There is no waiting cycle in the coordinated RPC graph: listing acquisition precedes provider locks; repeated listing/revision locks are reentrant; defensive reverse accesses cannot wait. The existing Apple revision remains globally serial: this work does **not** partition the ledger or promise concurrent Apple CAS commits.

The Sandbox administrative `apple_release_never_started` retains its historical evidence-table SHARE ROW EXCLUSIVE fence after listing and revision. It is not a COMP lock and is not a Production commercial path. Its checks, proof, terminal history and constraints are preserved. Direct Apple writers now fail NOWAIT at revision rather than retaining a relation lock while waiting backward. No new global runtime COMP lock is introduced; the later deployment-safety closure adds a one-time DDL transition fence. Rare historical Sandbox reconciliation can still briefly contend with shared evidence tables; the ordinary COMP/Stripe/Apple commercial races use per-listing locks.

## Apple integration and semantic preservation

Forward replacements cover Sandbox and Production CAS, bootstrap completion, existing-permission renewal, NEVER_STARTED release and cancelled purchase. No deployed historical migration file changes.

CAS computes typed changed rows, resolves every affected listing (including subscription assignments, delivery/transaction assignment links and prior reusable slot bindings), locks the sorted set, then obtains revision and performs the original compare-and-swap. A stale revision returns false without writes. Unchanged rows from a whole-ledger snapshot are not written/locked. Comparison follows the real snapshot precision: ordinary timestamps in milliseconds, authorization/capability timestamps with preserved microseconds. A regression holds existing listing A while a full snapshot changes B; B completes.

Original validation, environment separation, provider restrictions, immutable bindings, idempotence, receipt/transaction/delivery/ACK data and revision increment remain. No cryptographic, HTTP verifier, notification domain, price, native purchase or finish code changed.

## Stripe writer inventory

- record_stripe_authority: common listing lock before the existing subscription advisory; original duplicate, old-event, same-second ambiguity, terminal and immutable-binding decisions retained.
- stripe-webhook: signed handler/canonical Stripe GET/price checks unchanged. Business projections now use `stripe_patch_business`; subscription-wide matches lock sorted UUIDs and recheck the binding after waiting. Only the existing payment fields are allowlisted. It cannot change plan, owner or moderation. Payment-record/projection failure is no longer silently acknowledged.
- payment_records: existing UPSERT path coordinated by SQL guard; no financial amounts changed.
- create-checkout-session/cancel-subscription: existing one-Business PATCH obtains canonical Business row implicitly; no code changes or provider cancellation semantics changed.
- Jobs/Rentals webhook branches remain byte-for-byte unchanged; their authority RPC uses their own canonical listing PK. Jobs terminal hiding tests and SQL authority tests pass.
- Stripe receipts also have a defensive common-lock guard, including historical rows with no authority object.

## COMP / paid transitions

Grant checks all existing provider bindings after the lock; current, transient, historical and ambiguous evidence still denies COMP. Revoke and legacy_clear use the same lock. Idempotent replay never revives a revoked or paid-superseded grant. Historical revocation/audit remains.

A valid current Production paid entitlement/authority supersedes active COMP atomically: status `superseded_paid`, system `paid_priority` audit with provider and no fabricated admin actor. The original admin grant remains. Only a COMP display projection changes to the actual paid Featured/Premium plan and provider expiration. Paid subscriptions/payments are never cancelled or rewritten. A pending binding already makes the COMP Event fallback ineffective; it is not invented paid authority. Stripe still needs its normal payment-status handoff for Event access.

Apple↔Stripe same-listing conflicts fail closed as `PAID_PROVIDER_RECONCILIATION_REQUIRED`; no arbitrary winner overwrites another paid authority, and no cancellation is issued. Failure preserves the committed provider and leaves the other transaction unapplied. This is not a cross-provider migration feature.

## Future deployment boundary — superseded locally

Use [deployment safety closure](admin-comp-deploy-safety.md) for the current
transition fence, separate administrative activation stage, segmented
snapshots and exact deploy order. The old session-GUC attestation is removed.
No Production action is authorized by these documents.

## Prior common-lock validation (before deployment-safety closure)

- Full JavaScript regression: 826 PASS / 0 FAIL / 0 SKIP (includes six coordinated signed-webhook transport cases).
- PostgreSQL regression: 211 PASS / 0 FAIL / 0 SKIP (13 authority + 29 Events + 35 security + 29 COMP + 49 isolation/deployment + 56 common protocol). Real deployed Apple baseline plus the forward functions, not replacement mocks.
- Combined relevant regression: 1,037 PASS / 0 FAIL / 0 SKIP.
- Common-protocol suite: 56 cases, including 20 simultaneous provider/COMP interleavings, both directions of grant/revoke/legacy_clear, all Featured/Premium transitions, two cross-provider barriers, multi-listing ordering, legacy writes, stale CAS, unrelated-listing progress, timeout, cancellation, paid-transition rollback and x10 idempotence.
- Same-listing blocking observed via pg_blocking_pids before releasing the barrier. No business-logic retry loops or sleep-based race assumptions.
- One deadlock is intentionally forced with inverted external transactions; victim authority/audit roll back. Zero unexpected coordinated-protocol deadlocks.
- Shared and Admin builds PASS; normal iOS Release build PASS; no install. Android SDK/JDK unavailable, not installed.
- For you Darling unchanged: prior observed ownership APPROVED, Premium authority NO, Event DENIED. No new Production read or write in this task.
- Existing UI, 12 F, cryptographic/material files and all deployed migration files preserved.

Admin redesign is out of scope: dashboard/sidebar mockup, standalone Ownership Claims, badges/counts and mutation refresh remain separate work.

## Previous candidate SHA-256 (superseded by deployment-safety closure)

- `supabase/migrations/202609250001_admin_comp_authority.sql`: `86b804b89d0398df8e7691224fbc2460f67e035ae5e0dc7d4443ca147a32107b`
- `supabase/migrations/202609250002_commercial_listing_protocol.sql`: `9e8fc57dc486ec3da1ae56f70c8817749df02685b1808c1dc45e8edeb1720290`
- `supabase/migrations/202609250003_admin_comp_protocol_activation.sql`: `eb7e685afae62c63b76d22ee5cfd566e6ef387356d087e3c531be30507282b98`
- `supabase/functions/stripe-webhook/index.ts`: `3ae8080d872ff607efbcb04e0c787fe69da1b57103ce9f9d1d11a9c10ef66da6`

Current deploy trust/checklist: [admin-comp-simplified-deploy.md](admin-comp-simplified-deploy.md). No verifier login, broker, membership or SQL evidence registration is required.
