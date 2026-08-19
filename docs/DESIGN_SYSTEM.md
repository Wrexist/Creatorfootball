# Creator Football — Design System

Grounded in `apps/game/src/design/tokens.css` (frozen — extend by adding tokens, never by
changing existing ones), `motion.ts`, `haptics.ts`, `useBreakpoint.ts`, `useMediaQuery.ts`
and `seed.ts`.

**The one rule:** no component may invent a hex value, a duration, a radius or a blur. If a
value is not in `tokens.css`, it does not exist.

---

## 1. The material: liquid glass

Dark-first, graphite-based, with a single electric accent used sparingly. The product should
read as a premium broadcast graphics package, not as a website.

### 1.1 Four elevation levels

Elevation is the *only* way depth is expressed. There are exactly four levels, and each maps
1:1 to a glass utility, a background alpha, a border alpha, a blur radius and a shadow.

| Level | bg alpha | border alpha | blur | shadow | Solid fallback | Use for |
|---|---|---|---|---|---|---|
| `.glass-1` | 0.03 | 0.07 | 12px | none | `--color-surface-1` | Ambient containers: list rows, section wrappers, stat tiles. Barely there |
| `.glass-2` | 0.055 | 0.10 | 20px | `--shadow-glass` | `--color-surface-2` | The workhorse card: player cards, fixture rows, feed posts, the nav bar |
| `.glass-3` | 0.08 | 0.14 | 32px | `--shadow-lift` | `--color-surface-3` | Lifted surfaces: bottom sheets, popovers, the live-decision panel |
| `.glass-4` | 0.11 | 0.18 | 48px | `--shadow-lift` | `--color-surface-4` | Modal over everything: full-screen takeovers, hero moments, the match-result reveal |

**Discipline.** Never stack more than **two** glass levels in a visual path. `glass-2` inside
`glass-2` reads as fog and costs two full-surface blurs. The rule is: the screen background
is opaque (`--color-base`), one glass level carries content, one more may sit above it.
Anything deeper is a design error and a performance bug.

Every level has `.glass-sheen` available — a `::before` overlay with a 160° linear gradient
from 10% white to transparent. This is the specular highlight that sells the material. It is
optional, and it belongs on `glass-2` and above, never on `glass-1`.

### 1.2 Surface ladder

Six opaque steps exist below the glass, all near-black graphite:

```
--color-void:      #050607   /* behind everything; the pitch surround */
--color-base:      #08090b   /* body background; also the native shell background */
--color-surface-1: #0e1013
--color-surface-2: #14171b
--color-surface-3: #1c2026
--color-surface-4: #262b33
```

`--color-base` (`#08090B`) is also the iOS and Android background, the splash background and
the status-bar colour in `capacitor.config.ts`, and the `theme-color` meta in `index.html`.
**Those four values must stay in sync or the app flashes on launch.**

---

## 2. Colour

### 2.1 Text

| Token | Value | Use |
|---|---|---|
| `--color-ink` | `#f4f6f8` | Primary text, headings, numbers that matter |
| `--color-ink-muted` | `#9aa3ad` | Secondary text, labels, metadata |
| `--color-ink-faint` | `#646d78` | Tertiary: timestamps, disabled, placeholder |
| `--color-ink-inverse` | `#08090b` | Text on a volt or light fill |

### 2.2 The electric-lime accent, and the discipline around it

```
--color-volt:        #c8ff2e   /* the accent */
--color-volt-bright: #dcff6b   /* hover / active-lit state */
--color-volt-deep:   #9ecc12   /* pressed, or a lower-emphasis volt */
--color-volt-ink:    #0d1400   /* text on a volt fill */
```

The token file states the rule: **"Used for state, never for chrome."**

| Volt MAY appear | Volt MUST NOT appear |
|---|---|
| The single primary action on a screen (one per screen, at most) | Two primary buttons on one screen |
| The active tab indicator | Every tab label |
| The focus ring (`:focus-visible` outline) | Decorative borders or dividers |
| A live/in-progress state: match clock ticking, negotiation open, scouting in progress | Static section headers |
| A value that has just changed (a rating rising, a balance moving) | Every number on a stats screen |
| The player's own club in the league table | Every club's row |
| A completed objective ready to claim | Every objective |
| `.volt-glow` on hero moments only (`--shadow-volt`) | As a card background fill |
| Selected state in a segmented control | The control's chrome |

