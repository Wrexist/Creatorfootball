# Creator Football — AI Asset Prompt Pack (ChatGPT idiom)

> Companion to `docs/AI_ASSET_PROMPTS.md`. That document is the source of truth for art direction,
> palette hexes, silhouettes, destinations, weight budgets and acceptance checks, written in
> Midjourney/SDXL idiom (`--ar` flags, keyword-list negative prompts). **This document re-authors the
> same assets for ChatGPT image generation**, which behaves differently enough that the original
> prompts underperform there.
>
> Entry IDs are identical in both documents (`A1`, `B4a`, `C5`…), so the two cross-reference cleanly.
> Where this pack drops an entry, §6 says why.
>
> **Prime directive, unchanged:** every file here is an *override layer* over a working procedural
> path. A file that is missing, corrupt or slow is never a bug — the component behind it draws.
> Nothing in this pack may become load-bearing.

---

## 1. How this pack differs — read once

The rules below are already baked into every prompt in §3–§5. They are printed here so you know
*why* the prompts look the way they do; you never have to copy anything from this section.

1. **No flags.** `--ar 25:33`, `--tile` and friends are gone. In practice you choose a canvas in
   plain words — **square**, **portrait** or **landscape** — and every entry states which to ask for.
   Exact pixel dimensions are not something to argue with the generator about: each entry gives the
   **final target size**, and `tools/brand/ingest.mjs` (§7) does the crop and resize.
2. **Exclusions are written as positive declarative sentences, never as keyword lists.** A list of
   banned nouns reads to the model as a list of nouns, and it will sometimes draw them. So instead of
   `no silver, no chrome`, the prompt says *"The metal is gold only — no silver, chrome or brass
   appears anywhere on the piece."* **Every entry here has exactly one prose prompt block and no
   separate negative block.**
3. **It drifts toward adding text.** Captions, labels, engraved names, scoreboard digits, little
   watermark scribbles in a corner. Every prompt forbids lettering explicitly and every acceptance
   checklist carries **☐ Zero glyphs anywhere**. Check the corners at 200%.
4. **Hex fidelity is approximate.** State the hexes anyway — they steer the hue and the value even
   when they are not matched exactly. Every prompt carries the standing instruction that **if an
   exact match is not possible, err darker and more desaturated**; final colour grading happens in
   post, and a plate that came back too bright is much harder to rescue than one that came back too
   dark.
5. **Transparency is unreliable in a chat surface.** Every alpha asset therefore gives two paths:
   - **Path A** — ask for a transparent PNG (the prompt does), and if the returned file really has
     alpha, use it.
   - **Path B (fallback, and the one to expect)** — the same prompt asks for a flat, evenly lit pure
     `#050607` backdrop with no shadow, gradient, reflection or contact shading touching the subject
     or the frame edge, which the ingest script keys out. Each entry says which path applies.
   Path B is not a downgrade: a hard flat `#050607` behind a well-lit subject keys more cleanly than
   most chat-returned alpha, which tends to arrive with a halo.
6. **Set consistency comes from the thread, not from the prompt.** For the two multi-part sets —
   **B4 trophies ×5** and **B7 story plates ×5** — run the whole set in **one chat thread**: paste
   the set primer first, then each variant prompt in order, without starting a new conversation in
   between. The model carries lighting, weight and construction across the set that way, which is
   what makes "all five read as one family" achievable at all. Each set has its own primer block.
7. **Reference images help enormously.** For the trophies (B4), attach a PNG of the in-game SVG with
   the instruction *"match this silhouette exactly; repaint it as a rendered gold object."* Export
   the SVG from the design gallery at **`/dev/gallery`, Silverware section** (all five are rendered
   there at 72 px — screenshot at high zoom, or lift the SVG from
   `apps/game/src/design/domain/silverware.tsx`). This is how B4's ~4% silhouette-agreement check
   stops being wishful thinking.
8. **Iteration is conversational.** Do not re-roll a whole prompt when one thing is wrong — say what
   is wrong in the same thread. Each entry ships one or two ready-made correction phrases for its
   most likely failure.
9. **One asset = one code block = paste and go.** Inherited from the source pack and absolute here
   too: every fenced prompt below is the whole prompt, with the style language and the palette hexes
   already inside it. Nothing to prepend, nothing to look up, nothing to assemble. The §2 primer is
   an *accelerator*, not a dependency — every prompt still works pasted cold into an empty thread.
10. **Audio is out of scope.** ChatGPT does not generate audio. The 15 `D`-entries stay in
    `docs/AI_ASSET_PROMPTS.md` §6, which names the right tools (ElevenLabs SFX / Suno-class) and
    already carries the full spec; the synthesised WebAudio pack in `design/audio.ts` remains the
    shipped fallback either way.

---

## 2. Session primer

Paste this as the **first message in a fresh ChatGPT thread**, before any asset prompt. It sets the
art direction once so later prompts land with less drift. Then paste asset prompts one at a time.

```
I'm going to ask you for a series of images for a dark, premium football-management game. Before
the first one, here is the house style. Apply it to everything I ask for in this conversation
unless a prompt explicitly overrides it.

Art direction: premium broadcast-graphics, dark glassmorphism. Rendered CGI or matte-painting
quality — not photography, not cartoon, not clip art, not outlined vector illustration.

Palette. Ground: near-black graphite #050607 to #08090B. Surface steps: #0E1013, #14171B, #1C2026,
#262B33. Ink #F4F6F8, muted ink #9AA3AD. One accent only, an electric lime #C8FF2E (bright #DCFF6B,
deep #9ECC12), used as a state marker and never covering more than about 3% of the frame. Trophy
gold ramp #7A5716 to #B8862B to #FFD76A to #FFF0C4. Pitch greens are near-black and desaturated,
#0A1410 to #0E1C16, with pitch lines white at about 16% opacity. Semantic colours if asked for:
win #34D399, warn #FBBF24, danger #F4525A, info #7C8CFF, special violet #A78BFA.

Lighting: cool, desaturated, low-key, with deep falloff and film-grade contrast. Blacks retain
detail and are never crushed to flat black.

Three standing rules for every image in this conversation:
1. No text. No letters, words, numbers, digits, captions, labels, signatures, watermarks, logos or
   lettering of any kind appears anywhere in the image, including in small print, on signage, on
   nameplates and in the corners. Nameplates and ruled lines are blank marks, not writing.
2. Exactly one specular sheen per object. Never a second highlight, never a rim light on the
   opposite side.
3. If you cannot match a stated hex exactly, err darker and more desaturated rather than brighter
   and more saturated. I colour-grade afterwards.

The world is entirely fictional. No real football clubs, crests, kits, competitions, stadium
architecture, sponsor boards, broadcast graphics packages or real people, and no near-miss versions
of any of them.

Confirm you have this, then wait for my first image prompt.
```

---

## 3. P0 — launch-blocking

### A1 — App icon master

**Purpose / where.** The mark, everywhere: iOS home screen, App Store Connect marketing icon,
website favicon lineage. A volt football on graphite — four seams radiating from a pentagon, one
soft sheen off the upper-left.
**Canvas to request.** **Square.**
**Final files.** `tools/brand/icon-master.png` (2048², PNG, ≤900 KB) →
`apps/game/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024², PNG, ≤400 KB,
**no alpha, no rounded corners** — iOS masks) and the ASC marketing icon (the same 1024² file).
**Alpha path.** None — this asset is deliberately opaque. The graphite ground is part of the artwork.

```
Generate a square image.

A single football rendered as a flat geometric emblem, centred, filling about 68% of the frame.
The ball is one solid electric-lime disc with a top-left to bottom-right gradient running #E6FF9B
to #C8FF2E to #9ECC12. A soft elliptical specular sheen sits at the upper-left of the disc at
roughly 40% white, rotated about -32 degrees, and it is the only highlight in the image — there is
no second highlight, no rim light and no glow. Cut into the disc in very dark ink #0D1400: one
crisp regular pentagon at the centre, and four thick seam lines radiating from its vertices toward
the ball's edge, stopping short of the rim. The ball is a flat geometric emblem, not a photographic
leather ball: it has no stitching, no panel texture, no gloss and no full hexagon-and-pentagon
pattern. The background is a subtle radial graphite falloff from #12160E at the centre to #08090B
at the corners, flat and clean, filling the frame corner to corner. There is no cast shadow, no
drop shadow, no reflection, no bevel, no badge frame, no border and no rounded-corner mask.

Premium broadcast-graphics art direction, dark glassmorphism, near-black graphite ground, low-key
lighting with deep falloff and film-grade contrast, bold geometric form, rendered CGI quality
rather than photography or illustration.

No text, letters, words, numbers, signature, watermark or lettering of any kind appears anywhere in
the image. The image contains no club crest, no heraldry, no shield and no real people. If you
cannot match a stated hex exactly, err darker and more desaturated rather than brighter.
```

**If it comes back wrong.**
- *"The ball has a full hexagon-pentagon panel pattern — remove it. Only the one central pentagon and the four radiating seams."*
- *"There is a second highlight on the lower right; remove it, only the one upper-left sheen."*

**Acceptance.** ☐ Silhouette still reads as a ball at 40 px and 60 px. ☐ Exactly one sheen.
☐ Zero glyphs anywhere. ☐ Corner pixels are `#08090B` ±2 after ingest. ☐ No alpha channel.

---

### A2 — Splash / launch screen

**Purpose / where.** iOS launch image, on screen for the ~300 ms before the webview paints. It must
be indistinguishable from the app's first frame or the launch flashes.
**Canvas to request.** **Square.**
**Final file.** `apps/game/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png`
(2732², PNG, ≤700 KB) — the same file is copied over all three identical entries in that imageset.
**Alpha path.** None — opaque by design, and the corner colour is a contract.

```
Generate a square image.

A square composition that is almost empty. The background is flat graphite #08090B with an
extremely subtle radial lift toward the centre, no more than three percent brighter, and a
barely-there horizontal band of #0E1013 across the lower third that suggests a dark stadium horizon
without ever resolving into an object. Centred in the frame, occupying about 22% of the width, is
one flat geometric emblem: an electric-lime football disc with a gradient running #E6FF9B to
#C8FF2E to #9ECC12, a single soft upper-left specular sheen, and a dark #0D1400 pentagon plus four
seam lines radiating from its vertices cut into it. A faint volt glow, #C8FF2E at about 8% opacity,
blooms roughly one ball-radius around the emblem and fades to nothing. Everything below the emblem
is clean, empty graphite. The corners of the frame are flat #08090B.

The frame contains nothing else: no particles, no confetti, no stars, no bokeh, no lens flare, no
vignette ring, no border, no frame, no progress bar, no loading spinner, no device bezel and no
interface elements of any kind. The image is dark throughout — there is no bright area, no white
area and no full-frame gradient.

Premium broadcast-graphics art direction, dark glassmorphism, low-key lighting with deep falloff,
film-grade contrast, blacks retain detail and are never crushed, exactly one specular sheen,
rendered CGI quality rather than photography.

No text, letters, words, numbers, tagline, signature, watermark or lettering of any kind appears
anywhere in the image. If you cannot match a stated hex exactly, err darker and more desaturated
rather than brighter.
```

