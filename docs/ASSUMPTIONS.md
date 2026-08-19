# Creator Football — Assumptions and Trade-offs

Every assumption this product rests on, stated plainly. Each entry has: the assumption, why
we made it, what it costs us, the evidence we have, **what would change if it turns out
wrong**, and how we would find out.

An assumption that cannot be falsified is a belief, not an assumption. Every entry below
names a signal.

---

## Index

| # | Assumption | Confidence | Reversibility |
|---|---|---|---|
| A1 | Web tech in a native shell beats React Native and native | High | Low — a rewrite |
| A2 | A 22-match compressed season is the right campaign length | Medium | **High** — content config |
| A3 | 7-a-side short format is the right default | Medium | **High** — content config |
| A4 | A single league tier at launch is enough | Medium-high | Medium — additive |
| A5 | Single-player V1 | High | Medium — engine already suits a server |
| A6 | Fictional-only base content | Very high | n/a — non-negotiable |
| A7 | Two to three live decisions is the right amount of match agency | Medium | High — a config number |
| A8 | Premium purchase + cosmetic/convenience IAP is a viable model | Medium-low | Medium — store is data |
| A9 | Creators as a first-class parallel system, not a skin | Medium-high | Low — deep in the model |
| A10 | Players will watch matches rather than skip them | Medium | n/a — design consequence |
| A11 | Event-generated media and social will read as authored | Medium | Low — architectural |
| A12 | Heavy backdrop-filter glass performs acceptably on target devices | Medium-low | Medium — degradation exists |
| A13 | Cycle-based time (no real-time timers) does not cost retention | Medium | High — but we will not reverse it |
| A14 | Seeded determinism is worth its constraints | Very high | Low — architectural |
| A15 | 12 clubs is enough world | Medium-high | High — content config |
| A16 | English-only at launch | Medium | Medium — template volume is the cost |
| A17 | Data-only content packs, no executable mods | High | High — additive later |
| A18 | Deep systems will be felt through a shallow surface | Medium | n/a — the core product bet |

---

## A1 — Web technology in a native shell, not React Native

**Assumption.** React 19 + Vite + Tailwind 4, wrapped by Capacitor, will deliver a
premium-feeling iPhone game more reliably than React Native or native Swift.

**Rationale.**
- The visual language is *liquid glass*: layered translucency, backdrop blur, specular
  sheens. CSS `backdrop-filter` expresses this natively and compositor-accelerated. In
  React Native the same effect needs `@react-native-community/blur`, is platform-divergent,
  and does not nest cleanly.
- One design system, one token file (`tokens.css`), one motion language (`motion.ts`) for
  phone, tablet and desktop. The game is reviewed and streamed on desktop; a native-only
  build would need a second implementation for that.
- Iteration speed. Vite HMR across the engine/app boundary (the app aliases engine
  *source*) is seconds. A native rebuild loop is minutes.
- The engine is pure TypeScript regardless. Choosing web for the shell means the whole
  product is one language and one type graph.

**What it costs us.**
- WebView performance ceiling, especially for the animated pitch and stacked glass. This is
  the single largest technical risk in the product (`RISKS.md` R13).
- No access to Metal/SwiftUI-grade rendering.
- App Store review scrutiny of "wrapped web app" — mitigated by the app being genuinely
  offline-capable, native-shell-integrated (haptics, status bar, splash) and not a website.
- Memory pressure: a WKWebView plus a 5000-event journal plus a match's `PitchFrame`
  history is not free.

**Evidence.** `apps/game/src/design/motion.ts` already encodes the mitigation as a rule:
*"Sheets: translate only. Never animate `backdrop-filter` — it forces a full-surface
recomposite every frame on mobile GPUs."* The reduced-effects escape hatch
(`[data-reduced-effects='true']`) already exists in `tokens.css`.

**What changes if wrong.** If we cannot hold 55 fps on an iPhone 12 during a match with the
designed glass:
1. First: drop glass to solid surfaces during the match only (the token layer already
   supports this — flip `data-reduced-effects` for the match route).
