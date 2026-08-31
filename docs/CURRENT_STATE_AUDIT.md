# AUDIT FOUR: CURRENT STATE OF THE PRODUCT

> **Superseded.** This document records an earlier state of the project and is
> kept as history. For current architecture, test counts and status see
> [`CURRENT_STATE.md`](./CURRENT_STATE.md), which is authoritative wherever
> the two disagree.

**Subject:** Creator Football (`/home/user/Creatorfootball`), the running application.
**Method:** the production build (`npx vite build` → `npx vite preview --port 4314`) driven with
Playwright + Chromium 1194 at 393×852, 375×667, 834×1194 and 1440×900. A career was created from
scratch, a match was played live at Normal speed and again at Instant, and every screen was walked
and captured. 191 screenshots under `/tmp/audit-current/`. Every layout number below was measured
with `getBoundingClientRect` in the live page, not estimated from a picture.

**Observation windows.** The tree changed underneath this audit — a parallel workstream shipped a
Home redesign and a complete Live Match rebuild while it was running.

| Window | Time (UTC, 2026-08-20) | State of the build |
|---|---|---|
| **A** | 16:55 – 17:10 | Pre-rebuild. `01-*` … `iphone-*` screenshots. |
| **B** | 17:20 – 17:27 | Post-rebuild. `home2`, `social2`, `desktop-*`, `small-*`, `tablet-*`, `live2-*`. |

Where a finding was **fixed between A and B**, it is recorded as history with its measurement,
because the measurement is the evidence that the fix was needed. Where the two windows disagree,
Window B governs.

**Scope.** This is the *product* audit: what the thing is, screen by screen, as a player meets it.
It deliberately does not re-derive `docs/AUDIT_ARCHITECTURE.md` (30 findings, F1–F30),
`docs/AUDIT_GAMEPLAY.md` (G1–G21) or `docs/AUDIT_UX.md` (F1–F25). It cross-references them by ID.
§4 lists what is genuinely new here.

---

## 1. Executive summary

**There is a real product here, and it is much closer than a finding list makes it sound.** The
writing is the best thing in it and is not close: "Wins the whiteboard. Loses the room." is better
copy than any shipping football manager has. The in-match decision panel, the post-match "Your
calls" grading, the store's honesty panel and the league press coverage are all things a
competitor would have to *decide* to build and then fail to write. Those four must be protected
through any redesign.

What stops it being shippable is not craft. It is that **five specific things are actively lying to
the player**, and a manager game is a machine for making the player trust numbers.

1. **The cold start is a museum after hours.** A fresh save shows an empty state on **10 of 14
   screens** (22 distinct "nothing here yet" messages) after a **7,676-pixel** character-creation
   form. The player spends three minutes filling in a form and is rewarded with a world where
   nothing has happened. Measured: manager creation `scrollHeight` 4,263px on a 687px viewport
   (6.2 screens, 35 numbers), club creation 3,413px (5.0 screens).

2. **The game tells the player they are relegated after one match of twenty-two.** The largest
   text on the Home screen — three lines, above the primary CTA — reads *"You are in the drop zone.
   Every point from here is survival."* at matchweek 1 (`desktop-home-s0.png`, `small-home-s0.png`).
   On the Objectives screen, "Finish in the top half" shows **"Progress 12 / 8" with a
   100%-full volt progress bar** while the club sits 12th of 12 — the bar says *achieved* about the
   one thing the club is failing worst at in the league (`desktop-objectives-s0.png`).

3. **The game has no agreed name for its own unit of time.** The same engine field,
   `contract.weeksRemaining`, is rendered as "a week" on `/club`, "a cycle" on `/squad`, "63w" in
   the squad row whose own `title` attribute says "63 cycles remaining", "4 cycles remaining" on the
   player profile and "out for about 4 weeks" on Home — for the same injury, in the same session.
   Cross-screen contradiction on identical numbers: `ClubScreen.tsx:258` "£78.6K of wages a week"
   vs `SquadScreen.tsx:270` "£78.6K a cycle in wages".

4. **Raw floats reach the screen, by default, from the design system.**
   `design/domain/numbers.tsx:173` reads
   ``const text = format ? format(delta) : `${up ? '+' : ''}${delta}`;`` — no rounding on the
   default path. The post-match screen prints **`-8.157399521093865`** twice
   (`iphone-after-result-s2.png`). This is not a typo on one screen; it is the kit's default
   behaviour and every caller who omits `deltaFormat` inherits it.

5. **The world's memory is inflated to the point of parody.** After a single 7–1 defeat in
   matchweek 1, the press runs *"Keldar breaks a record that stood for a generation / It had
   survived four managers, two relegations and a rebuild"* about **one goal**, at a club **founded
   in 2026 that has had one manager and played one match**. Alongside it: *"A club record.
   Northgate Rovers writes **his** name into the history of Northgate Rovers."* The living world is
   the product's best idea and this is what it currently says.

Fix those five and the honest verdict moves from "an impressive prototype with an authored voice"
to "a game you could put in front of a publisher". None of the five is hard. Four are a day each.

---

## 2. Screen by screen

Format per screen: **Purpose · Primary action · Hierarchy · Emotion · Density · Visual quality ·
Football identity · Immersion · Friction · Opportunity.** Screenshots are filenames under
`/tmp/audit-current/`.

---

### 2.1 Title / Splash — `01-title-iphone.png`, `tablet-market.png` (title at 834×1194)

- **Purpose.** One decision: start, or continue. It is also the only chance to say what this game
  *is* before the player commits three minutes.
- **Primary action.** Unmistakable. One button, volt pill, sticky bottom, "Start your career".
  Under one second. The support line — *"Creation takes about three minutes. Every step can be
  changed later."* — is the single most reassuring sentence in the product.
- **Hierarchy.** Wordmark → subtitle → CTA. Correct order, wrong proportions: **the middle 900px
  of an 852px phone screen is empty**, and at 834×1194 it is **~1,200px of black** with the
  wordmark stranded in the top-left corner (`tablet-market.png` — the tablet run landed here, see
  §2.17). The layout is a phone layout that does not know what to do with space.
- **Emotion.** Should be: anticipation, a stadium at dusk. Actually: a well-typeset settings
  screen. Nothing moves, nothing is football.