**If it comes back wrong.**
- *"The emblem is too large — reduce it to about 22% of the frame width and keep it exactly centred."*
- *"The background has a visible vignette; make it flat #08090B corner to corner with only a three percent centre lift."*

**Acceptance.** ☐ Corner pixel is exactly `#08090B` after ingest. ☐ Emblem centred within 2 px on
both axes. ☐ Crops safely to 19.5:9 and to 4:3 without touching the emblem. ☐ Zero glyphs anywhere.
☐ ≤700 KB.

---

### A3 — Social share card / OG banner refresh

**Purpose / where.** `og:image` and `twitter:image` on all four website pages. **Optional** — a card
already ships, rasterised from `tools/brand/og.html` (ASSET_PLAN §2 has this ticked DONE). This is a
painted upgrade, and `og.html` stays the fallback master either way.
**Canvas to request.** **Landscape.**
**Final file.** `website/og-image.jpg` (1200×630, JPEG q78, **≤60 KB** — crawlers fetch it cold).
**Alpha path.** None.

```
Generate a landscape image.

A wide cinematic plate of a fictional football stadium at dusk, seen from high in the stands behind
one goal, shot on a 35mm lens. The bowl is a smooth parabolic sweep of dark seating that reads as
geometry rather than as individual seats. Four floodlight masts stand on the far rim; their light
is cool blue-white #D6E8FF at low intensity, throwing soft haze rather than visible beams. The
pitch is a near-black desaturated green, #0A1410 into #0E1C16, with white markings at about 16%
opacity just visible. A thin electric-lime rail, #C8FF2E, runs along the near touchline as the
single accent in the image, occupying under 3% of the frame. The crowd is suggested by tiny cool
bokeh points in #BED2EB and #8FA3BC and never by faces. The upper third of the frame is empty
graphite sky, #050607 fading to #0A1119. The left half of the composition is deliberately quiet and
flat — an empty dark area with no detail, because type will be laid over it later.

Keep all essential structure — the bowl rim and the masts — within the central 80% of the frame
width, so the plate can be cropped to a 1200 by 630 banner without losing them.

The stadium is invented and resembles no real ground. There are no advertising hoardings, no LED
perimeter boards, no sponsor panels, no scoreboard, no club crest and no heraldry anywhere in the
frame. There are no players on the pitch and no visible faces in the crowd. The grass is never
bright saturated green, the sky is never orange or daylight-blue, and there is no fireworks,
confetti, lens flare or bloom haze.

Premium broadcast-graphics art direction, dark glassmorphism, low-key lighting with deep falloff,
film-grade contrast, blacks retain detail, rendered matte-painting quality rather than photography.

No text, letters, words, numbers, digits, signage, signature, watermark or lettering of any kind
appears anywhere in the image, including on the perimeter and in the bokeh. If you cannot match a
stated hex exactly, err darker and more desaturated rather than brighter.
```

**If it comes back wrong.**
- *"There is signage on the perimeter — remove all boards and hoardings, the touchline is bare except for the thin lime rail."*
- *"The left half has too much detail; flatten it to empty dark seating with no readable structure."*

**Post note.** The wordmark and the volt rail are set **in a design tool, never in the generator**
(source pack §7). Ingest applies the left-half `#050607` scrim.

**Acceptance.** ☐ Left 40% of the frame has no detail that would fight overlaid type. ☐ Zero glyphs
anywhere, including in the bokeh. ☐ Stadium is not recognisable as any real ground. ☐ Volt pixels
under 3%. ☐ ≤60 KB.

---

## 4. P1 — high player-visible

All P1 image overrides live under `apps/game/public/art/…` and are served from `/art/…`. Each has a
procedural component behind it (source pack §8.2) that stays mounted and stays correct.

### B1 — Title hero scene raster

**Purpose / where.** Optional painted upgrade over `HeroScene variant="title"` on TitleScreen and
onboarding. The procedural version is the fallback and stays shipped.
**Canvas to request.** **Portrait.** The final crop is much taller than a portrait canvas, so the
prompt keeps everything essential inside the central 70% of the width and ingest centre-crops.
**Final file.** `apps/game/public/art/heroes/title-stadium.webp` — WebP, 1179×2556, **≤300 KB**.
**Alpha path.** None.

```
Generate a portrait image.

A tall vertical cinematic plate of a fictional football stadium at dusk, viewed from a high seat
behind the goal, 35mm lens, deep depth of field. The far stand is a smooth parabolic bowl whose rim
sits about 42% down the frame at centre and rises toward both edges; the seating reads as banded
geometry, not as individual seats. Four slim floodlight masts crown the far rim, each casting a
cold blue-white #D6E8FF glow at low intensity with soft atmospheric haze and no visible beams.
Below the stands the pitch recedes as near-black desaturated green, #0A1410 into #0E1C16, with
white line markings at about 16% opacity, barely readable. The sky above is a four-stop graphite
ramp: #050607 at the top, through #080D14 and #0A1119, back to #050607 at the horizon. The crowd is
scattered cool bokeh points in #BED2EB and #8FA3BC, with a very small number of #C8FF2E points as
the only accent in the image, under 3% of the frame. The bottom third of the frame is quiet, dark
and almost featureless. The mood is cold, expensive and empty — before anything has happened.

Compose so that all essential structure — the bowl rim, the four masts — sits within the central
70% of the frame width and within the full height, because this plate is cropped to a very tall
phone-screen shape afterwards.

The stadium is invented and resembles no real ground. There are no advertising hoardings, no LED
perimeter boards, no sponsor panels, no scoreboard, no crest and no heraldry. There are no players
on the pitch and no visible faces in the crowd. The grass is never bright saturated green; the sky
is never daylight or sunset orange. There is no fireworks, pyrotechnics, confetti, lens flare,
visible light beam or bloom haze, and no border, frame or vignette ring. No object carries more
than one specular sheen.

Premium broadcast-graphics art direction, dark glassmorphism, low-key lighting with deep falloff,
film-grade contrast, blacks retain detail and are never crushed, rendered matte-painting quality
rather than photography.

No text, letters, words, numbers, digits, signage, signature, watermark or lettering of any kind
appears anywhere in the image. If you cannot match a stated hex exactly, err darker and more
desaturated rather than brighter.
```

**If it comes back wrong.**
- *"The bowl rim is too low — raise it to about 42% down the frame at centre, rising toward both edges."*
- *"The floodlights are throwing visible beams; make them soft haze only, with no shafts of light."*

**Post note.** Ingest bakes the `#050607` bottom scrim (0% at 45% height → 62% at the bottom) and
verifies the top 12% is dark enough for a status bar.

**Acceptance.** ☐ Readable as "stadium at dusk" at 20% zoom. ☐ Zero glyphs anywhere.
☐ Volt pixels under 3%. ☐ Bottom 25% has enough contrast headroom for `#9AA3AD` text on glass.
☐ ≤300 KB.

---

### B2 — Triumph result backdrop

**Purpose / where.** Optional upgrade over `HeroScene variant="triumph"` behind MatchResultScreen
and the season summary after a win. Same ground as B1, warmer light, diffuse rays.
**Canvas to request.** **Portrait.**
**Final file.** `apps/game/public/art/heroes/result-triumph.webp` — WebP, 1179×2556, ≤300 KB.
**Alpha path.** None.
**Thread tip.** Generate B1, B2 and B3 in one thread, in that order — it is the cheapest way to get
the same bowl geometry and mast positions across all three, which is B2's and B3's first acceptance
check.

```
Generate a portrait image.

The same fictional football stadium at dusk seen from a high seat behind the goal, 35mm lens, but
now warm and one stop brighter — never bright. The far stand is a smooth parabolic bowl with its
rim about 42% down the frame at centre, rising toward the edges; the seating reads as banded
geometry, not as individual seats. Four floodlight masts on the far rim throw a warm gold #FFD76A
glow at low intensity through soft haze. Broad, soft upward light rays fan from behind the far
stand into the graphite sky — low contrast, diffuse, with no hard edge on any ray. The sky is a
four-stop ramp: #07070A, #141007, #1A1309, #07060A. The pitch below is faintly gold-touched over
near-black desaturated green #0A1410 to #0E1C16, with white markings at about 16% opacity. The
crowd bokeh is warm: #FFD76A and #FFF0C4 points with a light scattering of #C8FF2E, the accent
staying under 3% of the frame. The mood is elated but restrained — the gold does the work a confetti
cannon would.

Compose so that all essential structure — the bowl rim, the four masts — sits within the central
70% of the frame width, because this plate is cropped to a very tall phone-screen shape afterwards.

The gold is a cool-leaning trophy gold, #FFD76A, and never amber or orange. The stadium is invented
and resembles no real ground. There are no advertising hoardings, no LED boards, no sponsor panels,
no scoreboard, no crest and no heraldry. There are no players, no faces and no trophy in the frame.
There is no confetti, streamer, ticker tape, firework or pyrotechnic anywhere, no hard-edged god
ray, no lens flare and no bloom haze, and no border, frame or vignette ring.

Premium broadcast-graphics art direction, dark glassmorphism, low-key lighting with deep falloff,
film-grade contrast, blacks retain detail, rendered matte-painting quality rather than photography.

No text, letters, words, numbers, digits, signage, signature, watermark or lettering of any kind
appears anywhere in the image. If you cannot match a stated hex exactly, err darker and more
desaturated rather than brighter.
```

**If it comes back wrong.**
- *"Keep the exact bowl shape and mast positions from the previous image — only the light temperature changes."*
- *"The rays have hard edges and the gold has gone orange; make the rays broad and diffuse, and pull the gold back toward #FFD76A."*

**Acceptance.** ☐ Recognisably the *same ground* as B1 (bowl shape and mast positions match).
☐ Rays are diffuse, no hard-edged shafts. ☐ Volt under 3%. ☐ No confetti or pyro. ☐ Zero glyphs
anywhere. ☐ ≤300 KB.

---

### B3 — Consolation result backdrop

**Purpose / where.** Optional upgrade over `HeroScene variant="consolation"` after a defeat. Muted,
not sad — the screen still has to be readable by somebody who is annoyed.
**Canvas to request.** **Portrait.**
**Final file.** `apps/game/public/art/heroes/result-consolation.webp` — WebP, 1179×2556, ≤300 KB.
**Alpha path.** None.

