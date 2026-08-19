# Creator Football — Risk Register and Pre-Mortem

**The exercise.** It is eighteen months from now. Creator Football shipped and failed. This
document is the post-mortem, written in advance.

Each risk carries: likelihood, impact, the **early warning signal** that would let us catch
it before launch, and the mitigation — including what is already in the code.

**Likelihood:** Low / Medium / High. **Impact:** Low / Medium / High / **Critical**
(the product fails).

---

## Summary

| # | Risk | Likelihood | Impact | Score |
|---|---|---|---|---|
| R1 | The match sim is boring | Medium | **Critical** | **Highest** |
| R2 | The UI feels like a spreadsheet | Medium | **Critical** | **Highest** |
| R3 | The creator system is superficial | Medium-high | High | **Highest** |
| R4 | The social feed feels fake | High | High | **Highest** |
| R5 | Transfers feel meaningless | Medium | High | High |
| R6 | The economy becomes repetitive | Medium-high | High | High |
| R7 | Season length is wrong | Medium | Medium | Medium |
| R8 | Special rules feel gimmicky | Medium | Medium | Medium |
| R9 | Players feel like numbers | Medium | High | High |
| R10 | Clubs feel identical | Medium | High | High |
| R11 | The world feels static | Medium | High | High |
| R12 | Monetisation destroys trust | Low | **Critical** | High |
| R13 | Mobile performance collapses under glass | Medium-high | High | **Highest** |
| R14 | The engine purity rule is broken silently | **High** | High | **Highest** |
| R15 | Scope overrun | **High** | High | **Highest** |
| R16 | The world ages out over a long dynasty | Medium-high | Medium | Medium |
| R17 | Save corruption or data loss | Low | **Critical** | High |
| R18 | Parallel workstreams integrate badly | Medium-high | Medium | Medium |
| R19 | Accidental IP infringement | Low | **Critical** | Medium |
| R20 | Nobody has heard of any of this | High | Medium | Medium |

---

## R1 — The match simulation is boring

**Likelihood:** Medium **Impact:** Critical

**The failure.** Matches resolve into a stream of similar events. The player watches five,
learns nothing changes based on what they do, and taps skip forever. Every system upstream —
tactics, transfers, training, scouting — loses its point, because none of them visibly
affect anything.

**Why it happens.** A tick-based possession model with a single xG pipeline naturally
produces a *statistically correct, dramatically flat* match. Realism and drama are not the
same objective, and realism is the easier one to test for.

**Early warning signals.**
- `match_skipped ÷ match_started` rising session over session (analytics C1).
- `match_decision_default_applied` above 15% (C2).
- Playtesters cannot describe what happened in a match they just watched.
- Momentum timeline is flat in most matches.
- The same three event types account for most of the visible stream.

**Mitigation.**
- **In the code already:** continuous xG (chances have *quality*, not just existence);
  momentum as a derived summary; fatigue degrading effective attributes over the match;
  conditional traits (`LATE_GAME`, `BIG_MATCH`, `DERBY`) that make specific players show up
  at specific moments; special rules with phase windows; `MatchEvent.importance` 1-5 so the
  UI can interrupt for the big ones and log the small ones.
- **Required:** the 1,000-match audit must assert *variance*, not only means — a distribution
  of match shapes, not just a correct average. Two matches with the same score should be
  describable differently.
- **Required:** at least one genuinely dramatic beat per match on average — a big chance
  missed, a momentum swing, a card, a special rule.
- **Design rule:** every decision option must have a measurable effect on the match's xG
  trace. `DecisionOutcome.evaluation.verdict` distribution dominated by `NEUTRAL` is a
  failure signal, not a neutral one.

---

## R2 — The UI feels like a spreadsheet

**Likelihood:** Medium **Impact:** Critical

**The failure.** The premium visual language survives the marketing screenshots and dies in
the squad list. Screens become dense tables because the data is dense. It looks like Football
Manager with rounded corners, and the "deep systems, simple surface" thesis is a slogan.

