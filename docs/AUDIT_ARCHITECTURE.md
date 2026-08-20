# AUDIT ONE: ARCHITECTURE

**Subject:** Creator Football (`/home/user/Creatorfootball`)
**Date:** 2026-08-20
**Method:** full read of `packages/engine/src` (36,137 lines), `apps/game/src`, `tools/sim/src`, all configs; plus
executed probes — every quantitative claim below was measured, not inferred. Throwaway probe scripts were
deleted after use. No files were modified; no git commands were run.

**Baseline state of the tree (verified, not assumed):** `pnpm lint` clean, `pnpm typecheck` clean,
`pnpm test` = 42 files / 531 tests, all passing, `pnpm audit:all` exits 0 with every check green.
`docs/ARCHITECTURE.md` §12 claims lint does nothing, CI is empty, `tools/sim` entry points are missing and two
tests fail. All four statements are stale — see F26.

---

## Executive summary

The three things that most need fixing:

1. **The game has no season two.** `advanceCycle` never rolls the season over: after matchweek 22 the clock
   keeps counting, `clock.season` stays at 1 forever, no fixtures are generated, no champion is crowned, and
   the club decays into a dead world with reputation 1 and zero sponsors. Every "20-season dynasty" guarantee
   in the docs, and both multi-season balance audits, are measuring one season followed by idle weeks.

2. **Money moves outside the Ledger, and the two stores have already diverged.** `Club.finance.transferBudget`
   is a second, unaudited money field that `worldTick` mutates directly; after a single simulated season the
   ledger delta and the budget delta disagree by up to £1.1M on individual clubs. Nothing in `auditEconomy`
   checks the two against each other, which is why 100 clean audit runs never caught it.

3. **Roughly 85% of the authored world never reaches the player.** Rivalries are never seeded into a real save
   (`createNewGame` returns `rivalries: {}` and `seedRivalries` is only ever called from test fixtures);
   27 of 51 domain event types are never emitted by anything; and across five full simulated seasons only
   23 of 191 social templates and 10 of 62 media templates were ever used. The feed repeats the same line
   21 times a season. This is `RISKS.md` R4 already happening.

The bones are good. Determinism holds byte-for-byte across a save/load boundary, immutability at the boundary
holds for every entry point I could test, and the purity boundary is real and CI-enforced. What is missing is
not architecture — it is *wiring*. Six workstreams built six halves and the orchestrator in
`packages/engine/src/game/cycle.ts` connects about two thirds of them.

---

## Findings

| ID | Title | Severity | Confidence | Location | One line |
|---|---|---|---|---|---|
| F1 | No season rollover; the game ends at week 22 forever | Critical | Certain | `game/cycle.ts:295–330` | `seasonComplete` is reported and then ignored |
| F2 | `transferBudget` is a second money store that diverges from the Ledger | Critical | Certain | `simulation/worldTick.ts:384,476,482` | Direct budget mutation; measured £1.1M divergence in one season |
| F3 | Rivalries are never seeded in a real save | High | Certain | `game/newGame.ts:456` | `rivalries: {}`; `seedRivalries` only called from test fixtures |
| F4 | 85% of authored social/media content is unreachable | High | Certain | `content/packs/base/{social,media}.ts` | 23/191 social and 10/62 media templates used in 5 seasons |
| F5 | Both multi-season balance audits measure one season plus idle weeks | High | Certain | `tools/sim/src/economyAudit.ts:95–112` | Consequence of F1; the headline inflation guarantee is vacuous |
| F6 | "Advance week" blocks the main thread ~245 ms desktop, ~1 s on a phone | High | Measured | `game/cycle.ts:87` | 6 matches × 26 ms + save; no worker, no yielding |
| F7 | Save is ~0.9 MB after one season and will exhaust the localStorage quota | High | Measured | `platform/storage.ts`, `persistence/save.ts` | Save + backup ≈ 1.75 MB after season 1, ~4.8 MB projected at season 20 |
| F8 | Quota failure hides the existing save and the rejection is swallowed | High | Certain | `platform/storage.ts:51`, `gameStore.ts:175` | `void persist(next)` drops an unhandled rejection |
| F9 | Concurrent `apply()` saves race; lost update and backup clobber | High | Certain | `gameStore.ts:167–176` | Read-modify-write with no serialisation |
| F10 | AI clubs have no financial cycle at all | High | Measured | `game/cycle.ts:180` | `runFinancialCycle` runs for the player's club only; 22 `WAGES` txs in 22 weeks |
| F11 | `EventBus` is dead code; 27/51 event types are never emitted | High | Certain | `core/events.ts:129–176` | Documented spine is not the implemented mechanism |
| F12 | Two `formatMoney` implementations that disagree on 6 of 9 sample values | High | Demonstrated | `economy/ledger.ts:368`, `design/domain/numbers.tsx:89` | Engine says £12M, the screen next to it says £12.3M |
| F13 | Two standings computations with different fixture inputs | High | Certain | `game/cycle.ts:166–173` vs `game/selectors.ts:96` | Latent: diverges the moment a second season exists |
| F14 | O(n²) state copying in the cycle orchestrator | High | Measured | `game/cycle.ts:370–383, 400–410` | 23× slower at n=216, 1124× at n=1728, vs the batch helper that already exists |
| F15 | Negotiation orchestration and `transfers.completed` are owned by React | High | Certain | `features/market/engine.ts:254–360` | AI transfers never recorded; headless harness cannot exercise negotiation |
| F16 | Runtime ports are never installed by the host | High | Certain | `app/App.tsx:44–57` | `setInvariantMode`, `setForkCollisionMode`, `setHapticDriver` all unset |
| F17 | Capacitor is not a dependency; the mobile shell does not exist | High | Certain | `apps/game/package.json` | `capacitor.config.ts` imports a package that is not installed and is not typechecked |
| F18 | `pruneKeys` is never called; `appliedKeys` grows monotonically | Medium | Certain | `economy/ledger.ts:299` | Retention comment describes a season boundary that does not exist |
| F19 | `toLocaleString('en-GB')` in 25 engine sites; Intl inside the "pure" engine | Medium | Certain | `transfers/negotiation.ts` (18 sites) et al. | Persisted into `Negotiation.history`; ESLint does not catch it |
| F20 | Content registry is a module-level singleton, ×3, ignoring `enabledPackIds` | Medium | Certain | `game/cycle.ts:588`, `market/engine.ts:50`, `harness.ts:20` | `visibleFor`/`isRenderable` are never called at runtime |
| F21 | Negotiation RNG freezes after the transcript hits its 24-entry cap | Medium | Certain | `features/market/engine.ts:292–295` | Stream seed stops advancing; the AI's "random" counter becomes fixed |
| F22 | Tautological and hand-maintained assertions in the audit/test suite | Medium | Certain | `tools/sim/src/invariantAudit.ts:110–113` | Checks that a value equals the formula that produced it |
| F23 | Engine emits no build artifact; `main` points at `.ts` | Medium | Certain | `packages/engine/package.json` | Blocks a Node server or any non-bundler consumer |
| F24 | `apps/game` tests never run in CI; `capacitor.config.ts` never typechecked | Medium | Certain | root `package.json`, `apps/game/tsconfig.json` | `design/seed.test.ts` has never executed in CI |
| F25 | Migration machinery has never been exercised | Medium | Certain | `persistence/save.ts:64` | `MIGRATIONS` is `{}`; no test constructs a v0 save |
| F26 | `docs/ARCHITECTURE.md` §12 is materially wrong | Medium | Certain | `docs/ARCHITECTURE.md:496–530` | Claims lint/CI/tools do not exist; all three do and all are green |
| F27 | `Ledger.accumulate` does two linear scans per transaction | Low | Certain | `economy/ledger.ts:272,286` | O(seasons × clubs) per post; ~240 rows at season 20 |
| F28 | 32-bit seed space and `hashString` collisions | Low | Measured | `core/rng.ts:11–19` | ~1 expected collision per 20-season save; 0 observed in 104,720 real labels; effect invisible |
| F29 | `fork()` label concatenation is ambiguous | Low | Certain | `core/rng.ts:81` | `fork('a').fork('b')` === `fork('a:b')` |
| F30 | Misc: dead ternary, live-array leak, layering inversion, token-fill bug | Low | Certain | see §F30 | Cosmetic to minor |

