# AUDIT THREE — UX AND VISUAL

**Product:** Creator Football
**Method:** the real app, driven with Playwright/Chromium against the Vite dev server and the
production build. Every screen walked as a new player at 393×852, 375×667, 834×1194 and
1440×900. Contrast measured from rendered pixels (screenshot pairs with and without text).
Frame timing measured with rAF plus the CDP `Performance` domain. 82 screenshots under
`/tmp/audit-shots/`.
**Date:** 2026-08-20. The repository changed underneath this audit — two P0s were fixed by a
concurrent workstream while it was in progress. Both are recorded, with the re-verification.

---

## 1. Executive summary

**Does this look and feel like a premium product? Mostly yes — and it is closer than the
finding count suggests.** The material is right, the writing is genuinely excellent, the
colour engineering is measurably strong, the live decision panel is the best thing in the
product, and the match renders at a real 59.8 fps with zero long tasks. There is a product
here with an authored voice, which is rarer and harder than anything on this list.

But it does not yet read as one product designed by one team, and three specific things stop
it feeling native and expensive:

1. **The hero moment is broken.** A goal — the reason this genre exists — is announced by a
   wordmark painted in the scoring club's primary colour on a 95%-black scrim. Measured:
   **1.74:1** when you score, **1.25:1** when you concede. It is, literally, invisible. And
   the same code path fires for both, so the game plays a bouncy celebration with
   `haptics.celebrate()` when the opposition scores — the one thing `DESIGN_SYSTEM.md` §6 H2
   says it must never do.

2. **Onboarding is inverted against its own brief.** `PRODUCT_REQUIREMENTS.md` §5 says the
   player picks one of ten pre-made managers and one of three contrasting clubs. The app
   opens on a **4,269-pixel character-creation form** with 32 numbers on it, and puts the
   curated path behind a secondary tab. The beat sheet's "no number before minute 2:40" rule
   is broken at minute 0:25.

3. **The accent has slipped from state to chrome.** Volt is disciplined by *count* — one to
   five elements per screen — but it now sits on static section overlines ("NEXT MATCH",
   "MAN OF THE MATCH"), on rating tiers, and as a lime halo behind every primary button on
   every screen. Meanwhile the live match, where the design system says volt belongs, is
   **0.00% volt**. The accent glows where nothing is happening and is absent where everything
   is.

Fix those three and the honest answer moves from "expensive-looking with tells" to "premium".
It does not read as a crypto dashboard or a SaaS panel. Its failure mode, when it fails, is
**neon-gaming** — the glowing lime pill on a black screen — and that is a small number of
decisions away from being fixed.

---

## 2. Findings

| ID | Title | Severity | Screen | Screenshot |
|---|---|---|---|---|
| F1 | Production build dead on arrival (circular chunk → TDZ) | **P0 — fixed mid-audit** | Boot, all users | `01-splash-393.png`, `prod-recheck.png` |
| F2 | Sticky footer rendered under the tab bar; "Play" navigated to Squad | **P0 — fixed mid-audit** | Match preview + 8 more | `ob-11b-bottom-crop.png`, `recheck-preview.png` |
| F3 | Goal hero wordmark measures 1.25–1.74:1 — unreadable | **P1** | Live match | `r-live-small.png`, `m-01-live-start.png` |
| F4 | The game celebrates goals scored against you | **P1** | Live match | `m-01-live-start.png` |
| F5 | Onboarding inverts the beat sheet: builder-first, 4,269px form | **P1** | Manager + club creation | `ob-02-manager-pick.png`, `ob-05-club-pick.png` |
| F6 | "No number before 2:40" broken at 0:25 (~32 numbers) | **P1** | Manager creation, squad intro | `ob-02-manager-pick.png`, `ob-10-squad-intro.png` |
| F7 | Four semantic tokens spent on position chips; 3.88:1 at 9px | **P1** | Every list with a player | `r-squad-tablet.png`, `a11y-redtrans-squad.png` |
| F8 | Type scale is 25 px sizes; the 2 most-used aren't in the system | **P1** | Product-wide | `ob-10-squad-intro.png` |
| F9 | 7-a-side game says "eleven" in three places | **P1** | Match preview, Tactics | `f-tactics.png`, `ob-11-match-preview.png` |
| F10 | Live match on phone is 40% empty; unnumbered player discs | **P1** | Live match | `m-02-live-6s.png` vs `r-live-desktop.png` |
| F11 | Volt on static chrome; zero volt in the live match | **P1** | Product-wide | `d1-home.png`, `f-tactics.png`, `m-02-live-6s.png` |
| F12 | Speed control overflows the viewport and reflows on tap | **P1** | Live match | `m-02-live-6s.png`, `r-live-small.png` |
| F13 | Every player name truncated to 74px on tablet | **P1** | Squad (tablet) | `r-squad-tablet.png` |
| F14 | New `.chrome-surface` has no reduced-transparency fallback | **P1** | Tab bar + every footer | `a11y-redtrans-home.png` |
| F15 | All type is px — no OS text scaling; layout scales, text doesn't | **P1** | Product-wide | `a11y-textscale-200-home.png` |
| F16 | Nonsense first-use copy: "Only 0 clear of 11th", lone "·", "-0.00 xG" | P2 | Home, Club creation, Result | `d1-home.png`, `ob-06-takeover-clubs.png` |
| F17 | AUTO PICK marks GAMBLE while the copy promises the safe call | P2 | Decision panel | `m-04-fulltime.png` |
| F18 | `--color-positive` used for neutral and negative meters | P2 | Home, Club creation, Squad | `r-home-desktop.png`, `ob-06-takeover-clubs.png` |
| F19 | 3 stat tiles in a 2-up grid orphans the third | P2 | Squad intro, Match preview | `ob-10-squad-intro.png`, `ob-11-match-preview.png` |
| F20 | Post-first-match gating from the PRD is not enforced | P2 | Market, Tactics, Training | `d1-market.png` |
| F21 | Result reveal stage 1 fills ~35% of the viewport | P2 | Match result | `m-07-result.png`, `res2-stage1.png` |
| F22 | Cold open has no hero art; dev gallery link shipped | P2 | Title | `dev-01-boot.png` |
| F23 | Disabled CTA carries the instruction at 3.86:1 and doesn't scroll to it | P2 | Creation screens | `ob-02-manager-pick.png` |
| F24 | 10px and 9px text below the system's 11px floor | P2 | Tab bar, chips, badges | `d1-home.png` |
| F25 | `FOCUS_RING` uses box-shadow, the mechanism §8.5 rejects | P3 | Product-wide | `a11y-focus-desktop.png` |

---

## 3. Findings in detail

### F1 — Production build dead on arrival *(P0, fixed mid-audit)*

**Evidence.** `npx vite build` succeeded, `npx vite preview` served, and the first page load
produced a white-to-error screen: *"The game could not finish loading."*
(`01-splash-393.png`). Console:

```
ReferenceError: Cannot access 'h' before initialization
    at /assets/content-CUaev0tK.js:1:24772
```

Inspecting the emitted chunks showed a cycle created by `vite.config.ts` `manualChunks`:

```
engine-HLkfjvgG.js   -> import { B, a, b } from "./content-CUaev0tK.js"
content-CUaev0tK.js  -> import { a, M, C, B, P, H, b } from "./engine-HLkfjvgG.js"
```

Splitting `packages/engine/src/content/packs` out of `packages/engine` cut a cyclic import
in half, and ES module TDZ did the rest. **100% of users, 100% of the time.** The dev server
was unaffected, which is exactly why this survived — the failure only exists in the artefact
that ships.

