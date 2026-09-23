# Creator Football expansion checkpoint — September 22, 2026

The user's final provider choice is implemented: **local careers and RevenueCat, without Supabase, game accounts or cloud saves**. Existing gameplay and save-version rules remain intact. This report supersedes the earlier report's statements that Android packaging, native purchase integration and runtime 3D were absent.

## Delivered source and behavior

- **Android:** Capacitor native project, branded launcher/splash, portrait shell, dark system bars, safe-area handling, hardware Back behavior, disabled automatic cloud/device backup, native file sharing, release-signing environment configuration and CI. A debug APK is built and tested in an isolated API 35 Android emulator. Existing emulator data was not changed.
- **Local careers:** Settings and title-screen access to Local saves; validated portable JSON export/import; preview and confirmation before replacement; previous-save inspection; recovery imports even when both on-device saves are corrupt. A failed replacement write keeps the live career. Files are limited to 8 MB; the existing 50-season qualification file is 3.33 MB. Android opens its real share sheet without sending a file automatically.
- **RevenueCat:** Native Apple/Google SDK integration, anonymous store identity, signed entitlement verification, localized prices, one purchase/restore operation at a time, cancellation/pending/error handling, restore and revocation. Save files and localStorage ownership flags cannot grant paid access. SDK diagnostics are disabled; no career data is sent to RevenueCat. Web and builds missing SDK keys explain unavailable checkout without inventing prices or purchases.
- **Content:** Three implemented one-time collections and a free Touchline Voices pack. Each career saves its selection. The 16 alternate commentary lines and 12 authored media versions keep the base template IDs, conditions, weights, sentiments and ordering. The tests prove presentation changes do not alter this gameplay metadata. Historical reports remain unchanged when disabling content.
- **Runtime 3D:** A separately loaded interactive club campus, classic/sash/hoops/pinstripe shirts, trophy and football. Club colours and facility levels drive the scene. Lighting and finishes are entitlement-gated. Rotate, zoom and reset work through touch or labelled controls. Rendering stops while idle and hidden; WebGL failure/context loss returns to existing illustration art. Reduced-effects users opt in explicitly.

These are seven real, original procedural GLB meshes, not raster images described as 3D models. The optional viewer is a scale-model collection; it does not turn the match simulator into a 3D match engine or supply rigged player characters. The normal cinematic screens retain the previously optimized art.

## Asset pipeline and budgets

Source: `apps/game/scripts/build-club-models.mjs`. Rebuild with `node apps/game/scripts/build-club-models.mjs`.

`apps/game/public/models/manifest.json` records source and asset hashes, provenance, project ownership, sizes, triangles, draw counts and Khronos validator results. `apps/game/src/world3d/manifest.ts` supplies typed keys, scene paths, labels and existing-art fallbacks.

All seven assets pass glTF validation with **zero errors and zero warnings**. The largest is the campus: **301,240 bytes, 2,804 triangles, 41 draw calls** at full level. All models together are approximately 0.81 MB, with no external textures. The viewer caps pixel ratio at 1.5 and loads Three.js only after opening 3D. Its 643.68 kB minified renderer chunk (163.46 kB gzip) produces Vite's default size advisory; that threshold was not weakened. It is absent from Home requests.

Browser and emulator render samples are JavaScript submission timings, not physical-phone GPU measurements. Browser checks verify no idle draw loop and budgets below 90 draw calls/50,000 triangles. The GLB loader is exercised for all seven files, including the three paid shirt variants.

## Verification and evidence