2. Then: render the pitch to `<canvas>` instead of DOM nodes. The renderer consumes
   `PitchFrame`, so this is a contained change.
3. Only then: reconsider the shell. That is a rewrite of `apps/game`, not of the engine —
   which is precisely why the engine is separate.

**Signal.** Frame-rate telemetry during match playback on the bottom 20% of the device
distribution; `perf_frame_drop` analytics event (`ANALYTICS.md` §2.7).

---

## A2 — A compressed 22-match season is the right campaign length

**Assumption.** 12 clubs × double round robin = 22 matches per club per season is long
enough to tell a story and short enough that a player finishes multiple seasons.

**Rationale.**
- At 1.0-1.6 cycles per session and 1.4-2.2 sessions per day, a season is roughly 10-16
  days of play. Two to three seasons inside a D30 window is achievable, which is what makes
  the dynasty fantasy land inside the retention window that matters.
- A 38-match season would put the first championship beyond most players' D30.
- 22 weeks maps cleanly onto the twelve `SeasonPhase` beats without any phase collapsing to
  a single week.

**What it costs us.**
- Every match matters more, so a bad run is more punishing and a single injury is more
  costly. Variance is higher relative to a long season.
- Less room for a mid-season slump to become a comeback arc.
- The transfer window is a *phase*, so a player who misses it waits a season.

**What changes if wrong.**
- **Too long** (players churn before finishing season 1): `SeasonConfigDef.rounds` drops to
  1 → an 11-match season. This is a content-pack change, no code change. `phaseForWeek()`
  distributes phases proportionally, so the calendar still works.
- **Too short** (seasons feel disposable, no arc): raise `clubCount` to 14-16, or
  `rounds` to 3. Both are content config. `verifyFixtures()` already validates any
  combination.

**Signal.** Median seasons completed by D30 (target ≥ 2.5); churn distribution by matchweek —
a cliff at a specific week is a pacing bug, a slow bleed is a length problem.

---

## A3 — 7-a-side, 30-minute short format as the default

**Assumption.** A 7-a-side (1 GK + 6 outfield), 30-minute, two-half format is the right
competitive default.

**Rationale.**
- The research dossier records that both mature creator-football templates use a short
  format, and that short format produces roughly 2-3× the goals per match of 11-a-side and
  ~7× the goals per minute. Goals are the unit of drama; a mobile session cannot afford a
  0-0.
- Our validation target of **7.0 goals per match (band 6.0-9.0)** and ~0.233 goals/minute
  is a direct consequence. The per-minute rate is the single most important calibration
  constant in the engine.
- Seven slots keeps the pitch legible on a 390pt-wide screen. Twenty-two dots is mush.
- Squad depth stays comprehensible: 18 players, 7 on the pitch, 7 on the bench, 5 subs.

**What it costs us.**
- It is a bet on a market split: the research shows 7v7 and 6v6 both in use. We picked 7.
- **`SIMULATION_REFERENCE_DATA.md` tunes for 6v6 throughout.** The per-minute goal rate
  transfers across both (it is a property of the format's event density, not of the exact
  headcount), but the per-team injury rate does **not** — it is derived from 6 outfield
  players × 0.5 hours of exposure. Injury rates must be recomputed for 7 on the pitch, and
  one denominator (player-hours *or* team-pitch-minutes) must be used everywhere. Recorded
  as `PRODUCT_REQUIREMENTS.md` D8.
- Football-management traditionalists may read it as "not real football".
- Position weighting had to be designed for a shape where `LW`/`RW` are *midfielders* (see
  the `7:2-3-1` formation, where the wide slots carry `role: 'MID'`).

**What changes if wrong.** `SeasonConfigDef.playersOnPitch` and the formation set are data.
`formationsFor(playersOnPitch)` filters by slot count, and 11-a-side formations already
ship *specifically* so that no consumer can assume a squad of seven. Moving to 6-a-side is
authoring four new formations and changing one number. The match model reads squad size
from `MatchConfig`, not from a constant.

**Signal.** Goals per match in live telemetry vs. the 6.0-9.0 band; match-skip rate;
qualitative "does this feel like football" in playtests.

