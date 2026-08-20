# AUDIT TWO: GAMEPLAY

**Subject:** Creator Football, `packages/engine` + `apps/game` as of this commit.
**Method:** the real engine, run headless through `tools/sim`. Every number below comes from
a script that was run against `simulateMatch` / `advanceCycle`, not from reading code and
guessing. Scripts are described inline; they were deleted after the run, per the audit brief.
**Statistical method:** tactical comparisons use **common random numbers** — the same match
seed sequence for every configuration — so differences are paired and the standard error is
reported. Without CRN the noise floor at n=800 is ±0.08 points-per-game, which is larger
than most of the effects being measured; several of the results below would be invisible
under naive sampling.

---

## Executive summary

The thirty-minute match is genuinely good — it has a real dramatic arc, its two swing windows
spike event density 2-5×, and the live decisions measurably change results — and it is sitting
underneath a tactical system that one dropdown breaks open: `HIGH_PRESS` + `HIGH` line + `NARROW`
wins **71.2%** against an identical squad on defaults, worth roughly **twenty overall points of
squad quality** in a league whose entire competitive range is 25.4 points, with no counter except
playing it yourself. It will not still be fun in season five, because by then the world is dying:
the game contains exactly 216 footballers, creates none, promotes none, and retires none, so mean
squad age climbs one year per season until by season eight the league has no player under
twenty-five and by season twelve seventy-eight players are shared between twelve clubs. Around
both of those, the systems that are supposed to give the player agency between matches do not:
nothing in the affordable transfer market improves the starting seven, a full season of training
moves a prospect two overall points, fifteen of twenty-two traits have no measurable match effect,
and a quarter of everything the press writes in a season is the same record headline.

**Two caveats on timing.** A parallel workstream was actively editing `game/cycle.ts`,
`game/newGame.ts` and `transfers/balance.ts` while this audit ran, and added
`game/seasonRollover.ts` mid-way through. Two findings that were true when this audit started —
that there was no season two at all, and that the transfer budget hit £0 by week 5 with £2.4M of
debt by week 22 — have since been fixed and are recorded here only as history. Everything stated
as a current finding was re-measured against the code as it stands. The match engine, tactics,
traits, negotiation logic, `worldTick` and `legacy` files were **not** touched during the audit,
so every result in G1, G3, G4, G5 and the special-rule section is against unchanged code.

## Findings

| ID | Title | Severity | The measurement |
|---|---|---|---|
| **G1** | `HIGH_PRESS` + `HIGH` + `NARROW` is a dominant strategy worth ~20 overall points | **Critical** | 71.2% W vs identical squad on defaults (39.8% baseline), n=1200 CRN |
| **G2** | The world ages to death: no player is ever created | **Critical** | 12 seasons: mean age 26.3 → 34.4, 0 retirements, 0 promotions, squadded 216 → 78 |
| **G3** | `volatility` is a tactic dimension with zero consumers | **High** | 14 write sites, 0 read sites in the match model; shown in the UI as "Swinginess" |
| **G4** | Four trait modifier keys are dead; `Aerial Threat` is a fully inert trait | **High** | Δppg 0.000, SE 0.000 across 1,200 matches at both importance levels |
| **G5** | 15 of 22 traits have no measurable match effect even at squad-wide saturation | **High** | \|z\| < 2 for 15 traits, n=1,200 per cell |
| **G6** | Transfer hijack is a dice roll that ignores your offer; it is the modal outcome | **High** | 47.1% HIJACKED at 150% of asking price; 45–66% across all offer levels |
| **G7** | Nothing the player can afford improves the starting seven | **High** | Best affordable signing 61 overall; weakest starter 60; best on market 96 at £44M |
| **G8** | Record detection fires every week; 25% of all press is record spam | **High** | 64/253 headlines and 68/396 posts are the same four records, in one season |
| **G9** | Token substitution puts club names in player slots | **Medium** | "Cinderwick Town writes **his** name into the history of Cinderwick Town" |
| **G10** | 1 in 7 league matches is a 12+ goal blowout | **High** | 1,056 in-game matches: mean 7.77 goals, p95 = 14, max 21, margin max 17 |
| **G11** | Rule cards are never consumed from the save, and the AI can never hold one | **Medium** | `MatchLiveScreen.tsx:193` decrements React state only; `matchSetup.ts:58` |
| **G12** | The half-time team talk fires in 0.5% of matches | **Medium** | 4 HALFTIME_TALK prompts per 800 matches; 3-prompt budget spent by minute 15 |
| **G13** | Live decisions matter, but "always take option 2" is worth +0.265 ppg | **Medium** | z = 4.33, n=800 per policy, identical seeds |
| **G14** | High-frequency commentary pools are tiny: 7 lines for 38 events/match | **Medium** | POSSESSION_CHANGE: 7,471 lines emitted, 7 distinct across 200 matches |
| **G15** | A full season of training moves a prospect +2 overall | **Medium** | 22 cycles, minutesShare 0 → +0, 0.70 → +2; saturates at 0.70 |
| **G16** | The starting league is a two-tier gap, not a league | **Medium** | 25.4 overall points between best and worst starting XI in a 12-team league |
| **G17** | 5 of 11 tactical axes have no significant effect | **Medium** | tempo, passing, buildUp, counter, subStrategy all \|z\| < 2 at n=1500 |
| **G18** | `autoLineup()` silently resets all eleven instructions to default | **Low** | Returns `{...DEFAULT_TACTICS, ...}`; a footgun that cost this audit two runs |
| **G19** | Two of three live objectives are permanently unachievable | **Medium** | "Raise a prospect 0/6", "Play the academy 0/2" — every `youthSquad` is empty |
| **G20** | Rule windows run at 1.5× normal goal rate against a 2-4× target | **Medium** | 0.189 → 0.288 goals/min; `enabledSpecialRules: []` silently falls back to SUDDEN_SPARK |
| **G21** | The event stream is 9 events per match minute; 60% are importance 1 | **Medium** | 240.6 events/match, 145 at importance 1; 34 shots and 12 saves per match |

---

## G1 — THE DOMINANT STRATEGY: `HIGH_PRESS` + `HIGH` line + `NARROW`

**Severity: Critical.** This is the finding that matters most.

### The measurement

Script: two independently generated 65-overall squads, 2-3-1, neutral venue, `homeAdvantage: 0`,
no live decisions. Every configuration plays **the identical sequence of match seeds** (common
random numbers), and the tactic under test is carried by each squad in each slot in turn so
neither squad strength nor side can leak in. Paired standard errors reported.

Single-axis sweep against the `BALANCED` default, n = 1,500 per cell (replicated at n = 2,000
with the same result to within 0.02 ppg):

| setting | ppg | Δ vs default | SE | z |
|---|---|---|---|---|
| **press = HIGH_PRESS** | **1.961** | **+0.535** | 0.046 | **+11.65** |
| line = HIGH | 1.737 | +0.311 | 0.044 | +7.12 |
| width = NARROW | 1.591 | +0.166 | 0.039 | +4.23 |
| marking = MAN | 1.589 | +0.163 | 0.042 | +3.86 |
| risk = CAUTIOUS | 1.521 | +0.095 | 0.042 | +2.26 |
| focus = CENTRE | 1.497 | +0.072 | 0.034 | +2.10 |
| *(default)* | 1.425 | — | — | — |
| risk = BOLD | 1.331 | −0.094 | 0.039 | −2.44 |
| risk = RECKLESS | 1.335 | −0.091 | 0.044 | −2.04 |
| width = WIDE | 1.241 | −0.185 | 0.041 | −4.52 |
| line = DEEP | 1.209 | −0.216 | 0.040 | −5.37 |
| press = MID_BLOCK | 1.239 | −0.187 | 0.040 | −4.63 |
| **press = LOW_BLOCK** | **0.944** | **−0.481** | 0.045 | **−10.61** |

Stacked, n = 1,200 CRN, and then benchmarked against the squad-quality curve measured the same
way (opponent always a 65-overall squad on defaults; **no squad permutation** in this table, so
quality is real):

| configuration | win % | ppg | GF | GA |
|---|---|---|---|---|
| default tactics, squad −20 overall | 15.7% | 0.566 | 1.96 | 4.39 |
| default tactics, squad −10 overall | 27.8% | 0.956 | 2.51 | 3.81 |
| **default tactics, squad equal** | **39.8%** | 1.332 | 2.95 | 3.13 |
| default tactics, squad +5 overall | 48.3% | 1.598 | 3.34 | 2.93 |
| default tactics, squad +10 overall | 53.9% | 1.746 | 3.60 | 2.65 |
| default tactics, squad +15 overall | 63.1% | 2.009 | 4.09 | 2.50 |
| **HIGH_PRESS only, squad equal** | **57.3%** | 1.827 | 3.67 | 2.71 |
| **HIGH_PRESS + HIGH + NARROW, squad equal** | **71.2%** | 2.233 | 4.63 | 2.37 |
| press stack, squad −10 overall | 56.2% | 1.811 | 3.92 | 2.89 |
| press stack, squad −15 overall | **49.5%** | 1.611 | 3.53 | 3.09 |
| press stack, squad −25 overall | 31.8% | 1.075 | 2.73 | 3.76 |

