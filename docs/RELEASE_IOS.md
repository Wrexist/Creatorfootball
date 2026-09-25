# iOS release through the existing GitHub workflow

The repository already has a working `iOS TestFlight` workflow and Apple signing secrets. The successful [build 6 run](https://github.com/Wrexist/Creatorfootball/actions/runs/34063109215) archived and uploaded version 1.0.14. A physical Mac is not required: GitHub supplies the macOS runner.

The current asset branch has restored `.github/workflows/ios-testflight.yml` and `tools/release/next-build-number.mjs` from the successful source branch. Existing secret names are `APPLE_TEAM_ID`, `APP_STORE_CONNECT_KEY_ID`, `APP_STORE_CONNECT_ISSUER_ID`, and `APP_STORE_CONNECT_API_KEY_BASE64`. Do not print their values or export them into the web build.

Before running the updated workflow:

1. Complete the Creator Football RevenueCat iOS configuration and set the public SDK key as GitHub repository variable `VITE_REVENUECAT_IOS_KEY`.
2. Publish the reviewed current source to a release branch; the old remote source does not contain the local redesign.
3. Dispatch `ios-testflight.yml` on that exact branch with a new marketing version (next candidate: 1.0.15) and `submit=true` when the build is ready for TestFlight.
4. The workflow checks lint, types, tests, production build and smoke flows before archiving with the existing Apple credentials. It resolves the next build number from App Store Connect, then exports and optionally uploads the archive.
5. Verify the processed build in App Store Connect, test purchases/restoration in TestFlight, and attach the qualified build to the release version. TestFlight upload does not publish the public app.

The restored workflow pins action revisions and sets `CF_PURCHASE_RELEASE_PLATFORM=ios`. Missing or invalid RevenueCat configuration fails the production build. Never weaken that gate to upload a build with unavailable purchases. An existing debug APK, unsigned simulator build, or mock purchase test does not qualify native store payments.

Release runs use the build-number helper's `--require-asc` option. Failed or missing App Store Connect access stops the build instead of substituting a timestamp. The workflow captures that command separately so its error cannot be hidden by a successful `echo`. The script's older fallback remains available only for callers that do not request authoritative release numbering.

See [store setup status](STORE_SETUP_STATUS.md) for console IDs and unfinished submission requirements, and [RevenueCat setup](REVENUECAT_SETUP.md) for product mappings and required transaction tests.

## Certificate-cap repair (25 September 2026)

The reward build failed during archive because automatic development signing on a fresh runner reached Apple's certificate cap. No certificates were revoked and no permissions changed. The archive now compiles without an intermediate development signature; the existing authenticated App Store export must apply distribution signing. A new mandatory gate verifies the exported app's deep/strict signature, team ID, exact app identifier, disabled debug entitlement and App Store provisioning profile before artifact retention or upload. This is not an unsigned release path.

Cloud export reference: https://developer.apple.com/videos/play/wwdc2021/10204/. The revised archive/export path must succeed on the hosted macOS runner before being called validated. Creator Football currently has no custom entitlements or app extensions; future capabilities require explicit export-entitlement tests.
