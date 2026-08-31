# Production Readiness Audit

Scope: full-repository hardening pass. Baseline was measured before any change
and re-measured after.

## Baseline

The repository arrived **green**. Typecheck, lint (`--max-warnings=0`),
987 unit tests, the production build and all three balance/invariant audits
passed on the first run with no modification. Nothing here was found by watching
something fail; it was found by reading the code and then writing tests that
made it fail.

| Gate | Before | After |
|---|---|---|
| `pnpm typecheck` | pass | pass |
| `pnpm lint` | pass | pass |
| Engine tests | 742 | **753** |
| App tests | 234 | 234 |
| `pnpm build` | pass | pass |
| `pnpm test:smoke` | pass | pass |
| `pnpm audit:all` | pass | pass |

No failure was reclassified, weakened, or skipped to produce a green run. One
environment issue was hit and worked around without changing product code: the
sandbox ships Chromium build 1194 while Playwright 1.62 expects 1234, so the
smoke test was run through the existing `CHROMIUM_PATH` escape hatch.

## What was already strong

Worth stating plainly, because it shaped how little needed changing:

- **Engine/UI separation is real**, not aspirational. Game rules live in
  `@cf/engine` and the headless harness runs the same code the player does.
- **Determinism is enforced by tests.** Seeded RNG, counter-derived ids, and an
  audit that catches two subsystems sharing a random stream.
- **The invariant harness is genuinely production-grade.** Twelve headless
  seasons asserting no duplicated player ownership, no negative or
  double-paid money, tables that reconcile with their results.
- **Long-session growth is already bounded.** `eventLog` is capped at 600,
  ratings at 8, season summaries at 30, milestones and objectives capped.
  Save size does not grow without limit over a long career.
- **No store selector returns a fresh object or array**, so the usual Zustand
  over-render trap is absent. Expensive derivations are behind `useMemo`.
- **The save format was already versioned, checksummed, validated and backed
  up.** The defects below were in how it handled a hostile *adapter*, not in
  its design.

## Defects found and fixed

### 1. A refused storage write escaped as a thrown promise (high)

`saveGame` awaited `storage.set` with no `try`. `WebStorage.set` throws a real
`Error` when localStorage rejects a write — Safari's quota exhaustion is the
common case. Three callers could not survive that:

- `gameStore.apply()` persists without awaiting (`void notePersist(next)`).
  A throw became an **unhandled promise rejection**, and `persistFailed` was
  never set, so the "changes could not be saved" toast the code was built to
  show never appeared. The player kept playing against a save that had silently
  stopped advancing.
- `gameStore.advance()` wraps the cycle in a `try`. A failed *write* therefore
  landed in the same catch as a failed *simulation*, and the `set({ state })`
  never ran — **the entire simulated week, match result included, was
  discarded because the disk was full.**
- `startNewGame()` sent the player to the save-recovery error screen and
  destroyed a world that had been created successfully.

Fixed in `packages/engine/src/persistence/save.ts`: reads and writes go through
`tryRead`/`tryWrite`, which return failures as values. A refused write leaves
the previous good save untouched and does **not** update the metadata, so the
save slot never advertises a save that was not written. `deleteSave` no longer
throws either, so a career can always be abandoned.

`gameStore.apply()` additionally carries a `.catch` backstop, and with the throw
removed `advance()` now keeps the simulated cycle and warns, rather than
throwing a week of football away.

Covered by `packages/engine/test/saveResilience.test.ts` (6 tests) against a
`HostileStorage` adapter that refuses reads, writes and deletes. The first of
these was confirmed failing against the pre-fix code.

### 2. A session that cannot persist was never disclosed (high)

`WebStorage` detects private browsing and post-quota fallback correctly and
exposes `isEphemeral` — and **nothing read it.** The game ran entirely in
memory, worked perfectly, and lost the player's whole career on reload with no
warning at any point.

Fixed by carrying `ephemeralStorage` on the game store, set at boot and
re-checked after every write (a device can fall into the fallback mid-session),
and surfaced once as a plain-language warning in `App.tsx`: the player is told
they can keep playing but the career will not survive closing the app.

