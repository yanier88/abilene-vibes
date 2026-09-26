# Admin COMP deployment safety: transition and snapshot reference

Current trust model and deployment checklist: [admin-comp-simplified-deploy.md](admin-comp-simplified-deploy.md). The former verifier identity/evidence architecture is removed from the approved implementation.

## Actual old-writer transition

PostgreSQL replacement is not cancellation of an executing function. The local
PG17 harness preserves the actual old CAS/record_stripe_authority bodies and
adds advisory barriers solely to pause them. It proves both old invocations
already accessing relations and old compiled invocations paused before their
first relation access.

250002 first acquires ACCESS EXCLUSIVE on the revision and then the relevant
listing/provider tables. Existing conflicting transactions must complete before
the transaction can install the replacement functions/triggers. All changes
become visible together at COMMIT. Lock timeout is 5 seconds; statement timeout
is 30 seconds. Contention aborts the migration atomically; no sleep, quiet-window
assumption, automatic cancellation of customers or blind retry is involved.
This is a one-time deployment fence, not a global runtime COMP lock. It can
briefly block reads/writes. If a deployment deadlock occurs, PostgreSQL aborts a
participant; timeout/deadlock is a stop and inspect condition, not success.

A dormant compiled old function can resume AFTER that COMMIT. The fence alone
is consequently insufficient. Actual writes then pass the newly installed
listing/provider/ledger guards. Old Apple and Stripe dormant invocations were
resumed while another transaction held their listing: both failed atomically,
with no authority/intent escaping. A fresh Stripe call started while DDL held
the fence completed only after commit using the new protocol.

New Apple RPCs take the listing first and acquire revision NOWAIT. The two CAS
functions convert lock_not_available to false (existing CAS conflict contract);
other RPCs fail atomically. This removes a new-listing -> waiting-revision edge
that could cycle against old bootstrap revision -> listing FOR SHARE. Direct
and old writes use listing/ledger NOWAIT guards. Existing environment, financial
binding, history, expiry and entitlement constraints remain enforced.

Lock compatibility/transaction lifetime reference:
[PostgreSQL 17 explicit locking](https://www.postgresql.org/docs/17/explicit-locking.html).
Replacement identity/privileges reference:
[PostgreSQL 17 CREATE FUNCTION](https://www.postgresql.org/docs/17/sql-createfunction.html).
The executing-old-body finding is demonstrated by the local harness, not inferred
from the phrase CREATE OR REPLACE alone.

## Intermediate Edge/DB states

- Old v24 + new DB: tested the exact old source pinned to SHA-256
  `3363964718be632769eac56c2366815f5fd671aa127bd4fb41c9868a0c5c6b0d`,
  using synthetic signed events and real disposable PG. Authority goes through
  the replacement RPC; old direct Business PATCH still has row locking/guards.
  COMP remains disabled. Existing payment-record guards cover legacy writes.
- New Edge + old DB: avoid this order. A projection route encountering absent
  stripe_patch_business (404) throws, so it does not acknowledge webhook success.
  Authority-only routes still use the existing RPC contract. Earlier committed
  writes in a multi-request webhook are not rolled back by an HTTP error;
  receipt/idempotency semantics handle a later authorized retry. No claim of
  distributed transaction atomicity is made.
- During Edge replacement an old invocation may finish: DB guards protect its
  writes. The v24 projection path did not check every response; DB rejection may
  therefore lose a projection update. It cannot create paid or COMP authority
  outside the guards. Future read-only delivery/error/projection reconciliation
  is mandatory; do not falsely describe v24 as having the new retry behavior.

## Segmented read-only snapshot procedure

`scripts/commercial-deploy/snapshot-plan.mjs` generates queries only. It neither
connects to Production nor writes a snapshot. Future orchestration must follow
this procedure; do not paste a huge cross-table aggregate again.

1. Discover actual tables and primary-key columns from catalog, one group at a
   time. Groups: commercial (Businesses/Jobs/Rentals/Marketplace/Gallery/Events),
   Stripe (payments/authority/receipts), Apple (all relevant apple_* ledger tables
   plus entitlements), ownership/claims/COMP, and migration/schema objects.
   Missing optional pre-foundation COMP objects are recorded as ABSENT, not zero.
2. Each SELECT runs in its own READ ONLY transaction: statement_timeout 8s,
   lock_timeout 1s, UTC. Schema/ACL/policy/trigger signatures are separate per
   table; function definitions and migration history are separate bounded
   catalog batches. No raw rows, PII, credentials or signed evidence are output.
3. Read <=1,000 rows via the native primary-key index in key order; composite
   keys are supported. Hash each canonical jsonb row inside PostgreSQL, then
   hash the ordered fixed-length hashes for that page. Only count/page digest
   and a private cursor return to the orchestrator. The cursor is memory-only:
   never include it or raw row data in a log/report/manifest.
4. Sum page counts; combine ordered page counts/hashes into a final SHA-256 in
   the orchestrator. Persist table/group name, page ordinal, count/hash, schema
   signature, start/end observation time and coverage status. Same server/jsonb
   canonicalization and same page size are required for comparison.
5. On timeout roll back that read; reduce page size (1000 ->100 ->10 ->1).
   Stop and report incomplete coverage if one row still exceeds the bound.
   A table without a usable immutable non-null unique/primary key requires its
   own reviewed strategy. Metadata/estimated count can be recorded explicitly
   as METADATA_ONLY but cannot replace a required content fingerprint or yield
   full snapshot PASS. No giant exact count(*) fallback is required: completed
   keyset coverage supplies the exact observed count.
6. Repeat the same bounded catalog/data capture after deploy. Expect only the
   reviewed new schema/functions/ACLs, migration history, one protocol row and
   one explicit activation metadata update. Existing commercial row writes,
   COMP grants and Events caused by deploy must remain zero.
7. With concurrent legitimate traffic these independent snapshots are
   observational, NOT one transactionally consistent global snapshot. Inserts,
   updates or deletes during pagination can change coverage or hashes. Any
   mismatch requires a targeted read-only comparison/audit; never blame the
   deploy or certify preservation solely from a changed digest. If proof of
   preservation cannot be completed, STOP. A verified physical backup remains
   the separate recovery anchor; do not hold a long global snapshot transaction
   merely to force this audit to look consistent.

Local test covers real SQL pagination, count equality, deterministic page hash,
schema hash, limit and identifier rejection. Production timing and full table
coverage remain to be measured during the separately authorized preflight.