```
Generate a portrait image.

The same fictional football stadium at dusk from the same high seat behind the goal, 35mm lens, now
cooler, dimmer and emptied out. The parabolic far stand sits with its rim about 42% down the frame
at centre, rising toward the edges; the seating reads as banded geometry. Four floodlight masts
throw a cold, weak #9EB2C8 light at very low intensity. Fine rain falls through the light as soft
grey streaks, suggested rather than drawn, catching only faintly near the masts. The sky is a
four-stop ramp: #04060A, #080C12, #0A1016, #04060A. The pitch is near-black desaturated green
#0A1410 to #0E1C16 with a wet sheen and white markings at about 16% opacity. The crowd bokeh has
lost its warmth entirely — #7E8DA0, #5C6675 and #93A3B8 points, thinner and more scattered than a
full house. A single very faint indigo #7C8CFF rim line along the near touchline is the only accent
in the image, under 2% of the frame. Quiet, cold, over.

Compose so that all essential structure — the bowl rim, the four masts — sits within the central
70% of the frame width, because this plate is cropped to a very tall phone-screen shape afterwards.

There is no electric lime or green accent anywhere in this image; the only accent is the indigo rim
line. The rain is a texture, never the subject: there is no heavy storm, no lightning, no puddle
reflecting a skyline and no motion blur across the frame. The stadium is invented and resembles no
real ground. There are no hoardings, LED boards, sponsor panels, scoreboards, crests or heraldry,
no players, no dejected figures and no visible faces, and no border, frame or vignette ring.

Premium broadcast-graphics art direction, dark glassmorphism, low-key lighting with deep falloff,
film-grade contrast, blacks retain detail, rendered matte-painting quality rather than photography.

No text, letters, words, numbers, digits, signage, signature, watermark or lettering of any kind
appears anywhere in the image. If you cannot match a stated hex exactly, err darker and more
desaturated rather than brighter.
```

**If it comes back wrong.**
- *"The rain has become the subject — dial it back to faint streaks visible only near the masts."*
- *"There is a lime accent on the touchline; remove it entirely. The only accent in this image is the faint indigo #7C8CFF rim line."*

**Post note.** Ingest uses a **lighter** bottom scrim here (0% at 45% height → 50% at the bottom);
this plate is already dark and over-scrimming turns it to mud.

**Acceptance.** ☐ Same ground geometry as B1/B2. ☐ Rain is visible but never the subject. ☐ No volt
anywhere; the only accent is indigo. ☐ `#F4F6F8` text on glass still passes 7:1 over the brightest
region. ☐ Zero glyphs anywhere. ☐ ≤300 KB.

---

### B4 — Trophy hero renders ×5

Optional painted upgrades over the five hand-authored SVGs in `design/domain/silverware.tsx`, used
at hero scale only (TrophyMoment, the trophy room). The SVGs stay the source of truth for lists and
anything under 34 px — a render must **agree with the silhouette**, not reinterpret it.

**Run all five in one thread.** Paste the set primer below first, then B4a…B4e in order.

**Attach the reference.** For each variant, attach a PNG of that trophy's SVG alongside the prompt.
Export it from the design gallery at **`/dev/gallery`, Silverware section** — all five are rendered
there at 72 px with hero staging; screenshot at high browser zoom on a dark background, or lift the
SVG directly out of `apps/game/src/design/domain/silverware.tsx` and rasterise it. Attaching the
reference is what turns the ~4% silhouette-agreement check from a hope into a target.

**B4 set primer** — paste once, before B4a:

```
I'm going to ask you for five gold trophies, one at a time, as a matched set. They must look like
five pieces from one cabinet, so keep the following identical across all five and carry it from
each image to the next:

- One cool key light from the upper left, one soft fill, and exactly one specular sheen per piece
  running down its upper-left flank. Never a second highlight, never a rim light on the right.
- The same spun-gold material with a six-stop ramp: #7A5716 in the shadow, #B8862B on the turn,
  #FFD76A on the lit face, #FFF0C4 at the hot core, #D8A441 cooling, #8A6320 at the far edge. The
  metal is gold only — no silver, chrome, brass, copper, rose gold, tarnish or plastic anywhere.
- The same two-tier dark graphite plinth, #14171B over #0E1013, occupying the bottom quarter of the
  frame, with a recessed near-black engraving band across its front carrying two blank ruled lines
  and one tiny electric-lime #C8FF2E tick at the right end.
- The same weight and the same finish: heavy, machined, restrained. Product-render lighting, no
  environment, no floor, no cast shadow, no reflection.
- Vertical composition, the piece centred and filling about 80% of the frame height above the
  plinth.

For each one I will attach a reference image of the exact silhouette I need. Match that silhouette
exactly and repaint it as a rendered gold object — do not redesign it, do not add ornament it does
not have, do not change its proportions.

Absolute rules for all five: no text, letters, words, numbers, dates, engraved names, signature,
watermark or lettering of any kind anywhere, including on the nameplate and the engraving band —
those are blank ruled marks, not writing. No club crest, heraldry, lion, eagle, crown, laurel,
wreath, ribbon, gemstone, figurine or human hand. Never a second trophy in frame. If you cannot
match a stated hex exactly, err darker and more desaturated rather than brighter.

Confirm, then wait for the first trophy.
```

---

#### B4a — League chalice

**Purpose / where.** Optional painted upgrade over the `league` SVG in `design/domain/silverware.tsx`,
at hero scale only. The SVG stays the source of truth for lists and anything under 34 px.
**Canvas to request.** **Portrait.** (Attach the `league` SVG reference with the prompt.)
**Final file.** `apps/game/public/art/trophies/league.webp` — WebP with alpha, 600×792 (the 100:132
box at 6×), **≤120 KB**.
**Alpha path.** **Path A then B.** Ask for a transparent PNG; if what comes back is opaque, use the
flat `#050607` backdrop the prompt also specifies and let ingest key it. Gold on flat `#050607` keys
cleanly; gold on a soft gradient does not.

```
Generate a portrait image. Match the attached reference silhouette exactly and repaint it as a
rendered gold object.

A single fictional gold trophy, centred, lit from the upper left by one cool key light with one
soft fill. The trophy is a tall fluted chalice: a wide flared bowl tapering to a rounded base,
three shallow vertical flutes running down its face, a bright horizontal rim band across the top
that is the brightest element on the piece, and two long swept handles that arc outward from just
below the rim and curl back in at the bowl's waist. Below the bowl, a short stem, a flattened
spherical knop, and a tapered foot onto the plinth. The metal is a spun gold with a six-stop ramp:
#7A5716 in the shadow, #B8862B on the turn, #FFD76A on the lit face, #FFF0C4 at the hot core,
#D8A441 cooling, #8A6320 at the far edge. The metal is gold only — no silver, chrome, brass, copper,
rose gold, tarnish, marble or plastic appears anywhere on the piece. Exactly one specular sheen runs
down the upper-left flank; there is no second highlight and no rim light anywhere. The trophy stands
on a two-tier dark graphite plinth, #14171B over #0E1013, with a recessed near-black engraving band
across its front carrying two blank ruled lines and one tiny electric-lime #C8FF2E tick at the right
end — that tick is the only non-gold colour in the image and covers under 1% of the frame. Vertical
composition, the piece filling about 80% of the frame height above the plinth.

Output the trophy isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette, no cast shadow, no contact shadow and no reflection —
nothing but the piece and that flat colour, and nothing touching the frame edge.

This is an invented trophy and resembles no real cup. There is no club crest, heraldry, lion, eagle,
crown, laurel, wreath, ribbon, gemstone, figurine, human hand or second trophy in the frame. There
is no environment, table, room, floor, mirror reflection, sparkle, glitter or confetti.

Premium broadcast-graphics art direction, product-render lighting, film-grade contrast, rendered
CGI quality rather than photography.

No text, letters, words, numbers, dates, engraved names, signature, watermark or lettering of any
kind appears anywhere in the image — the ruled lines on the engraving band are blank marks, not
writing. If you cannot match a stated hex exactly, err darker and more desaturated rather than
brighter.
```

**If it comes back wrong.**
- *"The handles are wrong — match the attached silhouette exactly: they arc out from just below the rim and curl back in at the bowl's waist."*
- *"There is a second highlight on the right flank; remove it, only one specular sheen down the upper-left."*

**Post note.** Ingest keys the backdrop, mattes the gold edges (sloppy mattes fringe green), scales
so the plinth base sits on the bottom edge of the 600×792 box, and centres horizontally.
**Overlay the `league` SVG at 30% opacity and confirm the silhouettes align within ~4% before
accepting.**

**Acceptance.** ☐ Silhouette matches the `league` SVG within ~4%. ☐ Exactly one sheen. ☐ Volt appears
once, as a tick on the engraving band, under 1% of pixels. ☐ Zero glyphs anywhere. ☐ Alpha is clean
at 100% zoom, no green fringe. ☐ ≤120 KB.

---

#### B4b — Cup

**Purpose / where.** Optional painted upgrade over the `cup` SVG in `design/domain/silverware.tsx`,
at hero scale only. The SVG stays the source of truth for lists and anything under 34 px.
**Canvas to request.** **Portrait.** (Attach the `cup` SVG reference with the prompt.)
**Final file.** `apps/game/public/art/trophies/cup.webp` — WebP with alpha, 600×792, **≤120 KB**.
**Alpha path.** **Path A then B**, flat `#050607` backdrop as the fallback.

```
Generate a portrait image. Match the attached reference silhouette exactly and repaint it as a
rendered gold object.

A single fictional gold trophy, centred, lit from the upper left by one cool key light with one
soft fill. The trophy is squat, wide and lidded: a shallow broad bowl, a domed lid above a bright
horizontal collar, and a small spherical finial on a short post at the very top. Two closed
vertical ring handles sit on either side, taller than they are wide, passing behind the bowl's
edge. A recessed dark rectangular panel crosses the bowl's face carrying one blank ruled line, and
a faint eight-point star is embossed low on the bowl. Short stem, tapered foot onto the plinth. The
metal is a spun gold with a six-stop ramp: #7A5716 in the shadow, #B8862B on the turn, #FFD76A on
the lit face, #FFF0C4 at the hot core, #D8A441 cooling, #8A6320 at the far edge. The metal is gold
only — no silver, chrome, brass, copper, rose gold, tarnish, marble or plastic appears anywhere on
the piece. Exactly one specular sheen runs down the upper-left flank; there is no second highlight
and no rim light anywhere. The trophy stands on a two-tier dark graphite plinth, #14171B over
#0E1013, with a recessed near-black engraving band across its front carrying two blank ruled lines
and one tiny electric-lime #C8FF2E tick at the right end — that tick is the only non-gold colour in
the image and covers under 1% of the frame. Vertical composition, the piece filling about 80% of
the frame height above the plinth.

Output the trophy isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette, no cast shadow, no contact shadow and no reflection —
nothing but the piece and that flat colour, and nothing touching the frame edge.

This is an invented trophy and resembles no real cup. There is no club crest, heraldry, lion, eagle,
crown, laurel, wreath, ribbon, gemstone, figurine, human hand or second trophy in the frame. There
is no environment, table, room, floor, mirror reflection, sparkle, glitter or confetti.

Premium broadcast-graphics art direction, product-render lighting, film-grade contrast, rendered
CGI quality rather than photography.

No text, letters, words, numbers, dates, engraved names, signature, watermark or lettering of any
kind appears anywhere in the image — the panel's ruled line and the engraving band's ruled lines are
blank marks, not writing. If you cannot match a stated hex exactly, err darker and more desaturated
rather than brighter.
```

**If it comes back wrong.**
- *"The handles have opened into swept arms — close them back into vertical rings, taller than they are wide, passing behind the bowl's edge."*
- *"Something is written on the panel; the panel is blank with one ruled line and no lettering."*

