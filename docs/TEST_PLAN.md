# Creator Football — Test Plan

**Current state, measured:**

| | |
|---|---|
| Test files | **20** |
| Tests | **262 — 260 passing, 2 failing** |
| `pnpm typecheck` | **Red.** TS6059: `packages/engine/test/save.test.ts` is matched by the `test/**/*` include but sits outside `rootDir: "src"` |
| `pnpm lint` | **Does nothing.** No ESLint config anywhere; no package defines a `lint` script |
| `pnpm audit:*` | **Red.** `tools/sim` is a package with a `report.ts`, but none of the four entry points its scripts invoke exist |
| CI | **None.** `.github/workflows/` is empty |

### The two failing tests

| Test | Failure | Why it matters |
|---|---|---|
| `home advantage and support > keeps the audience modifier under a six-point swing at full support` | Measured **9.6pp** against a **6pp** cap | The audience modifier occupies the structural slot home advantage occupies in a conventional sim, and the reference data caps it at roughly the real-world home effect specifically so it stays a nudge rather than a determinant. At 9.6pp, club reach is influencing match outcomes more than the strongest effect in real top-flight football — which is also the closest this design comes to a pay-to-win surface |
| `special rule windows > runs exactly one guaranteed window per half, anchored to its closing minutes` | Passes **in isolation**, fails in a **full run** (`expected [] to have a length of 2`) | This is an isolation or ordering leak, not a logic bug — and it is the most concerning failure in the suite, because the codebase's central architectural claim is that the same inputs always produce the same outputs. Something is carrying state between tests. Find it before writing more tests on top of it |

Everything else below is written as the target, with each item's status marked. Unit
coverage now exists for most engine modules; what is missing is the **static enforcement**
layer (§2.1), the **content validation** suite (§3) and the entire **audit harness** (§4-§6).

---

## 1. Layers

| Layer | Runner | Scope | Runs on |
|---|---|---|---|
| **Unit** | Vitest (node) | One module, pure functions | Every commit |
| **Static** | `tsc --noEmit` + ESLint | Types, import purity, forbidden globals | Every commit |
| **Content validation** | Vitest | `validatePack()` over every shipped pack | Every commit |
| **Simulation audit** | `@cf/sim` (tsx) | 1,000 matches, distribution assertions | Nightly + pre-merge on engine changes |
| **Economy stress** | `@cf/sim` | 100 seasons, inflation and invariants | Nightly |
| **Invariant sweep** | `@cf/sim` | State legality at every cycle boundary | Nightly |
| **Integration** | Vitest | Multi-module flows through the orchestrator | Every commit |
| **Manual UX** | Human | Feel, pacing, legibility, device performance | Per phase gate |

---

## 2. Unit tests

### 2.1 Static rules that must be automated first

These are cheap, and they protect the two properties the whole architecture rests on.

| Rule | Enforcement | Status |
|---|---|---|
| **Tests do not leak state between files** | A `vitest` run with `--sequence.shuffle` must pass, repeatedly | **TO BUILD — one test already fails only in a full run** |
| `packages/engine` imports no React, DOM, Capacitor or Node built-in | ESLint `no-restricted-imports` scoped to `packages/engine/**` | **TO BUILD — the highest-value missing check in the repo** |
| No `Math.random()` in `packages/engine` | ESLint `no-restricted-globals` / `no-restricted-properties` | **TO BUILD** |
| No `Date.now()` in engine simulation modules | Same, with an allowlist for none — timestamps are parameters | **TO BUILD** |
| No `window`, `document`, `localStorage`, `navigator`, `fetch` in the engine | Same | **TO BUILD** |
| Strict TypeScript passes with zero errors | `pnpm typecheck` | **Currently red** — fix the `rootDir` conflict before adding CI, or CI lands permanently broken |
| No content string matches the legal denylist | Custom Vitest rule over pack data | **TO BUILD** (`LICENSING_ARCHITECTURE.md` §6.4) |

Without the first four, the purity rule described throughout `ARCHITECTURE.md` is a
convention that a single careless import breaks silently.

### 2.2 Per-module unit coverage

