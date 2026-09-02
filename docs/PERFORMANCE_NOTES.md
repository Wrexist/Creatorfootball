# Performance Notes

Measured, not estimated. Numbers are from `pnpm build` and the built `dist/` in
this repository; re-measure before trusting them after significant change.

## Headline: no performance regression was needed, and none was invented

The usual React/Zustand failure modes were looked for specifically and are
absent. This section exists so the next engineer does not spend a day
re-discovering that.

- **No store selector returns a fresh object or array literal.** A grep for
  `useGameStore((s) => ({...}))` / `=> [...]` across the app returns nothing.
  With Zustand 5's `Object.is` comparison that pattern re-renders on every
  state change; the codebase avoids it consistently.
- **Expensive derivations are memoised.** `standings()` (which folds every
  fixture in the season) is behind `useMemo` at both hot call sites —
  `ClubScreen` and the result screen's analytics tab. The one unmemoised call
  is in `SeasonComplete`, a terminal screen rendered once at season end over a
  12-row table; memoising it would be noise.
- **Live match rendering is already off the React path where it matters.** The
  decision countdown ring writes `strokeDashoffset` straight to the DOM from a
  `requestAnimationFrame` loop rather than re-rendering a sheet 60 times a
  second, and live player ratings are sampled once per match minute rather than
  per tick, deliberately, so the renderer's per-rating sprite cache survives.
- **The simulator is held outside reactive state.** `matchStore` keeps the
  `MatchSimulator` in a module variable so React never tries to diff a large
  mutable object.

## Bundle

Chunk sizes from the production build (gzip measured directly on the artefacts):

| Chunk | Raw | Gzip | Loaded |
|---|---|---|---|
| `engine` | 626 kB | **205 kB** | on app entry |
| `content` (the base pack) | 239 kB | **77 kB** | on intent: first career, or opening a save |
| `vendor` (react, router) | 231 kB | 74 kB | eager |
| `App` | 234 kB | 72 kB | on app entry |
| `motion` | 138 kB | 45 kB | on app entry |
| entry | 7 kB | 3.5 kB | eager |
| ~14 per-feature chunks | 1–125 kB | — | on route |

`dist/` totals 3.0 MB, of which 600 kB is art.

The HTML loads only the entry and `vendor` eagerly; `App`, `engine` and
`motion` arrive via a dynamic import behind the splash screen. Time to the
title screen is roughly **395 kB gzip** (was 460); the content chunk is
fetched when the player says they are starting a career, and lands behind the
manager step.

### Why the content is its own chunk, and how it stays one

The first attempt at this split shipped a broken page: the engine imported the
pack at module scope (`newGame`, `cycle`, the generators' fallbacks, the
barrel), the pack imports engine leaves for its constants, and Rollup cannot
order two chunks that form a cycle. Every engine → pack edge is gone now, so
the `content` chunk depends on `engine` and never the reverse. Three things
guard it: `contentBoundary.test.ts` reads the source and fails on the first
import that comes back; `vite.config.ts` names the chunk and says why; and
`pnpm test:smoke` boots the real bundle, counts the content request (exactly
one) and refuses a blank creation step.

Measured with `node e2e/measure.mjs` (desktop headless Chromium, median of
three, same machine, before → after): first screen 1475 → 1448 ms with
1738 → 1507 kB of script; start → manager step 1070 → 624 ms; next → club step
88 → 104 ms (the pack is already here by then); confirm → playable
2390 → 2373 ms; whole-journey script bytes 1789 → 1792 kB — nothing is
downloaded twice.

It is also worth being honest about the payoff: the splash screen already covers
this load, and it is cached after first visit. This is a first-visit,
cold-cache, mobile-network cost. It is the right next optimisation, but it is
not an emergency.

## Long-session behaviour

Checked specifically, because idle/incremental games fail here and this one
does not:

- `eventLog` is capped at 600 entries (`simulation/balance.ts`, applied in both
  `worldTick` and `mutations.appendEvents`). Several systems iterate it every
  cycle — legacy, board confidence, social, emergent narrative, cascade — so an
  uncapped log would have degraded both save size *and* per-cycle CPU linearly
  forever. It does not.
- Per-player rolling ratings cap at 8, season summaries at 30, completed
  objectives at 60, negotiation transcripts at 24, ledger transactions at a
  configured maximum, milestones at a balance constant.
- The match feed in `matchStore` caps at 60 events for render cost; the full
  stream lives in the `MatchResult`.

Net effect: save size and cycle cost are bounded by design, not by luck. The
12-season invariant audit exercises this.

## Known slow spot in development

The engine test suite takes ~150 s for 767 tests, dominated by the simulation
and season-length integration tests. This is CI/developer-loop cost, not player
cost. The two heavy suites now yield to the event loop between simulations, so
a worker can answer Vitest's reporter even under load; without that, a loaded
machine failed the run on a reporter timeout with every assertion green. If the
suite ever becomes a drag, the lever is sharding those long headless-season
tests rather than trimming coverage — they carry the most value.

## Not worth doing

- Micro-memoising small components. Nothing measured points there.
- Virtualising current lists. Squad and table views are tens of rows, not
  thousands.
- Trimming the motion chunk. 44 kB gzip for the animation layer the product's
  identity depends on is a fair trade.
