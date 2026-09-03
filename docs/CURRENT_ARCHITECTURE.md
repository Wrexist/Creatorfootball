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
| `content/` | Content schema, validation, registry, generators; `content/packs/` holds the base pack, reachable only by its own path |
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

The same read runs **inside a match**. `matches/adaptation.ts` files one
observation per attack the other side makes (the shape and focus it was played
in, taken where the attack ends and stamped on the SHOT event) and decides,
through the shared majority reader and `counterPlan`, whether the bench moves:
at least 5 of the last 8 attacks in one pattern, confidence above the
manager's threshold, at most once per side per half, never in a half the side
has already changed shape in, never against a setup it already holds, and
never with the score as an input — `AdaptationInput` has no field for it. The
simulator applies the lean through `applyTacticalChange` with an exclusive
commentary tag, so the feed line names the football change. `MatchConfig.
adaptation` switches it off for audits and A/B tests; the balance audit runs
with it off so a setup is measured on its own.

See `simulation/opponentModel.ts` and `matches/adaptation.ts`.

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

## Content loading

The base pack is a lazy chunk. The engine never imports it: `createNewGame`,
`advanceCycle` and `rolloverSeason` take a `ContentRegistry`, the generators
take a name bank and a facility list, and the engine barrel exports no pack
constant. The app's single loader (`state/content.ts`) fetches
`content/packs/base` with one dynamic `import()`, validates it through the
registry, caches the result and exposes a subscribable status. Every consumer
joins the same promise or the same registry. `contentRegistry()` is the sync
accessor for code that runs once a career exists — a career is READY only
after its content loaded, so the throw inside it is an invariant alarm.

`vite.config.ts` puts `content/packs/**` in a `content` chunk that depends on
the `engine` chunk and never the reverse; `contentBoundary.test.ts` reads the
source and refuses the first import that would recreate the old cycle, and
`pnpm test:smoke` boots the real bundle, counts the content request (exactly
one) and refuses a blank creation step.

A retry is a real second request. Browsers remember a failed module fetch
and reject the next `import()` of that URL without a fetch, so the importer
(`importBasePack`) retries under `<chunk url>?retry=<n>`, locating the chunk
through the bundler's preload link or the browser's error message, and falls
back to the plain specifier when neither exists. `e2e/failure.mjs` intercepts
the chunk's request to prove the failure and recovery journeys in Chromium.

## Matchday presentation

Two layers, one direction. The simulator owns every football fact — where
the shirts are each tick, who has the ball, what happened — and hands out a
`PitchFrame` per tick. `features/matchday/live/motion.ts` turns frames into
motion: shirts travel between snapshots on a measured interval, the ball is
glued to its carrier (named, or inferred as the man nearest the engine's
point), flies to a receiver on a change of hands and at the goal on a shot,
and holds through a stoppage. `pitchRenderer.ts` paints what the motion model
reports. No renderer value is read by the simulation; the render loop's
timestamps drive presentation only, so frame rate cannot change a result.

The matchday bench is chosen by `selectMatchdayBench` (`tactics/formations.ts`)
and by nothing else. It is pure and synchronous, takes the squad, the starting
eleven (as slot/player pairs) and the formation, and returns seats each carrying
the football reason it was given. `autoLineup` calls it for the team-sheet
suggestion, `buildMatchdayContext` calls it for the preview, and
`MatchSimulator.buildTeam` calls it whenever `tactics.bench` is empty — an
explicit bench is honoured exactly, which is where player agency lives. Cover
is scored with `selectionFit`, the same function that picks the eleven, so
there is one position model and one readiness model in the codebase.
`benchParity.test.ts` in the app asserts the preview and the simulator name the
same seven in the same order for real careers.

Substitutions go through the simulator's `checkSubstitution` (a verdict with
a reason) and `substitutionStatus` (used, allowed, remaining, the match-day
bench). The match store reads the status every tick; the sheet
(`MatchSheets.tsx`) lists that bench, ranks replacements with
`replacements.ts` (quality × familiarity × legs, plus a contextual label) and
turns each refusal into its own sentence.

## Testing

| Suite | Count | Command |
|---|---|---|
| Engine unit/integration | 820 | `pnpm --filter @cf/engine test` |
| App unit | 302 | `pnpm --filter @cf/game test` |
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