---

## A4 — A single league tier at launch

**Assumption.** One 12-club league, no promotion or relegation, is enough progression
structure for V1.

**Rationale.**
- Progression comes from four other axes: club reputation, facilities, fan base and legacy.
  A tier ladder is a fifth that costs 12 more clubs of content and a second balance curve.
- A single tier means every club in the world is a club the player can meet twice a season,
  which makes rivalries and AI personalities *legible*. In a two-tier world, half the AI
  clubs are strangers.
- The 12 clubs get a genuinely distinct identity each because the content budget is not
  spread across 24.

**What it costs us.**
- The classic manager fantasy of "take a small club up the pyramid" is unavailable.
- `relegationSpots` in `SeasonConfigDef` and the `PROMOTED`/`RELEGATED` domain events have
  no destination. **This is a live discrepancy** — see `PRODUCT_REQUIREMENTS.md` Q3. Either
  set `relegationSpots: 0` at launch, or define a non-tier consequence (budget cut, board
  pressure, sponsor loss) and rename the concept.

**What changes if wrong.** Additive: `Competition.tier` already exists; a second
`Competition` with its own `clubIds` and the existing `PROMOTED`/`RELEGATED` events is a
content pack plus orchestration work. No frozen contract changes.

**Signal.** Do playtesters ask "what's above/below this league?" in the first two sessions?
Does the mid-table plateau (no title race, no relegation fight) produce a churn cluster?

---

## A5 — Single-player V1

**Assumption.** Shipping single-player only is right, and the architecture makes multiplayer
additive rather than a rewrite.

**Rationale.**
- Every multiplayer feature multiplies scope: accounts, servers, matchmaking, anti-cheat,
  moderation, live-ops, support. None of it improves the core loop we are testing.
- The core loop must be proven fun alone before it is worth defending against cheaters.

**What it costs us.**
- No social virality loop at launch. Growth is entirely acquisition + word of mouth.
- The "creator league" premise naturally suggests playing against friends, and we are not
  answering that.

**Why it is additive, not a rewrite.** `ARCHITECTURE.md` §11 walks the mechanisms:
`simulateMatch` is pure and deterministic (server-arbitrable), `computeStandings` is derived
(cannot diverge), `MatchTeam.isPlayerControlled` is already per-side, the ledger is already
an audit log, and the event journal is already append-only with deterministic ids. The
missing pieces are accounts, transport and a league-owned clock — all host concerns.

**Signal.** Frequency of "can I play my friends?" in reviews and playtests; whether the
single-player loop hits its D7/D30 targets at all (if it does not, multiplayer would not
have saved it).

---

## A6 — Fictional-only base content

**Assumption.** The base game contains zero real people, clubs, leagues, sponsors or
broadcasters, and licensed content can only ever arrive as a separately gated pack.

**Rationale.** This is not primarily a creative choice; it is a risk-management one.
- Formats and rules are not protectable expression. Names, logos, crests, kits, likenesses,
  voices, handles and rulebook text are — via copyright, trade mark, passing off and
  personality/NIL rights, which are strong in the UK, Germany, Spain and most US states.
- A licence is a business decision that can be revoked, expire, or be regionally
  constrained. A game whose base content depends on one is a game with a kill switch held
  by someone else.
- The research dossier's guardrail is explicit: *"Build the content pipeline so real
  identities can only ever arrive as a separately gated data pack, never as base content.
  That is the difference between a licence being a business decision and a licence being a
  rewrite."*

**What it costs us.**
- No launch-day name recognition. Marketing has to sell a world nobody has heard of.
- Content cost: 12 clubs, 28 creators, 10 managers, 220+ first names, 220+ surnames, 25
  invented nationalities, 200+ commentary lines, 120+ social templates, 60+ media templates
  all have to be *written*.
- Generated identities risk feeling generic — the mitigation is per-entity personality
  (every creator has a bio; every club has a philosophy, fan culture, motto and declared
  rivals).

**What changes if wrong.** Nothing about the architecture. If the fictional universe fails
to land, the answer is better fiction, not real names. If a licence becomes available, it
loads as a `LICENSED` pack with `RightsMetadata` and a `LicensedEntityBinding` fallback.

