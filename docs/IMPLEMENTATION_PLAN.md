# IMPLEMENTATION PLAN — Creator Football to shippable

**Basis:** `docs/CURRENT_STATE_AUDIT.md` (P1–P14), `docs/AUDIT_ARCHITECTURE.md` (F1–F30),
`docs/AUDIT_GAMEPLAY.md` (G1–G21), `docs/AUDIT_UX.md` (F1–F25). Where an item closes a finding from
another document it is cited by ID (`A-Fn` architecture, `G-Gn` gameplay, `U-Fn` UX, `P-Pn` product).

**Effort unit:** one engineer-day. Estimates assume familiarity with the codebase.
**Done criterion:** every item states an objective test — a measurement, an assertion, or a
CI gate. "Looks better" is not a done criterion and does not appear below.

**Sequencing principle.** Value per unit of effort, with one override: anything that makes the
product *lie to the player* outranks anything that makes it prettier, because a manager game is a
machine for making numbers trustworthy and a single visible lie discounts every number beside it.

---

## Tier 0 — Must fix before anyone outside the team sees this

Twelve items, **17 days**. Everything here is either a visible falsehood, a broken core loop, or a
defect that would end a demo. Nothing here is a redesign.

| # | Item | Closes | Effort | Depends on |
|---|---|---|---|---|
| 0.1 | Round deltas by default in the number kit | P5 | 0.5 | — |
| 0.2 | One name for the unit of time | P4 | 1 | — |
| 0.3 | Gate narrative framing on sample size | P2 | 1 | — |
| 0.4 | Fix objective progress semantics | P3 | 1 | — |
| 0.5 | Content quality gate on records and templates | G8, G9, P-§2.14 | 2 | — |
| 0.6 | Fix the boot/deep-link guard | P9 | 0.5 | — |
| 0.7 | Tab bar fits 375px | P8 | 0.5 | — |
| 0.8 | Decision panel tells the truth about auto-pick | U-F17 | 0.5 | — |
| 0.9 | MOTM: right club, right kit | P6 | 0.5 | — |
| 0.10 | Portrait hair correlates with age | P7 | 0.5 | — |
| 0.11 | Break the dominant tactic | G1 | 4 | — |
| 0.12 | Stop the world ageing to death | G2 | 5 | season rollover (landed) |

---

### 0.1 — Round deltas by default in the number kit *(0.5d)*

**What.** In `apps/game/src/design/domain/numbers.tsx:173`, change
``const text = format ? format(delta) : `${up ? '+' : ''}${delta}`;`` so the default path rounds
to at most one decimal. Audit the ~30 `StatCard`/`TrendIndicator` call sites for any that were
silently relying on raw output.

**Why.** `-8.157399521093865` currently renders twice on the post-match screen, which is the
screen a player sees after every match. It is the cheapest possible credibility loss in the product.

**Files.** `design/domain/numbers.tsx`, `design/domain/StatCard.tsx`,
`features/matchday/result/MatchResultScreen.tsx:494,498`.

**Done when.** A unit test asserts `TrendIndicator` renders at most one decimal for
`delta = -8.157399521093865`, **and** a Playwright assertion over all 14 primary routes finds zero
text nodes matching `/-?\d+\.\d{3,}/`.

---

### 0.2 — One name for the unit of time *(1d)*

**What.** Pick one word — the docs and the engine field names both point at **week**; the engine's
internal `cycle` is an implementation detail and should never surface. Then:
rename every player-facing string, and add a lint rule banning the literal `cycle` in
`apps/game/src/features/**/*.tsx`.

**Why.** `ClubScreen.tsx:258` says "£78.6K of wages **a week**" and `SquadScreen.tsx:270` says
"£78.6K **a cycle** in wages" about the same number, one tab apart. `SquadScreen.tsx:101/103`
renders `63w` inside an element whose `title` says "63 cycles remaining". A player cannot build a
mental model of an economy whose clock has three names.