**The test:** if you removed every volt element from a screen, would the player still know
what to do? If yes, there is too much volt. If more than roughly **3%** of a screen's pixels
are volt, it has stopped being an accent.

Volt is never a background for body text. `--color-volt-ink` (`#0d1400`) exists solely for
text sitting on a volt fill, and that combination should appear at most once per screen.

### 2.3 Semantic colours

| Token | Value | Meaning | Not for |
|---|---|---|---|
| `--color-positive` | `#34d399` | Gains, wins, successful outcomes, incoming money | The primary CTA — that is volt's job |
| `--color-warning` | `#fbbf24` | Reversible risk: low balance, expiring contract, fatigue high | Errors |
| `--color-danger` | `#f4525a` | Losses, red cards, failed negotiations, outgoing money, destructive actions | Merely negative sentiment |
| `--color-info` | `#7c8cff` | Neutral system information, tips, scouting reports | Anything actionable |
| `--color-special` | `#a78bfa` | Special rules, rule cards, rare/epic rarity | Ordinary highlights |

**Never encode meaning in colour alone.** Every semantic colour must be paired with a glyph,
a sign, or a word — for colour-blind users and for a 6-inch screen in sunlight. A goal
difference of `+4` is green *and* carries a `+`.

### 2.4 Club colours

`ClubVisualIdentity` supplies `primary`, `secondary` and `accent` per club, plus a badge
shape, a badge motif and a kit pattern. These are **content**, not tokens, and they may be
used only for club identity surfaces: badge, kit swatch, a 2-3px identity stripe on a club
row, the pitch team colours. Club colour never becomes UI chrome — a club with a lime
primary must not compete with volt for meaning.

### 2.5 Pitch

```
--color-pitch-deep: #0a1410
--color-pitch-mid:  #0e1c16
--color-pitch-line: rgb(255 255 255 / 0.16)
```

Deliberately desaturated near-black green. A bright green pitch would fight everything else
on the screen and would make the ball, the players and the volt state indicators harder to
read at 390pt wide.

---

## 3. Typography

| Token | Stack | Use |
|---|---|---|
| `--font-display` | `SF Pro Display`, `-apple-system`, `BlinkMacSystemFont`, `Segoe UI`, `Inter`, `system-ui` | `h1`-`h4`, big numbers, scorelines |
| `--font-sans` | `-apple-system`, `BlinkMacSystemFont`, `SF Pro Text`, `Segoe UI`, `Inter`, `system-ui` | Body, labels, everything else |
| `--font-mono` | `SF Mono`, `ui-monospace`, `JetBrains Mono`, `Menlo` | Ledger rows, seeds, debug, ids |

System fonts only — no webfont download, no FOUT, no licensing question, and native
rendering on the platform we care most about.

Base rules from `tokens.css`:

```css
h1, h2, h3, h4 { font-family: var(--font-display); letter-spacing: -0.02em; font-weight: 700; }
body { font-synthesis-weight: none; text-rendering: optimizeLegibility; -webkit-font-smoothing: antialiased; }
```

`font-synthesis-weight: none` is important: it prevents the browser faking a bold weight the
font does not have, which on Android is the difference between "designed" and "cheap".

### 3.1 Scale and usage

| Role | Size / weight | Notes |
|---|---|---|
| Screen title | 28-32px / 700 display | One per screen, at the top |
| Section heading | 17-20px / 700 display | |
| Card title | 15-17px / 600 sans | |
| Body | 15px / 400 sans | Never below 15px for prose |
| Label | 13px / 500 sans, `--color-ink-muted` | |
| Micro label | 11px / 600 sans, `0.2em` letter-spacing, uppercase | The overline pattern used in `App.tsx` |
| Hero number | 44-72px / 700 display, `.tnum` | Scorelines, ratings, money |
| Tabular data | any size + `.tnum` | **Mandatory** for any number in a column |

`.tnum` (`font-variant-numeric: tabular-nums`) is not optional on tables, timers, scores,
ratings or money. Proportional digits make a league table shimmer as it updates.

Two text-wrapping utilities exist and should be used: `.text-balance` for headlines,
`.text-pretty` for body paragraphs.

---

## 4. Spacing, radii and layout

### 4.1 Spacing

Tailwind 4's default 4px scale. In practice five steps carry almost everything:

| Step | px | Use |
|---|---|---|
| `2` | 8 | Inside a chip, between an icon and its label |
| `3` | 12 | Between related rows |
| `4` | 16 | **Default card padding, default screen gutter** |
| `6` | 24 | Between sections |
| `8` | 32 | Above a screen title, below a hero |