**Post note.** As B4a. **Overlay the `cup` SVG at 30% opacity and confirm ~4% agreement.**

**Acceptance.** ☐ Silhouette matches the `cup` SVG within ~4%. ☐ Exactly one sheen. ☐ Volt appears
once, as a tick on the engraving band, under 1% of pixels. ☐ Zero glyphs anywhere (the embossed star
is a shape, not a mark). ☐ Alpha is clean at 100% zoom, no green fringe. ☐ ≤120 KB.

---

#### B4c — Super cup salver

**Purpose / where.** Optional painted upgrade over the `superCup` SVG in
`design/domain/silverware.tsx`, at hero scale only.
**Canvas to request.** **Portrait.** (Attach the `superCup` SVG reference with the prompt.)
**Final file.** `apps/game/public/art/trophies/super-cup.webp` — WebP with alpha, 600×792,
**≤120 KB**. Note the kebab-case filename; `superCup.webp` is not an override.
**Alpha path.** **Path A then B**, flat `#050607` backdrop as the fallback.

```
Generate a portrait image. Match the attached reference silhouette exactly and repaint it as a
rendered gold object.

A single fictional gold award, centred, lit from the upper left by one cool key light with one soft
fill. The piece is not a cup at all: a broad shield-shaped salver on a low stand. The shield is
wide at the shoulders, straight-sided, and sweeps to a rounded point at the bottom. Its face is
recessed dark, and a geometric radial star with eight straight bars sits at its centre, with a small
dark circle at the hub and a tiny electric-lime dot at the very middle. A blank recessed nameplate
crosses the shield low down. The shield sits on a short square post and a tapered foot onto the
plinth. The metal is a spun gold with a six-stop ramp: #7A5716 in the shadow, #B8862B on the turn,
#FFD76A on the lit face, #FFF0C4 at the hot core, #D8A441 cooling, #8A6320 at the far edge. The
metal is gold only — no silver, chrome, brass, copper, rose gold, tarnish, marble or plastic appears
anywhere on the piece. Exactly one specular sheen runs down the upper-left flank; there is no second
highlight and no rim light anywhere. The salver stands on a two-tier dark graphite plinth, #14171B
over #0E1013, with a recessed near-black engraving band across its front carrying two blank ruled
lines and one tiny electric-lime #C8FF2E tick at the right end. The volt dot at the star's hub and
that tick are the only non-gold colour in the image and together cover under 1% of the frame.
Vertical composition, the piece filling about 80% of the frame height above the plinth.

Output the award isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette, no cast shadow, no contact shadow and no reflection —
nothing but the piece and that flat colour, and nothing touching the frame edge.

The shield is a plain geometric plate and never reads as heraldry: it carries no charge, no device,
no quartering, no lion, eagle, crown, laurel or wreath, and no club crest. This is an invented award
and resembles no real trophy. There is no ribbon, gemstone, figurine, human hand or second trophy in
frame, and no environment, table, room, floor, mirror reflection, sparkle or glitter.

Premium broadcast-graphics art direction, product-render lighting, film-grade contrast, rendered
CGI quality rather than photography.

No text, letters, words, numbers, dates, engraved names, signature, watermark or lettering of any
kind appears anywhere in the image — the nameplate is blank and the engraving band's ruled lines are
blank marks, not writing. If you cannot match a stated hex exactly, err darker and more desaturated
rather than brighter.
```

**If it comes back wrong.**
- *"The shield has become heraldic — strip it back to a plain geometric plate with only the eight-bar radial star and the blank nameplate."*
- *"The volt is too large — reduce it to a single tiny dot at the star's hub, plus the one tick on the engraving band."*

**Post note.** As B4a. **Overlay the `superCup` SVG at 30% opacity and confirm ~4% agreement.**

**Acceptance.** ☐ Silhouette matches the `superCup` SVG within ~4%. ☐ Exactly one sheen. ☐ Volt
appears only at the star's hub and as the engraving tick, under 1% of pixels. ☐ Zero glyphs anywhere
— the nameplate is blank. ☐ The shield never reads as heraldry. ☐ Alpha is clean at 100% zoom, no
green fringe. ☐ ≤120 KB.

---

#### B4d — Golden boot

**Purpose / where.** Optional painted upgrade over the `boot` SVG in `design/domain/silverware.tsx`,
at hero scale only.
**Canvas to request.** **Portrait.** (Attach the `boot` SVG reference with the prompt — the tilt
angle is the thing that drifts, and the reference is what pins it.)
**Final file.** `apps/game/public/art/trophies/boot.webp` — WebP with alpha, 600×792, **≤120 KB**.
**Alpha path.** **Path A then B**, flat `#050607` backdrop as the fallback.

```
Generate a portrait image. Match the attached reference silhouette exactly, tilt angle included,
and repaint it as a rendered gold object.

A single fictional gold award, centred, lit from the upper left by one cool key light with one soft
fill. The award is a gold football boot mounted at a fourteen-degree tilt on a slim vertical post.
The boot is stylised and geometric — a smooth sole plate, a clean low-cut upper, four straight lace
bars across the instep, and four rounded studs under the sole. It is a shape, not a product: no
manufacturer marking, no side stripe, no swoosh, no panel stitching, no leather grain, no bow-tied
laces, no sock and no foot inside it. The post runs from the boot's heel down to a tapered foot on
the plinth. The metal is a spun gold with a six-stop ramp: #7A5716 in the shadow, #B8862B on the
turn, #FFD76A on the lit face, #FFF0C4 at the hot core, #D8A441 cooling, #8A6320 at the far edge.
The metal is gold only — no silver, chrome, brass, copper, rose gold, tarnish or plastic appears
anywhere on the piece. Exactly one specular sheen runs down the upper-left flank; there is no second
highlight and no rim light anywhere. The post stands on a two-tier dark graphite plinth, #14171B
over #0E1013, with a recessed near-black engraving band across its front carrying two blank ruled
lines and one tiny electric-lime #C8FF2E tick at the right end — that tick is the only non-gold
colour in the image and covers under 1% of the frame. Vertical composition, the piece filling about
80% of the frame height above the plinth.

Output the award isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette, no cast shadow, no contact shadow and no reflection —
nothing but the piece and that flat colour, and nothing touching the frame edge.

This is an invented award and resembles no real boot and no real trophy. There is no club crest,
heraldry, ribbon, gemstone, figurine, human hand or second trophy in frame, and no environment,
table, room, floor, mirror reflection, sparkle or glitter.

Premium broadcast-graphics art direction, product-render lighting, film-grade contrast, rendered
CGI quality rather than photography.

No text, letters, words, numbers, dates, engraved names, signature, watermark or lettering of any
kind appears anywhere in the image — the engraving band's ruled lines are blank marks, not writing.
If you cannot match a stated hex exactly, err darker and more desaturated rather than brighter.
```

**If it comes back wrong.**
- *"The tilt is wrong — match the attached reference exactly: about fourteen degrees, heel low, toe raised."*
- *"There is a stripe on the boot's flank; the boot is completely unbranded — plain gold, four lace bars, four studs, nothing else."*

**Post note.** As B4a. **Overlay the `boot` SVG at 30% opacity and confirm ~4% agreement, tilt
included.**

**Acceptance.** ☐ Silhouette matches the `boot` SVG within ~4%, tilt included. ☐ Exactly one sheen.
☐ Volt appears once, as a tick on the engraving band, under 1% of pixels. ☐ Zero glyphs anywhere and
no manufacturer marking of any kind. ☐ Alpha is clean at 100% zoom, no green fringe. ☐ ≤120 KB.

---

#### B4e — Legacy monolith

**Purpose / where.** Optional painted upgrade over the `legacy` SVG in
`design/domain/silverware.tsx`, at hero scale only.
**Canvas to request.** **Portrait.** (Attach the `legacy` SVG reference — the taper is what drifts.)
**Final file.** `apps/game/public/art/trophies/legacy.webp` — WebP with alpha, 600×792, **≤120 KB**.
**Alpha path.** **Path A then B**, flat `#050607` backdrop as the fallback.

```
Generate a portrait image. Match the attached reference silhouette exactly, taper included, and
repaint it as a rendered gold object.

A single fictional gold trophy, centred, lit from the upper left by one cool key light with one soft
fill. The trophy is a tapered monolith: a four-sided column, wider at the base than at the top, with
a faceted pyramidal cap. A recessed near-black panel runs most of the column's height, and exactly
three five-pointed gold stars are stacked evenly up it, equal in size — three, never two and never
four. A bright horizontal collar crosses just above the plinth. Severe, counted, dynastic. The metal
is a spun gold with a six-stop ramp: #7A5716 in the shadow, #B8862B on the turn, #FFD76A on the lit
face, #FFF0C4 at the hot core, #D8A441 cooling, #8A6320 at the far edge. The metal is gold only —
no silver, chrome, brass, copper, rose gold, tarnish, marble or plastic appears anywhere on the
piece. Exactly one specular sheen runs down the upper-left flank; there is no second highlight and
no rim light anywhere. The column stands on a two-tier dark graphite plinth, #14171B over #0E1013,
with a recessed near-black engraving band across its front carrying two blank ruled lines and one
tiny electric-lime #C8FF2E tick at the right end — that tick is the only non-gold colour in the
image and covers under 1% of the frame. Vertical composition, the piece filling about 80% of the
frame height above the plinth.

Output the trophy isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette, no cast shadow, no contact shadow and no reflection —
nothing but the piece and that flat colour, and nothing touching the frame edge.

The column is a plain machined monolith: it carries no inscription, no hieroglyph, no monument
carving, no relief figure and no club crest or heraldry. This is an invented trophy and resembles
no real award. There is no ribbon, gemstone, figurine, human hand or second trophy in frame, and no
environment, table, room, floor, mirror reflection, sparkle or glitter.

Premium broadcast-graphics art direction, product-render lighting, film-grade contrast, rendered
CGI quality rather than photography.

No text, letters, words, numbers, dates, engraved names, signature, watermark or lettering of any
kind appears anywhere in the image — the engraving band's ruled lines are blank marks, not writing.
If you cannot match a stated hex exactly, err darker and more desaturated rather than brighter.
```

**If it comes back wrong.**
- *"There are four stars — there must be exactly three, equal in size and evenly stacked."*
- *"The column has lost its taper; make it clearly wider at the base than at the top, matching the attached reference."*

**Post note.** As B4a. **Overlay the `legacy` SVG at 30% opacity and confirm ~4% agreement.**

**Acceptance.** ☐ Silhouette matches the `legacy` SVG within ~4%. ☐ Exactly three stars, equal in
size and evenly stacked. ☐ Exactly one sheen. ☐ Volt appears once, as a tick on the engraving band,
under 1% of pixels. ☐ Zero glyphs anywhere. ☐ Alpha is clean at 100% zoom, no green fringe.
☐ ≤120 KB.

---

### B5 — Legendary foil tile

**Not generated with ChatGPT.** It is a seamless tileable texture. See §6.

---

### B6 — Club-reveal celebration kit

