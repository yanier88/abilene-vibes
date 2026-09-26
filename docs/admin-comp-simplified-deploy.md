# Admin COMP: simplified administrative deploy procedure

Deployment completed under separate authorization on 2026-09-26: migrations
250001/250002/250003 and the coordinated stripe-webhook v25 are active.
This document records the procedure; it does not authorize rerunning it.
No real COMP grant or Event was created.
It supersedes the verifier identity model and previous readiness statements.

## Trust boundary

The existing privileged administrative deploy operator verifies the exact Edge
artifact. There is no new PostgreSQL verifier role, login, membership, password,
broker, PGSERVICE or evidence registration table/function. No global PUBLIC or
shipping RPC privilege remediation belongs to this change. The historical PUBLIC
SECURITY DEFINER finding remains a separate future security audit.

250003 is an explicit separate administrative activation stage. PostgreSQL cannot
read or attest the remote Edge artifact: no SQL variable, user-supplied evidence
row or identity is presented as proof. An administrator who bypasses this
procedure can activate prematurely. That is the explicitly accepted procedural
trust boundary, not a database-enforced remote cryptographic assertion.

Application roles cannot alter protocol metadata or execute migration DDL.
250002 stores only postgres-owned, RLS-protected stage metadata: version, nonce,
installation time, expected project/function, installed coordinated definition
fingerprints and trigger wiring, and activation time. 250003 locks that metadata,
checks foundation tables, disabled COMP helpers/routes, common lock, Stripe
projection and Apple CAS definitions, compares all installed protocol function
fingerprints and commercial trigger definitions/enabled states, and rejects
repeat activation. MD5 here is catalog drift detection, not Edge attestation or
an adversarial signature. Full deployment artifacts use SHA-256.

250001 and 250002 leave COMP disabled. Edge deploy/download/hash/version failure
leaves it disabled because no script executes 250003. Activation and its metadata
update are one transaction; failure rolls back. COMMIT of 250003 alone enables
the Admin-only coordinated grant/revoke routes. No COMP grant/backfill occurs.

## Recorded deployment procedure (do not rerun applied migrations)

1. One fresh short Production read-only preflight: exact migration/schema drift,
   healthy project, backup availability, source hashes, current Stripe function
   identity/version, enabled events and administrative CLI access. Preserve the
   bounded segmented snapshot strategy in `admin-comp-deploy-safety.md`; take a
   fresh complete before snapshot at deployment. No reuse of an old snapshot as
   proof of current state. Record the current version before deploy.
2. Verify every file in `scripts/commercial-deploy/approved-candidate.json` against
   its SHA-256. Confirm the approved three-file Edge manifest. Stop on mismatch.
3. Apply ONLY 250001. Verify COMP disabled and zero grants/backfill.
4. Apply ONLY 250002. Verify the committed common protocol, disabled COMP, catalog
   fingerprints, trigger wiring and protocol installed_at. The one-time DDL fence
   and NOWAIT provider guards remain unchanged. Lock/statement timeout is STOP,
   not a blind retry. Do not run a bulk `db push` containing 250003. Use separately
   reviewed single-file migration execution/history recording for each stage.
5. Deploy ONLY the approved stripe-webhook candidate. Preserve UUID, JWT/import-map
   config, endpoint, secrets and event selection. Capture the exact new version;
   require it to be newer than the fresh preflight version (and >24). No test event.
6. Immediately check the live artifact using the exact new version and committed
   protocol installed_at as --deployed-after. The CLI path must be absolute and
   point to the reviewed installed Supabase executable. Example shape:

   ```sh
   COMMERCIAL_SUPABASE_EXECUTABLE=/absolute/path/to/supabase node scripts/commercial-deploy/check-edge.mjs --verify-remote --expected-version NEW_VERSION --deployed-after PROTOCOL_INSTALLED_AT_UTC
   ```

   This checker performs list → `functions download --use-api` → list in a fresh
   private directory. It verifies the exact project argument, function slug/UUID,
   expected version, ACTIVE status, unchanged metadata, JWT/import-map settings,
   deployment time, index.ts/authority.mjs/pricing.mjs SHA-256 and complete expected
   source manifest hash. All metadata is fetched through authenticated admin CLI;
   no supplied remote source path or evidence JSON is accepted. The API-reported
   bundle digest is recorded as reported, not independently recomputed. CLI errors
   are captured and reported only as STOP, without credential-bearing output.