Screen gutter is 16px on mobile, 24px on tablet, and content is centred with a max width on
desktop (§9).

### 4.2 Radii

```
--radius-xs:   6px    /* focus ring, tiny chips, inline badges */
--radius-sm:  10px    /* inputs, small buttons, list-row thumbnails */
--radius-md:  14px    /* buttons, compact cards */
--radius-lg:  20px    /* the standard card */
--radius-xl:  26px    /* sheets, prominent cards, the decision panel */
--radius-2xl: 34px    /* full-screen takeovers, hero surfaces */
--radius-pill: 999px  /* pills, segmented controls, avatars, tags */
```

Generous and iOS-adjacent. The rule that keeps nesting from looking wrong: **an inner radius
should be roughly the outer radius minus the padding.** A `radius-xl` (26px) card with 16px
padding wants `radius-sm`/`radius-md` children, not another `radius-xl`.

`.glass-sheen::before` uses `border-radius: inherit`, so a sheened element must have its
radius set on the element itself, not on a wrapper.

---

## 5. Motion

Five duration tokens, mirrored exactly between CSS and JS so a CSS transition and a `motion`
animation on the same element agree.

```
--duration-micro:      140ms
--duration-fast:       220ms
--duration-medium:     380ms
--duration-slow:       720ms
--duration-cinematic: 1400ms
```

### 5.1 The three speeds, and what belongs to each

`motion.ts` states the rule: *"chrome moves at `micro`/`fast`, content moves at `medium`,
screens and reveals move at `slow`, and only hero moments are allowed `cinematic`."*

| Speed | Duration | Belongs to |
|---|---|---|
| **Chrome** | `micro` 140ms / `fast` 220ms | Button press, tab indicator, toggle, segmented control, chip select, toast in/out, backdrop fade, any exit |
| **Content** | `medium` 380ms | List item entry, card reveal, section rise, value change, feed row insertion |
| **Reveal** | `slow` 720ms | Screen transitions, sheet contents settling, the post-match ratings cascade, hero entry |
| *(Hero only)* | `cinematic` 1400ms | Goal celebration, trophy, key-moment reel, first-signing reveal. **Nothing else, ever** |

**Exits are always faster than entries.** Every variant in `motion.ts` follows this: `rise`
enters at `medium` and leaves at `fast`; `pop` enters on a spring and leaves at `micro`. A
slow exit makes an app feel unresponsive even when it is fast.

### 5.2 Easing

```
--ease-out-quint:   cubic-bezier(0.22, 1, 0.36, 1)     /* the default */
--ease-spring:      cubic-bezier(0.34, 1.56, 0.64, 1)  /* deliberate overshoot */
--ease-in-out-soft: cubic-bezier(0.4, 0, 0.2, 1)       /* symmetric, for loops */
```

### 5.3 Springs vs. durations

The rule from `motion.ts`: *"We prefer springs for anything the finger drives (press, drag,
sheet) because a duration-based curve always feels detached from the gesture, and easings for
anything time-driven (reveals, transitions)."*

| Spring | Stiffness / damping / mass | Use |
|---|---|---|
| `press` | 620 / 34 / 0.7 | Button press, icon tap. No visible overshoot |
| `snappy` | 420 / 32 / 0.9 | Selection pills, toggles, tab indicators, toasts |
| `gentle` | 260 / 28 / 1.0 | Content settling (`riseFar`). Slight, controlled overshoot |
| `sheet` | 340 / 38 / 1.1 | Bottom sheets and modals. Fast attack, no bounce at rest |
| `bouncy` | 380 / 16 / 0.9 | **Celebration only.** Real overshoot. Never on ordinary chrome |

### 5.4 Variants

`fade`, `rise`, `riseFar`, `pop`, `sheet`, `backdrop`, `modal`, `listContainer`, `listItem`,
`toast`, `hero`. Lists stagger at `0.045s` per child with a `0.02s` delay.

**The one hard performance rule, stated in the source:** *"Sheets: translate only. Never
animate `backdrop-filter` — it forces a full-surface recomposite every frame on mobile
GPUs."* Animate `transform` and `opacity`. `hero` animates `filter: blur()` and is the sole
exception, justified by being at most one element, at most once per session beat.

---

## 6. Hero-moment inventory

