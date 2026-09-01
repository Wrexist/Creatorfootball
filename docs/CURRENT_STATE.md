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
| Engine tests | `pnpm --filter @cf/engine test` | **59 files, 771 tests, all passing** |
| App tests | `pnpm --filter @cf/game test` | **25 files, 253 tests, all passing** |
| **Total** | `pnpm test` | **1,024 tests, all passing** |
| Production build | `pnpm build` | pass |
| Browser smoke | `pnpm test:smoke` | **9/9** against the real bundle (~65 s) |
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
- **The engine ships as one 273 kB gzip chunk**, loaded behind the splash on
  first visit. Splitting it requires breaking a module-scope cycle; a previous
  attempt shipped a page that died on load.
- **No real-device testing has been done.** Every performance number in this
  repository is desktop-browser or headless Node. Phase 23 of the current
  brief cannot be closed from CI.
- Several `docs/` files predate this one and describe earlier states. They are
  marked as superseded rather than deleted — they are the project's history.

Full list with severity and recommended next steps: `REMAINING_RISKS.md`.