| Module | Must prove | Status |
|---|---|---|
| `core/rng` | Same seed → identical sequence; `fork(label)` streams are independent; `restore(serialize())` round-trips; `weighted` respects weights over 10⁵ draws; `shuffle` never mutates input; `normalClamped` respects bounds; `pick` on empty throws | TO BUILD |
| `core/math` | `clamp`/`clamp01`/`lerp`/`invLerp` edge cases; `mean([])` is 0 not NaN; `weightedMean` with zero total weight; `percentile` boundaries; `decayToward`/`approach` converge and never overshoot | TO BUILD |
| `core/events` | `emit` fans out to typed and untyped listeners; unsubscribe works; journal caps at `maxJournal`; `hydrate` replaces wholesale; `makeEvent` defaults `importance` to 2 and omits `matchId` when absent | TO BUILD |
| `core/ids` | Counters are monotonic per kind; `serialize`/`restore` round-trips; `slugify` handles accents, punctuation, length cap | TO BUILD |
| `core/invariant` | `throw` mode throws; `collect` mode accumulates; `drainViolations` empties; `assertNever` throws | TO BUILD |
| `players/attributes` | `overallFor` is position-sensitive (identical attributes yield different overalls per position); output clamped 1-99; `keyAttributes` returns the highest `value × weight` products | TO BUILD |
| `players/positions` | `familiarity` is 1 for identity, 0.45 default for unlisted, symmetric where intended | TO BUILD |
| `players/traits` | `traitModifier` sums across ids; conditional traits contribute 0 without their condition and their value with it; unknown ids are ignored; `traitMultiplier` floors at 0.2 | TO BUILD |
| `matches/simulator` (injury model) | One denominator is used consistently — either player-hours **or** team-pitch-minutes — never both. Silently mixing them is the most common calibration bug in this class of model, and the reference data's per-team injury figure is derived for 6 outfield players, not 7 (`PRODUCT_REQUIREMENTS.md` D8) | TO BUILD |
| `tactics/vector` | **Every setting moves ≥2 vector fields in opposing directions** (the design rule, machine-checked); all outputs are in range; higher `managerTactical` scales magnitude without flipping any sign; low `squadQuality` raises `fatigueRate` and lowers `pressRecovery`; `applyVectorModifiers` re-clamps | TO BUILD |
| `tactics/formations` | Every formation's slot 0 is `GK`; `formationsFor(7)` returns only 7-slot shapes; `formationById` falls back rather than throwing; `autoLineup` fills every slot when enough players exist, never puts an outfielder in goal when a keeper is available, benches a spare keeper first, and picks a plausible captain/set-piece/penalty taker | TO BUILD |
| `league/fixtures` | Complete double round robin for 12; odd counts get a bye without self-fixtures; deterministic per seed; different seeds differ; `verifyFixtures` returns `[]`; home/away balanced within 1; `phaseForWeek` covers every phase proportionally | **BUILT** (5 cases) — extend with `phaseForWeek` and playoff bracket |
| `league/standings` | Points and GD arithmetic; `H2H_FIRST` vs `GD_FIRST` tiebreaks; zones assigned correctly at boundaries; `form` capped at 5, newest last; ordering is stable; `positionContext` at first, last and middle | TO BUILD |
| `economy/ledger` | *(economy `audit.test.ts` and `cycle.test.ts` exist; the ledger itself has no direct test)* Balances move correctly; `INSUFFICIENT_FUNDS` on overdraft; `allowOverdraft` bypasses; `DUPLICATE` on a repeated `idempotencyKey`; `INVALID_AMOUNT` on negative/NaN/Infinity; `world` accounts are untracked; `summaryFor` windows correctly; `snapshot`/`restore` preserves balances, ids **and** applied keys; `verify()` catches every problem class; `formatMoney` at K/M/B boundaries and negatives | TO BUILD |
| `persistence/save` | *(`test/save.test.ts` exists — and is the file breaking `typecheck`)* Round-trip; checksum mismatch → `CORRUPT`; future version → `UNSUPPORTED_VERSION`; missing → `NOT_FOUND`; **`loadGame` falls back to backup and reports `recoveredFromBackup: true`**; `saveGame` refuses to overwrite a good save with an invalid state; `validateState` catches a player in two squads, a squad referencing an unknown player, and a missing current season | TO BUILD |
| `licensing/identity` | `isRenderable` true for all fictional kinds; false for licensed with no rights, non-`ACTIVE` status, past expiry, out-of-region; true for empty `regions` (worldwide); boundary at `expiresAt === now` (expired) | TO BUILD |
| `simulation/templating` | `renderTemplate` returns `null` on any missing token and collapses whitespace; `matchesConditions` handles every operator (`gte`, `lte`, `gt`, `lt`, `not`, `in`) and **returns false for an unknown fact key**; `pickTemplate` de-weights recent ids by `REPEAT_PENALTY` and returns `null` on an empty pool; `sentimentBand` boundaries | TO BUILD |
| `content/loader` | **Module exists; no test file.** Valid pack loads clean; every §4.1 validation error is caught; duplicate id without `overrides` is an error; declared override replaces; `unload` restores; `visibleFor` filters by region and time | Module built, test missing |
| `transfers/valuation` | *(`valuation.test.ts` exists)* Monotonic in overall; age curve peaks 24-28 and floors at `AGE_MULT_FLOOR`; potential premium capped and irrelevant past 30; contract expiry cliff; injury discount capped; every output within `[MIN_VALUE, MAX_VALUE]` and finite | Partially covered |
| `transfers/negotiation` | *(`negotiation.test.ts` exists)* Patience burns per round and per lowball; insult doubles the burn; hijack probability respects its cap; both failure modes reachable; a completed transfer posts exactly two ledger entries (out and in) plus the agent fee | Partially covered |