**Why it happens.** Every system produces numbers, and the honest way to show a number is a
row. Density accretes screen by screen; no single decision causes it.

**Early warning signals.**
- Any screen with more than ~7 distinct numbers visible at once.
- A component that needs horizontal scrolling to show its columns.
- Playtesters describing a screen as "a lot".
- Time-to-first-tap on a screen above ~4 seconds.

**Mitigation.**
- **In the code already:** `keyAttributes()` returns exactly 3 attributes per player;
  `positionContext()` reduces a whole table to one sentence ("one win from first"); trait
  `blurb` describes the effect in plain language; `DecisionOption.effect` is one line of
  plain language; scouting shows a *range* rather than a number until you invest.
- **Design rule:** every screen has one primary number and one primary action. Everything
  else is progressive disclosure.
- **Design rule:** prose before numbers. "He'll run all day" before `stamina: 84`.
- **Required:** a UX pass per screen against a "how many numbers?" budget, at phase gate 5.

---

## R3 — The creator system is superficial

**Likelihood:** Medium-high **Impact:** High

**The failure.** Creators turn out to be a follower count that multiplies sponsor income.
Players sign the highest-follower creator available and never think about it again. The
differentiator becomes a stat.

**Why it happens.** Of the 11 creator attributes, one (`audience`) is easy to understand and
easy to optimise. If the others do not produce *visibly different outcomes*, they are noise
and players will correctly ignore them.

**Early warning signals.**
- `creator_signed` events cluster on the highest `followers` regardless of attributes.
- Playtesters cannot answer "what does this creator do for you?"
- Creator `tone` never changes what appears in the feed.
- `controversy` never produces a visible downside.

**Mitigation.**
- **In the code already:** `creatorReach()` weights engagement heavily enough that a smaller,
  more engaged creator can out-reach a bigger one — so tier is a starting point, not a
  verdict. `controversy` is explicitly double-edged. `clubSentiment` decides whether a
  creator hypes or dunks. `dealWeeksRemaining` means creators are not permanent.
- **Required:** creator `tone` must visibly change feed content. A `PROVOCATIVE` creator and
  a `WHOLESOME` one must never share a template.
- **Required:** at least one creator decision per season with a real trade-off — a
  high-`controversy` creator who doubles reach and creates a media crisis.
- **Required:** the creator screen must show the *chain* (audience → reach → followers →
  sponsor tier → income), not the endpoint.

---

## R4 — The social feed feels fake

**Likelihood:** High **Impact:** High

**The failure.** Within two sessions the player recognises the templates. Posts start
reading as filler, the feed becomes wallpaper, and the "living world" claim collapses — which
also takes down the media system and much of the perceived value of rivalries.

**Why it happens.** This is the single most likely-to-happen risk in the register. Template
recognition is fast and irreversible: once a player has seen the seams they cannot unsee
them.

**Early warning signals.**
- Feed dwell time falling session over session.
- Repeated-line reports in playtests (the most reliable signal we have).
- Distinct-rendered-strings ÷ posts-shown falling below ~0.85 over a 10-cycle window.
- A post that does not obviously relate to something that just happened.

**Mitigation.**
- **In the code already:** a template whose tokens cannot all be filled is **never rendered**
  (`renderTemplate` returns `null`) — one fewer line beats a broken line. Recently used
  templates are de-weighted by `REPEAT_PENALTY = 0.04`. Conditions are matched against a
  published fact vocabulary and an *unknown* fact key never matches, so a template cannot
  fire in the wrong context. Every post carries `relatedEventId`.
- **Required volume:** 120+ social and 60+ media templates, ≥4 per trigger.
- **Required:** author voice. The eight `SocialPost` kinds and six creator tones must have
  disjoint template pools.
- **Required:** the specificity ladder — conditions on `margin`, `importance`, `derby`,
  `streak`, `position` so a line is about *this* result, not any result.
- **Escalation if it happens:** hand-author responses for the top ~30 highest-frequency
  triggers rather than adding more generic templates.