**This assumption is not up for revision.** It is a hard constraint. See
`LICENSING_ARCHITECTURE.md`.

---

## A7 — Two to three live decisions is the right amount of match agency

**Assumption.** `MatchConfig.maxDecisions` in the 2-3 range, with prompts never closer than
6 match minutes, delivers agency without micromanagement.

**Rationale.**
- Fewer than 2 and the match is a cutscene; the player is a spectator and will skip it.
- More than 3 in a 30-minute match and the prompts arrive faster than the player can
  contextualise them, which converts a decision into a reflex.
- Every option must have a real encoded downside, so the interesting part is the trade-off,
  not the frequency.

**What it costs us.**
- Players who want continuous control will feel constrained.
- Each prompt has to be *good*, because there are only two or three. A bland prompt is 40%
  of the match's agency wasted.

**What changes if wrong.** `maxDecisions` is a per-match config field, and difficulty could
tune it. If playtests show players want more, raising it to 4-5 costs nothing structurally —
but the prompt-generation quality bar rises with it.

**Signal.** Share of sessions with ≥1 decision made (target ≥80%); the `decision_default_applied`
rate — a high rate means prompts are arriving when the player is not engaged; post-match
`DecisionOutcome.evaluation.verdict` distribution — if `NEUTRAL` dominates, the options are
not real trade-offs.

---

## A8 — Premium purchase plus cosmetic/convenience IAP is viable

**Assumption.** Players will pay up front for a mobile management game, and a store of
cosmetics, convenience and content — with nothing that sells competitive advantage — will
sustain it.

**Rationale.**
- The audience overlaps heavily with people who left free-to-play manager games *because*
  of the monetisation.
- Trust is the moat. A single pay-to-win accusation cluster in reviews would cost more than
  the revenue the mechanic earned.
- The store is data (`StoreOfferDef`), so the model can be retuned without a client update
  once remote content is possible.

**What it costs us.**
- A far smaller top-of-funnel than free-to-play. Every install is a purchase decision.
- No whale revenue. ARPU is capped near the price point plus modest IAP.
- The four-week offer rotation has to feel like curation, not pressure.

**What changes if wrong.**
- **Price too high for conversion:** the store definitions and price points are data;
  a free trial (first season free) is implementable without touching the engine.
- **IAP under-performs:** the honest options are more *content* (packs) and more
  cosmetics — never competitive advantage. Rule cards, in particular, must remain
  objective rewards only (`PRODUCT_REQUIREMENTS.md` Q10).

**Signal.** Refund rate (>6% is a warning); review sentiment clusters mentioning price or
pay-to-win; attach rate on cosmetic vs. convenience SKUs.

---

## A9 — Creators are a first-class parallel system, not a skin

**Assumption.** Modelling creators as their own entity with their own 11 attributes, roles,
tiers and sentiment — feeding fans, sponsorship, media and social rather than the match —
is what makes this game different from a football-management game with influencer art.

**Rationale.**
- The research is unambiguous that the real creator-league economy runs on *audience →
  sponsorship*, not gate or merch. An in-game economy where income scales with audience is
  both authentic and more interesting than a standard club sim.
- `CreatorAttributes` are deliberately disjoint from `Attributes`: `audience`, `engagement`,
  `charisma`, `controversy`, `brandValue`, `loyalty`, `leadership`, `entertainment`,
  `mediaAbility`, `fanConversion`, `commercialAppeal`. Only `leadership` overlaps
  conceptually with the football model, and even that feeds a different system.
- A creator can be a player, a manager, a pundit and an owner simultaneously
  (`CREATOR_ROLES`), which is exactly what happens in the real leagues.

**What it costs us.**
- Two parallel progression systems to balance and to explain. The player must understand
  *why* they would spend money on a creator instead of a striker.
- A whole second content axis (28 creators with real personalities).
- `controversy` is a genuinely double-edged attribute (more reach, more risk), which is
  interesting but hard to communicate on a card.

