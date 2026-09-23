# Current status

Superseded implementation notes below are retained as experiment history. Current code uses PKI.js 3.4.1, ASN1.js 3.0.10 and noble-curves 2.4.0; jsrsasign is removed from MAIN and the shipping graph. Production composition and endpoints are now connected. Confirmed appAppleId 6811679667 and both product group IDs 22382531 are encoded. See [final local closure](phase112-final-integration-status.md) for current tests, trust and boundaries.

## Historical investigation record (not current readiness)

# Fase112 — compatible verifier, local evidence and integration boundary

## Latest continuation

See [current status](phase112-final-integration-status.md). The identifiers are now confirmed, and jsrsasign has been removed from the Edge candidate. Historical results below describe the earlier proof, not the latest dependency graph.

## Result

Option B is the selected **candidate architecture**: normal iOS → authenticated Supabase Edge backend → compatible Apple verifier in that worker → durable PostgreSQL ledger → signed ACK → CryptoKit → finish. No external Node host is demonstrated necessary. This is **not code complete or approved for deployment**. No normal app purchase route, production bootstrap, production ACK signer or production endpoint has been connected by this continuation.

The earlier blanket statement that Edge cannot verify Apple signatures is superseded by direct experiments. The official Node library's X509 dependency is incompatible; equivalent verification is possible without running that library. This distinction does not establish equivalence of every production policy or close all integration tests.

## Dependency-by-dependency classification

A: directly available; B: compatible adaptation; C: Node-specific original API; D: process-local only; E: durable state belongs in PostgreSQL.

| Dependency | Class | Observed result / remaining work |
|---|---|---|
| Apple library 3.1.0 unchanged | C / B replacement | Its Node X509 methods fail in Edge. Candidate independently verifies the same authentic chain and signed payload. Full production policy/lifecycle differential matrix remains required. |
| SHA-256, Buffer | A | Used successfully in real Edge worker. |
| ES256 JWS and P384/SHA384 certificate signatures | A | WebCrypto positive verification and negative payload tests pass. |
| X509 issuer/AIA/SPKI/extensions | B | Explicit bounded parsing replaces missing Node methods; root G3 pinned independently. |
| Mixed P384/SHA256 signature | B | Edge WebCrypto does not implement it; deterministic public signature verification uses pinned jsrsasign 11.1.5. No fallback after an invalid signature. |
| DER and OCSP | B | Existing strict parser/pair/freshness/status/signature logic ported to async certificate verifier. Both authentic pairs match original Node facts. |
| node:http custom DNS lookup | C / B replacement | ERR_NOT_IMPLEMENTED before lookup; Deno raw socket connects to validated public IPv4. |
| DNS / network | A / B | Deno.resolveDns and Deno.connect work; all addresses checked, first exact IP pinned, no redirects/retry, bounded response/time. |
| TLS | A / B | Native Deno.startTls retains hostname and platform trust; not relaxed. Apple fixture OCSP URLs use HTTP; their security is the signed OCSP response. Live HTTPS negative-certificate matrix is not yet executed for this adapter. |
| Cache | D | Per-worker optimization only; exact pair/environment/policy key, GOOD only, bounded size and singleflight. Cold worker re-verifies. |
| Request authentication | A / E | Existing Supabase Auth can authenticate owners; production installation/bootstrap integration remains missing. |
| Replay / idempotency | E | Existing PostgreSQL unique claims/CAS are the authority. Worker memory is never replay authority. Production-scoped repository still needs integration. |
| Safe events | B / E | Candidate emits normalized branded verified facts; durable notification processing remains in ledger. Production endpoint not wired. |
| Persistent process | E | None required for correctness if claims, capabilities, deliveries and notification ordering live in PostgreSQL. No Actions or Mac server proposed. |

## Evidence from this continuation

Private local directory: `/private/tmp/abilene-phase112-edge-proof/`. Do not commit its assets, fixtures or bundles.