`HeroReveal` at the end of club creation — the payoff for the customiser, and the one P1 item
`ASSET_PLAN` §6 still lists as genuinely absent. The kit is **two plates plus one SFX**: B6a and B6b
below, plus **D6 Signing sting**, which the reveal reuses unchanged and which is out of scope here
(source pack §6). The crest itself is always the procedural `ClubBadge` composited on top at
runtime, never generated. Both plates are composited with `screen`, so they are authored bright.

---

#### B6a — Reveal burst plate

**Purpose / where.** The radial ray plate behind the crest in `HeroReveal`, scaled and rotated at
runtime. Optional: without it the reveal falls back to the existing rays + crossfade. The procedural
`ClubBadge` lands in the centre, so the middle of the frame must be completely empty.
**Canvas to request.** **Square.**
**Final file.** `apps/game/public/art/heroes/reveal-burst.webp` — WebP with alpha, 1024×1024,
**≤90 KB**.
**Alpha path.** **Path A then B.** Path B here is the better bet: this plate composites with
`screen`, where a pure `#050607` ground is already almost a no-op, so ingest can derive alpha from
luminance and get a soft, halo-free edge on every ray.

```
Generate a square image.

A radial light burst, centred, with a completely empty hole in the middle about 34% of the frame's
width where nothing at all is drawn. From the edge of that hole, twelve soft tapered rays of light
fan outward toward the frame edges, alternating long and short, each fading away to nothing before
it arrives. The rays are cool white #F4F6F8 at their base falling to #9AA3AD, with three of the
twelve tinted electric lime #C8FF2E at low opacity as the only accent, under 3% of the frame. A
faint circular haze ring surrounds the hole. Everything is soft-edged, diffuse and low contrast; no
ray has a hard boundary anywhere along its length.

Output the burst isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background — a solid dark field with no gradient, no vignette and no glow other than the rays
themselves — and keep the central hole that same flat #050607 with nothing drawn in it.

The frame contains only the rays and the haze ring. There is no crest, badge, shield, emblem,
heraldry or logo, no sun, sky, cloud or environment, no fireworks, sparks, confetti, streamers,
glitter, star shapes or cross flares, no lens flare, anamorphic streak or chromatic aberration, no
rainbow or saturated colour, and no border, frame or vignette.

Premium broadcast-graphics art direction, dark glassmorphism palette, film-grade contrast, blacks
retain detail, rendered CGI quality rather than photography.

No text, letters, words, numbers, signature, watermark or lettering of any kind appears anywhere in
the image. If you cannot match a stated hex exactly, err darker and more desaturated rather than
brighter.
```

**If it comes back wrong.**
- *"The centre is not empty — clear a perfectly circular hole about 34% of the frame width with absolutely nothing drawn inside it."*
- *"The rays have hard edges and look like star flares; make them soft, tapered and diffuse, fading out before they reach the frame edge."*

**Post note.** Confirm the central hole is fully transparent after ingest — the crest lands there.
Premultiply nothing; the runtime composites with `screen`.

**Acceptance.** ☐ Burst centre is 100% transparent across a 340 px-wide circle. ☐ No ray has a hard
edge at 200% zoom. ☐ Volt under 3%. ☐ Survives arbitrary rotation without revealing a seam or a
corner. ☐ Zero glyphs anywhere. ☐ Absent, the reveal still plays as rays + crossfade. ☐ ≤90 KB.

---

#### B6b — Reveal motes plate

**Purpose / where.** The drifting light-mote layer in `HeroReveal`, one layer, parallaxed over the
burst. Optional; composited with `screen` at low opacity, so it is authored bright.
**Canvas to request.** **Square.**
**Final file.** `apps/game/public/art/heroes/reveal-motes.webp` — WebP with alpha, 1024×1024,
**≤60 KB**.
**Alpha path.** **Path A then B**, flat `#050607` ground as the fallback, keyed by luminance.

```
Generate a square image.

A scatter of soft out-of-focus light motes, evenly distributed across the whole frame with no
cluster, no centre and no focal point. About forty circular bokeh points at varying sizes from tiny
to medium, all very soft-edged, in cool white #F4F6F8 and muted #9AA3AD at low opacity, with four
or five motes tinted electric lime #C8FF2E as the only accent, under 3% of the frame. No mote is
fully opaque. Every mote is a circle: there are no streaks, no trails, no star shapes, no cross
flares and no shapes of any other kind.

Output the motes isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place them instead on a completely flat, evenly lit, pure #050607
background — a solid dark field with no gradient, no vignette and no glow other than the motes
themselves.

The frame contains only the motes. There is no crest, badge, shield, emblem, heraldry or logo, no
sun, sky, cloud or environment, no fireworks, sparks, confetti, streamers or glitter, no lens flare
or chromatic aberration, no rainbow or saturated colour, and no border, frame or vignette.

Premium broadcast-graphics art direction, dark glassmorphism palette, film-grade contrast, blacks
retain detail, rendered CGI quality rather than photography.

No text, letters, words, numbers, signature, watermark or lettering of any kind appears anywhere in
the image. If you cannot match a stated hex exactly, err darker and more desaturated rather than
brighter.
```

**If it comes back wrong.**
- *"The motes have clustered in the centre — redistribute them evenly across the whole frame with no centre and no empty corners."*
- *"Some motes are solid white discs; soften every one of them and keep them all below full opacity."*

**Post note.** Check the distribution by tiling the plate against itself: no cluster may read as a
shape. Premultiply nothing.

**Acceptance.** ☐ Motes evenly distributed, no cluster, no centre. ☐ No mote is fully opaque.
☐ Volt under 3%. ☐ Survives rotation and parallax without revealing a seam or a corner. ☐ Zero
glyphs anywhere. ☐ Absent, the reveal still plays as rays + crossfade. ☐ ≤60 KB.

---

### B7 — Editorial news illustration plates ×5

Optional painted upgrades over the five inline motifs in `StoryArt` (`design/domain/feed.tsx`):
transfer, injury, rivalry, fans, result. They sit on a 200×100 plate behind the seeded colour bands
at the head of a lead feed story and are seen at roughly **28 px tall** in a list, so each must read
as one shape at thumbnail size. The story's seeded accent colour is applied at runtime, so exactly
one element per plate is generated in a neutral light tone the app can tint.

**Run all five in one thread.** Paste the set primer below first, then B7a…B7e in order. Stroke
weight consistency across the five is the acceptance check that a fresh thread per plate will fail.

**B7 set primer** — paste once, before B7a:

```
I'm going to ask you for five editorial pictograms, one at a time, as a matched set for a news feed
in a football-management app. They are seen at about 28 pixels tall, so each must read as a single
clear shape at thumbnail size. They must look like five drawings by one hand, so keep the following
identical across all five and carry it from each image to the next:

- Clean geometric line work of uniform weight — strokes about 2 units on a 100-unit grid — with
  round caps and round joins. No fill, no shading, no gradient, no perspective, no depth, no 3D.
- Lines are ink #F4F6F8 at high opacity for the structure and muted #9AA3AD at low opacity for
  secondary detail. In each drawing exactly one element is picked out in a slightly heavier stroke
  in pale neutral #E8ECEF — that element gets recoloured by the app later, so there must be exactly
  one of them per drawing and it must be the same relative weight in all five.
- Deliberately low node count: each whole drawing is under a dozen strokes.
- Each drawing is centred and occupies about 70% of a wide landscape frame, with the essential
  shape inside the central two-thirds of the frame height so it survives a crop to a 2:1 banner.
- Same optical weight: none of the five should look heavier or busier than the others.

Absolute rules for all five: no text, letters, words, numbers, digits, scorelines, signature,
watermark or lettering of any kind anywhere — ruled lines are blank marks, not writing. No club
crest, heraldry, lion, eagle or crown. No people, faces, hands or bodies. No colour beyond the
neutrals named above, no saturated colour, no drop shadow, no circular badge behind the icon, no
sketchy or variable-weight line, no background pattern, no border and no frame. If you cannot match
a stated hex exactly, err darker and more desaturated rather than brighter.

Confirm, then wait for the first pictogram.
```

---

#### B7a — Transfer plate

**Purpose / where.** Optional painted upgrade over the `transfer` motif in `StoryArt`.
**Canvas to request.** **Landscape.** Target is 2:1, taller than a landscape canvas is wide, so the
prompt keeps the shape inside the central two-thirds of the height and ingest centre-crops.
**Final file.** `apps/game/public/art/stories/transfer.webp` — WebP with alpha, 800×400 (the 200×100
plate at 4×), **≤40 KB**.
**Alpha path.** **Path A then B.** Path B — flat `#050607`, keyed by luminance — is the reliable one
for light line work on dark ground.

```
Generate a landscape image.

A single editorial pictogram, centred, occupying about 70% of a wide landscape frame, with the whole
shape inside the central two-thirds of the frame height so it survives a crop to a 2:1 banner. The
drawing is a contract sheet with a folded top-right corner, three short ruled lines across its body,
and a fountain pen crossing it diagonally from the upper right. The heavier neutral stroke is the
looping signature scrawl across the lower part of the sheet — a loop, not writing.

Drawn as clean geometric line work of uniform weight — strokes about 2 units on a 100-unit grid —
with round caps and round joins, no fill, no shading, no gradient, no perspective and no depth.
Lines are ink #F4F6F8 at high opacity for the structure and muted #9AA3AD at low opacity for
secondary detail; exactly one element in the drawing, the scrawl, is picked out in a slightly
heavier stroke in pale neutral #E8ECEF, which the app recolours later. The node count is
deliberately low: the whole drawing is under a dozen strokes.

Output the pictogram isolated on a fully transparent background as a PNG with a real alpha channel.
If you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette and no shadow — nothing but the line work and that flat
colour.

The three ruled lines on the sheet and the scrawl are blank marks and never letters or words. The
image contains no club crest, heraldry, lion, eagle or crown, no people, faces, hands or bodies, no
colour beyond the neutrals named, no saturated colour, no drop shadow, no circular badge behind the
icon, no sketchy or variable-weight line, no border and no frame.

Premium broadcast-graphics art direction, editorial pictogram, reads as one silhouette at thumbnail
size.

No text, letters, words, numbers, digits, signature, watermark or lettering of any kind appears
anywhere in the image. If you cannot match a stated hex exactly, err darker and more desaturated
rather than brighter.
```

**If it comes back wrong.**
- *"The scrawl has turned into actual handwriting — make it a single abstract loop with no letterforms in it."*
- *"The stroke weight is heavier than the previous plate; match it exactly, uniform 2 units on a 100-unit grid."*

**Post note.** Ingest normalises stroke weight across the five and scales each plate to the same
optical area — overlay all five and compare before accepting any of them.

**Acceptance.** ☐ Reads unmistakably as "a deal was signed" at 28 px tall. ☐ The ruled lines are
ruled marks, never letters. ☐ Stroke weight matches the other four plates in the set. ☐ Exactly one
element is in the recolourable neutral `#E8ECEF`. ☐ Zero glyphs anywhere, no digits, no crest.
☐ ≤40 KB.

---

#### B7b — Injury plate

