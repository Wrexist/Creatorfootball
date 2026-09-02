# Current State

**The single authoritative status document for Creator Football.**

Where any other document in `docs/` disagrees with this one, this one is
correct. Every number below was produced by running the command named beside
it, on the commit that introduced this file. Nothing is estimated.

---

## 1. Verification, measured

| Gate | Command | Result |
|---|---|---|
| Types | `pnpm typecheck` | pass (engine, app, sim) |
| Lint | `pnpm lint` | pass, `--max-warnings=0` |
| Engine tests | `pnpm --filter @cf/engine test` | **60 files, 793 tests, all passing** |
| App tests | `pnpm --filter @cf/game test` | **27 files, 279 tests, all passing** |
| **Total** | `pnpm test` | **1,072 tests, all passing** |
| Production build | `pnpm build` | pass |
| Browser smoke | `pnpm test:smoke` | **10/10** happy path + **8/8** content-failure journeys, against the real bundle |
| Balance audits | `pnpm audit:all` | economy, simulation, 9 invariants — all pass |

Earlier documents state 262, 531, 653 and 753 tests. All are historical.
`pnpm test` is the only source of truth.

**Tooling note.** Earlier in this cycle `pnpm test` could exit non-zero on a
loaded machine after every test passed, with `[vitest-worker]: Timeout calling
"onTaskUpdate"` — the reporter's RPC starved by a worker blocked in tens of
seconds of synchronous simulation. The one heavy suite that never yielded
(`test/season.test.ts`) now yields between cycles, the same remedy the balance
suite already used; the balance suite yields four times as often. Assertions,
seeds and ordering are unchanged. Not observed since; see `REMAINING_RISKS.md` §9.

**Environment note.** This sandbox ships Chromium build 1194 while Playwright
1.62 expects 1234, so the smoke test needs its existing escape hatch:

```
CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome pnpm test:smoke
```

---

## 2. Architecture

Unchanged in shape and still sound. Full detail in `CURRENT_ARCHITECTURE.md`.

- `packages/engine` (`@cf/engine`) — every game rule, headless, no DOM. One
  public entry point.
- `apps/game` (`@cf/game`) — React 19 + Vite 7 + Tailwind 4, Capacitor iOS shell.
- `tools/sim` (`@cf/sim`) — headless balance and invariant harness running the
  same engine the player runs.

The rule that holds it together — **no game rule lives in a component** — still
holds in the current code.

**Determinism** is enforced by tests: seeded RNG, counter-derived ids, and an
audit that catches two subsystems accidentally sharing a random stream.

---

## 3. Persistence — changed

Careers now live in **IndexedDB**, not localStorage.

This was a measured P0. A career's save does *not* grow without bound — it
plateaus — but it plateaus too high for localStorage:

| Seasons played | Save size |
|---|---|
| 1 | 1.1 MB |
| 5 | 2.5 MB |
| 10 | 3.0 MB |
| 20 | 3.2 MB (plateau) |

The save layer deliberately keeps a backup copy, so a mature career needs
~6.3 MB against a ~5 MB localStorage budget. **Careers were failing to save
from roughly their fifth season.**

Composition at the plateau: ledger 41%, players 33% (mostly the 12-season
career history that the history screens exist to show), event log 5%.

Trimming was measured and **rejected**: cutting ledger retention to the edge of
usefulness still lands near 4.7 MB of a 5 MB budget. That is a later failure,
not a fix, and it costs the player financial history. IndexedDB's quota is in
the hundreds of megabytes.

`apps/game/src/platform/storage.ts` now layers IndexedDB over the existing
localStorage adapter over an in-memory fallback, resolving once behind the
first read.

Every write goes through a single-slot queue (`state/saveQueue.ts`): writes are
serialised, a backlog coalesces down to the newest state, and abandoning a
career drops queued writes and waits for the in-flight one before deleting.
Without it, abandoning a career could be undone by a save already on its way —
the delete ran, the app showed "no save", and the next boot loaded the career
the player had just deleted. An existing localStorage career is copied across on first boot,
verified, and only then removed to reclaim the space. If any step fails the
originals are left untouched and the next boot retries. This is covered by a
real-browser check in `pnpm test:smoke`.

Save format: `SAVE_VERSION` is **7**, with a registered migration for every
step from 1 and a test asserting the chain has no holes. Writes are validated
before they replace a good save, the previous save is promoted to a backup, and
adapter failures are returned rather than thrown.

---

## 4. Opponent AI — changed

The opponent now counters **what it has seen you do**, not what is in your
tactics screen.

The previous implementation read `playerClub.tactics` directly at match setup.
Its own comment described the intended design — "the shape the player has been
playing all month" — but the code implemented omniscience: it knew a tactical
change before a ball had been kicked with it, and knew nothing about what the
player had actually been doing.

`packages/engine/src/simulation/opponentModel.ts` replaces it:

- One observation is filed per match the player actually plays (shape,
  attacking focus, formation). The window holds 6 and is bounded.
- A tendency must be what the player does **more often than not** — a bare
  plurality is not a habit, so mixing your approach up is a real
  counter-strategy.
