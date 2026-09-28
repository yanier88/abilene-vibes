# Admin UGC isolation — local publication candidate

## Scope and architecture

The old `src/admin-main.jsx` imported the full mobile `App.jsx`, which made pending mobile/account/UGC functionality reachable in the Admin bundle. The entry now imports `src/admin/AdminShell.jsx` directly. The shell extracts the current Admin view, handlers and Jobs/Rentals edit routes; it is not a historical copy of the app. Authentication, module loading, moderation, workspace, marketplace, ownership, password and presentation helpers remain shared. Mobile `App.jsx` is byte-for-byte preserved during this task.

The extraction intentionally leaves the existing mobile Admin branch in place. Future Admin handler changes must account for that retained branch until a separately authorized consolidation. Back to Lobby leaves the Admin website for https://abilenevibes.com rather than booting the mobile runtime inside Admin. Authenticated realtime invalidation refreshes through the existing Admin controller and cleans up subscriptions.

AdminReports uses only admin report/list/resolve RPCs and the safe report contract. Personal Report/Block/Unblock and hidden-content filtering remain in the local mobile candidate. EventFields was extracted without changing its implementation; mobile imports are preserved by re-exports. Those mobile adapter edits are not prerequisites for the Admin publication.

## Build boundary

Only `vite.admin.config.js` changed; shared/mobile Vite configuration and package scripts did not. `publicDir: false` avoids copying unrelated public assets. The build emits only Admin-required static gallery images, icon and bundled background. `scripts/admin/isolation.mjs` rejects forbidden source modules and specific mobile runtime markers during build. Tests cover rejection and inspect the actual emitted module graph and JS. No source maps are shipped.

Excluded runtime: App/Lobby/mobile navigation, personal UGC, account deletion, mobile billing/StoreKit/Capacitor, Notifications and device registration. Shared Supabase SDK and auth behavior remain required and included. Server-side `is_service_admin` and RPC authorization remain authoritative.

## Validation

- 320 tests PASS, 0 FAIL, 0 SKIP: Admin, isolation, targeted UGC, Account, pricing, Promote, Apple IAP, Notifications and legal regression.
- Admin build PASS; shared build PASS. Admin bundle-size advisory remains nonfatal.
- Independent local snapshot of HEAD plus the exact publication allowlist builds successfully. Installed dependencies were reused; this was not a fresh network npm ci.
- Snapshot artifact is byte-identical to the working-tree Admin artifact. All non-allowlisted application modules in its graph equal HEAD, demonstrating no dependency on unrelated pending source edits.
- Local browser fixtures: authorized dashboard, no-session login, non-admin denial, report/empty rendering, Review Content to Reviews, Resolve and Dismiss state transitions. No production credentials or mutations used.
- 320/768/1280 px: no horizontal overflow; report actions remain visible with 44 px minimum height.
- Native builds not repeated: shared build configuration was unchanged; no mobile installation occurred.
- Secret scan found no private credentials/material in artifact; the public Supabase anon client key is expected, not a service-role credential.
- App.jsx, 14 protected files, frozen account/notifications/legal/billing/native/backend paths and deploy workflow preserved against pre-task hashes.

## Workflow

Existing `.github/workflows/deploy-admin.yml` remains unchanged. It uses Node 22, npm ci, npm run build:admin and publishes dist-admin to yanier88/abilene-vibes-admin main. Source/config paths in this allowlist trigger it. No workflow, commit, push or deployment was run here. Future publication must use the allowlist below; do not publish the entire working tree.

## Exact future Git allowlist

- `src/admin-main.jsx`
- `src/admin/AdminShell.jsx`
- `src/admin/AdminBase.css`
- `src/admin/AdminReports.jsx`
- `src/admin/AdminReports.css`
- `src/ugc/reportContract.mjs`
- `src/components/EventFields.jsx`
- `src/components/adminDashboard.mjs`
- `vite.admin.config.js`
- `scripts/admin/isolation.mjs`
- `tests/admin/dashboard.test.mjs`
- `tests/admin/ugc-isolation.test.mjs`
- `tests/admin/ugc-ui.html`
- `tests/admin/ugc-ui.jsx`
- `docs/admin-ugc-isolation.md`

Exclude generated dist-admin, temporary test evidence, private files and all unrelated pending mobile/legal/backend/native changes. The already-pending adminDashboard/dashboard test changes are included because they add Content Reports navigation. The local PremiumEvents.jsx, UgcSafety.jsx and safety.mjs re-export refactors remain outside this Admin-only publication list.

## Actual application import closure

- `admin.html`
- `src/admin-main.jsx`
- `src/admin/AdminBase.css`
- `src/admin/AdminReports.css`
- `src/admin/AdminReports.jsx`
- `src/admin/AdminShell.jsx`
- `src/auth/adminModeration.mjs`
- `src/auth/adminModuleReads.mjs`
- `src/auth/adminWebSession.mjs`
- `src/components/AdminCardMedia.jsx`
- `src/components/AdminMarketplacePage.jsx`
- `src/components/AdminOwnershipClaims.jsx`
- `src/components/AdminWorkspace.css`
- `src/components/AdminWorkspace.jsx`
- `src/components/EventFields.jsx`
- `src/components/PasswordField.jsx`
- `src/components/adminDashboard.mjs`
- `src/components/adminMarketplace.mjs`
- `src/components/adminPresentation.mjs`
- `src/components/premiumEvents.mjs`
- `src/index.css`
- `src/ugc/reportContract.mjs`