- **Density.** Too little — 17 words on a full screen.
- **Visual quality.** Blunt: the typography is genuinely good (a confident 2-line all-caps
  wordmark), and everything else is missing. The logo is **a lightning bolt in a circle** — a
  placeholder mark, not a football brand. No hero art, no crowd, no pitch, no motion.
- **Football identity.** Zero. Remove the word FOOTBALL and this is a fintech onboarding screen.
- **Immersion.** None. There is no world yet, and the screen does not promise one.
- **Friction.** Low — this screen's job is done in one tap.
- **Opportunity.** **Put the world on it.** One full-bleed, slow-panning procedural crowd/pitch
  scene behind the wordmark, generated from the same seed system the badges already use, plus a
  "Continue as {manager}" row when a save exists. This is a half-day and it changes the first
  impression more than anything else on this list. *(Extends `AUDIT_UX` F22.)*

---

### 2.2 Manager Creation — `02-manager-create-iphone.png`, `03-manager-filled-iphone-FULL.png`

- **Purpose.** Make the player *someone*, and teach that every choice costs something.
- **Primary action.** Ambiguous on arrival, then excellent. The sticky CTA is disabled and
  **self-describing** — "Add your name" → "Choose an archetype" → "Next: your club". Naming the
  missing thing in the button label is a genuinely smart pattern; keep it. But it does not scroll
  to the thing it names, so the player reads an instruction about a field 3,000px away.
- **Hierarchy.** "Who are you?" → the avatar/name card → an enormous appearance section → the
  archetypes. **This is inverted.** The archetypes are the only choices with mechanical
  consequences and they are ~2,400px down. Hair colour is above the thing that changes the game.
- **Emotion.** Should be: identity, ambition. Actually: form fatigue. Measured **4,263px of scroll
  on a 687px viewport = 6.2 screens**, with **35 numbers** on it.
- **Density.** Far too much, and in the wrong order. Ten hair styles, six facial hairs, eight
  outfits, ten accessories, eight archetypes, five press personalities, four online personalities.
- **Visual quality.** Mixed. The archetype cards are the best-designed component in the app —
  card, tick, ✓/✗ rows, green/red modifier chips, coloured left rail. The manager avatar next to
  them is a flat cartoon face that would not look out of place in a 2014 emoji keyboard.