- Confidence is agreement damped by how few observations exist, and a club acts
  only above a threshold that scales with its **manager's adaptability**. A
  sharp opponent reads you weeks before a poor one.
- A first meeting is played blind. Nothing is ever countered that has not been
  seen.
- Two independent dimensions — shape and repeated attacking flank — so the
  counter is not a single rock-paper-scissors throw.

**It is surfaced.** The match preview shows a "they have done their homework"
briefing naming what was noticed and what they will do about it, generated from
the same call that produces their tactics, so the briefing can never describe a
different plan from the one that walks out. A silent counter reads as the game
cheating; a stated one is a decision.

---

**And it closes the loop after the match.** The same decision that produces the
pre-match briefing also produces a past-tense recap — *"They came in having
watched you sit deep, and pressed high to pull that block apart"* — captured at
kick-off (before the cycle files a new observation) and shown on the result
screen. Preview and result can never describe different opponents.

**And it now happens during the match.** `packages/engine/src/matches/adaptation.ts`
takes the same read inside a match: every attack the player's side makes files
one observation — the shape and the attacking focus it was played in — into a
bounded window of the last 8, and the opposing bench acts on it with the same
majority rule, the same adaptability threshold and the same `counterPlan` the
pre-match model uses. There is one system, not two.

- **Observe.** An attack is filed where it ends, on the SHOT, and the event is
  stamped with the same value, so the replay shows exactly what the bench saw.
- **Identify.** At least 5 attacks; a real majority of the window in one
  shape or down one flank; confidence above the manager's threshold. A blunt
  manager needs the full window, a sharp one moves at the minimum.
- **Decide.** Shape first, focus only if the shape gave nothing. One dimension
  per adaptation. A side already set up to counter what it sees does nothing.
  The decision is a pure function that cannot be told the score: the type has
  no field for it (`@ts-expect-error` in the test proves the compiler refuses).
- **Adapt.** Max one adaptation per side per half, and none in a half in which
  the side has already changed shape (its scripted trailing response counts).
  A change the player makes is invisible until it has been played: the record
  keeps saying what the side *was* doing until attacks in the new shape out-vote
  it, so a just-changed tactic is never countered.
