# Simulation Reference Data — Match Engine Tuning Targets

**Purpose:** the hard numbers the *Creator Football* match engine should be validated against.
**Companion document:** `RESEARCH_CREATOR_FOOTBALL.md`.
**Compiled:** 19 August 2026.

**How to read this document**

- **MEASURED** — the number appears in a cited source. Use it directly.
- **DERIVED** — arithmetic performed here on cited inputs. The arithmetic is shown so it can be checked.
- **ESTIMATE** — a reasoned band, not a measurement. Flagged everywhere it appears. **Do not treat as fact.**
- **NOT FOUND** — no source located. **Do not invent a number.** Left blank deliberately.

**Method caveat:** the research proxy blocked direct fetches of FBref, Opta/`theanalyst.com`, FootyStats, Premier League and Wikipedia. Everything below comes from indexed search summaries of those sources with URLs cited. Where a league-wide aggregate could not be obtained (passes, tackles, fouls, shots on target), that is stated rather than filled in. **Before shipping, someone should pull the FBref season CSVs directly and replace the DERIVED and ESTIMATE rows with MEASURED ones.**

---

## 1. Target output metrics

### 1.1 (a) 11-a-side top-flight — Premier League 2024-25 unless stated

All "per game" figures are **both teams combined** unless the row says otherwise.

