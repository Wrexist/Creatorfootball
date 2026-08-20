# Final Audit

**Creator Football** — state of the product at the end of the build-and-audit
cycle. This is the honest record: what was built, what the audits found, what
was fixed, what remains, and what I would not ship without.

Every number here was measured by running the real engine or driving the real
built app in a browser. Nothing is estimated.

---

## 1. Verdict

The foundations are sound and the game is playable end to end: create a
manager, create or take over a club, meet a squad, play a live match with
tactical decisions, live with the result, and carry a club across seasons.

The three independent audits reached compatible conclusions:

- **Architecture** — "Sound enough to build on. This is unfinished integration,
  not architectural rot."
- **Gameplay** — the match has a real dramatic arc and determinism is absolute,
  but it shipped with a dominant strategy and a dying world, both now fixed.
- **UX** — "Closer to premium than the finding count suggests. When it fails, it
  fails toward neon-gaming, not toward crypto-dashboard."

**It is not shippable yet.** Section 6 lists what stands between here and that.

---

## 2. What exists

| | |
|---|---|
| Source files | 359 |
| Lines of TypeScript | 81,581 |
| Engine tests | 560 |
| App tests | 20 |
| Screens | 40+ |
| Fictional clubs / players / creators | 12 / 216 / 28 |
| Documentation | 21 documents |

**Engine** (`packages/engine`) — pure TypeScript, no React, DOM, platform API,
network or filesystem. Enforced by ESLint in CI, not by convention. Contains
the match simulation, the world tick, the economy ledger, transfers,
negotiation, contracts, training, scouting, facilities, fans, sponsors, media,
social, rivalries, AI clubs, progression, legacy, the content-pack system and
the licensing layer.

**App** (`apps/game`) — React 19 + Vite + Tailwind v4, wrapped for iOS and
Android by Capacitor. A design system of four glass elevations, a closed type
scale and procedural club badges and player portraits, with no image assets and
no external UI library.

**Headless harness** (`tools/sim`) — runs the real engine with no UI, which is
only possible because of the purity rule. Three audits gate CI.

---

## 3. Measured state

### Match simulation (1,500 matches)

| metric | measured | target |
|---|---|---|
| goals per match | 6.35 | 6.0–9.0 |
| goals per minute | 0.212 | 0.20–0.30 |
| shots per team | 18.1 | 15–19 |
| conversion | 17.8% | 14–24% |
| possession range | 38.1–60.9% | 35–65% |
| yellows / reds per match | 1.10 / 0.038 | 0.5–2.5 / <0.12 |
| injuries per match | 0.173 | <0.35 |
| variance ÷ mean | 1.10 | >1 (overdispersed) |
| determinism | byte-identical | required |

Squad-quality curve: a 15-point edge wins 72%, 25 points 81.5%, 35 points
87.3% — strong enough that quality tells, never so strong that an underdog has
no path.

### Tactics

Worst single-axis swing across all 33 settings: **0.115 ppg** (was 0.480). The
former dominant stack measures 45.0% against a field default of 45.4%, and the
top configurations form a measured non-transitive cycle.

### Economy

Wage-to-turnover lands at 81% / 41% / 13% across the three club tiers, inside
football's normal band. Across a long run the population reaches equilibrium —
retirements 25 per season against an intake of 24, squad age steady near 25.
No club is insolvent, and the richest holds under 20% of league cash.

### Living world

| | before | after |
|---|---|---|
| authored content reaching a player | 34.4% | 73.4% |
| worst-repeating headline per season | 28–41× | 3–4× |
| record stories as share of press | 25% | <3% |
| hijack risk at the asking price | 41.8% | 14.8% |
| distinct champions per 8 seasons | ~1 | 4 |

### Interface

Zero clipped names product-wide. Blur depth 1 on every route. Idle Home does 0
layouts and 0 style recalculations over 6 seconds. Pitch renderer: 0.36–0.39ms
per draw, React re-rendering zero times per frame. Every text token clears
4.6:1 on all four glass levels. No horizontal overflow at 320, 360, 375 or
393px.

---

## 4. The defects that mattered most

Ranked by what they would have cost had they shipped.

**1. The game ended after 22 weeks.** The cycle computed that the season was
complete and did nothing with it. Nothing crowned a champion, aged anyone or
built the next fixture list; the clock counted weeks containing no football
while the world rotted — reputation to 1, sponsorship to zero, squads to seven
players. Every claim about a dynasty was false, and the multi-season economy
audit had been measuring one season plus 88 idle weeks.

**2. A dominant tactic worth ~20 overall points**, in a league whose entire
competitive range is 25.4. High press + high line + narrow won 71.2% with no
counter, because each of its stated prices went uncharged.

**3. The production build did not boot.** A chunk split cut a cyclic import in
half. The build passed, 531 unit tests passed, and the page died on load — the
tests run the source in Node and never touch the bundle.