---

## R5 — Transfers feel meaningless

**Likelihood:** Medium **Impact:** High

**The failure.** The player buys the highest-rated player they can afford. There is no
scouting edge, no market read, no genuine tension in a negotiation. Transfers become
shopping.

**Early warning signals.**
- First `offer_ratio` clusters at exactly the asking price (the player is not negotiating).
- `transfer_failed` near zero (no tension) or dominated by one reason (arbitrary).
- Scouting spend near zero — the information economy is not being used.
- Players never sell anyone.

**Mitigation.**
- **In the code already:** patience on both sides that burns per round and per lowball; an
  insult threshold that costs double; hijacks scaling with suitors *and* with how long you
  dither; a lose-interest roll below patience 40; a player willingness score where wage is
  only 34% and role, club reputation and league position make up the rest; agent fees that
  inflate when rivals circle; a loyalty threshold above which a player will not even talk.
- **In the code already:** progressive scouting with an ±18-point band at zero confidence,
  narrowing on an exponent so early investment pays off fast.
- **Required:** the market must have *scarcity*. `MARKET_BALANCE.LISTING_RATE: 0.09` means
  most players are not for sale — that must be felt, not just true.
- **Required:** the UI must surface *why* a negotiation is going badly, or the whole system
  reads as random.

---

## R6 — The economy becomes repetitive

**Likelihood:** Medium-high **Impact:** High

**The failure.** By season 3 the economy is solved: the same facility order, the same
sponsor progression, the same wage-to-income ratio. Money stops being a decision.

**Early warning signals.**
- Facility upgrade order identical across playtesters.
- Balance growing monotonically after season 2.
- `balance_low` never fires after season 1.
- No player ever sells a player they wanted to keep.

**Mitigation.**
- **In the code already:** seven anti-inflation brakes (`ECONOMY.md` §6) — compounding
  wages, the big-club tax, expectation inflation, facility upkeep, age decay, hard ceilings,
  the contract-expiry cliff.
- **Required (`SPEC`):** the shrink path. The research is explicit that real creator leagues
  *contract* — a founding market closed, a broadcaster walked, a club asked to be relegated.
  Falling sentiment → sponsor loss → forced sales must be reachable, and the audit must
  prove it (E12, E13).
- **Required:** AI clubs must face the same inflation, or the player is uniquely punished
  (brake B8).
- **Required:** facility effects must interact with *strategy*, so a `CREATOR_FIRST` club and
  a `DEFENSIVE_ROCK` club rationally upgrade in different orders.

---

## R7 — The season length is wrong

**Likelihood:** Medium **Impact:** Medium

**The failure.** 22 matches is either a grind (players churn mid-season) or over before it
means anything (seasons feel disposable).

**Early warning signals.**
- A churn cliff at a specific matchweek (pacing bug) versus a slow bleed (length problem).
- Median seasons by D30 below 1.5, or above 5.
- Playtesters unable to name a moment from the season they just finished.

**Mitigation.** Cheap to fix: `SeasonConfigDef.rounds` and `clubCount` are content config,
and `phaseForWeek()` distributes the narrative calendar proportionally, so any length still
feels like a campaign. `verifyFixtures` validates any combination. See `ASSUMPTIONS.md` A2.

---

## R8 — Special rules feel gimmicky

**Likelihood:** Medium **Impact:** Medium

**The failure.** Special rules read as random score-changing events rather than a mechanic.
`DOUBLE_GOAL` decides a title on a coin flip and the player feels cheated.

**Early warning signals.**
- Playtesters describe a rule as "unfair" rather than "dramatic".
- Match outcomes correlate more strongly with rule activation than with squad quality.
- Rule cards hoarded and never played (the player does not trust them).

**Mitigation.**
- **In the code already:** `counterplay: string` is a *required* field —
  *"A rule that cannot be played against is a bug."* `opponentModifiers` is the counterplay
  in numbers. `earliestPhase`/`latestPhase` constrain when a rule may fire.
  `ActiveSpecialRule.reason` is *"shown to the player so it never feels arbitrary"*.
  Scarcity is enforced at the fixture layer via `specialRuleWeeks`.