---

## 3. Content validation

Runs as a Vitest suite over `BASE_PACK` and every shipped pack.

| Check | Severity |
|---|---|
| `validatePack()` returns zero `error` issues | Fail |
| `validatePack()` returns zero `warning` issues **for the base pack** | Fail |
| Volume gates: 12 clubs, 28 creators, 10 selectable managers, 8 archetypes, 20 sponsors, 11 facilities × 5 levels, 40+ objectives, 24 offers, 200+ commentary lines, 120+ social templates, 60+ media templates, 220+ first names, 220+ surnames, 60+ cities, 80+ handles, 25 nationalities | Fail |
| Every creator tier and every content tone is represented | Fail |
| Club strength spread is wide enough for a favourite, a mid pack and strugglers | Fail |
| Every club has 1-2 declared rivals that resolve | Fail |
| Club primary colours are perceptually separable pairwise | Fail |
| Every commentary line's `eventType` is a real `MatchEventType`, with ≥3 lines for common types | Fail |
| Every template token is published for its trigger; every condition key is in the `HookFacts` vocabulary | Fail |
| Legal denylist: zero hits over every string field, asset filename and analytics name | **Fail — build blocker** |
| Nationalities do not match any real country or demonym | Fail |
| Monetisation: no offer grants `CASH`, no offer grants `RULE_CARD`, no offer contents are randomised | Fail |
| Every licensed entity has complete `RightsMetadata` and a `LicensedEntityBinding` | Fail |

### 3.1 Generator distribution tests

| Check |
|---|
| `generatePlayer` with a target overall lands within **±3** over 10,000 samples |
| Potential respects age: under-21s have headroom; 30+ have effectively none |
| Traits obey their `positions` restriction and their `rarity` frequency, within tolerance, over 10,000 samples |
| `generateSquad` produces a legal shape: ≥2 GK, plausible coverage of every formation slot |
| Name collisions across 10,000 generated players stay under a threshold (the point of a 220+/220+ bank) |
| `clubFromTemplate` is deterministic for a given `(rng seed, template, id)` |
| Nationality distribution matches the declared weights |

---

## 4. Simulation audit — `pnpm audit:sim`

**Status: TO BUILD.** `tools/sim` is empty; the script exists in `package.json` and fails.

### 4.1 The 1,000-match audit

Simulate 1,000 matches with the default 30-minute short format across varied squad
qualities, tactics and importances, from a fixed seed. **`docs/SIMULATION_REFERENCE_DATA.md`
is authoritative** for every band below.