**Re-verified 2026-08-20:** a rebuild now emits a single `engine-*.js` with no cycle and the
production build boots to `/onboarding` in 3.4s with zero page errors (`prod-recheck.png`).

**Fix (already applied — keep it).** Add a CI gate that loads the *production* build in a
headless browser and fails on any `pageerror`. A build that compiles is not a build that
runs, and no unit test in this repo would have caught this.

---

### F2 — The screen's primary action rendered under the tab bar *(P0, fixed mid-audit)*

**Evidence.** On the match preview at 393×852, the "Play" button's rect was
`(17, 787, 198, 52)` — and `document.elementFromPoint` at its centre returned the **tab-bar
button**, not "Play". Force-clicking it navigated to `/squad` (`m-00-after-play.png`). The
crop `ob-11b-bottom-crop.png` shows the result: a lime "Play" pill and a grey "Simulate"
smeared behind the translucent nav, with "Home / Club / Squad / Match" printed on top of them.

Root cause was structural, not local: `Screen.tsx` rendered `footer` as `relative z-20` at
the end of a `h-full` column with only `paddingBottom: var(--safe-bottom)`, while `TabBar`
is `fixed bottom-0 z-40`. Nine non-immersive screens pass a `footer` — Sponsors, Facilities,
Store, Tactics, Training, Squad, Match preview, Negotiation, Player search — so the pattern,
not the screen, was broken. A brand-new player at beat 3:40 taps the one obvious button on
the most important screen in onboarding and lands on a squad list.

**Re-verified 2026-08-20:** `Screen.tsx` now sets
`marginBottom: calc(var(--nav-height) + var(--safe-bottom))` on the footer, and both "Play"
and "Simulate" report `clickable` from `elementFromPoint` (`recheck-preview.png`).

**Fix (already applied — keep it).** Add an assertion to the test plan: for every route,
every `<button>` inside a `Screen` footer must satisfy
`elementFromPoint(centre) === button || button.contains(elementFromPoint(centre))`. This is
a five-line test that would have caught a class of bug, not an instance.

---

### F3 — The goal celebration is unreadable *(P1)*

**Evidence.** Measured from rendered pixels:

| Case | Glyph | Scrim | Contrast | WCAG large-text minimum |
|---|---|---|---|---|
| Your team scores (375×667, `r-live-small.png`) | `rgb(107,26,52)` | `rgb(5,8,8)` | **1.74:1** | 3.0:1 |
| You concede (393×852, `m-01-live-start.png`) | `rgb(34,31,46)` | `rgb(6,7,7)` | **1.25:1** | 3.0:1 |

`design/hero/moments.tsx` `GoalBurst` defaults `accent = '#c8ff2e'`, which would be fine.
But the caller overrides it:

```tsx
// features/matchday/live/MatchLiveScreen.tsx:343
accent={goal?.side === 'away' ? awayPalette.primary : homePalette.primary}
```

So the 120px `GOAL` wordmark is always painted in the scoring club's primary — and this is a
league of dark claret, navy and maroon kits, on a near-black scrim. `DESIGN_SYSTEM.md` §2.4
is explicit: *"Club colour never becomes UI chrome."* §6 H1 is explicit too: *"Full-bleed
volt flash, scorer name at hero scale."*

Secondary damage in the same overlay: the scrim is opaque enough to hide the pitch, so the
hero moment conceals the moment; and at 375px the minute label `0'` collides with the event
ticker behind it.

**Fix.** Set the wordmark to `--color-volt` for your goals and `--color-danger` for
conceded, and use the club colour only for the `Rays` wash behind it — which is where a
club colour can be low-contrast without costing anything. Lighten the scrim so the pitch
stays legible under it, and gate the whole overlay behind a contrast assertion in the
component checklist: *a hero wordmark must clear 3:1 against its own backdrop for every club
palette in the base pack*. There are twelve clubs; this is a testable loop, not a judgement
call. Also delete the literal `'#c8ff2e'` from `moments.tsx` — that is the one rule.

---

### F4 — The game celebrates goals scored against you *(P1)*

**Evidence.** `DESIGN_SYSTEM.md` §6 defines two different moments:

- **H1 Goal scored (yours)** — full-bleed volt flash, `bouncy`, `haptics.celebrate`, ~1.4s.
- **H2 Goal conceded** — *"deliberately smaller: a `danger` pulse and a score tick. The game
  never celebrates against you, and never rubs it in"*, `haptics.impact`, ~0.4s.

In the app they are the same component with the same props. `m-01-live-start.png` is a goal
**conceded at minute 0** and it produces: a full-screen takeover, the `bouncy` spring, a
120px wordmark, the scorer's name at 26px, and — from `moments.tsx` — an unconditional
`haptics.celebrate()`. The announcer copy reads *"Ember lead the celebration"* and the pitch
state chip reads `CELEBRATION`. The game buzzes your hand in delight because the opposition
scored.

This is the single clearest example of a stated design intention that never reached the code,
and it is the kind of thing players describe as "the game doesn't care about me".

**Fix.** Branch `GoalBurst` on `goal.side === playerSide`. The conceded path gets: no
takeover, a `--color-danger` edge pulse over the pitch, a score tick, `haptics.impact`, 400ms,
and no scorer name at hero scale. The celebrate haptic must also be rate-limited per §7 rule
4 — two goals in ten seconds is one celebration.

---

### F5 — Onboarding inverts its own beat sheet *(P1)*

**Evidence.** The beat sheet allots **45 seconds** to "Pick your manager: chooses 1 of 10
pre-made managers, or 'make my own'". What actually loads (`ob-02-manager-pick.png`) is the
character builder, with the segmented control defaulted to **"Build your own"** and the
curated ten hidden behind "Pick one". The builder is **4,269px tall in a 686px viewport —
6.2 screens** of skin tone, hair, hair colour, facial hair, colour, touchline outfit,
carried object, archetype and personality.

The club step repeats the inversion (`ob-05-club-pick.png`): "Create a club" — a full
identity designer with name, city, short name, three-letter code, primary, secondary, badge
shape, emblem, kit pattern, look, philosophy, fan culture and motto — is the default, and
"Take one over" is secondary. And when you do take one over (`ob-06-takeover-clubs.png`) you
get **all twelve clubs in a flat list sorted by squad strength**, not the brief's "3 of the
12, surfaced by contrasting difficulty (favourite / mid / underdog), each with philosophy,
fan culture, budget and one honest sentence about what will be hard". There is no difficulty
framing, no budget and no honest sentence.