### 3. The double-commit guard broke across careers (high)

Committing a match result is not idempotent — it advances the week — so the
result screen guarded it with a module-level `Set` of match ids.

That guard failed in two directions. It did not survive a reload, so a refresh
on the result screen could advance the week twice. Worse, it outlived the career
that filled it: because the season id is hardcoded `season_1`, **fixture and
match ids repeat across saves**. Abandoning a career and starting another in the
same session left the new career's first result already marked committed, and it
was dropped in silence — no points, no money, no week advanced.

Fixed by deriving the answer from the world instead. `isMatchResultApplied`
(`game/selectors.ts`) asks whether a fixture carrying that match id is already
`COMPLETED`, which is exactly what applying a result does. The check moved into
`gameStore.advance()` so it protects every caller, `busy` covers the in-flight
window, and the module-level `Set` is gone.

Covered by `packages/engine/test/matchCommitGuard.test.ts` (5 tests), including
one that asserts the id collision across two careers so the root cause cannot
quietly return.

## Examined and found sound

Not everything inspected was broken. Recording these so the next pass does not
re-litigate them:

- **Match decision deadlines.** The store sets a wall-clock deadline for every
  prompt including those declaring no timeout, and `DecisionOverlay` enforces it
  from a `requestAnimationFrame` loop, applying the engine's default option. A
  match cannot stall on an unanswered prompt. Backgrounding the tab pauses the
  countdown, which is the desired behaviour.
- **Timers and listeners.** Every `setInterval` and `addEventListener` found in
  the app has a matching teardown. The match tick timer is a single module-level
  handle cleared before every reschedule, so speed changes and replays cannot
  accumulate timers.
- **Economy double-spend.** The read-compute-apply sequences in the market,
  squad and progression engines are fully synchronous, so no state can change
  between the read and the write.
- **Bundle chunking.** The engine ships as one chunk deliberately; see
  PERFORMANCE_NOTES.

## Verification after changes

All of the following were run to completion after the final edit:

```
pnpm typecheck    pass
pnpm lint         pass  (--max-warnings=0)
pnpm test         pass  (753 engine + 234 app = 987)
pnpm build        pass
pnpm test:smoke   pass  (5/5 against the real production bundle)
pnpm audit:all    pass  (economy, simulation, 9 invariants, save integrity)
```


---

# Addendum — gameplay and persistence cycle

A later pass against the current-state gameplay brief. Baseline was again fully
green before any change.

## Fixed

**Persistence outgrew localStorage (P0, measured).** A career's save plateaus
at ~3.1 MB and the save layer keeps a backup, so a mature career needed ~6.3 MB
against a ~5 MB budget — careers stopped saving around season five. Trimming was
measured and rejected (still ~4.7 MB, and it costs the player their financial
history). Careers now live in IndexedDB, with a verified migration of any
existing localStorage save. Covered by a real-browser check in `pnpm test:smoke`.

**The opponent AI was cheating (P0).** It read `playerClub.tactics` directly at
match setup — the player's tactics screen — while its own comment described
reading what the player "has been playing all month". It is now driven by filed
observations of matches actually played, gated on a real majority and on the
opposing manager's adaptability, and surfaced to the player in the match
preview.

## Tests changed on purpose

Three tests were rewritten because the **specification** changed, not to make a
run green. Each now asserts the inverse of what it asserted before, with a
comment saying why:

- `aiClub.test.ts` — "reads the lean from the PLAYER'S setup" became "ignores
  the player's tactics screen entirely", plus a new test that the counter must
  be earned over repeated matches.
- `matchSetup.test.ts` — the counter-lean wiring test now plays the shape before
  expecting it to be countered, and a new test asserts an unplayed shape is
  *not* countered.
- `save.test.ts` — migration chain extended to v6.

## Verification

```
pnpm typecheck    pass
pnpm lint         pass  (--max-warnings=0)
pnpm test         pass  (767 engine + 234 app = 1,001)
pnpm build        pass
pnpm test:smoke   pass  (6/6, including the IndexedDB migration)
pnpm audit:all    pass
```