Hero moments are the only place the product spends `cinematic` duration, `bouncy` springs,
`glass-4`, `.volt-glow` and `haptics.celebrate()`. They are deliberately rationed: **at most
one per screen, and at most two or three per session.** A game where everything is a hero
moment has no hero moments.

| # | Moment | Trigger | Treatment | Haptic | Duration |
|---|---|---|---|---|---|
| H1 | **Goal scored (yours)** | `GOAL` match event, your side | Full-bleed volt flash, scorer name at hero scale, `bouncy`, crowd swell | `celebrate` | ~1.4s |
| H2 | **Goal conceded** | `GOAL`, opponent | Deliberately *smaller*: a `danger` pulse and a score tick. The game never celebrates against you, and never rubs it in | `impact` | ~0.4s |
| H3 | **Match result reveal** | `FULLTIME` | `glass-4` takeover, score at 72px, then ratings cascade at `slow` with `listContainer` stagger | `success` / `error` | ~2.5s total |
| H4 | **Key moment reel** | `MatchResult.keyMomentEventId` | Replayed `PitchFrame` window with commentary; `hero` variant entry | `impact` | ~3s |
| H5 | **Live decision prompt** | `pendingDecision()` non-null | Sim pauses; `glass-3` panel rises on `sheet` spring; options carry a subtle risk indicator; volt ring counts down `timeoutSeconds` | `warning` | 0.38s in |
| H6 | **Special rule activates** | `SPECIAL_RULE_START` | `--color-special` sweep across the pitch, rule name + one-line `reason` | `impact` | ~1.0s |
| H7 | **Signing completed** | `PLAYER_SIGNED` | Card flip from silhouette to portrait, `.volt-glow`, key attributes counting up | `celebrate` | ~1.4s |
| H8 | **Objective claimed** | `REWARD_CLAIMED` | Reward tokens fly to the balance chip; balance value counts up in volt | `success` | ~0.7s |
| H9 | **Trophy won** | `TROPHY_WON` | The biggest moment in the product: full takeover, trophy, season summary, legacy entry | `celebrate` | ~4s, skippable |
| H10 | **Season summary** | `SEASON_COMPLETED` | Paged `hero` reveals: table, top scorer, best moment, records broken | `success` | paced |
| H11 | **Record broken** | `RECORD_BROKEN` | Inline hero on the relevant screen; a permanent `LegacyState` entry | `celebrate` | ~1.0s |
| H12 | **Promotion to Legend** | Legacy legend added | Portrait treatment, the reason stated in one line | `celebrate` | ~1.4s |

Every hero moment must be **skippable by tap** and must degrade to a cross-fade under
reduced motion (§8.1).

---

## 7. Haptics policy

`haptics.ts` provides six kinds behind a driver port. Web is a no-op; the native shell
installs the Capacitor implementation at startup. Bound to `GameSettings.haptics` via
`setHapticsEnabled()`.

| Kind | Meaning | Fire on | Never fire on |
|---|---|---|---|
| `selection` | Value changed under the finger | Tab switch, segmented control, slider notch, list-item selection | Scrolling, page load |
| `impact` | A thing happened | Button press, card flip, sheet snap, special rule start | Every render |
| `success` | Confirmed | Transfer completed, objective claimed, save succeeded, match won | Every positive number |
| `warning` | Reversible problem | Invalid input, blocked action, decision prompt appearing | Ordinary negatives |
| `error` | Irreversible failure | Negotiation collapsed, save failed, transfer hijacked | Validation you can retry immediately |
| `celebrate` | Hero moments only | Goals, trophies, signings, records, legends | Anything in §6 not marked `celebrate` |

**Rules.**
1. **Haptics are strictly decorative.** A driver that throws (permission revoked, webview
   teardown) must never take a button press down with it — `fire()` wraps the call in a
   `try`/`catch` that swallows silently, by design.
2. **Never more than one haptic per user action.** A button that fires `impact` and then
   `success` 200ms later feels broken.
3. **Never haptic on something the user did not cause.** A background world tick completing
   is not a haptic event.
4. **Rate limit `celebrate`.** Two goals in ten seconds is one celebration.
5. **Respect the setting immediately.** `setHapticsEnabled(false)` gates at `fire()`, before
   the driver is consulted.

---

## 8. Accessibility

### 8.1 Reduced motion

Handled globally, in two layers.

**CSS layer** (`tokens.css`): `@media (prefers-reduced-motion: reduce)` collapses all
animation and transition durations to `0.01ms` and disables smooth scrolling.