| Metric | Target | Pass band |
|---|---|---|
| Goals per match (both teams) | 7.0 | **6.0 - 9.0** |
| Goals per minute | 0.233 | 0.20 - 0.30 |
| Shots per match (both teams) | ~30 | 24 - 40 |
| Shot conversion | ~23% | 18% - 28% |
| Ball in play | ~90% of clock | 86% - 92% |
| Possession, mean per team | 50% | split within 35% - 65% |
| Yellow cards per match | ~1.0 | 0.5 - 2.0 |
| Red cards per match (ordinary discipline) | ~0.03 | 0.01 - 0.06 |
| Red cards from rule-window dismissals | — | **counted as a separate channel** |
| Injuries per team per match | 0.10 | 0.08 - 0.14 |
| Mean xG per team | — | within 15% of mean actual goals |
| Player ratings | — | mean 6.0-7.0, full 1.0-10.0 range used, MOTM correlates with contribution not scoreline |

### 4.1a Two-regime validation — mandatory

The blended figure can be inside its band while the model is badly wrong. **Validate the
regimes separately, then the blend.**

| Regime | Share of clock | Goal rate | Pass |
|---|---|---|---|
| Normal play | ~24 of 30 min | 0.16 - 0.18 /min | Assert independently |
| Rule window | ~6 of 30 min (closing minutes of each half) | **2-4× the normal rate** | Assert independently |
| Blended | 30 min | 0.20 - 0.30 /min | Assert only after the two above pass |

### 4.1b Distribution assertions

| Assertion |
|---|
| Goal counts are **overdispersed** relative to Poisson: sample variance > sample mean, per team |
| The dispersion parameter is an **exposed tunable**, not a buried constant |
| The **full scoreline matrix** is asserted, not just the mean — two engines with identical goals-per-game can have entirely different draw rates and tails |
| Draw rate is **materially below** the 11-a-side reference of 24.5% |
| Score correlation between the two sides is non-zero (comeback dynamics exist) |
| Rule-window goals are generated by a **separate additive process**, provable by disabling rules and re-measuring |
| **No Dixon-Coles low-score correction** is applied — it exists to fix 0-0/1-1 frequency at λ≈1.4 and does not earn its complexity at λ≈3.5 |
| A tie-break path exists and is exercised |

### 4.2 Competitive-integrity assertions

| Assertion | Pass |
|---|---|
| Heavy-mismatch favourite wins a single fixture | **75% - 85%** |
| The same favourite never wins | **> 90%** — an upset must always be possible |
| Upset frequency in the short format vs an 11-a-side control | **Higher**, not lower |
| Champion's win rate over a simulated season | **60% - 70%** |
| Bottom side's win rate over a simulated season | **5% - 15%** |
| Home advantage term | **0 by default** — a single neutral venue |
| Audience/support modifier magnitude | ≤ ~6 percentage points of win probability |
| Momentum's direct contribution to goal probability | ≤ the documented small amount. Explicitly assert **no rubber-banding** |
| Higher-quality side out-xG's the weaker | > 70% of matches |

### 4.2a Cross-check against 11-a-side

For any full-size mode, and as a sanity control on the model itself:

| Metric | Target |
|---|---|
| Goals per game | 2.93 |
| Shots per game | 22.5 |
| Conversion | 13.0% |
| Yellows / reds per game | 4.08 / 0.137 |
| Ball in play | ~55-57 min |
| Injuries per team per match | 0.45 |
| Home / draw / away split (home advantage enabled) | 40.8 / 24.5 / 34.7 |

### 4.3 Determinism

| Assertion |
|---|
| `simulateMatch(setup)` twice → deep-equal `MatchResult`, including every event id and the momentum timeline |
| `MatchSimulator` stepped to completion equals `simulateMatch` with the same setup and no decisions |
| Adding a die roll in a *different* sub-stream (market, world) does not change any match result |
| `generateFixtures` with the same seed → identical schedule (**BUILT**) |
| A full cycle run twice from the same save + fixed clock produces identical `GameState` **except** wall-clock timestamp fields (`ARCHITECTURE.md` §6.2) |

### 4.4 Impossible-state assertions

