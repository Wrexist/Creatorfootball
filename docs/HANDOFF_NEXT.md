# Creator Football — Handoff / What's Next

Snapshot for briefing a fresh agent or generating a master prompt.
`docs/CURRENT_STATE.md` is authoritative if this drifts.

## 1. Product

Creator Football — a premium, **iPhone-first football management game**. Build a
club, recruit footballers *and creators*, make hard calls during short live
matches, run the club, handle media/sponsors/supporters, build a dynasty.

Thesis: **deep systems underneath, few decisions on the surface.** Not a
spreadsheet sim, not a gacha, not esports.

## 2. Repo

pnpm monorepo, Node ≥20, TypeScript.

- `packages/engine` (`@cf/engine`) — every game rule. Headless, no DOM. One public entry point.
- `apps/game` (`@cf/game`) — React 19 + Vite 7 + Tailwind 4, Capacitor iOS shell.
- `tools/sim` (`@cf/sim`) — headless balance/invariant harness running the same engine.

## 3. Verified state (all passing)

| Gate | Command | Result |
|---|---|---|
| Types | `pnpm typecheck` | pass |
| Lint | `pnpm lint` | pass, `--max-warnings=0` |
| Engine tests | `pnpm --filter @cf/engine test` | 59 files / **769** |
| App tests | `pnpm --filter @cf/game test` | 24 files / **246** |
| **Total** | `pnpm test` | **1,015** |
| Build | `pnpm build` | pass |
| Browser smoke | `pnpm test:smoke` | **7/7** vs the real bundle |
| Balance audits | `pnpm audit:all` | economy, simulation, 9 invariants |

Key facts: `SAVE_VERSION` 7, careers persist to **IndexedDB**, migrations 1→7
complete. Save plateaus ~3.2 MB (does not grow unbounded). Engine ships as one
273 kB gzip chunk; ~460 kB gzip to interactive. `eventLog` capped at 600.
Determinism (seeded RNG, counter ids) is enforced by tests.

## 4. Done in the last three cycles — do NOT redo

1. **Save layer hardened.** `saveGame` returns adapter failures instead of throwing
   (a full disk used to discard a whole simulated week). Private-browsing /
   quota sessions now warn the player. Match-result commit guard is state-derived,
   not a module-level `Set`.
2. **Opponent AI no longer cheats.** It used to read `playerClub.tactics` — the
   player's tactics screen. Now driven by filed observations of matches actually
   played (bounded 6-match window), gated on a real majority and on the opposing
   manager's adaptability, and **surfaced** in the match preview.
3. **localStorage → IndexedDB.** Measured: careers stopped saving ~season 5.
   Verified migration, covered by a browser test.
4. **Write race fixed.** All saves go through a single-slot queue; abandoning a
   career could previously be undone by an in-flight save.
5. **Entity ids scoped per career.** Were identical in every save (`club_0`,
   `season_1`). Cost: +4.7% save size. Pre-v7 saves keep old ids.
6. **Browser save loop tested.** Real career → IndexedDB → UI change → reload →
   survives. Verified to fail when persistence is disabled.

## 5. What's next

### P0 — blocked on hardware
- **Real-device iPhone pass.** Every performance number in the repo is
  desktop-browser or headless Node. Measure startup, navigation, scrolling,
  pitch rendering, match animation, sheets, haptics, memory, battery, long
  sessions. **This gates every UX/immersion phase.** Cannot be done in a cloud
  sandbox — needs a device or a macOS runner.

### P1 — doable now
- **Browser coverage of onboarding.** The save-loop test seeds a career rather
  than creating one, so career creation is uncovered by any browser test. A
  regression there is currently caught only by a human.
- **Snapshot-compute-apply invariant.** Feature engines read `store.state` into a
  local, compute, then write onto whatever `apply()` sees. Safe only because
  every path is synchronous. One `await` would break it silently. Make the
  invariant explicit or enforced.