- Actual runtime: supabase/edge-runtime:v1.76.2, Deno-compatible 2.1.4. Worker configured 256 MB / 2 s CPU hard limit.
- `console.log`: native chain and JWS primitive positive/negative probe.
- `ocsp-console.log`: both preserved OCSP pairs GOOD / EXACT_PAIR / signature true.
- `transport-console.log`: original node:http API failure before DNS callback.
- `deno-transport-console.log`: raw TCP, DNS A and custom HTTP client available.
- `ocsp-egress-console.log`: direct public Apple OCSP, two responses GOOD / EXACT_PAIR / signature true, 1853 and 936 bytes, approximately 200 and 239 ms respectively. Only public certificate OCSP requests sent, no transaction JWS or credentials.
- `negative-console.log`: both modified OCSP signatures rejected inside Edge. No acceptance on parser/signature error.
- `node-proof.log`: 36 PASS, 0 FAIL, 0 SKIP.
- `main-regression.log`: 498 PASS, 0 FAIL, 0 SKIP, including those 36.
- An initial network-disabled worker could not download npm types; corrected by allowing dependency download. This was a worker boot failure, not a successful crypto test.
- Worker shutdown warnings occurred after SAFE_RESULT, at the deliberately short idle wall limit. They are not evidence of a CPU failure during the completed request.

These probes are not a hosted deployment or a throughput/cold-start SLA. No Supabase account quota/billing allowance was read. Local expenditure: $0; future extra billing cannot be guaranteed without comparing usage with the existing plan.

## Candidate implementation boundaries

`supabase/functions/_shared/apple/edge/` is currently **unwired**. No Edge entrypoint imports it. Bare jsrsasign dependency is pinned for local tests and bundled runtime probes; production packaging/import-map integration remains pending.

The npm metadata marks jsrsasign 11.1.5 unmaintained. It was already the pinned parser in the Node implementation. This candidate uses public verification only, but maintenance status and the newly expanded mixed-curve verification surface must be included in the production security review; pinning alone is not a security certification.

Before calling this production-ready, complete: negative certificate/critical-extension and malformed-JWS matrix, production/Premium signed policy fixtures, notification/renewal matrix, HTTPS peer/hostname rejection tests, end-to-end durable deadline enforcement, authenticated bootstrap, native ACK/finish integration, scoped migrations and normal Release build. The 498 passing tests do not substitute for these missing tests.

## Existing owner identity to reuse

`202609060001_advertiser_identity.sql` already defines authenticated advertiser profiles, stable server-generated app_account_token and listing advertiser_user_id. Reuse auth.uid and real advertiser ownership; never treat the legacy visitor/owner key supplied by the client as proof. Installation key possession must be challenged and bound server-side. A trusted bootstrap must connect this identity to the existing ledger without creating a second independent token identity.

## Manual configuration gate

No verified numeric production appAppleId was found in inspected source/configuration or the preserved Sandbox AppTransaction. Featured group 22382531 is evidenced. The Premium product ID exists, but its current group has not been independently established. Never assume it equals Featured's group.

The user was asked for **the numeric Apple ID for com.abilenevibes.app and the group ID for Premium slot01**, read from App Store Connect. These are public identifiers, not credentials. No ASC setting should be changed to answer. Production construction fails closed without appAppleId; no invented default.

This is a manual information gate, not proof that external hosting is needed and not a claim that the rest of the product is complete.

## References

[Supabase limits](https://supabase.com/docs/guides/functions/limits) specify 256 MB memory and 2 seconds active CPU per request. [Deno STARTTLS](https://docs.deno.com/examples/starttls/) documents upgrading an existing connection with its intended hostname. [Apple WWDC24 StoreKit guidance](https://developer.apple.com/videos/play/wwdc2024/10062/) requires validation of signed transaction data before granting content regardless of how the server obtained it. None of these sources replaces the local evidence or authorizes deployment.