**What changes if wrong.** If the creator layer reads as a tax rather than a lever, the
first response is *legibility*, not removal: show the follower→sponsor tier chain explicitly
on the creator screen. Removing the layer is not viable — it is load-bearing in the fan
loop, the sponsorship gates and the social feed.

**Signal.** Share of players who have signed a creator by session 5; whether creator spend
correlates with retention; playtest comprehension of "what does this creator do for me?"

---

## A10 — Players will watch matches rather than skip them

**Assumption.** A 90-150 second animated match with 2-3 decisions is watched, not skipped,
by the majority of players for the majority of their first month.

**Rationale.** The match is the payoff for everything else. If it is skipped, the game
becomes a spreadsheet with a random-number generator attached, and every system upstream
loses its meaning.

**What it costs us.** Enormous investment in a renderer, commentary, momentum, key moments
and pacing — for content that a "skip" button makes optional.

**What changes if wrong.** This is the product's most important early signal. If skip rate
is high at D1, the problem is the match, and the response is to fix the match (pacing,
legibility, decision quality, presentation), not to accept the skip. `GameSettings.matchSpeed`
includes `INSTANT` deliberately — the option exists for the player who has already watched
200 matches, not as a way to avoid fixing a boring one.

**Signal.** `match_skipped` / `match_started` ratio, bucketed by session index. Target >65%
watched at D1, >45% at D30.

---

## A11 — Event-generated media and social will read as authored

**Assumption.** Content generated from domain events through weighted templates, with
anti-repetition and token-completeness checks, will feel like a world reacting rather than
a Mad Libs generator.

**Rationale.** The mechanisms in place are stronger than a naive template system:
- A template whose tokens cannot be filled is **never rendered** (`renderTemplate` returns
  `null`). A feed with one fewer line beats a feed saying "{player} was sensational".
- Recently used templates are de-weighted by `REPEAT_PENALTY = 0.04` rather than banned, so
  a small pack still works and a large one never repeats two cycles running.
- Conditions are matched against a published fact vocabulary (`HookFacts`), and an unknown
  fact key **never matches** — a template keyed on facts we do not publish is skipped, not
  fired in the wrong context.
- Volume: 120+ social templates and 60+ media templates against a large trigger space.

**What it costs us.** Authoring volume, and a fact vocabulary that must stay in sync between
the engines that publish facts and the content that keys on them.

**What changes if wrong.** The escalation ladder is: more templates → more conditions (so
lines are more specific to the situation) → per-author voice (a `PROVOCATIVE` creator and a
`WHOLESOME` one must never share a line) → hand-authored responses for the top ~30 highest
frequency triggers. Removing the feed is not an option; it is the primary vehicle for "the
world noticed".

**Signal.** Feed dwell time; repeated-line reports in playtests; the ratio of distinct
rendered strings to posts shown over a 10-cycle window (target > 0.85).

---

## A12 — Heavy glass performs acceptably on target devices

**Assumption.** Four levels of `backdrop-filter` glass (12px to 48px blur, with saturation)
can be composited at 60 fps on our minimum device during normal navigation, and degraded
gracefully during the match.

**Rationale.** The visual language is the premium signal. Without it this is a competent
game that looks free.

**What it costs us.** Blur is the single most expensive thing a mobile GPU does per frame,
and it scales with *area*, not with element count. Stacked glass over an animating pitch is
the worst case in the entire product.

**Mitigations already in the token layer.**
- `prefers-reduced-transparency` collapses every glass level to its solid surface token,
  preserving contrast ratios.
- `[data-reduced-effects='true']` is an in-app setting doing the same thing.
- `motion.ts` forbids animating `backdrop-filter` (sheets translate only).
- `manualChunks` splits `motion` and `vendor` so first paint is not gated on the animation
  library.

**What changes if wrong.** Ladder: (1) cap the number of simultaneously blurred surfaces to
two; (2) disable glass entirely on the match route; (3) render the pitch to canvas;
(4) auto-enable reduced effects below a measured device threshold.

**Signal.** `perf_frame_drop` events; sustained fps during match playback on the bottom 20%
of the device distribution.