| Check | Evidence / result |
| --- | --- |
| Engine tests | 746 passed; existing simulation preserved |
| App tests | 203 passed, including receipt boundary, native adapter contracts, content metadata, import validation, failed writes and cancellation of a waiting import |
| Workspace typecheck | Pass, `artifacts/expansion/typecheck.txt` |
| ESLint | Pass with zero warnings, `artifacts/expansion/lint.txt`; only the downloaded Gradle distribution/cache is excluded from source lint |
| Formatter | No separate formatter is configured in this repository |
| Production build / Capacitor sync | Pass, `artifacts/expansion/build.txt`; all seven native plugins registered on both platforms |
| Production dependency audit | No known vulnerabilities, `artifacts/expansion/dependency-audit.txt` |
| Gameplay browser smoke | Route render/overflow/overlap checks and creation → tactics → training → search → live substitution → result → reload/save conflict, `browser-all.txt` |
| Expansion browser flows | Save export, invalid import protection, confirmed import, corrupt-save recovery, pack persistence, unavailable checkout, 3D controls/idle rendering and 360/393/430-width layouts, `browser-expansion.txt` |
| Paid presentation QA | All lighting/kit/trophy variants, ownership revocation and context-loss fallback, `paid-pack-qa.txt`; **injected development ownership, not store transactions** |
| Android build and lint | APK assembly and lint pass, `android-final-build.txt`; lint has 0 errors and 21 template/toolchain/orientation/resource advisories, retained for visibility |
| Android runtime | Native plugin availability, persisted career, pack selection, 3D, Back closes sheets, real export share sheet and reload, `android-runtime.txt` |

Screenshots are in `artifacts/expansion/screenshots`, `android-screenshots` and `paid-pack-qa`. The gallery and downloadable screenshot bundle are in `artifacts/expansion`. Native screenshots show the actual Android status/navigation bars and sharing sheet. Paid QA images are explicitly separated from real purchase evidence.

## Principal changed files

- `apps/game/src/commerce/`: catalog, RevenueCat adapter, serialized controller, store, lifecycle bridge, content data and tests.
- `apps/game/src/features/progression/`: Store, Content packs, Local saves and Settings integration.
- `apps/game/src/platform/`: import/export, native Back support; existing storage remains local.
- `apps/game/src/state/gameStore.ts`, `state/content.ts`: validated career replacement and selected content registry.
- `apps/game/src/world3d/`, `scripts/build-club-models.mjs`, `public/models/`: lazy viewer, controls, fallbacks, authored models and manifests.
- `apps/game/src/app/`, onboarding and `design/premium/ClubCampus.tsx`: routing, corrupted-save recovery access, optional 3D entry and initialization.
- `apps/game/android/`, iOS privacy manifest/project/SPM paths, Capacitor configuration, safe-area tokens and `.github/workflows/android.yml`.
- Native/browser expansion scripts, public-key environment example, signing-file ignores, dependency lockfile, updated privacy/support/store documentation.

## Follow-up qualification

The next local pass hardened public purchase configuration and listener recovery, corrected Android resources/backup flags, restricted career-export sharing and verified offline process-death persistence. See [RELEASE_QUALIFICATION.md](RELEASE_QUALIFICATION.md) for the newer build, 220 app tests, unsigned bundle and native screenshots. The original artifacts below remain an earlier checkpoint.

## External release gates

1. **RevenueCat keys and products are not supplied.** The app integration and local tests are complete, but actual Apple/Google checkout, receipts, reinstall restoration and refunds are not claimed tested. Follow [REVENUECAT_SETUP.md](REVENUECAT_SETUP.md) for the exact three product/entitlement IDs and required sandbox scenarios.
2. **The APK is debug-signed.** Store upload signing, Play internal testing and final release listing are still required. See [ANDROID_BUILD.md](ANDROID_BUILD.md). Nothing was published or charged.
3. **iOS needs macOS/Xcode and signing.** The native source, In-App Purchase capability, Filesystem privacy reason and portable package references are prepared. Windows cannot validate an iOS archive or its merged privacy report.
4. **Physical-phone qualification remains open.** Check thermal load, GPU performance, TalkBack/VoiceOver, process interruption and storage pressure on representative devices. Emulator success is not a claim about physical-device performance.
5. **Further 3D art production is separate from this functional viewer.** Bespoke rigged characters and cinematic runtime environments would need a dedicated model/art pipeline and additional device profiling.

The highest-impact next step is to configure the RevenueCat products/public SDK keys and complete real store sandbox purchase/restore/refund tests with the prepared native builds.

## Download artifacts

- Debug APK: `artifacts/expansion/Creator-Football-debug.apk` (SHA-256 `0ea1a8230a7f1c7c1415afb7d9da9998aaad9c50aef54e15a9c00f0ae0076832`).
- Screenshot gallery: `artifacts/expansion/index.html`; 27 screenshots in `Creator-Football-expansion-screenshots.zip`.
- Machine-readable summary: `artifacts/expansion/verification-summary.json`.
