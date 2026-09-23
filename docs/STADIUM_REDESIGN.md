# Interactive stadium progression

The supplied campus concept guides the architecture, layered landscaping and warm light. The stadium remains a real, orbitable Three.js/GLB scene. Existing simulation, facility costs, construction timers, local saves and purchase entitlements remain authoritative.

## Asset specification

- Original source-authored geometry; no external model, paid provider or image-generation job.
- One consistent pitch and site, six exclusive stadium configurations keyed to completed facility levels 0–5. Level 0 has a portable stand; level 3 has an enclosed, roofed ground; level 5 has a signature canopy and two tiers.
- Other campus buildings follow their own completed levels, not the stadium level. Planned construction does not unlock completed geometry.
- Read-only Start / Mid-game / End-game previews show example facility configurations and never write career data or purchase ownership.
- Charcoal structure, pale satin roof, club-colour seating, warm glazing, landscaped avenues and clean pitch markings. No rasterized UI or fictitious sponsor text.
- Existing per-file ceilings: 1.5 MB, 50,000 triangles, 90 material batches. Actual visible draws and triangles checked after GPU import. Lazy renderer, capped DPR, on-demand frames and explicit reduced-effects opt-in retained.
- Generate with `corepack pnpm assets:models`; validate every GLB with gltf-validator, preserve source and output hashes in `public/models/manifest.json`, inspect real renders at 393×852 and Android WebView.

The optional game-dev CLI is unavailable here. These are project-authored runtime meshes validated through the existing exporter/validator and application, not a claimed game-dev package or image concept represented as a model.

## Implementation

- `apps/game/scripts/campus-model.mjs`: new rounded site, landscaped entrance, six stadium configurations, seat sections, glazed concourses, canopy, pitch markings, goals, pavilions and training grounds. Each facility grows from its own completed level.
- `apps/game/scripts/build-club-models.mjs`: material batching, indexed geometry and removal of unused texture coordinates; generated GLB validation, source-file hashes and output hashes. Original kit/ball/trophy collections retained.
- `apps/game/src/world3d/manifest.ts` and its tests: exact stage visibility, safe level bounds, construction isolation and three explicit preview configurations.
- `ModelViewer.tsx`: tighter camera composition, antialiased rendering, cached directional shadows, balanced lighting, compact controls and live stage changes without reloading the renderer or moving the camera. No idle animation loop. Reduced effects disables shadows and lowers pixel density.
- `Club3DScreen.tsx` / `campus.css`: current club figures, progression selector, descriptive stages and a real next-upgrade card from the facility registry. Cost/timing and management navigation use existing engine actions. Preview mode never changes the save or unlocks content.
- `apps/game/e2e/paid-packs.mjs`: screenshot locator follows the model viewer after the heading redesign; purchase/revocation assertions retained.

## Progressive edge blur

The preceding request is included in this build: reusable `design/glass/GradualBlur.tsx` / `.css`, top and bottom integration in `Screen`, `TabBar` and `HomeScreen`, and shared styles in `premium.css`. Three masked blur bands fade scrolling content while controls stay sharp and interactive. Reduced effects, high contrast and reduced transparency use the inexpensive tint fallback. The top scroll-edge blur hides at rest so the initial page heading remains readable. The existing hero module re-exports the same primitive.

## Visual verification

Actual 393×852 browser captures are in `artifacts/stadium-progression/`: `start.png`, `mid-game.png`, `end-game.png`, and `your-club-initial.png`. `progression-comparison.png` arranges the actual scene screenshots for comparison; it is not a concept render. Native Android screenshots use the `android-` prefix. Additional checks cover 360×800, 390×844 and 430×932, reduced effects and lost-WebGL fallback. All three progression views were visually inspected in the browser and the end-game native capture was inspected separately.

The matching screenshot for each stage is available inside the game at **Club → Explore in 3D → Open interactive 3D → Start / Mid-game / End-game**. **Your club** restores the actual completed facilities. The preview label remains visible, and the current club statistics retain their real values.

## Measured model budget

| Measurement | Result |
| --- | --- |
| Campus GLB | 1,263,896 bytes |
| All six configurations stored together | 28,288 triangles; 88 material batches |
| Start render, including shadow pass | 24 calls; 7,864 triangles |
| Mid-game render, including shadow pass | 57 calls; 16,016 triangles |
| End-game render, including shadow pass | 78 calls; 22,508 triangles |
| End-game reduced effects | 55 calls; 13,808 triangles |
| Idle viewer | No additional frames |
| Seven generated GLBs | Zero validator errors or warnings |

CPU render-submission measurements were collected in `metrics.json` and `native-results.json`; these are software-GPU emulator/browser measurements, not GPU frame timings or physical-phone performance claims. The existing 1.5 MB / 50k triangles / 90-batch limits were kept. Source/output provenance is in `apps/game/public/models/manifest.json`.

## Checks and delivery

- Workspace typecheck and zero-warning ESLint pass. No formatter is configured in this repository.
- Production build and Capacitor sync pass. The existing lazy Three.js chunk-size advisory remains; its warning threshold was not changed.
- Production browser checks pass: fresh career, lineup/tactics/training, search, live substitution, result/reload, local export/import/recovery, save conflict handling, responsive controls and all four 3D collections.
- Dedicated progression checks pass: correct levels, unchanged save bytes, orbit/zoom/reset, idle rendering, reduced-effects opt-in, context-loss fallback and facilities navigation.
- Development-only entitlement checks pass: lighting presets, kit patterns, trophy finishes and revocation fallback. These are simulated ownership tests, not RevenueCat transactions.
- Android API 35 emulator: native installation, progression renders, unchanged saves, pointer orbit, controls and idle rendering pass. Debug APK builds successfully and is copied to `artifacts/stadium-progression/creator-football-stadium-debug.apk`.
- Progressive-blur browser checks pass again against this final build, including safe areas, sharp match actions, navigation and modal controls.

The detailed logs and reproducible review scripts are alongside the screenshots. The full suite passes: **746 engine tests + 224 app tests = 970 tests**, across 86 test files. The Android debug APK SHA-256 is `f9fb9710c7cc74ec6c1b20826f6cc3a37ca3daa02f4822a6e16845bb96a4e7a8`.

## Limits and next useful check

This remains a stylized architectural miniature with original runtime geometry. It does not claim the photorealistic asset density of the supplied concept. No external model licences or paid asset services were introduced. Gameplay formulas, save format, local-only persistence and RevenueCat integration remain unchanged by the stadium work.

The next hardware check is a representative physical Android phone and iPhone: verify sustained drag responsiveness, GPU memory and progressive blur under thermal load. A physical phone and iOS runtime were unavailable in this Windows session. No live purchase, release signing or store upload was performed.