- **Told in football.** The live feed uses tagged commentary chosen exclusively
  for the change ("{club} sit off and go long. They've worked out where the
  space is."); the result screen's recap heading becomes "How they solved you"
  and adds the past-tense sentence. The word "adaptation" never appears.

The emergent routes an attack takes (cross, ball in behind, counter) were
measured first and rejected as the observable: tactics move them by a few
percent, dice move them by far more, and a majority appeared as often against
a narrow side as a wide one. Reading dice and calling it a read would be the
game cheating in the other direction.

## 4a. Entity ids — changed

Ids used to be identical in every save ever created: clubs `club_0`..`club_11`,
the first season literally `season_1`, fixtures and matches derived from those.
Two careers shared their ids exactly, which had already caused one silent bug.

`createNewGame` now derives a six-character token from the seed and creation
time and scopes what it creates: `mwru75_club_0`, `mwru75_season_1`,
`fx_mwru75_season_1_0`. Determinism is untouched — the token is a pure function
of the inputs, and a test asserts two runs stay byte-identical. Measured cost:
+144 kB on a ten-season save (+4.7%), affordable now careers are in IndexedDB.

The v6→v7 migration gives an existing career a token for ids it creates from
now on and leaves the ids it already holds alone.

## 4b. Content loading — changed

The base content pack is now a lazy chunk, and the player cannot tell.

Before, `BASE_PACK` was imported at module scope by the engine itself —
`newGame.ts` built a registry from it on every call, `cycle.ts` kept a module
cache of it, the generators used its name bank as a fallback, and the engine's
barrel re-exported it — so the pack lived inside the engine chunk and every
first visit downloaded 388 kB of fiction before the title screen. The earlier
attempt to split it died on load because of exactly those edges.

Now:

- **The engine never imports a pack.** `createNewGame` and `advanceCycle`
  take a `ContentRegistry`; the generators take a name bank and facility list.
  The engine's barrel exports no pack constants. A boundary test
  (`contentBoundary.test.ts`) fails on the first import that comes back.
- **One loader owns the lifecycle** — `apps/game/src/state/content.ts`:
  REQUEST → LOAD (one dynamic `import()`) → VALIDATE (the registry, same rules
  as any pack) → CACHE → READY. Concurrent callers share the in-flight
  promise; later callers share the registry; the promise never resolves with
  a partial registry; a failure drops the in-flight promise so the next call
  retries. Status (`IDLE`/`LOADING`/`READY`/`FAILED`) is subscribable.
- **Intent is the prefetch signal.** "Start your career" starts the load; the
  manager step (which needs nothing) makes sure it started; the club step
  renders immediately with its header, both paths and the whole club designer,
  and fills the takeover list in when the universe arrives — three card-shaped
  skeletons under "Preparing your league" until then, an inline "try again" if
  it never does. Confirming waits inside the existing "building the league"
  beat. Nothing says chunk, module or loading.
- **Nothing is created early.** `startNewGame` awaits the content, then
  builds, then saves, then says READY. A failure returns the phase to where
  it was with a message in the player's language. If a second creation is
  asked for while the first waits, the first stands down: only the latest
  request builds and saves. Booting a saved career waits for the content too;
  a content failure there is reported as such, offers "try again", and never
  offers to delete the save.
- **Determinism is untouched.** The same registry produces byte-identical
  worlds however it arrived; the three reference world hashes are unchanged
  by this refactor.

**When the universe does not arrive.** A browser remembers a module fetch
that failed and rejects the next `import()` of the same URL without touching
the network (Chromium does; measured, not assumed), which would have made
every "Try again" a lie. So a retry imports the chunk under a fresh query
string, with the URL taken from the preload link the bundler's helper leaves
in the document, or from the browser's error message; a browser that offers
neither falls back to the plain specifier. The loader passes the attempt
number and the previous failure to its importer and nothing else changed.
The failure journeys are proven in a real browser by `e2e/failure.mjs`, run
by `pnpm test:smoke` after the smoke suite: the club step failing and
recovering on retry, founding a club with no universe (nothing created,
nothing saved, choices kept), rapid retries sharing one request, a held
request resolving after the player has moved on, and a returning player
whose universe fails at boot (save untouched, no "start over" offered, retry
lands in the career). Failure is simulated by intercepting the chunk's
request — no app code knows it is being tested.

**Recovery is designed, not merely functional.** On the club step, "Try
again" keeps its block on screen with the button busy and the text reading
"Preparing your league…", so nothing jumps and nothing can be pressed twice;
when the clubs arrive, focus moves to the first of them — the first thing the
player can now do. A prefetch arriving on its own never moves focus. A failed
confirmation on the founding path returns the form exactly as it was with a
persistent inline notice above the button — "Your club could not be created.
Nothing was saved and everything you entered is still here." — that takes
focus, stays until the player acts, and is gone on the next attempt; it is no
longer a toast that left before it could be read. Both are asserted in the
browser suite: where focus is at failure, during the retry and after it, that
the notice survives longer than a toast would, and that the typed club name
survives the failure.

Measured on the built bundle (desktop headless Chromium, medians of three):
first screen 1738 → 1507 kB of script (−13%), engine chunk 282 → 205 kB
gzip, content chunk 77 kB gzip requested exactly once, confirm-to-playable
2390 → 2373 ms, journey bytes unchanged (no duplication).

## 5. What is strong

- Engine/UI separation is real, not aspirational.
- The 12-season headless invariant harness: no duplicated player ownership, no
  negative or double-paid money, tables that reconcile with their results.
- Long-session growth is bounded by design — event log capped at 600, ratings
  at 8, season summaries at 30, transcripts at 24.
- No Zustand selector returns a fresh object or array, so the usual
  over-render trap is absent; expensive derivations are memoised.
- Save integrity: versioned, checksummed, validated, backed up, and hardened
  against a storage adapter that refuses reads, writes and deletes.

---

## 6. Known limitations

- **Onboarding is now covered end to end.** A browser check creates a career
  from an empty install through every step of the real UI, and requires it back
  after a reload. It proves the career is *written*; the ordering — that
  creation does not resolve until the save is on disk — is asserted separately
  in `gameStore.test.ts`, because a write that merely races the player still
  lands before the browser test looks.
- **Content safety is audited and guarded.** `basePack.test.ts` asserts no real
  club, competition, nation or brand — and no competitor league mark — appears
  anywhere in the base pack, the club lore or either example pack. Licensed and
  community packs are test fixtures and are never loaded at runtime; the app
  loads `BASE_PACK` and nothing else. The App Store listing and the marketing
  site are guarded separately in `appStore.test.ts`, because the engine's
  corpus cannot reach them and hand-written marketing copy is where a
  competitor's name actually gets typed.
- **The snapshot-compute-apply invariant is enforced.** Feature engines that
  commit through `apply` must contain no async boundary; see
  `CURRENT_ARCHITECTURE.md` and `engineInvariant.test.ts`.
- **Two tabs share one career.** The IndexedDB connection now honours
  `versionchange`, so a newer build in another tab can upgrade the schema
  instead of being blocked into a localStorage fallback; a browser check opens a
  second page and requires it to see the first page's change.
- **Pre-v7 careers still share entity ids with each other.** New careers scope
  their ids to the career that created them (see §4a); existing saves keep the
  ids already written into them, because rewriting every club, fixture and
  ledger reference inside a live save is riskier than the collision warrants.
- **The engine ships as a 205 kB gzip chunk plus a 77 kB content chunk** that
  arrives only when a career is created or opened (see §4b). The split is
  guarded by a source-level boundary test and by the browser smoke suite,
  which counts the content request and refuses a blank step.
- **No real-device testing has been done.** Every performance number in this
  repository is desktop-browser or headless Node. Phase 23 of the current
  brief cannot be closed from CI.
- Several `docs/` files predate this one and describe earlier states. They are
  marked as superseded rather than deleted — they are the project's history.

Full list with severity and recommended next steps: `REMAINING_RISKS.md`.