**Files.** `features/club/{ClubScreen,FinancesScreen,SponsorsScreen,FacilitiesScreen}.tsx`,
`features/squad/{SquadScreen,PlayerProfileScreen,TrainingScreen}.tsx`,
`features/progression/ObjectivesScreen.tsx`, `features/market/*`, `eslint.config.js`.

**Done when.** `grep -rn "cycle" apps/game/src/features --include=*.tsx` returns only identifiers,
never a string literal shown to a player; and `pnpm lint` fails if one is added back.

---

### 0.3 — Gate narrative framing on sample size *(1d)*

**What.** In `features/home/priority.ts` and wherever the league-position narrative is generated,
suppress survival / playoff / title framing until at least 6 matchweeks have been played. Below the
threshold, state the neutral truth: "Matchweek 2 of 22. Nothing is decided yet."

**Why.** The largest text on the Home screen currently reads *"You are in the drop zone. Every
point from here is survival."* after one match of twenty-two. Window A produced the equally broken
*"One win from 3rd. Only 0 clear of 5th."* at matchweek 0 with nothing played. A first session that
opens by telling the player they are being relegated is a first session that ends.

**Files.** `features/home/priority.ts`, `features/home/status.tsx`,
`features/league/LeagueScreen.tsx`, `features/matchday/preview/MatchPreviewScreen.tsx`.

**Done when.** A test that constructs saves at matchweek 0, 1, 3, 6 and 15 asserts no output string
matches `/drop zone|survival|relegation|playoff|title race/i` below matchweek 6, and that at least
one does at matchweek 15.

---

### 0.4 — Fix objective progress semantics *(1d)*

**What.** Add an inverted/target progress variant for position-type objectives so 12th → 6th shows
a bar filling *toward* the target rather than a full bar for the worst possible outcome. Separately,
suppress objectives whose precondition cannot be met (empty `youthSquad`).

**Why.** "Finish in the top half — Sixth or better" currently renders **"Progress 12 / 8" with a
100%-full volt bar** while the club sits 12th of 12. Combined with `G-G19` (two of the other three
objectives permanently unachievable), three of the four objectives a new player sees are false.

**Files.** `features/progression/ObjectivesScreen.tsx`, `features/progression/engine.ts`,
`design/domain/bars.tsx`.

**Done when.** A test asserts that for a club 12th of 12 with a "top half" target, rendered progress
is ≤ 20%, and that objectives referencing the academy are absent when `youthSquad` is empty.

---

### 0.5 — Content quality gate on records and templates *(2d)*

**What.** Three rules in the content layer:
1. **Record threshold.** No `record` event or press template fires below a meaningful bar (e.g. a
   season record needs ≥ 5 of the quantity, and a "stood for a generation" variant needs ≥ 3
   completed seasons of history to have stood through).
2. **Token type-safety.** A template slot typed `player` must reject a club entity at fill time and
   fail loudly in dev rather than substituting silently.
3. **Repeat cap.** No template id may fire more than twice per matchweek across social + media.

**Why.** The first feed a player ever sees currently contains *"Keldar breaks a record that stood
for a generation — it had survived four managers, two relegations and a rebuild"* about one goal at
a club founded this year, and *"A club record. Northgate Rovers writes **his** name into the history
of Northgate Rovers."* `G-G8` measures record posts at 25% of all press in a season. The living
world is this product's differentiator and it is currently its most embarrassing surface.

**Files.** `packages/engine/src/content/**`, `packages/engine/src/progression/legacy.ts` (record
detection), `apps/game/src/features/social/data.ts`.

**Done when.** A one-season headless run asserts: zero press items referencing a record with an
underlying count < 5; zero rendered strings where a `player` slot resolved to a club id; and no
template id exceeding 2 uses in any single matchweek.

---

### 0.6 — Fix the boot/deep-link guard *(0.5d)*

**What.** In `app/router.tsx`, `RequireGame` must render `<ScreenFallback/>` while
`phase === 'BOOTING'` and only redirect on `NO_SAVE` / `ERROR`. On arriving at `/onboarding` with
`state.from`, resume to that route once boot completes.