**Read the two bold rows together.** A team with the press stack and a squad **fifteen overall
points worse** than its opponent wins 49.5% — more than a team with equal squads and default
instructions (39.8%). Interpolating the quality curve, the three dropdown changes are worth
**roughly +20 overall points of squad quality**. The spread between the best and worst starting
XI in the shipped twelve-club league is 25.4 points, so the tactical exploit is worth about
eighty percent of the entire competitive range of the game.

### There is no counter

The press stack was played against every combination of the opponent's press and line
(n = 1,200 each):

| opponent | press stack win % |
|---|---|
| LOW_BLOCK / DEEP | 88.0% |
| MID_BLOCK / NORMAL | 78.7% |
| BALANCED / NORMAL (the default) | 75.3% |
| BALANCED / HIGH | 69.8% |
| HIGH_PRESS / NORMAL | 58.4% |
| **HIGH_PRESS / HIGH (the best available counter)** | **51.5%** |
| mirror (press stack vs press stack) | 45.1% |

The only defence against the press stack is the press stack. Every other answer loses. This is
the textbook shape of a solved game: one strategy, no counter, and every other branch of the
decision tree is strictly worse. The design comment in `tactics/tactics.ts` states the intent
precisely — *"If a setting only ever helps, it is a bug in the design."* `HIGH_PRESS` only ever
helps.

### Why it happens — three separate causes

**1. The fatigue bill never comes due.** `HIGH_PRESS` raises `pressRecovery` from 0.5 to ~0.80,
a 60% increase in the press term of `turnoverChance`. Its stated price is `fatigueRate: +0.24`.
Measured end-of-match stamina of the starting XI over 200 matches:

```
default tactics                                     mean stamina 74.3   lowest 45.0
HIGH_PRESS                                          mean stamina 66.7   lowest 25.3
HIGH_PRESS + FRANTIC + RECKLESS + MAN               mean stamina 50.7   lowest  3.0
LOW_BLOCK                                           mean stamina 68.7   lowest 52.0
```

`FATIGUE_ATTR_PENALTY` is 0.30, so the 7.6-point stamina gap between `HIGH_PRESS` and the
default costs about **2.3% of effective attributes** across the match. A 60% buff for a 2.3%
tax is not a trade-off. Thirty minutes is simply too short for fatigue to be a price.

Note the fourth line: `LOW_BLOCK` ends the match **more tired than the default** (68.7 vs 74.3),
because surrendering possession triggers `FATIGUE_OUT_OF_POSSESSION` (+25% drain) for more of
the match than the −0.12 `fatigueRate` saves. The low block's advertised benefit — cheap on
legs — is inverted in practice.

**2. The high line has no downside implemented.** `LINE.HIGH` sets `spaceBehind: +0.21`, which
the docs describe as *"every ball over the top is a one-on-one."* `spaceBehind` has exactly two
consumers in the whole repo:

```ts
// matches/model.ts:561 — exported, ZERO callers
export function spaceInBehind(defenceVector: TacticVector): number {
  return clamp01(defenceVector.spaceBehind);
}

// matches/simulator.ts:717 — the only live read
if (finalThird && this.rng.chance(
  BALANCE.OFFSIDE_RATE * (1 + BALANCE.OFFSIDE_LINE_WEIGHT * vd.spaceBehind),
)) { /* offside flagged against the attacking team */ }
```

Measured: moving from `DEEP` to `HIGH` changes offsides from 0.71 to 0.85 per match. That is the
entire cost of a high line. There is no through-ball, no ball-over-the-top, no one-on-one
mechanic anywhere in the tick loop. The high line's four benefits are real; its one cost is
0.14 offsides.

**3. Risk appetite is monotonically punished, because its payoff is inert.** `CAUTIOUS` +0.095,
`BOLD` −0.094, `RECKLESS` −0.091. `BOLD` and `RECKLESS` buy `attackVolume` and `volatility` at
the price of `defensiveSolidity`; `volatility` does nothing (G3), so they are pure losses. The
"purest expression of the trade-off principle" in the source is a strictly dominated axis.

### Proposed fix

1. Make fatigue bite inside thirty minutes. Either raise `FATIGUE_PER_TICK` ~2× and/or raise
   `FATIGUE_ATTR_PENALTY` toward 0.45, and make `pressRecovery` itself scale down with the
   pressing team's accumulated fatigue — a press that cannot be sustained is the whole point.
2. Give `spaceBehind` a real consumer: a per-tick chance that a turnover in the defending
   team's half converts straight into a high-xG counter chance, scaled by `spaceBehind` and by
   the attacking team's `counterThreat`. That single mechanic makes the high line, `LOW_BLOCK`,
   `counterWeight`, `DIRECT` passing and the `speedster` trait all mean something at once.
3. Cap the aggregate: no single-axis change should exceed roughly ±0.15 ppg (≈ ±5 percentage
   points of win rate) against the default. Add a CI gate to `tools/sim` that runs the paired
   axis sweep and fails on any \|Δppg\| > 0.15. The sweep costs 90 seconds at n = 1,500.
4. Add an assertion that the **mirror** of any configuration returns ≈ 1.5 ppg (it does, 1.483)
   and that the *best* configuration wins under 60% against the *default*. It currently wins
   75.3%.

---

## G2 — The long game: the world ages to death in eight seasons

**Severity: Critical.**

**Note on timing.** When this audit began, `advanceCycle` had no season-rollover path at all: a
save played 220 cycles sat in an infinite `PLAYOFFS` phase, `clock.season` stuck at 1, zero
matches played after week 22, and the table frozen. `game/seasonRollover.ts` was added by a
parallel workstream *during* this audit and fixes that. Everything below is measured against
the **current** code, with the rollover in place.

### The measurement

Script: a single save played twelve full 22-week seasons through `advanceCycle`, default
tactics, no player input, recording the table, the age distribution and the ledger each season.

```
season  1  champion Marrowgate Athletic   player 12th (4pt)   mean overall 68.1  mean age 26.3
season  2  champion Marrowgate Athletic   player 12th (13pt)  mean overall 68.8  mean age 27.2
season  3  champion Aurelia Sporting Club player 11th (13pt)  mean overall 69.5  mean age 28.0
season  4  champion Aurelia Sporting Club player 12th (8pt)   mean overall 69.7  mean age 28.8
season  5  champion Aurelia Sporting Club player 11th (12pt)  mean overall 70.0  mean age 29.5
season  6  champion Marrowgate Athletic   player 12th (5pt)   mean overall 70.0  mean age 30.3
season  7  champion Marrowgate Athletic   player 12th (7pt)   mean overall 69.7  mean age 31.2
season  8  champion Marrowgate Athletic   player 12th (3pt)   mean overall 69.0  mean age 31.9
season  9  champion Marrowgate Athletic   player 12th (2pt)   mean overall 68.7  mean age 32.5
season 10  champion Aurelia Sporting Club player 12th (5pt)   mean overall 67.9  mean age 33.0
season 11  champion Marrowgate Athletic   player 12th (4pt)   mean overall 66.1  mean age 33.3
season 12  champion Marrowgate Athletic   player 12th (5pt)   mean overall 64.8  mean age 34.4
```

**Mean age rises exactly one year per season and never comes back down.** Age distribution of
squadded players:

| | ≤20 | 21-24 | 25-28 | 29-32 | 33+ | squadded | free agents |
|---|---|---|---|---|---|---|---|
| start | 17% | 21% | 44% | 14% | 4% | 216 | 0 |
| season 3 | **0%** | 18% | 38% | 33% | 10% | 206 | 10 |
| season 6 | 0% | 5% | 20% | 49% | 26% | 190 | 26 |
| season 8 | 0% | **0%** | 21% | 25% | **53%** | 173 | 43 |
| season 10 | 0% | 0% | 7% | 30% | 63% | 127 | 89 |
| season 12 | 0% | 0% | 0% | 46% | 54% | **78** | **138** |

By season eight the league contains **no player under twenty-five** and is more than half
thirty-three-year-olds. By season twelve, 138 of the world's 216 footballers are unemployed and
the twelve clubs share 78 players between them — 6.5 each, for a game that needs seven on the
pitch.

### The cause, in three lines

```
over 12 seasons: 0 retirements, 0 academy promotions, 929 signings
total players in world at the end: 216   (216 at kickoff)
in youth squads at kickoff: 0
```