| Assertion |
|---|
| No negative score |
| No player on the pitch after a red card |
| Substitutions never exceed `config.substitutions` |
| Players on the pitch always equals `config.playersOnPitch` (minus dismissals) |
| No player appears on both sides |
| Every `MatchEvent.tick` is non-decreasing |
| Every `xg` is in `[0, 1]` |
| Stamina in `[0, 100]` at every frame |
| Decision prompts never closer than 6 match minutes; never more than `maxDecisions` |
| Special rules fire only within their `earliestPhase`/`latestPhase` window |
| Every `MatchEvent` has non-empty `text` |
| No commentary line repeats within a match while alternatives exist |

### 4.5 The 100-season audit

100 full seasons from a fixed seed, no player input, AI-only.

| Assertion | Pass |
|---|---|
| Every season completes; 22 matches per club per season | Exact |
| Champion varies across seasons | ≥ 5 distinct champions in 100 |
| No club wins > 40% of titles | Prevents a permanently dominant seed |
| Champion's win rate | 60% - 70% |
| Bottom side's win rate | 5% - 15% |
| Table spread (1st vs 12th points) stays plausible | Proportionate to a 22-match season |
| Mean squad overall across the league | Flat ±4 over 100 seasons |
| Mean squad age | Flat ±2 years — a monotonic rise proves no regeneration (`ASSUMPTIONS.md` A15) |
| No club goes permanently bankrupt or permanently unbeatable | Assert both |
| Zero invariant violations | Exact |

### 4.6 The 10,000-player audit

Covered by §3.1; run at scale in the harness rather than in the unit suite.

### 4.7 Strategy audits

Run 10 seasons for each combination and assert all of them are **viable** (finish top 6 at
least once) and none is **dominant** (wins > 50% of its runs).

| Axis | Values |
|---|---|
| Club strategy | Youth Factory, Big Spenders, Analytics, Creator Club, Defensive Specialists, Local Underdog, Showtime, Veteran Core |
| Budget | Bottom club's, median, top club's |
| Manager style | All 8 archetypes |
| Tactical approach | High press / low block / possession / counter |

The failure this catches: a single strategy that always wins (the game has one solution) or
a strategy that never works (the choice is a trap). Both are balance bugs.

---

## 5. Economy stress — `pnpm audit:economy`

**Status: TO BUILD.**

| # | Assertion | Gate |
|---|---|---|
| E1 | Zero `Ledger.verify()` problems after 100 seasons | Fatal |
| E2 | Zero `auditEconomy()` violations at every cycle boundary | Fatal |
| E3 | League-wide total `CASH` growth over 100 seasons | < 3× |
| E4 | Median `marketValue` growth | < 2.5× |
| E5 | Median wage growth | < 2.5× |
| E6 | Richest ÷ poorest club balance | < 12× |
| E7 | Every `TRANSFER_OUT` has a matching `TRANSFER_IN` | Exact |
| E8 | Wage totals reconcile with `Σ Contract.wage` every cycle | Exact |
| E9 | No `PREMIUM` → `CASH` conversion path exists | Exact — the pay-to-win firewall |
| E10 | Every claimed objective has exactly one reward transaction | Exact |
| E11 | A no-purchase 10-season run can win the league and max ≥2 facilities | Pass |
| E12 | A club can enter and recover from distress (the shrink path is reachable) | Pass |
| E13 | A club can be driven to insolvency by bad decisions (consequences exist) | Pass |
| E14 | No non-finite value anywhere in the ledger or club finances | Exact |

---

## 6. Invariant sweep — `pnpm audit:invariants`

**Status: TO BUILD.** Runs with `setInvariantMode('collect')` and drains after every cycle.

