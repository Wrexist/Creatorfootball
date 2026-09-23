# Android packaging

The native project is `apps/game/android`, application ID `com.creatorfootball.app`, minimum API 24, target/compile API 36. It embeds the same production web build as iOS. Use Java 21 and an Android SDK with platform 36 and the required build tools. The checked-in Gradle wrapper controls the Gradle version.

```powershell
corepack pnpm install --frozen-lockfile
corepack pnpm build
corepack pnpm --filter @cf/game cap:sync
$env:JAVA_HOME='C:/Program Files/Android/Android Studio/jbr'
$env:ANDROID_HOME='C:/Users/IsacC/AppData/Local/Android/Sdk'
Set-Location apps/game/android
./gradlew.bat assembleDebug lintDebug --daemon --max-workers=1
```

Output: `app/build/outputs/apk/debug/app-debug.apk`. This is an installable **debug** APK, not a store-signed release. Linux CI runs both assembly and lint using `.github/workflows/android.yml`; the iOS workflow remains separate.

This Windows machine encountered Gradle's immutable-workspace rename/cache issue with single-use daemons. Retrying with the reusable daemon completed lint; no checks were disabled. The source project retains Capacitor's supported wrapper/toolchain rather than changing major build-tool versions for a host cache issue. See [Gradle's issue](https://github.com/gradle/gradle/issues/31438).

## Release signing

Create and retain your own upload keystore outside the repository. Configure `CF_ANDROID_KEYSTORE` (absolute path), `CF_ANDROID_STORE_PASSWORD`, `CF_ANDROID_KEY_ALIAS` and `CF_ANDROID_KEY_PASSWORD` through your secure local environment or CI secrets. `app/build.gradle` uses them for the release signing configuration. Keystore file extensions and local environment files are ignored by Git. Without them, a release bundle is unsigned and must not be described as publishable.

Run `./gradlew.bat bundleRelease`, verify the signature and version code, configure RevenueCat's Google products and public SDK key, then use Play internal testing. Do not publish the debug APK. Store accounts, upload signing, product setup and live sandbox transactions remain external configuration.

### Signed release workflow

`.github/workflows/android-release.yml` adds a manually dispatched signed-bundle route. It runs lint, typecheck, tests, production build and browser smoke before packaging. Configure the public GitHub variable `VITE_REVENUECAT_ANDROID_KEY` and secrets `CF_ANDROID_KEYSTORE_BASE64`, `CF_ANDROID_STORE_PASSWORD`, `CF_ANDROID_KEY_ALIAS`, `CF_ANDROID_KEY_PASSWORD`. The keystore must be the retained upload key for this app; never regenerate it on each run.

Supply an explicit `version` such as `1.0.15` and an unused `version_code` greater than prior Play uploads. Gradle reads `CF_ANDROID_VERSION_NAME` and `CF_ANDROID_VERSION_CODE`. Setting `CF_ANDROID_STORE_RELEASE=true` requires version and signing settings; missing signing cannot silently produce an unsigned release. The workflow also rejects a missing or Test Store RevenueCat key at the Vite build gate, verifies the AAB against the expected upload certificate, and retains only the bundle, checksum and lint report. Temporary private signing material is removed even on failure.

This workflow produces an upload artifact; it does not publish to Google Play. On September 23, 2026 the retained production upload key was generated outside the repository, its four signing secrets were configured in GitHub Actions, and the app's real RevenueCat public key was configured as a repository variable. Never regenerate that key for subsequent builds. The existing unsigned qualification workflow remains useful for source checks.

The local release `1.0.15 (1)` passed `bundleRelease lintRelease` and strict signature verification against the retained upload certificate. Its manifest has package `com.creatorfootball.app`, target API 36, Billing Library 8.3.0, no advertising-ID permission and automatic backup disabled. App lint reports five warnings and no errors. This qualifies signing/packaging; Play processing and real sandbox purchase/restore tests remain separate gates.

The native app disables automatic Android cloud/device backup, including the legacy backup flag for API 24-30; use the explicit local career export/import flow. Android Back dismisses sheets first, navigates history next, then minimizes the app. Native export writes into `cache/career-exports/`; FileProvider grants access only to that directory. Dismissing the share sheet is a normal cancellation. No file is sent automatically.

## Release qualification

CI now builds `bundleRelease` and runs both debug and release lint. Its release artifact is explicitly labelled **unsigned qualification**, because the source workflow receives no signing credentials. Use `CF_PURCHASE_RELEASE_PLATFORM=android` for the Vite build before preparing a real store release (see [RevenueCat setup](REVENUECAT_SETUP.md)); a Gradle bundle alone does not validate commerce configuration.

The launcher uses the project's original vector football mark with an adaptive color layer, monochrome layer and API 24-25 fallback. See Android's [adaptive icon requirements](https://developer.android.com/develop/ui/compose/system/icon_design_adaptive) and [backup configuration](https://developer.android.com/identity/data/autobackup).

After installing the debug APK on the isolated `CreatorFootball_Expansion_QA` AVD, run:

```powershell
$env:ANDROID_HOME='C:/Users/IsacC/AppData/Local/Android/Sdk'
$env:CF_ANDROID_TEST_SERIAL='emulator-5556'
node apps/game/e2e/native-release.mjs
```

The test refuses other AVD names or physical devices. It changes lineup/training/accessibility through the real UI, saves, disables the emulator's Wi-Fi/mobile data, terminates and reopens the process twice, compares the entire saved career, and checks native export/share. Networking is restored afterward. This is persistence qualification, not a physical-device performance benchmark. Evidence and remaining limits are in [RELEASE_QUALIFICATION.md](RELEASE_QUALIFICATION.md).