---

## F1 — There is no season rollover *(Critical)*

### What is wrong

`advanceCycle` computes `seasonComplete` and puts it in the summary, then advances the clock and returns.
Nothing anywhere creates a new `Season`, generates a new fixture set, increments `clock.season`, resets
`Club.seasonRecord`, sets `Season.completed` / `Season.championClubId`, writes a `SeasonSummary`, or awards a
trophy.

```ts
// packages/engine/src/game/cycle.ts:294–312
  const totalWeeks = season?.totalWeeks ?? 22;
  const seasonComplete = week >= totalWeeks;      // computed…

  next = {
    ...next,
    clock: {
      cycle: next.clock.cycle + 1,
      season: next.clock.season,                  // …and never acted on
      week,
      phase: phaseForWeek(week, totalWeeks),
      updatedAt: opts.now,
    },
```

`grep -rn "season + 1\|startNewSeason\|rolloverSeason\|newSeason"` across the whole repo returns nothing.
`SEASON_STARTED`, `SEASON_COMPLETED`, `TROPHY_WON`, `PROMOTED` and `RELEGATED` are declared in
`DomainEventPayloads` and emitted by nothing.

### Concrete failure scenario

The player finishes matchweek 22 and taps "advance". Nothing happens, and it keeps not happening forever.

### Evidence

A probe that plays 200 cycles from a fresh save:

```
week  20 season 1  cash      33256  squad 18  fixturesLeft 12  reputation 29.4  sponsors 2
week  22 season 1  cash     101842  squad 18  fixturesLeft  0  reputation 28.7  sponsors 2
week  40 season 1  cash     146966  squad 13  fixturesLeft  0  reputation  1    sponsors 0
week 100 season 1  cash     135198  squad 16  fixturesLeft  0  reputation  1    sponsors 0
week 200 season 1  cash     137955  squad 16  fixturesLeft  0  reputation  1    sponsors 0
```

The world does not merely stop — it rots. Reputation collapses to the floor, every sponsor deal lapses and is
never replaced (offers are gated on reputation), contracts continue ticking down so squads shed players, and
free agents accumulate with nobody able to afford them. A 90-cycle probe showed `legacy.trophies`,
`legacy.seasonSummaries` and `legacy.legends` all still empty, and `clock.phase` pinned at `PLAYOFFS`.

### Proposed fix

Add `rolloverSeason(state, rng, ctx)` in `packages/engine/src/game/` (workstream G territory), invoked from
`advanceCycle` when `seasonComplete`. It must: emit `SEASON_COMPLETED` + `TROPHY_WON` (+ `PROMOTED`/`RELEGATED`
when tiers exist); append `summariseSeason(state)` to `legacy.seasonSummaries` (the function already exists in
`progression/legacy.ts` and is unused by the cycle); reset `seasonRecord` on every club; call
`generateFixtures` for season *n+1* and *replace* rather than append the fixture record (or key standings by
season — see F13); call `ledger.pruneKeys(cycle)` (F18); age every player by one year; roll season objectives;
and increment `clock.season`. Then extend `tools/sim/harness.ts` with a `playSeasons(n)` that actually crosses
the boundary, and make the invariant audit's "three-season run" real.

**Effort:** 3–5 days including the fixture/standings re-keying and audit updates. This is the single highest-
value change in the repo and most of the other Critical/High findings are only measurable once it exists.

---

## F2 — Money moves outside the Ledger *(Critical)*

### What is wrong

`INTEGRATION_CONTRACT.md` universal rule 5: *"Money never moves except through `Ledger.post/credit/debit`."*
`ClubFinance.transferBudget` is a money field on the club, and `worldTick` writes it directly in three places:

```ts
// packages/engine/src/simulation/worldTick.ts:474–484
        clubs[buyer.id] = {
          ...buyer,
          squad: [...buyer.squad, player.id],
          finance: { ...buyer.finance, transferBudget: Math.max(0, buyer.finance.transferBudget - fee) },
        };
        if (seller) {
          clubs[seller.id] = {
            ...seller,
            squad: seller.squad.filter((id) => id !== player.id),
            finance: { ...seller.finance, transferBudget: seller.finance.transferBudget + fee },
```

and again at line 384 for AI facility investment. The `Math.max(0, …)` clamp guarantees permanent divergence:
when a club's budget cannot cover a fee, the Ledger is debited the full amount and the budget is debited less.

### Concrete failure scenario

A player looks at the Finances screen, which shows a Ledger-derived cash balance, and the Market screen, which
gates spending on `finance.transferBudget`. The two numbers describe different worlds. Worse for V2: a
server-arbitrated match or a co-op club cannot reconcile a club's wealth, because there is no single authority.

### Evidence

One simulated season, 12 clubs, comparing the ledger delta against the budget delta:

```
club            cash0        cash22        budget0      budget22   ledgerDelta  budgetDelta
Vantage          5100000      4641489      2805000      1698489      -458511     -1106511
Aurelia          8200000      4678877      4510000       254477     -3521123     -4255523
Larkspur         2800000      2366017      1540000         4417      -433983     -1535583
Verrow           3200000      3709865      1760000      1636265      +509865      -123735
Cinderwick       1100000        46849       605000            0     -1053151      -605000
```

Five of twelve clubs diverge, one of them by more than £1.1M, and one moves in the *opposite direction* on the
two ledgers. `auditEconomy` passes on all of it, because it never compares `finance.transferBudget` to
`ledger.cashOf(clubId)`.

A second, related hole in the same block: the transfer is recorded as two *independent* transactions —
buyer → `world:transfer_market` and `world:transfer_market` → seller. Because `world` is an infinite
source/sink by design, a failure or a change on one leg silently creates or destroys money with no invariant
able to detect it.

### Proposed fix

Two parts. (a) Make `transferBudget` a *derived* value, not stored state — a selector over
`ledger.cashOf(clubId)` minus committed wages and pending deals — or, if it must stay a distinct allowance,
route every change through a `BUDGET_ALLOCATION` transaction so the Ledger remains the single writer.
(b) Post transfers as one club→club transaction rather than two world-crossing legs. (c) Add a
`BUDGET_MISMATCH` check to `auditEconomy` comparing the two stores; it is a two-line check and it is exactly
the invariant that was missing.

**Effort:** 1–2 days for (a)+(b); 30 minutes for (c), and (c) should land first so the fix is provable.

---

## F3 — Rivalries are never seeded *(High)*

### What is wrong

```ts
// packages/engine/src/game/newGame.ts:456
    rivalries: {},
```

`seedRivalries(clubs, templates, rng)` exists in `rivalries/rivalries.ts`, is tested by 15 assertions, and has
a dedicated cross-workstream contract test in `contentIntegration.test.ts`. Its only non-test caller is
`simulation/fixtures.ts:318` — which is the *test-world builder*, not production code.

### Concrete failure scenario

Every consequence of a rivalry is inert in every real save:

- `buildMatchSetup` always passes `rivalryIntensity: 0` to the simulator, so derby atmosphere and pressure
  never apply.
- `advanceCycle`'s `rivalryFor(...)` always returns `null`, so `updateRivalry` never runs — the branch at
  `cycle.ts:120–147` is dead.
- `RIVALRY_CREATED` and `RIVALRY_INTENSIFIED` are never emitted, so the `RIVALRY_HEAT` cascade hook never
  fires and every template keyed to it is unreachable (feeding F4).
- `RivalriesScreen.tsx` and the `rivalsOf()` selector render an empty list forever.
- The calendar still labels weeks `RIVALRY_WEEK` and `DERBY_WEEK`, and 18 of 132 fixtures still carry
  `isDerby: true` (that flag comes from the club templates via `league/fixtures.ts:132`), so the UI promises a
  derby the simulation does not model.

### Evidence

```
rivalries at newGame: 0
derby fixtures: 18 of 132
rivalries after a season: 0
```

### Proposed fix

Call `seedRivalries(Object.values(clubs), templates, rng.fork('rivalries'))` in `createNewGame` and assign the
result to `rivalries`. Add an invariant-audit check asserting `Object.keys(state.rivalries).length > 0` after
`startGame` — the absence of that check is why this survived 531 tests.

**Effort:** 1 hour for the fix, plus a day of balance re-verification because 18 fixtures a season will
suddenly acquire real intensity modifiers.

---

## F4 — Most of the authored world never reaches the player *(High)*

### What is wrong

The content workstream authored 191 social templates and 62 media templates keyed to `DomainEventType` names
and cascade triggers. The orchestration and world workstreams emit 24 of the 51 declared event types. The gap
is not covered by the `TRIGGER_FALLBACKS` alias table in `simulation/templating.ts`.

### Evidence

Five independent seeds × 22 matchweeks, collecting the `tpl:<id>` tag every generated post and story carries:

```
social templates: 23/191 used (12%)
media  templates: 10/62 used (16%)
templates behind triggers that never fired once: 169 of 253 authored (67%)
```

Triggers with zero usage include `TROPHY_WON`, `SEASON_STARTED`, `SEASON_COMPLETED`, `PROMOTED`, `RELEGATED`,
`RIVALRY_CREATED`, `RIVALRY_INTENSIFIED`, `TRANSFER_COMPLETED`, `TRANSFER_BID_REJECTED`, `TRANSFER_HIJACKED`,
`SCOUT_REPORT_READY`, `REPUTATION_CHANGED`, `FAN_SENTIMENT_CHANGED`, `SPONSOR_LOST`, `OBJECTIVE_FAILED`,
`PLAYER_MORALE_CHANGED`, `SPECIAL_RULE_TRIGGERED`, `LIVE_DECISION_MADE`, `BALANCE_LOW`.

The visible result, from one season of generated posts (396 posts, 171 distinct texts):

```
   21x  A club record. Cinderwick Town writes his name into the history of Cinderwick Town. 📖
   20x  A record that has stood for a generation falls to Cinderwick Town.
   12x  Defeat for Vantage Point FC, who have now taken one point from a possible nine.
```

That first line is also a token-fill bug — the `RECORD_BROKEN` hook is passing a club name into a `{player}`
token slot (see F30).

### Why the tests did not catch it

`simulation/contentIntegration.test.ts:82` asserts *"reaches authored content for every trigger, directly or
through an alias"* — but the trigger list it checks (`EMITTED`, lines 62–70) is a hand-maintained array
inside the test file, not derived from the code. And the companion test *"lets authored content carry the
feed rather than the built-in fallbacks"* hand-constructs `RED_CARD`, `MATCH_WON` and `PLAYER_SIGNED` events —
three of the four triggers that actually fire. It is green, and it proves nothing about the real system.

### Proposed fix

1. Emit the missing events. Most are one line each at a site that already has the data:
   `FAN_SENTIMENT_CHANGED` in `worldTick`'s drift phase, `REPUTATION_CHANGED` wherever reputation moves,
   `RIVALRY_INTENSIFIED` from `cycle.ts:141`, `TRANSFER_COMPLETED` from `worldTick.ts:490`,
   `SEASON_*`/`TROPHY_WON` from F1's rollover, `CONTRACT_SIGNED` from `renewKeyContracts`.
2. Replace the hardcoded `EMITTED` array with a generated inventory: a test that walks the emission sites (or
   a runtime-registered `EMITTED_EVENT_TYPES` set) and fails when a `DomainEventPayloads` key has no producer.
3. Add an audit that plays a season and asserts template coverage above a floor (say 60%). It is a ten-line
   check and it turns R4 from a subjective worry into a number on the dashboard.

**Effort:** 2–3 days for the emissions, half a day for the coverage audit.

---

## F5 — The multi-season balance audits measure nothing *(High)*

### What is wrong

`tools/sim/src/economyAudit.ts` advertises *"100 independent seasons, plus a 5-season continuous run"* and
prints an inflation table. Because of F1, seasons 2–5 of that continuous run contain **zero matches**.

```ts
// tools/sim/src/economyAudit.ts:98–101
  for (let season = 1; season <= MULTI_SEASON_DEPTH; season++) {
    const totalWeeks = state.seasons[state.currentSeasonId]?.totalWeeks ?? 22;
    state = playWeeks(state, totalWeeks, (season - 1) * totalWeeks).state;
```

`playWeeks` calls `advanceCycle` 22 more times; `advanceCycle` finds `f.week === week && status === 'SCHEDULED'`
and gets an empty list.

### Evidence

Actual audit output:

```
Inflation across 5 continuous seasons
  season  total cash  mean wage  mean value  insolvent
  1       £37M        £32K       £3.1M       0
  5       £65M        £41K       £2.7M       0
  PASS  wage growth over 5 seasons   1.29x   target >= 0.6, <= 2.5
```

The 1.29× wage growth comes from contract renewals during 88 weeks of idleness, not from a football economy.
`tools/sim/src/invariantAudit.ts:255–259` has the same defect: its "three-season run" is one season plus 44
empty weeks, so the invariants that only break across a season boundary have never been exercised.

### Proposed fix

Blocked on F1. Once rollover exists, both harness loops become correct automatically; add an assertion in
`harness.playWeeks` that `results.length > 0` on any week the fixture list says has fixtures, so the audits
fail loudly rather than quietly measuring an empty world.

**Effort:** 2 hours after F1.

---

## F6 — "Advance week" blocks the main thread *(High)*

### Evidence

Profiled on desktop Node (V8, warm), state at cycle 5 of a real save:

```
fixtures this week: 6
buildMatchSetup x6                 0.61 ms
simulateMatch x6                 155.27 ms      (26 ms per match)
tickWorld                         10.06 ms
refreshMarket                      5.71 ms
computeStandings                   0.20 ms
FULL advanceCycle                244.83 ms
saveGame (MemoryStorage)          21.40 ms      (of which 8.9 ms is one JSON.stringify)
```

`gameStore.advance` calls `advanceCycle` synchronously, then `persist` synchronously. Mid-range Android JS
runs roughly 4× slower than this machine, and `localStorage.setItem` of a ~875 KB string is genuine
synchronous disk I/O on top. Realistic budget on target hardware: **1.0–1.4 seconds of frozen UI** every time
the player advances a matchweek. There is no worker, no `requestIdleCallback`, no chunking, and the store sets
`busy: true` but nothing yields to the paint.

### Proposed fix

Three independent wins, in order of ratio:

1. Chunk the cycle. `advanceCycle` already runs matches in a loop; expose an
   `advanceCycleStepwise(state, opts)` generator that yields after each fixture so the UI can paint a
   "Vantage 2–1 Ember" ticker instead of a freeze. This turns the worst part of the cost into the best part of
   the experience.