**Why.** `gameStore.ts:21` defines `GamePhase = 'BOOTING' | 'NO_SAVE' | ...`; the guard tests only
for `READY`, so a deep link rendered before boot resolves is thrown to the title screen with
`replace` — destroying the history entry so the player cannot go back. Observed once in 27 loads,
which is exactly the frequency that makes it un-diagnosable in the wild. The `state.from` the guard
already passes has no consumer anywhere in the codebase.

**Files.** `app/router.tsx`, `features/onboarding/TitleScreen.tsx`.

**Done when.** A test mounts the router with `phase: 'BOOTING'` at `/squad` and asserts the URL is
still `/squad`; a Playwright loop of 40 cold deep-links across all 14 routes records zero bounces.

---

### 0.7 — Tab bar fits 375px *(0.5d)*

**What.** The tab `<ul>` measures 11px wider than a 375px viewport on every screen; the "Social"
button clips by 7px, taking its "9+" badge with it. Reduce horizontal padding, allow the label to
shrink one step below 390px, or drop to icon-only under 380px.

**Why.** It is the global navigation, on the second-most-common phone size, on every screen.

**Files.** `design/layout/TabBar.tsx`.

**Done when.** At 320, 360, 375 and 393px, every tab's `getBoundingClientRect().right ≤ innerWidth`
and `document.documentElement.scrollWidth === innerWidth`, asserted in CI.

---

### 0.8 — Decision panel tells the truth about auto-pick *(0.5d)*

**What.** `DecisionOverlay.tsx:196` marks `AUTO PICK` on `decision.defaultOptionId`, while the
footer hard-codes *"the bench makes the **safe** call for you."* Either make the engine's default
always the lowest-risk option, or replace the footer with the actual option's label. Also separate
`{option.durationMinutes} min` from the countdown ring visually — currently "7 MIN" sits beside a
ring reading "8".

**Why.** This is the best component in the product and it currently promises safety while pointing
at the option tagged `GAMBLE` (`iphone-live-t5.png`).

**Files.** `features/matchday/live/DecisionOverlay.tsx`, `packages/engine` decision generation.

**Done when.** A test asserts, for every generated decision, that the option carrying `AUTO PICK`
has the minimum `risk` among its options.

---

### 0.9 — MOTM: right club, right kit *(0.5d)*

**What.** `MatchResultScreen.tsx:344` computes `kit` from the player's own club unconditionally,
and `:356` selects `motm` without filtering by club. Resolve the MOTM's actual club and pass its
kit; label opposition MOTMs as such.

**Why.** The captured match presents Aurelia's Noah Pedersen in a volt panel, wearing the Northgate
shirt, at the top of the Northgate ratings list.

**Files.** `features/matchday/result/MatchResultScreen.tsx`.

**Done when.** A test with an opposition MOTM asserts the rendered kit colours equal that
opposition club's kit.

---

### 0.10 — Portrait hair correlates with age *(0.5d)*

**What.** `PlayerPortrait.tsx:29–32` picks uniformly from a `HAIR_COLORS` array containing `#7d7d7d`
and `#c9c9c9` with no reference to age. Weight grey/white by age (effectively zero below ~30), and
thread `player.age` into the seed-derived features.

**Why.** In `iphone-after-result-s1.png`, five consecutive players aged 25–28 are grey-haired. It is
the most visible single artefact of the "prototype" feel, and it is on every list in the game.

**Files.** `design/domain/PlayerPortrait.tsx`, its call sites in `PlayerCard.tsx` and
`MatchResultScreen.tsx`.

**Done when.** Over 216 generated players, fewer than 2% under age 30 receive a grey or white hair
colour, asserted in `design/seed.test.ts` (which also needs to actually run in CI — see 1.9).

---

### 0.11 — Break the dominant tactic *(4d)* — `G-G1`

**What.** `HIGH_PRESS` + `HIGH` line + `NARROW` wins 71.2% against an identical squad on defaults
(39.8% baseline, n=1200 CRN) — worth ~20 overall points in a league whose whole competitive range is
25.4 points. Add the counters the model is missing: stamina cost to sustained high press, the
long-ball/pace exploit against a high line, and a width counter to narrow.

