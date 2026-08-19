# Creator Football — Research Dossier

**Purpose:** competitive/format research for *Creator Football* (working title), a premium mobile football-management game.
**Status:** research and synthesis only. No source code implications are asserted here.
**Compiled:** 19 August 2026.
**Method note:** the research proxy in this environment blocked direct page fetches (`ballerleague.uk`, `kingsleague.pro`, Wikipedia, FBref, Opta/`theanalyst.com`, Sky Sports, footystats and others all returned `EGRESS_BLOCKED`). Every fact below therefore comes from indexed search summaries of those primary sources, with the source URL cited so a human can verify against the original. **Where a rulebook clause could not be read verbatim, that is flagged inline.** Anything not found is written as "not found" rather than guessed.

---

## 0. Ten-line executive summary

1. Two mature templates exist: **Kings League** (7v7, 40 min, card-driven chaos, Sunday session, Spain/global) and **Baller League** (6v6, 30 min, "Gamechanger" rule windows, Monday night, UK/US).
2. Both are **manager/president-owned by creators**, both use a **draft**, both use **wildcard slots** for pro/celebrity ringers, both are **free to watch** and monetise almost entirely through sponsorship.
3. Short format ≈ **2–3× the goals per match** of 11-a-side and ~**7× the goals per minute** — the single most important simulation consequence.
4. **Special-rule periods** (cards, gamechangers, dice) are the format's actual product: they manufacture a scripted swing moment on a timer, which is exactly what a mobile session needs.
5. The economics are fragile: Baller League **closed Germany (Feb 2026)** and **lost its Sky Sports deal (Aug 2026)**; Hashtag United **requested relegation** as semi-pro football was unsustainable.
6. Creator reach converts to **sponsorship**, not to gate/merch, at these scales — 85–90% of Baller League revenue is sponsorship.
7. Wrexham is the counter-example of the mature end: **£33.3m turnover**, 52% sponsorship, 58% of revenue from outside the UK — but still a **£14.8m loss**.
8. **OSM** is the accessibility benchmark (one simulated match per day, trivially simple core loop); **Football Manager** is the depth benchmark (quarter-second decision slices, 1–20 attributes); **EA FC** is the presentation benchmark (25 broadcast packages, 5v5 "Rush" mode).
9. All named creators and footballers below are **rights-holders**. They belong on a licensing target list only. Nothing about them may be shipped.
10. Formats are not copyrightable; names, logos, likenesses and team identities are. Section 8 draws that line explicitly.

---

## 1. Baller League

### 1.1 Origin and corporate facts