**The world is a closed system of exactly 216 footballers and no mechanism creates another
one.** `rolloverSeason` graduates from `club.youthSquad`, but `newGame` starts every club with
an empty `youthSquad`, so the academy path can never fire. Retirement releases a player to free
agency (`transferPlayer(next, player.id, null)`) rather than removing him, so the population
never shrinks and never renews — it just ages, one year at a time, forever. This is `RISKS.md`
R16 ("the world ages out over a long dynasty") landing exactly as predicted, at **Medium**
likelihood in the register and 100% in practice.

### The table calcifies from season one

Finishing positions over the twelve seasons:

| club | mean finish | titles | sequence |
|---|---|---|---|
| Marrowgate Athletic | 1.42 | **8** | 1,1,2,2,2,1,1,1,1,3,1,1 |
| Aurelia Sporting Club | 2.08 | **4** | 2,4,1,1,1,2,2,2,3,1,2,4 |
| Larkspur Wolves | 4.58 | 0 | 3,2,5,3,8,4,6,6,4,5,3,6 |
| … | | | |
| Vantage Point FC | 10.25 | 0 | 5,11,12,11,12,11,11,11,11,11,7,10 |
| **Cinderwick Town (the player)** | **11.83** | 0 | 12,12,11,12,11,12,12,12,12,12,12,12 |

Two clubs take all twelve titles. No third club ever finishes above second in twelve seasons.
The player's club finishes twelfth in ten of twelve seasons and never rises above eleventh.
Across twenty independent single-season runs from fresh saves the same holds: Marrowgate wins
11/20, Aurelia 7/20, and the player's club averages 11.20th with a best of 9th.

This is partly by construction. The starting XIs span **25.4 overall points**:

```
Marrowgate Athletic   top-7 mean 92.1     Cinderwick Town (player)  top-7 mean 66.7
Neon Row FC                    87.0       Ember Nine                          70.1
Vantage Point FC               85.0       Redmere Republic                    70.9
```

A 92-rated starting seven against a 66-rated one is not a league, it is a tier gap. The
measured quality curve (G1) says a +25 edge is worth roughly a 78-82% win rate per fixture.
There is no season in which Cinderwick can compete on football alone, and — see G7 — nothing in
the reachable transfer market that would close the gap.

### Proposed fix

1. **Generate youth.** `rolloverSeason` must produce 2-4 new academy players per club per season
   via `generatePlayer`, aged 15-17, potential drawn from the club's academy facility level.
   Without this nothing else in the long game can work.
2. **Actually retire.** Delete retired players from `state.players` (or move them to a `legends`
   record consumed by the legacy screen) rather than leaving them in the free-agent pool.
3. **Compress the starting spread.** 25.4 points is too wide for a twelve-club single tier.
   Target 10-12 points top to bottom, which the quality curve says produces a 55-63% favourite —
   a league rather than a formality.
4. **Add a long-game CI gate.** `tools/sim` should play ten seasons and assert: mean squad age
   stays within ±1.5 years of its starting value; the ≤22 age bracket never falls below 10% of
   squadded players; no club wins more than 40% of titles; every club fields ≥ 16 players.

---

## G3 — `volatility` is a tactic dimension wired to nothing

**Severity: High.**

`TacticVector.volatility` is documented as *"Variance multiplier: reckless setups swing games
both ways."* It is written by **fourteen** sources — six tactic axes (`FRANTIC`, `HIGH` line,
`SHORT`, `FROM_THE_BACK`, `LEFT`/`RIGHT` focus, `ZONAL`, `CAUTIOUS`, `BOLD`, `RECKLESS`,
`CONSERVATIVE`, `AGGRESSIVE`), nine live-decision options, five special rules, and the rivalry
system (`simulator.ts:1456`). It is read by **zero** sites in `matches/model.ts` or
`matches/simulator.ts`. A repo-wide grep for read sites returns one hit, in the UI:

```ts
// apps/game/src/features/squad/tacticsCopy.ts:170
volatility: { label: 'Swinginess', higher: 'neutral', scale: 100 },
```

The game shows the player a tactical readout called "Swinginess", computes it from eleven
instructions, and never consults it. This is why `RECKLESS` (`volatility: +0.30`) measures at
−0.091 ppg: it pays `defensiveSolidity: −0.23` for a stat that does not exist.

Three sibling helpers are exported and never called by the simulator either:

| function | file | callers in `matches/` |
|---|---|---|
| `duelWin(rng, a, b, bias)` | `model.ts:420` | 0 — **there are no duels in the match** |
| `passSuccess(rng, passer, pressure, def)` | `model.ts:427` | 0 |
| `spaceInBehind(defenceVector)` | `model.ts:560` | 0 |
| `saveProbability(xg, keeper)` | `model.ts:414` | 0 |

`duelWin` having no caller means the `duelsWon`/`duelsLost` stats the ratings model reads
(`RATING_DUEL_WON: 0.045`) are populated by something other than a duel contest, and the
`duelWin` trait modifier reaches outcomes only via the `strength`/`physical` attribute mapping.

**Proposed fix.** Either implement `volatility` — the natural home is a per-tick multiplier on
`rng.normal` spreads in `buildChance` (widen the shot-location distribution) and on the
`TEAM_PERFORMANCE_SIGMA` draw — or delete the field, the eleven tables that write it, and the
UI row. Shipping a visible stat with no consumer is the "decorative numbers" failure the
attribute file explicitly forbids: *"every attribute here is read by at least one simulation
subsystem. We do not ship decorative numbers."*

---

## G4 / G5 — Traits: four dead modifier keys, fifteen inert traits

**Severity: High.** The stated rule is *"There are no flavour-only traits: if a trait has no
modifier, it does not ship."* The rule is enforced at the wrong level — every trait has a
modifier, but four of the twenty-three modifier keys have no consumer.

### The dead keys

Repo-wide grep for each `TRAIT_MODIFIER_KEY`, excluding its own definition in `players/traits.ts`:

| key | engine consumers | other references |
|---|---|---|
| `aerialThreat` | **0** | `PlayerProfileScreen.tsx:40` — displayed as "In the air" |
| `moraleResilience` | **0** | `PlayerProfileScreen.tsx:42` — displayed as "Morale resilience" |
| `teammateMorale` | **0** | `PlayerProfileScreen.tsx:42` — displayed as "Squad morale" |
| `chemistry` | **0** | `PlayerProfileScreen.tsx:44` — displayed as "Chemistry" |

All four are rendered on the player profile card with a human-readable label. The game tells the
player these effects exist. They do not. `GAME_SYSTEMS.md` §3.1 assigns them to consuming
systems ("Match — attack", "World / squad", "Fans") that do not read them.

The casualties, by trait:

- **`aerial_threat` ("Unplayable in the box from a delivery", `aerialThreat: 0.28`) is completely
  inert.** It is a trait whose only modifier is a dead key. The `aerial` team aggregate is
  computed (`model.ts:182`) and scaled (`simulator.ts:1492`) and then read by nothing.
- `leader` loses `teammateMorale: 0.20` and `moraleResilience: 0.15`, keeping only `duelWin: 0.03`.
- `team_player` loses `chemistry: 0.20` and `teammateMorale: 0.10`, keeping `passAccuracy: 0.04`.
- `cult_hero` loses `moraleResilience: 0.20` and `teammateMorale: 0.08`.
- `selfish` loses `chemistry: −0.15`; `mercenary` loses `chemistry: −0.10` and `moraleResilience: 0.10`.
- `glass_confidence` ("Fragile") loses `moraleResilience: −0.35`, its whole character.

### The measurement

Script: two 65-overall squads with **all traits stripped**. Then the same squad with one trait
granted to every eligible player (a deliberate upper bound — a real squad has ~0.35 traits per
player, so a single-player effect is roughly a seventh of this). 1,200 matches per cell under
common random numbers, run at `importance: 3` (no conditions) and `importance: 5` with
`isDerby: true` (BIG_MATCH + DERBY + LATE_GAME conditions live).

Traits with **zero** measurable effect — byte-identical results across all 1,200 matches at both
importance levels:

```
aerial_threat    Δppg +0.000  SE 0.000     <- fully inert, no working modifier at all
cult_hero        Δppg +0.000  SE 0.000     <- fanAppeal only; not read in-match
mercenary        Δppg +0.000  SE 0.000     <- wageDemand only
late_bloomer     Δppg +0.000  SE 0.000     <- training only (by design)
wonderkid        Δppg +0.000  SE 0.000     <- training only (by design)
veteran          Δppg +0.000  SE 0.000     <- VETERAN condition never satisfied in these squads
```

Traits whose blurb promises a match effect but which measure below significance (|z| < 2) even at
squad-wide saturation, `importance: 3`:

```
trait                 ppg     Δppg     SE      z     blurb promises
playmaker            1.359   +0.007  0.008   0.84   "The team creates through him"
speedster            1.355   +0.003  0.021   0.12   "Runs in behind and punishes a high line"
leader               1.369   +0.017  0.013   1.30   "Drags the squad with him"
team_player          1.357   +0.004  0.011   0.38   "Makes the players around him better"
selfish              1.358   +0.006  0.008   0.69   "Backs himself. Always."
wall                 1.376   +0.023  0.024   0.99   "Makes saves he has no right to make"
sweeper_keeper       1.368   +0.016  0.014   1.14   "Plays as an eleventh outfielder"
showman              1.331   −0.022  0.016  −1.32   "Fans buy tickets to watch him"
hot_head             1.397   +0.044  0.031   1.44   "Plays on the edge"
workhorse            1.410   +0.058  0.034   1.72   "Covers ground long after everyone else"
(no traits)          1.353
```

`speedster` is the sharpest miss: `counterThreat: 0.22` maps onto `pace`/`acceleration`, which
feed the `pressing` aggregate and the counter-window shot bonus — but the "punishes a high line"
half needs the ball-over-the-top mechanic that does not exist (G1, cause 2). z = 0.12.

**What does work — and this is genuinely good.** Conditional traits fire exactly as designed:

```
                     importance 3          importance 5 (BIG_MATCH + DERBY)
big_game             +0.000  z 0.00        +0.160  z 3.33   ΔGF +0.28  ΔGA −0.26
```

`big_game` is provably inert in a league fixture and provably worth +0.16 ppg in a derby. That
is the "Clutch feels like a moment rather than a permanent stat bump" design working, and it is
the single best-executed piece of the trait system. `press_resistant` (+0.101, z 2.56) and
`natural_finisher` (+0.029, z 2.40) also land.

### Proposed fix

1. Wire the four dead keys, or delete them and the six traits that lean on them. Cheapest real
   implementations: `chemistry` and `teammateMorale` as a squad-level multiplier on the
   `TEAM_PERFORMANCE_SIGMA` draw and on `confidence` drift in `worldTick`; `moraleResilience` in
   `worldTick.ts:212`'s form-drift term (it already computes a volatility from `consistency`);
   `aerialThreat` on the `header` branch of `buildChance` via the `aerial` aggregate that is
   already computed and thrown away.
2. Add a unit test that asserts every `TRAIT_MODIFIER_KEY` is referenced outside `players/traits.ts`
   and outside `apps/`. This is a ten-line test that would have caught all four.
3. Add a trait-effect gate to `tools/sim`: for each trait, 1,000 paired matches, assert a
   measurable directional effect on *some* metric (points, xG, cards, injuries, or a development
   rate) at |z| > 2. Traits that fail are either buffed or cut.
4. `duelWin`'s modifier reaching the sim only through `strength`/`physical` is a symptom of
   `duelWin()` being dead code. Wiring duels back in would give `hot_head`, `leader` and
   `speedster` a place to live.

---

## G6 — Transfers: hijacking is a dice roll that ignores everything you do

**Severity: High.**

### The measurement

Script: 60 real targets from a fresh save (overall ≥ 60, contracted elsewhere), 20 seeded
negotiations each = 1,200 negotiations per offer level. Each round re-offers max(the chosen
ratio of asking price, whatever they last countered). Wages offered at 1.15× demand or better.

**With six rival clubs in the market:**

| offer | AGREED | HIJACKED | COLLAPSED | mean rounds |
|---|---|---|---|---|
| 50% of asking | 0.0% | 20.5% | 77.8% | 1.2 |
| 70% | 0.0% | 65.8% | 29.9% | 3.5 |
| 85% | 16.4% | 59.8% | 22.1% | 3.3 |
| 100% | 29.8% | 48.8% | 19.8% | 2.5 |
| 120% | 34.3% | 45.5% | 18.6% | 2.6 |
| **150%** | **32.7%** | **47.1%** | 18.6% | 2.6 |

**With no rivals (ablation):**

| offer | AGREED | COLLAPSED |
|---|---|---|
| 85% | 41.5% | 56.5% |
| 100% | 66.6% | 31.8% |
| 120% | 68.2% | 30.2% |
| 150% | 68.3% | 30.0% |

Two things fall out. First, **paying 50% over the asking price buys nothing**: 100% → 120% → 150%
gives 66.6% → 68.2% → 68.3% success with no rivals, and 29.8% → 34.3% → 32.7% with them. The
money axis saturates at the asking price exactly. Second, **the hijack rate is completely flat in
the offer**: 48.8% at par, 47.1% at 150%. That is not a coincidence:

```ts
// transfers/negotiation.ts:175
function hijackChance(neg: Negotiation, ctx: NegotiationContext): number {
  const rounds = Math.max(0, ctx.cycle - neg.startedCycle);
  const raw =
    N.HIJACK_BASE_CHANCE +                          // 0.04
    neg.rivalBidders.length * N.HIJACK_PER_SUITOR + // 0.05 each
    rounds * N.HIJACK_PER_ROUND;                    // 0.02
  return Math.min(N.HIJACK_CHANCE_CAP, raw);        // 0.40
}
```

There is no term for `terms.fee`, no term for `managerCharisma` or `managerNegotiation`, no term
for the player's preference for your club, and no term for your reputation. The single most
common outcome of a transfer negotiation in this game — 45-66% of all attempts — is a coin flip
the player cannot influence by any means available to them.

`PRODUCT_REQUIREMENTS.md` T2 asks for *"a rival hijacked it"* as a failure mode, and T1 for
*"never a one-click buy"*. The implementation satisfies the letter of both and misses the point
of both: the negotiation is not a one-click buy because it is mostly not a buy at all.

The **beats** system underneath this is genuinely well made — `openNegotiation` produces
story-shaped lines, `clubTalks` has insult thresholds, patience burn, partial concessions, and
`loyaltyBlock` refusals (1.7% of targets flatly refuse to discuss a move). That texture is
invisible when half of all talks end in a dice roll before the texture can play out (mean 2.6
rounds).

### Proposed fix