- **Required:** the audit must show that special rules shift outcomes within a bounded range —
  they are drama, not a coin flip.
- **Required:** rule cards are earned, never bought (`PRODUCT_REQUIREMENTS.md` Q10).

---

## R9 — Players feel like numbers

**Likelihood:** Medium **Impact:** High

**The failure.** No player is memorable. The player sells their top scorer without a
thought. The squad is inventory.

**Early warning signals.**
- Playtesters cannot name a player from their own squad after three sessions.
- No emotional reaction to a transfer request or an injury.
- Traits never mentioned unprompted.

**Mitigation.**
- **In the code already:** 22 traits with plain-language blurbs describing real effects;
  a 10-attribute mental profile where 8 are *personality constants*, not grindable stats;
  `PlayerForm` with a per-match rating history; `SeasonStats` history; `cult_hero` and
  `showman` traits that make fans care; `PLAYER_MORALE_CHANGED` carrying a `reason` string;
  `Contract.role` with a minutes promise that can be broken.
- **Required:** the media and social engines must name individuals, not just clubs. A
  player's third derby goal must produce a story about *him*.
- **Required:** `LegacyState.legends` — a player who becomes permanent history.
- **Required:** the injury of a key player must be a *media event*, not a status icon.

---

## R10 — Clubs feel identical

**Likelihood:** Medium **Impact:** High

**The failure.** Twelve clubs differ by name and colour. The league is a table of
interchangeable opponents; rivalries have no texture.

**Early warning signals.**
- Playtesters cannot describe any opponent's identity.
- AI clubs' transfer behaviour is statistically indistinguishable across profiles.
- The strategy audit (§4.7) shows all eight profiles converging on similar squads.

**Mitigation.**
- **In the code already:** each club carries philosophy (8), fan culture (6), reputation,
  strength, budget, stadium, motto, badge shape (5) × motif (12) × style (6) × kit pattern
  (6), an AI profile, and 1-2 declared rivals.
- **Required:** `aiClubTurn` must reflect **finances, needs, philosophy and league position**
  — all four. Three of four produces interchangeable clubs.
- **Required:** the strategy audit must show measurably different squad compositions per
  profile after 10 seasons (a Youth Factory squad must be visibly younger).
- **Required:** fan culture must change the *response curve*, not just a label.

---

## R11 — The world feels static

**Likelihood:** Medium **Impact:** High

**The failure.** Nothing happens unless the player does it. AI clubs never make a surprising
signing. The table is predictable. The player is the only agent in the world.

**Early warning signals.**
- AI transfer volume near zero.
- The same clubs finish in the same positions every season in the 100-season audit.
- No `TRANSFER_HIJACKED` events ever fire against the player.
- No emergent story is ever detected.

**Mitigation.**
- **Contract requirement:** *"The world must evolve whether or not the player acts."*
- **In the code already:** the domain event spine makes cascades explicit; `ContentHook`
  carries `rootEventId` and `depth` so a fifth-order reaction is traceable;
  `RIVALRY_CREATED` allows new rivalries to form.
- **Required:** the 100-season audit must show ≥5 distinct champions and no club above 40%
  of titles.
- **Required:** emergent story detection over history (a player scoring in three consecutive
  derbies, a keeper on a clean-sheet run, a signing flopping) — **detected, not scripted**.

---

## R12 — Monetisation destroys trust

**Likelihood:** Low **Impact:** Critical

**The failure.** A convenience item is read as pay-to-win. A review cluster forms. The
premium audience — who chose this game specifically to escape that — leaves loudly, and the
positioning is unrecoverable.

**Early warning signals.**
- Any review or playtest comment using "pay to win", "predatory" or "pressure".
- Churn correlated with `store_viewed` (analytics C10).
- Any store SKU whose content touches a `Player`, `CASH`, or a `RULE_CARD`.