| Domain | Checks |
|---|---|
| Squad | A player is in exactly one squad; squad size within bounds; every squad member exists; every contract references a real player in that squad |
| Contracts | `weeksRemaining` ≥ 0; wage within `[MIN_WAGE, MAX_WAGE]`; role is a real `SquadRole` |
| Fixtures | Every fixture references two distinct existing clubs; `verifyFixtures` clean; completed fixtures have both scores |
| Standings | Σ points equals 3×wins + draws across the league; Σ goals for equals Σ goals against |
| Players | Attributes 1-99; overall equals `overallFor(attributes, position)`; potential ≥ overall; fitness 0-100; suspension ≥ 0 |
| Economy | All of §5 |
| Facilities | Levels within `[0, maxLevel]` |
| Rivalries | Intensity 0-100; both clubs exist; no self-rivalry |
| Objectives | Progress ≤ target; a `CLAIMED` objective has a reward transaction; no objective is both active and completed |
| Save | `validateState()` clean at every cycle boundary |
| Content | Every referenced content id resolves in the registry |

---

## 7. Integration tests

Multi-module flows through the orchestrator, in Vitest with `MemoryStorage` and a fixed clock.

| # | Flow | Asserts |
|---|---|---|
| IT1 | New game → first match → save → load → identical state | Full round trip |
| IT2 | Complete a transfer | Ledger debits buyer, credits seller, agent fee posted, squads updated, contract created, `PLAYER_SIGNED` + `TRANSFER_COMPLETED` emitted, `validateState` clean |
| IT3 | A red-card cascade | `RED_CARD` → suspension → fan sentiment drop → media story → rival creator post → morale hit → rivalry intensity rise. **Every generated post carries a `relatedEventId` tracing to the original event** |
| IT4 | Complete a season | 22 matches, standings correct, prize money posted, `SEASON_COMPLETED` emitted, `SeasonSummary` written, `LegacyState` updated |
| IT5 | Upgrade a facility | Cost debited, level raised, `facilityEffect` returns the new value, upkeep rises, `FACILITY_UPGRADED` emitted |
| IT6 | Claim an objective twice | Second claim returns `DUPLICATE`; exactly one reward transaction exists |
| IT7 | Corrupt the primary save, load | Falls back to backup, reports `recoveredFromBackup: true`, state is valid |
| IT8 | Load a save with an expired licensed pack | Entities render as fictional fallbacks; squad, contracts, stats and ledger unchanged |
| IT9 | Run a cycle with no player input | World evolves: AI transfers, development, form, injuries, fan drift all move |
| IT10 | A live match with decisions | `resolveDecision` unblocks the sim; modifiers apply for `durationMinutes`; `DecisionOutcome` recorded with an evaluation |
| IT11 | Scout a player to `DEEP` | `knowledgeRange` narrows to exact; cost posted; `SCOUT_REPORT_READY` emitted |
| IT12 | Wage bill exceeds balance | Wages post with overdraft, balance goes negative, `BALANCE_LOW` emitted, reconciliation invariant still passes |

---

## 8. Manual UX passes

Per phase gate, on real devices: iPhone 12 (minimum target), current iPhone, a mid-range
Android, iPad, desktop Chrome and Safari.

| # | Pass | Looking for |
|---|---|---|
| U1 | **First ten minutes**, cold, with someone who has never seen it | Every beat in the PRD sheet lands; no beat overruns by > 30s; the player makes a decision before reading a number; they can say what their club is after 10 minutes |
| U2 | **Match legibility** | Can the player follow the ball at 390pt? Does the momentum read? Is a decision prompt readable in under 2 seconds mid-action? |
| U3 | **Decision quality** | Does every option feel like it has a downside? Any obviously correct answer is a bug |
| U4 | **Session shape** | Does one cycle land in 10-15 minutes without rushing? Is there a hook at the end of every session? |
| U5 | **Glass performance** | Sustained ≥55 fps during a match on the minimum device; no jank on sheet open; no visible recomposite when scrolling over glass |
| U6 | **Reduced motion** | Every hero moment degrades to a cross-fade; nothing pops in with no transition; nothing becomes unreachable |
| U7 | **Reduced transparency** | Every screen readable with glass collapsed to solid; contrast preserved; no layout that only worked because of blur |
| U8 | **Touch targets** | Everything ≥44pt, verified with an overlay, especially in the match view |
| U9 | **Focus and keyboard** | Full keyboard traversal on desktop; the volt focus ring visible on all four glass levels and all four solid fallbacks |
| U10 | **Text scaling** | 200% OS text: no clipping, no overlap, no lost information |
| U11 | **Safe areas** | Notch and home indicator respected on every fixed surface, portrait and landscape |
| U12 | **Haptics** | One per action, never on a background event, `celebrate` rate-limited, respects the setting immediately |
| U13 | **Feed authenticity** | 30 minutes of feed reading: does anything repeat? Does anything read as generated? Does every post trace to something that happened? |
| U14 | **Long save** | A 10-season save: does the world still feel alive? Are the same clubs winning? Has the market closed? Has the squad aged out? |
| U15 | **Offline and interruption** | Airplane mode; a call mid-match; backgrounding mid-negotiation; force-quit mid-cycle. **No progress loss beyond one cycle** |
| U16 | **Store trust** | Does the store feel like curation or pressure? Would a sceptical reviewer call anything here pay-to-win? |