**Purpose / where.** Optional painted upgrade over the `injury` motif in `StoryArt`.
**Canvas to request.** **Landscape.**
**Final file.** `apps/game/public/art/stories/injury.webp` — WebP with alpha, 800×400, **≤40 KB**.
**Alpha path.** **Path A then B**, flat `#050607` ground as the fallback.

```
Generate a landscape image.

A single editorial pictogram, centred, occupying about 70% of a wide landscape frame, with the whole
shape inside the central two-thirds of the frame height so it survives a crop to a 2:1 banner. The
drawing is a thick medical cross with a horizontal heartbeat trace running straight through it from
edge to edge. The heavier neutral stroke is the trace itself, which spikes exactly once and then
flatlines toward the right.

Drawn as clean geometric line work of uniform weight — strokes about 2 units on a 100-unit grid —
with round caps and round joins, no fill, no shading, no gradient, no perspective and no depth.
Lines are ink #F4F6F8 at high opacity for the structure and muted #9AA3AD at low opacity for
secondary detail; exactly one element in the drawing, the trace, is picked out in a slightly heavier
stroke in pale neutral #E8ECEF, which the app recolours later. The node count is deliberately low:
the whole drawing is under a dozen strokes.

Output the pictogram isolated on a fully transparent background as a PNG with a real alpha channel.
If you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette and no shadow — nothing but the line work and that flat
colour.

The image contains no club crest, heraldry, lion, eagle or crown, no people, faces, hands, bodies,
stretchers or injured figures, no colour beyond the neutrals named, no saturated colour, no red
cross tint, no drop shadow, no circular badge behind the icon, no sketchy or variable-weight line,
no border and no frame.

Premium broadcast-graphics art direction, editorial pictogram, reads as one silhouette at thumbnail
size.

No text, letters, words, numbers, digits, signature, watermark or lettering of any kind appears
anywhere in the image. If you cannot match a stated hex exactly, err darker and more desaturated
rather than brighter.
```

**If it comes back wrong.**
- *"The trace spikes several times — it must spike exactly once and then flatline to the right edge."*
- *"The cross has been tinted red; keep every stroke in the neutral palette, #F4F6F8 and #9AA3AD, with only the trace in #E8ECEF."*

**Acceptance.** ☐ Reads unmistakably as "injury" at 28 px tall. ☐ The trace spikes exactly once, then
flatlines. ☐ Stroke weight matches the other four plates. ☐ Exactly one element is in the
recolourable neutral `#E8ECEF`. ☐ Zero glyphs anywhere, no digits, no crest. ☐ ≤40 KB.

---

#### B7c — Rivalry plate

**Purpose / where.** Optional painted upgrade over the `rivalry` motif in `StoryArt`.
**Canvas to request.** **Landscape.**
**Final file.** `apps/game/public/art/stories/rivalry.webp` — WebP with alpha, 800×400, **≤40 KB**.
**Alpha path.** **Path A then B**, flat `#050607` ground as the fallback.

```
Generate a landscape image.

A single editorial pictogram, centred, occupying about 70% of a wide landscape frame, with the whole
shape inside the central two-thirds of the frame height so it survives a crop to a 2:1 banner. The
drawing is two simplified shield outlines turned away from each other, one tilted slightly left and
one slightly right, with a clear empty gap between them. The heavier neutral stroke is a lightning
bolt filling that gap vertically.

Drawn as clean geometric line work of uniform weight — strokes about 2 units on a 100-unit grid —
with round caps and round joins, no fill, no shading, no gradient, no perspective and no depth.
Lines are ink #F4F6F8 at high opacity for the structure and muted #9AA3AD at low opacity for
secondary detail; exactly one element in the drawing, the bolt, is picked out in a slightly heavier
stroke in pale neutral #E8ECEF, which the app recolours later. The node count is deliberately low:
the whole drawing is under a dozen strokes.

Output the pictogram isolated on a fully transparent background as a PNG with a real alpha channel.
If you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette and no shadow — nothing but the line work and that flat
colour.

Both shields are completely blank outlines: they carry no charge, no device, no quartering, no
stripe, no star, no lion, eagle or crown, and they are not real club crests. The image contains no
people, faces, hands or bodies, no colour beyond the neutrals named, no saturated colour, no drop
shadow, no circular badge behind the icon, no sketchy or variable-weight line, no border and no
frame.

Premium broadcast-graphics art direction, editorial pictogram, reads as one silhouette at thumbnail
size.

No text, letters, words, numbers, digits, signature, watermark or lettering of any kind appears
anywhere in the image. If you cannot match a stated hex exactly, err darker and more desaturated
rather than brighter.
```

**If it comes back wrong.**
- *"The shields have devices inside them — empty them completely, they are blank outlines."*
- *"The two shields are touching; open a clear gap between them and let the bolt fill it."*

**Acceptance.** ☐ Reads unmistakably as "two sides, one grudge" at 28 px tall. ☐ Both shields are
blank outlines — no device, no charge, nothing heraldic. ☐ Stroke weight matches the other four
plates. ☐ Exactly one element is in the recolourable neutral `#E8ECEF`. ☐ Zero glyphs anywhere, no
digits, no crest. ☐ ≤40 KB.

---

#### B7d — Fans plate

**Purpose / where.** Optional painted upgrade over the `fans` motif in `StoryArt`.
**Canvas to request.** **Landscape.**
**Final file.** `apps/game/public/art/stories/fans.webp` — WebP with alpha, 800×400, **≤40 KB**.
**Alpha path.** **Path A then B**, flat `#050607` ground as the fallback.

```
Generate a landscape image.

A single editorial pictogram, centred, occupying about 70% of a wide landscape frame, with the whole
shape inside the central two-thirds of the frame height so it survives a crop to a 2:1 banner. The
drawing is a supporters' scarf held taut and overhead, drawn as two arcing bands with four short
fringe strokes hanging beneath, and behind it a rectangular flag on a vertical pole. The heavier
neutral stroke is the flag.

Drawn as clean geometric line work of uniform weight — strokes about 2 units on a 100-unit grid —
with round caps and round joins, no fill, no shading, no gradient, no perspective and no depth.
Lines are ink #F4F6F8 at high opacity for the structure and muted #9AA3AD at low opacity for
secondary detail; exactly one element in the drawing, the flag, is picked out in a slightly heavier
stroke in pale neutral #E8ECEF, which the app recolours later. The node count is deliberately low:
the whole drawing is under a dozen strokes.

Output the pictogram isolated on a fully transparent background as a PNG with a real alpha channel.
If you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette and no shadow — nothing but the line work and that flat
colour.

The scarf and the flag are blank: they carry no stripes, no hoops, no crest, no mark and no
heraldry. Nobody is holding the scarf — there are no people, faces, hands, arms, bodies or crowd in
the image. There is no colour beyond the neutrals named, no saturated colour, no drop shadow, no
circular badge behind the icon, no sketchy or variable-weight line, no border and no frame.

Premium broadcast-graphics art direction, editorial pictogram, reads as one silhouette at thumbnail
size.

No text, letters, words, numbers, digits, signature, watermark or lettering of any kind appears
anywhere in the image. If you cannot match a stated hex exactly, err darker and more desaturated
rather than brighter.
```

**If it comes back wrong.**
- *"Hands have appeared holding the scarf — remove them, the scarf floats on its own."*
- *"The scarf has stripes; make both the scarf and the flag completely blank."*

**Acceptance.** ☐ Reads unmistakably as "supporters" at 28 px tall. ☐ Scarf and flag are blank — no
stripes, no mark. ☐ Stroke weight matches the other four plates. ☐ Exactly one element is in the
recolourable neutral `#E8ECEF`. ☐ Zero glyphs anywhere, no digits, no crest. ☐ ≤40 KB.

---

#### B7e — Result plate

**Purpose / where.** Optional painted upgrade over the `result` motif in `StoryArt`.
**Canvas to request.** **Landscape.**
**Final file.** `apps/game/public/art/stories/result.webp` — WebP with alpha, 800×400, **≤40 KB**.
**Alpha path.** **Path A then B**, flat `#050607` ground as the fallback.

```
Generate a landscape image.

A single editorial pictogram, centred, occupying about 70% of a wide landscape frame, with the whole
shape inside the central two-thirds of the frame height so it survives a crop to a 2:1 banner. The
drawing is a rounded scoreboard panel containing two blank rounded plates side by side with a short
dash between them. The plates are completely empty — there are no digits, no numbers and no
scoreline on them. Six short rays burst outward from the panel's corners and top. The heavier
neutral stroke is the right-hand plate together with the rays.

Drawn as clean geometric line work of uniform weight — strokes about 2 units on a 100-unit grid —
with round caps and round joins, no fill, no shading, no gradient, no perspective and no depth.
Lines are ink #F4F6F8 at high opacity for the structure and muted #9AA3AD at low opacity for
secondary detail; exactly one element in the drawing is picked out in a slightly heavier stroke in
pale neutral #E8ECEF, which the app recolours later. The node count is deliberately low: the whole
drawing is under a dozen strokes.

Output the pictogram isolated on a fully transparent background as a PNG with a real alpha channel.
If you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette and no shadow — nothing but the line work and that flat
colour.

The image contains no club crest, heraldry, lion, eagle or crown, no people, faces, hands or bodies,
no colour beyond the neutrals named, no saturated colour, no drop shadow, no circular badge behind
the icon, no sketchy or variable-weight line, no border and no frame.

Premium broadcast-graphics art direction, editorial pictogram, reads as one silhouette at thumbnail
size.

No text, letters, words, numbers, digits, signature, watermark or lettering of any kind appears
anywhere in the image — the two score plates are blank shapes with nothing written on them. If you
cannot match a stated hex exactly, err darker and more desaturated rather than brighter.
```

**If it comes back wrong.**
- *"There are digits on the score plates — both plates are completely blank, with only the dash between them."*
- *"There are too many rays; reduce to six short rays from the corners and the top."*

**Acceptance.** ☐ Reads unmistakably as "a result came in" at 28 px tall. ☐ Zero digits anywhere —
both plates are blank. ☐ Stroke weight matches the other four plates. ☐ Exactly one element is in the
recolourable neutral `#E8ECEF`. ☐ Zero glyphs anywhere, no crest. ☐ ≤40 KB.

---

### B8 — Website device-mockup scene

**Purpose / where.** The hero band on `website/index.html`. Note the split, unchanged from the source
pack §7: the **device shell and environment** may be generated; the **screen content must be a real
capture of the build**, composited in post. A generated screen is a licensing and honesty problem,
not a shortcut.
**Canvas to request.** **Landscape.**
**Final file.** `website/hero-devices.webp` — WebP, 2400×1350, ≤220 KB. Screens composited in post.
**Alpha path.** None.

