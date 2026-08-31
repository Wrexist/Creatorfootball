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
| Engine tests | `pnpm --filter @cf/engine test` | **59 files, 767 tests, all passing** |
| App tests | `pnpm --filter @cf/game test` | **24 files, 246 tests, all passing** |
| **Total** | `pnpm test` | **1,013 tests, all passing** |
| Production build | `pnpm build` | pass |
| Browser smoke | `pnpm test:smoke` | **6/6** against the real bundle |
| Balance audits | `pnpm audit:all` | economy, simulation, 9 invariants — all pass |

Earlier documents state 262, 531, 653 and 753 tests. All are historical.
`pnpm test` is the only source of truth.

**Known tooling issue.** On a slow machine `pnpm test` can exit non-zero after
every test passes, with `[vitest-worker]: Timeout calling "onTaskUpdate"`. That
is the reporter's RPC timing out, not a test failing. It reproduces at `HEAD`
with no local changes. See `REMAINING_RISKS.md` §9.

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

Save format: `SAVE_VERSION` is **6**, with a registered migration for every
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

- **Entity ids are not unique across careers.** The season id is hardcoded
  `season_1`, so fixture and match ids repeat between saves. Defended against
  at the one place it caused a bug; the root cause is open.
- **The engine ships as one 273 kB gzip chunk**, loaded behind the splash on
  first visit. Splitting it requires breaking a module-scope cycle; a previous
  attempt shipped a page that died on load.
- **No real-device testing has been done.** Every performance number in this
  repository is desktop-browser or headless Node. Phase 23 of the current
  brief cannot be closed from CI.
- Several `docs/` files predate this one and describe earlier states. They are
  marked as superseded rather than deleted — they are the project's history.

Full list with severity and recommended next steps: `REMAINING_RISKS.md`.
