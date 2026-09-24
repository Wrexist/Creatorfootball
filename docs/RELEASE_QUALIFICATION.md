# Native release qualification

Continuation of the expansion work, 22 September 2026. Careers remain local; RevenueCat is the only purchase service. No Supabase, accounts or cloud saves are being added.

## Current distribution checkpoint - September 23, 2026

The qualification record below describes the earlier local pass. On September 24, signed iOS `1.0.16 (9)` was uploaded successfully (Apple processing/tester availability still to verify), and signed Android `1.0.16 (3)` became active on the internal track. RevenueCat store credentials and both-platform product/entitlement/offering wiring were rechecked. The latest iOS workflow passed lint, typecheck, 998 tests, production build and browser flows before archive/upload. See [STORE_SETUP_STATUS.md](STORE_SETUP_STATUS.md) for artifact hashes, current listing evidence and unresolved gates, and [NATIVE_TEST_HANDOFF.md](NATIVE_TEST_HANDOFF.md) for remaining device/commerce checks.

**Public release remains blocked.** The owner explicitly held Google's children's compliance certification for review. Native purchase/restore/refund verification, Apple IAP review assets, replacement listing galleries and Google's required closed testing remain outstanding. Tablet layout corrections have passed browser qualification. Earlier missing-key/unsigned-only statements below are historical; real transactions remain unqualified.

## Audit and scope

- Android embeds the production Vite build in Capacitor. `android/app/build.gradle` owns signing; `capacitor.config.ts` owns bridge configuration. Java 21, SDK 36 and the pinned Gradle wrapper are required.
- The native template has unused launcher/splash assets, an incorrectly assigned round icon, a broad external-storage sharing path and no pre-Android-12 backup flag. These can be corrected without touching simulation or save formats.
- RevenueCat currently checks key prefixes at runtime, after Vite may already have embedded a misconfigured secret. Both platform-specific validation and an early build guard are needed. No keys were found in `apps/game/.env.local` because that file is absent.
- Purchase bootstrap assigns its adapter before registering the update listener. A failed listener registration can leave retries without a listener. Regression tests will cover recovery and concurrent startup.
- The existing Android smoke test covers reload, but not process death. Extend isolated-emulator qualification to change real game settings, stop the process, reopen and compare the persisted career.
- Build an unsigned release bundle for packaging inspection; it is not a signed or store-qualified release. Preserve the current debug APK and previous screenshot evidence.

## Verification plan

Run focused purchase/configuration tests, app typecheck and lint, production build and Capacitor sync, Android debug/release assembly and lint, then native restart and sharing flows. Inspect updated screenshots. Document external signing, RevenueCat sandbox and physical-device gates explicitly.

## Implemented changes

- `src/commerce/config.ts` validates platform-specific public SDK keys in both Vite and the native adapter. Secret/malformed/wrong-platform values fail before bundling. `CF_PURCHASE_RELEASE_PLATFORM` adds an explicit store-release gate for missing and Test Store keys; disconnected qualification builds still work.
- `src/commerce/store.ts` commits its adapter only after listener registration succeeds, so a bridge failure can be retried. Regression tests cover concurrent boot, failed registration, approval/refund updates and recovery from offerings errors.
- Android now uses adaptive and monochrome vector football icons derived from the project's original favicon, plus an API 24-25 fallback. Thirty unused template files were removed. The legacy backup flag complements the existing cloud/device-transfer exclusions.
- FileProvider exposes only `cache/career-exports/`. Export creates that directory and retains the existing validated portable JSON format. Normal share-sheet dismissal returns `CANCELLED`; real filesystem/sharing failures remain visible. This fixes the error message found during screenshot inspection.
- Android CI assembles the debug APK and an explicitly labelled unsigned release bundle and runs both lint variants. No keys, signing material, paid test ownership or development server are embedded.
- `e2e/native-release.mjs` is reusable on the isolated QA AVD and refuses personal devices/unrelated emulators. It exercises real lineup, tactics, training, accessibility, saving, offline process restart and native export UI.