| Fact | Value | Source |
|---|---|---|
| Founded | Germany, 2024, by entrepreneur **Felix Starck**, backed by **Mats Hummels** and **Lukas Podolski** | [streamscharts](https://streamscharts.com/news/baller-league-week-1-information), [thenextweb](https://thenextweb.com/news/startup-baller-league-raises-25m-to-spark-new-era-for-football) |
| Venture funding | **$25m** raised | [thenextweb](https://thenextweb.com/news/startup-baller-league-raises-25m-to-spark-new-era-for-football) |
| First-year revenue | "**nearly £20m**" in its first year of operations; revenue reported as doubling YoY for three consecutive years (exact figures undisclosed) | [Forbes](https://www.forbes.com/sites/steveprice/2025/08/29/the-business-model-behind-the-baller-league/) |
| Revenue mix | **85–90% sponsorship** — higher than Kings League, vs ~40% typical for sports properties | [SportBusiness](https://www.sportbusiness.com/news/kings-league-turns-tables-on-football-revenue-mix/) |
| Anchor sponsorship value | **Xing €3m per season / €6m per year** for shirt rights across all 12 German teams | [SportBusiness](https://www.sportbusiness.com/news/kings-league-turns-tables-on-football-revenue-mix/) |
| Other sponsors | Pepsi, Nike, Grenade | [SportBusiness](https://www.sportbusiness.com/news/kings-league-turns-tables-on-football-revenue-mix/) |
| Player pay | **$400 / $600 / $800 per game**, three tiers | [Forbes](https://www.forbes.com/sites/steveprice/2025/08/29/the-business-model-behind-the-baller-league/) |
| Commercial agency | **TEAM Marketing** (the UEFA Champions League rights agency) engaged Aug 2025 for sales + strategic review | [SportBusiness](https://www.sportbusiness.com/news/team-enters-new-chapter-with-baller-league-remit/), [InsiderSport](https://insidersport.com/2025/08/20/baller-league-team-uefa-marketing/) |
| Germany | **Operations paused/closed Feb 2026**; season 4 postponed; stated reason — Germany "does not offer the necessary size and structural conditions" | [Inside World Football](https://www.insideworldfootball.com/2026/02/02/baller-league-suspends-german-operations-focuses-uk-us/), [SportsPro](https://www.sportspro.com/news/finance-investment/baller-league-germany-uk-usa-felix-starck-january-2026/) |
| UK broadcast | Sky Sports for seasons 1–3; **Sky did not renew** for the following season (Aug 2026). League says it wants free-to-air and is leaning on YouTube; also TikTok and Instagram | [InsiderSport](https://insidersport.com/2026/08/17/sky-exit-baller-leagues-test-model/), [Broadcast](https://www.broadcastnow.co.uk/broadcasting/sky-sports-renews-baller-league-for-third-season/5214882.article) |

### 1.2 Competition format

| Parameter | Value | Source |
|---|---|---|
| Format | Indoor **six-a-side** (5 outfield + GK) | [Sky Sports](https://www.skysports.com/football/news/12040/13326162/baller-league-uk-fixtures-schedule-teams-managers-and-rules-plus-how-to-watch-or-stream-on-sky-sports) |
| Teams | **12** (UK/Germany); **10** in the USA edition | [Sky Sports](https://www.skysports.com/football/news/12040/13326162/baller-league-uk-fixtures-schedule-teams-managers-and-rules-plus-how-to-watch-or-stream-on-sky-sports), [CBS Sports](https://www.cbssports.com/soccer/news/what-is-baller-league-usa-ronaldinho-ishowspeed-odell-beckham-cbs-sports-golazo-network-2026/) |
| Squad | Up to **12 permanent players** + at least one team manager + at least one coach; **2 additional wildcards** may be nominated per matchday | [ballerleague.uk rulebook](https://ballerleague.uk/en/page/rulebook) (via search summary) |
| Match length | **30 minutes**, two halves of 15 | [Sky Sports](https://www.skysports.com/football/news/11095/13520452/baller-league-uk-season-3-fixtures-schedule-teams-managers-and-how-to-watch-live-on-sky-sports) |
| Substitutions | **Rolling / unlimited**, players in and out as often as required | [bet365 News](https://news.bet365.com/en-gb/article/baller-league-rules-and-how-it-works/2025042913470175269) |
| Corners | **None.** If the defending team puts the ball behind its own goal line for the **third** time, the attacking team is awarded a penalty | [ballerleague.uk rulebook](https://ballerleague.uk/en/page/rulebook) (via search summary), [bet365 News](https://news.bet365.com/en-gb/article/baller-league-rules-and-how-it-works/2025042913470175269) |
| Penalty | Not a spot kick — a **1v1 run at the keeper with a 6-second clock** ("'90s MLS style") | [bet365 News](https://news.bet365.com/en-gb/article/baller-league-rules-and-how-it-works/2025042913470175269) |
| Gamechanger windows | **Two per match — the last 3 minutes of each half** | [ballerleague.uk](https://ballerleague.uk/en/gamechangers), [Sky Sports](https://www.skysports.com/football/news/11095/13520452/baller-league-uk-season-3-fixtures-schedule-teams-managers-and-how-to-watch-live-on-sky-sports) |
| Prize money | **Not found.** No published figure located in any indexed source | — |

### 1.3 The Gamechangers (the mechanic that matters most to us)

Reported season-3 set, each playable once per match:

| Gamechanger | Effect | Confidence |
|---|---|---|
| **3Play** | Teams shrink to 3-a-side (including GK); strict **30-second shot clock** per possession | High — consistent across sources |
| **Plus One** | Restart as **1v1 + goalkeepers**; each goal adds one outfield player per side until back to full strength | High |
| **Onside** | All offside suspended for 3 minutes; attackers may stand anywhere | High |
| **The Line** | Goals **from in front of / behind the offside line** are treated differently — one source says long-range goals **count double**, another says goals from inside the box **don't count** | **Conflicting.** [inkl](https://www.inkl.com/news/baller-league-season-3-the-gamechangers-explained) says double for long-range; [DAILY WAFFLE](https://www.dailywaffle.co.uk/2025/05/the-baller-league-uk-rules-origins-motivations-and-popularity/) says box goals void. Treat both as viable design variants; verify against the live rulebook before quoting |
| **Fairplay** | Either (a) any foul/handball/dissent = **immediate send-off with no replacement**, or (b) cancel the opponent's active Gamechanger | **Conflicting** between [inkl](https://www.inkl.com/news/baller-league-season-3-the-gamechangers-explained) and other summaries |
| **1-on-1** | Attacker vs goalkeeper duels | Medium |
| **Fast Forward** | Ball may not be played back into the attacking team's own half | Medium — reported for the German edition |

Selection is described as random, "often involving a wheel of fortune or similar mechanism" ([inkl](https://www.inkl.com/news/baller-league-season-3-the-gamechangers-explained)). The exact per-season set has changed; treat the list as a *pattern*, not a fixed canon.

**Design read:** the value is structural, not thematic. Two guaranteed, pre-announced, clock-anchored swing windows per match = two guaranteed re-engagement beats in a 30-minute session.

### 1.4 Draft

- Open **trials in cities across the UK**; entrants scouted, **rated and ranked** on ability and experience; managers receive scouting reports to inform picks. ([bet365 News](https://news.bet365.com/en-gb/article/baller-league-draft-all-you-need-to-know/2025031010360618899))
- Pool includes ex-Premier League players, futsal players, released academy players and social-media stars. ([bet365 News](https://news.bet365.com/en-gb/article/baller-league-draft-all-you-need-to-know/2025031010360618899))
- **Draft order determined by 12 rounds of numbered quiz questions** — closest answer picks first, furthest last. A genuinely gamifiable idea. ([bet365 News](https://news.bet365.com/en-gb/article/baller-league-draft-all-you-need-to-know/2025031010360618899))
- Draft completes when each of the 12 teams has 12 players.

### 1.5 Venue, schedule, broadcast

| Item | Value | Source |
|---|---|---|
| UK venue | **Copper Box Arena**, Queen Elizabeth Olympic Park, London (seasons 1–3) | [Copper Box Arena](https://copperboxarena.org.uk/news/baller-league-set-to-return-to-copper-box-arena-for-a-third-season) |
| Session shape | **Six 30-minute matches per matchday**, from ~17:05 BST, Monday evenings | [Sky Sports](https://www.skysports.com/football/news/11095/13520452/baller-league-uk-season-3-fixtures-schedule-teams-managers-and-how-to-watch-live-on-sky-sports) |
| Season length | Season 2: **11 consecutive Mondays** from 27 Oct 2025. Season 3: 11 consecutive Mondays. Season 1: **12 matchdays**, 24 Mar – 12 Jun 2025, **69 matches** | [SportsPro](https://www.sportspro.com/news/baller-league-sky-sports-tv-rights-uk-season-two-october-2025/), [Copper Box Arena](https://copperboxarena.org.uk/news/baller-league-set-to-return-to-copper-box-arena-for-a-third-season) |
| Finals | Season 1 final at **The O2**, London — **SDS FC 4–3 MVPs United** | (via search summary of Wikipedia, [Baller League UK – Season 1](https://en.wikipedia.org/wiki/Baller_League_UK_%E2%80%93_Season_1)) |

### 1.6 Audience

| Metric | Value | Source |
|---|---|---|
| UK Season 1 | ~**1 million YouTube streams per matchday night**, 12 matchdays | [Broadcast](https://www.broadcastnow.co.uk/broadcasting/targeting-younger-audiences-with-baller-league/5211791.article) |
| UK Season 2 | Averaging **2 million live viewers per week** across Sky, YouTube, Twitch and socials; **75% under 34** | [Broadcast](https://www.broadcastnow.co.uk/broadcasting/targeting-younger-audiences-with-baller-league/5211791.article) |
| Germany Season 2 (Jul–Oct 2024) | **5.2m hours watched** on Twitch, averaging **>1.3m viewing hours/month** across 13 streams | [Streams Charts](https://streamscharts.com/news/baller-league-season-2-viewership-results) |

### 1.7 Baller League USA (launched March 2026, Miami)

10 teams; **iShowSpeed is league president and also manages a team**; other managers include Ronaldinho, Usain Bolt, Odell Beckham Jr, Druski, xQc, AMP, WestCol, J Balvin + KidSuper, Marlon. Broadcast on **CBS Sports Golazo Network**. Two halves of 15 minutes; walls keep the ball in play. ([CBS Sports](https://www.cbssports.com/soccer/news/what-is-baller-league-usa-ronaldinho-ishowspeed-odell-beckham-cbs-sports-golazo-network-2026/), [Streams Charts](https://streamscharts.com/news/kai-cenat-xqc-and-sports-legends-join-baller-league-usa), [ballerleague.us](https://ballerleague.us/en/post/meet-the-teams-the-clubs-competing-in-season-1))

---

## 2. Kings League

### 2.1 Origin and corporate facts

| Fact | Value | Source |
|---|---|---|
| Founded | **December 2022**, Spain, by **Gerard Piqué** via **Kosmos** | [Kosmos](https://www.kosmosholding.com/projects/kings-league/), [SponsorUnited](https://www.sponsorunited.com/insights/kings-league) |
| Format | **Seven-a-side** | [SponsorUnited](https://www.sponsorunited.com/insights/kings-league) |
| Total raised | **$128m**; latest a **$63m Series B (3 Feb 2026)**; a **€60m round in 2024** (Left Lane Capital, Fillip) | [PitchBook](https://pitchbook.com/profiles/company/521967-97), [Dealroom](https://app.dealroom.co/companies/kings_league) |
| Revenue | **~$99.7m** reported Sept 2025 (third-party estimate — treat with caution); Piqué says revenue more than doubled 2023→2024 with an ambition to treble in 2025 | [GetLatka](https://getlatka.com/companies/kingsleague.pro), [SportsPro](https://www.sportspro.com/news/kings-league-gerard-pique-fans-gen-z-twitch-streaming-revenue-sponsorship/) |
| Profitability / audience | Piqué: profitable "since day one"; **85% of fans under 34** | [SportsPro](https://www.sportspro.com/news/kings-league-gerard-pique-fans-gen-z-twitch-streaming-revenue-sponsorship/) |
| Revenue to teams | League-level sponsorship and kit sales revenue is **shared with teams**; described as "eight figures" | [JohnWallStreet](https://www.johnwallstreet.com/p/piqu-s-kings-league-successfully-leveraging-streamers-to-draw-engage-fans) |

### 2.2 Match format

| Parameter | Value | Source |
|---|---|---|
| Duration | **40 minutes**, two halves of 20, stoppage time added at the end of each half | [Kings League](https://kingsleague.pro/en/how-to-play), [CBS Sports](https://www.cbssports.com/soccer/news/making-sense-of-kings-world-cup-clubs-wild-rules-from-secret-cards-to-dice-rolls-heres-how-to-watch/) |
| Kick-off | Players wait on their own goal lines; the ball is **released from a cage above midfield**; both teams race for it (water-polo style) | [CBS Sports](https://www.cbssports.com/soccer/news/making-sense-of-kings-world-cup-clubs-wild-rules-from-secret-cards-to-dice-rolls-heres-how-to-watch/) |
| Ramp-up | Starts **1v1 + goalkeepers**; **one extra player per side per minute** until 7v7 | [CBS Sports](https://www.cbssports.com/soccer/news/making-sense-of-kings-world-cup-clubs-wild-rules-from-secret-cards-to-dice-rolls-heres-how-to-watch/) |
| Substitutions | **Free after minute 5** | [CBS Sports](https://www.cbssports.com/soccer/news/making-sense-of-kings-world-cup-clubs-wild-rules-from-secret-cards-to-dice-rolls-heres-how-to-watch/) |
| Dice | At **minute 18** a die is rolled from the stands, setting the player count for the **last 2 minutes of the first half**: 1v1, 2v2 or 3v3 | [CBS Sports](https://www.cbssports.com/soccer/news/making-sense-of-kings-world-cup-clubs-wild-rules-from-secret-cards-to-dice-rolls-heres-how-to-watch/) |
| Endgame | In **minutes 38–40**, if the score is level, **all goals count double** | [CBS Sports](https://www.cbssports.com/soccer/news/making-sense-of-kings-world-cup-clubs-wild-rules-from-secret-cards-to-dice-rolls-heres-how-to-watch/) — reported in a Kings World Cup context; confirm it applies to league play |
| Tie-break | **Penalty shootout in the Kings format** (see 2.4) | [Kings League Book of Rules](https://cms-es.kingsleague.pro/uploads/book-of-rules.pdf) |

### 2.3 The secret weapon cards ("armas secretas")

Before each match every coach draws an envelope containing one secret weapon, playable **once per game** ([Gizmodo](https://gizmodo.com/kings-league-gerard-pique-twitch-ibai-soccer-1850159221)). Reported activation windows differ between sources — one gives **minutes 5–17 and 23–36**, another says "from half-time until the end", and **President Penalty is playable any time after minute 6**. **Flagged as uncertain**; the authoritative statement is the [Book of Rules](https://cms-es.kingsleague.pro/uploads/book-of-rules.pdf) which could not be fetched here.

| Card | Effect | Source |
|---|---|---|
| **Double Goal** | Your goals count double for the next ~2–4 minutes (President Penalty excluded) | [Goal.com](https://www.goal.com/en-us/news/what-is-gerard-pique-s-kings-league-format-rules-teams-schedule-tv-channels-and-streaming/bltcda3d298faa098d0) |
| **Suspension / Red Card** | Remove one opposing player from the pitch for 4 minutes | [Goal.com](https://www.goal.com/en-us/news/what-is-gerard-pique-s-kings-league-format-rules-teams-schedule-tv-channels-and-streaming/bltcda3d298faa098d0) |
| **Star Player** | Designate a player (armband); his first goal counts double | [Goal.com](https://www.goal.com/en-us/news/what-is-gerard-pique-s-kings-league-format-rules-teams-schedule-tv-channels-and-streaming/bltcda3d298faa098d0) |
| **Penalty** | An automatic penalty kick | [Goal.com](https://www.goal.com/en-us/news/what-is-gerard-pique-s-kings-league-format-rules-teams-schedule-tv-channels-and-streaming/bltcda3d298faa098d0) |
| **Shoot-out / Penalty from the centre** | Attacker starts at midfield, **5 seconds** to beat the keeper 1v1; unlimited moves inside those 5 seconds | [CBS Sports](https://www.cbssports.com/soccer/news/making-sense-of-kings-world-cup-clubs-wild-rules-from-secret-cards-to-dice-rolls-heres-how-to-watch/) |
| **President Penalty** | The team **president** personally takes a penalty; usable any time after minute 6; if the president is absent a player may take it | [Goal.com](https://www.goal.com/en-us/news/what-is-gerard-pique-s-kings-league-format-rules-teams-schedule-tv-channels-and-streaming/bltcda3d298faa098d0) |
| **Joker / Wild Card** | Play any other card, or **cancel or steal the opponent's** card | [Goal.com](https://www.goal.com/en-us/news/what-is-gerard-pique-s-kings-league-format-rules-teams-schedule-tv-channels-and-streaming/bltcda3d298faa098d0) |
| **Piqué card** | Gerard Piqué joins your team as a player for that match (novelty, single copy) | [Gizmodo](https://gizmodo.com/kings-league-gerard-pique-twitch-ibai-soccer-1850159221) |
| **Reverse Penalty** (new, 2025/26, fan-voted) | The drawing team **nominates an opposing player to take a penalty**. If he scores, the goal does not count; if he misses, the drawing team is awarded a goal | [Kings League World on X](https://x.com/_KingsWorld/status/1977151199184080958), [Streams Charts](https://streamscharts.com/news/new-kings-league-season-announcement) |

**On "the 12 secret cards":** the brief assumed 12. The best-sourced description of the actual deck is a **weighted deck of ~20 physical cards drawn from a smaller set of distinct card types**, with rarity balancing — reportedly **Double Goal ×6**, **Penalty-from-the-centre ×4**, **Wild Card ×1**, **Piqué ×1** ([Gizmodo](https://gizmodo.com/kings-league-gerard-pique-twitch-ibai-soccer-1850159221)). Card types have also been added and retired between seasons. **Do not state "12 cards" as fact.** The transferable idea is *a weighted deck of distinct effects where the strongest effects are single-copy*.

### 2.4 Penalty shootout

Ties are broken with the **Kings-format shootout**, not 12-yard penalties: the taker starts from **midfield** and has **5 seconds** to score 1v1 against the goalkeeper; most conversions wins. A 2025/26 clarification allows the taker to **play a rebound off the post** (if the ball did not touch the keeper) while the countdown still runs. ([CBS Sports](https://www.cbssports.com/soccer/news/making-sense-of-kings-world-cup-clubs-wild-rules-from-secret-cards-to-dice-rolls-heres-how-to-watch/), [Kings League](https://kingsleague.pro/en/espana/news/new-rules-kings-league-infojobs-split-5))

For the 2026 Kings World Cup Nations the league also introduced **three-team shootouts** to resolve multi-way ties. ([Kings League](https://kingsleague.pro/en/kwc-nations/news/three-team-shootout-kwc-nations-brazil-2026))

### 2.5 Squads, draft, wildcards, presidents

| Item | Value | Source |
|---|---|---|
| Squad size | **12**, fixed for the whole split | [ScoreRoom](https://scoreroom.com/kings-league-what-is-it-rules-tournaments/), [GiveMeSport](https://www.givemesport.com/kings-league-rules/) |
| Composition | **First 10 selected in a draft**; **player 11** is a wildcard fixed for the whole season; **player 12** is a wildcard that **may change each week** | [GiveMeSport](https://www.givemesport.com/kings-league-rules/) |
| Talent pool | Mix of ex-professionals, amateurs and wildcards, allocated by **draft and trades** | [Grokipedia: Kings League](https://grokipedia.com/page/Kings_League) |
| Presidents | Each team is presided over by a streamer, YouTuber or retired footballer | [Grokipedia: Kings League](https://grokipedia.com/page/Kings_League) |
| Spain teams (indicative) | Porcinos FC (Ibai Llanos), Saiyans FC (TheGrefg), Ultimate Móstoles (DjMaRiiO), El Barrio (Adri Contreras), Kunisports (Sergio Agüero), Pio FC (Rivers), Aniquiladores FC (Juan Guarnizo), Los Troncos (Perxitaa), 1K FC (Iker Casillas), Rayo de Barcelona (Spursito), xBuyer Team (Hnos. Buyer), Jijantes FC (Gerard Romero) | [Kings League Spain](https://kingsleague.pro/en/espana/teams), [AL DÍA](https://www.aldianews.com/en/culture/heritage-and-history/kings-league) |
| Notable pro wildcards | Ronaldinho (Porcinos FC), Iker Casillas, Sergio Agüero, Xavi Hernández | [All Football](https://m.allfootballapp.com/news/Serie-A/What-former-players-play-in-Piques-Kings-League-Ronaldinho-Aguero-Casillas../3036573), [Soccerway](https://es.soccerway.com/noticias/espectaculo-servido-en-la-kings-league-ronaldinho-ficha-por-el-porcinos-fc/p05SMNu2) |

### 2.6 Season structure and the Sunday session

- Apertura/Clausura shape: each year splits into a **Winter Split** and a **Summer Split**, each with a league stage plus playoffs. ([Wikipedia: Kings League Spain](https://en.wikipedia.org/wiki/Kings_League_Spain))
- League stage: **12 teams, 11 matchdays**, single round-robin; **top 8 advance to playoffs**. ([Wikipedia: Kings League Spain](https://en.wikipedia.org/wiki/Kings_League_Spain))
- **The Sunday session:** every matchday is a **single ~6-hour block, Sundays roughly 16:00–22:00 CET**, all matches at **one venue** — the **Cupra Arena** on the Port of Barcelona — streamed on league channels and on the presidents' own channels simultaneously. ([Softonic](https://en.softonic.com/articles/final-kings-league-dates-favorite-times), [Kosmos](https://www.kosmosholding.com/projects/kings-league/))
- The presidents co-streaming their own team's match is the distribution engine — one event, twelve concurrent, differently-framed broadcasts.

### 2.7 Audience

| Metric | Value | Source |
|---|---|---|
| 2023 final peak | **2.1m peak viewers** | [Streams Charts](https://streamscharts.com/news/kings-league-2023-recap) |
| xBuyer vs El Barrio final | **1.38m peak concurrent** | [Streams Charts](https://streamscharts.com/news/kings-league-viewership-statistics-most-popular-matches-teams-and-broadcast-channels) |
| Platform split | **Twitch >76% of hours watched**; YouTube and TikTok most of the rest | [Streams Charts](https://streamscharts.com/news/kings-league-viewership-statistics-most-popular-matches-teams-and-broadcast-channels) |

---

## 3. Icon League, and the wider creator-football field

### 3.1 The Icon League (Germany)

| Parameter | Value | Source |
|---|---|---|
| Founders | **Toni Kroos** and streamer **Elias "EliasN97" Nerlich** | [OMR](https://omr.com/en/daily/toni-kross-the-icon-league) |
| Launch | Publicly announced 2024; first season kicked off **September 2024** | [Yahoo Sports](https://sports.yahoo.com/toni-kroos-set-launch-icon-095309439.html) — one summary says "launched at the end of 2023"; **treat the exact launch date as uncertain** |
| Pitch | **45 × 22 m**, artificial turf, **boards** (ball stays in play) | [Sports Illustrated DE](https://www.sportsillustrated.de/fussball/icon-league-alle-teams-regeln-formate-und-kapitaene) |
| Format | **5 vs 5**, halves of **12 minutes** | [Sports Illustrated DE](https://www.sportsillustrated.de/fussball/icon-league-alle-teams-regeln-formate-und-kapitaene) |
| Special rules | **Random special rules per game** — golden goal, joker goals, double points ("Rulebreaker") | [Red Bull](https://www.redbull.com/de-de/the-icon-league-regeln) |
| Tie-break | Straight to **golden goal or penalty shootout** | [Sports Illustrated DE](https://www.sportsillustrated.de/fussball/icon-league-alle-teams-regeln-formate-und-kapitaene) |
| Teams | **14** | [Sports Illustrated DE](https://www.sportsillustrated.de/fussball/icon-league-alle-teams-regeln-formate-und-kapitaene) |
| Season | **13 matchdays + play-ins + final tournament** | [Sports Illustrated DE](https://www.sportsillustrated.de/fussball/icon-league-alle-teams-regeln-formate-und-kapitaene) |
| Captains | Franck Ribéry, David Alaba, Claudio Pizarro among others | [Sports Illustrated DE](https://www.sportsillustrated.de/fussball/icon-league-alle-teams-regeln-formate-und-kapitaene) |
| Funding | **€15m** raised, including investment from **Jürgen Klopp's family office** | [OMR](https://omr.com/de/daily/icon-league-toni-kroos-elias-nerlich-zukunft) |
| 2026 | **Season 4 in Berlin, March 2026.** B2B United (Benjamin Henrichs) exits after three seasons; **Eintracht Spandau (HandOfBlood) crosses over from the now-closed German Baller League** | [Sports Illustrated DE](https://www.sportsillustrated.de/fussball/icon-league-season-4-berlin-spielplan-ergebnisse-teams-und-kapitaene), [GamesWirtschaft](https://www.gameswirtschaft.de/sport/eintracht-spandau-wechsel-the-icon-league-250226/) |

**What makes it distinct:** *captain-led rather than president-led*, smaller pitch, shorter halves (12 min), and rule chaos framed as **"Rulebreaker"** cards rather than as timed windows. It also survived the German market that Baller League abandoned.

### 3.2 La Liga de Creadores / LatAm creator leagues

Loosely-governed, high-volume, tourism-adjacent. **130–140+ influencers**, tournaments run as **3-day festivals** (Acapulco), with **Cancún** confirmed as a host; teams like **Guacamayos FC** (Guanajuato) and **Fuerza Maya** compete toward a **creator club world championship**. Parallel national leagues exist in **Ecuador**, **Uruguay** and **Colombia**. Formats are not standardised and no published rulebook was located.
Sources: [Heraldo de México QR](https://quintanaroo.heraldodemexico.com.mx/local/2026/2/23/cancun-sede-de-la-liga-de-creadores-de-contenido-14625.html), [La Silla Rota](https://lasillarota.com/guanajuato/vida/2025/11/3/guacamayos-fc-primer-equipo-de-creadores-de-guanajuato-llega-la-liga-de-creadores-566301.html), [El Sol de Acapulco](https://oem.com.mx/elsoldeacapulco/deportes/influencers-mostraran-belleza-turistica-de-acapulco-en-torneo-de-futbol-26621943), [ALDIA Ecuador](https://www.aldia.com.ec/primer-campeonato-creadores-contenido/)

**Distinct trait:** the *event* is the product, not the league table. Useful as a model for a limited-time tournament mode.

### 3.3 The Sidemen Charity Match (one-off spectacle)

| Metric | 2025 edition | Source |
|---|---|---|
| Venue / attendance | **Wembley Stadium, 90,000**, sold out in **3 hours** | [Front Office Sports](https://frontofficesports.com/influencer-soccer-match-sells-out-wembley-stadium-draws-over-14m-views/), [Wembley](https://www.wembleystadium.com/events/2025/Sidemen-Charity-Match-2025) |
| Peak concurrent | **~2.5–2.76m** | [Streams Charts](https://streamscharts.com/news/2025-sidemen-charity-match) |
| Total views | **14m+** | [Front Office Sports](https://frontofficesports.com/influencer-soccer-match-sells-out-wembley-stadium-draws-over-14m-views/) |
| Raised | **£4.7m** (vs £2.4m in 2023) | [Tubefilter](https://www.tubefilter.com/2025/03/10/sidemen-charity-football-soccer-match-2025-creator-sports/) |
| Result | **9–9**, decided on penalties | [Streams Charts](https://streamscharts.com/news/2025-sidemen-charity-match) |

**Distinct trait:** annual, single-fixture, maximum-spectacle. The 9–9 scoreline is itself a data point about what creator-football audiences reward. A once-a-year mega-event is a strong live-ops shape.

### 3.4 Comparison table

| | Baller League | Kings League | Icon League | Sidemen Match | La Liga de Creadores |
|---|---|---|---|---|---|
| Players a side | 6 | 7 | 5 | 11 | varies |
| Match length | 30 min (2×15) | 40 min (2×20) | 24 min (2×12) | 90 min | varies |
| Chaos mechanic | Gamechangers, last 3 min of each half | Secret weapon cards + minute-18 dice | Rulebreaker special rules | none (spectacle only) | none formalised |
| Creator role | **Manager** | **President** | **Captain** | **Player** | Player / team owner |
| Talent allocation | Draft (12 per team) from open trials | Draft (10) + 2 wildcards | not found | Invitational | Invitational |
| Session shape | 6 matches, Monday evening | ~6 hours, Sunday | matchday block | one match/year | 3-day festival |
| Home venue | Copper Box Arena, London | Cupra Arena, Barcelona | rotating German cities | Wembley | rotating resort cities |
| Distribution | YouTube-first (Sky exited Aug 2026) | Twitch-first + president co-streams | Twitch/YouTube | YouTube | TikTok/YouTube |

---

## 4. Creator economics in football

### 4.1 Wrexham AFC — the mature end of the model

| Metric | 2023-24 (FY to 30 Jun 2024) | 2024-25 (FY to 30 Jun 2025) |
|---|---|---|
| Turnover | **£26.725m** (up 155% from £10.478m) | **£33.33m** (+24%) |
| Sponsorship & advertising | £13.181m (commercial) | **£17.34m — 52% of all revenue**, +32% YoY |
| Retail | £4.455m | **£5.07m** |
| Matchday | £5.020m | **£4.64m** |
| Revenue outside UK | 52.1% | **57.7%** (£19.24m RoW vs £13.51m UK) |
| Result | — | **£14.8m loss** despite record income |
| Other | Capacity 13,561 (temporary 3,000-seat Kop); **313 jobs**; **£69m Kop deal**; *Welcome to Wrexham* season 4 commissioned | |

Sources: [Wrexham AFC 2025 accounts](https://www.wrexhamafc.co.uk/news/2026/march/27/annual-report-and-financial-statements---record-turnover-of--33-3-million-announced/), [Wrexham AFC 2024 accounts](https://www.wrexhamafc.co.uk/news/2025/march/31/annual-report-and-financial-statements---record-turnover-of--26-7-million-announced/), [Wrexham.com](https://wrexham.com/news/wrexham-afc-accounts-reveal-69m-kop-deal-313-jobs-and-19m-income-from-overseas-as-club-grows-288578.html), [Wrexham Reds](https://www.wrexhamreds.com/news/wrexham-finances-explained-as-record-income-still-leads-to-14-8m-loss/)

**Read:** the documentary did not monetise directly — it monetised the **commercial proposition**. Sponsorship, not gate or merch, is where audience converts. And even at £33m of revenue the club loses money, because sporting ambition scales costs faster than attention scales income.

### 4.2 Hashtag United — the cautionary tale

- **>2m YouTube subscribers**; **>2m social followers**, comparable to Bournemouth, the Premier League club with the fewest. ([BBC Sport](https://feeds.bbci.co.uk/sport/football/44287961), [Business of Sport](https://businessofsport.fm/podcasts/spencer-owen))
- **14-strong full-time media team** producing continuous content — a revenue source clubs at their level do not have. ([Goal.com](https://www.goal.com/en-sa/news/hashtag-united-club-founder-youtube-giants-reality-running-non-league-side/blt6cd636c2465cc4c7))
- **Average attendance 216** at their temporary home in Aveley, Essex.
- After three promotions to the semi-professional Isthmian Premier, the club **requested demotion for 2026-27** because competing there was "unsustainable". Owner Spencer Owen: "we do not benefit from the core business model that clubs 100 years old in our division have, whether gate receipts or food-and-beverage income."
Sources: [The Guardian via MSN](https://www.msn.com/en-us/sports/soccer/from-youtube-to-real-life-why-hashtag-united-want-to-go-down/ar-AA1ZVIdQ), [Business of Sport](https://businessofsport.fm/podcasts/spencer-owen)

**Read:** 2 million followers ≠ 2 million customers. **Reach is not fandom, and fandom is not matchday revenue.** A creator club's P&L is a media P&L wearing a football club's cost base.

### 4.3 SE Dons

Founded 2014 in Lewisham by John McHugh, his son Andrew and son-in-law Ryan Palmer; grew from Sunday league to **>240,000 YouTube subscribers** and millions of social followers; **merged with Forest Hill Park in June 2024** to enter non-league football. Revenue figures: **not found**.
Sources: [SCEFL](https://scefl.com/sceflclub-sedons), [Wikipedia: SE Dons F.C.](https://en.wikipedia.org/wiki/SE_Dons_F.C.), [5aside.com](https://5aside.com/blog/se-dons-content-producers/)

### 4.4 The creator-league revenue model

| Property | Sponsorship share of revenue | Note |
|---|---|---|
| Baller League | **85–90%** | Explicitly refuses to charge fans — free-to-watch is the sponsorship pitch |
| Kings League | High, but **lower than Baller League** | Adds ticketing, merchandising, licensing and digital content via Kosmos |
| Typical sports property | **~40%** | |

Sources: [SportBusiness](https://www.sportbusiness.com/news/kings-league-turns-tables-on-football-revenue-mix/), [The Sports Stack](https://www.thesportsstack.com/p/sports-business-innovation-how-anti-monetisation-strategy-creates-premium-sponsorship-deals), [Kosmos](https://www.kosmosholding.com/projects/kings-league/)

Baller League's own creator strategy is summarised by Digiday as *"reach is not the same as fandom"* — the league deliberately converts creator reach into **repeat-appointment viewing** before selling it. ([Digiday](https://digiday.com/marketing/baller-leagues-creator-strategy-reach-is-not-the-same-as-fandom/))

### 4.5 Ballpark reference numbers (for economy tuning, not for quoting)

| Quantity | Figure | Source |
|---|---|---|
| Top-tier shirt sponsorship, whole creator league (12 teams) | **€3m/season, €6m/year** (Xing, Baller League Germany) | [SportBusiness](https://www.sportbusiness.com/news/kings-league-turns-tables-on-football-revenue-mix/) |
| Creator-league player wage | **$400–$800 per match** | [Forbes](https://www.forbes.com/sites/steveprice/2025/08/29/the-business-model-behind-the-baller-league/) |
| Non-league creator club gate | **216 average attendance** | [MSN/Guardian](https://www.msn.com/en-us/sports/soccer/from-youtube-to-real-life-why-hashtag-united-want-to-go-down/ar-AA1ZVIdQ) |
| League-Two-ish matchday revenue for a hyper-successful creator club | **£4.6–5.0m/yr at 13,561 capacity** (Wrexham — an extreme outlier) | [Wrexham AFC](https://www.wrexhamafc.co.uk/news/2026/march/27/annual-report-and-financial-statements---record-turnover-of--33-3-million-announced/) |
| Retail/merch for the same | **£5.07m/yr** | [Wrexham AFC](https://www.wrexhamafc.co.uk/news/2026/march/27/annual-report-and-financial-statements---record-turnover-of--33-3-million-announced/) |
| One-off creator mega-event | **90,000 tickets, £4.7m raised, 14m views** | [Front Office Sports](https://frontofficesports.com/influencer-soccer-match-sells-out-wembley-stadium-draws-over-14m-views/), [Tubefilter](https://www.tubefilter.com/2025/03/10/sidemen-charity-football-soccer-match-2025-creator-sports/) |

**Fragility signals to build into the economy loop:** Baller League **closed its founding market** (Germany, Feb 2026) and **lost its linear broadcast deal** (Aug 2026); Hashtag United asked to be **relegated**. A creator-club economy in our game should be able to *shrink*, not only grow.

---

## 5. Licensing target list (rights-holders — reference only)

> **This is a licensing prospect list, not a content list.** Every name below is a rights-holder whose name, image and likeness are protected. **No name, handle, likeness, team name, crest or brand from this section may be hardcoded, referenced, parodied or shipped in the game.** They are candidates for a future *licensed content pack*, contingent on an executed agreement per individual and per league. Audience figures are approximate, drawn from indexed public sources at the dates cited, and change continuously — re-verify before any commercial conversation.

### 5.1 Tier 1 — global creator reach

| Name | Primary platform | Approx. audience | League / role | Plays or manages | Source |
|---|---|---|---|---|---|
| IShowSpeed | YouTube | **~54.2m** YT subs, ~4.7m Twitch | Baller League USA — **league president + team manager (Speed United)**; Sidemen match player | Both | [Vibromedia](https://vibromedia.com/streamer-stats/), [CBS Sports](https://www.cbssports.com/soccer/news/what-is-baller-league-usa-ronaldinho-ishowspeed-odell-beckham-cbs-sports-golazo-network-2026/) |
| KSI | YouTube | Sidemen collective; individual figure **not verified in this research** | Baller League UK — headline figure/manager | Manages | [SportBible](https://www.sportbible.com/football/football-news/baller-league-ksi-sidemen-gary-lineker-689192-20250226) |
| Ibai Llanos | Twitch | **~19.8m** Twitch followers, ~16.1m YT | Kings League — **president, Porcinos FC** | Manages (occasional player) | [Vibromedia](https://vibromedia.com/streamer-stats/), [AL DÍA](https://www.aldianews.com/en/culture/heritage-and-history/kings-league) |
| TheGrefg | YouTube/Twitch | **~19.6m** YT, ~12.3m Twitch | Kings League — **president, Saiyans FC** | Manages | [Vibromedia](https://vibromedia.com/streamer-stats/), [Kings League Spain](https://kingsleague.pro/en/espana/teams) |
| Kai Cenat | Twitch | not verified here | Baller League USA | Manages | [Streams Charts](https://streamscharts.com/news/kai-cenat-xqc-and-sports-legends-join-baller-league-usa) |
| xQc | Twitch/Kick | not verified here | Baller League USA — **Glitch FC** | Manages | [ballerleague.us](https://ballerleague.us/en/post/meet-the-teams-the-clubs-competing-in-season-1) |
| Miniminter (Simon Minter) | YouTube | **>10m** subs | Baller League UK — manager | Manages | [Sky Sports](https://www.skysports.com/football/news/11095/13346437/baller-league-teams-and-managers-angry-ginge-pk-humble-arsenal-invincibles-john-terry-alisha-lehmann-and-more) |
| TBJZL (Tobi Brown) | YouTube | **>5m** subs, >576m views | Baller League UK — manager | Manages | [Sky Sports](https://www.skysports.com/football/news/11095/13346437/baller-league-teams-and-managers-angry-ginge-pk-humble-arsenal-invincibles-john-terry-alisha-lehmann-and-more) |
| Druski | YouTube/Instagram | not verified here | Baller League USA — **Club 360** | Manages | [ballerleague.us](https://ballerleague.us/en/post/meet-the-teams-the-clubs-competing-in-season-1) |
| WestCol | Kick/Twitch (Colombia) | not verified here | Baller League USA — **FTW FC** | Manages | [ballerleague.us](https://ballerleague.us/en/post/meet-the-teams-the-clubs-competing-in-season-1) |
| Elias "EliasN97" Nerlich | Twitch (Germany) | not verified here | **Co-founder, Icon League** | Founder/manager | [OMR](https://omr.com/en/daily/toni-kross-the-icon-league) |
| HandOfBlood | Twitch (Germany) | not verified here | Eintracht Spandau — Icon League S4 | Manages | [GamesWirtschaft](https://www.gameswirtschaft.de/sport/eintracht-spandau-wechsel-the-icon-league-250226/) |
| Angry Ginge | YouTube/Twitch (UK) | not verified here | Baller League UK — **Yanited** | Manages | [Sky Sports](https://www.skysports.com/football/news/11095/13346437/baller-league-teams-and-managers-angry-ginge-pk-humble-arsenal-invincibles-john-terry-alisha-lehmann-and-more) |
| Sharky | YouTube (UK) | not verified here | Baller League UK — **SDS FC** (S1 champions) | Manages | [Sky Sports](https://www.skysports.com/football/news/11095/13346437/baller-league-teams-and-managers-angry-ginge-pk-humble-arsenal-invincibles-john-terry-alisha-lehmann-and-more) |
| Juan Guarnizo | Twitch (LatAm) | not verified here | Kings League — **Aniquiladores FC** | Manages | [AL DÍA](https://www.aldianews.com/en/culture/heritage-and-history/kings-league) |
| DjMaRiiO | YouTube (Spain) | not verified here | Kings League — **Ultimate Móstoles** | Manages | [Kings League Spain](https://kingsleague.pro/en/espana/teams) |
| Perxitaa, Rivers, Spursito, Adri Contreras, Gerard Romero, Hnos. Buyer | Twitch/YouTube (Spain) | not verified here | Kings League presidents | Manage | [Kings League Spain](https://kingsleague.pro/en/espana/teams) |
| Juanpis | TikTok (Mexico) | **>800k** TikTok | **President, La Liga de Creadores**; co-president, Mexican creator national team | Manages | [El Sol de Acapulco](https://oem.com.mx/elsoldeacapulco/deportes/influencers-mostraran-belleza-turistica-de-acapulco-en-torneo-de-futbol-26621943) |
| Los Mopris (Alcaraz brothers) | Multi-platform (Mexico) | **>18m** combined | La Liga de Creadores | Play | [El Sol de Acapulco](https://oem.com.mx/elsoldeacapulco/deportes/influencers-mostraran-belleza-turistica-de-acapulco-en-torneo-de-futbol-26621943) |

### 5.2 Footballers, ex-professionals and sport figures in creator leagues

| Name | League | Role | Source |
|---|---|---|---|
| Gerard Piqué | Kings League | **Founder / Kosmos**; also a playable "Piqué card" novelty | [Kosmos](https://www.kosmosholding.com/projects/kings-league/) |
| Ronaldinho | Kings League (Porcinos FC, player); Baller League USA (**MW FC**, manager) | Player + manager | [Soccerway](https://es.soccerway.com/noticias/espectaculo-servido-en-la-kings-league-ronaldinho-ficha-por-el-porcinos-fc/p05SMNu2), [CBS Sports](https://www.cbssports.com/soccer/news/what-is-baller-league-usa-ronaldinho-ishowspeed-odell-beckham-cbs-sports-golazo-network-2026/) |
| Iker Casillas | Kings League — **1K FC** | President | [Kings League Spain](https://kingsleague.pro/en/espana/teams) |
| Sergio "Kun" Agüero | Kings League — **Kunisports** | President | [SponsorUnited](https://www.sponsorunited.com/insights/kings-league) |
| Xavi Hernández | Kings League | Guest player | [All Football](https://m.allfootballapp.com/news/Serie-A/What-former-players-play-in-Piques-Kings-League-Ronaldinho-Aguero-Casillas../3036573) |
| Marcelo, Lamine Yamal | Kings League Spain | Team presidents / co-presidents | [Kings League Spain](https://kingsleague.pro/en/espana/teams) |
| Gary Lineker, Alan Shearer, Micah Richards | Baller League UK — **Deportrio** | Co-managers (S1; Lineker later stepped away) | [3AddedMinutes](https://www.3addedminutes.com/sport/football/newcastle-united/baller-league-uk-draft-start-date-newcastle-arsenal-alan-shearer-gary-lineker-ksi-5025053), [Goal.com](https://www.goal.com/en-my/lists/why-gary-lineker-quit-baller-league-uk-ahead-of-season-two-ceo-honest-conversation-england-icon/blt10d68e4f5cd1d9eb) |
| John Terry | Baller League UK | Manager | [Sky Sports](https://www.skysports.com/football/news/11095/13346437/baller-league-teams-and-managers-angry-ginge-pk-humble-arsenal-invincibles-john-terry-alisha-lehmann-and-more) |
| Luis Figo | Baller League UK | Manager | [Soccerway](https://www.soccerway.com/news/ronaldinho-and-luis-figo-among-number-of-legends-headlining-new-baller-league/UTmQlHeE) |
| Jens Lehmann, Robert Pirès, Freddie Ljungberg | Baller League UK | Co-managers | [3AddedMinutes](https://www.3addedminutes.com/sport/football/newcastle-united/baller-league-uk-draft-start-date-newcastle-arsenal-alan-shearer-gary-lineker-ksi-5025053) |
| Ian Wright, Chloe Kelly | Baller League UK — **Wembley Rangers AFC** | Coaches | [3AddedMinutes](https://www.3addedminutes.com/sport/football/newcastle-united/baller-league-uk-draft-start-date-newcastle-arsenal-alan-shearer-gary-lineker-ksi-5025053) |
| Alisha Lehmann, Maya Jama | Baller League UK — **MVPs United** | Managers | [Sky Sports](https://www.skysports.com/football/news/11095/13346437/baller-league-teams-and-managers-angry-ginge-pk-humble-arsenal-invincibles-john-terry-alisha-lehmann-and-more) |
| Toni Kroos | Icon League | **Co-founder** | [OMR](https://omr.com/en/daily/toni-kross-the-icon-league) |
| Franck Ribéry, David Alaba, Claudio Pizarro | Icon League | Team captains | [Sports Illustrated DE](https://www.sportsillustrated.de/fussball/icon-league-alle-teams-regeln-formate-und-kapitaene) |
| Benjamin Henrichs | Icon League — B2B United (exited 2026) | Team head | [El-Balad](https://www.el-balad.com/6864329) |
| Mats Hummels, Lukas Podolski | Baller League Germany | Founding backers | [Streams Charts](https://streamscharts.com/news/baller-league-week-1-information) |
| Usain Bolt | Baller League USA — **876 United** | Manager | [CBS Sports](https://www.cbssports.com/soccer/news/what-is-baller-league-usa-ronaldinho-ishowspeed-odell-beckham-cbs-sports-golazo-network-2026/) |
| Odell Beckham Jr | Baller League USA — **Showtime FC** | Manager | [CBS Sports](https://www.cbssports.com/soccer/news/what-is-baller-league-usa-ronaldinho-ishowspeed-odell-beckham-cbs-sports-golazo-network-2026/) |
| J Balvin, KidSuper | Baller League USA — **Super Niños** | Managers | [ballerleague.us](https://ballerleague.us/en/post/meet-the-teams-the-clubs-competing-in-season-1) |
| Spencer Owen | Hashtag United | Founder/owner | [Business of Sport](https://businessofsport.fm/podcasts/spencer-owen) |

### 5.3 Licensing posture

1. **Default: zero named real people.** Ship with wholly original fictional creators, teams and brands.
2. Any licensed pack must be **per-individual NIL agreements** plus, where a team identity is used, a **separate club/league mark licence**.
3. Creator-league team names (Porcinos FC, Saiyans FC, Yanited, SDS FC, MVPs United, Eintracht Spandau, …) are **third-party marks** — several are themselves derivative of, or adjacent to, existing football club marks, compounding the risk.
4. Audience figures above are volatile; never bake them into shipped content or marketing without re-verification.
5. Note that the underlying leagues are also unstable (Baller League Germany closed; Sky exited). A licence tied to a single league's continued existence is a poor asset. Prefer **individual creator** licences over **league** licences.

---

## 6. Football-management game design references

### 6.1 Online Soccer Manager (OSM) — the accessibility benchmark

| Design property | Detail | Source |
|---|---|---|
| Core loop | *Prepare squad → receive result and rewards → improve squad → prepare again.* Explicitly kept simple "for a game to reach a large audience" | [Game Design & Scaling for OSM](https://www.slideshare.net/Randam/presentatie-vua) |
| Pacing | **One match simulated per day** — the session is short and bounded, engagement is appointment-based, not continuous | [OSM design deck](https://www.slideshare.net/Randam/presentatie-vua) |
| Player agency | Formation, line-up, tactics, transfers, scouting, training, stadium expansion | [Google Play](https://play.google.com/store/apps/details?id=com.gamebasics.osm&hl=en_US) |
| Social | Play in the same league as friends — competition is against known humans, not AI | [Google Play](https://play.google.com/store/apps/details?id=com.gamebasics.osm&hl=en_US) |
| Reach | Localised into **30 languages**; free-to-play with optional IAP | [Google Play](https://play.google.com/store/apps/details?id=com.gamebasics.osm&hl=en_US) |

**Takeaway for us:** OSM's accessibility comes from a *bounded daily decision* and a *closed social league*, not from shallow simulation. The 30-minute creator-football match is a natural fit for exactly that appointment shape — and a 6-match matchday block is a natural "session".

### 6.2 Football Manager — the depth benchmark

| Design property | Detail | Source |
|---|---|---|
| Simulation granularity | Every player and official makes a decision **every quarter-second** — a "slice" | [Football Manager](https://www.footballmanager.com/news/match-engine-ai-fm21) |
| Attribute model | **1–20** scale across three groups: **technical, mental, physical** | [Passion4FM](https://www.passion4fm.com/football-manager-player-attributes/), [sortitoutsi](https://sortitoutsi.net/content/67538/fm24-guide-players-attributes-explained) |
| What attributes drive | Set-pieces, movement, teammate interaction in defensive and attacking phases, and individual tactical intelligence | [Passion4FM](https://www.passion4fm.com/football-manager-player-attributes/) |
| Renderer independence | **The underlying simulation runs on its own**; the 3D engine merely renders plausible movement over the already-computed result | [Sports Interactive community](https://community.sports-interactive.com/forums/topic/301766-does-anyone-acyually-know-how-the-match-engine-works-under-the-hood-so-to-speak/) |

**Takeaway for us:** the renderer/simulation separation is the important architectural lesson. Compute the match as an event stream; present it however the platform allows (2D pitch, text ticker, highlight reel). It also lets us "broadcast" the same match differently per creator persona — mirroring the Kings League co-stream model.

### 6.3 EA Sports FC — the presentation benchmark

| Design property | Detail | Source |
|---|---|---|
| Broadcast dressing | **25 distinct broadcast packages** — overlays, scoreboards, graphics, pre-match intros, cinematic sizzles, player walk-ins, line-ups, custom commentary, matchday branding | [reFIFA](https://refifa.com/all-25-broadcast-packages-in-ea-sports-fc-25/), [Operation Sports](https://www.operationsports.com/ea-sports-fc-25-presentation-breakdown/) |
| Environmental variety | **Dynamic time of day** — lighting transitions day → dusk → night across a match | [Operation Sports](https://www.operationsports.com/ea-sports-fc-25-presentation-breakdown/) |
| Short-format mode | **Rush** — a **5v5**, fast-paced social mode with its own stadium, its own commentary team and its own art direction, built to emphasise time on the ball | [EA Pitch Notes](https://www.ea.com/en/games/ea-sports-fc/fc-25/news/pitch-notes-fc-25-gameplay-deep-dive) |
| Movement realism | FC IQ drives less robotic, more believable team-wide movement | [Operation Sports](https://www.operationsports.com/ea-sports-fc-25-presentation-breakdown/) |

**Takeaway for us:** even the biggest football game concluded that **5v5 with its own presentation identity** is the right shape for a fast social mode. Presentation *variety* (multiple broadcast identities) is a cheap, high-perceived-value axis for a management game where the pitch action is simulated.

---

## 7. What this means for Creator Football (design implications)

1. **Match length 30 minutes / two halves** is the sweet spot the market has converged on; the simulated match should compress to a **60–120 second** watchable beat on mobile.
2. **Two guaranteed swing windows per match** (the Gamechanger pattern) give us two designed re-engagement points inside a short session — better than one endgame.
3. **A weighted deck of rule-modifier effects with single-copy rarities** (the Kings League pattern) is a natural progression/collection axis and monetisation surface, and it is a *format idea*, not protected expression.
4. **Draft + fixed wildcard + rotating wildcard** (Kings League squad structure) is a ready-made squad-building meta with a weekly decision built in.
5. **Session = a block of six matches at one venue**, not a single fixture. That is the live-ops shape for a matchday event.
6. **Creator-as-manager, not creator-as-player** is the dominant role in the two biggest leagues — which happens to be exactly what a management game is.
7. **Free-to-watch, sponsor-funded** is the real-world economy; an in-game economy where the club's income scales with *audience* rather than *gate* is realistic and more interesting than a standard club sim.
8. **Model contraction, not just growth**: leagues close markets, broadcasters walk, clubs ask to be relegated. A "sustainability" pressure is authentic.

---

## 8. What we borrow (mechanics) vs what we must not borrow (identity/IP)

### 8.1 The principle

**Rules and formats of a game are not protectable expression.** Names, logos, crests, kit designs, team identities, personal likenesses, voices, handles, catchphrases, broadcast branding and the specific written text of a rulebook **are** protectable — via copyright, trade mark, passing off, and personality/NIL rights. We take the first category. We take **nothing** from the second.

### 8.2 SAFE TO BORROW — format and mechanics

| Idea | Where it comes from | Why it is safe |
|---|---|---|
| Short matches (~30 min, two halves) | Baller League / Icon League | An unprotectable rule of play |
| Small-sided (5v5 / 6v6 / 7v7) | All creator leagues, EA FC "Rush", futsal | Generic, centuries-old |
| Timed "special rule" windows near the end of each half | Baller League Gamechangers | A rule concept, not expression — **but do not reuse the word "Gamechanger" or any individual Gamechanger's proper name** |
| A randomised/weighted deck of one-shot rule-modifier effects | Kings League secret weapons | Mechanic only — **do not reuse "secret weapon", "President Penalty", "Reverse Penalty", or card art** |
| Individual effect concepts: double-scoring period, temporary player suspension, temporary numeric advantage, no-offside period, shot clock, 1v1-from-distance with a countdown, "star player" scoring multiplier | Kings/Baller/Icon | Generic sporting rule concepts, widely used across sports |
| Ramp-up start (1v1 growing to full strength) and dice-determined player counts | Kings League | Rule concept |
| Draft with scouted, rated player pool; quirky draft-order determination | Baller League | Drafts are universal across sport |
| Squad of N with a season-fixed wildcard and a weekly-rotating wildcard | Kings League | Roster rule |
| Creator/celebrity as team owner-manager | All | A premise, not expression |
| Matchday = block of matches at one venue on a fixed weekly slot | Baller/Kings | Scheduling |
| Split seasons (two per year) with a league stage then playoffs | Kings League | Ubiquitous competition structure |
| Audience/reach as an in-game resource that drives sponsorship income | Real-world creator economics | An economic model, not IP |
| Multiple broadcast "presentation packages" | EA FC | A presentation pattern; our art must be original |
| One decision per day, bounded session | OSM | A pacing pattern |
| Separating the simulation from the renderer | Football Manager | An architecture pattern |

### 8.3 MUST NOT BORROW — identity and IP

| Category | Explicit prohibition |
|---|---|
| **League names/marks** | "Baller League", "Kings League", "Queens League", "Icon League", "The Icon League", "Kings World Cup", "La Liga de Creadores", "Sidemen Charity Match" — never as a name, a subtitle, a mode name, in marketing, in store metadata, or in ASO keywords |
| **Team names/crests/kits** | Porcinos FC, Saiyans FC, 1K FC, Kunisports, El Barrio, xBuyer Team, Jijantes FC, Aniquiladores, Ultimate Móstoles, Pio FC, Los Troncos, Rayo de Barcelona, Yanited, SDS FC, MVPs United, Deportrio, Trebol FC, N5 FC, 26ers, Wembley Rangers, Speed United, Glitch FC, 876 United, Club 360, MW FC, Showtime FC, Super Niños, Any Means Utd, FTW FC, M3 FC, Eintracht Spandau, B2B United, Hashtag United, SE Dons — and any visually confusable derivative |
| **Real people** | Every name in section 5. No likeness, no photo, no 3D scan, no voice, no name, no handle, no signature phrase, no recognisable caricature, no "legally distinct" near-miss. Personality/NIL rights are strong in the UK, Germany, Spain, and most US states |
| **Trademarked rule names** | "Gamechanger", "Secret Weapon"/"Arma Secreta", "President Penalty", "Reverse Penalty", "Rulebreaker", "3Play", "The Line", "Plus One", "Fairplay", "Fast Forward", "Rush" — assume each is claimed; invent our own vocabulary |
| **Rulebook text** | No copy-paste, no close paraphrase of rulebook prose. Express every rule in our own words |
| **Broadcast identity** | No Sky Sports, DAZN, CBS Golazo, Twitch, YouTube, TikTok branding or lookalike overlays; no reproduction of any real broadcast graphics package |
| **Real clubs and competitions** | No Premier League, La Liga, Bundesliga, FIFA, UEFA marks; no real club crests; no real stadium names or recognisable stadium architecture (Copper Box Arena, Cupra Arena, The O2, Wembley, the Racecourse Ground) |
| **Sponsor brands** | Xing, Pepsi, Nike, Grenade, Infojobs, Cupra and every other real sponsor mark |
| **Real player databases** | No scraped real-player attribute data (that is what OSM/FM license at cost); our players are generated |

### 8.4 Practical guardrails

- **Original vocabulary layer.** Before implementation, produce a glossary that maps every borrowed *mechanic* to an original *name*. Ship only the original names. Never let a competitor's term reach a string table, an asset filename, a database column, an analytics event, or a git branch name.
- **Generated identity.** Creators, teams, crests and kits are procedurally generated from original component sets. No component may be traced from, or be a recolour of, a real mark.
- **A "no real names" lint rule** over content data files, with a denylist seeded from section 5 and 8.3, run in CI.
- **Design docs may reference real leagues** for benchmarking (this document does). Shipped content may not.
- **Licensed pack architecture, from day one.** Build the content pipeline so real identities can only ever arrive as a *separately gated data pack*, never as base content. That is the difference between a licence being a business decision and a licence being a rewrite.

---

## 9. Open questions and explicit "not found"

| Question | Status |
|---|---|
| Baller League prize money / prize pool | **Not found** in any indexed source |
| Baller League UK Season 1 total goals (for a goals-per-game figure) | **Not found**; only that S1 had 69 matches, a 21-goal top scorer (Bryan Ly, N5 FC), and a highest-scoring match of 26ers 8–9 Trebol FC |
| Exact, current Baller League Gamechanger set and "The Line"/"Fairplay" definitions | **Conflicting sources** — must be read from the live rulebook |
| Exact Kings League secret-weapon activation windows and full current deck composition | **Conflicting sources** — must be read from the [Book of Rules](https://cms-es.kingsleague.pro/uploads/book-of-rules.pdf) |
| Whether "12 secret cards" is accurate | **Likely not.** Best evidence describes a weighted deck of ~20 physical cards over a smaller set of distinct types |
| Icon League draft mechanism and squad sizes | **Not found** |
| Icon League exact launch date (late 2023 vs Sept 2024) | **Conflicting** |
| SE Dons revenue | **Not found** |
| KSI's individual current subscriber count | **Not verified** in this research |
| League-wide Premier League passes/tackles/fouls per match for 2024-25 | **Not found** as a published league aggregate (see the simulation reference doc for derived estimates and their caveats) |

---

*Companion document: `SIMULATION_REFERENCE_DATA.md` — the hard numbers the match engine should be validated against.*