**Mitigation.**
- **Testable rules** (`ECONOMY.md` §8.4): no purchasable cash, no purchasable rule cards, no
  purchasable scouting accuracy, no purchasable players or attributes, no loot boxes, no
  timers, and the full game completable with zero purchases (audit E11).
- **In the code already:** offers are data (`StoreOfferDef`), so a bad offer is a revertible
  diff; the ledger's `PREMIUM`/`CASH` separation makes the firewall auditable (invariant I4).
- **Required:** the store is not surfaced in the first ten minutes.
- **Required:** content validation asserts the monetisation rules as **build failures**.

---

## R13 — Mobile performance collapses under glass

**Likelihood:** Medium-high **Impact:** High

**The failure.** Four levels of `backdrop-filter` over an animating pitch drops the frame
rate on the minimum device. The premium look becomes a premium stutter, and the match — the
thing everything else exists to produce — is unwatchable.

**Early warning signals.**
- `perf_frame_drop` on the match screen (analytics C7).
- Sustained fps below 55 on an iPhone 12 during playback.
- Battery or thermal complaints in beta.
- Any screen with three or more simultaneously blurred surfaces.

**Mitigation.**
- **In the code already:** four glass levels with solid-surface fallbacks that preserve
  contrast; `prefers-reduced-transparency` and `[data-reduced-effects='true']` both collapse
  glass globally; `motion.ts` forbids animating `backdrop-filter` (sheets translate only);
  `manualChunks` splits vendor and motion so first paint is not gated on the animation
  library; `body { overflow: hidden }` so each screen owns its scroll.
- **Design rule:** never more than two glass levels in a visual path.
- **Escalation ladder:** cap simultaneous blurred surfaces at two → disable glass on the
  match route → render the pitch to canvas → auto-enable reduced effects below a measured
  device threshold. The renderer consumes `PitchFrame`, so the canvas swap is contained.

### R13b — Bounded history is silently lossy

Related, lower severity, easy to miss. `EventBus` caps the journal at 5,000 events;
`Ledger` caps transactions at 4,000 in memory and **1,200 in the save**; `appliedKeys` is
unbounded and grows forever. Consequences: an economy audit over a long dynasty audits a
window, not the dynasty; a loaded save has less history than the session that wrote it; save
size grows monotonically with claimed rewards.

**Mitigation:** `LegacyState` already exists as the durable rollup for anything that must
survive. **Required (`SPEC`):** a season roll-up at `SEASON_COMPLETED` that archives the
season's financial digest into `SeasonSummary` and expires `appliedKeys` scoped to closed
seasons.

---

## R14 — The engine purity rule is broken silently

**Likelihood:** High **Impact:** High

**The failure.** Someone imports `localStorage` or calls `Math.random()` in
`packages/engine`. Nothing fails. Six months later the headless audit harness cannot run,
determinism is gone, replays do not reproduce, and the future server is a rewrite.

**Why it is High likelihood.** The rule is stated in three places — the integration contract,
module headers, and this document set — and enforced in **zero**. There is no ESLint
configuration anywhere in the repository. The root `pnpm lint` script runs `pnpm -r lint`,
and no package defines a `lint` script. `.github/workflows/` is empty; there is no CI.
**Most of the engine has now been written** against a rule nothing checks — the retrofit
cost has already risen once.

**This is the highest-likelihood architectural risk in the repository.**

**It has already produced consequences.** With no CI, two of the four workspace commands
are currently red and nobody was told: `pnpm typecheck` fails on a `rootDir` conflict, and
`pnpm test` fails 2 of 262. One of those failures is a test that **passes in isolation and
fails in a full run** — a state leak between tests, in a codebase whose central claim is
that the same inputs always produce the same outputs. That is precisely the class of bug a
determinism guarantee is supposed to make impossible, and it went unnoticed because nothing
runs the suite on a push.