## Verification

| Check | Result / evidence in `artifacts/release-qualification` |
| --- | --- |
| App tests | 220 passed across 25 files; `app-tests.txt` |
| App typecheck and repository ESLint | Pass; `typecheck.txt`, `lint.txt` |
| Production build and native synchronization | Pass; `build.txt`, `cap-sync.txt` |
| Actual Vite configuration rejection | Invalid secret, wrong-platform key and missing release key rejected before bundling; `build-guard.txt` uses fake test values |
| Browser gameplay | Onboarding, lineup/tactics/training, market search, live substitution, result/reload and save conflict pass; `browser-flows.txt` |
| Browser expansion | Portable export/import, corrupt-save recovery, content, 3D and responsive layouts pass; `browser-expansion-final.txt` |
| Android debug and release | APK and unsigned AAB build; both lint variants pass; `android-build.txt` |
| Android career persistence | Two offline force-stop/relaunch cycles preserve the entire saved career, including seven-player lineup, tactics, training and reduced-effects preferences; `native-lifecycle.txt`, `screenshots/results.json` |
| Native export | JSON equals the persisted career; restricted FileProvider opens Android's share sheet; dismissal produces no error |
| Screenshots | Eight native images; icon, tactics, training, settings, offline Home, 3D fallback, sharing and local saves; visually inspected |
| Packaging | APK debug signature and alignment checked; AAB confirmed unsigned; `apk-signature.txt`, `aab-signature.txt`, `packaging.json` |

No engine formulas, save format, migrations or economy rules changed. The preceding expansion pass's 746 engine tests remain the engine baseline; this pass added and reran app regression tests. No separate formatter is configured. The existing lazy Three.js chunk size advisory remains; chunk thresholds were not increased.

## Limits and remaining work

- **Real purchases:** RevenueCat public keys, store products/entitlements/offering and store sandbox purchase/restore/refund evidence are still missing. Mock and presentation tests are not purchase receipts. See [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md).
- **Distribution:** the APK is debug-signed and the AAB is unsigned. Upload signing, Play internal testing, iOS Xcode/archive qualification and final store metadata are still required. Nothing was published or purchased.
- **Device performance/accessibility:** API 35 emulator qualification does not validate physical-phone thermals, GPU timings, TalkBack/VoiceOver or Android 16 large-screen behavior. Recorded cold-launch timings include automation and concurrent build load and are not performance budgets.
- **Six Android lint advisories remain:** pinned Gradle/AppCompat updates, two portrait/orientation advisories, Capacitor's generated/dynamically consumed `config.xml`, and an empty `drawable-v24` directory. No lint checks were suppressed. Automatic approval review blocked the command containing that empty-directory cleanup, reporting only “blocked by policy”; the directory was left intact and read-only packaging checks were run separately. Empty directories are not committed by Git.
- Further bespoke runtime 3D characters/cinematic scenes remain the separate art-production work described in [EXPANSION_REPORT.md](EXPANSION_REPORT.md).

The highest-impact next step remains RevenueCat store configuration and real sandbox purchase qualification on signed native builds.

## Final artifacts

All files are under `artifacts/release-qualification/`:

- `Creator-Football-debug.apk`: 21,355,761 bytes; SHA-256 `0c132e7106bfd8ec2597eaad2834169befd212ff28d5eb0a79deb0998e3db01d`.
- `Creator-Football-unsigned.aab`: 16,348,408 bytes; SHA-256 `8e9088d357f664b1e8d8a294417092103cd7678238733795fcf7f54d4c9d2c74`.
- `Creator-Football-native-screenshots.zip`: eight native screenshots, gallery and evidence; `index.html` is the local gallery.
- `packaging.json`: checksums, plugin/model inventory, signature status and absence of a live development-server URL in both packaged configurations.

Only the task's QA emulator was stopped after verification; the pre-existing emulator was left untouched.
