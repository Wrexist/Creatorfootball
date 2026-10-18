# Remaining work — 18 October 2026

Full audit of `Main` at `6f51bb5` (latest on GitHub). Supersedes
`REMAINING_WORK_2026-09-22.md` and `LAUNCH_REMAINING_20260925.md` where they disagree.

**State:** nothing is live. iOS 1.0.16 is staged for review but not submitted; Android
1.0.16 is on the internal track only. CI on Main is green. Locally, typecheck, lint,
1,020 tests (758 engine + 262 app) and the production build pass with pnpm 10.33.0.

Legend: **[owner]** needs account access, a device, a Mac or money · **[code]** can be done in the repo.

## Progress since the audit (PR #36, merged as `3244d9d`)

Google Play is out of scope for now (owner decision, 18 Oct): **iOS only**.

**Fixed in code:** A1 (iOS listing, review notes, privacy pages), B1–B6, the `/design` route,
manage-subscription link, unhandled promises, invariant collect mode, membership refresh throttle,
C5 (October "Autumn Pages" issue), Capacitor core aligned to 8.5.3 with `Package.swift` re-synced,
RevenueCat 13.7.0, three 0.186.1, and the iPhone Duo items in section E marked done.
Checks at merge: typecheck, lint, 762 engine + 298 app tests, full browser suite, iOS simulator CI.

**Still open:**
- `/dev/gallery` stays reachable in production because `e2e/media-matrix.mjs` and
  `e2e/insitu.mjs` open it against the production build. Move those checks to a dev build to gate it.
- Force-quitting the app mid-match (or browser back on web) still leaves the fixture replayable;
  closing that needs the live match state persisted.
- Leaving a match lets the engine AI make the remaining calls, which is not strictly the
  "safe call" the decision sheet promises.
- Native storage has not run on a device yet: confirm an existing TestFlight career loads after
  migration and `Library/cf-saves/` appears.
- iPhone Duo screenshots are captured locally in `artifacts/store-launch/duo/` (git-ignored, like
  the other store captures) by `apps/game/scripts/duo-screenshots.mjs`.
- Xcode 27.1 is not on GitHub-hosted runners (only the `xcode-27` preview image with 27.0 beta),
  so release builds still use Xcode 26.6 (iOS 26 SDK).

---

## A. Blockers before submitting

1. **[code] Store listings say "no subscriptions" but the app sells Creator Club.**
   `apps/game/fastlane/metadata/en-US/description.txt:21` and
   `apps/game/fastlane/metadata/android/en-US/full_description.txt:21`. Misleading metadata is
   a review rejection risk. Rewrite, then **[owner]** paste into both consoles. Also revise the
   review notes, age-rating and marketing wording for the membership (`docs/APP_STORE.md:180-192`).
2. **[owner] Build a new iOS and Android binary.** Builds 12–14 (iOS) and 5 (Android) predate
   `540cddd`, the Capacitor 8.5.2/8.5.3 critical-advisory patch (GHSA-rvm3-566m-v7fv). Build 14
   (from `304d3a0`, uploaded 25 Sep) is undocumented, and the review draft still points at build 12.
3. **[owner] Google Play: finish Target audience, then Data safety**, and resolve the
   children's-compliance hold (RevenueCat SDK, consent, how purchases are shown to children).
4. **[owner] Google Play production access** needs a closed test with 12 testers for 14 days
   (currently 0).
5. **[owner] App Store: final Submit for Review.** Before that: stage Heritage and Creator Stories
   (the Heritage screenshot upload failed twice), replace the 8 old 13" iPad screenshots, check
   the reviewer contact fields, upload the new header/search-results art, refresh the expired
   featuring window (25 Sep–4 Oct).

## B. Real bugs in the code

1. **[code] High — careers live only in WebView localStorage** (`apps/game/src/platform/storage.ts`).
   The OS can reclaim it under storage pressure. `@capacitor/filesystem` is already installed:
   write native saves to Filesystem and keep localStorage for web.
2. **[code] Medium — saving fails on iOS 15.0–15.3.** `src/platform/saveCoordinator.ts:21` throws
   when `navigator.locks` is missing (added in iOS 15.4); the deployment target is 15.0. Skip the
   lock on native (one WebView) or raise the target to 15.4.
3. **[code] Medium — the splash screen can hang forever.** `launchAutoHide: false`
   (`capacitor.config.ts:25`) and only the boot screen hides it (`src/app/App.tsx:90`). A crash
   caught by `src/app/ErrorBoundary.tsx` or `src/app/Entry.tsx` never hides it. Call
   `hideNativeSplash()` in both `componentDidCatch`s, plus a failsafe timeout.
4. **[code] Medium — live match exits.** Quitting keeps the fixture replayable with a fixed seed
   (a losing match can be replayed, `MatchLiveScreen.tsx:305-325`); Android back skips the
   "Leave the match?" confirm (`src/platform/native.ts:28-32`); a failed save at full time has no
   retry (`MatchLiveScreen.tsx:216-223`).
5. **[code] Medium — packs and membership read different offerings.** Packs use
   `offerings.current` (`src/commerce/revenuecat.ts:43`), membership uses `all['creator_club']`
   (`src/commerce/membershipStore.ts:43`). If the dashboard's current offering is ever
   `creator_club`, every pack shows "Purchase unavailable". Use a named packs offering.
6. **[code] Medium — 3D textures leak GPU memory.** `src/world3d/ModelViewer.tsx` disposes
   geometry and materials but not textures, and the viewer is rebuilt on every lighting/finish
   change.

Lower priority:
- **[code]** `/dev/gallery` and `/design` routes are reachable in production (`src/app/router.tsx:275-278`).
- **[code]** "Manage subscription" is a hard-coded link that also shows on web
  (`CreatorClub.tsx:125`); use `Purchases.showManageSubscriptions()`.