**Early warning signals.** By definition there are almost none until something breaks —
which is exactly why it needs a mechanical check rather than a review culture. The one
signal available: run the full suite with `--sequence.shuffle` and see whether it still
passes.

**Mitigation — required, Phase 0:**
1. An ESLint config with `no-restricted-imports` scoped to `packages/engine/**`, banning
   `react*`, `@capacitor/*`, and every Node built-in.
2. `no-restricted-globals` / `no-restricted-properties` banning `window`, `document`,
   `localStorage`, `navigator`, `fetch`, `Math.random`, `Date.now`.
3. A `lint` script in every package so `pnpm -r lint` does something.
4. CI running `typecheck` + `lint` + `test` on every push.
5. A determinism test that runs a full cycle twice with a fixed clock and diffs.
6. `vitest --sequence.shuffle` in CI, so cross-test state leaks fail loudly rather than
   intermittently.

Adjacent, same root cause: the invariant system defaults to `mode = 'throw'`, while its own
header says production should report rather than crash. **The host must call
`setInvariantMode('collect')` at startup in production builds**, and nothing currently
verifies it does.

---

## R15 — Scope overrun

**Likelihood:** High **Impact:** High

**The failure.** Six workstreams, an enormous contracted surface, and a P0 list of 22
features. The match engine, the content pack, the club systems, the living world, the game
shell and the design system are all in flight simultaneously. Something slips, everything
waits, and the polish budget — which is the entire product differentiator — is spent on
catching up.

**Early warning signals.**
- A phase gate missed by more than a week.
- P1 features starting before all P0 features are gate-passed.
- The audit harness still unbuilt at Phase 3 (it is a Phase 0 deliverable and is currently
  an empty directory).
- Test coverage flat while feature count rises.

**Mitigation.**
- The P0/P1/P2 split in `PRODUCT_REQUIREMENTS.md` §8 exists precisely so scope can be cut
  sanely. **Cut whole P1 features; never cut polish on a P0 feature.**
- Objective phase gates (`TEST_PLAN.md` §9) so "done" is measured, not asserted.
- Content volume is the most compressible axis: 12 clubs could ship as 10, 28 creators as
  20, 200 commentary lines as 140. Everything is content config.
- The frozen contract is the schedule's main defence: workstreams cannot block each other on
  types. Its cost is R18.

**Named localisation debt.** `formatMoney()` hardcodes `£` and `en-GB` inside the engine —
a presentation concern in the domain layer. Small now, expensive once every screen uses it.

---

## R16 — The world ages out over a long dynasty

**Likelihood:** Medium-high **Impact:** Medium

**The failure.** By season 8-12 every player is 32, the transfer market is closed, and the
dynasty fantasy — the reason to keep playing — evaporates.

**Why it happens.** No newgen/youth-intake system is contracted. `generateSquad` seeds the
world; `refreshMarket` has a `FREE_AGENT_POOL_TARGET: 6` but no defined generational supply.
Ageing is modelled (`DECLINE_PER_YEAR`, `STEEP_DECLINE_AGE`); regeneration is not.

**Early warning signal.** The 100-season audit: mean squad age rising monotonically. This is
an explicit assertion in `TEST_PLAN.md` §4.5 and `ECONOMY.md` §6.1 precisely because it is
otherwise invisible until someone plays a long save.

**Mitigation.** A youth-intake generator per club per season, scaled by the academy
facility's `youthQuality`. Additive: `generatePlayer` already exists and
`YOUTH_PROSPECT_PROMOTED` is already an event. Tracked as `PRODUCT_REQUIREMENTS.md` Q6.

---

## R17 — Save corruption or data loss

**Likelihood:** Low **Impact:** Critical

**The failure.** A player loses a 20-season dynasty. That is an unrecoverable trust event
for that player and, if it happens at scale, for the product.

**Mitigation — largely already built.** `persistence/save.ts` is the most defensively written
module in the repo: versioned envelopes, an FNV-1a checksum, promote-to-backup before every
write, refusal to overwrite a good save with an invalid state, forward-only migrations keyed
by source version, and `loadGame` falling back to the backup while *telling the caller* it
did — *"so the UI can be honest about losing a cycle rather than pretending nothing
happened."*

