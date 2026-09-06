# Release regression matrix

Every line of the pre-launch regression pass, and what actually covers it.

Three verdicts, and only three:

- **AUTOMATED** — a named test proves it on every CI run. The name is here so
  the claim can be checked rather than believed.
- **DEVICE** — no automated check can reach it. It needs a phone in a hand.
  These are the ones that gate submission.
- **MANUAL** — reachable in a browser but not currently asserted anywhere.

Measured on the release candidate; commands and totals in
[`CURRENT_STATE.md`](CURRENT_STATE.md) §1. The browser rows name checks from
`pnpm test:smoke` (32 of them, against the built bundle, not the dev server).

---

## 1 · Onboarding

| Item | Verdict | Evidence |
|---|---|---|
| Fresh install boots | AUTOMATED | smoke: *the built app boots with no runtime errors* |
| Title screen renders | AUTOMATED | smoke: *the app rendered content* |
| Manager creation | AUTOMATED | smoke: *career creation loaded the universe once, showed no blank step and threw nothing* |
| Club selection | AUTOMATED | same check; failure suite drives the club step in eight further states |
| Found a club | AUTOMATED | failure: *founding a club without the universe…*, *…founds the club, once* |
| Invalid input | AUTOMATED | failure: *everything typed survives* |
| Back navigation | AUTOMATED | smoke: *navigating every primary route threw nothing* |
| Retry after content failure | AUTOMATED | recovery: nine checks, including third-failure behaviour |
| Recovery focus | AUTOMATED | recovery: *two failures, then recovery, focus on the first club, one career* |
| Keyboard reachability | AUTOMATED | recovery: *Tab to retry, Enter and Space retry…* |
| Thumb reach, sheet feel | DEVICE | — |

## 2 · Save

| Item | Verdict | Evidence |
|---|---|---|
| Create, save, reload | AUTOMATED | smoke: *a real career loads from IndexedDB, takes a change, and survives a reload* |
| Career created through the UI persists | AUTOMATED | smoke: *a career created through onboarding (Marrowgate Athletic) persists and survives a reload* |
| localStorage → IndexedDB migration | AUTOMATED | smoke: *an existing localStorage career migrates into IndexedDB and frees the old copies* |
| Second tab sees the same career | AUTOMATED | smoke: *a second tab sees the same career and the same change* |
| Damaged / invalid save, backup recovery | AUTOMATED | engine `test/saveResilience.test.ts`, `test/save.test.ts`; invariant audit's *save, reload and tamper-rejection all behave* |
| Migration chain has no holes | AUTOMATED | engine `src/persistence/save.test.ts` |
| Save untouched by a content failure | AUTOMATED | recovery: *save byte-identical throughout* |
| Write ordering under load | AUTOMATED | app `state/saveQueue.test.ts` |
| Safari eviction under storage pressure | DEVICE | REMAINING_RISKS §5 |

## 3 · Content

| Item | Verdict | Evidence |
|---|---|---|
| Lazy chunk loads on intent, once | AUTOMATED | smoke: *loaded the universe once*; app `state/content.test.ts` |
| Engine never imports the pack | AUTOMATED | app `state/contentBoundary.test.ts` |
| First visit / returning player | AUTOMATED | failure suite covers both paths separately |
| Club-step failure and retry | AUTOMATED | failure + recovery suites (17 checks) |
| Repeated retry | AUTOMATED | recovery: *a third failure behaves exactly like the second* |
| Concurrent retries share one request | AUTOMATED | recovery: *rapid retries: one request, one alert, one status, one focus destination* |
| Content validation | AUTOMATED | engine `src/content/validate.test.ts`, `loader.test.ts` |
| Real network conditions | DEVICE | the suites simulate failure by blocking the request |

## 4 · Management

Every primary route is asserted to render, to navigate, and to fit a 375 px
viewport with no control covered — smoke: *no visible control is covered by
other chrome on any primary route*, *no route overflows a 375px viewport*,
*navigating every primary route threw nothing*. Route coverage itself is
pinned by app `app/routes.test.ts`.

The rules behind each screen are covered engine-side: transfers
(`market`, `negotiation`, `valuation`, `scouting`), finances (`economy/cycle`,
`contracts/wages`), facilities, sponsors, press (`media/mediaEngine`),
objectives (`progression/objectives`, `board`), progression
(`progression/legacy`), training, squad renewal.

What is **not** covered: how these screens *feel* — scrolling, sheet
dismissal, keyboard avoidance. DEVICE.

## 5 · Matchday

| Item | Verdict | Evidence |
|---|---|---|
| Lineup and bench chosen deterministically | AUTOMATED | engine `tactics/bench.test.ts` (15), `matches/matchdayBench.test.ts` |
| Preview bench == simulator bench | AUTOMATED | app `matchday/shared/benchParity.test.ts` |
| Substitution rules | AUTOMATED | engine `matches/substitutions.test.ts` |
| Goalkeeper substitution end to end | AUTOMATED | matchday: *goalkeeper selected…*, *goalkeeper substituted once: 5 → 4 changes left…* |
| Replacement recommendation | AUTOMATED | app `matchday/live/replacements.test.ts` |
| Invalid substitution refused with a reason | AUTOMATED | engine `matches/substitutions.test.ts` |
| Player motion, bounded | AUTOMATED | matchday: *live pitch: shirts travel …* |
| Ball stays with play | AUTOMATED | same check: median ball-to-nearest-shirt distance |
| Pause | AUTOMATED | matchday: *pause: motion settles and stops* |
| Resume without a teleport | AUTOMATED | matchday: *resume: motion continues without a teleport* |
| Motion model itself | AUTOMATED | app `matchday/live/motion.test.ts` (17) |
| Feed events trace to engine events | AUTOMATED | invariant audit: *every generated post traced back to an event the engine actually emitted* |
| Frame pacing, thermals, touch latency | DEVICE | the browser suite measures movement, not frames per second on a phone |

## 6 · Season

| Item | Verdict | Evidence |
|---|---|---|
| Final match, rollover, new season | AUTOMATED | engine `test/season.test.ts` |
| Standings reconcile with results | AUTOMATED | invariant audit: *the table reconciles with the results that produced it* |
| Fixtures | AUTOMATED | engine `league/fixtures.test.ts`; invariant *no fixture is duplicated or scheduled against itself* |
| Squad evolution across seasons | AUTOMATED | engine `simulation/worldTick.test.ts`, `test/season.test.ts` |
| AI formation evolution | AUTOMATED | engine `tactics/evolution.test.ts` (A–K), plus the multi-season experiment |
| No club ever reverts to a shape it left | AUTOMATED | the experiment: 0 reversals in 144 club careers |
| Player progression | AUTOMATED | engine `training/training.test.ts`, `simulation/worldTick.test.ts` |
| Economy continuity | AUTOMATED | economy audit over five seasons |
| Every club can always field a team | AUTOMATED | invariant audit |

---

## What no CI run can close

1. **The phone.** Everything in this repository is desktop Chromium or
   headless Node. Frame rate, thermals, battery, haptics, real touch, the
   notch and the home indicator, VoiceOver as spoken rather than as DOM, and
   Safari's storage eviction are all unmeasured. This is the release blocker.
2. **The store record.** Age rating, privacy label, pricing and the review
   contact live in App Store Connect's web UI and no API sets them.
