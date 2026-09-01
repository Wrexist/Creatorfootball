# Current Architecture

Written from the code, not from plans. Every claim here was checked against the
repository at the commit that introduced this file. Where something is
aspirational or partly built it says so.

## Shape

A pnpm workspace, Node >= 20, TypeScript throughout.

```
packages/engine     @cf/engine   all game rules, headless, no DOM
apps/game           @cf/game     React 19 + Vite 7 + Tailwind 4 client, Capacitor iOS shell
tools/sim           @cf/sim      headless balance/invariant harness
tools/brand         asset ingest and icon generation
tools/release       store screenshots, build numbers
website/, docs/     marketing site and documentation (docs/ is also GitHub Pages)
```

The engine has no dependency on the app. It is imported by both the app and the
headless harness, which is what makes the balance audits meaningful: they run
the same code the player runs.

## The rule that holds the design together

**No game rule lives in a component.** Screens read state and call engine
functions; they never derive an outcome. `apps/game/src/state/gameStore.ts` is
the only bridge. This is enforced socially rather than mechanically, but it
holds in the current code — the one historical violation (the market screen
re-rolling listings on mount) is documented in
`apps/game/src/features/market/engine.ts` as a cautionary comment.

## Engine layout (`packages/engine/src`)

| Area | What it owns |
|---|---|
| `core/` | Seeded RNG, branded ids, clock, `Result`, invariants, domain events |
| `game/` | `GameState`, `createNewGame`, `advanceCycle`, `applyMatchResult`, season rollover, selectors, mutations |
| `matches/` | Match simulator, momentum, ratings, commentary, in-match decisions, special rules |
| `content/` | Content schema, validation, loader, generators, and the base content pack |
| `simulation/` | World tick, AI clubs, emergent narrative, cascade effects |
| `social/`, `media/` | Post/story generation, engagement, trending, press conferences |
| `economy/` | Double-entry-ish `Ledger`, cycle economics, audit harness |
| `transfers/`, `contracts/` | Valuation, scouting, negotiation, wages |
| `progression/` | Objectives, board confidence, legacy |
| `persistence/` | Versioned save envelope, migrations, storage adapter interface |

`packages/engine/src/index.ts` is the single public entry point (71 export
statements). Nothing in the app imports an engine file by deep path.

### Determinism

Ids come from a save-scoped `IdFactory` counter and randomness from a seeded
`Rng`, never from `Math.random` or `Date.now`. `newGame.test.ts` asserts that
the same seed produces a byte-identical world, and the invariant audit asserts
that no two subsystems accidentally share a random stream.

Ids are also scoped to the career that created them. `createNewGame` derives a
six-character token from the seed and creation time (`saveToken` in
`core/ids.ts`), carried on `GameState.idToken`, and prefixes the clubs,
competition and seasons it creates with it. Before this they were identical in
every save — `club_0`, `season_1` — and two careers shared their ids exactly,
which cost one silent bug. Saves created before v7 keep their original ids; see
`REMAINING_RISKS.md` §1.

## State and persistence

`GameState` is one plain, serialisable, deeply readonly object. There is no
separate persistence model — the save *is* the state, wrapped in an envelope:

```ts
{ version, savedAt, checksum, state }
```

- `SAVE_VERSION` is currently **7**, with a registered migration for every step
  from 1. `save.test.ts` asserts the chain has no holes.
- Writes are validated before they replace the previous save (`validateState`),
  so an invalid state is refused rather than persisted.
- The previous save is promoted to `BACKUP_KEY` before each write, and
  `loadGame` falls back to it, reporting `recoveredFromBackup` so the UI can be
  honest about losing a cycle.
- The checksum is FNV-1a over the serialised state. It catches truncation and
  hand-editing, not tampering — it is not, and does not claim to be, a security
  control.
- Adapter failures are returned, never thrown. See PRODUCTION_READINESS_AUDIT.

Storage is an interface (`StorageAdapter`). `apps/game/src/platform/storage.ts`
is the only file in the product that knows where a save physically lives. It
layers **IndexedDB** (the default — a plateaued career measures ~3.1 MB against
a ~5 MB localStorage budget, and the backup copy doubles it) over the
localStorage adapter, over an in-memory map when the browser refuses everything,
reporting that last case through `isEphemeral`. A career already written to
localStorage is migrated across on first boot and verified before the originals
are reclaimed. All writes are serialised through a single-slot queue in
`state/saveQueue.ts`, so two saves are never in flight together and deleting a
career cannot be overwritten by one already on its way.

## The snapshot-compute-apply invariant