**Why.** A dominant strategy with no counter means every long-term player converges on one dropdown
and the tactical system — the reason the genre exists — becomes decorative.

**Files.** `packages/engine/src/match/**`, `tools/sim`.

**Done when.** A CRN sweep at n ≥ 1200 shows no single-axis setting exceeding +0.25 ppg over
default and no stacked configuration exceeding 55% win rate against an identical squad.

---

### 0.12 — Stop the world ageing to death *(5d)* — `G-G2`

**What.** No player is ever created, promoted or retired. Over 12 seasons mean age goes 26.3 → 34.4
and the squadded population collapses 216 → 78. Add youth intake, retirement, and AI-club squad
replenishment at the season boundary (`game/seasonRollover.ts`, which landed during the gameplay
audit, is the hook).

**Why.** It is the difference between a game and a demo. It also unblocks the academy objectives
(`G-G19`), the youth-focus training programme, and the "Youth Academy" club identity — three
features currently shipping with no data behind them.

**Files.** `packages/engine/src/game/seasonRollover.ts`, `simulation/worldTick.ts`,
`packages/engine/src/players/**`.

**Done when.** A 12-season headless run holds mean squad age within 25–28, keeps squadded players
≥ 200, and produces > 0 retirements and > 0 youth promotions every season.

---

## Tier 1 — Makes it excellent

Ten items, **26 days**. Tier 0 makes it honest; Tier 1 makes it feel like a product someone chose
to build rather than assembled.

| # | Item | Closes | Effort | Depends on |
|---|---|---|---|---|
| 1.1 | Rebuild manager creation archetype-first | P-§2.2, U-F5/F6/F23 | 3 | — |
| 1.2 | Fill the live match's empty half | P-§2.8, U-F10 | 3 | — |
| 1.3 | Title screen hero | P-§2.1, U-F22 | 2 | — |
| 1.4 | Seed the world so day one is not empty | P1 | 3 | 0.5 |
| 1.5 | Club reveal as the loudest three seconds | P-§2.4 | 1.5 | — |
| 1.6 | `/squad` as a team sheet | P-§2.11 | 3 | — |
| 1.7 | Fix the goal hero and the celebration | U-F3, U-F4 | 1.5 | — |
| 1.8 | Promote "Your calls" | P-§2.9 | 1 | — |
| 1.9 | Ship gates: prod smoke test, viewport CI, gallery gating | U-F1, A-F24, P-§2.18 | 2 | 0.7 |
| 1.10 | Player profile gets a sentence | P-§2.12 | 3 | 0.12 |
| 1.11 | Store shows the products | P13 | 2 | — |
| 1.12 | Type/token cleanup: scale, position chips, 11px floor | U-F7/F8/F24 | 1 | — |

**1.1 Rebuild manager creation archetype-first.** Archetype as a full-screen first choice; name
second; all appearance collapsed behind one "Customise your look" sheet with a good default already
applied. **Done when** the creation flow's total `scrollHeight` at 393×852 is under 2,000px (from
4,263px) and fewer than 10 numbers appear before the archetype choice (from 35).

**1.2 Fill the live match's empty half.** The feed panel is ~830px tall holding one sentence at 4′.
Put live shots, possession, xG and a momentum trace under the pitch, with the last three feed events
always visible. Data already exists in `useLiveStats.ts`. **Done when** at 393×852, no contiguous
vertical region of the live screen exceeding 220px is empty at any point in a full match, measured
by sampling five frames.

**1.3 Title screen hero.** A slow-panning procedural crowd/pitch scene behind the wordmark, from the
same seed system the badges use, plus a "Continue as {manager}" row when a save exists. **Done when**
no contiguous empty vertical region exceeds 200px at 393×852, 834×1194 and 1440×900.

**1.4 Seed the world so day one is not empty.** Ten of fourteen screens open on an empty state.
Before the first whistle the world should already have: a pre-season press round-up, three transfer
rumours, two creator posts about the new manager, and last season's league table as history.
**Done when** a fresh save shows an empty state on ≤ 3 of the 14 primary screens, measured by the
same probe used in the audit.

