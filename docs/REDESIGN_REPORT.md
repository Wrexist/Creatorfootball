> Expansion update: see [EXPANSION_REPORT.md](EXPANSION_REPORT.md). Local saves only; no accounts, Supabase or cloud saves.

# Creator Football premium redesign — implementation and evidence

Implemented in the existing React game against `reference-ui/home-redesign.png`. The five navigation destinations, creation flow and management subroutes now share a forest/charcoal, lime and gold system, local typography, cinematic environments, consistent portraits and accessible controls. Home is a working composition connected to the current career, not an image of a dashboard. Existing custom managers, club colours, crests and kits keep their identities.

The redesign and repository completion pass are implemented and browser-verified. The [original 36-item audit](APP_AUDIT_2026-09-21.md) is historical; the [closure matrix](AUDIT_CLOSURE_2026-09-22.md) identifies the fixes, evidence and remaining external release gates. Changes are local and reversible; no release, push or deployment was performed.

## Review the implementation

- [Final screenshot gallery](../artifacts/redesign/final/index.html), with the 12 requested screens at 393×852 and comparisons at 390×844, 430×932 and 360×800.
- [Screenshot package](../artifacts/redesign/creator-football-redesign-screenshots.zip), including creation, subroutes, sheets, confirmations and accessibility modes.
- [Original app screenshots](../artifacts/app-audit-2026-09-21/index.html) and [first Home checkpoint](../artifacts/redesign/checkpoint-home-393.png).
- [Optimized asset pack](../artifacts/redesign/creator-football-premium-assets.zip), [asset review](../artifacts/redesign/asset-review/validation.json) and [complete changed-file inventory](../artifacts/redesign/changed-files.txt).

To request another design iteration, send an edited screenshot with its filename, for example `tactics-393.png`. Preserve the visible actions and real data; specify whether the change applies to that screen or shared components.

## Architecture and changes

`app/Shell.tsx`, `design/layout/Screen.tsx`, `TabBar.tsx` and `SectionNav.tsx` retain routing, analytics and safe-area ownership. `design/premium.css` supplies semantic colour/material/type tokens, focus and touch sizing, distinct screen treatments and accessibility overrides. Fonts are bundled Manrope and Barlow Condensed with OFL licences; no font service is required.

`design/premium/components.tsx`, `WorldScene.tsx` and `ClubCampus.tsx` add the club bar, character and page heroes, story/object cards, pulse rings and facility campus. Existing GlassButton/Panel/Sheet, modal, toast, form, pitch, lineup, progress, tooltip and loading/error/empty primitives are reused instead of replacing their tested interaction contracts. The existing Shell/AppShell and TabBar fulfil the GameShell/BottomGameNav roles.

Home, roster/profile, tactics, training, recruitment, match preview/live/result, Club, facilities, finance, sponsorship, social/press/media and progression have screen-specific work. Other subroutes inherit the shared scene, shell, typography and surfaces while retaining their controls. Live football remains the original code-rendered simulation. Generated pictures contain atmosphere and characters; functional text, scores, formation markers, charts and controls remain native components.

The career safety changes repair readable storage at quota, honest write failures, malformed-save recovery, backup preservation, ordered writes and stale-career operations. Match setup/results validate fixture ownership; the latest full report persists and reload does not advance twice. Training now executes in the weekly cycle, transferred players retire old contracts and leave both seller squads, social cash survives ledger merging, finance reports no longer double-count totals, and facility descriptions use the actual next-level effects. Match settings now control playback. Difficulty copy describes objective targets accurately; the shop is explicitly a catalogue preview with no simulated checkout.

## Asset pipeline and identity

The central [typed manifest](../apps/game/src/design/art/manifest.ts) maps characters, clubs, facilities/levels, objects/tiers, event categories and weather/time. [Persistent identity mapping](../apps/game/src/design/art/identity.ts) assigns adult player faces once, preserves mappings through reload/transfers and keeps procedural fallbacks for youth and custom identities. It adds optional versioned metadata without changing save version 5. Club artwork is selected only for matching authored identities; custom colour/crest and kit configurations retain their SVG rendering.