---

## A13 — Cycle-based time does not cost retention

**Assumption.** Refusing energy, timers and real-time gates will not measurably hurt
retention, and will help trust and review sentiment.

**Rationale.** The engagement mechanic is the story, not the timer. `GameClock`'s own
comment names this as "the central anti-pattern we are avoiding from live-service managers".

**What it costs us.** No forced daily-return hook. Retention has to be earned entirely by
the loop, which is a much harder standard.

**What changes if wrong.** We will not add timers. If retention underperforms, the levers
are: sharper cliffhangers at session end, better objective pacing, and stronger rivalry
cadence. This is a values commitment as much as a design one — reversing it would cost the
positioning that differentiates us.

**Signal.** D1/D7/D30 against target; sessions per DAU.

---

## A14 — Seeded determinism is worth its constraints

**Assumption.** Banning `Math.random()` and `Date.now()` from the engine, and threading an
`Rng` through every stochastic call site, pays for itself.

**Rationale.** It buys replay, regression tests, balance audits over thousands of matches,
exact bug reproduction, and — critically — server-side arbitration for any future
multiplayer. Without it, "the sim feels wrong" is unfalsifiable.

**What it costs us.**
- Every function that rolls a die takes an extra parameter, forever.
- Sub-stream discipline: `fork(label)` must use unique labels, because two forks with the
  same label from the same parent produce identical streams.
- The seed space is 32-bit (`hashString` returns a `uint32`), so at most ~4.3×10⁹ distinct
  worlds and a non-zero chance of cross-label collisions.
- Byte-identical saves are *not* actually guaranteed, because wall-clock timestamps enter
  the save from the host. See `ARCHITECTURE.md` §6.2.

**What changes if wrong.** Nothing — this one is settled. The residual work is tightening
the guarantee: a lint rule banning `Math.random`/`Date.now` in `packages/engine`, a fixed
clock in the audit harness, and (if world-uniqueness ever matters) a 64-bit seed derivation.

---

## A15 — Twelve clubs is enough world

**Assumption.** A world of 12 clubs, ~216 players (18 × 12), 28 creators and 10 managers is
enough to sustain multiple seasons without feeling small.

**Rationale.**
- Every AI club is met twice a season, so each one's personality (`aiProfileId`,
  `philosophy`, `fanCulture`) has a chance to register.
- 216 players is enough for a transfer market with real scarcity — which is what makes a
  signing feel like winning something.
- Content quality per club is far higher than it would be across 24.

**What it costs us.**
- The transfer market can feel closed: after two seasons the player has seen everyone.
  Mitigations: free-agent generation (`FREE_AGENT_POOL_TARGET`), youth intake, and player
  development changing who is worth buying.
- No newgen intake system is contracted yet. Without one, the world ages out around
  season 8-12 (`PRODUCT_REQUIREMENTS.md` Q6). **This is the most likely reason a long
  dynasty would go stale.**

**What changes if wrong.** `clubCount` is content config; `generateSquad` can produce more
depth per club; a youth-intake generator is additive.

**Signal.** Transfer activity per season over a long save (a decline means the market has
closed); average squad age over 10 seasons in the audit harness (a monotonic rise means no
regeneration).

---

## A16 — English-only at launch

**Assumption.** Shipping English-only is acceptable for the launch market.

**Rationale.** The template volume is the blocker, not the UI strings: 200+ commentary
lines, 120+ social templates, 60+ media templates, plus club mottos, creator bios, trait
blurbs, facility level descriptions and decision option copy. Translating a *template* is
harder than translating a string, because token order and grammatical agreement vary by
language.

**What it costs us.** Spain, Germany and LatAm are the strongest creator-football markets
and the ones we would most want. This is a real, quantifiable revenue cost.

**Known leak.** `formatMoney()` in `economy/ledger.ts` hardcodes `£` and `en-GB` inside the
engine. That is a presentation concern living in the domain layer, and it is the first thing
that has to move when localisation starts. Logged in `RISKS.md` R15.

