# Premium redesign migration

Reference: `reference-ui/home-redesign.png`; full brief: `CREATOR_FOOTBALL_MASTER_PROMPT_FOR_ASTRA.md`.

## Phase 0 — current boundaries

React 19 / Vite / Tailwind 4 / Zustand, with a pure TypeScript simulation engine and Capacitor iOS wrapper. `app/Shell.tsx` owns routes, animation and navigation. `design/layout/Screen.tsx` owns management-page headers, scrolling and safe areas. Live match and results are immersive exceptions. Feature ownership follows `docs/INTEGRATION_CONTRACT.md`; this migration spans presentation workstreams under the user's repository-wide authorization.

`state/gameStore.ts` owns career mutations and persistence; `state/matchStore.ts` owns transient simulation playback. All displayed values/actions must continue through existing engine selectors and bridges. Saves remain backward compatible. New visual identity metadata will be additive, versioned and stable across reloads; procedural portraits/crests remain failure fallbacks.

The immediately preceding audit captured 85 baseline images at 393×852 plus desktop, built and checked the same source, and passed 891 tests on completed runs. Its 36-item backlog is in `APP_AUDIT_2026-09-21.md`. Reuse those findings; do not restart the audit. Add 390×844 and 430×932 comparison captures and before/after timing for this migration.

Risk areas: nested page scroll and fixed navigation, match UI frame frequency, async save failures, matching fixture/result identity, settings disconnected from playback, transfer contract cleanup, training execution, and social-ledger propagation. Fix demonstrated defects when they block the required verification flows; preserve existing simulation balance and season rules.

## Migration gates

- [x] Phase 0: baseline sizes/timings and preservation inventory.
- [x] Phase 1: semantic theme, shared shell/navigation, typed art manifest, Home; visual check at 393×852 and core navigation before expansion.
- [x] Phase 2: Squad, player dossier, Tactics and Training; select team, formation and training.
- [x] Phase 3: Market/scouting/transfers, finance and sponsorship; maintain filters, costs and contract integrity.
- [x] Phase 4: preview/live/results; playback speeds, substitution, result commit and reload.
- [x] Phase 5: Club/facilities/fans/world/social/creators/history/objectives; actual state-backed consequences.
- [x] Phase 6: complete generated asset pack and provenance, stable mappings, responsive crops and fallbacks.
- [x] Phase 7: browser responsive/accessibility/performance checks, repository checks, screenshots and report. Physical-device/native release qualification remains open.

## Asset and performance policy

Use pre-rendered 3D-style raster art. No new real-time 3D runtime or unvalidated GLB claims. UI copy, charts, crests' labels and interactions stay in code. Original fictional identities only. Generated prompts, purpose, crop, fallback and provenance are recorded in the asset manifest.

Target a lower-end 4 GB phone with a 60 Hz display; no physical phone is attached, so device qualification remains explicitly unverified. Initial Home art budget: ≤650 KB compressed eager imagery, no more than one large background plus one character decode. Portrait list thumbnails ≤20 KB each; secondary scenes lazy load. Navigation/frame budgets: aim for <100 ms interaction response and avoid added per-tick React work in live match. Compare measured browser results rather than claiming a physical-device frame rate.

Required checks: `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build`, production-browser smoke and focused real-flow verification. The repository has no formatter script; preserve existing formatting and use `git diff --check`. Do not weaken checks.

## Preservation inventory

Five primary sections and all routes in `app/routes.ts`; section rails and back navigation; creation/premade/custom and recovery paths; player filters/sorting/renewals; lineup/formation/tactical controls; training programme/intensity/focus; market/search/scout/shortlist/negotiation; match preview/play/simulate/live controls/decisions/results/analytics; facilities costs/construction; finance/sponsors/fans/history; league/fixtures/rivalries; social/press/creators/community/media; objective claims/rewards; settings, content and store availability. Shared sheets/modals/toasts retain focus, labels, dismissal and confirmation semantics.
# Home checkpoint evidence

393×852 screenshots: `artifacts/redesign/checkpoint-home-393.png` and `checkpoint-home-lower-393.png`. Browser check recorded zero page errors, no horizontal overflow, real next-fixture navigation and Squad navigation. Home retains all priority cards, figures and linked actions. Original procedural identity crests remain until their generated counterparts are validated. Baseline captures at 393×852, 390×844 and 430×932 plus navigation/resource measurements are in `artifacts/redesign/baseline-performance.json`.

## Team, economy and match gates

Team browser flow saved seven starters, 3-2-1 formation, quick tempo and hard technical training across reload. Recruitment verified empty search, filters, shortlist, paid scouting and confirmed withdrawal from talks. Match flow verified preview, pause, substitution, tactics controls, completion, one week of progression, training results, analytics and reloaded full report without duplicate advancement. Each flow recorded zero page errors. Evidence: `artifacts/redesign/team-flow.json`, `phase3.json`, `phase4.json` and associated PNGs. Focused transfer, training, save recovery, result ownership and ordered-write regression tests pass. Full release checks remain phase 7.

## Final evidence

See `REDESIGN_REPORT.md` and `AUDIT_CLOSURE_2026-09-22.md` for the changed-system map,
129-asset manifest, screenshots, 931 passing tests and measured release limits. This
completion pass verified a real UI signing, one-time earned-credit redemption, contract
and sponsor consequences, authoritative availability clocks, multi-tab conflict handling,
quota retry/export and recovery after a Chromium renderer crash. A 50-season career
preserves senior contracts and ledger/save invariants. Production captures cover the
12 requested screens at four phone sizes; 70 checked views have no overflow, broken
images or undersized visible controls. Reduced-effects/text preferences persist.

All repository checks and production browser flows pass. Primary navigation preloads and
non-blocking cross-fades improve the desktop navigation sample, while throttled timing
still warrants physical-device profiling. No physical phone, VoiceOver session or native
archive was available. The macOS/Xcode workflow is prepared but has not run here.