- **Football identity.** Present only in the *words* ("touchline outfit", "every press conference
  is a small disaster"). Visually, none.
- **Immersion.** The copy carries it single-handed. *"Wins the whiteboard. Loses the room."* /
  *"You will not be bored. You may be relegated."* — this is the product's voice and it is superb.
- **Friction.** Highest in the product. The disabled CTA + 6-screen scroll + no scroll-to-error is
  the most likely first-session drop-off point.
- **Opportunity.** **Invert it.** Archetype first as a full-screen choice (it is the only decision
  that matters), then name, then collapse all appearance into one "Look" sheet behind a
  "Customise" affordance with a good default already applied. *(Reinforces `AUDIT_UX` F5/F6/F23.)*

---

### 2.3 Club Creation — `04-club-create-iphone.png`, `05-club-filled-iphone-FULL.png`

- **Purpose.** Make the club *yours* — the thing every later screen renders.
- **Primary action.** Same self-describing sticky CTA ("Name your club" → "Found Northgate").
  Using the club's own name in the CTA is a lovely touch.
- **Hierarchy.** Live badge/kit preview at top (correct), then name fields, then badge shape,
  emblem, kit, look, then **"How you play"** — eight club identities with real tactical
  consequences — then fan culture, then motto. Same inversion as §2.2: the consequential choice is
  ~2,600px down a **3,413px** page.
- **Emotion.** Should be: pride of ownership. Actually: mild admin. The one moment of pride is the
  badge updating live as you pick — and it is real: the procedural crest is genuinely good.
- **Density.** Too much. 12 emblems × 5 shapes × 6 kits × 6 looks = 2,160 combinations presented as
  four flat chip grids, with no preview of the combination other than one small badge.
- **Visual quality.** The **procedural club badge system is the best visual asset in the product**
  and it is not close (`iphone-club-s0.png`, and the varied AI crests in `iphone-league-s0.png`).
  It looks designed. Everything around it is chips.
- **Football identity.** Strong, and the only screen where it is. Badge, kit, shape, fan culture,
  motto, "founded 2026" — this is a football club being made.
- **Immersion.** Good. The eight identities are written as real club philosophies, not stat
  packages: *"Wins 1-0 and enjoys it. Recruits spine first, always."*
- **Friction.** Auto-derivation of Short Name / Three Letters from the club name is silent and
  sometimes wrong (typing "Northgate Rovers" + city "Northgate" produced short name "Northgate",
  code "NOR" — fine; but the derivation is invisible and unexplained until you find the fields).
- **Opportunity.** **Show the kit on a shirt, on a player, on a pitch.** The badge preview proves
  the procedural pipeline works; extend it to a single hero mock — crest, home shirt, and the
  ground name — that updates live. This is the screen where a player decides whether they care.

---

### 2.4 Club Reveal — `06-club-reveal-iphone.png`, `06-club-reveal-early-iphone.png`

- **Purpose.** The payoff. Three minutes of form become a club.
- **Primary action.** "Meet your squad". Unmistakable — it is the only thing on screen.
- **Hierarchy.** Giant crest + short code + club name + motto + identity/ground/founded line + CTA.
  Correct, and the only screen in the app with proper cinematic restraint.
- **Emotion.** Should be: goosebumps. Actually: a pleasant, quiet, slightly under-cooked pause.
  It is the *right shape* for the moment and about 40% of the intensity it needs.
- **Density.** Correct — six lines total. This is the only screen that gets density right by being
  brave enough to show almost nothing.
- **Visual quality.** Good. The crest renders large and holds up. The type is confident.
- **Football identity.** Present. "Local Roots · Northgate Ground · founded 2026" is exactly the
  right three facts.
- **Immersion.** The best moment in creation. It is also over in about two seconds.
- **Friction.** None.
- **Opportunity.** **Make this the loudest three seconds in the game.** Crest assembling from its
  parts, kit stripe wipe, ground name typed in, a single crowd swell. The scaffolding
  (`design/hero/moments.tsx`, `design/hero/effects.tsx`) already exists and is used elsewhere.
  This is the cheapest possible upgrade to perceived production value.

---

### 2.5 Squad Intro — `07-squad-intro-iphone.png`, `07-squad-intro-iphone-FULL.png`

- **Purpose.** Hand the player a team they can hold in their head, and name the problem they will
  spend the season fixing.
- **Primary action.** **This is the one screen where the primary action is not last.** The sticky
  footer contains "Play Larkspur" *and then* "Start over instead"; a naive last-button walk lands
  on the destructive path (this audit's first driver did exactly that, twice, and reached
  "Delete and restart"). Visually the volt pill wins, so a human is fine — but a destructive action
  sitting after the primary CTA in the same sticky bar is a real risk.
- **Hierarchy.** Three stat tiles → "Your best three" → "The problem" → "The shape of it" → next
  fixture → CTA. **This is the best-structured screen in the product.** It answers "who am I good
  at, what am I bad at, who is next" in that order.
- **Emotion.** Should be: "this is my team". Actually: close. *"18 players. Three of them are worth
  knowing by name."* and *"Your attack is the weak link. Averaging 48. It is the first thing rivals
  will aim at."* are exactly right.
- **Density.** Slightly too much — three stat tiles in a 2-up grid orphans the third
  (`AUDIT_UX` F19), and "The shape of it" repeats information the three cards already gave.
- **Visual quality.** Good. The best-three cards with position, name, trait and three attributes
  are legible and football-shaped.
- **Football identity.** Strong.
- **Immersion.** Good — naming a weakness gives the season a plot.
- **Friction.** The destructive-action placement above; nothing else.
- **Opportunity.** **Protect this screen and copy its structure elsewhere.** It is the template for
  what Home should be.

---

### 2.6 Home — `iphone-home-s0/s1.png` (A), `desktop-home-s0.png`, `small-home-s0.png` (B)

- **Purpose.** Answer "what do I do this week" in under five seconds, every session.
- **Primary action.** Excellent and improved between windows: "Take charge" as a volt pill *inside*
  the next-match card, with "Set the team up" / "Check the squad" as quiet secondaries. Under one
  second. Best CTA treatment in the app.
- **Hierarchy.** Window B: club name → next-match card (now with both clubs' kit colours as a
  gradient and kit stripes — a real football object) → **the stakes line** → CTA → "What matters
  now" → four club numbers. Nearly right. The failure is *what* the stakes line says.
- **Emotion.** Should be: purpose, momentum. Actually: **panic, wrongly.** *"You are in the drop
  zone. Every point from here is survival."* is the largest text on the screen at matchweek 1 of 22
  after one match. Window A's version was *"One win from 3rd. Only 0 clear of 5th."* in amber, at
  matchweek 0, with nothing played. Both are the same bug: a late-season framing engine running on
  week-one data. *(Extends `AUDIT_UX` F16, which caught the "Only 0 clear of 11th" instance but not
  the drop-zone framing, which is louder and worse.)*
- **Density.** Right on phone. **Wrong on desktop** (`desktop-home-s0.png`): a 1,000px content
  column plus a right rail holding three rows and then ~600px of nothing. The desktop layout is the
  phone layout with a sidebar bolted on.
- **Visual quality.** Window B is a real step up — the fixture card now reads as a matchup, not a
  table row. Window A had **four truncations in one card** at 393px ("SQUAD RATI…", "FAN SENTIME…",
  "Starting seven weigh…", "Above expe…") and the player's own club truncated to "Northg…" in the
  fixture card while the opponent fitted. At 375px the club name still clips by **147px**.
- **Football identity.** Improved to good. Kit colours, crests, "CL · At home · Week 2".
- **Immersion.** "What matters now" is the right idea — an injury, a press mention, an objective,
  each with a one-tap action. This is the screen doing its job.
- **Friction.** The stakes line makes a new player think they are losing when they have played one
  game. That is the worst possible week-one message.
- **Opportunity.** **Gate the narrative framing on sample size.** Below ~6 matches, say what is
  true and neutral ("Matchweek 2 of 22. Nothing is decided.") and only switch to
  survival/playoff/title language once the table means something. Half a day, and it removes the
  single most damaging sentence in the product.

---

### 2.7 Match Preview — `iphone-preview-s0..s3.png`, `small-matchday-s0.png`

- **Purpose.** Make the player feel prepared, and give them one last chance to change the team.
- **Primary action.** Unmistakable: **Play** (volt) / **Simulate** (ghost) in a sticky footer.
  `AUDIT_UX` F2 (footer rendering under the tab bar, "Play" navigating to Squad) was fixed before
  Window A and is confirmed fixed: `small-matchday-s0.png` shows both buttons clear of the tab bar.
- **Hierarchy.** Title → fixture card → "What is at stake" → position/gap tiles → the opposition →
  predicted lineup → key battles → team news. Good order.
- **Emotion.** Should be: nerves. Actually: briefing-room competence. "What is at stake" with
  WIN/DRAW/LOSS outcomes is genuinely tense and is one of the best components in the app.
- **Density.** Slightly too much — 2,389px of scroll (Window A) for a screen the player will see 22
  times a season. "To the side above 0 pts" and "Cushion below 0 pts" are noise at week 1.
- **Visual quality.** Good.
- **Football identity.** Strong — key battles, danger man, team news, a lineup board.
- **Immersion.** Good. "A clean bill of health. Both sides can pick from a full squad." reads like
  a programme.
- **Friction.** The screen is titled **"NOR v RDR"** — three-letter codes for a first-time player
  who has never seen "RDR". Home called the same club "Redmere Republic". Two naming registers for
  the same object, one screen apart.
- **Opportunity.** **Collapse it to one screen.** Fixture + stakes + lineup + one "what changes it"
  line, with the opposition detail and key battles behind a "Scout them" expand. A pre-match screen
  the player scrolls past 22 times is a pre-match screen they stop reading.

---

### 2.8 Live Match — `iphone-live-t4.png`, `iphone-live-t5.png` (A); `live2-12000.png` (B)

**This screen was rebuilt between windows. Both states are recorded; B governs.**

- **Purpose.** The reason the genre exists. Thirty minutes of drama the player influences.
- **Primary action.** *There isn't one, and that is correct* — the player watches until asked. When
  asked, the decision panel takes over completely and the action is unmistakable.
- **Hierarchy (B).** Scoreboard/momentum bar → pitch canvas (377×236) → "What is happening"
  (FEED/STATS) → control bar (PAUSE / NORMAL / SUBS 5 / TACTICS / CARDS). Right structure.
- **Emotion.** Should be: tension, then release. Actually: **calm.** Window A was 40% dead black
  below the pitch (`AUDIT_UX` F10). Window B moved the dead space *into a card*: the feed panel is
  ~830px tall and at 4′ contains **one centred sentence** with ~700px of empty box under it
  (`live2-12000.png`). The screen still spends ~45% of a phone viewport on nothing.
- **Density.** Too little on the pitch, too little in the feed, and no stats until you tap STATS.
  The most information-hungry moment in the game is the most information-poor screen.
- **Visual quality.** Window B is a large improvement — **numbered discs in club colours** on a
  real pitch canvas, a WIDE/FOLLOW camera toggle, kit-coloured scoreboard. Two defects remain:
  the **"NORTHGATE ATTACK →" chip overlaps player disc #20** at the bottom-left, and the
  **DEFENCE / MIDFIELD / ATTACK legend uses blue / teal / tan dots that match nothing visible on
  the pitch**, where the discs are club red and club lime.
- **Football identity.** Window B: yes. Window A: no — twelve unnumbered dots read as a debug view.
- **Immersion.** The commentary is good and varied enough at this timescale
  (*"Enzo Bruns calls it a challenge. Nobody else in the building does."*), though `AUDIT_GAMEPLAY`
  G14 shows the high-frequency pools are only 7 lines deep.
- **Friction — measured, Window A.** The **"Instant" speed button's right edge sat at 405px on a
  393px viewport and 405px on a 375px viewport — 12px and 30px off-screen respectively.** It was
  not clickable by a human or by Playwright; this audit had to reach it via `element.click()` in
  the page. *Fixed in Window B*, which replaces the four-way speed segmented control with a single
  "NORMAL" cycler. Recorded because the measurement is the argument. *(= `AUDIT_UX` F12.)*
- **Friction — current, Window B.** **A match at Normal speed took 154 seconds of real time to
  reach 25′ of 30′** (timed run, `iphone-live-poll*.png`). Extrapolated, one match ≈ 3 minutes of
  watching, a 22-match season ≈ 66 minutes. `PRODUCT_REQUIREMENTS.md` §100 targets a 10–15 minute
  cycle; the match alone is a fifth of that and the player cannot skip to Instant mid-match without
  reopening Settings.
- **Bug — decision panel.** The `AUTO PICK` marker is bound to `option.id === decision.defaultOptionId`
  (`DecisionOverlay.tsx:196`) while the footer text is hard-coded *"Do nothing and the bench makes
  the **safe** call for you."* In `iphone-live-t5.png` the marker sits on **"Go for the throat —
  GAMBLE"**. The panel promises safety and marks risk. *(= `AUDIT_UX` F17; recorded here because it
  is the single best component in the product and it is telling the player the wrong thing.)*
  Also, `{option.durationMinutes} min` renders as "7 MIN" directly beside a live countdown ring
  showing "8", so two unrelated numbers read as one timer.