```
Generate a landscape image.

Three blank modern smartphones floating in a dark studio void, arranged in a loose overlapping fan:
one centred and face-on, one behind-left rotated about 18 degrees away from camera, one
behind-right rotated about 18 degrees the other way and slightly lower. The phones are simple
bezel-less slabs with uniform thin dark frames and softly rounded corners. Their screens are
completely blank flat #0E1013 — no content, no icons, no wallpaper, no interface, no reflection and
no glare of any kind on the glass. Materials are matte graphite #14171B with a single soft specular
sheen down the left edge of each device and no second highlight. The background is an empty graphite
gradient from #08090B at the edges to #0E1013 near the centre, with one faint cool rim light from
the upper left and a very soft contact shadow beneath the group. A thin electric-lime #C8FF2E rim
catch runs along one edge of the centre device only, under 2% of the frame.

Compose so the whole group sits within the central two-thirds of the frame height, because this
plate is cropped to a 16:9 banner afterwards.

The devices are generic and unbranded: there is no manufacturer logo, no notch, no dynamic island,
no camera bump detail and no model marking anywhere. There are no hands, fingers or people, no desk,
table, plant, coffee cup or office setting, no bright or white background, no studio backdrop seam,
no colourful gradient, no lens flare and no depth-of-field blur — everything is in focus.

Studio product photography lighting, three-quarter view, 50mm lens, deep depth of field. Premium
broadcast-graphics art direction, dark glassmorphism, film-grade contrast, blacks retain detail.

No text, letters, words, numbers, signature, watermark or lettering of any kind appears anywhere in
the image, including on the devices and on their screens. If you cannot match a stated hex exactly,
err darker and more desaturated rather than brighter.
```

**If it comes back wrong.**
- *"There is interface content on the screens — the screens must be completely blank flat #0E1013 with nothing drawn on them."*
- *"The centre phone has a notch and a camera bump; make all three plain unbranded slabs with uniform thin frames."*

**Post note.** Perspective-warp **real screenshots of the build** (the same captures used for the App
Store set) into each blank screen and add a 6% screen-space gradient so they sit in the light.

**Acceptance.** ☐ Screens are genuinely blank in the generated plate. ☐ No manufacturer branding or
notch. ☐ Composited screenshots are real build captures, not mockups. ☐ Volt under 2%. ☐ Zero glyphs
anywhere in the generated plate. ☐ ≤220 KB.

---

## 5. P2 — polish

### C1 — Stadium-bowl haze plate

**Purpose / where.** Atmosphere layer over the live pitch canvas and behind hero surfaces, replacing
the CSS-only haze in `design/surfaces/material.ts` where a real gradient field looks better.
**Canvas to request.** **Landscape.**
**Final file.** `apps/game/public/art/textures/stadium-haze.webp` — WebP with alpha, 1600×900,
≤80 KB. Composited at ≤18% opacity.
**Alpha path.** **Path A then B.** Path B is the practical one: a flat `#050607` ground, keyed by
luminance, gives a smoother alpha ramp on a haze field than a chat-returned alpha channel does.

```
Generate a landscape image.

A soft field of atmospheric haze and nothing else — no objects of any kind. A broad low-lying band
of cool blue-grey mist, #9EB2C8 at very low opacity, thickens across the lower two-thirds of the
frame and thins away to nothing at the top. Four wide, extremely diffuse pools of cold #D6E8FF light
bloom downward from above the frame at evenly spaced intervals, as if four floodlights sat just out
of shot, each fading out well before it reaches the bottom edge. Fine, even volumetric grain runs
throughout. There is no structure, no edge, no shape and no focal point anywhere. The contrast is
very low: the brightest point is only slightly brighter than the darkest.

Output the haze isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient and no vignette — nothing but the haze and that flat colour.

The frame contains no stadium, stand, seat, floodlight mast, pitch, grass, line marking, building,
cloud, sky, person, face or silhouette. There is no smoke plume, fog machine or dry ice effect, no
hard-edged light beam or god ray, no sun, no lens flare, no rainbow, no warm or orange colour, no
saturated colour, no border, no frame and no vignette.

Premium broadcast-graphics art direction, film-grade contrast, rendered volumetric study rather
than photography.

No text, letters, words, numbers, signature, watermark or lettering of any kind appears anywhere in
the image. If you cannot match a stated hex exactly, err darker and more desaturated rather than
brighter.
```

**If it comes back wrong.**
- *"A stadium has appeared in the haze — remove every object; this is pure atmosphere with no structure at all."*
- *"The light pools have hard edges and read as beams; make them extremely diffuse with no visible boundary."*

**Post note.** Ingest clamps max luminance to ~45%. Check the plate at 18% opacity over `#0A1410` —
it must lift the field without washing it.

**Acceptance.** ☐ Zero recognisable objects. ☐ Max luma ≤45%. ☐ At 18% opacity over the pitch it
raises the floor by roughly one stop and no more. ☐ No hard edge anywhere. ☐ Zero glyphs anywhere.
☐ ≤80 KB.

---

### C2 — Ball sprite

**Purpose / where.** Upgrade over the gradient ball drawn by
`features/matchday/live/pitchRenderer.ts`. The renderer sprite-caches, so this is a single top-down
still, drawn once and blitted.
**Canvas to request.** **Square.**
**Final file.** `apps/game/public/art/sprites/ball.webp` — WebP with alpha, 256×256 (128 @2x),
≤20 KB.
**Alpha path.** **Path A then B.** Path B is preferred here: an off-white ball on flat `#050607`
keys to a clean circular edge, whereas chat-returned alpha on a small round subject usually arrives
with a grey halo that shows against the dark pitch.

```
Generate a square image.

A single football seen from directly above, centred, filling about 88% of the frame. The ball is a
matte off-white sphere, #F4F6F8 on the lit side falling to #9AA3AD in shadow, lit from the upper
left by one soft key with a single small specular sheen at the upper left and no second highlight
anywhere. The seams are drawn as one small central pentagon with four seam lines radiating from its
vertices, recessed and rendered in dark graphite #14171B at low contrast — visible but never
graphic. The lower-right quadrant carries a soft occlusion shading. The ball must stay legible at
sixteen pixels: clean, small-scale, no fine detail.

Output the ball isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient, no vignette, no cast shadow, no contact shadow and no reflection —
nothing but the ball and that flat colour, and the ball not touching the frame edge.

The ball carries no branding, no manufacturer marking and no sponsor mark, and it is not a real ball
model. It has no full hexagon-and-pentagon panel pattern, no classic black-and-white panels, no
coloured panels, no dirt, no scuffs and no wet sheen. There is no grass, pitch or environment behind
it, no cast shadow or drop shadow, no reflection, no rim light, no glow, no motion blur or trail,
and no outline, border or frame.

Premium broadcast-graphics art direction, product-render lighting, film-grade contrast, rendered
CGI quality rather than photography.

No text, letters, words, numbers, signature, watermark or lettering of any kind appears anywhere in
the image. If you cannot match a stated hex exactly, err darker and more desaturated rather than
brighter.
```

**If it comes back wrong.**
- *"The seams are too graphic — recess them and drop their contrast so they read as shading, not as drawn lines."*
- *"The whole panel pattern is back; only the one central pentagon and four radiating seams."*

**Post note.** Ingest centres to the exact pixel centre and keeps the alpha edge a clean circle with
a half-pixel feather at most. Verify at 16 px and 24 px on `#0A1410` — if the seams disappear, raise
their contrast slightly rather than their width.

**Acceptance.** ☐ Perfect circle in alpha, centred within 1 px. ☐ Reads as a ball at 16 px on the
dark pitch. ☐ Exactly one highlight. ☐ No branding or panel pattern. ☐ Zero glyphs anywhere.
☐ ≤20 KB.

---

### C3 — Kit fabric micro-noise tile

**Not generated with ChatGPT.** It is a seamless tileable texture. See §6.

---

### C4 — Reward-fly particle sheet

**Purpose / where.** H8 "objective claimed" — reward tokens flying to the balance chip. A sprite
sheet of one token at eight rotations, blitted along the flight path.
**Canvas to request.** **Landscape.** The target is a 4:1 strip, wider than a landscape canvas, so
the prompt puts the strip as a band across the middle with empty ground above and below; ingest
crops the band out.
**Final file.** `apps/game/public/art/sprites/reward-tokens.webp` — WebP with alpha, 1024×256
(8 frames of 128², left to right, uniform padding), ≤40 KB.
**Alpha path.** **Path A then B**, flat `#050607` ground as the fallback.

```
Generate a landscape image.

Eight small gold tokens in a single horizontal row across the middle of the frame, evenly spaced,
all the same size, with empty flat ground above and below the row. Each token is the same identical
disc seen at a different rotation about its vertical axis: fully face-on in the first, then
progressively narrower ellipses, nearly edge-on in the fifth, then opening back out to the eighth.
The token is a plain convex disc with a raised bevelled rim, spun gold with a ramp of #7A5716 in
shadow, #B8862B on the turn, #FFD76A on the face and #FFF0C4 at the hot core, lit from the upper
left with exactly one specular sheen per token and no second highlight. The face of every token is
completely blank — no emblem, no relief, no engraving, no portrait, no currency symbol and no
denomination. Each token sits centred in its own share of the row with generous even padding on
both sides, and no token touches another or the frame edge.

Output the row of tokens isolated on a fully transparent background as a PNG with a real alpha
channel. If you cannot produce transparency, place them instead on a completely flat, evenly lit,
pure #050607 background with no gradient, no vignette, no cast shadow, no contact shadow and no
reflection — nothing but the tokens and that flat colour.

The tokens are gold only — no silver, chrome, brass or plastic. They are not real coins, poker
chips, medals or bitcoins, and they carry no ribbon. There is no motion blur, trail, streak,
sparkle or glitter, no cast shadow or mirror reflection, no grid, no dividing lines or borders
between the tokens, and there are exactly eight of them, never more and never fewer.

Premium broadcast-graphics art direction, product-render lighting, film-grade contrast, rendered
CGI quality rather than photography.

No text, letters, words, numbers, currency symbols, signature, watermark or lettering of any kind
appears anywhere in the image. If you cannot match a stated hex exactly, err darker and more
desaturated rather than brighter.
```

**If it comes back wrong.**
- *"The rotation sequence is uneven — make it a smooth progression: face-on, three narrowing ellipses, nearly edge-on at the fifth, then opening back out."*
- *"There is a relief emblem on the token faces; every face is completely blank gold."*

**Post note.** Ingest slices to exactly 8×128 px cells, re-centres each token in its cell and
equalises brightness across frames (generators drift left-to-right across a strip).

**Acceptance.** ☐ Exactly 8 cells at 128² with the token centred in each. ☐ Rotation sequence plays
smoothly when cycled at 12 fps. ☐ Faces are blank — zero glyphs, no emblem. ☐ Consistent brightness
across frames. ☐ ≤40 KB.

---

### C5 — Special-rule sweep plate

**Purpose / where.** H6 "special rule activates" — a `--color-special` wash sweeping across the
pitch. A single wide gradient plate translated across the pitch surface.
**Canvas to request.** **Landscape.** Target is a 4:1 band; the sweep runs the full height of
whatever comes back and ingest crops the band out of the middle.
**Final file.** `apps/game/public/art/textures/rule-sweep.webp` — WebP with alpha, 2048×512,
≤48 KB. Composited at ≤22% opacity in `screen`.
**Alpha path.** **Path A then B.** Path B, keyed by luminance off flat `#050607`, is the reliable
one — this composites with `screen`, where the dark ground is close to a no-op anyway.