2. Move `saveGame` off the critical path — debounce it, and stringify in a worker (the state is structured-
   clonable).
3. Profile `simulateMatch`; 26 ms for a 30-minute 7-a-side match is high for a tick model, and the five AI
   matches do not need pitch frames or commentary at all. A `presentation: false` flag on `MatchSetup` that
   skips `PitchFrame` construction and commentary lookup for simulated matches is likely worth 40–60%.

**Effort:** 1 day for (2), 2–3 days for (1), 1–2 days for (3).

---

## F7 / F8 / F9 — The save is not safe enough *(High)*

### F7 — Unbounded growth against a hard quota

Measured composition after **one** season:

```
total save chars: 875,863 (0.84 MB)
   players             246,549  28.1%
   ledger              144,928  16.5%   (137,805 of it transactions)
   eventLog            131,037  15.0%
   social              100,124  11.4%
   contracts            76,111   8.7%
   media                51,445   5.9%
   fixtures             43,139   4.9%
```

`saveGame` writes the save *and* promotes the previous save to `BACKUP_KEY`, so localStorage holds ~1.75 MB
after season one. Growth measured over cycles 22→90 is ~3.5 KB/cycle, projecting to ~2.4 MB per copy
(≈4.8 MB total) at cycle 440, before the fixtures, `seasonSummaries` and `legacy` growth that F1's rollover
will add. The typical localStorage quota is 5 MB of UTF-16 characters. **The dynasty the product promises does
not fit in the storage the product uses.**

Bounded today (good): `social.posts` (180), `media.stories` (90), `eventLog` (400 via
`mutations.appendEvents`), `legacy.milestones` (120), `ledger.transactions` (4000), `transfers.rumours`.
Unbounded: `ledger.appliedKeys` (F18), `ledger.seasonTotals` (12/season, acceptable), `objectives.completed`,
`legacy.trophies` / `records` / `seasonSummaries` / `legends`, `rivalries[].incidents`, and `players` —
nothing ever removes a retired or permanently unemployed player. A 90-cycle probe showed free agents
accumulating monotonically (0 → 15) with no retirement path.

### F8 — Quota failure is shaped like data loss

```ts
// apps/game/src/platform/storage.ts:44–56
  async set(key: string, value: string): Promise<void> {
    const backing = this.backing;
    if (!backing) { this.memoryFallback.set(this.key(key), value); return; }
    try {
      backing.setItem(this.key(key), value);
    } catch (error) {
      this.usingFallback = true;                       // ← permanent, for the whole session
      this.memoryFallback.set(this.key(key), value);
      throw new Error(`Storage write failed, session is now in-memory only: ${String(error)}`);
    }
```

Once `usingFallback` flips, `get()` also reads from `memoryFallback` — which does not contain the real
on-disk save. Any subsequent load in that session reports NOT_FOUND. The player is told they have no save
while their save sits on disk.

And the throw goes nowhere:

```ts
// apps/game/src/state/gameStore.ts:167–176
  apply: (mutate) => {
    const current = get().state;
    if (!current) return;
    const next = mutate(current);
    set({ state: next });
    void persist(next);            // ← unhandled rejection; player is never told
  },
```

`apply()` is the path for every transfer, tactics change, facility upgrade and shortlist toggle. `advance()`
does catch; `apply()` does not.

### F9 — Concurrent saves race

`persist()` is `saveGame(...)`, which is read-previous → write-backup → write-save. Two `apply()` calls in
quick succession (two taps, or a screen that applies twice on mount) start two overlapping instances. With
`localStorage` the writes are synchronous enough to usually interleave benignly; with a genuinely async
adapter — Capacitor Preferences, or a future server store — the interleaving is a lost update: instance A
reads S0, instance B reads S0, B writes S2, A writes S1, and the disk now holds a state one edit behind the
one the UI is showing, with a backup identical to it.

### Proposed fix

- Serialise persistence behind a single-flight promise chain in the store, with a trailing-edge debounce
  (~500 ms) so a burst of `apply()` calls produces one write.
- Handle the rejection: surface a toast, and do not permanently latch `usingFallback` — retry the real
  backing on the next write and only degrade after N consecutive failures.
- Introduce a size budget. `saveGame` should refuse (or shed) above a configured ceiling and report it, and
  the cycle should archive per-season rollups rather than retaining raw tails. `RISKS.md` R13b already
  specifies the season roll-up; F1's rollover is where it belongs.
- Move to IndexedDB (or Capacitor Preferences on native), which is async, quota-generous and does not block
  the main thread. `StorageAdapter` is already async, so this is an adapter swap — which is the boundary
  working exactly as designed.
- Compress: the largest single contributor after `players` is `ledger.transactions` at 138 KB for a window
  the finance screen only ever renders 50 rows of. Persisting 400 rather than 1200 would save ~90 KB with no
  user-visible change.

**Effort:** 2 days for the store/adapter work; the size budget is part of F1.

---

## F10 — AI clubs have no economy *(High)*

`advanceCycle` calls `runFinancialCycle` exactly once, for `state.playerClubId`. Over a full 22-week season
the ledger contains:

```
kinds: { GRANT: 15, FACILITY_UPKEEP: 239, SPONSOR_REVENUE: 66, TICKET_REVENUE: 11,
         MERCH_REVENUE: 22, WAGES: 22, FACILITY_UPGRADE: 44, TRANSFER_OUT: 33, TRANSFER_IN: 33 }
```

22 `WAGES` transactions in 22 weeks — one club. 11 `TICKET_REVENUE` — one club's home fixtures. AI clubs
therefore never pay wages, never earn gate money, never sign a sponsor, and their cash only moves when they
buy or sell. Consequences:

- The "growing club faces bigger fees and bigger wages" brake the design depends on cannot engage for anyone
  but the player.
- `auditEconomy`'s wage reconciliation (`economy/audit.ts:105–120`) iterates clubs that *have* a `WAGES`
  transaction — so `WAGE_MISMATCH` structurally cannot fire for 11 of 12 clubs. The green check is measuring
  one club.
- For V2 private leagues, where several clubs are human, this is not an extension point — it is a missing
  system.

**Fix:** run `runFinancialCycle` for every club, with a cheap path for AI clubs (aggregate income/expenditure,
skip note generation). Cost is bounded: the player-club cycle is a small fraction of the 245 ms budget.
**Effort:** 1–2 days including rebalancing, because league-wide wage payments will change every AI club's
transfer behaviour.

---

## F11 — The event architecture on paper is not the one in the code *(High)*

`core/events.ts` describes `EventBus` as *"the spine of the product"* and `ARCHITECTURE.md` §4.1 draws it
fanning out to six consumers. **`EventBus` is never instantiated anywhere** — `grep -rn "new EventBus"` across
`packages`, `apps` and `tools` returns nothing. `on`, `onType`, `emit`, `emitAll`, `history`, `hydrate`,
`clear` and `maxJournal = 5000` are all dead.

What actually happens is better in one respect and worse in another. `advanceCycle` accumulates an
`allEvents: AnyDomainEvent[]` and passes it to each consumer explicitly (`generateStories(events, …)`,
`updateObjectiveProgress(state, events)`, `updateLegacy(state, events)`). That is *more* deterministic than a
listener registry and I would keep it. But:

- 27 of 51 declared event types are never emitted (enumerated in F4).
- Systems mutate state without announcing it, which is the specific thing §4 says must never happen:
  `worldTick` phase 5 drifts fan sentiment and expectation with no `FAN_SENTIMENT_CHANGED`;
  `worldTick` phase 1 nudges every player's `marketValue` with no event; `cycle.ts:141` mutates rivalry
  intensity with no `RIVALRY_INTENSIFIED`; `renewKeyContracts` renews contracts with no `CONTRACT_SIGNED`;
  `refreshMarket` revalues the whole player record with no event.
- `GameEventFactory.make`'s options type omits `matchId`, so no domain event produced by the orchestrator ever
  carries `DomainEvent.matchId` even though `makeEvent` supports it and match payloads all carry a matchId
  internally.

**Fix:** delete `EventBus` (or keep it only as the V2 server-side transport and say so in a comment), correct
`ARCHITECTURE.md` §4, add `matchId` to `GameEventFactory.make`'s opts, and emit the missing events (F4).
**Effort:** 1 day plus the F4 emissions.

---

## F12 — Two money formatters that disagree *(High)*

`packages/engine/src/economy/ledger.ts:368` — *"Formats money for the UI. Kept in the engine so every surface
agrees."* — and `apps/game/src/design/domain/numbers.tsx:89`, a second `formatMoney` with a different
signature (`compact: boolean` vs `{ compact?: boolean }`) and different rounding. The app imports the design
one everywhere. The engine one is used by `simulation/cascade.ts`, `simulation/emergent.ts` and
`simulation/aiClub.ts` — i.e. by the strings that appear *inside social posts and news stories*.

Demonstrated:

```
           850 engine: £850       app: £850
          2500 engine: £3K        app: £2.5K        <-- DIFFERS
         42000 engine: £42K       app: £42.0K       <-- DIFFERS
       1250000 engine: £1.3M      app: £1.25M       <-- DIFFERS
       5000000 engine: £5.0M      app: £5.00M       <-- DIFFERS
      12300000 engine: £12M       app: £12.3M       <-- DIFFERS
      48000000 engine: £48M       app: £48.0M       <-- DIFFERS
```

So a news story reading "£12M fee" sits directly above a transfer row reading "£12.3M" for the same deal.
The app also has `setCurrencySymbol()`; the engine hardcodes `£`, so a content pack that changes the currency
glyph would change half the surfaces.

There is a third formatter, `plainMoney` in `features/market/format.ts`, and a fourth path: 25 raw
`.toLocaleString('en-GB')` calls in the engine (F19).

**Fix:** one implementation. It should live in the engine (the engine writes money into persisted strings, so
it cannot delegate), take the currency symbol from a `setCurrencyFormat()` port mirroring the analytics-sink
pattern, and the design system should re-export it rather than reimplement it. Delete `plainMoney`.
**Effort:** half a day, plus a visual pass.

---

## F13 — Two standings computations *(High)*

There is one `computeStandings`, which is correct and good (see "What is well built"). But there are two
*call sites with different inputs*:

```ts
// packages/engine/src/game/cycle.ts:166–173  — every fixture in the save
  const standings = computeStandings(
    next.competitions[next.currentCompetitionId]?.clubIds ?? [],
    Object.values(next.fixtures),
    …
```

```ts
// packages/engine/src/game/selectors.ts:96–99  — this season, this competition only
  const fixtures = Object.values(s.fixtures).filter(
    (f) => f.competitionId === competition.id && f.seasonId === s.currentSeasonId,
  );
```

Today they agree, because there is only ever one season of fixtures (F1). The moment F1 is fixed and season 2
fixtures land in the same record, the league position that drives prize money, sponsor tiers and objectives
(`cycle.ts:174`) becomes an all-time table while every screen shows the current one.

**Fix:** make `advanceCycle` call the `standings(state)` selector. One line, and it should land *with* F1 or
before it. **Effort:** 15 minutes.

---

## F14 — O(n²) state copying in the cycle orchestrator *(High)*

`recoverSquads` and `tickContracts` reassign the whole `GameState` once per entity:

```ts
// packages/engine/src/game/cycle.ts:370–380
  for (const player of Object.values(state.players)) {
    …
    next = patchPlayer(next, player.id, { fitness: …, injury: … });   // {...s, players:{...s.players, …}}
  }
```

```ts
// packages/engine/src/game/cycle.ts:403–406
    next = {
      ...next,
      contracts: { ...next.contracts, [contract.id]: { …contract, weeksRemaining } },
    };
```

`renewKeyContracts` compounds it further by calling `squadWageBill(next, club.id)` inside the per-player loop,
making it O(clubs × squad²); `replenishSquads` calls `squadWageBill` inside a `while` loop and scans the whole
free-agent pool with `wageDemand()` per candidate on every signing.

`mutations.ts` already exports `setPlayers(state, players[])` and `setClubs(state, clubs[])` — the linear batch
helpers. `cycle.ts` does not use them.

### Evidence

Benchmark of the exact pattern, against the batch form:

```
n=  216  current(O(n^2))=  4.17ms   linear=0.179ms   ratio=  23x
n=  432  current(O(n^2))= 60.86ms   linear=0.213ms   ratio= 286x
n=  864  current(O(n^2))=240.81ms   linear=0.424ms   ratio= 568x
n= 1728  current(O(n^2))=825.86ms   linear=0.735ms   ratio=1124x
```

At today's 216 players it costs ~4 ms per pass and there are four such passes — tolerable, and I would rank
it Medium if the league were fixed at 12 clubs forever. It is High because every V2 direction the architecture
claims (private leagues, a second division, an academy that generates youth each season) multiplies *n*, and
F1's rollover will add players without removing any. At 432 players a single pass costs 61 ms.

**Fix:** rewrite the four loops to build one `Record` and call `setPlayers`/`setClubs`/a new `setContracts`
once. Hoist `squadWageBill` out of the inner loops into a `Map<ClubId, number>` computed once per cycle.
**Effort:** half a day. This is the cheapest large win in the repo.

---

## F15 — Negotiation and transfer history are owned by the React app *(High)*

`transfers.completed` is appended in exactly one place in the entire codebase:

```ts
// apps/game/src/features/market/engine.ts:354
        completed: [...next.transfers.completed, completed].slice(-60),
```

`worldTick` completes AI transfers (33 of them in a measured season, with real ledger movements) and never
records one. So `state.transfers.completed` is a log of the player's own deals only — measured length 0 after
90 headless cycles despite 33 completed transfers.

More broadly, `features/market/engine.ts` is a 410-line orchestrator living in the app: it owns the
negotiation lifecycle (`openNegotiation` → `submitOffer` → `completeTransfer`), constructs `IdFactory` and
`Rng` instances, restores and snapshots the `Ledger`, and writes `players`, `contracts`, `clubs`,
`idCounters` and `transfers` directly via the mutation primitives the barrel exports. It also defines its own
`isWindowOpen`, which ORs in `PRE_SEASON` — so the player can trade during a phase in which `worldTick` will
not let AI clubs trade.

### Consequences

- The headless harness cannot exercise negotiation at all; the transfer system's most complex code path has
  no audit coverage and never runs in `pnpm audit:all`.
- A V2 server cannot arbitrate a transfer, because the logic that sequences it is in a React module.
- The retention policy (`slice(-60)`) is a save-growth decision made in the UI layer.

**Fix:** move the orchestration into `packages/engine/src/game/` as `openTransfer` / `advanceTransfer` /
`settleTransfer`, returning `{ state, events }` like every other engine entry point; have the app call those.
Record AI transfers into `transfers.completed` from `worldTick`. Make `isWindowOpen` a single engine selector.
**Effort:** 2–3 days. High leverage: it also unblocks a transfer-market audit.

---

## F16 / F17 — The host installs almost none of its ports; the mobile shell does not exist *(High)*