**JS layer** (`motion.ts`): the interesting part. We do **not** simply disable animation —
*"an element that pops into existence with no transition at all reads as a glitch."* Instead
every variant collapses to a `micro` cross-fade, which conveys "something changed here"
without vestibular movement. `listContainer` collapses to `staggerChildren: 0`.

The in-app setting (`GameSettings.reducedMotion`) can force reduced motion on even when the
OS has not, via `ReducedMotionOverrideContext`. Every animated component calls
`useDesignMotion()` and gets variants, transitions and springs already resolved — **no
component writes its own `prefers-reduced-motion` branch.**

`m.safe({ scale: 1.04 })` returns `{}` when motion is reduced, for one-off values.

### 8.2 Reduced transparency

`@media (prefers-reduced-transparency: reduce)` swaps every glass level for its solid surface
token and removes `backdrop-filter`. The mapping is 1:1 (`glass-1` → `--color-surface-1`,
… `glass-4` → `--color-surface-4`), chosen so **contrast ratios are preserved**. Information
never becomes unreadable.

`[data-reduced-effects='true']` on the root does the same thing from the in-app setting, and
is also the escape hatch for performance degradation (`ASSUMPTIONS.md` A12).

Design consequence: **every layout must be verified against the solid fallback.** A design
that only reads because of a blurred background behind it is broken for a real user
population, and will be broken again the first time we disable glass for performance.

### 8.3 Contrast

| Pairing | Requirement |
|---|---|
| `--color-ink` on any surface or glass level | ≥ 7:1 (AAA body) |
| `--color-ink-muted` on `--color-surface-1/2` | ≥ 4.5:1 (AA body) |
| `--color-ink-faint` | Decorative/metadata only — **never** load-bearing information |
| `--color-volt-ink` on `--color-volt` | ≥ 7:1 |
| Semantic colours on their surfaces | ≥ 4.5:1, **and never colour alone** (§2.3) |

Glass levels must be contrast-tested against **both** the darkest realistic backdrop
(`--color-void`) and the brightest (a lit pitch, a club-coloured hero image). Translucent
text over a variable backdrop is the most common accessibility failure in a glass design
system; the mitigation is that text always sits on a glass surface, never directly on
imagery.

### 8.4 Touch targets

**Minimum 44 × 44pt** for every interactive element, per Apple HIG. Where a control is
visually smaller (a 24px icon button), the hit area is expanded with padding or a
pseudo-element — the *visual* may be small, the *target* may not.

Spacing between adjacent targets ≥ 8px. In the match view, where a mis-tap is expensive,
decision option buttons are full-width and at least 56pt tall.

`useCoarsePointer()` reports pointer capability rather than screen size — a touch laptop
still gets big targets.

### 8.5 Focus

```css
:focus-visible {
  outline: 2px solid var(--color-volt);
  outline-offset: 2px;
  border-radius: var(--radius-xs);
}
```

`outline` (not `border`, not `box-shadow`) is deliberate: it renders **outside** the element
and is not clipped by `overflow: hidden` or obscured by a glass sibling. `outline-offset: 2px`
keeps it clear of the glass border. Volt is used here as *state*, consistent with §2.2.

The focus ring must survive glass. Any component that overrides `outline` must prove the ring
is still visible on `glass-1` through `glass-4` and on all four solid fallbacks.

### 8.6 Other

- `-webkit-tap-highlight-color: transparent` globally — we draw our own press states, which
  must therefore actually exist on every tappable element.
- Scrollbars are hidden (`::-webkit-scrollbar { width: 0 }`), so **every scrollable region
  needs another affordance**: a fade edge, a peeking next item, or a visible scroll snap.
- `overscroll-behavior-y: none` on `body`, `contain` on `.scroll-y` — no rubber-band
  bleed-through between a sheet and the page behind it.
- Text must survive 200% OS text scaling without clipping. Hero numbers may cap their growth;
  body text may not.
- Every icon-only control needs an accessible label.
- Motion-triggered content (a hero moment) must never be the only way information is
  delivered — the same information exists in the static screen behind it.

---

## 9. Responsive strategy: mobile-first to desktop

Three breakpoints, deliberately. From `useBreakpoint.ts`:

> *"The product is a phone game first. `tablet` exists because an iPad running the phone
> layout at 2x looks broken, and `desktop` exists because that is where this gets reviewed
> and streamed. There is no `xl`: past 1280px the layout stops growing and centres, because
> a management screen three metres wide is worse, not better."*

