# Apple IAP — deployment preparation after local closure

See [local code and evidence](phase112-final-integration-status.md). Stay within Fase112. This is a checklist for a separately authorized deployment; no command below was executed remotely.

## Server configuration

Configure only in Supabase's server-side secret store:

- `APPLE_ACK_PRIVATE_PKCS8_BASE64`: base64 encoding of the dedicated private PKCS8 DER file. Read it securely from local private storage; never paste it into chat, a repository, a shell argument/history or frontend environment variable.
- `APPLE_ACK_KID`: `abilene-apple-iap-ack-prod-v1`.
- `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`: existing server-provided project configuration. The runtime requires HTTPS, checks public/private ACK correspondence and independently validates caller JWTs.

Private original: `~/Library/Application Support/AbilenePrivate/APPLE_IAP_PRODUCTION_ACK_V1/private.pkcs8.der`.
Private backup: same parent, `APPLE_IAP_PRODUCTION_ACK_V1_BACKUP`.
Recovery instructions and public hash metadata are stored alongside the private key. Do not regenerate the pair during deployment.

Only the public Supabase anonymous/publishable credential belongs in the web bundle. No service-role or ACK private key belongs there.

## Migration order and permissions

First inspect the remote applied migration list and back up the remote database in a separately authorized operation. Never run all local laboratory commands against production.

Dependencies: existing base listing schemas and `202609060001_advertiser_identity.sql`, then `202609080001_apple_iap_ledger.sql`; apply the Apple 202609160001–0005 and 202609200001–0003 compatibility migrations and `202609210001_apple_never_started_release.sql` if not already applied. Their Sandbox history is preserved.

New production integration order:

1. `202609210002_apple_production_composition.sql` — Production RPCs, bootstrap, installation proof tables, scopes and privileges.
2. `202609210003_apple_public_projection.sql` — approved active Apple-only public commercial fields.
3. `202609210004_apple_cancelled_attempt.sql` — audited empty Production cancellation and constrained reuse.

Local fresh/representative upgrade tests pass, including rollback of a failed migration. Production role verification must preserve service-role-only mutation and anon/authenticated denial for private tables. Public projection deliberately grants read execution without exposing identity or transaction data.

Rollback strategy: disable the new commerce entrypoints first; retain financial records, entitlements, delivery history and audit tables. Use a reviewed roll-forward correction. Do not drop populated ledgers or disable constraints. A migration transaction error must roll back, not be forced through.

## Functions

Deploy only after authorization and configuration review:

- `apple-iap`: authenticated native bootstrap, prepare/start, verify/recover, status and signed empty-attempt cancellation.
- `apple-iap-notifications`: independently verified Apple V2 notification payloads.

Gateway `verify_jwt=false` is intentional: `apple-iap` validates Supabase JWTs in code; notifications use Apple's cryptographic authentication. It does not make commerce anonymous. Missing configuration returns 503.

Normal endpoint:
`https://ymgiwjuhgvfexitynmtb.supabase.co/functions/v1/apple-iap`

Future App Store Connect Production V2 notification URL:
`https://ymgiwjuhgvfexitynmtb.supabase.co/functions/v1/apple-iap-notifications`

No `/e2e/`, Node laboratory listener or private local evidence is part of this composition. Do not deploy legacy lab readiness/recovery routes as replacements for these functions.

## App and App Store Connect

The App normal Release pins the public ACK key and HTTPS endpoint. StoreKit Configuration is NONE. Production policy rejects Sandbox or Xcode evidence; laboratory Debug builds remain separate. Before submission, confirm the intended App Review/TestFlight environment configuration with Apple's documented review flow; this local closure is not an App Review approval or a live-environment validation.

Confirmed IDs are already in policy; do not ask the user to supply them again. Manual ASC work after authorization: product availability/localized metadata/prices, subscription group ordering, agreements, review information/access, terms/privacy and the Production V2 notification URL. Submit the first subscriptions with the app version as required by Apple. Archive/distribution signing/submission have not occurred.

Recovery is exposed in the normal UI. Uncertain attempts fail closed without new purchases. Authenticated ownership is required; legacy visitor-only listings are not automatically claimed by entering their IDs.

## Cost and safety

No new host, provider, payment or account was created. Additional fixed infrastructure provisioned: $0. Supabase usage quotas/billing were not changed or inspected; this is not a promise of unlimited free usage.

Next user action: review and authorize a concrete deployment-preparation plan covering migration-state comparison and private secret configuration, before any remote mutation. No additional Sandbox purchase is needed to run the completed local suites.

## Official references

- [Apple subscriptions](https://developer.apple.com/app-store/subscriptions/)
- [Apple review guidelines](https://developer.apple.com/app-store/review/guidelines/)
- [First IAP submission](https://developer.apple.com/help/app-store-connect/manage-submissions-to-app-review/submit-an-in-app-purchase)
- [Supabase Edge limits](https://supabase.com/docs/guides/functions/limits)