`ARCHITECTURE.md` §10 lists six ports as BUILT. Three are never installed:

| Port | Default if uninstalled | Consequence |
|---|---|---|
| `setInvariantMode` | `'throw'` (`core/invariant.ts:23`) | Production throws on any invariant violation. The module's own header says *"in production they report rather than crash, because losing a save is worse than a wrong number"* — and the opposite is what ships. |
| `setForkCollisionMode` | `'report'` (`core/rng.ts:224`) | The module-level `collisions` array accumulates for the life of the process and is never drained in the app. A slow leak, currently zero-rate (see F28), but the wrong default for production. |
| `setHapticDriver` | no-op | Haptics never fire on device. |

`app/App.tsx:44–57` is the "exactly once per session" block; it installs analytics and capability detection
and nothing else.

F17 is larger. **`apps/game/package.json` has no `@capacitor/*` dependency of any kind.** `capacitor.config.ts`
does `import type { CapacitorConfig } from '@capacitor/cli'` — a package that is not installed — and the file
is excluded from typechecking (`apps/game/tsconfig.json` includes only `src/**/*` and `vite.config.ts`), so
CI never notices. `cap:sync` would fail; `ios/` and `android/` do not exist; there is no Capacitor Preferences
storage adapter, so the only save backing is `localStorage` with its 5 MB ceiling (F7). For a product
described as "a premium mobile football-management game about to enter hardening", the mobile half is a
config file and a comment.

**Fix:** install the Capacitor packages, add the three port installations to the boot block, write the
Preferences storage adapter (the interface already exists — this is genuinely a one-file change, which is the
architecture paying off), and add `capacitor.config.ts` to the app tsconfig `include`.
**Effort:** 2–3 days including a first device build.

---

## F18 — `pruneKeys` is never called *(Medium)*

```ts
// packages/engine/src/economy/ledger.ts:294–299
  /**
   * Drop idempotency keys older than the retention window. Called at each
   * season boundary so save size stays bounded across a long dynasty.
   */
  pruneKeys(currentCycle: number): number {
```

`grep -rn "pruneKeys"` returns only the definition. The comment describes a season boundary that does not
exist (F1). Measured: `appliedKeys` grows monotonically 6 → 279 over 90 cycles, ~3 keys/cycle, projecting to
~1,300 entries by cycle 440. That is small in absolute terms — a few tens of KB — so this is Medium, not High.
But it is a documented mitigation that was written and then not wired up, and it is the kind of thing that
looks handled in review.

**Fix:** call `ledger.pruneKeys(cycle)` from F1's rollover. **Effort:** 5 minutes, blocked on F1.

---

## F19 — `toLocaleString` is an Intl dependency inside the "pure" engine *(Medium)*

The ESLint purity boundary (`eslint.config.js:76–110`) restricts imports, globals (`window`, `document`,
`localStorage`, `navigator`, `fetch`) and two syntax patterns (`Math.random`, `Date.now`/`new Date()`). It does
not — and with `no-restricted-syntax` on a member call it practically cannot — catch
`Number.prototype.toLocaleString`, which the engine uses in 25 places:

```ts
// packages/engine/src/transfers/negotiation.ts:243
      `They tabled ${bid.toLocaleString('en-GB')} and got it done while you were still talking.`);
```

That string is written into `Negotiation.history[].text`, which is persisted in `GameState`. `toLocaleString`
output depends on the runtime's ICU data: a Node build with small-icu, a browser, and a JavaScriptCore
WebView can produce different grouping. So the same seed on two hosts can produce different save bytes —
which contradicts `core/ids.ts`'s "byte-identical saves" claim (already partially caveated in
`ARCHITECTURE.md` §6.2) and, more importantly, breaks the F-for-V2 story: a server that recomputes a client's
state and compares hashes would see spurious mismatches.

Practically this is Medium, not High: the affected strings are transcript prose, not simulation inputs, and no
outcome branches on them. But it is a genuine hole in a boundary the product describes as airtight, and it is
a second money-formatting path (F12).

**Fix:** ban `toLocaleString` in the engine with a `no-restricted-properties`/`no-restricted-syntax`
`MemberExpression[property.name='toLocaleString']` rule, and route every one of those 25 sites through the
single `formatMoney` from F12, which should do its own grouping with a plain regex.
**Effort:** half a day, mostly mechanical.

---

## F20 — The content registry is a hidden global, three times over *(Medium)*

Three independent module-level singletons cache a registry loaded with `BASE_PACK` and nothing else:

- `packages/engine/src/game/cycle.ts:588` (`cachedRegistry`)
- `apps/game/src/features/market/engine.ts:50` (`cachedRegistry`)
- `tools/sim/src/harness.ts:20` (`sharedRegistry`)

None consults `state.settings.enabledPackIds` or `state.settings.region`. `ContentRegistry.visibleFor(region,
now)` and `licensing/identity.ts:isRenderable(identity, region, now)` — the two functions the entire licensing
architecture rests on — are called from nowhere in the engine or the app except a display list in
`features/progression/engine.ts`. `LicensedEntityBinding`'s fictional-fallback path has no execution route.

Also: mutable module-level state inside a package advertised as pure. It survives across saves, so a
hypothetical second save with a different pack set would silently reuse the first save's content, and it makes
any test that loads a pack order-dependent.

**Fix:** the registry belongs on the save. Build it in `createNewGame` from `enabledPackIds`, carry it as an
explicit parameter (`advanceCycle` already accepts `opts.registry` — the singleton is only the *default*), and
delete the three caches. Wire `visibleFor(state.settings.region, now)` into that construction so the licensing
gate is on a live code path before the first licensed pack exists rather than after.
**Effort:** 1–2 days.

---

## F21 — The negotiation RNG stops advancing after 24 transcript entries *(Medium)*

```ts
// apps/game/src/features/market/engine.ts:292–295
  const withOurLine: Negotiation = {
    ...negotiation,
    history: [...negotiation.history, { … }].slice(-24),      // capped at 24
  };
  const rng = new Rng(`${s.seed}:negotiation:${negId}:${negotiation.history.length}`);
```

`transfers/negotiation.ts:104` applies the same `.slice(-24)` to the stored result. So once a transcript
reaches 24 entries — roughly a dozen rounds of haggling, which a stubborn negotiation reaches easily —
`history.length` is pinned at 24 and every subsequent `submitOffer` seeds the identical stream. The agent's
counter, the rival-hijack roll and the patience decay all become the same draw, repeatedly. The same pattern
appears at `transfers/negotiation.ts:226` (`rng.fork(...:${neg.history.length})`).

**Fix:** seed from a monotonic round counter stored on the `Negotiation` (`neg.rounds`), not from a capped
array's length. **Effort:** 1 hour. Requires a field on `Negotiation` and therefore a save migration — which
would be the first real exercise of the migration machinery (F25), and that is a good thing.

---

## F22 — Tautological and hand-maintained assertions *(Medium)*

The test suite is large (531 tests) and mostly behavioural. Three specific weaknesses:

**Tautologies in the invariant audit.** `tools/sim/src/invariantAudit.ts:110–113`:

```ts
        if (row.points !== row.won * 3 + row.drawn) problems.push(`${row.clubId} points do not follow…`);
        if (row.won + row.drawn + row.lost !== row.played) problems.push(`${row.clubId} result counts…`);
```

`computeStandings` *computes* `points` as `won * 3 + drawn` and increments `played` alongside `won`/`drawn`/
`lost`. Neither check can fail. The sibling check in the same block —
`scored !== conceded` across the league — is genuinely load-bearing and does catch real corruption; keep that
one, replace these two with a comparison against `Club.seasonRecord` (an independently maintained tally), which
would be a real reconciliation.