- **Opportunity.** **Fill the bottom half with the match.** Live shot count, possession, xG, a
  momentum trace, and the last three feed events instead of one — the data already exists
  (`useLiveStats.ts`). The screen has 700px begging for it.

---

### 2.9 Match Result — `iphone-after-result-s0/s1/s2.png`

- **Purpose.** Turn a number into a story, and close the loop on the player's decisions.
- **Primary action.** "On to the next one ›" — volt, sticky, present at every scroll position.
  Perfect.
- **Hierarchy.** Scoreline + verdict ("Lost it") → The Moment → How they played → Your calls →
  The stands → The reaction → press. This is a genuinely well-designed narrative cascade.
- **Emotion.** Should be: consequence. Actually: consequence, and it lands. "Lost it" under a 7–1
  is exactly the right register.
- **Density.** Right. 3,715px, but every band earns its space.
- **Visual quality.** Good, with three specific failures:
  1. **`-8.157399521093865` printed on screen, twice** — once as the trend next to "diehard
     support", once truncated to `-8.1573995210938` inside the Sentiment tile
     (`iphone-after-result-s2.png`). Root cause is the kit, not the screen:
     `design/domain/numbers.tsx:173` has no rounding on the default path, and
     `MatchResultScreen.tsx:494,498` pass a raw `club.fans.sentiment - before.sentiment`. Note that
     the *value* on the same tile is `Math.round(...)`ed and the *delta* is not.
  2. **The Man of the Match can be an opposition player, drawn in your kit.**
     `MatchResultScreen.tsx:344,356,365`: `kit = kitColors(club.id, ...)` where `club` is always the
     player's club, `ratings` is filtered by `ourClubId`, but `motm` is not filtered at all. In the
     captured match, Aurelia's Noah Pedersen is presented in a volt-accented panel above the
     Northgate ratings list, wearing the Northgate shirt.
  3. **Every light-skinned player has grey or white hair.** `PlayerPortrait.tsx:29–32`:
     `HAIR_COLORS` contains `#7d7d7d` and `#c9c9c9`, picked uniformly with **no reference to
     `player.age`**. In `iphone-after-result-s1.png`, Kalle Richter (27), Rojas (27), Matteo Laurent
     (26), Tristan Garrity (28) and Liam Tanaka (25) are all grey-haired. The squad looks like a
     veterans' XI.
- **Football identity.** Strong. Ratings with G/A annotations, MOTM, attendance, a momentum trace.
- **Immersion.** "The reaction" pulling real posts about the real result is the product's core idea
  working — until it says *"A club record. Northgate Rovers writes **his** name into the history of
  Northgate Rovers."* *(= `AUDIT_GAMEPLAY` G9.)*
- **Friction.** The reveal opens on a stage that renders no text at all for ~2s with only a "Skip"
  button (this audit's first capture of `/matchday/result/...` returned an empty `innerText` and
  zero buttons besides Skip). *(Related: `AUDIT_UX` F21.)*
