# Phase95 preservation baseline

This is a new baseline, not the lost Phase71 JSON. The old consumer selected `/android/`, `/create-checkout-session/`, `/stripe-webhook/` entries from a path-to-hash snapshot. The exact lost membership/content cannot be recovered from that consumer. No runtime dependency. No evidence it required secrets; original contents are unavailable.

Coverage: all 58 tracked files selected by those three directories; catalog, UI and payment-return add three direct payment dependencies. Four existing Apple provider-conflict files are preserved against authentic Phase92 hashes, not asserted unchanged since Git. Phase71 recorded preservation passing in its TAP and documentation. This does not prove the complete historical absence of transient edits.

| Path | Baseline | SHA-256 | Status |
|---|---|---|---|
| android/.gitignore | GIT_BLOB | 065e4a92a240fe11a0ea230491ad9dabef143f5fd5a3e6884ad6f0395666a971 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/.gitignore | GIT_BLOB | 99c54e51ee601a60fbde8016b2cbf717483bc2e92773be86c9247d02a7fa6ea4 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/build.gradle | GIT_BLOB | 8020ad6b2a2216e425393eef4a5352ae06035feabe71859821e8d36188ebdd37 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/capacitor.build.gradle | GIT_BLOB | 47e2308de17888afa42c3a6975626c50ef2fc0abbaf4c7da862eb32d567c3105 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/proguard-rules.pro | GIT_BLOB | 1cf8c57e8f79c250b0af9c1a5a4edad71a5c348a79ab70243b6bae086c150ad2 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/androidTest/java/com/getcapacitor/myapp/ExampleInstrumentedTest.java | GIT_BLOB | ff50b4c110a7434312f9af54171f9e8523b015836f707c9b387b76d4c38a97f8 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/AndroidManifest.xml | GIT_BLOB | 699dcea3af2a6ac481a50342f6aa504189522f317d50f39bda1cc091887231c2 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/java/com/abilenevibes/app/AdminActivity.java | GIT_BLOB | 9c277d31f55ed410a00a0afcfe600f9ef05beb0472afe2f6dff621b88385e518 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/java/com/abilenevibes/app/MainActivity.java | GIT_BLOB | cf1f9f4d4fc55517c95fdc4ea53922ad15befc451c6a200137f3466ef6822b5e | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-land-hdpi/splash.png | GIT_BLOB | 08cc34ad7713fe7ed58bceaa37b2387b670c53cd60264b4bd6442db3098e75dc | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-land-mdpi/splash.png | GIT_BLOB | 5cf98b4451bd99b20df26f9e608a46946118be6b0ae90762f9ca1786a30c76ff | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-land-xhdpi/splash.png | GIT_BLOB | 22f87e1e3bc89aa01a7dbc39c9a4db058cd0bf4ad3fe9f55712bf69eb997f4bf | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-land-xxhdpi/splash.png | GIT_BLOB | 42aa26392546fcdee1b8d3ac6d4b41bfcceb41dc6a4f3a3c30c24a8a8f4db862 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-land-xxxhdpi/splash.png | GIT_BLOB | 60393ce8636fd263e4e1fea3fd4ab2de948c6295e898fda9b50ac4e5283be809 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-port-hdpi/splash.png | GIT_BLOB | c5015f4ba3628392b538386c5e210f0b94f352a3160adab934fd0311972137ca | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-port-mdpi/splash.png | GIT_BLOB | 07fa579e1c83e04ba7f9cbcbfcf41b68e15fe3638f2c44a04e58b809103e6b69 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-port-xhdpi/splash.png | GIT_BLOB | b73049cb37fe76d6c11b87a796766bf6af0c85483b31eb6a921657b0d764a4b9 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-port-xxhdpi/splash.png | GIT_BLOB | 0c7f1212f25b7b90e9a6e1d320013e4ff3d3e03e634cbb07b7b7981cac51627f | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-port-xxxhdpi/splash.png | GIT_BLOB | 3db071a03b2f8ffe0dfd4170fc59842d53cd15bba5e88af59401d58efabf7827 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable-v24/ic_launcher_foreground.xml | GIT_BLOB | a8514094f754b099d3e55ce1d6e0b2de79db418b2eeacb0fc2a6bb0bfadef221 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable/ic_launcher_background.xml | GIT_BLOB | 718ba51adf166bb55c3e9936bb8199a0148457f7f0191aaa2f37a94f3159d6ec | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/drawable/splash.png | GIT_BLOB | 5cf98b4451bd99b20df26f9e608a46946118be6b0ae90762f9ca1786a30c76ff | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/layout/activity_main.xml | GIT_BLOB | 5d770feb791313b947020cbfc57e5c733c556dac5e9e49261a1190e527073253 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-anydpi-v26/ic_launcher.xml | GIT_BLOB | 9c3a7e0a6515c6e1a7ae834a9ae430311ebc3241f7b2e5e7f0460aa690709a7c | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-anydpi-v26/ic_launcher_round.xml | GIT_BLOB | 9c3a7e0a6515c6e1a7ae834a9ae430311ebc3241f7b2e5e7f0460aa690709a7c | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-hdpi/ic_launcher.png | GIT_BLOB | 8550ab113f208b9716a990e2cb2c5889ae9153c4d1bcddcc2611b3d5da561290 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-hdpi/ic_launcher_foreground.png | GIT_BLOB | 61e1852f6b7edc49d2a2ba64bc0543b7452fa11e142679c232872e760f1f89a1 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-hdpi/ic_launcher_round.png | GIT_BLOB | 8550ab113f208b9716a990e2cb2c5889ae9153c4d1bcddcc2611b3d5da561290 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-mdpi/ic_launcher.png | GIT_BLOB | 04f0f23577f5f1037be349204c12eb46ceac804b5315ec75bcbead0dbbf9cd15 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-mdpi/ic_launcher_foreground.png | GIT_BLOB | 44f9a6bd111cd934818ffd9d1869df042eecd96811f95742545876f6c4a1c941 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-mdpi/ic_launcher_round.png | GIT_BLOB | 04f0f23577f5f1037be349204c12eb46ceac804b5315ec75bcbead0dbbf9cd15 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-xhdpi/ic_launcher.png | GIT_BLOB | 78b65b0e8ab6651c6b0abad21fa8cc6b5d7d5ad5bfc99802339ab304eafcac0a | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-xhdpi/ic_launcher_foreground.png | GIT_BLOB | 3e9eb15a07454e063f8ae68bce09f015a33973ec466a9bc04e6f60ddd643059c | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-xhdpi/ic_launcher_round.png | GIT_BLOB | 78b65b0e8ab6651c6b0abad21fa8cc6b5d7d5ad5bfc99802339ab304eafcac0a | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-xxhdpi/ic_launcher.png | GIT_BLOB | 3cd421bcecfe38803c389d5899c4d024b0851de5a1f0637d5d9392efde21786c | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-xxhdpi/ic_launcher_foreground.png | GIT_BLOB | 999e5a6d2b706d4ee0eaddeca7b51f1a7c2dfe889cdf7481815821af1fc3e620 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-xxhdpi/ic_launcher_round.png | GIT_BLOB | 3cd421bcecfe38803c389d5899c4d024b0851de5a1f0637d5d9392efde21786c | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-xxxhdpi/ic_launcher.png | GIT_BLOB | adb48d0ae78169df17104bfabe7564f4304b9cc996e943de46b70a866cc16856 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_foreground.png | GIT_BLOB | dc77e6a27ee24dd6fe9112e39c4ec138c3283e5e7ac2b2636a8d53e0cd951a2a | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/mipmap-xxxhdpi/ic_launcher_round.png | GIT_BLOB | adb48d0ae78169df17104bfabe7564f4304b9cc996e943de46b70a866cc16856 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/values/ic_launcher_background.xml | GIT_BLOB | 3947662036250b6b1534cee7e402966d8db8cb1caa1cf16a07167a536bdef6cc | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/values/strings.xml | GIT_BLOB | 4beb1afc65242f32b57d571998acc1b412b8496f2eaeea2e88ac0b14e6d870c8 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/values/styles.xml | GIT_BLOB | 18ebba36575e9461347ee67361b23caf095f158ee85dbefe1b83a4669ba5bd6c | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/main/res/xml/file_paths.xml | GIT_BLOB | a46ed43ef65c90cb6778f4581decf3556e3f0055aad8f36d69dae16f9a0e99aa | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/app/src/test/java/com/getcapacitor/myapp/ExampleUnitTest.java | GIT_BLOB | d4045ae8fac1f0807e6b24eb34e68409a9a235df9d1a3f896fb8c9a49424363d | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/build.gradle | GIT_BLOB | 46ade7db7afeb8049ccea59fce83095dca736ceb8c9acd79cc944e988c3357d9 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/capacitor.settings.gradle | GIT_BLOB | 1fdbc4499634a5cf33c0d421c6e3fd779f4ec36d06d2e76c6107987d7bd1a979 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/gradle.properties | GIT_BLOB | 3bab15c5b8bc4c2f4b6cf525497d15ad4abca53a460e6dd2eb0f0135817d31e6 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/gradle/wrapper/gradle-wrapper.jar | GIT_BLOB | 7d3a4ac4de1c32b59bc6a4eb8ecb8e612ccd0cf1ae1e99f66902da64df296172 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/gradle/wrapper/gradle-wrapper.properties | GIT_BLOB | 9a479a85aa879bb55284fc16d0de5b81a745c3854f4e2d88c42e7debaf007435 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/gradlew | GIT_BLOB | b187b4c52e749f5760afdd6fadc31b2a98ad35fb249bf0dff03b72650f320409 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/gradlew.bat | GIT_BLOB | 1d297e00bd21de3ace22b4d7f2de1f9dfa858883d66bbf7c1ccbecccec8f4f3b | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/settings.gradle | GIT_BLOB | 6ce098d15ebd69b44c4ecd786bca1bdc366340d2459b2af4d7bb0ab317aa9669 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| android/variables.gradle | GIT_BLOB | 83d502c9ed8fcf1dd4791482067abeedbebae49fafe9cd14a8a1f5891deb0d88 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| supabase/functions/create-checkout-session/index.ts | GIT_BLOB | 4deb7bb8bc9754f13f56d69a67129f15646eb40ff6a9ee662cfab1043cd67571 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| supabase/functions/create-checkout-session/ownership.ts | GIT_BLOB | dee50c1e62d57fbda1000a32df4bdcb1e03cb6b0d0b503cd97f83c4af0cedf5e | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| supabase/functions/create-checkout-session/pricing.mjs | GIT_BLOB | 633cd5837a35cdad43bc717201fde2eff5d089b26f31a5723bc9d6465d982153 | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| supabase/functions/stripe-webhook/index.ts | GIT_BLOB | 5aa4f45f6c1fdabb986b12259de6466789df5f2b9302df86d50af7ea14e227bc | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| src/billing/promotionCatalog.mjs | GIT_BLOB | 6745eccc04bfd1aae54f78ff55dafd02b920c30a3a3f0e588982209662f3b9bd | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| src/App.jsx | GIT_BLOB | 13d5d5805883b80c0e36dc4f27fdfdbd99d2f1e2c455639f96e9170b6405c28e | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| supabase/functions/payment-return/index.ts | GIT_BLOB | 9cfdaa71ca69b298794780f3050500aa943c155585f6d8bf2b4e83c74b865b6f | PROVEN_UNCHANGED_FROM_GIT_BASELINE |
| supabase/functions/_shared/apple/domain.mjs | PRESERVED_HASH | 8a79ab37f0719faf951b33c29e3754f92c08611dbd08b4aae075ffce4c87ad26 | PREEXISTING_MODIFICATION_PRESERVED |
| supabase/functions/_shared/apple/backend.mjs | PRESERVED_HASH | 635fbc8ee0a21f33e504cb305213da4edd15a71a1f13b27b94d61ca4ceb425f8 | PREEXISTING_MODIFICATION_PRESERVED |
| supabase/functions/_shared/apple/reconciliation.mjs | PRESERVED_HASH | 5b746d59495ac636e5957e5218224de76aab6070a1f130f195db56248d995bfc | PREEXISTING_MODIFICATION_PRESERVED |
| supabase/functions/_shared/apple/repository.mjs | PRESERVED_HASH | 91896d53c3f0c1ab81db8bcd5e74dfc2d3ba761e0b1351b1b44cd6f184935118 | PREEXISTING_MODIFICATION_PRESERVED |