**What changes if wrong.** Move `formatMoney` to the app layer, parameterise currency and
locale, and treat template packs as localisable content (the `ContentPack` schema already
supports multiple packs and `regions` on the manifest — a `SEASONAL`/locale pack is a
natural fit).

---

## A17 — Data-only content packs; no executable mods

**Assumption.** Content packs are pure data validated by `validatePack()`. No pack may ship
code.

**Rationale.** Executable mods are a security surface (arbitrary code in a shipped app), a
support surface ("the game crashes" — with someone else's code in it), and a determinism
surface (a mod that calls `Math.random()` destroys replay). Data-only packs keep all three
closed.

**What it costs us.** Community creativity is capped at what the schema expresses. A modder
who wants a new *mechanic* cannot have one.

**What changes if wrong.** The schema can grow (new template kinds, new effect keys, new
objective kinds) without opening a code path. That is the intended pressure valve.

---

## A18 — Deep systems will be felt through a shallow surface

**The core product bet.** A player who never opens an attribute table will still *feel* the
difference between a `Workhorse` and an `Injury Prone` player, between a high press and a
low block, between a `Showman` and a `Team Player`.

**Rationale.** Every mechanism is built to surface through consequence rather than through
numbers:
- `keyAttributes()` returns the three attributes that most define a player, so a card shows
  3 numbers instead of 17.
- Every trait has a one-line blurb that *describes the actual effect* ("Covers ground long
  after everyone else has stopped") — a design rule, since a trait with no modifier does not
  ship.
- Every tactical setting's trade-off is stated in prose in `vector.ts` *and* in numbers in
  the same file, with the explicit rule that the two must never disagree.
- Live decision options carry `effect: string` — "one line of plain language: what this
  actually does".
- Scouting shows a *range*, not a number, until the player invests.

**What it costs us.** Every system must be designed twice: once as a model, once as a
sentence. That is expensive, and it is the reason the codebase's comment discipline
("comments explain *why*, never *what*") matters — the "why" is the sentence the player
eventually reads.

**What changes if wrong.** If players report the game as opaque ("things happen and I don't
know why"), the fix is *feedback*, not more numbers: post-match decision evaluation
(`DecisionOutcome.evaluation.verdict` already exists as a type), explicit "because" strings
on sentiment and morale changes (`FAN_SENTIMENT_CHANGED.reason`,
`PLAYER_MORALE_CHANGED.reason` — both already in the event payloads), and named reasons on
special-rule activation (`ActiveSpecialRule.reason`, *"shown to the player so it never feels
arbitrary"*).

If instead players report it as *shallow*, the fix is opt-in depth: an advanced attribute
view, a full ledger view, a full stats screen. All of those are reads of data that already
exists.

---

## Cross-cutting trade-offs

| Trade-off | We chose | We gave up | Where it shows |
|---|---|---|---|
| Determinism vs. convenience | Thread an `Rng` everywhere | Terser call signatures | Every stochastic function |
| Immutability vs. speed | Return new state / deltas | Allocation-free mutation | `WorldTickResult`, `MarketDelta` |
| Data-driven vs. direct | `balance.ts` constant objects | One indirection per read | `TRANSFER_BALANCE`, `WAGE_BALANCE`, `NEGOTIATION_BALANCE`, … |
| Derived vs. stored | Recompute standings, overall, momentum | CPU per render | `computeStandings`, `overallFor` |
| Bounded vs. complete history | Cap the journal at 5000 and the ledger at 4000/1200 | Full-dynasty auditability | `EventBus`, `Ledger`; mitigated by `LegacyState` rollups |
| Typed rigour vs. velocity | `strict` + `noUncheckedIndexedAccess` + branded ids | `as T` assertions at hot-loop sites | `Rng`, `standings`, `formations` |
| Purity vs. ergonomics | Engine imports nothing platform-specific | Ports and adapters for storage, analytics, haptics | `StorageAdapter`, `setAnalyticsSink`, `setHapticDriver` |
| Contract-first vs. explore-first | Freeze types, parallelise six workstreams | Harder to change a shared type mid-flight | `INTEGRATION_CONTRACT.md` frozen files |