The pack contains **129 original assets / 387 WebP crops / approximately 8.34 MiB**:

| Category | Delivered |
|---|---:|
| Persistent Vera manager | 5 expressions, each with hero/card/thumbnail crops |
| Other original manager fallback | 1 neutral identity |
| Adult players | 24 stable portraits |
| Staff and creators | 8 portraits |
| Fictional club crests | 16 |
| Kit families | 4 |
| Environments, including expanded campus | 16 |
| Football and management objects | 27 |
| Match and story images | 12 |
| Trophies and achievements | 8 |
| Stadium weather/time ambience | 8 |

Full prompts, intended screens, source hashes, revision provenance, source regions, crop dimensions, formats and fallbacks are in [premium-assets.json](../apps/game/src/design/art/premium-assets.json) and [production jobs](../tools/brand/premium-jobs.json). The runtime index contains only asset types and paths. `tools/brand/optimise-premium.py` produces crops; `review-premium.py` verifies hashes/dimensions/budgets and creates phone-scale contact sheets. All thumbnails are below 20 KB. Final contact sheets were visually inspected; remaining sheet-edge bleed was cropped and incidental pseudo-lettering was removed in controlled image-editing jobs.

These are pre-rendered **2D images with a 3D art style**, not validated meshes. No runtime 3D dependency was added. Extra kit, equipment, weather and expansion-club artwork is a library for supported/future uses; it does not invent equipment, weather or purchasing mechanics. A future GLB pass must establish mesh/texture budgets, provenance, LODs, device profiling and engine-import validation before calling models game-ready.

## Completion pass: gameplay, saves and security

Availability now has one owner per clock: weekly recovery handles existing injuries, new injuries retain their full duration, and suspension is served only by missing an eligible fixture. Medical multipliers no longer add multiple neutral recovery rates together. Training still uses the existing development formulas.

Actual appearances, goals, clean sheets and honours feed agreed player bonuses. Playing-time promises count eligible bench time without penalising injured/suspended players. Sponsor goals receive match/follower progress and each renewal term has its own payment identity. Creator agreements persist retainers and signing dates, charge through the Ledger, disclose renewal terms and release expired creators. Legacy creator agreements without an agreed retainer remain explicitly free. Weekly financial reports reconcile with the Ledger's cumulative totals, including rollover payments.

Social match promises bind to the specified fixture. Binding captain, shirt-number and ticket-price polls perform their named change; unsupported kit/audio choices are clearly advisory. Negotiations age deterministically, enforce registration/deadlines/window/cash/budget/wages/embargo, use real standings and emit a signing event consumed once by objectives and world reactions. Scouting quotes show price, duration and expected confidence before selection. One scout credit covers one report; one facility credit discounts one upgrade by up to ?100,000, with unused value disclosed. AI rule cards have finite deterministic season allocations and cannot spend the human club's inventory.

The 50-season run exposed academy promotions without senior contracts. Promotions now establish a prospect contract and weekly validation repairs compatible older saves with the same omission. The final endurance run retains valid contracts for every senior player at all checkpoints.

Web saves combine a cross-tab Web Lock with revision checks. Stale tabs stop mutations and offer reload/export; failed writes show a persistent unsaved warning with retry/export. Match completion awaits persistence before result navigation. Large saves use a versioned gzip storage wrapper with a tested `fflate` fallback; the engine's version-5 save envelope and portable JSON export remain intact. Smaller legacy JSON saves continue to load. Browser runtimes without Web Locks receive an explicit save failure instead of silently risking concurrent writes.