Run from MAIN with Node 22.23.2 and `ABILENE_AUTHENTIC_FIXTURE_DIR` pointing to the private durable fixture. Run backend suites in a permitted local context allowing loopback; the HTTP test must not be skipped or weakened. No external network is required.

Commands:
```sh
node --test tests/apple-backend/*.test.mjs tests/android-pricing.test.mjs tests/checkout-ownership.test.mjs
node --test /Users/yanier/Documents/abilene-apple-verifier/tests/*.test.mjs
```

## Native regression evidence
CryptoKit: existing phase72-ack-cryptokit.swift, with phase95-ack-vectors.mjs generating nine synthetic signed cases. Set ABILENE_ACK_TEST_DIR to an existing private 0700 directory outside Git; set ABILENE_AUTHENTIC_FIXTURE_DIR as above. Then run the vector generator and `swift -module-cache-path <private-cache> tests/apple-backend/phase72-ack-cryptokit.swift <private-ack-dir>/vectors.json`. Keys are synthetic test-only and never printed.

PreGuard: extracted Capture90 from the current local physical-lab AbileneBridgeViewController.swift, verified exact equality with the prior complete 26-case harness component, and executed all 26 cases with macOS Swift/CryptoKit. Phase95 executable harness and output: /private/tmp/abilene-phase95/preguard-tests.swift and preguard.log. This execution does not build/install or query StoreKit. The application artifact stays untouched.

Regression totals: MAIN 326, NODE 134, CryptoKit 9, PreGuard 26 = 495 unique checks; no duplicate counting of loader/tamper/provider tests already inside MAIN. Existing Node capacity tests use explicitly diagnostic certificates; authentic replay uses only the pinned Apple bytes.