**1.5 Club reveal as the loudest three seconds.** Crest assembling from its parts, kit stripe wipe,
ground name typed in, one crowd swell — using `design/hero/{moments,effects}.tsx`. **Done when** the
reveal runs ≥ 2.5s of choreographed motion with a skip affordance, at ≥ 55fps on the reference
device profile.

**1.6 `/squad` as a team sheet.** Default to the current shape — seven starters in formation, bench,
out-of-squad collapsed — with the flat list behind a toggle. Fix the two identical unlabelled sort
icons and the unexplained `—` column while in there. **Done when** the default view shows the
starting seven positionally and every icon-only control has an accessible name.

**1.7 Fix the goal hero and the celebration.** `U-F3` measures the goal wordmark at 1.74:1 when you
score and 1.25:1 when you concede — invisible — and `U-F4` finds the same code path fires
`haptics.celebrate()` when the opposition scores. **Done when** the goal treatment measures ≥ 4.5:1
in both cases and a test asserts celebration haptics fire only for the player's club.

**1.8 Promote "Your calls".** Move it from the fourth band of the result cascade to the second,
directly after the scoreline. It is the most original thing in the product and it is currently
below a ratings list. **Done when** it appears above "How they played" in the reveal order.

**1.9 Ship gates.** (a) A CI step that loads the **production** build headlessly and fails on any
`pageerror` — `U-F1` was a 100%-of-users dead build that no unit test could catch. (b) A CI step
asserting `scrollWidth === innerWidth` at 320/360/375/393/834/1440 on all 14 routes. (c) Gate
`/design` and `/dev/gallery` behind `import.meta.env.DEV`. (d) Add `apps/game` tests to the root
`test` script — `design/seed.test.ts` has never run in CI (`A-F24`). **Done when** all four gates
are in `.github/workflows` and a deliberately reintroduced overflow fails the build.

**1.10 Player profile gets a sentence.** One generated line — how he arrived, what he is for, what
he has done for you — plus real content behind Personality / History / Relationships. Depends on
0.12 for players to *have* a history. **Done when** no accordion section on the profile renders a
"0 <noun>" empty label for a player with ≥ 1 completed season.

**1.11 Store shows the products.** Render actual kits, badges and ground treatments with the
existing procedural pipeline instead of flat coloured circles. **Done when** every catalogue item
renders a preview of the thing being sold.

**1.12 Type/token cleanup.** `U-F8`: 25 distinct px sizes, the two most-used not in the system.
`U-F7`: four semantic tokens spent on position chips at 3.88:1. `U-F24`: 9px and 10px text below
the system's own 11px floor. **Done when** a token lint pass finds no font-size outside the scale
and no player-facing text below 11px.

---

## Tier 2 — V2

Valuable, none of it blocking. Listed for sequencing, not estimated in detail.

- **Creators as a real system.** The game is named after them; `/club` says "None attached yet" and
  Home offers no path to one. This is the differentiator and it is currently a stub.
- **Desktop as a designed surface.** Decide what the second column is *for* (a persistent league
  table? the feed? the fixture list?) rather than three rows and 600px of air.
- **Tactical depth.** `G-G3` (`volatility` has zero consumers), `G-G4`/`G-G5` (15 of 22 traits
  inert, `Aerial Threat` fully inert), `G-G17` (5 of 11 axes insignificant). Either make them
  matter or remove them from the UI — a dropdown that does nothing is worse than no dropdown.
- **Transfer market that rewards judgement.** `G-G6` (hijack is a dice roll ignoring your offer,
  the modal outcome at 47.1% even at 150% of asking) and `G-G7` (nothing affordable improves the
  starting seven). Until both are fixed the market is a screen, not a system.
- **Match balance.** `G-G10`: mean 7.77 goals, p95 = 14, max 21. Every result reads as a collapse,
  which is why the press writes "Collapse:" as its normal headline.