`validateState` specifically checks for a player in two squads, described as *"the single
most damaging corruption we can ship, because it silently duplicates value."*

**Residual risk:** the storage adapter itself (quota exceeded, an interrupted native write),
and save size growth from the unbounded `appliedKeys` set (R13b). **Required:** integration
test IT7 (corrupt primary, recover from backup) and a quota-exceeded path.

---

## R18 — Parallel workstreams integrate badly

**Likelihood:** Medium-high **Impact:** Medium

**The failure.** Six workstreams build against frozen types. Everything type-checks. Nothing
works together, because the types constrained shape and not semantics — a `MarketDelta` that
means something subtly different to its producer and its consumer.

**Early warning signals.**
- A workstream adding new files in its own directory to route around a frozen contract (the
  contract explicitly permits this, and it is a signal worth watching).
- Integration tests not written until after every workstream lands.
- Contract signatures matched but with different unit assumptions (per-cycle vs per-week,
  0-1 vs 0-100).

**Mitigation.**
- The integration test suite (`TEST_PLAN.md` §7) must be written *against the contract*,
  before implementations land, and must go red until each is complete.
- Units in the contract must be explicit in every doc comment: `wage` is per cycle,
  `sentiment` is 0-100, `momentum` is −1..+1, `form.rating` is −1..+1, `spaceBehind` is 0-1.
- Phase gates run integration tests, not only unit tests.
- The `ContentRegistryPort` pattern (depending on a structural subset of a module you do not
  own) is the model to copy for every cross-workstream dependency.

---

## R19 — Accidental IP infringement

**Likelihood:** Low **Impact:** Critical

**The failure.** A generated name, a badge motif, a commentary line or a club identity is
close enough to a real one to draw a legal complaint. Worst case: an app-store takedown.

**Mitigation.** `LICENSING_ARCHITECTURE.md` §6.3 lists ten structural guardrails. The
strongest is G1: **no code reads a name for behaviour**, so no real identity can be
special-cased even deliberately. The base pack is validated `FICTIONAL` end-to-end; licensed
entities without rights are invisible rather than visible-and-illegal (fail closed).

**Required:** the CI denylist (§6.4) over every string field, asset filename, analytics event
name and branch name, seeded from the research dossier's rights-holder list — as a **build
failure**, before the base pack ships. Currently unbuilt.

---

## R20 — Nobody has heard of any of this

**Likelihood:** High **Impact:** Medium

**The failure.** A fictional universe with no name recognition, competing against licensed
football games, in a category where the audience arrives via a real club or a real creator.
Acquisition is expensive and word of mouth is the only lever.

**This is the accepted cost of A6**, and it is not reversible: real names in the base game
are a legal exposure and a dependency we do not control.

**Mitigation.** The fiction has to be good enough to be its own hook — 12 clubs with real
identities, 28 creators who read as people, a world that generates its own stories. The
architecture keeps the licensing option open as a business decision rather than a rewrite
(`LICENSING_ARCHITECTURE.md` §7), which converts this from a permanent ceiling into a
deferred opportunity.

---

## The three risks to watch first

If only three things get monitored, these:

1. **R14 — the purity rule is unenforced.** Highest likelihood of the Critical-adjacent
   risks, cheapest to fix (a Phase 0 lint config), and the only one that gets *harder* the
   longer it waits, because every week adds engine code written against an unchecked rule.
2. **R1 + R13 together — the match.** The match is the product. If it is boring (R1) or it
   stutters (R13), nothing else matters. Both have early signals available from the first
   playable build, and both should be measured from day one rather than at a gate.
3. **R4 — the feed feels fake.** Highest raw likelihood in the register, and it undermines
   three systems at once (social, media, rivalries). The mitigations are known and mostly
   about *volume and voice*, which means the cost is authoring time — which means it must be
   budgeted early or it will not happen.