Feature engines (`features/*/engine.ts`, `features/squad/renewal.ts`) commit a
single action like this:

```ts
const s = useGameStore.getState().state;      // snapshot
const result = engineFunction(s, ...);        // compute from the snapshot
store.apply((current) => merge(current, result));
```

`apply` hands the mutator the **live** state, but the values merged in were
computed from the snapshot. Of the ten call sites, six merge snapshot-derived
data and one ignores `current` entirely and returns a state built wholly from
its snapshot.

That is safe for exactly one reason: every one of these paths runs to
completion synchronously, so the live state cannot move between the snapshot
and the apply. Add a single `await` anywhere between them and the cycle can
advance in that window — the apply then writes stale data over a newer world.
Money computed against an older ledger; a squad written over one that has since
changed. It would not throw and it would not fail an existing test.

**The invariant: a module that commits state through `apply` must contain no
asynchronous boundary.** Async work belongs before the snapshot, never inside
it.

Enforced by `apps/game/src/state/engineInvariant.test.ts`, which finds those
modules by looking for `.apply(` rather than from a hardcoded list — so a
module written later is covered the day it is written, and the guard cannot
drift away from the code it guards. It rejects `async`, `await`, `.then(` and
`new Promise`, ignoring comments and string literals.

## Opponent AI

An AI club meeting the player leans its tactics against what the league has
**observed** the player do — never against the player's tactics screen, which
no opponent can see. Observations are filed once per played match into a
bounded window on `GameState.opponentModel`; a tendency must be a real majority
before anyone acts on it, and the confidence needed scales with the opposing
manager's adaptability. The read is shown to the player in the match preview,
generated from the same call that produces the tactics — and the same call
produces a past-tense recap that the result screen shows, captured at kick-off
so it describes the opponent actually played rather than the one the next
observation would describe.

See `simulation/opponentModel.ts`.

## The game loop

There is no per-frame simulation loop. The world advances in discrete **cycles**
(a matchweek), driven by the player:

```
advanceCycle(state, { now, playerResult, registry, ledger })
  -> { state, summary, stories, posts, results }
```

`gameStore.advance()` calls it, persists the result, and publishes the feedback
as `lastCycle`. It is guarded three ways: a `busy` flag for concurrency, and
`isMatchResultApplied` so a remount or a reload cannot commit the same match
twice (committing is not idempotent — it advances the week).

Live matches are the exception and run on their own clock in
`state/matchStore.ts`: a `setTimeout` ladder drains ticks from a `MatchSimulator`
held *outside* reactive state. Tick intervals are presentation-only; the
simulator's RNG stream and `MatchResult` are identical at any speed.

## App layout (`apps/game/src`)

```
app/        App shell, router, error boundary, analytics, route table
state/      gameStore (engine bridge), matchStore (live playback), uiStore
design/     design system: tokens, glass surfaces, typography, motion, art, domain widgets
features/   club creation home league market matchday onboarding progression social squad
platform/   storage, native (Capacitor), capability detection
```

Routing is data: `app/routes.ts` holds all 27 routes, and the tab bar, wide-screen
side navigation, deep links and analytics screen tracking all read from it.
Feature screens are lazily imported and chunked per feature.

## Testing

| Suite | Count | Command |
|---|---|---|
| Engine unit/integration | 771 | `pnpm --filter @cf/engine test` |
| App unit | 246 | `pnpm --filter @cf/game test` |
| Browser smoke (real bundle) | 9 checks | `pnpm test:smoke` |
| Economy / simulation / invariant audits | see below | `pnpm audit:all` |

The audits are the unusual and valuable part. `pnpm audit:invariants` plays 12
seasons headlessly and asserts nine structural invariants — no player owned by
two clubs, the table reconciles with its results, no negative or duplicated
money, every club can field a team, the state passes its own save validator —
plus random-stream hygiene, social provenance, and a save round trip.

The browser smoke test exists because the project once shipped a bundle that
built cleanly, passed every unit test, and died on load with a temporal-dead-zone
error. Unit tests run the source in Node and never touch the bundle.

## Verification commands

```
pnpm install
pnpm typecheck      # tsc --noEmit across engine, app, sim
pnpm lint           # eslint, --max-warnings=0
pnpm test           # all workspace unit suites
pnpm build          # engine + production app bundle
pnpm test:smoke     # builds, serves, drives the real bundle in Chromium
pnpm audit:all      # economy + simulation + invariant harnesses
```

`test:smoke` honours `CHROMIUM_PATH` for sandboxed machines with a pinned
Chromium that does not match the Playwright-managed build.