| Breakpoint | Width | Shell | Content |
|---|---|---|---|
| `mobile` | < 768px | Bottom tab bar (`--nav-height: 68px` + `--safe-bottom`) | Single column, 16px gutter |
| `tablet` | ≥ 768px | Persistent side nav begins at desktop; tablet keeps the tab bar | Two columns where the content is genuinely two things (list + detail) |
| `desktop` | ≥ 1080px | Persistent side nav | Max content width ~1280px, centred. Never wider |

### 9.1 Rules

1. **Design the phone layout first and completely.** Wider layouts are a *rearrangement* of
   the same components, never a different information architecture. A feature that only
   works on desktop does not ship.
2. **No hover-gated information.** `useCanHover()` exists, and hover is a progressive
   enhancement only. Anything discoverable by hover must also be discoverable by tap.
3. **`useMediaQuery` is built on `useSyncExternalStore`, not `useEffect`.** This matters
   visibly: with the effect approach the first paint always renders the mobile branch and
   then swaps, which on a tablet shows a bottom tab bar for one frame before the side nav
   replaces it. The server snapshot returns `false` (mobile-first).
4. **Safe areas are non-negotiable.** Every fixed surface uses `.pt-safe`, `.pb-safe` or
   `.pb-nav` (`--nav-height` + `--safe-bottom` + 12px). `viewport-fit=cover` is set in
   `index.html`, so without these the home indicator sits on top of content.
5. **The body never scrolls.** `body { overflow: hidden }` — each screen owns its own
   `.scroll-y` region. This is what makes a fixed nav bar and a bottom sheet behave natively
   instead of like a web page.
6. **Horizontal rails use `.scroll-x`** with `scroll-snap-type: x mandatory` and hidden
   scrollbars, and must always show a peeking next item so the affordance survives the
   hidden scrollbar.

### 9.2 The match view is the exception

The match is the one screen with a genuinely different shape per breakpoint:
- **mobile:** pitch fills the viewport; score and clock overlay top; decision panel rises
  from the bottom as a `glass-3` sheet.
- **tablet/desktop:** pitch centred at a fixed aspect ratio with the event feed alongside;
  the decision panel becomes a centred `modal` rather than a bottom sheet.

Both consume the identical `PitchFrame` and `MatchEvent` streams. The layout differs; the
data does not.

---

## 10. Procedural art

`design/seed.ts` provides `SeedStream`, a counter-based, stateless hash for portraits,
avatars, badges and placeholder art.

**It is deliberately not the engine's `Rng`.** The reason is stated in the source and is
worth repeating because it is easy to get wrong:

> *"The engine's stream is a simulation resource whose consumption order is part of the
> save's determinism contract. Rendering must never draw from it, or scrolling a list would
> change match results."*

`SeedStream` is **channel-based** rather than sequential: `stream.channel('eyes')` is stable
regardless of what else was drawn. That means adding a new feature to a portrait between two
existing features does not change any existing portrait. Use named channels, not `next()`,
for anything a user might see twice.

Seeds come from the domain: `Player.portraitSeed`, `Creator.avatarSeed`,
`NewsStory.imageSeed`, `SocialPost.avatarSeed`.

---

## 11. Component checklist

Before a component is considered done:

- [ ] Uses only tokens — no literal hex, duration, radius or blur value
- [ ] Declares exactly one glass level, and is not the third glass level in its visual path
- [ ] Volt appears zero or one times, and only as state (§2.2)
- [ ] Semantic colour is paired with a glyph or a word
- [ ] Numbers in columns use `.tnum`
- [ ] Animates only `transform` and `opacity` (or is the one `hero` blur)
- [ ] Gets its variants from `useDesignMotion()`, not from a local `prefers-reduced-motion` branch
- [ ] Exit transition is faster than its entry
- [ ] Fires at most one haptic per user action, from the six defined kinds
- [ ] Interactive area ≥ 44 × 44pt
- [ ] Focus ring visible against all four glass levels **and** all four solid fallbacks
- [ ] Readable with `prefers-reduced-transparency: reduce`
- [ ] Readable at 200% text scale without clipping
- [ ] Renders correctly at 390pt wide (the design width) and at 1280pt (the desktop cap)
- [ ] Respects safe-area insets if it is fixed-position
- [ ] No information gated behind hover