### P2
- **Split the engine chunk.** Blocked on a module-scope cycle between engine
  modules and content data; a previous attempt shipped a page that died on load.
  Prerequisite is breaking the cycle, not changing chunk config.
- ~~**Content-safety audit.**~~ **Done — and it turns out it always had been.**
  This entry said "never done" for three cycles and was wrong.
  `basePack.test.ts` flattens the base pack, the club lore and both example
  packs into one corpus and asserts that no real club, competition, nation or
  brand, and none of the competitor league marks, appears anywhere in it. The
  built bundle and the App Store listing were then scanned by hand and are
  clean. The one gap was the copy written outside the engine — the store
  listing and the marketing site — which is now guarded in `appStore.test.ts`.
- **In-match adaptation from the opponent model.** Today the only in-match AI
  response is one scripted trailing reaction. The observation model exists and
  is unused during a match.
- **Post-match story naming the opponent's read.** Close the loop: "they sat
  deep because they'd watched you press."

### P3
- Multi-tab IndexedDB behaviour; Safari eviction under pressure.
- Shard the long headless-season tests (~200 s of the engine suite).
- UX / progressive-disclosure passes across Squad, Training, Market, Scouting,
  Club, Finance, Facilities, Sponsors, Objectives, League, Press — **after** the
  device pass, not before.

## 6. Environment constraints (state these in any prompt)

- **No iPhone, no simulator, no macOS** in the cloud sandbox.
- Chromium 1194 vs Playwright 1234 — smoke test needs
  `CHROMIUM_PATH=/opt/pw-browsers/chromium-1194/chrome-linux/chrome`.
- On a loaded machine `pnpm test` can exit non-zero after all tests pass
  (`[vitest-worker]: Timeout calling "onTaskUpdate"`). Pre-existing, reproduces
  at HEAD, load-dependent. Not a test failure.

## 7. Codebase rules (non-negotiable)

- No game rules in components. Screens read state and call engine functions.
- No `Math.random` or wall-clock in engine logic — determinism is tested.
- Engine never touches the DOM or storage; the host supplies a `StorageAdapter`.
- All money moves through the ledger. Content goes through the schema.
- Don't weaken, skip or delete tests to get green. Changing a test is only
  legitimate when the *specification* changed — say so in place.
- The opponent must never read the player's tactics screen, and must not cheat
  or rubber-band.
- Design system only: dark graphite, glass hierarchy, white type, electric-lime
  accent. No new colours, no hard-coded colours, no added neon.

## 8. How to write the next master prompt

Learned across three cycles, stated plainly: **28-phase sweeping prompts produce
two things done well and twenty-six declined.** The codebase is mature and green;
broad audits come back green and burn the budget re-reading it.

Make the next prompt:
- **Scoped to 1–3 objectives**, named concretely.
- **Measurement-first**: require numbers before any change ("measure save
  composition before compressing" is what correctly killed a bad plan here).
- **Proof-first**: require a failing test that demonstrates the bug before the
  fix, and re-verification that the test fails without it.
- **Honest about the environment**: don't ask for real-device work unless a
  device is attached; don't reference a video unless one is supplied.
- **Explicit that the codebase is the source of truth** over any doc.

### Skeleton to fill in

```
You are <role> for Creator Football, a premium iPhone-first football
management game. The repository is mature: 1,015 tests, typecheck, lint,
production build, a 7-check browser smoke suite and three balance audits all
pass. Read docs/CURRENT_STATE.md first; the code overrides any document.

OBJECTIVE (pick 1-3):
  1. <specific outcome>
  2. <specific outcome>

FOR EACH:
  - Measure before changing. Report the numbers.
  - Prove any bug with a failing test before fixing it.
  - Make the smallest effective change.
  - Re-run: typecheck, lint, tests, build, test:smoke, audit:all.

CONSTRAINTS:
  - No iPhone/simulator/macOS available. Do not plan real-device work.
  - Never weaken or delete a test to get green.
  - <paste section 7 rules>

DELIVERABLE:
  What you measured, what you changed, what you did NOT do and why,
  what is still open.
```