| Metric | Value | Status | Source / derivation |
|---|---|---|---|
| Matches in season | 380 | MEASURED | [Wikipedia: 2024–25 Premier League](https://en.wikipedia.org/wiki/2024%E2%80%9325_Premier_League) |
| Total goals | 1,115 | MEASURED | as above |
| **Goals per game** | **2.93** | DERIVED | 1,115 ÷ 380 |
| Goals per team per game | 1.47 | DERIVED | 2.93 ÷ 2 |
| Goals per minute of match clock | 0.0326 | DERIVED | 2.93 ÷ 90 |
| Goals per minute of **ball-in-play** | 0.0514 | DERIVED | 2.93 ÷ 57 |
| **Shots per game** | **22.5** | MEASURED | [Opta Analyst](https://theanalyst.com/articles/premier-league-goals-low-stats) — described as the lowest rate in any PL season on record (since 2003-04) |
| Shots per team per game | 11.25 | DERIVED | 22.5 ÷ 2 |
| **Shot conversion (goals ÷ shots)** | **13.0%** | DERIVED | 2.93 ÷ 22.5 |
| Shots on target per game | — | NOT FOUND | League aggregate not located. Arsenal's team figure was 4.95 per match ([StatMuse](https://www.statmuse.com/fc/ask?q=premierleague+shots+on+goal+per+match+average+by+team+2024-25)). **Use ~33% of shots on target as a prior and replace with a measured figure.** |
| Goals per shot on target | — | NOT FOUND | Depends on the row above |
| **xG per shot (league mean)** | ~0.13 implied; **not directly measured** | ESTIMATE | Implied by 2.93 goals ÷ 22.5 shots. For scale, Brentford led the league at **0.15 xG/shot** ([StatMuse](https://www.statmuse.com/fc/ask/xg-per-shot-of-every-premier-league-team-2024)). Typical published league means sit near 0.10–0.12; the gap suggests the 22.5 figure and the xG datasets use different shot definitions. **Flagged as unresolved.** |
| **Possession** | 50.0% mean per team by construction | DEFINITIONAL | Validate the *spread*, not the mean |
| Possession spread | — | NOT FOUND | Team-level 24/25 range not located |
| Passes per game | — | NOT FOUND | League aggregate not located. Best available anchors: Man City **89.9%** pass success, Arsenal 87.1%, Chelsea 86.7%, Liverpool 86.3%, Spurs 85.0% ([FootballFanCast](https://www.footballfancast.com/premier-league-best-passers-passing-accuracy-completion-stats/)) |
| Pass completion % | **~85–90% for top-six sides**; league mean not located | PARTIAL | as above |
| Tackles per game | — | NOT FOUND | |
| **Fouls per game** | **~21** | ESTIMATE | Bounded by team season totals: Bournemouth 525 (13.8 per team-game, highest) and Man City 287 (7.6, lowest) over 38 games ([Medium/Sports Things](https://medium.com/sports-things/11-moderately-interesting-statistics-to-wrap-up-the-2024-25-premier-league-season-120609dec459)). Midpoint ≈ 10.5 per team → ~21 per match. **Estimate — replace with a measured aggregate.** |
| **Yellow cards per game** | **4.08** | DERIVED | 1,549 yellows ÷ 380 ([MyFootballFacts](https://www.myfootballfacts.com/premier-league/all-time-premier-league/cards/premier-league-red-and-yellow-cards-2024-25/)) |
| **Red cards per game** | **0.137** (≈ 1 per 7.3 matches) | DERIVED | 52 reds ÷ 380. Of those, **16 were straight reds**; the rest were second yellows. Described as a **record low** ([Premier League](https://www.premierleague.com/en/news/3533373), [MyFootballFacts](https://www.myfootballfacts.com/premier-league/all-time-premier-league/cards/premier-league-red-and-yellow-cards-2024-25/)) |
| Yellows per foul | ~1 in 5 | DERIVED | 4.08 yellows ÷ ~21 fouls. Note Liverpool's opponents ran at **1 yellow per 3.8 fouls**, described as the *lowest* rate of any side in eight seasons — i.e. the league mean is lower still ([Andrew Beasley](https://www.andrewbeasleyfootball.com/p/liverpools-record-for-opposition-fouls-and-yellow-cards)) |
| **Ball in play** | **~55–57 minutes** | MEASURED (with conflict) | One Opta summary gives **56 min 58 s** for 2024-25; the same summary says 2023-24 was **54 min 52 s**, which is internally inconsistent with the accompanying "22 seconds shorter" claim. Treat as **55–57 min** ([Opta Analyst](https://theanalyst.com/articles/premier-league-ball-in-play-are-we-seeing-less-football-2025-26)) |
| Ball **out** of play, share of match | ~34% | MEASURED | [Coach Diary](https://www.thecoachdiary.com/benefits-of-small-side-games/) — consistent with the 55–57 min figure |

**Injuries — 11-a-side (UEFA Elite Club Injury Study, time-loss injuries)**

| Metric | Value | Status | Source |
|---|---|---|---|
| Overall injuries per 1,000 h exposure | **8.0** (4,483 injuries / 566,000 h) | MEASURED | [UEFA injury study](https://www.diva-portal.org/smash/get/diva2:352677/fulltext01.pdf) |
| **Match** injuries per 1,000 h | **27.5** | MEASURED | as above |
| **Training** injuries per 1,000 h | **4.1** | MEASURED | as above |
| 18-season aggregate | 11,820 injuries / 1,784,281 h = **6.6 / 1,000 h**; incidence falling **~3% per season** | MEASURED + DERIVED | [PubMed 33547038](https://pubmed.ncbi.nlm.nih.gov/33547038/) |
| English professional football (different definition) | match **58** vs training **2.8** per 1,000 h | MEASURED | [Leeds Beckett](https://eprints.leedsbeckett.ac.uk/id/eprint/10573/7/InjuryTrendsInMensEnglishProfessionalFootballAn11YearCaseSeriesPV-JONES.pdf) |
| Hamstring specifically | match **4.99** vs training **0.52** per 1,000 h; hamstrings = **24% of all injuries** | MEASURED | [UEFA ECIS 2001/02–2021/22](https://pmc.ncbi.nlm.nih.gov/articles/PMC9985757/) |
| **Injuries per team per match** | **0.45** | DERIVED | 11 players × 1.5 h = 16.5 player-hours per team-match; 16.5 × 27.5 / 1000 = 0.454 |
| **Injuries per match (both teams)** | **0.91** | DERIVED | 2 × 0.454 |

### 1.2 (b) Short-format creator football

Reference points are futsal (best-measured small-sided format) and the creator leagues themselves.

| Metric | Futsal (2×20 min, stopped clock) | Kings League (7v7, 40 min) | Baller League (6v6, 30 min) | Status / source |
|---|---|---|---|---|
| **Goals per game** | **6.65 – 7.09** | **6.23** (2023 season) | see note | MEASURED. Futsal: UEFA Futsal Champions League — 2017-18 **7.09** (879/124), 2018-19 **6.68** (828/124), 2019-20 **6.90** (856/124), 2020-21 **6.65** (346/52), 2021-22 **6.85** (850/124) ([Wikipedia UEFA Futsal CL seasons](https://en.wikipedia.org/wiki/2019%E2%80%9320_UEFA_Futsal_Champions_League)). Kings: **717 goals / 115 matches** ([Wikipedia: 2023 Kings League](https://en.wikipedia.org/wiki/2023_Kings_League)) |
| Knockout-tournament variants | — | **7.40** (2024 Kings World Cup, 407/55); **9.88** (2026 KWC Nations, 395/40) | — | MEASURED — [Wikipedia: 2024 Kings World Cup](https://en.wikipedia.org/wiki/2024_Kings_World_Cup), [2026 KWC Nations](https://en.wikipedia.org/wiki/2026_Kings_World_Cup_Nations) |
| Goals per minute | 0.166 – 0.177 | 0.156 | — | DERIVED (÷40) |
| Baller League goals/game | | | **NOT FOUND.** Only known: 69 matches in UK S1; top scorer 21 goals (Bryan Ly, N5 FC); highest-scoring match **26ers 8–9 Trebol FC = 17 goals** ([Wikipedia: Baller League UK – Season 1](https://en.wikipedia.org/wiki/Baller_League_UK_%E2%80%93_Season_1)) | NOT FOUND |
| Ball **out** of play, share of match | — | ~14% (7-a-side) | ~8% (4-a-side reference) | MEASURED — [Coach Diary](https://www.thecoachdiary.com/benefits-of-small-side-games/). Compare 34% for 11-a-side |
| Ball touches per player | — | ~2× 11-a-side (7-a-side) | ~5× 11-a-side (4-a-side) | MEASURED — [Coach Diary](https://www.thecoachdiary.com/benefits-of-small-side-games/) |
| Shots per game | NOT FOUND | NOT FOUND | NOT FOUND | Futsal research reports shots-per-minute by player involvement tier, not match totals ([Frontiers](https://www.frontiersin.org/journals/sports-and-active-living/articles/10.3389/fspor.2023.1256424/full)) |
| Conversion % | NOT FOUND | NOT FOUND | NOT FOUND | |
| Cards per game | NOT FOUND | NOT FOUND | NOT FOUND | |
| Injuries per 1,000 h (overall) | **6.8** male elite (meta); **4.5**, **16.4** in individual studies; **5.3** female | — | — | MEASURED — [meta-analysis](https://www.academia.edu/54402971/Epidemiology_of_injuries_in_elite_male_and_female_futsal_a_systematic_review_and_meta_analysis) |
| Injuries per 1,000 h (**match**) | **44.9** (meta, 95% CI 17.2–72.6); **25.9** and **90.4** in individual studies; **10.3** female | — | — | MEASURED — as above, plus [ScienceDirect 7-season study](https://www.sciencedirect.com/science/article/pii/S277269672300008X) |
| Injuries per 1,000 h (**training**) | **3.0** / **10.4** | — | — | MEASURED — as above |

### 1.3 Recommended tuning targets for our 6v6 / 30-minute format

These are the numbers the engine should reproduce. Rows marked ESTIMATE are reasoned interpolations between measured neighbours and **must be re-validated** once real Baller League match data is scraped.

| Metric | Target | Band | Basis |
|---|---|---|---|
| **Goals per match (both teams)** | **7.0** | 6.0 – 9.0 | ESTIMATE. Sits above Kings League's 6.23 in 40 min because 6v6 on a smaller pitch with walls raises event density per minute; the observed 17-goal Baller League match sets the plausible upper tail |
| Goals per team per match | 3.5 | 3.0 – 4.5 | DERIVED from the above |
| **Goals per minute** | **0.233** | 0.20 – 0.30 | DERIVED (7.0 ÷ 30). Compare: futsal 0.166–0.177, Kings 0.156, 11-a-side **0.033** |
| Goals-per-minute multiplier vs 11-a-side | **~7×** | 6× – 9× | DERIVED (0.233 ÷ 0.0326). **The single most important calibration constant in the engine** |
| Shots per match | ~30 | 24 – 40 | ESTIMATE. Assumes conversion rises to ~20–25% in small-sided play (closer range, fewer defenders, keeper in a smaller goal) |
| Shot conversion | ~23% | 18% – 28% | ESTIMATE. 11-a-side is 13.0%; small-sided research shows more shots *and* more goals per shot |
| Ball out of play | ~10% of match clock | 8% – 14% | MEASURED-adjacent (4-a-side 8%, 7-a-side 14%). Baller/Icon leagues use **boards/walls**, pushing toward the low end |
| Effective playing time | ~27 min of 30 | 26 – 28 | DERIVED |
| Possession, mean per team | 50% | — | Definitional |
| **Yellow cards per match** | ~1.0 | 0.5 – 2.0 | ESTIMATE. No small-sided card data found. Scale 11-a-side's 4.08 by the ~1/3 match duration and a lower-contact format |
| **Red cards per match** | ~0.03 | 0.01 – 0.06 | ESTIMATE. Scaled from 0.137 in 11-a-side. **Caveat:** a "Fairplay"-style rule window that sends players off for any foul would spike this — model rule-window dismissals as a *separate channel*, not as ordinary discipline |
| **Injuries per team per match** | **0.10** | 0.08 – 0.14 | DERIVED. 6 players × 0.5 h = 3.0 player-hours per team-match. At futsal's meta match rate of 44.9/1,000 h → 0.135; at the conservative 25.9/1,000 h → 0.078 |
| Injuries per match (both teams) | 0.20 | 0.16 – 0.27 | DERIVED |
| **Injuries per 1,000 team-pitch-minutes** | **3.3** | 2.6 – 4.5 | DERIVED. 44.9 per 1,000 **player**-hours = 0.000748 per player-minute; × 6 players on the pitch = 0.00449 per team-minute → **4.5 per 1,000 team-minutes** (upper bound). The conservative 25.9/1,000 h gives **2.6**. For comparison, 11-a-side: 27.5/1,000 h × 11 players = **5.0 per 1,000 team-minutes**. *Fix one denominator — player-hours or team-pitch-minutes — and use it everywhere; silently mixing the two is the most common calibration bug in this class of model* |

**Calibration warning.** Because *Creator Football* has **special-rule windows**, the engine's headline rates will be an average over two very different regimes:

- **Normal play** (~24 of 30 minutes) should sit near the futsal/Kings rate: ~0.16–0.18 goals/min.
- **Rule-window play** (~6 of 30 minutes: last 3 minutes of each half) is designed to be goal-dense — 1v1 duels, double-scoring, numeric advantages, shot clocks. Expect **2–4× the normal rate** inside the window.
- Validate **the two regimes separately**, then check the blended total lands in the 6–9 band. Validating only the blended number will hide a badly-tuned window.

---

## 2. Scoreline distributions

### 2.1 The Poisson baseline and where it fails

- Independent Poisson marginals for home and away goals are the standard starting point, but **Poisson forces variance = mean**, which real football violates. ([Dissecting Poisson-based prediction models](https://www.researchgate.net/publication/362022551_Dissecting_Poisson_based_prediction_models_in_association_football_A_comprehensive_look_at_methodology_assumptions_and_accuracy_using_data_from_the_main_European_Leagues_2011_-_2022))
- **Overdispersion is real.** A χ² goodness-of-fit comparison across the main European leagues (2011–2022) found the **negative binomial is a better fit than Poisson for both home and away goals in every league tested**. ([same source](https://www.researchgate.net/publication/362022551_Dissecting_Poisson_based_prediction_models_in_association_football_A_comprehensive_look_at_methodology_assumptions_and_accuracy_using_data_from_the_main_European_Leagues_2011_-_2022))
- **Dixon–Coles (1997)** adds (a) a dependence correction inflating the probability of **0–0 and 1–1** and (b) time-decay weighting of past matches. ([Emergent Mind: Bivariate Dixon–Coles](https://www.emergentmind.com/topics/bivariate-dixon-and-coles-model), [Extending Dixon–Coles, arXiv](https://arxiv.org/pdf/2307.02139))
- **Score correlation** between the two teams is non-zero; Karlis & Ntzoufras argued that significant correlation in scores itself produces overdispersed data, and bivariate Poisson improves the fit for draws. ([Emergent Mind](https://www.emergentmind.com/topics/bivariate-dixon-and-coles-model))

### 2.2 What this means for our engine

| Rule | Reason |
|---|---|
| Model each team's goals with a **negative binomial**, not a plain Poisson | Overdispersion is empirically better fit in every league tested |
| Expose the dispersion parameter as a **tuning knob** | It is the dial that controls "how often do blowouts happen", which is a *design* choice as much as a realism one |
| **Do not port the Dixon–Coles low-score correction wholesale to the short format** | The DC correction exists to fix 0–0/1–1 frequency at λ≈1.4 per team. At λ≈3.5 per team, 0–0 is a ~3% event per team pair rather than a ~9% one, and the correction stops earning its complexity |
| **Do model score correlation** | Both real football and creator formats produce comeback dynamics; independent marginals under-produce high-scoring draws like the Sidemen match's 9–9 |
| Validate the **full scoreline matrix**, not just the mean | Two engines with identical goals-per-game can have entirely different draw rates and tail behaviour |
| Model rule-window goals as a **separate additive process** | Do not fold a double-scoring period into the base λ; it has different variance and different correlation with the base process |

### 2.3 Expected shape at our target λ

| | 11-a-side (λ ≈ 1.47/team) | Our 6v6 (λ ≈ 3.5/team) |
|---|---|---|
| 0–0 frequency | common (a few % of matches) | rare |
| Draws overall | **~24.5%** (measured, see §3) | materially lower — draws thin out as λ rises |
| Modal scoreline | 1–1 / 1–0 | 3–3 / 4–3 region |
| Tail (6+ goal matches) | uncommon | routine |
| Practical consequence | draws are a design problem to *handle* | draws are a design problem to *create* — hence real creator leagues bolt on golden goal, shootouts and endgame double-scoring |

Note that **every** creator league found in this research has an explicit tie-break mechanism (Kings League midfield shootout; Icon League golden goal or shootout; Sidemen match penalties). That is not decoration — at high λ a league still produces enough draws to be unsatisfying for an entertainment product, and the leagues resolve them theatrically. Our engine should support the same.

---

## 3. Home advantage

| Metric | Premier League 2024-25 | Status | Source |
|---|---|---|---|
| Home wins | **40.8%** | MEASURED | [Goal.com](https://www.goal.com/en-za/betting/premier-league-home-team-betting-records-2024-2025/blt6f2841683155bd20) |
| Away wins | **34.7%** | MEASURED | as above |
| Draws | **~24.5%** | DERIVED | 100 − 40.8 − 34.7 |
| Home-minus-away gap | **+6.1 pts** | DERIVED | Described as **the smallest gap ever seen in the Premier League era**; away win % reached an all-time high near 35% |
| Historical PL baseline | — | NOT FOUND | Long-run home win rate not verified in this research. Do not quote a historical figure without checking it |

**Implication for a creator-football engine:** the two biggest creator leagues play **every match at a single neutral venue** (Copper Box Arena; Cupra Arena) on a shared matchday. **There is no home advantage to model.** Set the home-advantage term to **zero** by default.

That leaves the parameter free for a more interesting use: a **crowd/creator-support modifier** driven by the manager's in-game audience size — an original mechanic that occupies the structural slot home advantage occupies in a conventional football sim. Calibrate its magnitude to **no more than the real-world home effect** (a ~6 percentage-point swing in win probability at the current PL level) so it stays a nudge rather than a determinant.

---

## 4. Favourite vs underdog — how win probability actually distributes

The useful validation is not "does the better team usually win" but **"how far apart do the best and worst teams end up over a full season"**. Premier League 2024-25 gives a clean anchor.

| Position | Team | Points | Record | Win rate | Status |
|---|---|---|---|---|---|
| 1st | Liverpool | **84** | 25 W / 9 D / 4 L | **65.8%** | Points MEASURED; W-D-L DERIVED from 84 pts over 38 games (25×3 + 9 = 84) |
| 2nd | Arsenal | 74 | — | ~58% | Points MEASURED |
| 3rd | Manchester City | 71 | — | ~55% | Points MEASURED |
| 4th | Chelsea | 69 | — | ~54% | Points MEASURED |
| 20th | Southampton | **12** | 2 W / 6 D / 30 L | **5.3%** | MEASURED (12 pts, "only two wins"); D/L DERIVED |

Source: [myKhel final table](https://www.mykhel.com/football/premier-league-2024-25-final-points-table-liverpool-crowned-champions-full-standings-ucl-qualifie-363825.html), [SI](https://www.si.com/soccer/2024-25-premier-league-final-standings-placings-points), [Liverpool FC](https://www.liverpoolfc.com/news/official-liverpool-are-2024-25-premier-league-champions)

### Validation targets for a 12-team league season

| Property | Target | Basis |
|---|---|---|
| **Best team's win rate over a season** | **60 – 70%** | Liverpool 65.8%; a title-winning season is rarely above ~70% even for a dominant side |
| **Worst team's win rate over a season** | **5 – 15%** | Southampton 5.3% was a record-setting low; a normal bottom side sits nearer 12–15% |
| **Best-vs-worst single-match win probability** | **~75 – 85%** for the favourite | ESTIMATE. Bounded by the season win rates above plus home/away symmetry. **Not directly measured — validate empirically** |
| **Draw probability, evenly matched 11-a-side** | ~25–28% | From the 24.5% league-wide draw rate, which averages over mismatches |
| **Draw probability, evenly matched short format** | materially lower | High λ suppresses draws; see §2.3 |
| Points spread, 38 games | 84 down to 12 | The full observed range — a 72-point spread on a 114-point maximum |

**Anti-pattern to avoid:** an engine tuned so the favourite wins 90%+ of individual matches will produce a league table with an unrealistically wide points spread and, worse, will make the player's tactical decisions feel irrelevant. Real top-flight football gives the best team in the country a **one-in-three chance of dropping points in any given match**. Short-format football, with its higher variance and rule-window chaos, should give the underdog **more** than that, not less. The engine should be validated so that:

- the favourite in a heavy mismatch wins **~75–85%**, not 95%;
- upset frequency **rises** in the short format relative to 11-a-side;
- over a simulated 11-matchday season, the champion lands near **65–70% wins** and the bottom side near **10–15%**.

---

## 5. Consolidated validation checklist

Run a large batch of simulated seasons and assert:

**Match level (6v6, 30 min)**
- [ ] Goals per match mean in **6.0 – 9.0**, target 7.0
- [ ] Goals per minute in **0.20 – 0.30**
- [ ] Normal-play goal rate ~0.16–0.18/min; rule-window rate 2–4× that
- [ ] Shot conversion in **18 – 28%**
- [ ] Ball in play **~90%** of clock (walls/boards format)
- [ ] Yellow cards **0.5 – 2.0** per match; reds **0.01 – 0.06** per match (excluding rule-window dismissals, which are counted separately)
- [ ] Injuries **0.08 – 0.14** per team per match

**Distribution level**
- [ ] Goal counts overdispersed relative to Poisson (variance > mean); dispersion parameter is an exposed tunable
- [ ] Scoreline matrix, not just the mean, compared against reference
- [ ] Draw rate materially below the 11-a-side 24.5%
- [ ] Tie-break path exercised and theatrical (shootout/golden goal), because draws will still occur

**Season level (12 teams, 11 matchdays)**
- [ ] Home advantage term = 0 (single neutral venue)
- [ ] Audience/support modifier magnitude ≤ ~6 percentage points of win probability
- [ ] Champion win rate **60 – 70%**
- [ ] Bottom side win rate **5 – 15%**
- [ ] Heavy-mismatch single-match favourite win probability **75 – 85%**, never >90%

**Cross-check against 11-a-side** (for any full-size mode)
- [ ] 2.93 goals/game, 22.5 shots/game, 13.0% conversion
- [ ] 4.08 yellows, 0.137 reds per game
- [ ] ~55–57 min ball in play
- [ ] 0.45 injuries per team per match
- [ ] 40.8 / 24.5 / 34.7 home / draw / away split when home advantage is enabled

---

## 6. Gaps to close before this document is trustworthy

| Gap | How to close it |
|---|---|
| PL league-wide shots on target, passes, tackles, fouls | Pull the FBref 2024-25 Premier League season tables directly (blocked by the proxy in this environment) |
| PL league-wide xG per shot; reconciling 0.13 implied vs 0.10–0.12 published | Pull Understat or FBref shot-level data; check shot-definition differences |
| Baller League goals per game | Scrape Sofascore / the Baller League UK Hub match archive for UK S1–S3 and compute directly |
| Baller League shots, cards, and any discipline data | Likely not published; may require manual coding from broadcast footage |
| Futsal shots per match and conversion % | Search the futsal analytics literature specifically for match-level shot totals rather than per-player rates |
| Small-sided/creator-format card and injury rates | No published data located; our estimates are scaled from 11-a-side and futsal and are the weakest numbers in this document |
| Historical PL home-advantage baseline | Simple to obtain; not verified here |
| Empirical favourite-vs-underdog single-match probabilities | Derive from historical closing odds for a real league, or from a fitted Dixon–Coles/NB model on a real season |

---

*Companion document: `RESEARCH_CREATOR_FOOTBALL.md` — competition formats, creator economics, licensing targets, and the borrow/do-not-borrow boundary.*