- **Opportunity.** **"Your calls" is the best original idea in this game.** Grading the player's
  in-match decisions on xG created/conceded in the following minutes, labelled WORKED / BACKFIRED,
  is something no competitor does. Promote it: it should be the *second* band after the scoreline,
  not the fourth, and it should be the thing the game brags about.

---

### 2.10 League — `iphone-league-s0.png` (A), `iphone-league2-*.png` (B)

- **Purpose.** Tell the player where they stand and what is coming.
- **Primary action.** Weak — the screen is a reading surface with four equal-weight links at the
  bottom (Fixtures / Rivalries / Standings / Season). No single thing to do.
- **Hierarchy.** Position card → next fixture → mini table → season stats → top scorers → derbies
  → league news → four navigation links. Long but coherent.
- **Emotion.** Should be: rivalry, jeopardy. Actually: informed. *"63 points are still on the table.
  Win everything left and you finish on 63."* is a lovely, exactly-correct line.
- **Density.** Correct on tablet/desktop, too long on phone (2,560px).
- **Visual quality.** Good. The **procedural crests carry the league**: twelve visually distinct
  clubs, each recognisable at 24px in the table (`iphone-league-s0.png`).
- **Football identity.** Strong. Top scorers, form strings, GD, zone bands ("Top 4 go into the
  playoffs. Bottom 2 go down.").
- **Immersion.** The **league press coverage is excellent and under-appreciated**: *"Collapse:
  Ember Nine beaten 5-1"*, *"Questions for Neon Row FC after 0-4 defeat"*, *"Redmere Republic
  humiliate Verrow Wanderers, 2-3"* — eleven other clubs having a season you are not part of.
  This is the single strongest immersion asset in the build. *(Undercut by `AUDIT_GAMEPLAY` G8:
  25% of press is record spam, and G10: mean 7.77 goals/match makes "Collapse" the normal result.)*
- **Friction.** Same drop-zone framing as Home at matchweek 1. Club name clipped by 152px at 375px.
- **Opportunity.** **Give the table a face.** One "who you are chasing / who is chasing you" band
  with the two adjacent clubs' crests, form and the exact points gap — the one thing a manager
  actually looks at — instead of the current position card.

---

### 2.11 Squad — `iphone-squad-s0.png`, `iphone-squad2-*.png`

- **Purpose.** See and manage eighteen players.
- **Primary action.** None, correctly — this is a browse surface. But the three real actions
  (Tactics / Training / Market) are plain text links at the *bottom* of a 1,495px page.
- **Hierarchy.** Filter tabs → title → two stat tiles → the list. Fine.
- **Emotion.** Should be: these are my players. Actually: a spreadsheet with faces.
- **Density.** Right count, wrong columns. Each row is `Name · Position · Age · #Number · 63w · — · 79`.
- **Visual quality.** Weak, for three reasons. (a) **Two identical unlabelled ↑↓ icons sit adjacent
  in the header** (`iphone-squad-s0.png`, top-right) with no way to tell them apart. (b) The
  grey-hair bug (§2.9) is at its most visible here — nine of eighteen portraits read as men over
  fifty. (c) The row's two "w" units mean different things: `4w` is *weeks of injury* and `63w` is
  *weeks of contract*, side by side in the same row.
- **Football identity.** Partial. Shirt numbers and positions are there; there is no formation, no
  grouping by line, no sense of a starting seven versus a bench.
- **Immersion.** Low. Eighteen names sorted by a number.
- **Friction.** The `—` between contract and rating is an unexplained placeholder in every row.
  `title="63 cycles remaining"` on an element whose visible text is `63w`.
- **Opportunity.** **Show the team, not the list.** Default the screen to the current shape — seven
  starters in formation, bench below, out-of-squad collapsed — with the flat list behind a toggle.
  A squad screen should look like a team sheet.

---

### 2.12 Player Profile — `iphone-player-s0..s2.png`

- **Purpose.** Everything about one footballer, and two decisions about him.
- **Primary action.** "Put him in the team" / "Set his training focus" at the bottom of 2,207px.
  Clear once found; not findable in one second.
- **Hierarchy.** Name/position/overall/potential → injury banner → Fitness/Form tiles → seven
  collapsible sections (Performance, Attributes, Mental, Personality, Contract, Relationships,
  History). The accordion is the right call for this much data.
- **Emotion.** Should be: attachment. Actually: an HR record. Nothing here says who this person is.
- **Density.** Correct, thanks to the accordion.
- **Visual quality.** Adequate. Attribute rows grouped by Physical / Attacking / Playmaking /
  Defending / Mentality / Goalkeeping is the right taxonomy.
- **Football identity.** Present in the data, absent in the presentation.
- **Immersion.** Low, and this is the biggest missed opportunity in the product. Sections read
  *"Personality — 0 traits"*, *"History — 0 previous seasons"*, *"Relationships — Club, duties and
  reach"*. The player has no story.
- **Friction.** *"Form -1.9 · Last **1 appearances**"* — pluralisation bug. *"moderate injury.
  4 **cycles** remaining"* here versus *"out for about 4 **weeks**"* on Home for the same injury.
  *"Contract 63 cycles · £26.3K/cycle"*.
- **Opportunity.** **Give him a sentence.** One generated line at the top — how he arrived, what he
  is for, what he has done for you — turns a record into a person, and the content system to
  generate it already exists.

---

### 2.13 Market — `iphone-market-s0..s2.png`, `desktop-market-s0.png`

- **Purpose.** Improve the squad; be the place where ambition costs money.
- **Primary action.** "Search players" as a full-width volt button. Unmistakable — **and it is the
  brightest thing on a screen whose headline says "The window is shut."** Inviting the player into
  a closed shop with the loudest button on the page.
- **Hierarchy.** Window state → Search/Scouting → what you can spend → In the room → Shortlist →
  Doing the rounds → Around the league. Logical.
- **Emotion.** Should be: appetite. Actually: patience. On a fresh save this screen is **four empty
  states in a row**.
- **Density.** Too much scaffolding for too little content. 2,019px on day one, of which the
  majority is placeholders for things that do not exist yet.
- **Visual quality.** Good on desktop (`desktop-market-s0.png`) — the right rail turns "what you can
  spend" and "doing the rounds" into a genuinely useful dashboard, and this is the one screen where
  the desktop layout is better than the phone one.
- **Football identity.** Strong in the writing: *"A signing costs you twice: the fee comes out of
  the budget once, the wage comes out of every week that follows."* is the best explanation of a
  transfer economy I have read in a game.
- **Immersion.** "Doing the rounds" (rumour lines naming real players and real clubs) and "Around
  the league" are exactly right ideas.
- **Friction.** Three units in one panel: "Transfer budget £559K", "Wage headroom £2.4K **per
  week**", "Wage bill committed 97%" — while `/squad` calls the same wage bill "a **cycle**".
- **Opportunity.** **Never show a shut window as an empty room.** When the window is closed, replace
  the whole body with what the player *can* do — scout, shortlist, watch rumours — and count down
  to matchweek 5 with the three names most likely to move. *(See `AUDIT_GAMEPLAY` G7: nothing
  affordable improves the starting seven, which makes the whole screen currently decorative.)*

---

### 2.14 Social — `iphone-social-s0.png` (A), `iphone-social2-*.png` (B)

- **Purpose.** Prove the world is watching. This is the product's differentiator.
- **Primary action.** None — a feed, correctly.
- **Hierarchy.** Filter tabs (All / Creators / Rivals / Club / Press) → "Your reach" → the feed.
  Right.
- **Emotion.** Should be: notoriety. Day one: *nothing*. Post-match: it works, and it is good.
- **Density.** Day one, far too little (one stat card and an empty state). Post-match, right.
- **Visual quality.** Good — posts sized by engagement, avatars, handles, like/repost/reply counts.
- **Football identity.** Strong. *"that was not a bad day. that was a structural problem at Verrow
  Wanderers that has been obvious for a month."* is a real football-internet voice.
- **Immersion.** **The single best idea in the product**, and the one most damaged by content bugs:
  *"A club record. Northgate Rovers writes his name into the history of Northgate Rovers."*
  (`AUDIT_GAMEPLAY` G9) and record spam after one goal (G8) sit in the top four posts of the very
  first feed a player ever sees.
- **Friction — Window A.** The empty state's "Go to matchday" CTA rendered **behind the tab bar**
  (`iphone-social-s0.png`) — clipped and unusable. Fixed by Window B.
- **Friction — Window B.** The Social tab carries a **"9+" badge on a fresh, one-match save**,
  which is the correct mechanic firing on incorrect content.
- **Opportunity.** **Put a quality gate in front of the feed.** No record post below a real
  threshold; no template whose subject slot resolves to a club; cap same-template repeats per week.
  This is a content-rules change, not an engineering one, and it protects the best thing here.

---

### 2.15 Objectives — `iphone-objectives-s0.png` (A), `desktop-objectives-s0.png` (B)

- **Purpose.** Give the season a spine and the week a reason.
- **Primary action.** Claim rewards — invisible on day one, because there is nothing to claim.
- **Hierarchy.** Three counters (Active / Ready / Completed) → the list → a paragraph about ledger
  keys. The ledger paragraph is engineering documentation on a player-facing screen.
- **Emotion.** Should be: something to chase. Actually: **actively demoralising**, because of the
  numbers.
- **Density.** Right.
- **Visual quality.** Good — source pills (Season target / Opportunity / Sponsor / The board / The
  supporters), reward chips, progress bars.
- **Football identity.** Strong in the writing: *"Four clean sheets. In a thirty-minute format that
  is a genuine achievement."*
- **Immersion.** Good — objectives come from named sources with motives.
- **Friction — the headline bug.** *"Finish in the top half — Sixth or better"* renders
  **"Progress 12 / 8" with a completely full volt progress bar** while the club is 12th of 12
  (`desktop-objectives-s0.png`). A league *position* is being fed into a *count* progress widget,
  so worse performance fills the bar. The player is told they have completed the objective they are
  failing hardest. Meanwhile `AUDIT_GAMEPLAY` G19 shows two of the other three ("Raise a prospect",
  "Play the academy") are permanently unachievable because `youthSquad` is always empty — so on
  day one, **three of four objectives on this screen are lying**.
- **Opportunity.** Fix the two lies. Add an inverted-progress variant for position targets
  (12th → 6th shown as a bar filling *toward* the target) and gate academy objectives on a
  non-empty youth squad.

---

### 2.16 Store — `iphone-store-s0..s3.png`, `desktop-store-s0.png`

- **Purpose.** Take money without costing trust.
- **Primary action.** "See what you get" on each item — deliberately not "Buy". A good decision.
- **Hierarchy.** Rotation notice → category tabs → This rotation → The rest of the catalogue.
  On desktop, a right rail: **"What this store is"**.
- **Emotion.** Should be: no pressure. Actually: **no pressure, achieved.** This is the only screen
  that fully delivers its intended emotion.
- **Density.** Too much — 6,894px, the longest screen in the app, because the entire catalogue is
  listed alongside the rotation.
- **Visual quality.** Good. Category chips, Featured badges, honest one-line effect statements
  ("Appearance only. No effect on any match.") under every single item.
- **Football identity.** Present — retro kits, heritage badges, tifo packs, floodlit ground skins.
- **Immersion.** Neutral, appropriately.
- **Friction.** Item thumbnails are **flat coloured circles** — a magenta dot represents "Gradient
  Away Kit", an amber dot represents "Terrace Tifo Pack". Nothing is shown. A cosmetics store that
  does not show the cosmetics cannot sell them.
- **Opportunity, and a note.** **This is the most quietly excellent screen in the product.** The
  desktop rail reads: *"No randomised bundles. Every item is listed before you pay. No countdowns.
  Nothing you already own is offered to you again. If an offer here ever looks designed to rush
  you, that is a bug in this screen and not a feature of the game."* That is a monetisation posture
  most studios would not dare ship, and it is a genuine competitive asset. **Protect it verbatim.**
  The one change: render the actual kit/badge/ground using the procedural pipeline that already
  exists, instead of a coloured circle.

---

### 2.17 Settings — `iphone-settings-s0..s2.png`

- **Purpose.** Let the player tune the experience and leave.
- **Primary action.** None needed.
- **Hierarchy.** Matchday → Accessibility → Difficulty → Region → Save management. Correct, with
  the destructive action last under the heading *"The irreversible corner"*.
- **Emotion.** Confidence. Achieved.
- **Density.** Right.
- **Visual quality.** Good. Segmented controls, toggles with explanatory subtext on every row.
- **Football identity.** N/A.
- **Immersion.** N/A.
- **Friction.** At 375px, four of four Region options clip ("United Kingdom" by 42px, "European
  Union" by 41px). Match speed lives here *and* in the live match, and after the Window-B rebuild
  the live control is a cycler while this one is a four-way segmented control — two different
  interaction models for one setting.
- **Opportunity.** Genuinely strong as-is. Every toggle explains its own consequence
  (*"Reduce effects — Turns off the glass blur. Use this if the interface feels heavy on your
  device."*). Copy this pattern to every other options surface.

---

### 2.18 Cross-cutting: navigation and the shell

- **The tab bar overflows its own container on every screen at 375px.** Measured on all ten screens
  sampled: the tab `<ul>` is **11px wider than the viewport** and the "Social" tab button clips by
  **7px**, taking the "9+" badge with it. Seven destinations do not fit an iPhone SE.
  Tablet (834) and desktop (1440) are clean — `docScrollW === innerWidth` on every screen.
- **Deep links intermittently bounce to the title screen.** `router.tsx`'s `RequireGame` is
  `if (phase === 'READY') return <Outlet/>; return <Navigate to={ROUTES.onboarding} replace .../>`,
  but `gameStore.ts:21` defines `GamePhase = 'BOOTING' | 'NO_SAVE' | ...`. **`BOOTING` is treated as
  "no save"**, so any deep link that renders a frame before boot resolves is thrown to
  `/onboarding` with `replace`, destroying the history entry. Observed 1 bounce in 27 deep-link
  loads (`tablet /social → /onboarding`; the tablet `/market` capture in Window B landed on the
  title screen for the same reason). The `state={{ from: location.pathname }}` the guard passes is
  never read by anything — grep finds no consumer — so the destination is lost.
- **The dev gallery ships to players.** `/design` → `/dev/gallery` is routed unconditionally in the
  production build; 22,772px of design-system documentation is reachable from a shipped app.
  *(= `AUDIT_UX` F22, second half.)*

---

## 3. Repo-wide state of the product

### 3.1 What exists

- **`packages/engine`, 38,106 lines**, pure, deterministic, CI-enforced; 42 test files / 531 tests
  green, `pnpm audit:all` green (verified in `AUDIT_ARCHITECTURE`).
- **`apps/game`, 39,126 lines**, 164 files, 41 routes, 32 screens, 7 primary destinations.
- A **complete design system**: 60 hand-drawn 24px icons, a token file with no hex outside
  procedural art, four glass levels, a full type scale, and a 22,772px living gallery at `/dev/gallery`.
- **Procedural identity generation** for club badges, kits and player portraits, seeded and stable.
- A **content system** with social, media, commentary and objective templates.
- A **monetisation surface** with a written ethical posture.
- **Production build works**: 24 chunks, 78.7 kB CSS (13.6 kB gz), largest chunk `engine` 530 kB
  (175 kB gz). Builds in 4.8–8.7s.

### 3.2 What works — protect these

1. **The writing.** Archetypes, club identities, training programmes, tactical shapes, empty
   states, settings subtext, "What is at stake", "The irreversible corner". This is one authored
   voice and it is consistently better than the category.
2. **"Your calls" post-match grading.** WORKED / BACKFIRED with the xG delta in the following
   minutes. Original, legible, and it makes the live decisions matter *afterwards*.
3. **The live decision panel.** Momentum framing, two options with honest risk tags, a countdown,
   and an explicit statement of what happens if you do nothing.
4. **Procedural club badges.** Twelve visually distinct, recognisable-at-24px crests.
5. **The store's honesty rail.** A commercial position, written down, on the commerce screen.
6. **League press coverage.** Eleven other clubs having a season without you.
7. **Self-describing disabled CTAs.** "Add your name" / "Choose an archetype" — a pattern worth
   spreading, not just keeping.
8. **The squad-intro structure.** Strengths → the problem → the shape → what's next.

### 3.3 What is incomplete

- **Player identity.** Personality "0 traits", History "0 previous seasons", Relationships a
  placeholder. The profile screen is a container awaiting content.
- **Youth.** "0 in the academy" on every save; two objectives reference a system that has no data
  (`AUDIT_GAMEPLAY` G19).
- **Creators.** "None attached yet" on `/club`; the feature the game is *named after* has no
  starting state and no visible acquisition path from Home.
- **Desktop and tablet layouts.** They scale without breaking, which is not the same as being
  designed. `desktop-home-s0.png` has ~600px of empty rail.
- **Store assets.** Coloured circles standing in for the products.
- **The title screen.** A wordmark and a button.

### 3.4 What feels premium

Type and spacing discipline; the glass level system and its `chrome-surface` treatment; the
next-match card in Window B (kit gradients, stripes, crests); the club reveal's restraint; the
result cascade's pacing; settings; the store rail; icon consistency.

### 3.5 What feels generic

The stat-tile grid, which is the app's default answer to everything — Home, Club, Squad, Social,
Objectives, Finances and Fans all open with 2-up rounded rectangles containing a label, a big
number and a caption. Strip the words and these screens are indistinguishable from an analytics
product. The colour system contributes: near-black backgrounds, grey cards, one accent. Football
has grass, floodlights, chalk, crowd, kit; this app has none of them as surfaces.

### 3.6 What feels like a prototype

- Raw floats on screen (`-8.157399521093865`).
- `/dev/gallery` routed in production.
- Two identical unlabelled sort icons on `/squad`.
- Placeholder `—` glyphs in every squad row.
- Flat circles for store products.
- A lightning bolt as the brand mark.
- Grey-haired 25-year-olds.
- A tab bar that overflows on the second-most-common phone size.

### 3.7 What creates friction

Ranked by likely cost to a first session:

1. Manager creation: **4,263px, 35 numbers, 6.2 screens**, before anything happens.
2. The drop-zone/relegation framing at matchweek 1.
3. Ten of fourteen screens empty on a fresh save.
4. 154 seconds of watching for 25 in-game minutes at Normal speed, with no in-match escape hatch
   (Window A) and a non-obvious one (Window B).
5. Objectives that read as complete when they are failing.
6. Week / cycle / `w` — three names for one unit, contradicting each other across adjacent screens.
7. Deep links occasionally throwing the player to the title screen.

### 3.8 What is visually inconsistent

| Thing | Instance A | Instance B |
|---|---|---|
| Time unit | `ClubScreen.tsx:258` "wages a week" | `SquadScreen.tsx:270` "a cycle in wages" |
| Time unit, same element | `SquadScreen.tsx:103` renders `63w` | `SquadScreen.tsx:101` `title="63 cycles remaining"` |
| Club naming | Home: "Redmere Republic" | Preview title: "RDR" |
| Team size | Preview: "Your predicted **eleven**" | Tactics: **7-a-side**, 2-3-1 (`AUDIT_UX` F9) |
| Match speed control | Settings: 4-way segmented | Live (Window B): 1-button cycler |
| Money formatting | `economy/ledger.ts:368` | `design/domain/numbers.tsx:89` (`AUDIT_ARCHITECTURE` F12) |
| Kit on portraits | Result MOTM uses the player's own club kit for an opposition player | Everywhere else |
| Pitch colour semantics | Discs: club red / club lime | Legend: blue / teal / tan |

### 3.9 What architecture should remain

- The pure engine / React host split and its CI enforcement. Do not touch it.
- `routes.ts` as the single navigation table feeding tab bar, deep links and analytics.
- The `features/*` + `design/*` separation, and `@/design` as the only import path for UI.
- Lazy feature modules and the `ScreenFallback` that mirrors the arriving screen's shape.
- Zustand's three stores (`gameStore` / `matchStore` / `uiStore`) — the boundaries are right.
- The seeded procedural identity pipeline.
- The `Screen` scaffold and glass-level system.

### 3.10 What needs refactoring

- **`design/domain/numbers.tsx`** — make rounding the default, not an opt-in. Highest
  value-per-line change in the repo.
- **`router.tsx` `RequireGame`** — distinguish `BOOTING` from `NO_SAVE`; render the fallback while
  booting; consume `state.from` on resume.
- **`features/home/priority.ts` (877 lines)** — the "what matters now" ranker is the most
  product-critical logic in the host and has no sample-size gate.
- **`features/squad/TacticsScreen.tsx` (779)**, **`MatchResultScreen.tsx` (649)**,
  **`SquadScreen.tsx` (643)**, **`NegotiationScreen.tsx` (638)** — all past the point where a
  screen file should be split into a data hook plus presentational sections.
- **`design/Gallery.tsx` (1,234)** — should not be in the production route table at all.

### 3.11 What can be upgraded incrementally

Almost everything. The token system, glass levels and procedural pipeline mean visual upgrades are
mostly additive: hero art on the title screen, kit renders in the store, a formation view on
`/squad`, stats in the live match's dead half. None requires an engine change.

### 3.12 What should be removed

- `/design` and `/dev/gallery` from the production route table (keep the file; gate the route).
- The ledger-key explanation paragraph from `/objectives` and `/rewards` — engineering notes on a
  player screen.
- The `—` placeholder column in squad rows.
- "To the side above / Cushion below 0 pts" tiles before any match is played.
- The grey and white entries in `HAIR_COLORS`, or their unconditional selection.

### 3.13 What should be redesigned completely

1. **Manager creation.** Inverted priority, six screens of scroll. Rebuild as archetype-first.
2. **The title screen.** It is currently a placeholder.
3. **The live match's lower half.** Window B fixed the pitch and left 700px empty beneath it.
4. **`/squad`.** A list where a team sheet belongs.
5. **The desktop layout.** Not a redesign of screens — a decision about what the second column is
   *for*. Right now it is for three rows and some air.

---

## 4. What is new in this audit

For reviewers holding all four documents. Everything else here cross-references.

| # | Finding | Evidence |
|---|---|---|
| P1 | Cold start: 10/14 screens empty on a fresh save, after 7,676px of form | measured, §1.1 |
| P2 | Relegation/survival framing at matchweek 1 as the largest text on Home | `desktop-home-s0.png` |
| P3 | Objective "Progress 12 / 8" with a full bar while 12th of 12 | `desktop-objectives-s0.png` |
| P4 | Week / cycle / `w` — one field, four unit words, two direct contradictions | 8 grep'd call sites |
| P5 | Raw float default in `numbers.tsx:173`; `-8.157399521093865` on screen | `iphone-after-result-s2.png` |
| P6 | MOTM may be an opposition player, drawn in the player's kit | `MatchResultScreen.tsx:344,356,365` |
| P7 | `HAIR_COLORS` uncorrelated with age; grey-haired 25-year-olds | `PlayerPortrait.tsx:29–32` |
| P8 | Tab bar overflows viewport by 11px at 375px on every screen | measured, 10 screens |
| P9 | `RequireGame` treats `BOOTING` as `NO_SAVE`; deep links bounce, `from` unused | `router.tsx`, `gameStore.ts:21` |
| P10 | 154s real time for 25′ of a 30′ match at Normal; no in-match Instant (Window A) | timed run |
| P11 | Live pitch legend colours match nothing on the pitch; attack chip overlaps a player | `live2-12000.png` |
| P12 | Market's brightest CTA leads into a shut transfer window | `desktop-market-s0.png` |
| P13 | Store products represented by flat coloured circles | `desktop-store-s0.png` |
| P14 | Destructive "Start over instead" sits after the primary CTA in the sticky footer | `07-squad-intro-iphone.png` |

**Where documentation and the product disagree.** `PRODUCT_REQUIREMENTS.md` §100 targets a 10–15
minute cycle; the match alone consumes ~3 minutes at the default speed. `PRODUCT_REQUIREMENTS.md`
§5's curated-choice onboarding is inverted in the build (`AUDIT_UX` F5). `ARCHITECTURE.md` §12 is
stale on lint/CI/tools (`AUDIT_ARCHITECTURE` F26). And `AUDIT_GAMEPLAY`'s own caveat notes that two
of its critical findings were fixed while it was being written — which is the honest state of this
repo: it is moving fast enough that any audit is a photograph, not a diagnosis.

---

*Compiled 2026-08-20 17:27 UTC. Screenshots: `/tmp/audit-current/` (191 files). No file outside*
*`docs/CURRENT_STATE_AUDIT.md` and `docs/IMPLEMENTATION_PLAN.md` was modified; no git command was run.*