1. Add the missing terms to `hijackChance`: divide by `(terms.fee / askingPrice)`, subtract a
   `managerCharisma` term, and subtract a term for how much the player wants the move
   (`evaluateTermsOffer`'s willingness score is already computed). Overpaying should visibly buy
   security — that is the decision.
2. Cap total hijack probability across a whole negotiation, not per round. At 0.19/round over
   3.5 rounds the cumulative rate is ~52%; the cap (`HIJACK_CHANCE_CAP: 0.4`) only bounds a single
   round and is therefore not doing the job its name implies.
3. Target: 15-25% of well-run negotiations lost to a rival, not 48%. Add a `tools/sim` gate that
   asserts AGREED rises monotonically and materially with offer size.

---

## G10 — One league match in seven is a twelve-goal blowout

**Severity: High.**

The `tools/sim` `audit:sim` gate passes comfortably (goals/match 6.26, conversion 18.2%, all
targets green) because it plays **two evenly matched generated squads** against each other. The
league does not.

### The measurement

Script: eight fresh saves, each played 22 weeks through `advanceCycle`, recording every league
result. n = 1,056 real fixtures.

```
goals per match  mean 7.77  sd 3.43  median 7  p95 14  max 21     (target band 6.0-9.0)
winning margin   mean 3.62                     p95  9  max 17
shots per team   mean 19.73                            max 56     (reference band 12-20/team)
matches with 12+ goals: 152 (14.4%)

goal-total distribution
   3: 5.8%   6: 12.4%   9:  9.8%   12: 4.6%   15: 1.2%   18: 0.4%
   4: 8.4%   7: 10.8%  10:  8.4%   13: 3.3%   16: 1.3%   19: 0.3%
   5: 9.9%   8: 12.0%  11:  5.0%   14: 2.7%   17: 0.4%   20-21: 0.2%
```

The mean is in band. The tail is not: 14.4% of fixtures finish 12-0, 15-1, 2-10 or worse, and
shots reach 56 for a single team in a thirty-minute match. Sampled headlines from a real season
confirm the reader-facing consequence:

```
w3  Marrowgate Athletic humiliate Ironhollow Forge, 0-11
w3  Larkspur Wolves tear Saltpine Harbour apart, 15-1
w3  Collapse: Redmere Republic beaten 0-12
w22 Marrowgate Athletic tear Verrow Wanderers apart, 1-15
```

The cause is G2's 25.4-point starting spread interacting with an xG pipeline that has no
saturation at extreme mismatches: `progressionChance` and `turnoverChance` are linear in the
rating gap, `shotChance` is linear in `attackVolume`, and the only brakes are hard clamps at
0.92 / 0.62 / 0.75 that a 92-vs-66 fixture sits well inside.

`SIMULATION_REFERENCE_DATA.md` is explicit that *"Do not validate only the blended number"*, and
the repo's own audit does exactly that. It never measures the distribution's tail and never runs
a real fixture list.

### Proposed fix

1. Compress the starting quality spread (G2 fix 3). This alone removes most of the tail.
2. Add diminishing returns on the rating gap: replace `((atk - def) / 10) * EDGE` with a
   `tanh`-shaped term so a 30-point gap is not three times a 10-point gap.
3. Extend `audit:sim` to run a real 22-week fixture list from `createNewGame` and assert on the
   **p95 and max**, not the mean: p95 total ≤ 12, max margin ≤ 8, max shots per team ≤ 30.

---

## G8 / G9 / G14 — Content: the same sentence, twenty-nine times a season

**Severity: High.**

The failure mode the brief names is *"content that feels generated"*. Sampled directly.

### Media, one full season, read end to end

253 headlines published across 22 weeks, 155 distinct. The repeat list:

```
29x  Cinderwick Town breaks a record that stood for a generation
12x  Noah Steinberg breaks a record that stood for a generation
 7x  Most goals in a season: Cinderwick Town into the record books
 6x  Most goals in a season: Noah Steinberg into the record books
 6x  Most points in a season: Cinderwick Town into the record books
 5x  Verrow Wanderers beaten again as familiar problems resurface
 4x  Saltpine Harbour beaten again as familiar problems resurface
 4x  Biggest winning margin: Cinderwick Town into the record books
```

**Twenty-five percent of all press in a season (64 of 253 headlines) is the record system.** The cause is in
`progression/legacy.ts`:

```ts
const seasonPoints = leaguePoints(club.seasonRecord);
if (seasonPoints > (existing['CLUB_SEASON_POINTS']?.value ?? 0)) {
  out.push({ key: 'CLUB_SEASON_POINTS', label: 'Most points in a season', value: seasonPoints, clubId });
}
if (club.seasonRecord.goalsFor > (existing['CLUB_SEASON_GOALS']?.value ?? 0)) { ... }
```

`detectRecords` runs every cycle and compares **cumulative season aggregates** against the record
book. Points-so-far and goals-so-far are monotonically increasing, so in the club's first season
every single week sets a new "Most points in a season" and "Most goals in a season" record.
Same for `BIGGEST_WIN`, which scans the whole event log each cycle.

### Social, same season

396 posts, 178 distinct. 68 of them (17%) are the record system.

```
20x  A club record. Cinderwick Town writes his name into the history of Cinderwick Town. 📖
19x  A record that has stood for a generation falls to Cinderwick Town.
15x  A record that has stood for a generation falls to Noah Steinberg.
14x  I am not doing a reaction video. There is nothing to react to.
14x  A club record. Noah Steinberg writes his name into the history of Cinderwick Town. 📖
10x  Watched that live and I am still processing it. Cinderwick Town have to be better.
10x  Defeat for Verrow Wanderers, who have now taken one point from a possible nine.
```

Two further bugs are visible in that list:

- **Token substitution puts the club in the `{player}` slot.** *"A club record. **Cinderwick
  Town** writes **his** name into the history of Cinderwick Town."* and *"RECORD | Cinderwick
  Town sets a new mark: Most goals in a season (1)."* The `RECORD_BROKEN` hook resolves
  `{player}` to `holderName`, which is absent for club records and falls back to the club.
- **"one point from a possible nine" is hardcoded flavour** that appears regardless of the club's
  actual form, for four different clubs seven to ten times each in a single season.

### Commentary, inside one match

274 events, 274 carry text, **191 distinct** — 30% of everything the player reads during a match
is a literal repeat of a line they read minutes earlier. Distinct-line pools per event type,
measured across 200 matches:

| event type | lines emitted | distinct lines | per match |
|---|---|---|---|
| POSSESSION_CHANGE | 7,471 | **7** | 37.4 |
| CORNER | 1,407 | **4** | 7.0 |
| FREE_KICK | 665 | **4** | 3.3 |
| MOMENTUM_SHIFT | 1,787 | **10** | 8.9 |
| SAVE | 2,360 | 20 | 11.8 |
| SUBSTITUTION | 1,601 | 40 | 8.0 |
| GOAL | 1,047 | **875** | 5.2 |
| FULLTIME | 200 | 150 | 1.0 |
| MISS | 1,524 | 108 | 7.6 |

Requirement M8 — *"no line repeats within a match while alternatives exist"* — is honoured
literally and defeated in practice: with seven possession-change lines and 37 possession changes
per match, one line appears thirteen times in three minutes of viewing. The writing itself is
strong; there simply is not enough of it where the volume is.

The goal, fulltime, halftime and miss pools are excellent and should be the model.

### Proposed fix

1. Only evaluate cumulative-aggregate records at season rollover, not every cycle. Per-event
   records (biggest win, record signing) can stay live.
2. Give `RECORD_BROKEN` a `subjectKind` so club records use a club template and player records
   use a player template. Add a content-validation test that fails any template using `{player}`
   for a trigger whose payload may lack a player.
3. Grow the top-five commentary pools to ~40 lines each. Weighting existing effort by frequency:
   `POSSESSION_CHANGE` alone accounts for 14% of all lines the player reads and has 0.6% of the
   writing.
4. Add a `tools/sim` content gate: play one season, assert no single headline exceeds 3% of the
   season's press, no post exceeds 3% of the feed, and distinct-line ratio inside a match ≥ 0.85.

---

## G13 / G12 — Live decisions: real, but with a right answer and a missing beat

**Severity: Medium.** This is one of the better systems and it still has two problems.

### The measurement

Script: the same 800 matches played three times through `MatchSimulator` under identical seeds,
with a policy that always picks option #1, #2 or #3 at every prompt. The only difference between
runs is the choice.

```
always option #1: 1.471 ppg   GF 3.50  GA 3.50
always option #2: 1.736 ppg   GF 3.91  GA 3.12   Δ +0.265  SE 0.061  z 4.33
always option #3: 1.544 ppg   GF 3.63  GA 3.25   Δ +0.072  SE 0.062  z 1.17
```

**The good news: the options are not cosmetic.** A 0.265 ppg spread between policies at z = 4.33
means the live decision is a genuine interaction with a measurable consequence — the core promise
of the feature holds. The system also grades honestly afterwards; sampled outcomes return
`BACKFIRED` for choices that looked right at the time.

**The bad news: option #2 is the right answer.** +0.265 ppg is worth roughly half the entire
`HIGH_PRESS` exploit, available for free by always tapping the middle button. Since option #1 is
also `defaultOptionId` (the one auto-applied on timeout), the player who engages least gets the
worst outcomes systematically rather than randomly.

### Prompt distribution, per 800 matches

```
UNDER_PRESSURE        630  (0.79/match)      STRIKER_ISOLATED   79  (0.10/match)
MOMENTUM_SWING        625  (0.78/match)      PROTECTING_LEAD    49  (0.06/match)
SPECIAL_RULE_CHOICE   300  (0.38/match)      LOSING_MIDFIELD    46  (0.06/match)
SET_PIECE_CALL        285  (0.36/match)      HALFTIME_TALK       4  (0.01/match)
CARD_RISK             207  (0.26/match)      OPPONENT_SHAPE_CHANGE / INJURY_DECISION /
CHASING_GAME          175  (0.22/match)      CREATOR_OPPORTUNITY: 0
```

Total 3.00 prompts per match against a cap of 3 — **the budget is always fully spent.** Two
recipes supply 52% of all prompts. Four of the fourteen recipes fire in under 7% of matches and
three never fire at all.

**The half-time team talk — *"Half time. What do they hear in there?"* — fires in 0.5% of
matches.** It is gated on `s.atHalfTime`, by which point `UNDER_PRESSURE` and `MOMENTUM_SWING`
have almost always consumed the three-prompt budget in the first fifteen minutes. The marquee
dressing-room beat, with three well-written options, is effectively not in the game.

### Proposed fix

1. Reserve the half-time slot outside the `maxDecisions` budget, or give `HALFTIME_TALK` a
   priority above every other recipe and refund its slot.
2. Rebalance the option sets so no ordinal position is systematically best. The cheapest route is
   to shuffle the presentation order per prompt (seeded) so `defaultOptionId` is not always the
   first item, then retune the four recipes where option #2 wins — `UNDER_PRESSURE`'s "Press out
   of it" is the biggest contributor and it is buying the `pressRecovery` that G1 shows is
   overpriced, so fixing G1 fixes most of this.
3. Raise the floor on the rare recipes: `PROTECTING_LEAD` requires `elapsedFraction > 0.62` and
   a lead, which in a 6-goal-average format is rarer than the design assumes.

---

## G11 — Rule cards are free, infinite, and worthless

**Severity: Medium** (would be High if the cards did anything).

Three separate problems, all measurable.

**1. They do nothing.** Script: the home side holds one card and plays it at the first legal
minute, against an opponent with none. 1,000 matches per card, common random numbers.

```
no card (control)      1.407 ppg  42.2% W
POWER_PLAY             1.376 ppg  41.5% W   Δ −0.031  z −0.50
LOCKDOWN               1.357 ppg  41.4% W   Δ −0.050  z −0.81
ALL_IN                 1.306 ppg  39.5% W   Δ −0.101  z −1.62
CREATOR_MOMENT         1.369 ppg  40.9% W   Δ −0.038  z −0.62
CAPTAINS_CALL          1.388 ppg  42.6% W   Δ −0.019  z −0.31
LAST_STAND             1.355 ppg  41.1% W   Δ −0.052  z −0.83
```

Every card measures **negative** and none is significant. `CAPTAINS_CALL` is an `EPIC`-rarity
objective reward that doubles your captain's goals for three minutes and is worth −0.019 ppg.
The objective → rule card → match loop delivers nothing. (Caveat: the harness plays at a fixed
minute rather than timing the card; a human could do better. But a three-minute window in a
thirty-minute match with symmetric modifiers has a low ceiling however it is timed.)

**2. They are never consumed.** `MatchLiveScreen.tsx:193` decrements the quantity in React
component state only:

```ts
const ok = sim.playRuleCard(playerSide, ruleId);
if (ok) {
  setCards((current) => current
    .map((c) => (c.definition.id === ruleId ? { ...c, quantity: c.quantity - 1 } : c))
    .filter((c) => c.quantity > 0));
}
```

Nothing writes back to `state.inventory.ruleCards`. A repo-wide grep for writes to that array
finds only `features/progression/engine.ts` **granting** cards. A card earned once can be played
in every match forever.

**3. The AI can never hold one.** `game/matchSetup.ts:58`:

```ts
ruleCards: isPlayerControlled
  ? state.inventory.ruleCards.filter((c) => c.quantity > 0).map((c) => c.ruleId)
  : [],
```

Asymmetric by construction. As shipped this is harmless because the cards are worthless, but it
means the balance question has never actually been posed.

**Proposed fix.** Consume the card in `GameState` (an `applyResult`/`cycle` mutation, not the
component); give AI clubs a small card inventory and a play heuristic; then re-run the
measurement above and tune each card to a +0.10 to +0.20 ppg swing — meaningful, not decisive.

---

## G7 — The transfer window works, and cannot improve the team

**Severity: High.**

**Note on timing.** An earlier state of this branch had the player's transfer budget draining to
£0 by week 5 and debt reaching £2.4M by week 22. `game/cycle.ts` was changed by a parallel
workstream during this audit and that is fixed: wage bills fell from £216K to £82-92K per cycle,
debt is now £0 across all three seeds, and the budget survives the season. The measurements below
are against the **current** code.

### The measurement

Three fresh saves, 22 weeks each, sampling the ledger and the market every cycle:

```
seed e1: start cash £1.1M, budget £605K, wages £337K/cycle
  w1 £521K budget -> w5 £464K -> w10 £322K -> w22 £8K   cash £421K  debt £0
seed e2: w1 £673K -> w5 £555K -> w22 £293K   cash £1.3M  debt £0
seed e3: w1 £569K -> w5 £654K -> w22 £231K   cash £1.1M  debt £0
```

During the open window (weeks 5-7), across three seeds:

```
budget £543-733K   listings 47-60   median asking price £889K-£1.0M   affordable 38-47% of the list
```

That is a functioning economy. The remaining problem is what the money reaches. At week 7 of a
fresh save, with the full £612K budget available:

```
best five players I can afford:   61 (£410K), 60 (£209K), 60 (£455K), 59 (£449K), 59 (£283K)
best five on the market:          96 (£44M), 95 (£71M), 89 (£35M), 84 (£11M), 84 (£16M)
my current starting seven:        77, 76, 66, 66, 65, 61, 60
```

**Nothing the player can afford improves the starting seven.** The best available signing is a 61
against a side whose weakest starter is a 60. The players who would change the season cost £35-71M
— 57× to 116× the budget — because `VALUE_PER_OVERALL: 1.118` compounds and the league spans 25.4
overall points (G16). A twelve-season run confirms the ceiling holds: cash oscillates between
£174K and £783K for twelve straight seasons and never breaks out.

So the transfer system is not broken, and it is not a decision either. Sitting the window out and
sitting it in produce the same squad. `RISKS.md` R5 ("transfers feel meaningless") is real, by a
different route than expected: not because negotiation is a one-click buy, but because the
reachable market contains nothing worth negotiating for.

### The objectives that cannot be completed

Sampled at the end of a full season:

```
objectives: 3 active, 4 completed, seasonTargets 0
completed: 2x "Shut the door", 1x "Raise a prospect", 1x "Play the academy"
active:    "Raise a prospect — 0/6"   "Play the academy — 0/2"   "Shut the door — 0/1"
```

Two of the three live objectives ask the player to develop and field academy players. Per G2,
every club starts with an **empty** `youthSquad` and none is ever generated, so both are
permanently unachievable. `seasonTargets` is empty at season end, and objectives that reach their
target were observed sitting at `ACTIVE` rather than `COMPLETED` ("Finish in the top half — 8/8").
Four completed objectives across twenty-two cycles is the whole progression loop.

**Proposed fix.** Widen what the budget can reach: either flatten `VALUE_PER_OVERALL` toward
1.09 so the top of the market is 10-15× rather than 100× the bottom, or seed the listing pool
with more mid-tier (68-75) players who are genuinely a step up for the bottom half of the table.
Then fix the academy (G2) so the two academy objectives become live, and make season targets
resolve at rollover.

---

## G20 — Special rules: the windows are real, the rules inside them are not

**Severity: Medium.** `SIMULATION_REFERENCE_DATA.md` requires normal play and rule-window play to
be validated **separately**, with the window running at **2-4× the normal goal rate**. Nothing in
the repo does that measurement, so here it is: 1,500 matches per rule, goals and shots bucketed
by whether the minute falls inside a swing window (12-15 and 27-30).

| enabled rules | normal-play goals/min | window goals/min | ratio | shots/min out → in |
|---|---|---|---|---|
| *(none)* | 0.189 | 0.288 | **1.53×** | 1.08 → 1.42 |
| SUDDEN_SPARK | 0.189 | 0.288 | **1.53×** | 1.08 → 1.42 |
| NUMBERS_GAME | 0.189 | 0.283 | 1.50× | 1.07 → 1.35 |
| LONG_RANGE | 0.186 | 0.277 | 1.49× | 1.08 → 1.50 |
| DOUBLE_GOAL | 0.184 | 0.261 | **1.42×** | 1.06 → 1.24 |

Three findings.

1. **The window is under-tuned.** 1.4-1.5× against a documented target of 2-4×. `SWING_WINDOW_SHOT_MULTIPLIER`
   (1.45) and `SWING_WINDOW_XG_MULTIPLIER` (1.25) multiply to 1.81 on paper; the realised
   figure is 1.53 because the shot multiplier only applies on final-third ticks and possession
   still has to get there. The three minutes are noticeably busier, but not the format-defining
   spike the design describes.
2. **`enabledSpecialRules: []` does not disable rules.** `scheduleSwingWindows` falls back:
   `if (pool.length === 0) pool.push('SUDDEN_SPARK')`. That is why the *(none)* and `SUDDEN_SPARK`
   rows are byte-identical. Any measurement anyone has made comparing "rules on" to "rules off"
   has been comparing rules to rules.
3. **The identity of the rule barely matters.** Swap `SUDDEN_SPARK` for `NUMBERS_GAME` for
   `LONG_RANGE` and the window's goal rate moves by 4%. Only `DOUBLE_GOAL` changes the *scoreboard*
   (6.05 → 7.62 goals per match), and it does so by multiplication, not by changing the football —
   and its "teams get more careful" modifiers actually make the window **less** eventful than
   having no rule at all (1.42× vs 1.53×).

To the credit of the design, the windows are visible in the event stream and do reshape the
match (see below), and no rule swings win probability far enough to decide matches — the failure
here is under-power, not imbalance.

**Proposed fix.** Raise `SWING_WINDOW_SHOT_MULTIPLIER` toward 1.9 and `SWING_WINDOW_XG_MULTIPLIER`
toward 1.4, then re-measure against the 2-4× band. Make the empty-pool fallback explicit
(`return []`) so rules can be turned off. Give each rule a mechanical hook that is not a vector
nudge: `NUMBERS_GAME` already removes a player (good); `LONG_RANGE` should push shot selection
outward, not merely raise volume; `SUDDEN_SPARK` should actually suspend the offside check its
description promises.

---

## G15 — Training: real divergence, but a season buys two overall points

**Severity: Medium.**

Script: a real 18-year-old prospect (overall 66, potential 80) developed through
`developPlayer` / `applyDevelopment` for 22 cycles, varying one input at a time; then 30 real
prospects from a fresh save.

```
minutesShare 0.00  ->  overall 66 -> 66     (growth rate/cycle 0.223)
minutesShare 0.20  ->  overall 66 -> 66     (0.423)
minutesShare 0.50  ->  overall 66 -> 67     (0.724)
minutesShare 0.70  ->  overall 66 -> 68     (0.924)
minutesShare 1.00  ->  overall 66 -> 68     (0.924)   <- saturates at 0.70

intensity LIGHT / NORMAL / HARD  ->  67 / 68 / 68

30 real prospects, 22 cycles at 0.70 minutes:
  growth over a season: min -2, median +1, max +10
  distribution: -2,-2,-2,-1,-1,-1,-1,-1,-1,-1,-1,-1,0,0,1,1,1,1,1,1,2,2,3,3,3,4,4,6,6,10
```

**What works.** Two identical prospects *do* diverge: `growthCharacter(p.id)` is a hidden,
deterministic per-player multiplier, and the season outcome across 30 prospects ranges from −2 to
+10. That is genuinely good design — a prospect is a bet whose result you learn by playing him,
which is exactly what a youth system should feel like.

**What does not.** The playing-time lever, which `TR3` and `GAME_SYSTEMS.md` present as central,
moves a prospect **+0 to +2 overall across a full 22-week season**. The `minutesFactor` range is
0.35→1.45 (4.1× on the rate), but `GROWTH_BASE` is 0.42 and the gain is spread across 17
attributes, so the visible number barely moves. It also saturates at `MINUTES_SATURATION: 0.70`,
so the difference between a rotation player and an ever-present is zero. Intensity moves the
result by one point across the whole season.

For a player whose potential is 14 points above his current ability, the game says: play him
every week for a season and he closes 2 of those 14 points. He needs seven seasons — in a world
that, per G2, is uninhabitable after eight.

**Proposed fix.** Raise `GROWTH_BASE` to give a well-managed prospect +5 to +8 overall in a
season, and concentrate growth on the 3-4 attributes the program targets so the change is legible
on the card. Move `MINUTES_SATURATION` to ~0.9 so being a first pick beats being a rotation
option.

---

## G16 / G17 / G18 — Shorter findings

**G16 — the starting league is a two-tier gap.** Top-7 mean overall by club at kickoff:
Marrowgate 92.1, Neon Row 87.0, Vantage Point 85.0, Aurelia 83.0 … Ember Nine 70.1, Cinderwick
66.7. A 25.4-point spread in a twelve-club single-tier competition. The measured quality curve
says a 25-point edge is a 78-82% favourite per fixture, so the table is decided at generation
time. Covered in G2 and G10.

**G17 — five of eleven tactical axes do nothing.** At n = 1,500 paired, `tempo`, `passing`,
`buildUp`, `counter` and `subStrategy` all return |z| < 2 for every setting. `counter=ALWAYS`
(−0.060, z −1.47) and `counter=NEVER` (+0.005, z 0.11) are indistinguishable, because
`counterWeight` only enters `shotChance` during a counter window whose frequency is set by
`COUNTER_WINDOW_TICKS: 4` — four ticks of 300. The player is offered eleven decisions of which
three matter enormously, three matter slightly, and five are cosmetic.

**G18 — `autoLineup()` silently resets every tactical instruction.** It returns
`{ ...DEFAULT_TACTICS, formationId, lineup, bench, captainId, setPieceTakerId, penaltyTakerId }`.
Every in-repo caller correctly cherry-picks the lineup fields, so the shipped game is not
affected — but the signature invites the bug, and it cost this audit two full sweep runs before
the silent overwrite was spotted. Split it into `autoLineup()` returning only the selection
fields and `autoTactics()` returning the instructions.

**Also worth noting: `pnpm audit:invariants` currently fails.** 1,328 reported "duplicate
fixture" violations, all of the form `fx_season_1_2/COMPLETED` vs `fx_season_2_2/SCHEDULED`. This
is a false positive in the audit tool, not the engine: after the new season rollover, a state
holds both the completed season-1 fixtures and the scheduled season-2 ones, and the invariant
keys on `week:home:away` without including the season. The invariant should key on
`seasonId:week:home:away`. It should be fixed quickly — a red gate that everyone learns to ignore
is worse than no gate.

---

## What is genuinely good

This section is not a courtesy. Several of these are better than they need to be.

**1. The match has a real dramatic shape.** This was the thing most at risk (R1) and it works.
Importance ≥ 3 events per match minute, 300 matches, swing windows on:

```
min  0 ###########################  1.34      min 16 ###########             0.57
min  4 #########                    0.44      min 19 #######                 0.33
min  8 #########                    0.46      min 23 ######                  0.30
min 11 #########                    0.46      min 26 ########                0.40
min 12 #####################################  1.83   <- first swing window
min 13 ##################           0.90      min 27 #############################  1.44
min 14 #################            0.83      min 28 ###############         0.75
min 15 ###################################### 2.56   <- window closes         
min 30 ############################################################### 3.21   <- full time
```

That is a genuine arc: a busy opening, a settled middle at ~0.45 notable events per minute, a
2-5× spike into the end of each half, and a climax. Both swing windows are clearly legible in the
data without knowing where they are. Watching this for three minutes would not be flat.

**1b. …but the stream is very dense.** The same 300 matches produce 240.6 events per match —
**nine per match minute** — of which 145 are importance 1 and 72 importance 2. Per match:
34.1 shots, 33.8 interceptions, 26.7 tackles, 11.9 saves, 9.0 momentum shifts, 7.6 chances
created. Reading the first eight minutes of a real event stream, a shot is taken every 26 seconds
of match time and the pattern SHOT → BLOCK → SHOT → SAVE → SHOT → BLOCK repeats without a break:

```
 4' [SHOT]  Mateo Sawyer shoots.            5' [SHOT]  Ricardo Wren has a go!
 4' [BLOCK] That is a goal-saving block!    5' [BLOCK] Brilliant block!
 4' [SHOT]  Tiago Laakso pulls the trigger! 5' [CHANCE_CREATED] Ricardo Wren carves it open!
 4' [BLOCK] Blocked. ...gets a body behind. 5' [SHOT]  Hakim Calloway shoots.
```

The importance-3+ layer has the good shape shown above; the importance-1/2 layer underneath it is
where "noise with a scoreline attached" lives, and at NORMAL match speed (90-150s for 30 minutes)
it arrives at roughly two events per second. The renderer already has `MatchEvent.importance` to
filter on — the risk is that it is used to *decorate* rather than to *suppress*.

**2. Determinism is absolute and the audit harness is excellent.** `simulateMatch` twice with the
same setup produces byte-identical output; every random draw comes from a labelled fork; the
`tools/sim` harness runs the real engine with no UI. That property is what made this entire audit
possible — including the common-random-numbers technique that surfaced effects hidden under a
±0.08 ppg noise floor. Very few projects at this stage could have been measured this precisely.

**3. Conditional traits work exactly as designed.** `big_game` is provably worth +0.000 ppg in a
league fixture and +0.160 ppg (z = 3.33, ΔGF +0.28, ΔGA −0.26) in a derby. A trait that is
literally nothing until the occasion arrives, then measurably decisive, is a hard thing to build
and it is built.

**4. Live decisions genuinely change results.** A 0.265 ppg spread between "always option 1" and
"always option 2" at z = 4.33, and a post-hoc grader that honestly returns `BACKFIRED`. The core
interaction is not fake.

**5. Scouting is the cleanest system in the game.** `knowledgeRange` is deterministic (no
re-rollable jitter), the band is *biased* rather than merely wide (`bias` from a hash, so a
scout's guess is wrong in a direction), potential stays fuzzier than current ability for longer,
and confidence decays at 0.004/cycle so an old report is not a current one. Every one of those is
a considered decision. It is let down only by there being nothing in the reachable market
worth a £140K deep report (G7).

**6. The writing is good where there is enough of it.** 875 distinct goal lines across 1,047
goals; 150 distinct full-time lines; 98 distinct half-time lines. The media outlets are invented
and consistent, the 28 creators have real personalities and about half are deliberately
unlikeable, and the club names read like a real division. The content *pipeline* is the problem
(G8), not the content.

**7. Creators correctly do not buy competitive advantage.** `creatorPresence` 0 → 1 moves win
rate from 40.9% to 40.1% (z = −0.96) and produces 0.00 → 0.57 creator moments per match. The
design rule *"Creators must never buy competitive advantage; that would be pay-to-win by another
route"* is honoured to the number. Their weight lives in the economy — the player's club has
228K reach against Neon Row's 31.7M — which is the right place for it.

**8. Ratings are built from contribution, not scoreline.** `RATING_CLEAN_SHEET_GK: 0.9`,
`RATING_BIG_CHANCE_MISSED: −0.36`, `RATING_MINUTES_REFERENCE: 20` pulling low-minute players
toward the base. A keeper who makes seven saves in a 4-0 defeat comes out well, as advertised.

**9. Momentum is honest.** Capped at `MOMENTUM_MAX_EFFECT: 0.06` and explicitly not
rubber-banding — the losing side gets no compensating bonus. 9.0 `MOMENTUM_SHIFT` events per
match is arguably too many to feel meaningful, but the restraint in the model is correct.

---

## Pacing map

### The first session (10-15 minutes)

| beat | what actually happens | verdict |
|---|---|---|
| Creation | manager archetype + club identity | Strong. Eight archetypes with real strengths and weaknesses; this is a genuine choice that scales six systems. |
| First look at the squad | top-7 mean 66.7 against a league where the best is 92.1 | **Deflating.** The player is handed the worst squad in a league whose best side is 25 points better. There is no framing anywhere that says "this is the job". |
| Prepare | tactics screen, eleven dropdowns | **The trap.** Three of the eleven decide matches, five do nothing, and the default the player is given (`MID_BLOCK`/`NORMAL`/`CAUTIOUS`) is one of the weaker configurations available. |
| Match | ~275 events over 30 minutes, 3 live decisions, 2 swing windows | **The best beat in the game.** Real shape, real spikes, real choices. |
| Post-match | ratings, key moment | Good. Ratings defensible line by line. |
| World tick | 6-12 press stories, 18 social posts | **Immediately repetitive.** In week 1 the player will already see "breaks a record that stood for a generation" and "Defeat for X, who have now taken one point from a possible nine". |
| Objectives | 4 active | Fine, but the season targets list is empty at week 22 and objectives that reach their target sit at `ACTIVE` (observed: "Finish in the top half — 8/8", status ACTIVE). |

**Where it drags in the first session:** nowhere in the match. Everywhere in the world layer.

### The first season (22 cycles)

- **Weeks 1-4:** the window is shut. Budget accrues to £520-670K. Nothing to spend it on yet.
- **Weeks 5-7:** the window opens with £543-733K against a £889K-£1.0M median asking price.
  38-47% of the list is affordable and none of it improves the starting seven — the best
  reachable player is a 61 against a weakest starter of 60. **The one moment the loop offers a
  real strategic decision resolves to "there is nothing to buy".**
- **Weeks 8-22:** the window is shut for fifteen consecutive cycles. Training moves a prospect
  +2 overall across the entire season and saturates at 70% of minutes. Two of the three live
  objectives ask for academy players that do not exist. **There is nothing left to decide
  between matches.** The loop reduces to: read a repetitive feed, pick a lineup, watch a good
  match, repeat.
- **Season end:** the player finishes 11th or 12th (mean 11.20 across 20 runs, best 9th), having
  had no lever with which to change that.

### The tenth season

- The table has been won by Marrowgate or Aurelia eight and four times respectively; no other
  club has finished above second.
- The player's club has finished 12th in ten of twelve seasons.
- The league contains **no player under twenty-five**; 63% are 33 or older; 89 of 216 footballers
  are unemployed and clubs are down to 10-11 players each.
- Cash has oscillated between £174K and £783K for a decade; debt is £0 and the budget has never
  been large enough to sign anyone who would change a result. Objectives tick over at four per
  season, two of which are permanently unachievable.
- Nothing that has happened in ten seasons is different from what happened in season one, except
  that everyone is older and worse.

**The one-line summary of pacing:** the ninety seconds of match are excellent and the twelve
minutes around them have almost nothing in them, and that ratio does not improve with time.

---

## What to fix first

Ranked by (damage × cheapness):

1. **G1 — rebalance the press.** Nothing else matters while three dropdowns are worth twenty
   overall points. Start with fatigue weight and a real `spaceBehind` consumer; add the paired
   axis sweep as a CI gate.
2. **G2 — generate youth on rollover.** Four lines of `generatePlayer` in `seasonRollover.ts`
   stand between this and a world that survives past season eight.
3. **G7 — put something worth buying inside the budget.** The negotiation system is well built
   and currently points at a market where the best affordable player is worse than the worst
   current starter.
4. **G8 — stop the record spam.** A one-line guard (evaluate cumulative records at rollover only)
   removes 15% of all generated content and it is the 15% that reads worst.
5. **G16/G10 — compress the starting quality spread** to 10-12 points. Fixes the calcified table
   and the 15-1 scorelines at the same time.
6. **G4 — wire or cut the four dead trait keys**, and stop the player profile advertising them.
7. **G6 — make the hijack roll respond to the offer.**
8. **G12 — give the half-time talk a reserved slot.**

Items 2, 4, 6 and 8 are each under an hour of work and remove four of the eight named failure
modes in the brief.

---

## Verdict against the brief's named fears

| feared failure | real? | evidence |
|---|---|---|
| Boring match simulation | **No** | Genuine dramatic arc; 2-5× event spikes at both swing windows; live decisions worth 0.265 ppg |
| Meaningless transfers | **Yes** | Nothing affordable improves the starting seven (G7); 48% of talks end in a dice roll the player cannot influence (G6) |
| Players feel like numbers | **Yes** | 15 of 22 traits have no measurable match effect; 4 modifier keys shown in the UI are read by nothing |
| Clubs feel identical | **No** | Eight AI profiles produce visibly different tactics and recruitment; the table separates them clearly |
| A world that does not evolve | **Yes, severely** | Mean age +1.00 years per season for twelve seasons; 0 new players ever created; two clubs win every title |
| Gimmicky special rules | **No — the opposite** | Windows run at 1.5× normal against a 2-4× target; three of four rules are statistically invisible |
| Repetitive economy | **Yes** | Cash oscillates between £174K and £783K for twelve consecutive seasons and never breaks out in either direction |


---

## Appendix — do the eight AI profiles actually produce different clubs?

Yes, visibly. Tactical setups at kickoff, straight from a fresh save:

```
Marrowgate Athletic      BALANCED    line=HIGH    tempo=BALANCED  risk=MEASURED
Neon Row FC              HIGH_PRESS  line=NORMAL  tempo=FRANTIC   risk=BOLD
Vantage Point FC         MID_BLOCK   line=NORMAL  tempo=BALANCED  risk=MEASURED
Ironhollow Forge         LOW_BLOCK   line=DEEP    tempo=PATIENT   risk=CAUTIOUS
Verrow Wanderers         LOW_BLOCK   line=DEEP    tempo=PATIENT   risk=CAUTIOUS
Larkspur Wolves          HIGH_PRESS  line=HIGH    tempo=QUICK     risk=BOLD
Cinderwick Town (player) MID_BLOCK   line=NORMAL  tempo=BALANCED  risk=CAUTIOUS
```

Five distinct shapes across twelve clubs, plus different `facilityPriorities`, `targetAge` bands
and `favouredPositions` per profile. `RISKS.md` R10 ("clubs feel identical") is **not** realised.

Two caveats worth recording. First, the AI's only tactical adaptation is to revert to its own
profile lean when under pressure (`aiClub.ts:452-461`) — it never reads the player's shape and
never counters it, so the G1 exploit is uncontested for as long as a save lasts. Second, the
player's own club ships on `MID_BLOCK` / `NORMAL` / `CAUTIOUS`, which the paired sweep measures
at roughly **−0.30 ppg against the default** and −0.85 ppg against the dominant stack. The
starting configuration is one of the weakest available, which means the single largest
improvement a new player can make to their club has nothing to do with football and everything to
do with noticing which dropdown is undertuned.

---

## Appendix — reproducing these measurements

Every number here came from a throwaway script under `tools/sim/src/`, run with `npx tsx`, using
the real engine through `@cf/engine`. The scripts have been removed as instructed; the shapes
worth rebuilding as permanent gates are:

| gate | what it does | asserts |
|---|---|---|
| `audit:tactics` | paired single-axis sweep, CRN, n ≥ 1,500 | no axis setting moves ppg by more than ±0.15 vs the default; best stacked configuration wins < 60% vs default; mirror ≈ 1.5 ppg |
| `audit:traits` | one trait granted squad-wide vs a stripped control, n ≥ 1,000 | every trait shows \|z\| > 2 on at least one metric; every `TRAIT_MODIFIER_KEY` has a consumer outside `players/traits.ts` |
| `audit:longgame` | one save, 10 seasons through `advanceCycle` | mean squad age within ±1.5y of start; ≤22 bracket ≥ 10% of squadded players; no club wins > 40% of titles; every club fields ≥ 16 |
| `audit:sim` (extend) | run a **real** 22-week fixture list, not two matched squads | p95 total goals ≤ 12; max margin ≤ 8; max shots/team ≤ 30 |
| `audit:windows` | bucket goals by inside/outside the swing window | window goal rate 2-4× normal play |
| `audit:content` | one season of media and social | no headline > 3% of the season's press; no post > 3% of the feed; distinct-line ratio inside a match ≥ 0.85 |
| `audit:decisions` | 800 matches × "always pick option k" | no ordinal position beats another by more than 0.10 ppg; every recipe fires in ≥ 5% of matches |

The critical technique is **common random numbers**: seed every configuration's match `i` with
the same string. Without it the noise floor at n = 800 is ±0.08 ppg, and the entire single-axis
sweep reads as noise — which is exactly what happened on the first attempt at this audit.
