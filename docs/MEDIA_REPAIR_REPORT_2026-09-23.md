# Creator Football — mobile media repairs

This implements the 31 items in [the supplied-media audit](USER_MEDIA_AUDIT_2026-09-23.md), plus the two visual defects previously recorded in the launch PR. The simulation formulas, match results, accounting formulas, saved identities and local-save format remain intact. The Google children-compliance hold remains in place.

## Repair coverage

| Audit IDs | Implemented change | Evidence |
| --- | --- | --- |
| G01–G02 | Display names and handles have independent layout. FitText measures off-screen using canvas; FitBox uses an isolated measuring clone. Width changes drive fitting; height changes cannot reset the font repeatedly. | Idle text/geometry checks in the actual feed, shared result-post component and finance report. |
| G03–G05 | Top/footer transitions reduced to 12 px; protected navigation surface retained; header/nav height reduced; duplicate active-tab marker removed. Content scroll padding and safe-area support retained. | Phone screenshots, simulated safe-area fixture, primary-route hit testing. |
| G06 | Neutral ratings, visible roles/status, larger-text-aware fitted labels, readable manager accents and accessible web zoom. | Five viewport widths, both text sizes, token geometry checks and rendered screenshots. |
| M01 | All ten premade managers now have a consistent five-expression set and three crops. Added nine neutral portraits plus 36 expression renders. Custom choices retain their authored vector identity; image failure has a deterministic fallback. | 50 manager expressions inspected at hero and 96 px portrait sizes; manifest coverage tests. |
| M02–M03 | Compact comparison cards show strength/tradeoff, with full biography and numeric effects on selection. Clear selection stripe/tick and disabled continuation instruction. | Manager selection and keyboard onboarding captures. |
| C01–C03 | Calm stadium backdrop, integrated crest/kit presentation, native SVG kit shading, less repeated club copy and a quieter headline. | Club reveal screenshot at 393×852. |
| C04 | Explicit onboarding continuation, named dialog, focus containment/restoration, scoped keys and scrollable short-screen layout. | Art tap cannot advance; keyboard focus stays in the reveal. |
| T01, T05–T06 | Shared schematic formation rows reserve real space for each token; long labels grow their row. Thin pitch frame, clearer plates and a compact adjacent formation/action toolbar. Engine anchors are unchanged. | All 13 formations at 360, 390, 393, 430 and 768 px, standard and large text. |
| T02 | Separate named substitutes/reserves; direct bench/reserve exchange. Bringing a reserve into the starting team preserves the existing named bench when full, leaving the outgoing starter in reserves. | Movement unit tests and real UI bench exchange. |
| T03 | Visible position, rating, fitness, injury/suspension/out-of-role labels; selected-player strip includes full name and explains movement. | Long-name, injury, suspension, fatigue and selection fixtures. |
| T04 | New senior squad assignments use all unused portraits before falling back to deterministic procedural art. Existing saved assignments are never silently changed. | Uniqueness, reload, transfer, historical-collision and youth tests. |
| R01–R04 | Smaller masked portrait with headroom, explicit team/home-away labels, clear outcome and accurately labelled total attendance. | Win/draw/loss fixtures and actual completed career match. |
| R05–R06 | Stage count, meaningful Next labels and View full report. Strong narrative imagery stays in the hero; later stages use a calm surface. | Result navigation, Analytics, completed-result reload and single-advance checks. |
| F01–F02 | Club-linked coverage precedes a labelled league roundup; empty coverage is honest. Read-only engagement is text. Report news opens its actual story; URL-driven selection prevents a render loop. | Club-reference unit tests, story-opening interaction test, empty-feed fixture. |
| F03–F04 | Rout headlines use actual margin/score. Removed fabricated match sequences, venue assumptions, fixed growth/reach claims and 90-minute claims from relevant copy. The final screenshot pass also corrected home-win posts thanking an away end, fixed player-count claims after red cards and a margin wrongly described as an xG difference. Existing published stories in old saves are preserved. | Engine media tests, template factuality guards, saved-cycle inspection and current report screenshots. |
| F05–F06 | Weekly income/cost pair plus full-width available transfer budget. Table movement shows previous/current rank when a pre-round snapshot exists; reload shows current position honestly. | Stable finance geometry, unchanged ledger arithmetic and save/reload tests. |
| Earlier tablet defects | Matchday lineup/bench columns respond to actual content width; predicted lineup uses safe readable rows. Stadium reputation is rounded for display. | 768×1024 and 1024×1366 Matchday captures; fractional-reputation fixture. |
| Native follow-up | Reduced-effects Home previously made the manager translucent. It now uses an opaque portrait with a simple rounded surface. The injury fixture explicitly selects the pitch token even when that player is also captain. | Reduced-effects opacity assertion, Android emulator inspection and release-workflow regression. |
| Release follow-up | Content-pack toggles show a saving state until the local write completes. The enabled confirmation can no longer precede storage completion during a fast reload. | Browser expansion check inspects the saved pack list before reloading; existing storage-failure and ordered-write tests remain active. |