- **Save durability.** `A-F7` (~1.75 MB after one season, ~4.8 MB projected at season 20),
  `A-F8` (quota failure hides the save, rejection swallowed), `A-F9` (concurrent save race).
  Not user-visible today; catastrophic when it is.
- **Performance.** `A-F6` (advance-week blocks ~245ms desktop, ~1s on phone), `A-F14` (O(n²) state
  copying). Move the cycle to a worker.
- **Mobile shell.** `A-F17`: Capacitor is not a dependency; `capacitor.config.ts` imports a package
  that is not installed and is never typechecked. There is no mobile build today.
- **Accessibility.** `U-F14` (no reduced-transparency fallback on `chrome-surface`), `U-F15` (all
  type in px, so OS text scaling does nothing), `U-F25` (focus ring mechanism).
- **Rule cards, half-time talks, special rules.** `G-G11`, `G-G12` (fires in 0.5% of matches),
  `G-G20` — three authored features that effectively never reach the player.

---

## If there were only two weeks

Ten working days. **Cut Tier 1 entirely except 1.9, and cut the two large engine items from
Tier 0.** The goal of a two-week window is not a better game; it is a product that does not
embarrass itself in a demo and does not lie to the person playing it.

**Ship (9.5 days):**

| Day | Items |
|---|---|
| 1 | 0.1 round deltas · 0.6 boot guard · 0.7 tab bar · 0.8 auto-pick |
| 2 | 0.9 MOTM · 0.10 hair · 0.2 unit of time (start) |
| 3 | 0.2 unit of time (finish) · 0.3 sample-size gating |
| 4 | 0.4 objective progress · 1.9a production smoke test |
| 5–6 | 0.5 content quality gate |
| 7 | 1.9b–d viewport CI, gallery gating, apps/game tests in CI |
| 8–9 | 1.2 fill the live match's empty half |
| 10 | Regression pass across all 14 routes at 4 viewports; re-run the audit probes |

**Explicitly cut, and why:**

- **0.11 dominant tactic** and **0.12 world ageing** — 9 days between them, and neither is visible
  in a 20-minute demo. They are the two most important items for a *shipped* game and the two least
  important for a *seen* one. They move to the top of week three.
- **1.1 manager creation rebuild** — 3 days, and mitigable for free by making the disabled CTA
  scroll to the field it names (2 hours). Take the mitigation, defer the rebuild.
- **1.3 title hero** and **1.5 club reveal** — the highest ratio of perceived polish to effort in
  the whole plan, and still cut, because a title screen that looks expensive in front of a game that
  says you are relegated after one match is worse than an honest game with a plain title screen.
- **1.4 seed the world** — 3 days. Partially mitigated for free by 0.5, which stops the empty
  world from filling with nonsense the moment it does fill.
- **1.6 `/squad` team sheet**, **1.10 player sentence**, **1.11 store previews** — all real, none
  urgent.

**What two weeks buys.** Every number on screen is either correct or absent. The game no longer
tells a week-one manager they are being relegated. The first feed a player reads is not about a
record that stood for a generation being broken by one goal. The core screen is no longer half
empty. And there are four CI gates that stop all of it coming back — which matters more than any
single fix, because this repo's demonstrated failure mode is not bad work, it is good work in six
parallel streams with nothing measuring the seams.

---

## Dependency graph (the parts that are not independent)

```
0.5 content gate ──────────────► 1.4 seed the world
0.12 world ageing ─────────────► 1.10 player profile sentence
                   └───────────► (unblocks G-G19 academy objectives, 0.4)
0.7 tab bar ───────────────────► 1.9b viewport CI
0.11 dominant tactic ──────────► Tier 2 match balance (G-G10)
```

Everything else in Tier 0 is independent and can be parallelised across as many engineers as are
available. Tier 0 items 0.1, 0.6–0.10 are six half-day fixes with no dependencies at all: one
engineer, three days, closes six findings across three audits.

---

*Written 2026-08-20. Effort estimates are for the tree as measured on that date; the repo is under*
*active parallel development and two findings cited here were fixed while the audits were running.*