The content underneath is *very good* — the ten managers each have a real strength and a real
weakness in plain language, and the archetype descriptions ("Wins the whiteboard. Loses the
room.") are the best copy in the product. It is buried behind the wrong default.

**Fix.** Flip both defaults. "Pick one" and "Take one over" become the primary path; the
builders become a "Build your own" affordance at the foot of each. Cut the takeover list to
three clubs with an explicit `FAVOURITE / MID-TABLE / UNDERDOG` label and the one honest
sentence, with "see all twelve" as a disclosure. That single change moves the manager step
from ~6 screens of scroll to one, and puts the writing where the player will actually read it.

---

### F6 — Numbers arrive four minutes early *(P1)*

**Evidence.** The onboarding hard rule: *"No number is shown before minute 2:40, and never
more than three at once before minute 7."*

- **Minute 0:25**, manager creation (`ob-02-manager-pick.png`): eight archetypes × four
  signed stat deltas = **32 numbers**, plus the personality trait numbers below.
- **Minute 1:50**, club takeover (`ob-06-takeover-clubs.png`): twelve clubs × two numbers
  (squad strength, reputation) = **24 numbers**, each with a progress bar.
- **Minute 2:40**, squad intro (`ob-10-squad-intro.png`): three stat tiles + three player
  cards × four attributes + a "problem" average + a four-row position breakdown with three
  numbers each = **~30 numbers**, where the brief specifies *three cards, three attributes*.

The brief's reasoning holds: the player is supposed to make a real decision before reading a
number, and the archetype cards already state the trade-off in words. `+22 Tactical
Knowledge / -14 Motivation` adds nothing the sentence "Wins the whiteboard. Loses the room."
has not already said, and it costs the screen its calm.

**Fix.** Hide the numeric deltas behind a "see the numbers" disclosure on the archetype and
club cards. On the squad intro, drop the three stat tiles and the position breakdown to the
second screen and keep exactly the star, the prospect and the problem — which is what the
section header already promises ("Three of them are worth knowing by name") and then
immediately contradicts.

---

### F7 — Four semantic tokens spent on decorative taxonomy *(P1)*

**Evidence.** `design/domain/chips.tsx`:

```tsx
const GROUP_TONE = {
  GK:  'bg-warning/16  text-warning  border-warning/30',
  DEF: 'bg-info/16     text-info     border-info/30',
  MID: 'bg-positive/16 text-positive border-positive/30',
  ATT: 'bg-special/16  text-special  border-special/30',
} as const;
```

Four of the five semantic tokens are permanently assigned to a position label that appears on
**every player row in the product**. `DESIGN_SYSTEM.md` §2.3 reserves `positive` for gains and
wins, `warning` for reversible risk, `info` for neutral system information, `special` for
special rules and rarity. Once a goalkeeper is permanently amber and a striker permanently
purple, an actual warning and an actual rule card have nothing left to say. The source comment
shows the team thought hard about *not* using `danger` for this reason — the same reasoning
applies to the other four.

It also fails contrast. Measured from `c-squad-without.png`, chip text against its own tinted
chip:

| Chip | Token | Measured | Required |
|---|---|---|---|
| `CB` | `--color-info` `#7c8cff` at 9px/700 | **3.88:1** | 4.5:1 |
| `LW` | `--color-special` `#a78bfa` at 9px/700 | **4.40:1** | 4.5:1 |

The `bg-*/16` tint is what kills it: `info` on `glass-2` measures a comfortable 6.05:1, but
`info` on `info/16` measures 3.88:1. And `outOfPosition && 'opacity-60'` takes that to
roughly 2.5:1.

The same disease shows on the squad rating pills — `≥85` renders in **volt**, `80–84` in
`positive`, the rest in neutral (`r-squad-tablet.png`) — so every squad list carries a volt
element that is data, not state.

**Fix.** Position chips become one neutral treatment: `ink-muted` on `glass-1`, with the
line of the pitch carried by *order* and by the section header, not by hue. If a colour cue
is wanted, use four steps of a single neutral ramp. Raise the chip to 11px (the system's
micro-label floor) and drop the tint alpha so the text sits on the surface, not on its own
hue. Rating pills: neutral, with volt reserved for a rating that has *just changed*.

---

### F8 — The type scale is a continuum, not a scale *(P1)*

**Evidence.** `DESIGN_SYSTEM.md` §3.1 defines seven roles. The codebase uses **25 distinct
pixel sizes**:

```
169 × text-[13px]     159 × text-[12px]      91 × text-[11px]      62 × text-[14px]
 53 × text-[15px]      25 × text-[10px]      18 × text-[16px]      15 × text-[17px]
 11 × text-[20px]      10 × text-[9px]       10 × text-[19px]       8 × text-[28px]
  7 × text-[22px]       6 × text-[24px]       6 × text-[18px]       5 × text-[34px]
  5 × text-[26px]       3 × text-[40px]       3 × text-[30px]       2 × text-[42px]
  2 × text-[32px]       1 × text-[68px]       1 × text-[46px]       1 × text-[44px]
  1 × text-[38px]
```

The specifics that matter:

- **`text-[12px]` is the second most-used size in the product (159 uses) and does not exist
  in the design system.** The system's label step is 13px. Twelve and thirteen are both in
  heavy use, at the same role, on the same screens — that is a scale with a duplicate rung.
- **`text-[14px]` × 62** is the `Screen` subtitle (`Screen.tsx:158`), i.e. the line under the
  title on *every screen in the product*. The system says body is 15px and *"Never below 15px
  for prose"*.
- **35 uses below the 11px micro-label floor** (10px × 25, 9px × 10), including the tab-bar
  labels (`TabBar.tsx:94`), all notification badges, and the position chips from F7.
- 18, 19, 22, 24, 26, 30, 34, 38, 40, 42, 46 — eleven sizes filling the gap between the
  20px section-heading step and the 44px hero-number step, where the system defines nothing.

The visible symptom is that headings on adjacent screens are a point or two apart and nothing
lines up: the compact header title is 17px, the large title 32px, section headers vary
between 10, 11 and 13px overlines.

**Fix.** Freeze eight steps as named utilities (`.t-hero`, `.t-title`, `.t-section`,
`.t-card`, `.t-body`, `.t-label`, `.t-micro`, plus one caption step at 12px if 12 is really
wanted) and lint `text-[Npx]` out of `features/**`. This is mechanical: 25 → 8 is a
find-and-replace with a review, and it is the highest-leverage single change for "does this
look like one team designed it".

---

### F9 — A 7-a-side game that says "eleven" *(P1)*

**Evidence.** `playersOnPitch: 7`, the formations are `2-3-1`, `3-2-1`, `2-1-3`, and the
lineup boards render seven names. The copy says otherwise:

- Match preview, section header: **"YOUR PREDICTED ELEVEN"** — above a list of seven
  (`ob-11-match-preview.png`).
- Tactics, empty state: *"Start from a sensible **eleven** and adjust it"* (`f-tactics.png`).
- Home, stat tile: "SQUAD RATING / Starting **seven** weighted" — correct, which makes the
  other two read as leftovers rather than a deliberate choice.

A football player notices this in under a second, and it is the kind of detail that decides
whether they trust the simulation underneath.

**Fix.** One pass over all lineup copy; derive the word from `config.playersOnPitch` rather
than hard-coding it, so an 11-a-side content pack does not reintroduce the bug inverted.

---

### F10 — The most important screen on the phone is 40% empty *(P1)*

**Evidence.** `m-02-live-6s.png` at 393×852. The pitch occupies y≈155–340 CSS px — a 185px
letterbox strip. Below it a one-line event ticker, and then **~340px of pure black** before
the control bars. `DESIGN_SYSTEM.md` §9.2 says *"mobile: pitch fills the viewport"*. It
does not; it fills 22% of it.

Compare `r-live-desktop.png`, which is genuinely good: the pitch fills its column at a proper
aspect ratio, a `MATCH FEED` panel sits alongside, and — critically — **the player discs
carry shirt numbers**. On the phone the same discs are unnumbered coloured circles about 20px
across, in two dark club colours (claret vs navy, claret vs purple) that are hard to tell
apart at arm's length. The player cannot identify a single player in the match they are
managing.

Two further consequences of the empty space: the event feed is collapsed to one line when
there is room for eight, and the two control rows are pushed to the very bottom of the
viewport (bottom edge at y≈836 of 852) where they sit in the home-indicator zone.

**Fix.** Give the pitch the space: on mobile it should take the viewport minus header minus
one control bar, with the event feed as the peeking strip that expands into a sheet. Add
shirt numbers to the discs at every breakpoint — they exist on desktop, so this is a
threshold, not a feature. And enforce a minimum perceptual separation between the two kit
palettes at render time (if the two clubs' primaries are within some ΔE, fall back to the
away club's secondary — real broadcast does exactly this).

---

### F11 — Volt glows where nothing happens and is absent where everything does *(P1)*

**Evidence.** Volt *count* is disciplined and should be protected — measured across nine
screens, 0–5 volt elements each, usually the tab indicator plus one CTA. The problem is
placement, and it is measurable three ways.

**Pixel budget.** §2.2 sets a rough 3% ceiling. Measured share of volt-family pixels:

| Screen | Volt % |
|---|---|
| Squad intro (`ob-10-squad-intro.png`) | **5.49%** |
| Title (`dev-01-boot.png`) | **5.03%** |
| Home (`d1-home.png`) | **4.68%** |
| Club reveal (`ob-08-after-club.png`) | **4.16%** |
| Match preview | 2.89% |
| Tactics | 2.73% |
| Market | 2.13% |
| League / Club / Squad / Social / Objectives | 0.01% – 0.61% |
| **Live match** (`m-02-live-6s.png`) | **0.00%** |

Every overrun is in the first three minutes, and every one is caused by the same element: a
full-width volt pill with a lime halo.

**Volt as chrome.** Measured occurrences that are not state:
- `NEXT MATCH` — a static section overline, Home.
- `NO TEAM SELECTED` — a static empty-state overline, Tactics.
- `MAN OF THE MATCH` — a static overline, Match result.
- `YOUTH ACADEMY` — the club's philosophy label, Club.
- The club name itself at hero scale on the club reveal (`ob-08-after-club.png`) — a claret-
  and-blue club introduced in the app's lime.
- `text-volt` on the Fans and Money glyphs in the result stages; `text-volt` on
  `player.overall` in `TacticsScreen.tsx:101`.

§2.2's MUST-NOT column names "static section headers" explicitly.

**The halo.** Every `GlassButton variant="primary"` carries
`shadow-[…,0_10px_28px_-12px_rgb(200_255_46/0.55)]` — an inline, non-token lime glow. §6
says `.volt-glow` is for hero moments only. This one shadow is on the title screen, the club
reveal, the squad intro, Home, Tactics, Market, the match result and every creation footer.
It is the single strongest "gaming dashboard" signal in the product, and it also breaks the
one rule: *no component may invent a hex value, a duration, a radius or a blur*.

**The absence.** `DESIGN_SYSTEM.md` lists "a live/in-progress state: match clock ticking" as
a place volt MAY appear, and H5 specifies a "volt ring counts down". The countdown ring is
correctly volt (`m-04-fulltime.png`, and it is lovely). But the match clock progress bar is
**indigo**, and the running match screen contains no volt at all.

**Fix.** Three edits. (1) Delete the inline glow from the primary button; keep the flat volt
fill, which is already unmistakable. (2) Change the six static overlines to `ink-muted`, and
the club-reveal name to `ink` over a club-coloured wash. (3) Make the match clock progress
bar volt while the sim is running. Net effect: the accent starts meaning "this is live or
this is the action" again, and the four over-budget screens drop under 3% without any layout
change.

---

### F12 — The match speed control does not fit the phone *(P1)*

**Evidence.** At 393×852, measured rects for the segmented control:

```
Slow 146-202   Normal 204-277   Fast 279-331   Instant 333-405   ← viewport is 393
```

`Instant` overruns the right edge by 12px and is clipped, with a stray skip glyph drawn over
it (`m-02-live-6s.png`). At 375×667 it reads "Insta" (`r-live-small.png`). Worse, selecting
`Instant` reflows the row 12px left (`325–397`), so the *positions of all four options change
when you use them* — on the control the player touches most often during a match, where a
mis-tap costs them the pacing of the thing they came for.

The aria state itself is correct (`aria-checked` tracks selection properly) — this is purely
a layout overflow.

**Fix.** Make the control `flex-1` within its row and drop the labels to icons + a single
active label under 400px, or move `Instant` out of the segment into a discrete "skip to
result" affordance, which is what it actually is — it is not a speed, it is an exit.

---

### F13 — Every player name is truncated on tablet *(P1)*

**Evidence.** At 834×1194 on `/squad`, measured `clientWidth` vs `scrollWidth` for the name
element of every row: **74px available against 92–152px needed, on all 18 rows**
(`r-squad-tablet.png`):

```
Sven Elmore     74 < 106      Bertil Rademaker 74 < 147
Seamus Heinonen 74 < 152      Jonas Villanueva 74 < 139
Ludvig Esposito 74 < 134      Matteo Bernal    74 < 120
```

The cause is that the tablet `Screen` introduces a 320–360px `aside`, but `PlayerRow` keeps
its fixed form/wage/dash/rating columns at full width, so the only flexible column — the name
— absorbs the entire loss. At 393px the same rows render names in full
(`a11y-redtrans-squad.png`), so this is strictly a tablet regression.

A squad list where no player can be identified is not a degraded screen; it is a broken one.
It also breaks §9.1 rule 1 — wider layouts must be a *rearrangement* of the same components.

**Fix.** Below a threshold row width, drop the form bar and the unlabelled `—` column (which
carries no header and no meaning anywhere I could find) and let the name take the space. Or
give the row a two-line layout on narrow columns, which it already has on mobile.

---

### F14 — The new chrome material ignores reduced transparency *(P1)*

**Evidence.** The tab bar and every `Screen` footer were changed during this audit from
`.glass-3` to a new `.chrome-surface`:

```css
.chrome-surface {
  background: color-mix(in srgb, var(--color-base) 88%, transparent);
  backdrop-filter: blur(var(--blur-glass-3)) saturate(160%);
}
@supports not (backdrop-filter: blur(1px)) { .chrome-surface { background: var(--color-base); } }
```

This is a real improvement — the old `glass-3` at 8% white gave almost no luminance floor,
and bright content underneath ghosted straight through the bar (`x-nav-crop.png`,
`d1-home.png`, where a 73 and a 66% read clearly through the nav and collide with the tab
labels). The 88% base fixes that.

But `.chrome-surface` was added to the `@layer utilities` block **without** being added to
either the `@media (prefers-reduced-transparency: reduce)` block or the
`[data-reduced-effects='true']` block, both of which enumerate `.glass-1` … `.glass-4` by
name. Measured with reduced transparency emulated:

```
nav computed → backdrop-filter: blur(32px) saturate(1.6)   background: rgb(8,9,11) / 0.88
```

Still blurred, still translucent (`a11y-redtrans-home.png` — content is faintly visible
through the bar). §8.2 requires the mapping to be 1:1 and the ratios preserved; §8.2 also
notes this block is the escape hatch for performance degradation, so a device that has been
downgraded keeps paying for two full-surface blurs.

**Fix.** Add `.chrome-surface { background: var(--color-base); backdrop-filter: none }` to
both blocks. Then add a unit test that asserts every class defined in the glass utility layer
appears in both fallback blocks — this is the second time a fallback list has fallen out of
sync with the thing it backs.

---

### F15 — No OS text scaling, but the layout scales anyway *(P1)*

**Evidence.** Every font size in the product is an absolute pixel value (F8: 25 px sizes,
exactly one `text-xs` in the whole codebase). Spacing, some widths and the tab indicator are
rem-based. The result under a doubled root size (`a11y-textscale-200-home.png`):

- Body and heading text does not grow at all — a low-vision player gets **no benefit**.
- Layout *does* grow, so containers expand while their contents stay the same size.
- Club names in the fixture card collapse to **"E."** and **"D"** — a `truncate` on a name
  that had room a moment ago.
- The tab-bar active indicator grows from 24px to 105px (`w-6` is rem) while the tabs beneath
  it stay put.

`DESIGN_SYSTEM.md` §8.6 requires *"Text must survive 200% OS text scaling without clipping.
Hero numbers may cap their growth; body text may not."* The product currently satisfies the
letter of "does not clip" by refusing to scale, which is the opposite of what the rule is for.

**Fix.** Move the eight frozen type steps from F8 to `rem`, with the hero step capped via
`clamp()`. Then re-run this test: the pass condition is that body text grows and nothing
truncates, not that nothing moves.

---

### F16 — First-use copy that reads as a bug *(P2)*

**Evidence.**
- Home, week 0 (`d1-home.png`): **"Only 0 clear of 11th."** in `--color-warning` amber, under
  "One win from 9th." Nothing has been played; there is no cushion to be worried about, and
  the amber makes it look like an alert.
- Club creation with nothing selected (`ob-06-takeover-clubs.png`): the preview card's
  subtitle renders as a **lone middle dot "·"**. In "Create a club" mode the same slot reads
  "City · —". Two different broken placeholders for the same empty state.
- Match result, Your Calls (`res2-stage3.png`): **"-0.00 xG conceded"** — a signed zero.
- Player search on day one (`f-search.png`): every unscouted player's ceiling reads `99`
  (`76–99`, `78–99`, `81–99`), so the upper bound carries no information at all while
  occupying half of every range.

**Fix.** Suppress the cushion line until at least one match has been played; render the
empty club subtitle as a single neutral placeholder; clamp `-0.00` to `0.00`; cap the
unscouted ceiling at something credible for the player's tier rather than the theoretical max.

---

### F17 — The default option contradicts the copy explaining it *(P2)*

**Evidence.** `m-04-fulltime.png`. The decision panel marks **"Go at it"** with `· AUTO PICK`
in volt — and "Go at it" carries the `GAMBLE` chip in `--color-danger`. The footer of the
same panel reads: *"Do nothing and the bench makes the **safe** call for you."* The safe
option ("Survive it", `SAFE`, green) is not the one that will be taken.

Either the copy is wrong or the auto-pick selection is. Given that H5's whole premise is that
the timeout must be survivable, and given that a player who freezes is the one most in need
of a safe default, the auto-pick is the likely bug.

**Fix.** Make the auto-pick the option whose risk band is lowest, and derive the footer
sentence from the option actually selected rather than asserting it.

---

### F18 — Positive green on neutral and negative meters *(P2)*

**Evidence.**
- `r-home-desktop.png`: **"Wage bill against budget — 85%"** rendered as an 85%-full
  `--color-positive` bar. Committing 85% of the wage budget is the definition of §2.3's
  `warning` ("reversible risk: low balance, expiring contract"), not a gain.
- `ob-06-takeover-clubs.png`: "Squad strength 86" as a green bar on every club, including
  the ones you are choosing *not* to take. Reputation directly below it is a neutral grey bar
  — two capability meters, two colour languages, no stated difference.
- `d1-squad.png` / `r-squad-tablet.png`: an identical-length green form bar on all 18 rows,
  and it is the widest element in each row.

§2.3 also requires that semantic colour never carries meaning alone. A green bar with no
glyph and no sign is colour alone.

**Fix.** Capability meters (squad strength, reputation, form) go neutral — they are
magnitudes, not outcomes. Budget utilisation becomes a threshold meter: neutral below 80%,
`warning` above, `danger` above 100%, each with a word next to it.

---

### F19 — Three tiles in a two-column grid *(P2)*

**Evidence.** `ob-10-squad-intro.png`: SQUAD RATING and PLAYERS sit side by side; REPUTATION
sits alone on the next row with a card-sized void to its right. The same shape recurs on the
match preview (`ob-11-match-preview.png`): POSITION and TO THE SIDE ABOVE, then CUSHION BELOW
orphaned. On the match preview the orphan's label is also truncated to "TO THE SIDE A…".

**Fix.** `StatGrid` should pick its column count from the child count — three children get
three columns (they fit; the tablet version already renders three across), or become a
`.scroll-x` rail with a peeking third item.

---

### F20 — The onboarding funnel gate is not enforced *(P2)*

**Evidence.** `PRODUCT_REQUIREMENTS.md` §5: *"The transfer market, training, facilities,
sponsors and the store are all **locked until after the first match completes**. See
`ANALYTICS.md` §3 for the funnel this protects."*

At matchweek 0, before any match, `/market` renders in full (`d1-market.png`): "The window is
open", "Search players", "Scouting", `TRANSFER BUDGET £1.32M`, `WAGE HEADROOM £73.8K`,
"Wage bill committed 85%". `/squad/tactics` and `/squad/training` are equally open. The tab
bar shows all seven destinations from the first screen after creation.

The empty states on those screens are excellent, which softens it — but the funnel this was
meant to protect is unprotected, and it puts a full financial dashboard in front of a player
who has not yet seen a goal.

**Fix.** Gate the four routes on `matchesPlayed > 0` with the locked-tab treatment the
design system already implies, and un-gate them as an explicit beat after the first result.
The gate is also the cheapest possible fix for F6's number budget.

---

### F21 — The result reveal opens on a third of a screen *(P2)*

**Evidence.** `m-07-result.png` / `res2-stage1.png`. Full time arrives and the screen shows:
a 690px-tall container holding a ~250px card with the score, the verdict ("Shared it"), the
fixture line — and then **~440px of black** above a Continue/Skip bar.

The reveal itself is well built — Continue progressively appends "The moment", the ratings
cascade with a man of the match, "Your calls" graded on xG swing, the stands, the reaction
and the books, growing to 2,013px (`res2-stage3.png`, `res2-stage5.png`). It is the paced
reveal §6 H3 describes. But its first frame — the one the player sees at the emotional peak
of the session — is 35% full, and §6 H3 asks for a `glass-4` takeover with the score at 72px,
which this is not (it is a `glass-2` card on the base background).

**Fix.** Make stage 1 a full-bleed `glass-4` takeover: score at hero scale, verdict, crowd
figure, centred. The subsequent stages can then settle into the scrolling report they already
are. The content exists; only the first frame's composition is wrong.

---

### F22 — The cold open is a black screen *(P2)*

**Evidence.** `dev-01-boot.png`. The beat sheet's first 25 seconds: *"Full-bleed hero: a
stadium at night, one line of copy, one CTA. No logo parade, no legal wall — 'This looks
expensive'."* What renders is the wordmark and one line at the top, the CTA at the bottom,
and **~750px of empty black between them** on an 852px screen. There is no hero image, no
stadium, no motion. The subtitle "Build your club. Recruit your creators. Own the league." is
good; it is floating in a void.

Also on this screen: a **"Design gallery"** link, which routes to `/dev/gallery` — a
development surface, shipped in the player-facing build, one tap from the first screen.

**Fix.** Fill the void with the hero the brief asks for — even a procedural night-stadium
gradient with the club-colour rays that `moments.tsx` already implements would carry it — and
move the title/subtitle down to sit on it. Gate the gallery link behind `import.meta.env.DEV`.

---

### F23 — The disabled CTA is the instruction, at 3.86:1 *(P2)*

**Evidence.** The creation footer button doubles as the validation hint: it reads "Add your
name", then "Choose an archetype", then "Next: your club" as the form is completed. That is a
good idea. Two problems with it:

- It renders as `bg-volt` at `opacity: 0.45`. Composited over base, `--color-volt-ink` on
  `--color-volt` at 45% measures **3.86:1** — below AA — while carrying the only instruction
  on the screen. (At full opacity the pair is a healthy 15.93:1.)
- It is not a link to the problem. On a 4,269px form, "Choose an archetype" does not scroll
  you to the archetype section; you have to go and find it.

**Fix.** Style the incomplete state as a neutral surface with `ink` text (which clears AA
comfortably) rather than a dimmed volt fill, and make it scroll-to-and-focus the first
incomplete section on tap instead of being inert.

---

### F24 — Text below the system's own floor *(P2)*

**Evidence.** §3.1's smallest defined step is the 11px micro-label. In use:
`TabBar.tsx:94` tab labels at **10px**; `TabBar.tsx:87` and `:179` badge counts at **9px**;
`GlassIcon.tsx:89`, `GlassTabs.tsx:123`, `GlassPill.tsx:55` at 10px; `chips.tsx:107` position
chips at **9px** (the F7 contrast failures); `PlayerCard.tsx:297` at 9px;
`FeedItem.tsx:82` at 9px. Thirty-five occurrences.

The tab labels are the most consequential: seven permanent destinations at 10px, on the
control the player uses more than any other.

**Fix.** Raise the floor to 11px everywhere and let the tab labels take 11px — the bar is
68px tall and has the room. Where 11px genuinely will not fit, the answer is fewer words, not
smaller type.

---

### F25 — The focus ring uses the mechanism the design system rejects *(P3)*

**Evidence.** `tokens.css` sets `:focus-visible { outline: 2px solid var(--color-volt) }` and
§8.5 explains why: *"`outline` (not `border`, not `box-shadow`) is deliberate: it renders
outside the element and is not clipped by `overflow: hidden` or obscured by a glass sibling."*

`design/glass/glassLevel.ts` then defines:

```ts
export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-volt focus-visible:ring-offset-2 focus-visible:ring-offset-base';
```

…which is applied by ~20 components across the kit and by feature screens directly. Measured
on a focused tab: `outline-width: 0px`, and the ring arriving as
`box-shadow: rgb(8,9,11) 0 0 0 2px, rgb(200,255,46) 0 0 0 4px`.

**In practice the ring is visible and legible everywhere I tested** — I scanned every
focusable element on `/squad` for an `overflow`-clipping ancestor within 4px and found **zero
clipped rings**. So this is a latent contradiction rather than a live failure, and the
severity reflects that. But it is exactly the kind of drift that produces an invisible focus
ring the first time someone adds `overflow-hidden` to a card, and the design system already
wrote down why.

**Fix.** Either make `FOCUS_RING` an outline (`outline-2 outline-volt outline-offset-2`) or
amend §8.5 to document the ring-with-offset decision and why it is acceptable. Silence
between the two is the problem.

---

## 4. The first ten minutes, against the beat sheet

Walked end-to-end as a new player at 393×852.

| Beat | Brief | What actually happens | Verdict |
|---|---|---|---|
| **0:00–0:25** Cold open | Full-bleed stadium at night, one line, one CTA | Wordmark + one line at top, CTA at bottom, ~750px of black between. Plus a dev "Design gallery" link | ✗ (F22) |
| **0:25–1:10** Pick your manager | 1 of 10 pre-made, or "make my own" | Defaults to the 6.2-screen builder; the ten are behind a secondary tab. 32 stat numbers on screen | ✗ (F5, F6) |
| **1:10–1:50** Name and face | Name + 4–5 appearance taps | Present, but embedded in the same 4,269px scroll — seven sections, ~40 choices | ~ |
| **1:50–2:40** Pick your club | 3 of 12 by contrasting difficulty, each with philosophy, fan culture, budget and one honest sentence about what will be hard | Defaults to a full identity designer. "Take one over" gives all 12 in a flat list sorted by strength, with squad strength + reputation and no difficulty framing, no budget, no honest sentence | ✗ (F5) |
| *(unscheduled)* Club reveal | — | **Genuinely excellent** (`ob-08-after-club.png`) — badge, kit, motto, founding year. Best moment in onboarding. Marred only by the club name being rendered in the app's lime instead of the club's own claret (F11) | ✓ |
| **2:40–3:10** Three cards | Exactly three players: the star, the prospect, the problem. 3 attributes each | Three stat tiles, then "YOUR BEST THREE" (three *stars*, not star/prospect/problem), 4 attributes each, then a 12-number position breakdown. ~30 numbers. Only two of the three cards are visible; the rail's third card is off-screen with no fade affordance | ✗ (F6, F19) |
| **3:10–3:40** One tactical decision | Picks 1 of 3 shapes in plain language | **Does not happen here.** The squad intro goes straight to "Play". The three shapes with plain-language descriptions do exist and are well written — but they are at the bottom of `/squad/tactics`, below the team picker, on a screen the flow never routes you to | ✗ |
| **3:40–6:30** First match | Watches; makes exactly two live decisions. Seeded so the first 6 minutes contain a shot and a chance for the player | **Was unreachable** — the "Play" button was under the tab bar and navigated to Squad (F2, since fixed). A goal landed at **minute 0** in two of five playthroughs, once against the player (`m-01-live-start.png`, "Trailing 0-1"), with a full celebration overlay played for it (F4). **`maxDecisions: 2` is not honoured**: one first match produced decisions at 4' and 10'; another's result screen listed four, at 6', 12', 18' and 24' (`res2-stage3.png`). The speed control's "Instant" is clipped off-screen (F12) | ✗ |
| *(during)* Decisions | 2–3 options, real encoded downside, volt countdown | **The best screen in the product.** Three options, a risk chip, a stated cost in minutes, a stated auto-pick, and "Do nothing and the bench makes the safe call for you". Correct dialog semantics, `role=alert`, focus moved to the first option. Only flaw: AUTO PICK sits on the GAMBLE option (F17) | ✓ |
| **6:30–7:20** The key moment | Replay of one moment, ratings revealed one by one | Present and good — "THE MOMENT / 29' · goal / He will remember that one" with the xG, then a ratings cascade with a man of the match and "Your calls" graded on xG swing. But stage 1 is 35% empty (F21) and the reveal is a `glass-2` card, not the `glass-4` takeover H3 specifies | ~ |
| **7:20–8:00** The world reacts | 4–6 posts, at least one naming a player shown at 2:40 | Reached via the result stages ("The reaction"). Day-one `/social` before a match is an empty state — and a very good one: *"Nothing has happened yet. Every post here traces back to something real — a result, a signing, an injury, a row. Play a matchweek and the world will start talking."* with a "Go to matchday" CTA | ✓ |
| **8:00–8:40** First objective | Accepts one board and one fan objective | Day-one `/objectives` is empty with a good empty state, but there is **no accept step** in the flow — nothing routes the player here, and nothing asks them to accept anything | ✗ |
| **8:40–9:20** One thing to fix | One listed player who fits the weakest position, inside budget | Not present as a prompt. `/market` is fully open from minute 0 (F20) with 198 searchable players and a budget dashboard — the opposite of one credible target | ✗ |
| **9:20–10:00** The table | League table + `positionContext()` — "one win from fourth" | Present and good: `10 / MID TABLE / One win from 9th.` on Home. Undermined by "Only 0 clear of 11th." in amber at week 0 (F16) | ~ |

**Score: 4 beats hit, 3 partial, 6 missed.** The failures cluster in one place — the game
gives the player a *builder* where the brief gives them a *choice*, and it gives them numbers
where the brief gives them a sentence. Almost all of the missing content already exists and
is well written; it is behind the wrong default or below the fold. That is a far better
position to be in than missing content, and F5 alone recovers four of the six missed beats.

The hard rule *"No tutorial modal ever blocks a tap"* is honoured throughout — there is not a
single blocking tutorial in the product. That is worth saying out loud.

---

## 5. Accessibility

Measured, not assumed. Contrast is computed from rendered pixels: two screenshots per screen
(one normal, one with `color: transparent` forced on every node), the background sampled at
each text node's exact rect from the text-free image, the foreground composited at its own
alpha. 234 text nodes across Home, Squad, Club, League and Market.

### 5.1 The token palette — genuinely strong

Contrast of each ink against each surface, composited over `--color-base`:

| Token | base | glass-1 | glass-2 | glass-3 | glass-4 | surface-1 | surface-2 | surface-3 | surface-4 |
|---|---|---|---|---|---|---|---|---|---|
| `ink` `#f4f6f8` | 18.39 | 17.52 | 16.63 | 15.62 | 14.33 | 17.59 | 16.59 | 15.10 | 13.14 |
| `ink-muted` `#9aa3ad` | 7.79 | 7.43 | 7.05 | 6.62 | 6.07 | 7.45 | 7.03 | 6.40 | 5.57 |
| `ink-dim` `#8a939e` | 6.40 | 6.10 | 5.79 | 5.44 | 4.99 | 6.12 | 5.78 | 5.26 | **4.57** |
| `ink-faint` `#646d78` | 3.79 | 3.62 | 3.43 | 3.22 | **2.96** | 3.63 | 3.42 | 3.12 | **2.71** |
| `volt` `#c8ff2e` | 16.88 | 16.09 | 15.27 | 14.35 | 13.16 | 16.15 | 15.24 | 13.86 | 12.06 |
| `positive` `#34d399` | 10.36 | 9.87 | 9.37 | 8.81 | 8.07 | 9.91 | 9.35 | 8.51 | 7.40 |
| `warning` `#fbbf24` | 11.93 | 11.37 | 10.79 | 10.14 | 9.30 | 11.41 | 10.77 | 9.80 | 8.52 |
| `danger` `#f4525a` | 5.88 | 5.61 | 5.32 | 5.00 | 4.58 | 5.63 | 5.31 | 4.83 | 4.20 |
| `info` `#7c8cff` | 6.69 | 6.37 | 6.05 | 5.68 | 5.21 | 6.40 | 6.04 | 5.49 | **4.78** |
| `special` `#a78bfa` | 7.32 | 6.97 | 6.62 | 6.22 | 5.70 | 7.00 | 6.61 | 6.01 | 5.23 |

`ink` clears AAA on every surface including `glass-4`. `ink-muted` clears AA everywhere and
AAA up to `glass-2`. `ink-dim` was added specifically to clear 4.5:1 to `surface-4` and does,
at 4.57:1 worst case — that is a token that was engineered, not guessed. `volt-ink` on `volt`
measures **15.93:1**. This is the strongest part of the design system and should be defended.

`ink-faint` fails AA on every surface (2.71–3.79:1), which `tokens.css` already documents and
restricts to non-text. I found no load-bearing text using it.

### 5.2 Measured failures

Of 234 text nodes measured on live screens, **2 fail WCAG AA** (10 further "failures" were
the deliberately transparent form pips, which carry no text):

| Ratio | Required | Element | Screen |
|---|---|---|---|
| **3.88:1** | 4.5:1 | `CB` — `--color-info` on `bg-info/16`, 9px/700 | Squad |
| **4.40:1** | 4.5:1 | `LW` — `--color-special` on `bg-special/16`, 9px/700 | Squad |

Plus, measured separately because they are not ordinary body text:

| Ratio | Required | Element |
|---|---|---|
| **1.25:1** | 3.0:1 | `GOAL` wordmark, goal conceded (F3) |
| **1.74:1** | 3.0:1 | `GOAL` wordmark, goal scored (F3) |
| **3.86:1** | 4.5:1 | Disabled primary CTA carrying the form instruction (F23) |

The pattern is consistent and worth stating plainly: **the tokens are right; the failures all
come from painting a token onto a tinted background of its own hue, or onto a club colour.**
Fixing F3 and F7 fixes every measured contrast failure in the product.

### 5.3 Screen-reader semantics — largely correct

- **Icon-only controls:** scanned every `button` and `a[href]` on Home, Squad, Club, League,
  Market and the match. **Zero unlabelled controls.** "Reorder squad", "Sort and filter",
  "Back", "Skin tone 3", badge counts as "3 new" — all present.
- **Live regions in the match:** `role="alert"` `aria-live="assertive"` `aria-atomic="true"`
  for decisions (*"Decision at 6'. You've lost the middle of the pitch. … 3 options."*), and
  a separate `aria-live="polite"` `aria-atomic="true"` region carrying match events including
  goals (*"6' Read by Teodor Stjepanovic, and Saltpine have it."*). Correct choice of
  assertive vs polite.
- **Selection state:** appearance and hair options expose `aria-pressed`; segmented controls
  expose `role="radio"` + `aria-checked`; tabs expose `aria-current="page"`. Verified that
  `aria-checked` tracks the match speed control correctly.
- **Sheets:** `role="dialog"`, `aria-modal="true"`, labelled. **Focus moves in, cycles inside
  the sheet, does not escape** (verified with 14 consecutive Tab presses on the squad sort
  sheet), Escape closes, and **focus is restored to the trigger button**. This is textbook
  and rare; protect it.
- **The decision overlay** does the same, with focus landing on the first option.

Defects found:
- Two `nav aria-label="Primary"` landmarks exist in the DOM at all times (`SideNav` and
  `TabBar`, one `display:none`). Harmless today because `display:none` removes it from the
  accessibility tree, but it is a duplicate-landmark trap if either is ever hidden by
  `visibility` or `opacity` instead.
- On Home, a `<div>` containing only "10" is focusable, and a section header "CREATOR NOISE"
  is a `<button>` — both surface in the tab order as unexplained stops.
- Animated stat values render a visually-hidden duplicate whose text malforms the unit:
  screen readers receive "66 66% %" for a 66% value, "55 55/100 /100" for a rating, "18 18"
  for a count. The visual rendering is correct; only the announced string is wrong.

### 5.4 Reduced motion

`prefers-reduced-motion: reduce` emulated. Both the CSS layer (durations to 0.01ms) and the
JS layer (`motion.ts` collapsing every variant to a `micro` cross-fade) engage.
`a11y-redmotion-home.png` and `a11y-redmotion-squad.png` are fully usable and fully readable
— nothing depends on a transition to become visible. **Pass.**

### 5.5 Reduced transparency

`prefers-reduced-transparency: reduce` emulated. `.glass-1` … `.glass-4` correctly swap to
their solid surface tokens with `backdrop-filter: none`, and both screens remain readable
(`a11y-redtrans-home.png`, `a11y-redtrans-squad.png`). **The new `.chrome-surface` does
not** — it keeps `blur(32px)` and 88% alpha, so the tab bar and every screen footer stay
translucent (F14). Partial pass.

### 5.6 Touch targets and safe areas

- Measured every interactive element on the manager creation, squad, sort-sheet and match
  screens against 44×44pt. Header icon buttons: 44×44. Tab items: 56×68. Segmented options:
  136×36 visually with a 44pt minimum enforced by `min-h-11` on the row. Primary CTAs: 52px
  tall, full width. Decision options: full width, well over 56pt. **No target under 44pt was
  found in a rendered box** — `TOUCH_TARGET = 'min-h-11 min-w-11'` is applied consistently.
- Safe areas: emulated `--safe-top: 59px` / `--safe-bottom: 34px`. The tab bar correctly
  resolves to 749–852 with `padding-bottom: 34px` (68 nav + 34 safe + border), and the
  screen footer now clears it (`a11y-safearea-home.png`). **Pass** — with the caveat that the
  live match's second control row sits within 16px of the viewport bottom at 393×852 and
  should be re-checked once F10's layout is revised.

### 5.7 Focus ring

Visible on every element tested, delivered as a two-layer box-shadow ring
(`rgb(8,9,11) 0 0 0 2px, rgb(200,255,46) 0 0 0 4px`) rather than the outline the design
system specifies. Scanned every focusable element on `/squad` for a clipping ancestor within
4px: **zero clipped rings**. See F25.

---

## 6. Performance

All figures measured in headless Chromium at 393×852 against the dev server, via `rAF`
timing plus the CDP `Performance` domain. Treat them as a healthy-machine ceiling, not as an
iPhone 12 number — but the *shape* of the data is what matters, and it is good.

### 6.1 Live match, 10 seconds of continuous pitch animation

| Metric | Measured |
|---|---|
| Frames sampled | 595 |
| Mean frame time | **16.72 ms** |
| Mean frame rate | **59.8 fps** |
| p50 frame time | 16.70 ms |
| p95 frame time | **16.80 ms** |
| Worst frame | 50.1 ms (one, at start) |
| Frames > 33 ms | **1 of 595** |
| Long tasks (>50ms) | **0** |
| Script duration | 0.554 s over 10 s (**5.5% of wall clock**) |
| Layout count | 536 (≈1/frame), total 0.077 s (**0.14 ms each**) |
| Style recalcs | 596, total 0.104 s |
| DOM nodes | **245** |
| JS heap | 19.2 MB |

The launch gate in `PRODUCT_REQUIREMENTS.md` §7.1 is *≥ 55 fps sustained on iPhone 12*. At
p95 = 16.8 ms with a 245-node DOM and no long tasks, there is real headroom. The decision to
render the pitch to canvas rather than to DOM nodes is doing exactly what it was supposed to.

The one layout per frame is worth a glance — something is reading geometry each tick — but at
0.14 ms it is not a problem, and there is no thrash pattern (layout count ≈ recalc count ≈
frame count, i.e. one clean pass, not interleaved read/write).

### 6.2 Idle screens

| Metric | Home, 6 seconds idle |
|---|---|
| Script duration | **0.021 s** (0.35% of wall clock) |
| Layout count | **0** |
| Style recalcs | **0** |

Nothing animates that should not. No off-screen loop, no continuous re-render, no keep-alive
timer burning a phone's battery on a management screen. This is the single best performance
result in the audit and it directly answers "is anything animating that should be still" —
no.

### 6.3 Glass and blur budget

The stated rule is at most two blurring layers in a visual path. Measured by walking every
element with a non-`none` `backdrop-filter` and counting blurring ancestors:

| Context | Max blur stack depth |
|---|---|
| Home | **1** |
| Squad with the sort sheet open | **1** |
| Live match with the decision overlay open | **1** |

**Pass, with margin.** No screen tested stacks even two blurs, let alone three.

### 6.4 Production build

Cold load of the production build to `networkidle`: **3.43 s** (dev-machine, local server, no
throttling — not comparable to the ≤2.5 s iPhone 12 gate, but no red flags). The largest
chunk is `App-*.js` at 694 kB / 225 kB gzipped, which triggers Rollup's 500 kB warning and is
worth splitting before launch — the route-level lazy loading is already in place, so this is
mostly about what is being pulled into the shared chunk rather than about adding
infrastructure.

### 6.5 Layout overflow

Scanned every element for `right > innerWidth` at all four viewports. One offender, at 393px
and 375px only: the match speed control (F12). Document `scrollWidth` equals `innerWidth` at
every breakpoint — the body never scrolls horizontally.

---

## 7. What is genuinely excellent — protect this

**The writing.** This is the product's biggest asset and it is not close. "Wins the
whiteboard. Loses the room." "You will not be bored. You may be relegated." "Inherit a squad,
a history and someone who already hates you." "Do nothing and the bench makes the safe call
for you." "Built here. Kept as long as we can." Every archetype states a real strength and a
real weakness. Nothing is marketing copy. Do not let a redesign sand this down.

**The empty states.** Day one has no feed, no history, no objectives and no transfers, and
every one of those screens is *better* empty than most products are full:
- *"Nothing has happened yet. Every post here traces back to something real — a result, a
  signing, an injury, a row. Play a matchweek and the world will start talking."*
- *"Nobody on the list. Shortlisting a player keeps him in front of you and makes him the
  first thing a scout looks at."*
- *"Nothing is being said. Rumours come out of real interest in real players."*
- *"Nothing on the board. New objectives are set as the season moves… Play a matchweek and the
  board will find something to ask of you."*

Each explains the mechanic, sets an expectation, and offers exactly one next action. This is
the hardest writing in a game to get right and it is done.

**The live decision panel.** The best-designed screen in the product and the clearest
expression of what this game is: three options, each with a plain-language description, a
risk chip (`SAFE` / `CALCULATED` / `GAMBLE` — semantic colour used *correctly*, always paired
with a word), an honest cost in match minutes, a volt countdown ring, a stated default, and a
sentence telling you what happens if you freeze. Correct dialog semantics, `role=alert`,
focus placed on the first option. Ship this and build outward from it.

**The contrast engineering.** `ink` at 18.4:1 on base and 14.3:1 on `glass-4`. `ink-muted`
clearing AA on every surface. The `ink-dim` token added specifically because `ink-faint`
measured 3.1–3.8:1, documented in the token file with the reason and the worst-case number.
Somebody did the arithmetic instead of eyeballing it, and it shows in the measurements.

**Sheet behaviour.** Focus moves in, is trapped, cycles, Escape dismisses, focus returns to
the trigger. Verified, not assumed. Most shipped products fail at least one of those four.

**Performance discipline.** 59.8 fps with a 245-node DOM during the match; zero layouts and
zero style recalcs on an idle screen; max blur stack of 1 everywhere. The canvas pitch, the
motion-value-driven header collapse ("scrolling a 40-row squad list does not re-render the
screen once"), and the `useSyncExternalStore` breakpoint hook are all real engineering
choices with real measured payoffs.

**The desktop and tablet match view.** `r-live-desktop.png` is a genuine re-composition, not
a stretched phone: the pitch at a proper aspect ratio with numbered discs, a feed alongside,
the nav removed for immersion. §9.2 said the match would be the one screen with a different
shape per breakpoint, and it delivered on that promise.

**The club reveal.** `ob-08-after-club.png` — badge, kit, motto, founding year, one CTA. The
moment that makes the club yours. It works.

**Scouting uncertainty as an interface.** `76–99` with an `UNSCOUTED` chip and a scouting
percentage, instead of a fake precise number. That is a designer choosing information design
over decoration.

**Graceful failure.** The unknown route renders "There is nothing here — that link points at
a screen this version of the game does not have" with a way back. The save guard catches deep
links with no save. The boot failure screen — the one F1 triggered — is calm, tells the truth
about what did and did not change on the device, and offers a retry. Somebody thought about
the bad day.

---

## 8. Suggested order of work

1. **F3 + F4** — the goal moment. Highest emotional cost, smallest diff, and it is the reason
   people play the genre.
2. **F5 + F6 + F20** — flip the onboarding defaults and gate the four systems. Recovers four
   missed beats and most of the number-budget problem in one change.
3. **F11 + F8** — delete the primary-button glow, move six overlines off volt, freeze eight
   type steps. This is the "one team designed this" pass.
4. **F7 + F13 + F10** — the squad row and the phone match layout.
5. **F14 + F15 + F24** — the accessibility fallbacks and the type floor.
6. **F1 + F2 regression tests** — a headless production-boot check and a footer-hit-test
   assertion, so the two P0s that were fixed during this audit cannot come back.