## Assets and ownership

- Typed runtime index: `apps/game/src/design/art/premium-index.ts`.
- Prompts, intended screens, crop regions, source hashes, provenance and fallbacks: `apps/game/src/design/art/premium-assets.json` and `tools/brand/premium-jobs.json`.
- 45 additional character generations produce 135 WebP files. All portrait artwork is pre-rendered imagery, not runtime 3D.
- Source ingestion: `tools/brand/ingest-manager-cast.py`; optimisation: `tools/brand/optimise-premium.py`.
- Main code owners: shared typography/chrome/overlay primitives; creation/reveal screens; tactics and Matchday presentation; result/media screens; news copy and stable identity adapters.

## Verification

The final verification log and screenshot gallery live in `artifacts/media-repair-20260923/`. Browser state and generated source working files are excluded from the portable evidence package.

Implementation source: `2a926c3`. Reproducible remote evidence: [CI and simulation audits](https://github.com/Wrexist/Creatorfootball/actions/runs/35864913779) and [iOS 1.0.16 archive workflow](https://github.com/Wrexist/Creatorfootball/actions/runs/35864912564). The iOS run uses `submit=false`: building an IPA does not replace the existing TestFlight upload. Run completion and native artifact checksums are recorded with the local evidence package.

- Repository lint and typecheck.
- Full unit suite: 753 engine tests and 245 app tests (998 total, including two additional factuality guards).
- Production build, with the existing large engine/3D chunk warnings retained rather than suppressed.
- Production browser suite: existing smoke, career and expansion checks plus `media-audit.mjs`, `media-matrix.mjs` and `media-states.mjs`.
- Existing tests cover real creation, lineup, tactical instructions, training, search, live substitution, match completion, save reload/conflicts/export/import/recovery, unavailable purchases, optional content and 3D imports/controls.
- Added checks cover 130 formation/viewport/text combinations, stable author/card geometry, modal focus, bench exchange, portrait swiping, cancelled drag, story deep links, unavailable players, missing images, empty states, three result outcomes, simulated safe areas and tablet preparation.
- Android `1.0.16 (3)` debug APK and unsigned release bundle compile with `assembleDebug bundleRelease lintDebug lintRelease`. App lint retains five existing warnings and zero errors. On the dedicated Android 15 emulator, the packaged app preserves an existing career, saves a lineup swap through reload, confirms a content-pack choice only after storage, runs/pauses/finishes a match and reloads its result. The reduced-effects portrait and finance geometry also pass.
- Evidence includes 44 phone/tablet/native captures and artwork sheets, a short production-browser report recording, a changed-file list and manifests. The Android binaries are separate from the screenshot ZIP; the AAB is unsigned qualification output, not a store upload.
- No standalone formatter command exists in this repository. Lint and whitespace checks use the project's existing configuration.

## Qualification limits

The phone/tablet web captures are Chromium evidence, and the separately labelled Android captures come from the installed APK in an emulator. Physical iPhone/Android scrolling, heat/memory, VoiceOver/TalkBack and signed-build purchase flows require device qualification. Browser/emulator tests are not a claim that those physical checks passed. Newly generated artwork does not change purchase products or entitlements.

Store submission, the publisher's children-law certification, native purchase/refund qualification and Google closed-test requirements remain separate launch gates. This repair pass does not override the publisher's compliance hold or submit either app publicly.