**4. The game celebrated when the opposition scored.** Conceding and scoring
shared a code path, so a full takeover played with a celebration haptic when
the other team scored.

**5. The procedural portrait system could produce 76 distinct faces** across
200,000 seeds, and only 14 of 36 skin-tone × facial-hair combinations were
reachable — skin tone effectively determined facial hair. A representation
defect hiding inside a hash function.

**6. PLAY was unclickable.** The screen's sticky footer rendered underneath the
fixed tab bar on nine screens, while looking perfectly correct in a screenshot.

**7. 85% of authored content was unreachable**, with one line repeating 21
times a season — the "fake social feed" failure mode, already happening.

**8. The type scale was inert product-wide.** `tailwind-merge` classified the
size tokens as colour utilities and silently stripped every one, so every title
and caption rendered at 16px regardless of the role requested.

**9. Money moved outside the ledger**, and the audit that was supposed to catch
it never compared the two figures.

**10. The live commentary rendered at opacity zero** for entire matches.

Also fixed: scouting never progressed (the function existed and was called by
nothing); objectives double-counted every event; retired players never left the
world; an objective bar reported failure as complete; records claimed a
"generation" of history at a club founded that year; a club could be
substituted into a sentence written for a person; and copy read "the 22th
minute".

---

## 5. What the audits changed about how this is built

The current-state audit's diagnosis was the most useful sentence produced in
this cycle: *"This repo's failure mode is not bad work — it is good work in
several parallel streams with nothing measuring the seams."*

Four gates now measure the seams:

1. **Engine purity is linted.** A domain module that imports React, touches the
   DOM, reads a clock or calls `Math.random` fails the build.
2. **CI runs every package's tests.** The app's suite — including the tests
   guarding the portrait fix — had never executed in CI once.
3. **A browser smoke test drives the real bundle**: boots it, walks creation
   into a live save, and proves no control on any route is covered by chrome
   and nothing overflows a 375px viewport. It found the dead build class, the
   covered-control class, and a third instance on its first run.
4. **Three balance audits gate CI** — simulation, economy, invariants — running
   the real engine headless.

Two of my own gates were wrong and were corrected rather than satisfied:
the covered-control check reported a false positive on every scrolling list
(now it scrolls each suspect into view and re-tests, which is what a player
does), and the overdispersion check gated on an estimator too noisy to mean
anything below 800 matches.

---

## 6. What I would not ship without

**Blocking**

- **A real device pass.** Everything here was measured in headless Chromium on
  a server. Nothing has run on an actual iPhone, and the glass, the pitch
  renderer and the haptics are exactly the things a desktop measurement will
  flatter.
- **Save-size ceiling.** Projected ~4.8MB with backup by season 20 against a
  5MB localStorage quota, and the write failure is currently swallowed.
- **The world does not counter the player.** The AI never reads the player's
  shape. With a genuine rock-paper-scissors now in the tactics, an AI that
  responds would turn the tactics screen from set-and-forget into a live
  decision. This is the single highest-value remaining change.

**Strongly recommended**

- Day-one objectives: three of four are still false or unachievable as framed.
- The player's club still finishes 9th–12th; the ceiling is set by the starting
  quality spread, and compressing it costs the league its identity. This needs
  a better answer than either extreme.
- `duelWin()` and `passSuccess()` in the match model remain uncalled; real duels
  would give several traits a better home.
- Cycle cost: advancing a week takes 245ms on desktop, so likely 1–1.4s of
  frozen UI on a phone.

**Known and accepted**

- Single league tier, so promotion and relegation are modelled but unreachable.
- Single-player only; the multiplayer boundary is clean but untested.
- ~7% of authored content is unreachable by construction (it belongs to events
  only a second tier or a later season can produce).

---

## 7. Legal position

The base game is 100% original fiction: every club, player, creator, sponsor
and nation was invented for it. Licensed content is additive, loaded through
the same content-pack schema as the base pack, and gated on rights metadata
with region and expiry checks plus a fictional fallback when a licence lapses.
The four identity kinds are enforced in the type system.

Terms assumed claimed by real competitions are absent by test, not by
convention. The research dossier is explicit about the line: formats, rules and
economic models are not protectable and were studied freely; names, marks,
crests, likenesses and rulebook prose are, and none were used.

---

## 8. Standing invariants

These hold today and are asserted in CI:

- Same seed and same inputs produce a byte-identical result, including across a
  save and reload.
- No player is owned by two clubs.
- Every contract is unique to a player, and its club agrees with his.
- The league table reconciles with the results that produced it.
- No balance is negative or non-finite; no reward is claimable twice.
- Every club can field a side.
- Every social post traces to an event the engine actually emitted.
- A tampered save is rejected; a damaged one falls back to its backup.