7. Require `REMOTE EDGE VERIFICATION PASS`. Preserve the private local metadata-only
   manifest. Any failure: STOP, COMP disabled. The checker has NO SQL, migration,
   deploy or activation command. It cannot automatically activate. Serialize this
   administrative operation: no concurrent Edge replacement; if interrupted or
   another deployment occurs after PASS, repeat read-only verification before
   activation. Do not assume the before/after check prevents a later admin change.
8. The operator explicitly runs ONLY 250003 as a separate stage after PASS. No
   fake GUC, DB evidence insertion or verifier credential. Verify activation time,
   coordinated Admin-only routes, ACL/RLS/sequence protections, no grants or Events.
9. Fresh segmented after snapshot and targeted schema/history/Edge checks; compare
   approved changes only. Legitimate traffic can change data fingerprints: explain
   differences with read-only investigation, never auto-correct customer rows.
   Reconcile legacy v24 delivery/projection errors read-only as documented.

Successful deploy budget: three separately applied migrations, one Edge deploy,
one protocol metadata insert and one activation timestamp update, migration
history records; zero verifier roles/memberships/evidence writes, zero COMP grants,
zero Events, zero payment/StoreKit actions, zero secrets changes. Before activation,
STOP preserves disabled COMP. After committed activation, unexpected postchecks
require separately authorized forward disable/repair; never erase audit/history
or silently reinstall old provider writers. Keep the verified backup as recovery
anchor; do not promise automatic rollback of a committed deployment.

## Preservation and scope

Common listing ordering, Apple/Stripe transition guards, provider priority,
payment isolation, ownership, three-slot Events, Featured denial/Premium allowance,
legacy-label non-authority, RLS and sequence ACLs remain unchanged. No source/UI,
Edge code or deployed migration change in this simplification. No Production query
or mutation, COMP grant or real Event occurred. For you Darling retains the prior
observation (approved ownership, no authoritative Premium, Event denied); no fresh
Production assertion is made.

The frontend publication includes the approved Claims category/count, Premium
Events account/selector UX, RPC-backed COMP controls and fresh authorized reloads
after successful Claims/Events moderation. Failures retain the visible queue and
a safe error; manual Refresh remains available. No full dashboard redesign or
notifications are included. The PUBLIC privilege audit remains separate work.

## Final local validation

- JavaScript: 861 PASS / 0 FAIL / 0 SKIP.
- Networkless disposable PostgreSQL: 234 PASS / 0 FAIL / 0 SKIP.
- Combined distinct regression: **1095 PASS / 0 FAIL / 0 SKIP**.
- Includes 21 deployment/activation/snapshot cases and 34 administrative artifact/tooling cases. These subsets are already counted above.
- App/Edge source, deployed migrations and 12/12 F hashes preserved.
- No builds required: consumed source unchanged. No install.
- git diff --check PASS; staged NONE; no commit/push or Production operation.

### Final candidate SHA-256

- `supabase/functions/create-checkout-session/pricing.mjs`: `633cd5837a35cdad43bc717201fde2eff5d089b26f31a5723bc9d6465d982153`
- `supabase/functions/stripe-webhook/authority.mjs`: `8f1b1e9102448982bffc5c5336f160c24061f769c7de05e3641f50c52a9a6035`
- `supabase/functions/stripe-webhook/index.ts`: `3ae8080d872ff607efbcb04e0c787fe69da1b57103ce9f9d1d11a9c10ef66da6`
- `supabase/migrations/202609250001_admin_comp_authority.sql`: `86b804b89d0398df8e7691224fbc2460f67e035ae5e0dc7d4443ca147a32107b`
- `supabase/migrations/202609250002_commercial_listing_protocol.sql`: `8566b6a7e07bf8857990de77af78aa35b348a29ae9e282194484c63a213af712`
- `supabase/migrations/202609250003_admin_comp_protocol_activation.sql`: `47847aa19c277e8c99906e8a61c9f429eb952b474f43e60ee0a05961e5050f29`

The local validation above records the backend candidate before frontend closure.
Frontend closure adds 12 moderation/refresh tests. Publication requires a fresh
full regression, normal shared/Admin/iOS builds, exact allowlist review and
separate commit/push authorization. No private evidence belongs in this repository.