- **[code]** Missing `.catch` on `installNativeBridge()` (`App.tsx:57`), feature preloads
  (`featureModules.ts:108-110`) and `abandon()` (`SquadIntroScreen.tsx:142`, `SaveRecoveryScreen.tsx:42`).
- **[code]** Each save reads/decodes 4× and gzips 2×; slow once saves pass ~900k characters.
- **[code]** Engine invariants still default to "throw" instead of production "collect"
  (`packages/engine/src/core/invariant.ts:22`).
- **[code]** Analytics is console-only (`src/app/analytics.ts:39-41`); `src/online` and
  `supabase/` folders are empty.
- **[code]** Bundle: engine chunk 878 KB, 3D viewer 645 KB (both above Vite's warning).

## C. Payments / RevenueCat

1. **[owner]** Sandbox: cancellation, trial conversion, renewal, expiry, refund, Ask to Buy, plan
   change, store-account switch, offline, repeat claims — all untested.
2. **[owner]** No one-time pack has a recorded sandbox transaction; Android validation said
   "package name not found".
3. **[owner]** Reward celebrations have never been seen on a device.
4. **[code]** The £250k monthly club-funds reward is not balanced against the economy.
5. **[code]** No October membership issue — only "First Lights" (2026-09) exists
   (`src/commerce/memberLibrary.ts:30`), and monthly issues are a launch promise.

## D. Device, legal and housekeeping

- **[owner]** Physical-device pass: VoiceOver/TalkBack, heat/battery in 3D, kill during save,
  large text, deleting a real purchase record on request.
- **[code]** `docs/privacy.html` (22 Sep) mentions only "optional store purchases", not subscriptions.
- **[code]** Merge the 9 open Dependabot PRs (#22 #23 #25 #30 #31 #32 #33 #34 #35, all green).
  #30 aligns `@capacitor/core` (8.5.0) with iOS 8.5.3 / Android 8.5.2. #32 is Vite 8 (major).
- **[code]** Committed `ios/App/CapApp-SPM/Package.swift` still pins `capacitor-swift-pm` 8.5.0;
  CI re-syncs it, but run `cap:sync` and commit so local Xcode builds match.
- **[code]** Stale docs: README "Release status" (22 Sep) and `ROADMAP.md:50-58` "Known red".
- **[code]** Play deobfuscation-file warning (code shrinking is off); 5 Android lint warnings.
- **Local tooling:** this machine has pnpm 9.15.0; the repo needs 10.33.0
  (`corepack enable` or `npx pnpm@10.33.0`). With pnpm 9 the frozen install fails on the
  `pnpm-workspace.yaml` overrides.

---

## E. iPhone Duo

Apple's foldable (iOS 27, on sale 23 Oct 2026). Outer display 5.4" 1398×2034 (466×678 pt) with
the status bar and camera beside it; inner display 7.6" 1878×2670, used open flat as ~890×626 pt
or turned as ~626×890 pt. Apple: the inner display ignores a portrait lock and *scales* the app;
use size classes, not device checks; full-screen Duo layout needs the iOS 27.1 SDK.

### Done on branch `claude/iphone-duo-support`
- **Orientation:** iPhone `Info.plist` now declares all four orientations, and the new
  `GameBridgeViewController` (`ios/App/App/SceneDelegate.swift`) allows rotation only on a
  regular-width, regular-height screen (Duo inner, iPad). Ordinary iPhones and the Duo outer
  display stay portrait-locked.
- **Side safe areas:** `#root`, the tab bar, sheets, modals, toasts, hero moments, the match
  intro and the goal banner now respect `safe-area-inset-left/right` (each side separately).
- **Live pitch:** keeps a true 3:2 on wide columns (it was stretched on iPad/Duo) via a
  container-query letterbox (`PitchStage.tsx`, `premium.css`).
- **Fold bug fixed:** the pitch canvas kept its old pixel height after a wide-to-narrow change
  (fold, leaving iPad Split View). The canvas is now absolutely positioned (`PitchView.tsx`), and
  resizes are coalesced to one per frame.
- **3D viewer:** refits the camera when the stage changes shape (`ModelViewer.tsx`); stage height
  capped at `min(500px, 62svh)` for the short inner landscape screen.
- **Smoke test:** `e2e/smoke.mjs` now checks 466×678 (with a stand-in 44px side inset),
  890×626 and 626×890 for overflow, covered controls, controls under the side inset, and a
  fold/unfold cycle.

### Still to do
1. **[owner] Toolchain:** CI builds with Xcode 26 (`macos-26`, `ios.yml:10`,
   `ios-testflight.yml:180`). Move to Xcode 27.1 once a GitHub runner image ships it, and raise
   the gate at `ios.yml:23`.
2. **[owner] Simulator pass:** run the Xcode 27.1 iPhone Duo simulator; confirm the real inner
   point size, the side inset values and the fold transition. Adjust `DUO_INSET` in `smoke.mjs`.
3. **[code, after 27.1 SDK] Hinge:** when partially folded, read `UIViewReservedRegion` (the
   "division" region) and pass it to the web layer as CSS variables, so the pitch, sheets and
   decision cards avoid the crease (tent/book posture only; flat-open needs nothing).
4. **[code] Short-height layouts:** tactics pitch minimum heights (`premium.css:136-137`,
   440/530px) are taller than the 626pt inner landscape screen; the Home hero pushes "Prepare
   Match" below the fold there.
5. **[owner] Screenshots:** Duo App Store sizes are outer 1398×2034 / 2034×1398 and inner
   2007×2853 / 2853×2007. Optional now; required from April 2027 for apps built with the 27.1 SDK.