## Artifact inventory

23 files. Inventory digest: SHA-256 of compact JSON mapping paths to SHA-256, sorted by path.

`67c87759d3d151e84e778f694c0a2b27f7921eb195cb6ca74e0b6fcc698a6ed0`

| Path | SHA-256 |
| --- | --- |
| 1fd1ea2a-acb5-47b2-81dc-6e9fd898f418.jpg | 710b2e655cd2d434f52514e882b48fb2fc0a01b49a7ef1387f09889e1f31d9ee |
| 227005f7-a560-45d7-bea9-557e2cee61f3.jpg | 7db7b3a23736d827e9d7d83862dd847e867e931861c31bd765159fa0c83bc009 |
| 45cbacf8-d03a-4d23-ba5d-0f59509c79c6.jpg | 9d012635c41c76b8f2a8021aeed85a9ec1e51d38bd6655178df78fb83bf24d7c |
| 522c6f5e-6918-4dd3-8874-3eaaa75430a2.jpg | 9e4ab9ee61fb8d7d58547f4f12b0c90946abe5f8f69e8888032aa3d5c8fea56d |
| 553b9d8e-d087-4267-a0dc-d475fd25f231.jpg | db5b35a984b4a1df7e1407162c4c06fe02eb02e9971f76b7fed472fe3438bb7e |
| 64d46fa8-3f51-4bce-ae95-07f74746d75b.jpg | cc28b06407d55ae1904f927ca49cd7d5eda6d975d30cd6f9566d2a0f9da24351 |
| 64dc2bcf-e858-42d9-a881-12d069e4b919.jpg | bb0042a697210b626057ca17ef43d0ebbea62d0893117dbe79c978e0176c0750 |
| 77c9ff59-9fba-479d-94f7-14de54433b15.jpg | fbb4d0cbc9c337dba2e792fb16cc1586acce84c4cb59c803c1e0e8ee49b8e768 |
| 94190f7b-27db-4b0f-b85e-84b6da72fbf2.jpg | 452ccda45a801e2dbf04c9ac92802cd758e0543fb746cf12b472092202c6920a |
| 95547aea-c652-48bc-bff2-3f9f645236e3.jpg | 700c5328204e03536b3097561f1bb7b6d69e134d821b862f1557184a2eca132d |
| 9e98df0d-dc19-429c-8205-675ba9cff023.jpg | d84632bbed99aa2fd18e90e57a49452af63267734a02d98ab807b30719372ea1 |
| admin-isolation-manifest.json | 7e5eeb6025c4e92005c28cd6af7f3cfb39a6359dd0facac3286a4fdf3bccefb8 |
| admin.html | e454b59c1dfb1ca212c7ec6d3785ef5b46eb21fb3d6ffdaef7372eadbc970e41 |
| assets/admin-CSgsNYQR.css | 2111029743efd1041d0a3e9004f9dd257fd4faa92cb20bbdfcf409dbd76d98ed |
| assets/admin-DnSWIqVJ.js | fd7aacdfab4adfb4ec9e678fc76614f3721a34373194a65832a639ab57b1919e |
| assets/admin-bg-SoOdXmSv.jpg | ca85bb9a67c9dfb9207f2c3fa1cb7d1094033d4ed111b8e0724df5bab6934a83 |
| bd916012-2fb5-4dd1-b854-77a3b801bcd4.jpg | 70a26a2d8df93d345ffb742b4bfd5d7d9daeb04e718bdb05f719ef00cec562b1 |
| ded1242b-9c25-4b2b-b16d-5b36ffe01e51.jpg | 9b65c20155b082c14202d16d4be8e188fa3c212dd89a2aa8008e560ebbeac61e |
| icon-192.png | 9ee547037d57f878ba391b031b5f3a9ddec6731d6709782e08a97611e5b64ca9 |
| nightlife-cinemark.jpg | 5d27f05d2bfdea102fe02b403b7fdcb5b86b110c3595c47c11200961d4acd842 |
| nightlife-paramount.jpg | 4dea07aa882de6cba478a9b0577cd71940c0864110694797cf27a872814c4888 |
| nightlife-station.jpg | 16af6617e7b06fa0495d47db645ad2d2cacbcf554f5ea2c37bc858a85fd6ab63 |
| nightlife-suite.jpg | 1995adcba99d541e976d9f65850a1b7221c78614072cd7d07d4b27a45c5a4fb9 |

## Freeze and next step

Local candidate only. No production state was re-audited or changed. Existing UGC migration, Delete Account, IAP, Notifications and iOS activation boundary remain untouched. No real reports, blocks, account actions, push or commercial actions occurred. Final mobile/legal publication and other release items remain separate. Await explicit authorization for controlled Admin publication.