**Hand-maintained coverage lists.** `simulation/contentIntegration.test.ts:62–70` hardcodes the `EMITTED`
trigger array the coverage test checks against. It cannot detect a trigger the code stopped emitting, and it
did not detect the 27 event types nothing emits (F4/F11).

**Structurally-unreachable audit checks.** `auditEconomy`'s `DOUBLE_CLAIMED` scan over `ledger.all()` counts
duplicate idempotency keys — but `Ledger.post` already rejects a duplicate before it can be recorded, so this
branch can only fire if the ledger is corrupted by direct field access, which nothing does. Its wage
reconciliation only visits clubs with a `WAGES` transaction, i.e. one club (F10).

**Missing coverage on the highest-risk paths.** No test crosses a season boundary (nothing to cross). No test
runs `saveGame`/`loadGame` on a real `createNewGame` state — `test/save.test.ts` uses an 8-player synthetic
fixture, so the 0.9 MB reality is untested. No test exercises `migrate` with an actual registered migration.
No test asserts determinism across a save/load boundary (I verified this by hand and it *passes* — it deserves
to be a test, because it is the property most likely to silently break).

**Effort:** 1–2 days to fix the three weak assertions and add the four missing tests.

---

## F23 / F24 / F25 / F26 — Build, CI and documentation gaps *(Medium)*

**F23.** `packages/engine/package.json`: `"build": "tsc -p tsconfig.json --emitDeclarationOnly false --noEmit"`
— `--noEmit` wins, so nothing is emitted, and `"main": "./src/index.ts"` points at TypeScript source. The app
works because Vite aliases `@cf/engine` to the source. Any consumer that is not a bundler — the Node server
the V2 story depends on, a Cloudflare Worker, a second app — cannot import this package. `ARCHITECTURE.md`
§1.1 is honest about this; it is listed here because it is on the critical path for the PvP claim.

**F24.** Root `"test": "pnpm --filter @cf/engine test"`, and CI runs `pnpm test`. `apps/game` defines
`"test": "vitest run"` and has `src/design/seed.test.ts`, which has therefore never run in CI. Separately,
`apps/game/tsconfig.json` includes only `src/**/*` and `vite.config.ts`, so `capacitor.config.ts` and
`vitest.config.ts` are not typechecked — which is why F17's broken import is invisible.
**Fix:** root `test` → `pnpm -r test`; add the two config files to the tsconfig include.

**F25.** `MIGRATIONS` is `{}`. The comment `// 0 -> 1: the first shipped schema. Nothing to transform.` is a
comment, not an entry, so a hypothetical v0 save would fail `MIGRATION_FAILED` rather than pass through. That
is academic today, but the whole forward-migration mechanism — the thing standing between a live player base
and a lost dynasty — has never executed once. F21's fix is a natural first customer.

**F26.** `docs/ARCHITECTURE.md` §12 states: `pnpm typecheck` **fails**; `pnpm test` has **2 failing** tests;
`pnpm lint` **does nothing** and no ESLint config exists; the `tools/sim` audit entry points **do not exist**;
`.github/workflows/` is **empty**. All five are false as of this tree — everything is present and green. It
also lists scratch files (`diag.tmp.ts`, `tuning.tmp.ts`, `tsconfig.check.json`, an empty `src/fixtures/`) that
no longer exist. Stale docs are a real finding on a project where `INTEGRATION_CONTRACT.md > the code > this
document` is the declared authority order, because a reader following the doc will make wrong decisions about
what is safe to change.

---

## F27 / F28 / F29 / F30 — Low-severity items *(Low)*

**F27 — `Ledger.accumulate` scans linearly per transaction.**

```ts
// packages/engine/src/economy/ledger.ts:272, 286
      let row = this.seasonTotals.find((r) => r.season === tx.season && r.clubId === clubId);
      …
      this.seasonTotals[this.seasonTotals.indexOf(row)] = updated;
```

Two O(n) scans plus a `byKind` object spread, twice per transaction. `seasonTotals` reaches
seasons × clubs = 240 rows at season 20, so ~960 comparisons per posted transaction. Measurable but not
material at current volumes. Fix: key by `Map<\`${season}:${clubId}\`, …>`. **Effort:** 30 minutes.

**F28 — 32-bit seed space.** `hashString` returns a uint32, so `new Rng(label)` has 2³² distinct states and
`fork` derives every sub-stream through it. Birthday maths over the ~104,720 distinct stream labels a
20-season save would create predicts ~1.28 collisions per playthrough. I generated that exact label set and
measured **0 collisions**; the labels are highly structured and FNV-1a spreads them well. Even a collision
would mean two of a hundred thousand streams produce identical draws — two players developing identically in
different cycles. **This is theoretically ugly and practically harmless. Do not spend time on it.** The
`ARCHITECTURE.md` §6.2 and `core/rng.ts:203–211` comments already say the right thing: revisit only if the
engine ever arbitrates matches server-side across many concurrent games. The `setForkCollisionMode` diagnostic
and the invariant audit's stream-hygiene check are the correct mitigation and they pass.

**F29 — `fork()` label ambiguity.** `fork(label)` returns `new Rng(\`${seed}:${label}\`)`, so
`rng.fork('a').fork('b')` and `rng.fork('a:b')` are the same stream. Several labels in the codebase already
contain colons (`match:${matchId}`, `world:${cycle}`, `ai:${clubId}`). No current pair collides, but the
scheme has no separator discipline. Fix: escape colons in `label`, or use a length-prefixed join.
**Effort:** 30 minutes, but it changes every derived stream and therefore every tuned balance figure — do it
before launch or never.

**F30 — Assorted:**
- `economy/ledger.ts:374`: `.toFixed(abs >= 100_000 ? 0 : 0)` — both branches are `0`. Dead ternary,
  presumably a lost intent.
- `core/events.ts:171`: `history()` returns the live `journal` array, not a copy — a caller can mutate the
  journal. Moot while `EventBus` is dead (F11).
- `contracts/negotiation.ts` and `contracts/wages.ts` import from `../game`, `../transfers` and `../economy`.
  A low-level "contracts" module depending on the aggregate `GameState` is a layering inversion. Type-only in
  practice (verified: the value-import graph has **zero cycles**), so this is a smell rather than a defect.
- `packages/engine/src/index.ts:100` re-exports `./game/mutations`, handing the UI `setPlayer`, `patchClub`,
  `transferPlayer` and friends. This is the hole through which F15's orchestration escaped into React. Fix:
  drop `mutations` from the public barrel and expose intent-shaped operations instead.
- Token-fill bug in the `RECORD_BROKEN` content hook: *"A club record. Cinderwick Town writes his name into
  the history of Cinderwick Town."* — a club name is being supplied for a `{player}` token. 21 occurrences in
  one measured season.
- `Club.reputation` accumulates as an unrounded float (`28.688690215932088` observed), which bloats the save
  slightly and makes equality comparisons fragile.
- `advanceCycle` matches the player's fixture by string-built id (`\`match_${playerFixture.id}\``,
  `cycle.ts:334`), duplicating the format literal from `matchSetup.ts:100`. If either changes, the player's
  result silently becomes `null`. Fix: put the id constructor in one exported function.
- When the player's fixture is auto-simulated rather than played live, `buildMatchSetup` passes
  `isPlayerControlled: false` for both sides, so `state.inventory.ruleCards` is not offered. A player who
  simulates loses their rule cards for that match.

---

## Scalability to V2: stress-testing the claim

`ARCHITECTURE.md` §11 claims PvP, private leagues and online clubs are extensions rather than rewrites.
Assessed mechanism by mechanism:

| Claim | Verdict | Why |
|---|---|---|
| "Both clients agree on a result" | **Holds.** | `simulateMatch(setup)` is pure and I verified byte-identical results twice, and across a save/load boundary. |
| "The server recomputes and compares" | **Blocked, mechanically.** | The engine emits no build artifact (F23) and `main` is a `.ts` file. Also F19: `toLocaleString` output is ICU-dependent, so a server/client byte comparison of *state* (as opposed to `MatchResult`) can produce spurious mismatches. |
| "`MatchResult` is plain serialisable data" | **Holds.** | Verified. |
| "Multiple clubs in one competition, some human-controlled" | **Holds structurally.** | `Competition.clubIds` is a list, `MatchTeam.isPlayerControlled` is per-side. |
| "Standings cannot drift between clients" | **Holds for the function, fails at the call site.** | See F13 — two call sites with different inputs. |
| "Shared clock" | **Not a small change.** | Correctly identified as missing in §11.2, and F1 makes it worse: there is no season boundary to synchronise *on*. |
| "State is immutable at the boundary — the shape a command-sourced server wants" | **Holds for the engine, fails for the app.** | Verified pure for 9 entry points. But F15: the transfer command sequence lives in React, so the server has no engine function to call. |
| "Auditable money" | **Fails.** | F2: `transferBudget` is a second store outside the audit log. F10: AI clubs have no financial cycle, so a private league of humans has no economy for 11 of 12 clubs. |
| "Permissions are additive on `isPlayerClub` / `isPlayerControlled`" | **Plausible.** | Nothing found that blocks it. |
| "Bigger league costs proportionally more, not quadratically" | **True of `worldTick`, false of `advanceCycle`.** | `worldTick`'s own header claims linearity and delivers it. `game/cycle.ts` is O(n²) — F14. |

**Net:** the *simulation* is genuinely V2-ready and that is the hard part. The *orchestration and hosting*
layer is not, and the four things standing in the way — a build artifact, moving transfer orchestration into
the engine, a single money authority, and a league-owned clock/season — are days of work each, not a rewrite.
The claim survives, downgraded from "extensions" to "extensions plus about three weeks of unglamorous work".

---

## What is genuinely well built — do not touch this

I want the next engineer to know precisely what is load-bearing and correct, because several of the fixes
above run adjacent to it.

**Determinism is real, including across persistence.** I ran ten cycles straight, then ran five cycles →
`saveGame` → `loadGame` → five more cycles, and compared `JSON.stringify` of the final states:
identical, 811,612 characters both ways. The round trip itself is byte-identical. Two straight runs from the
same seed are identical. This is the property everything else depends on and it holds. **Make it a test.**

**Immutability at the boundary is real.** I stringified the input, called the function, stringified again, for
`advanceCycle`, `simulateMatch`, `tickWorld`, `refreshMarket`, `updateLegacy`, `updateObjectiveProgress`,
`generateStories`, `generatePosts` and `runFinancialCycle`. Every one is pure with respect to its arguments,
and the shared `ContentRegistry` is not mutated either. I found no function anywhere in the engine that
mutates a caller's object.

**`simulation/worldTick.ts` is the best file in the repo.** Sorted-id iteration everywhere
(`sortedIds(record)`), a per-entity RNG fork rather than a per-label one, an explicit comment recording the
bug that pattern fixed ("forking 'ai' repeatedly handed every club in the league the identical stream"), and a
second comment recording a stale-copy bug in the transfer loop. This is what a file looks like when someone
has actually thought about determinism rather than written it in a README.

**The Ledger's design.** Direction expressed structurally by `from`/`to` rather than by sign; `Result`-typed
rejection instead of exceptions; idempotency keys with a permanent tier for real-money purchases; mandatory
memos; per-season rollups that survive transaction pruning. The design is right. F2 is a violation *of* it, not
a flaw *in* it.

**`computeStandings` is derived-only, single-implementation, and correct.** Deterministic final tiebreak on
club id. Keep it that way.

**`game/matchSetup.ts` as the single seam** between persistent world and simulation. The simulator never
reaches into `GameState`, which is exactly why `simulateMatch` is testable, auditable and server-ready.

**The purity boundary and CI.** `eslint.config.js` is thoughtful — it scopes globals to `{}` for the engine so
`window` is an undefined-global error, and it restricts `Math.random`/`Date.now`/`new Date()` by AST selector.
CI runs lint, typecheck, test, build and the audits on every push. F19 is a hole in it, but the boundary is
real and it is doing work.

**`apps/game/src/state/matchStore.ts`.** The store defines a structural `SimulatorHandle` so it never imports
the simulator's implementation, and holds the mutable simulator instance *outside* reactive state. That is a
genuinely good call.

**Fork-collision diagnostics and the stream-hygiene audit.** `setForkCollisionMode` + `drainForkCollisions` +
the invariant audit's check is the right shape of mitigation for a subtle, silent failure. It passes:
zero collisions across a full season.

**Social provenance is 100%.** Measured across a full season: 396 posts, every single one carrying a
`relatedEventId` that traces to an event the engine actually emitted. The contract's hardest content rule is
being kept. (The audit that checks it skips posts with no `relatedEventId`; there are none, so the skip is
currently harmless — but tighten it to `expect(post.relatedEventId).toBeDefined()`.)

**Branded ids, `noUncheckedIndexedAccess`, `verbatimModuleSyntax`.** The type discipline is above average for
a codebase this size, and `pnpm typecheck` is clean across three packages.

---

## Verdict

**Yes — this architecture is sound enough to build the next two years of product on, and it would be a mistake
to redesign it.**

The three things that matter most in a simulation game of this kind are determinism, a clean pure/impure
boundary, and immutable state at the seams. I tested all three empirically rather than taking the docs' word
for it, and all three hold. The event-shaped data flow, the ledger design, the content-as-data schema, the
tactic-vector single-channel model and the derived-standings rule are all decisions I would have made and
would not revisit. The RNG sub-stream design in particular is exactly right, and `worldTick` demonstrates that
at least one author internalised it rather than just importing it.

What the audit found is not architectural rot. It is **unfinished integration**, and it is unfinished in a
very specific and diagnosable way: six workstreams built against a written contract, each delivered its half
correctly, and the orchestrator that was supposed to join them — `packages/engine/src/game/cycle.ts`, 602
lines, owned by "the lead" — connects roughly two thirds of what exists. Rivalries were built and never
seeded. `EventBus` was built and never instantiated. `pruneKeys` was written and never called. `visibleFor`
was written and never called. `seedRivalries`, `summariseSeason`, half the event vocabulary, 85% of the
authored content, the whole negotiation lifecycle — all present, all tested in isolation, none reachable from
a real game. The season rollover was simply never written at all, and because the audits were built on a
harness that cannot cross a season boundary, nothing noticed.

That is a good problem to have. It is days of work per item, not months, and almost none of it requires
touching a design decision. But it must be done before hardening, not during it, because right now the
project's own quality gates — 531 green tests, three green audits, clean lint and typecheck — are reporting on
a game that ends after twenty-two weeks. **The most dangerous thing in this repository is not any single
defect; it is that everything is green.**

Suggested order: F13 (15 minutes, prevents F1 from introducing a subtle bug) → F2c, the budget-mismatch audit
check (30 minutes, makes F2 provable) → **F1, the season rollover** (unblocks F5, F18, and makes F4 and F7
measurable) → F3 and F14 (a day between them, both cheap and high-leverage) → F15 and F10 → F6, F7–F9 →
F16/F17. F19, F20, F22 and F26 can run in parallel with any of it.