Compatible dependency upgrades and targeted overrides clear the dependency audit. Dev/preview servers bind to loopback by default. GitHub workflows use verified action commit pins, read-only verification permissions, weekly dependency auditing and Dependabot. The production browser runner owns an ephemeral preview server and always closes it. iOS sync normalises managed Swift paths and validates each plugin package. A macOS workflow checks Xcode 26+ and builds an unsigned simulator app; it is prepared, not remotely executed. Toolchain requirements follow [Capacitor's environment documentation](https://capacitorjs.com/docs/getting-started/environment-setup) and the [GitHub macOS runner inventory](https://github.com/actions/runner-images/blob/main/images/macos/macos-26-Readme.md).

## Verification

| Gate | Result and evidence |
|---|---|
| Unit/integration tests | **931 passed: 746 engine tests in 61 files; 185 app tests in 18 files.** [Full log](../artifacts/redesign/completion-tests.txt). The final fflate patch was followed by the 11 relevant save/codec/coordinator tests, full typecheck/build and browser rerun. |
| Lint, typecheck, build | Passed without weakened rules. [Lint](../artifacts/redesign/completion-lint.txt), [typecheck](../artifacts/redesign/completion-typecheck.txt), [build](../artifacts/redesign/completion-build.txt). The engine bundle size warning remains documented below. |
| Formatter/whitespace | No formatter is configured. Existing conventions retained; `git diff --check` passes. |
| Dependency security | **Zero advisories**, all severities. [Final audit](../artifacts/redesign/dependency-audit-final.json). This is a package-advisory result, not a guarantee of vulnerability-free software. |
| Simulation, economy, invariants | All full audits pass, including 1,000 matches, 100 independent economy seasons, multi-season legality, event provenance and save integrity. [Log](../artifacts/redesign/completion-audits.txt). |
| Production browser integration | Real fresh creation, persisted seven-player lineup, formation/tactics, hard technical training, empty market search, live pause/substitution/completion, result/reload, stale-tab conflict/export, keyboard focus and 320/375/393/768/1440 layouts. [Log](../artifacts/redesign/completion-browser.txt). |
| Human transfer | Real negotiation signed Salim Rios; cash and transfer budget each charged **?103,604**; registration/contract persist after reload. Signing event advances an objective and produces an event-backed world story once. [Browser](../artifacts/redesign/completion-market.json), [consequences](../artifacts/redesign/completion-signing-consequences.json). |
| Credits | Isolated earned-credit fixture redeemed through real UI: scout credit charged ?0, next report charged ?12,000; ?900,000 training upgrade charged ?800,000 with one facility credit. Both credits remain consumed after reload. [Evidence](../artifacts/redesign/completion-credits.json). |
| Match/settings/club actions | All four speeds, presentation/commentary/timeout, facility construction/cost/effect, press/community/creator actions and persisted accessibility settings verified. [Match](../artifacts/redesign/phase4.json), [preferences](../artifacts/redesign/preferences-flow.json), [construction](../artifacts/redesign/construction-flow.json), [social](../artifacts/redesign/social-flow.json). |
| Save failure and recovery | Persistent quota warning, successful retry, export, stale-tab prevention, Chromium renderer crash/reopen and corrupt-primary backup recovery. A completed 50-season career boots and saves below the tested quota. [Evidence](../artifacts/redesign/completion-storage.json). |
| Edge states | Injury/suspension exclusion, insufficient cash, closed market, empty feed, art fallback and invalid fixture. [Evidence](../artifacts/redesign/edge-flow.json). |
| Responsive/visual | **70 checked views** covering the 12 requested screens at 393?852, 390?844, 430?932 and 360?800 plus subroutes; **zero overflow, broken images or visible controls below 44 px**. [Screen checks](../artifacts/redesign/final/screens.json). Supplemental sheets and accessibility states pass. [Evidence](../artifacts/redesign/final-states.json). |
| Native preparation | Capacitor sync and portable Swift plugin paths pass locally. [Log](../artifacts/redesign/completion-ios-sync.txt). The unsigned macOS workflow, signed archive and physical iPhone have not run here. |
| Published support/privacy links | Marketing, support and privacy URLs returned HTTP 200 with expected titles and HTTPS/HSTS. [Observed headers](../artifacts/redesign/published-links.json). No deployment was changed. |

Screenshots and browser checks use isolated careers, never personal saves. Simulation balance and season rules were preserved; changes repair demonstrated integration defects. The [semantic contrast check](../artifacts/redesign/contrast.json) and phone-size visual review supplement, but do not replace, assistive-technology qualification. The final gallery includes the main screens, their lower sections, creation, details, confirmations, negotiations, save recovery and credit decisions.

## Performance and endurance

The original [paired baseline/redesign measurement](../artifacts/redesign/performance-comparison.json) and the final [completion measurement](../artifacts/redesign/performance-completion.json) retain raw data. Both use isolated local production Chromium contexts at 393?852, three cold-load trials per CPU rate, and 12 seconds of live sampling. The final pass preloads primary feature chunks and allows incoming pages to mount during the outgoing transition. These local runs have no mobile-network shaping and are not physical-phone results; the final pass was measured separately from the earlier baseline.

| Measurement | Original baseline | Final completion |
|---|---:|---:|
| Normal CPU, median first contentful paint | 68 ms | 76 ms |
| Normal CPU, Home ? visible Squad + two frames | 906 ms | 518 ms |
| Normal CPU, live-frame p95 | 16.8 ms | 16.7 ms |
| 4? CPU throttle, median first contentful paint | 268 ms | 224 ms |
| 4? CPU throttle, Home ? visible Squad + two frames | 1,286 ms | 1,149 ms |
| 4? CPU throttle, live-frame p95 | 33.4 ms | 33.4 ms |
| Initial Home art requested | 78,930 B | 204,858 B |

Home imagery remains below the 650 KB eager-image budget; portrait thumbnails stay below 20 KB. Secondary art is lazy loaded and reduced-effects mode avoids expensive overlays. Navigation includes mounting and visibility observation, not just input response; it remains above the desired budget, especially under throttle. The final throttled live sample has three long tasks (maximum 92 ms); normal playback had none in that sample. This supports further device profiling, not a claim of universal smoothness.

The engine bundle is approximately **874 KB / 285 KB gzip**, still above Vite's warning threshold. The known circular-bundle risk was avoided; boot is verified. A worker/bundle restructure is deferred until device traces establish a useful boundary, rather than changing deterministic simulation architecture speculatively.

The [50-season audit](../artifacts/redesign/long-career.json) measures seasons 1/5/10/20/50 and verifies ledger integrity and reloads at each point:

| Completed seasons | JSON bytes | Compressed primary + backup storage bytes? | Median weekly advance? |
|---|---:|---:|---:|
| 1 | 1,020,703 | 695,592 | 93 ms |
| 5 | 2,008,418 | 1,183,416 | 227 ms |
| 10 | 2,754,261 | 1,448,424 | 238 ms |
| 20 | 3,244,233 | 1,761,480 | 376 ms |
| 50 | 3,326,714 | 1,783,720 | 365 ms |

? UTF-16 storage accounting, including base64 wrapper. Actual browser primary/backup/identity storage after the final save was **1,801,342 bytes**; the uncompressed 50-season primary+backup would require about 13.3 MB. ? Node measurements on this desktop, with other qualification work sometimes active; not phone timing. The 50-season checkpoint has 391 players, 293 contracts, no senior without a contract, and a smallest club senior squad of 15. Browser boot to settings took 1,937 ms for that career. Busy feedback appears before weekly work.

## External release gates and next task

The highest-impact next task is **run the prepared macOS workflow and qualify the app on a representative iPhone**: sign/archive, cold launch, background/kill/reopen during save and full time, VoiceOver, native safe areas, haptics, long matches, heat, storage pressure and navigation traces. Desktop renderer-crash recovery is proven; native process interruption and storage durability are not inferred from it. No Mac, physical phone or signing credentials were available here.

The repository targets web and an iOS shell. Android packaging is absent and is no longer described as a supported release. The store remains a clearly labelled catalogue preview, and extra content is not sold without entitlements/delivery. No external account backend or checkout was invented.

The existing GitHub Pages marketing host returned HSTS but no CSP, frame, MIME or referrer-policy response headers in the observed responses. Host-level hardening and deployed game-origin policy need a deployment decision; no production configuration was silently changed. Generated artwork uses original fictional identities, but this work is not legal trademark clearance.

Automatic approval review previously blocked recursive cleanup of the temporary benchmark copy. Its worktree registration and server were removed; remaining files are under `artifacts/redesign/performance-baseline`. The project's lint rules were not weakened. This does not affect the shipped app or screenshot package.
