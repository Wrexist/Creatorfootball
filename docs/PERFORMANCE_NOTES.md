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
| `engine` | 858 kB | **273 kB** | on app entry |
| `vendor` (react, router) | 231 kB | 72 kB | eager |
| `App` | 228 kB | 68 kB | on app entry |
| `motion` | 138 kB | 44 kB | on app entry |
| entry | 3 kB | 3 kB | eager |
| ~14 per-feature chunks | 1–124 kB | — | on route |

`dist/` totals 3.0 MB, of which 600 kB is art.

The HTML loads only the 3 kB entry and `vendor` eagerly; `App`, `engine` and
`motion` arrive via a dynamic import behind the splash screen. Time to
interactive is therefore roughly **460 kB gzip**, most of it the engine.

### Why the engine is one chunk

This is the largest single number in the build and it is deliberate. Splitting
the content packs out (388 kB of source, the biggest area in the engine) was
tried and shipped a broken production page: the engine's modules and its content
data reference each other at module scope, Rollup cannot order two chunks that
form a cycle, and the result was a temporal-dead-zone error on load. It built
cleanly and passed every unit test, because unit tests run the source in Node
and never touch the bundle. `apps/game/vite.config.ts` carries this warning
inline.

**The prerequisite for re-attempting it is breaking that module-scope cycle**,
not changing the chunk configuration. `pnpm test:smoke` now exists and drives
the real bundle in a browser, so a re-attempt would at least fail loudly — but
it is a real refactor, not a config tweak, and it was left alone in this pass.

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
cost. If it becomes a drag, the lever is sharding the long headless-season tests
rather than trimming coverage — those are the tests carrying the most value.

## Not worth doing

- Micro-memoising small components. Nothing measured points there.
- Virtualising current lists. Squad and table views are tens of rows, not
  thousands.
- Trimming the motion chunk. 44 kB gzip for the animation layer the product's
  identity depends on is a fair trade.