---

## 9. Phase gates

Each gate is objective. A phase is not complete until every criterion passes.

| Phase | Gate criteria |
|---|---|
| **0 — Foundation** | `pnpm install`, `typecheck`, `test`, `build` all pass. ESLint config exists and the four purity rules (§2.1) are enforced. CI runs typecheck + lint + test on every push. `tools/sim` exists as a real package and `pnpm audit:all` runs (even if it asserts nothing yet) |
| **1 — Content** | `validatePack(BASE_PACK)` returns zero errors and zero warnings. Every volume gate in §3 met. Generator distribution tests pass at 10,000 samples. Legal denylist clean |
| **2 — Match engine** | §4.1 metrics all in band over 1,000 matches. **§4.1a two-regime validation passes independently before the blend is checked.** §4.1b distribution assertions pass (overdispersed, exposed dispersion knob, full scoreline matrix). §4.2 competitive integrity passes (favourite 75-85%, never >90%; home advantage 0; support modifier ≤6pp). §4.3 determinism passes. §4.4 impossible-state assertions pass, zero exceptions. Commentary non-repeating |
| **3 — Club systems** | §5 economy assertions E1-E10 and E14 pass over 100 seasons. Scouting narrows correctly. Training trade-offs measurable. Fan loop closes and can run backwards (E12) |
| **4 — Living world** | §7 IT3 cascade passes with full event traceability. AI clubs act differently by profile (§4.7 strategy audit). Emergent stories detected from history, not scripted. Zero social/media posts without a traceable source event |
| **5 — Game shell + UI** | U1-U12 pass on the minimum device. Onboarding funnel step 12 ≥ 70% in playtest. Sustained ≥55 fps in a match. Cold start ≤2.5s |
| **6 — Balance and audit** | §4.5 100-season, §4.7 strategy, §5 full economy, §6 invariant sweep all pass. E11 (no-purchase completability) passes. E13 (insolvency reachable) passes |
| **7 — Launch readiness** | Crash-free ≥99.5% in a beta cohort. Zero P0 analytics alerts for 7 days. U13-U16 pass. All P0 features in `PRODUCT_REQUIREMENTS.md` §8 shipped. Every open question in §10 that is marked blocking is resolved |

---

## 10. What "done" means

| Artefact | Done when |
|---|---|
| **An engine module** | Public functions match the contract signature exactly; `*.test.ts` alongside covering happy path, boundaries and every documented failure mode; every tunable in a `balance.ts`; zero typecheck errors; zero lint errors; no `Math.random`, no `Date.now`, no platform import; the module header explains *why* the module exists and what it trades off |
| **A content pack** | `validatePack()` clean; volume gates met; distribution tests pass; denylist clean; the authoring checklist in `CONTENT_SCHEMA.md` §5.8 fully ticked |
| **A UI component** | Every box in the `DESIGN_SYSTEM.md` §11 checklist ticked; renders correctly at 390pt and 1280pt; verified under reduced motion and reduced transparency; touch targets ≥44pt; focus ring survives glass |
| **A game system** | Its unit tests pass; its integration test passes; its invariants are in the sweep; its analytics events fire; its balance constants are in a `balance.ts`; it appears in `GAME_SYSTEMS.md` with its inputs and outputs named |
| **A phase** | Every gate criterion in §9 objectively passes, measured not asserted |
| **The product** | Phase 7 gate passes |