```
Generate a landscape image.

A single soft vertical band of violet light sweeping across an otherwise empty frame, and nothing
else — no objects of any kind. The band is violet #A78BFA at low opacity, brightest along a narrow
core and falling away smoothly over a long distance to both left and right until it reaches nothing
well before the frame edges. The band leans about eight degrees off vertical and runs the full
height of the frame, softening slightly at the top and bottom edges. A faint cooler #7C8CFF fringe
trails its left side. Everything is extremely soft: there is no hard boundary anywhere, no sharp
gradient stop and no banding, and the overall contrast is very low. The far left and far right of
the frame are completely empty.

Output the sweep isolated on a fully transparent background as a PNG with a real alpha channel. If
you cannot produce transparency, place it instead on a completely flat, evenly lit, pure #050607
background with no gradient and no vignette — nothing but the sweep and that flat colour.

There is no green, lime or volt colour anywhere in this image; the sweep is violet and indigo only.
The frame contains no stars, sparkles, particles, lightning, energy crackle, lens flare or
anamorphic streak, no pitch, grass, players or people, no rainbow or saturated colour, and no
border, frame or vignette.

Premium broadcast-graphics art direction, film-grade contrast, rendered volumetric study rather
than photography.

No text, letters, words, numbers, signature, watermark or lettering of any kind appears anywhere in
the image. If you cannot match a stated hex exactly, err darker and more desaturated rather than
brighter.
```

**If it comes back wrong.**
- *"The band reaches the left and right edges — make it fade to nothing well before them, so the plate can slide on and off screen invisibly."*
- *"There is a hard edge along the core; soften the whole falloff, no visible boundary anywhere."*

**Post note.** Verify the leftmost and rightmost 16 px columns are fully transparent after ingest.

**Acceptance.** ☐ Leftmost and rightmost 16 px columns are fully transparent. ☐ No volt or green
anywhere — special is violet, and mixing the two breaks the semantic mapping. ☐ No hard edge at 200%
zoom. ☐ Translating it across the pitch shows no banding. ☐ Zero glyphs anywhere. ☐ ≤48 KB.

---

## 6. What not to make with ChatGPT

### 6.1 Seamless tileable textures — B5, C3, and any future tile

**Do not attempt these here.** A chat image generator does not produce edge-matching tiles: it has
no tiling mode, no seam constraint, and no way to guarantee that the left column continues into the
right. What comes back looks correct on its own and shows a visible seam and a repeating hotspot the
moment it is tiled 3×3 — which is exactly what B5's and C3's acceptance checks test for.

| Entry | Ship instead |
|---|---|
| **B5 — Legendary foil tile** | Keep the shipped CSS version: `.cf-foil` in `tokens.css` plus `CardFoil` in `design/hero/effects.tsx`. Two repeating gradients at different pitches and angles already beat into the interference a printed foil makes, with one conic for the hue shift, every stop under 12% alpha. `ASSET_PLAN` §3 ticks this DONE. It is also what renders under reduced transparency, so it is the fallback either way — a raster tile would only ever sit on top of it. |
| **C3 — Kit fabric micro-noise tile** | Keep the procedural overlay. The requirement is a neutral grey at exactly 50% mean luminance with zero saturation, composited at ≤8% in `overlay` — a CSS/canvas noise field hits that spec exactly and a generated JPEG-ish texture does not. Any residual colour in a generated tile tints every club's kit. |

If a raster tile is genuinely wanted later, generate it with a tool that has a tiling mode (SDXL
with a seamless LoRA, Substance, or a noise generator) using the prompts already in
`docs/AI_ASSET_PROMPTS.md` §4/§5 — they are written for exactly that.

### 6.2 Already shipped and good — optional at best

`ASSET_PLAN` ticks these DONE with a procedural or rasterised-from-source version that is already
correct. Generating over them is a taste upgrade, not a gap. **A3** (og-image, rasterised from
`tools/brand/og.html`), **B1–B3** (`HeroScene`, three moods), **B4a–B4e** (`silverware.tsx`) and
**B7a–B7e** (`StoryArt` motifs) are all in this category. Do them if you want the painted look; skip
them without guilt. The genuinely absent items are the **B6** reveal kit, the P0 icon/splash polish
pass, the store screenshots (which are not generated at all — see below) and most of P2.

### 6.3 Never generate — carried over from source pack §7

| Never generate | Why | Do this instead |
|---|---|---|
| **App Store screenshots ×8 (+3 iPad)** | Apple guideline 2.3.1 requires screenshots to show the actual product. A generated or mocked-up screen is a rejection. | Capture the real build at 1290×2796 (and 2064×2752), staged per `APP_STORE.md` §5. |
| **Anything containing the wordmark, a caption or any typography** | The type stack is system SF Pro; a generator cannot set it and generated glyphs are always subtly wrong. Every prompt above forbids lettering for this reason. | Generate the plate, then set type in a design tool — on glass, never directly on imagery. |
| **`favicon.ico`** | A multi-resolution container derived from the existing `favicon.svg`, not artwork. | Re-run `tools/brand/render.mjs` against `icon.html` and pack 16/32/48 px into the `.ico`. |
| **Club crests, kits and player portraits** | `ClubBadge`, `kit.ts` and `face.tsx` are seeded generators that must scale to newgens forever. A file cannot cover an unbounded set, and `LICENSING_ARCHITECTURE.md` G7 requires generated identities to come from an original component set. | Extend the generator. Hand-painted plates are only ever an *overlay* on top of it. |
| **Real creator or footballer likenesses** | `LICENSING_ARCHITECTURE.md` §6.1: no real person, no photo, no caricature, **and no "legally distinct" near-miss**. | Nothing. Base content is 100% fictional. |
| **Real stadiums, league marks, sponsor boards, broadcast overlays** | Same section: no recognisable stadium architecture, no real crest, no sponsor mark, no reproduction of a real broadcast graphics package. | Every prompt above rules these out in prose; keep those sentences in when you edit a prompt. |

### 6.4 Audio

ChatGPT does not generate audio. The 15 `D`-entries (crowd beds, whistles, ticks, stings) are not
reproduced here — use **`docs/AI_ASSET_PROMPTS.md` §6**, which carries the full spec, the loudness
targets and the right tools (ElevenLabs SFX and Suno-class generators). The synthesised WebAudio
pack in `design/audio.ts` remains shipped and remains the fallback.

---

## 7. What to do with the downloaded files

1. **Save every download into the drop folder** with its entry ID as the filename — `A1.png`,
   `B4a.png`, `B7c.png` and so on. Do not rename them to their destination names; the ID is what the
   ingest script matches on.
2. **Run the ingest script:**

   ```
   node tools/brand/ingest.mjs
   ```

   It resizes to the target size in each entry, keys the flat `#050607` backdrop out to alpha where
   the entry calls for it, applies the baked scrims, compresses to the stated format and weight
   budget, and writes each file to its exact destination path.
3. **Read `node tools/brand/ingest.mjs --help`** for the drop-folder location, the per-entry flags
   and the dry-run mode. The script is the authority on its own options; this section is not.
4. **Verify against the entry's acceptance checklist before committing.** Every checklist here
   includes **zero glyphs anywhere** — check the corners and any nameplate at 200%.
5. **Filenames are contracts.** A file at `/art/heroes/title_stadium.webp` or
   `/art/trophies/superCup.webp` is not a broken override, it is *no override at all*, and it looks
   identical to the asset never having been made. Let the script write the paths.

---

## 8. Manifest — what this pack covers

**23 entries, 24 files.** (A1 ships the same artwork as a master and as a store icon; A2's single
file is copied over three identical imageset entries.) Compared with the 40-entry / 56-file source
pack, this pack drops the **15 audio entries** (§6.4) and the **2 seamless tiles** B5 and C3 (§6.1).

| Entry | ChatGPT canvas | Destination path | Format / size | Weight budget |
|---|---|---|---|---|
| A1 | Square | `tools/brand/icon-master.png` | PNG, 2048² | ≤900 KB |
| A1 | Square | `apps/game/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (also the ASC marketing icon) | PNG, 1024², no alpha | ≤400 KB |
| A2 | Square | `apps/game/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png` (×3 identical entries) | PNG, 2732² | ≤700 KB |
| A3 | Landscape | `website/og-image.jpg` | JPEG q78, 1200×630 | ≤60 KB |
| B1 | Portrait | `apps/game/public/art/heroes/title-stadium.webp` | WebP, 1179×2556 | ≤300 KB |
| B2 | Portrait | `apps/game/public/art/heroes/result-triumph.webp` | WebP, 1179×2556 | ≤300 KB |
| B3 | Portrait | `apps/game/public/art/heroes/result-consolation.webp` | WebP, 1179×2556 | ≤300 KB |
| B4a | Portrait | `apps/game/public/art/trophies/league.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B4b | Portrait | `apps/game/public/art/trophies/cup.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B4c | Portrait | `apps/game/public/art/trophies/super-cup.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B4d | Portrait | `apps/game/public/art/trophies/boot.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B4e | Portrait | `apps/game/public/art/trophies/legacy.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B6a | Square | `apps/game/public/art/heroes/reveal-burst.webp` | WebP + alpha, 1024² | ≤90 KB |
| B6b | Square | `apps/game/public/art/heroes/reveal-motes.webp` | WebP + alpha, 1024² | ≤60 KB |
| B7a | Landscape | `apps/game/public/art/stories/transfer.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B7b | Landscape | `apps/game/public/art/stories/injury.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B7c | Landscape | `apps/game/public/art/stories/rivalry.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B7d | Landscape | `apps/game/public/art/stories/fans.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B7e | Landscape | `apps/game/public/art/stories/result.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B8 | Landscape | `website/hero-devices.webp` | WebP, 2400×1350 | ≤220 KB |
| C1 | Landscape | `apps/game/public/art/textures/stadium-haze.webp` | WebP + alpha, 1600×900 | ≤80 KB |
| C2 | Square | `apps/game/public/art/sprites/ball.webp` | WebP + alpha, 256² | ≤20 KB |
| C4 | Landscape | `apps/game/public/art/sprites/reward-tokens.webp` | WebP + alpha, 1024×256 (8×128²) | ≤40 KB |
| C5 | Landscape | `apps/game/public/art/textures/rule-sweep.webp` | WebP + alpha, 2048×512 | ≤48 KB |

Not covered here, by design: **B5** and **C3** (seamless tiles — §6.1) and **D1–D8**, all 15 audio
entries (§6.4). Both live on in `docs/AI_ASSET_PROMPTS.md`.

---

*Art direction, palette, silhouettes, destinations, budgets and acceptance checks are inherited
unchanged from `docs/AI_ASSET_PROMPTS.md`, which in turn derives from `docs/DESIGN_SYSTEM.md`,
`apps/game/src/design/tokens.css` and the shipped procedural art each override must sit beside. If a
token changes, the hex values in both documents change with it — the design system is the source of
truth, not this document.*
