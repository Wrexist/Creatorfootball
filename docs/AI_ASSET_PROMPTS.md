# Creator Football — AI Asset Prompt Pack

> Companion to `docs/ASSET_PLAN.md`. That document says *what* is still missing. This one is the
> production input: copy-paste-ready generation prompts for every asset the game still needs, plus
> the hand-made overrides that can upgrade something already rendering from code.
>
> **Prime directive, unchanged:** every file here is an *override layer* over a working procedural
> path. A file that is missing, corrupt or slow is never a bug — the component behind it draws.
> Nothing in this pack may become load-bearing.

---

## 1. How to use this pack

1. **Pick an asset entry.** Each is self-contained: purpose, destination, prompt, negative prompt,
   post-processing, acceptance checks. Every deliverable file in the pack has its own entry — where
   one idea produces five trophies or three ticks, there are five or three entries, not one.
2. **Paste the prompt verbatim** into Midjourney / Higgsfield / DALL·E / SDXL / Flux (images) or
   ElevenLabs SFX / Suno-class tools (audio). Every prompt already inlines the universal style
   language and the palette hex values it needs, and the tool never needs repo context.
3. **Post-process per spec.** Nothing ships straight out of a generator: crop, scrim, compress.
4. **Drop it at the exact destination path.** Filenames are contracts (§8.3). A typo silently means
   "no override", which looks identical to "asset not made yet".
5. **Verify against the acceptance checklist** before committing.

> **The guarantee: one asset = one code block = paste and go, nothing to assemble.** Each entry has
> exactly one fenced prompt block, and that block is the whole prompt — style language, palette,
> subject, composition and aspect flag are all already in it. There is no preamble to prepend, no
> table cell to append, no fragment to look up in another entry. The style and negative blocks in
> §1.1 and §1.2 are printed once here as a reference for what is already inside every prompt; you
> never need to copy them anywhere. Where two entries share language, that language is repeated in
> full in both. The repetition is deliberate — do not factor it out.

### 1.1 Universal style block (reference only — already inlined in every prompt below)

```
Premium broadcast-graphics art direction, dark glassmorphism. Near-black graphite ground
#050607–#08090B; surface steps #0E1013 / #14171B / #1C2026 / #262B33. Cool, desaturated,
low-key lighting with deep falloff and film-grade contrast; blacks retain detail, never crushed.
A single electric-lime accent #C8FF2E (bright #DCFF6B, deep #9ECC12) used only as state, covering
under 3% of the frame. Trophy gold ramp #7A5716 → #B8862B → #FFD76A → #FFF0C4. Pitch greens are
near-black and desaturated, #0A1410–#0E1C16, pitch lines white at 16% opacity. Ink #F4F6F8, muted
ink #9AA3AD. Bold geometric forms, generous soft radii, exactly one specular sheen per object and
never a second. Rendered CGI/matte-painting quality, not photography, not illustration outline.
```

### 1.2 Universal negative prompt (reference only — already inlined in every entry below)

```
text, letters, words, numbers, typography, wordmark, watermark, signature, caption, logo,
brand marks, sponsor boards, advertising hoardings, real club crests, heraldry, shields with
lions or eagles or crowns, real people, recognisable faces, celebrity likeness, photoreal skin,
cartoon, anime, comic, clip art, stock vector illustration, sticker outline, thick black outlines,
lens flare spam, chromatic aberration, bloom haze, rainbow gradients, teal-and-orange grade,
bright saturated green grass, daylight, white or light background, busy clutter, border, frame,
vignette ring, UI mockup, device bezel, jpeg artifacts, banding, oversharpening
```

### 1.3 Tooling notes

- **Aspect ratio.** Midjourney-style flags are given as `--ar`, inside the prompt block. For
  SDXL/Flux, generate at the nearest supported bucket and upscale; the entry states the final pixel
  size, which is the contract, not the generation size.
- **Compression.** `cwebp -q 82 -m 6 in.png -o out.webp` for photographic plates,
  `cwebp -q 90 -alpha_q 100` for anything with alpha, `pngquant --quality 80-95` + `oxipng -o4`
  for the PNGs the store requires. Weight budgets below are hard ceilings, not targets.
- **Text safety.** Any plate that sits behind UI must end its post-process with a bottom-weighted
  scrim: multiply a `#050607` linear gradient (0% at the top of the safe area → 62% at the bottom)
  before compressing. The design system forbids text sitting directly on imagery.

---

## 2. Deliverable manifest

Every file this pack produces, one row each: **26 image files from 25 image entries** (A1 ships the
same artwork as a master and a store icon) **and 15 audio cues from 15 audio entries, each cue
delivered in two formats — 30 audio files. 40 entries, 56 files in total.** Nothing else in the
repo is waiting on this document.

| Entry | Destination path | Format / size | Weight budget |
|---|---|---|---|
| A1 | `tools/brand/icon-master.png` | PNG, 2048² | ≤900 KB |
| A1 | `apps/game/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (same file is the ASC marketing icon) | PNG, 1024², no alpha | ≤400 KB |
| A2 | `apps/game/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png` (×3 identical entries) | PNG, 2732² | ≤700 KB |
| A3 | `website/og-image.jpg` | JPEG q78, 1200×630 | ≤60 KB |
| B1 | `apps/game/public/art/heroes/title-stadium.webp` | WebP, 1179×2556 | ≤300 KB |
| B2 | `apps/game/public/art/heroes/result-triumph.webp` | WebP, 1179×2556 | ≤300 KB |
| B3 | `apps/game/public/art/heroes/result-consolation.webp` | WebP, 1179×2556 | ≤300 KB |
| B4a | `apps/game/public/art/trophies/league.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B4b | `apps/game/public/art/trophies/cup.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B4c | `apps/game/public/art/trophies/super-cup.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B4d | `apps/game/public/art/trophies/boot.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B4e | `apps/game/public/art/trophies/legacy.webp` | WebP + alpha, 600×792 | ≤120 KB |
| B5 | `apps/game/public/art/textures/foil-legendary.webp` | WebP, seamless 512² | ≤48 KB |
| B6a | `apps/game/public/art/heroes/reveal-burst.webp` | WebP + alpha, 1024² | ≤90 KB |
| B6b | `apps/game/public/art/heroes/reveal-motes.webp` | WebP + alpha, 1024² | ≤60 KB |
| B7a | `apps/game/public/art/stories/transfer.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B7b | `apps/game/public/art/stories/injury.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B7c | `apps/game/public/art/stories/rivalry.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B7d | `apps/game/public/art/stories/fans.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B7e | `apps/game/public/art/stories/result.webp` | WebP + alpha, 800×400 | ≤40 KB |
| B8 | `website/hero-devices.webp` | WebP, 2400×1350 | ≤220 KB |
| C1 | `apps/game/public/art/textures/stadium-haze.webp` | WebP + alpha, 1600×900 | ≤80 KB |
| C2 | `apps/game/public/art/sprites/ball.webp` | WebP + alpha, 256² | ≤20 KB |
| C3 | `apps/game/public/art/textures/kit-fabric.webp` | WebP, seamless 256² | ≤16 KB |
| C4 | `apps/game/public/art/sprites/reward-tokens.webp` | WebP + alpha, 1024×256 (8×128²) | ≤40 KB |
| C5 | `apps/game/public/art/textures/rule-sweep.webp` | WebP + alpha, 2048×512 | ≤48 KB |
| D1a | `apps/game/public/audio/crowd-bed.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 20 s loop | ≤180 KB per format |
| D1b | `apps/game/public/audio/crowd-bed-low.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 20 s loop | ≤180 KB per format |
| D1c | `apps/game/public/audio/crowd-bed-high.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 20 s loop | ≤180 KB per format |
| D1d | `apps/game/public/audio/crowd-bed-rain.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 20 s loop | ≤180 KB per format |
| D2 | `apps/game/public/audio/goalRoar.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 2.2 s | ≤40 KB per format |
| D3a | `apps/game/public/audio/kickOff.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 0.9 s | ≤24 KB per format |
| D3b | `apps/game/public/audio/fullTime.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 1.8 s | ≤24 KB per format |
| D4a | `apps/game/public/audio/decisionTick-low.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 0.12 s | ≤10 KB per format |
| D4b | `apps/game/public/audio/decisionTick-mid.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 0.12 s | ≤10 KB per format |
| D4c | `apps/game/public/audio/decisionTick-high.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 0.12 s | ≤10 KB per format |
| D5 | `apps/game/public/audio/trophyFanfare.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 2.6 s | ≤48 KB per format |
| D6 | `apps/game/public/audio/signingSting.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 1.6 s | ≤32 KB per format |
| D7 | `apps/game/public/audio/rewardChime.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 0.7 s | ≤16 KB per format |
| D8a | `apps/game/public/audio/uiTick.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 0.06 s | ≤8 KB per format |
| D8b | `apps/game/public/audio/uiSelect.{m4a,ogg}` | AAC-LC 128k + Ogg q4, 0.11 s | ≤8 KB per format |

Priority, if you are making them in order: A1–A3 are launch-blocking (§3); B1–B8 are the
high player-visible overrides (§4); C1–C5 are polish (§5); D1–D8 are audio overrides (§6), all of
which already have a working synthesised fallback.

---

## 3. P0 — launch-blocking

### A1 — App icon master

**Purpose / where.** The mark, everywhere: iOS home screen, App Store Connect marketing icon,
website favicon lineage. The current mark is a volt football on graphite — four seams radiating
from a pentagon, one soft sheen off the upper-left.
**Destination.** Master `tools/brand/icon-master.png` (2048², PNG, ≤900 KB) →
`apps/game/ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon-512@2x.png` (1024², PNG, ≤400 KB,
**no alpha, no rounded corners** — iOS masks) and the ASC marketing icon (same 1024² file).

```
A single football rendered as a flat geometric emblem, centred, filling about 68% of a square
frame. The ball is one solid electric-lime disc with a top-left to bottom-right gradient
#E6FF9B → #C8FF2E → #9ECC12; a soft elliptical specular sheen sits at the upper-left of the disc
at roughly 40% white, rotated about -32 degrees, and is the only highlight in the image. Cut into
the disc in very dark ink #0D1400: one crisp regular pentagon at the centre and four thick seam
lines radiating from its vertices toward the ball's edge, stopping short of the rim. The
background is a subtle radial graphite falloff from #12160E at the centre to #08090B at the
corners, flat and clean. No rim light, no cast shadow, no reflection, no texture.
Premium broadcast-graphics art direction, dark glassmorphism, near-black graphite ground
#050607–#08090B, low-key lighting with deep falloff and film-grade contrast, bold geometric form,
exactly one specular sheen, rendered CGI quality, not photography.
--ar 1:1
```

**Negative prompt**

```
text, letters, words, numbers, typography, watermark, signature, logo type, brand marks, sponsor
marks, real club crests, heraldry, real people, faces, cartoon, anime, clip art, sticker outline,
thick black outlines, photoreal leather ball, stitching detail, hexagon-pentagon full truncated
icosahedron pattern, white ball, grass, stadium, drop shadow, bevel, glossy plastic, skeuomorphic
badge, rounded-corner squircle mask, border, frame, gradient mesh, rainbow, lens flare, bloom
```

**Post-processing.** Trim to exact square; flatten onto `#08090B` (kill alpha); export 1024² PNG-24;
`pngquant --quality 88-98` then `oxipng -o4`. Re-derive the 2048² master as an SVG redraw if the
raster is adopted, so `tools/brand/render.mjs` can keep producing the web PNGs from one source.

**Acceptance.** ☐ Silhouette still reads as a ball at 40 px and 60 px. ☐ Exactly one sheen.
☐ No legible glyph anywhere. ☐ Corner pixels are `#08090B` ±2. ☐ No alpha channel.

---

### A2 — Splash / launch screen

**Purpose / where.** iOS launch image, shown for the ~300 ms before the webview paints. It must be
indistinguishable from the app's first frame or the launch flashes.
**Destination.** `apps/game/ios/App/App/Assets.xcassets/Splash.imageset/splash-2732x2732.png`
(2732², PNG, ≤700 KB) — copy over all three identical entries in that imageset.

```
A perfectly square composition, almost empty. Background is flat graphite #08090B with an
extremely subtle radial lift toward the centre, no more than three percent brighter, and a
barely-there horizontal band of #0E1013 across the lower third suggesting a dark stadium horizon
that never resolves into an object. Centred in the frame, occupying about 22% of the width, sits
one flat geometric emblem: an electric-lime football disc, gradient #E6FF9B → #C8FF2E → #9ECC12,
with a single soft upper-left specular sheen and a dark #0D1400 pentagon plus four radiating seam
lines cut into it. A faint volt glow, #C8FF2E at 8% opacity, blooms about one ball-radius around
the emblem and fades to nothing. Everything below the emblem is clean empty graphite.
Premium broadcast-graphics art direction, dark glassmorphism, low-key lighting with deep falloff,
film-grade contrast, blacks retain detail and are never crushed, volt accent under 3% of the
frame, exactly one specular sheen, rendered CGI quality, not photography.
--ar 1:1
```

**Negative prompt**

```
text, letters, words, numbers, typography, wordmark, watermark, signature, tagline, logo type,
brand marks, sponsor boards, real crests, heraldry, real people, faces, cartoon, clip art,
gradients across the whole frame, rainbow, teal-and-orange grade, bright background, white
background, vignette ring, border, frame, particles, confetti, stars, bokeh, lens flare, bloom
haze, busy detail, device bezel, UI elements, progress bar, loading spinner
```

**Post-processing.** Re-centre the emblem to the exact pixel centre (iOS scales this square to fill
every device, so anything off-centre drifts). Sample the corner colour and force it to exactly
`#08090B` — it must match `--color-base`, `capacitor.config.ts` and the `theme-color` meta or the
app flashes on launch. Flatten, export PNG-24, `pngquant --quality 85-96`.

**Acceptance.** ☐ Corner pixel is exactly `#08090B`. ☐ Emblem centred within 2 px on both axes.
☐ Crops safely to 19.5:9 and to 4:3 without touching the emblem. ☐ No text. ☐ ≤700 KB.

---

### A3 — Social share card / OG banner refresh

**Purpose / where.** `og:image` and `twitter:image` on all four website pages; the first impression
in every link unfurl. A card already ships, rasterised from `tools/brand/og.html`; this is an
optional painted upgrade.
**Destination.** `website/og-image.jpg` (1200×630, JPEG q78, **≤60 KB** — it is fetched by crawlers
on a cold cache). Keep `tools/brand/og.html` as the fallback master.

```
A wide cinematic plate of a fictional football stadium at dusk, seen from high in the stands
behind one goal, shot on a 35mm lens. The bowl is a smooth parabolic sweep of dark seating that
reads as geometry rather than as individual seats; four floodlight masts stand on the far rim,
their light cool and blue-white #D6E8FF at low intensity, throwing soft haze rather than beams.
The pitch is a near-black desaturated green, #0A1410 into #0E1C16, with white 16%-opacity markings
just visible; a thin electric-lime rail, #C8FF2E, runs along the near touchline as the single
accent in the image and occupies under 3% of the frame. Crowd is suggested by tiny cool bokeh
points, #BED2EB and #8FA3BC, never faces. The upper third of the frame is empty graphite sky
#050607 fading to #0A1119. The left half of the composition is deliberately quiet and flat, an
empty dark area with no detail. Premium broadcast-graphics art direction, dark glassmorphism,
low-key lighting with deep falloff, film-grade contrast, blacks retain detail.
--ar 1200:630
```

**Negative prompt**

```
text, letters, words, numbers, typography, wordmark, watermark, signature, scoreboard digits,
advertising hoardings, sponsor boards, LED perimeter ads, logo, brand marks, real club crests,
real stadium architecture, recognisable arena, heraldry, real people, faces, players, cartoon,
clip art, bright saturated green grass, daylight, sunset orange sky, teal-and-orange grade,
rainbow, fireworks, confetti, lens flare, bloom haze, crowd faces, busy clutter, border, frame,
UI mockup, jpeg artifacts, banding
```

**Post-processing.** Crop to exactly 1200×630. Apply a `#050607` scrim over the left half
(0% at 55% width → 55% at 0% width) so the wordmark can be set on glass in post. Set the wordmark
and the volt rail **in a design tool, never in the generator**. Export JPEG q78 progressive, strip
EXIF, verify ≤60 KB.

**Acceptance.** ☐ Left 40% of the frame has no detail that would fight overlaid type.
☐ No legible signage anywhere, including in the bokeh. ☐ Stadium is not recognisable as any real
ground. ☐ Volt pixels under 3%. ☐ ≤60 KB.

---

## 4. P1 — high player-visible

All P1 image overrides live under `apps/game/public/art/…` and are served from `/art/…`. Each has a
procedural component behind it (§8.2).

### B1 — Title hero scene raster

**Purpose / where.** Optional painted upgrade over `HeroScene variant="title"` on TitleScreen and
onboarding. The procedural version is the fallback and stays shipped.
**Destination.** `apps/game/public/art/heroes/title-stadium.webp` — WebP, 1179×2556, **≤300 KB**.

```
A tall vertical cinematic plate of a fictional football stadium at dusk, viewed from a high seat
behind the goal, 35mm lens, deep depth of field. The far stand is a smooth parabolic bowl whose
rim sits about 42% down the frame at centre and rises toward both edges; the seating reads as
banded geometry, not individual seats. Four slim floodlight masts crown the far rim, each casting
a cold blue-white #D6E8FF glow at low intensity with soft atmospheric haze and no visible beams.
Below the stands the pitch recedes as near-black desaturated green, #0A1410 into #0E1C16, with
white 16%-opacity line markings barely readable. The sky above is a four-stop graphite ramp,
#050607 at the top through #080D14 and #0A1119 and back to #050607 at the horizon. The crowd is
scattered cool bokeh points in #BED2EB and #8FA3BC, with a very small number of #C8FF2E points as
the only accent in the image, under 3% of the frame. The bottom third of the frame is quiet, dark
and almost featureless. Cold, expensive, empty, before anything has happened.
Premium broadcast-graphics art direction, dark glassmorphism, low-key lighting with deep falloff,
film-grade contrast, blacks retain detail and are never crushed, no object carries more than one
specular sheen, rendered CGI matte-painting quality, not photography.
--ar 1179:2556
```

**Negative prompt**

```
text, letters, words, numbers, typography, watermark, signature, scoreboard, advertising
hoardings, sponsor boards, LED perimeter ads, logo, brand marks, real club crests, real stadium
architecture, recognisable arena, roof trusses in a famous shape, heraldry, real people, faces,
players on the pitch, cartoon, clip art, bright saturated green grass, daylight, sunset, orange
sky, teal-and-orange grade, rainbow, fireworks, confetti, pyrotechnics, lens flare, visible light
beams, bloom haze, crowd faces, busy clutter, border, frame, vignette ring, UI mockup, banding
```

**Post-processing.** Crop to 1179×2556 (do not letterbox — the component crops, never letterboxes).
Multiply a `#050607` bottom scrim, 0% at 45% height → 62% at the bottom. Verify the top 12% is dark
enough for a status bar. `cwebp -q 82 -m 6`.

**Acceptance.** ☐ Readable as "stadium at dusk" at 20% zoom. ☐ No legible signage or digits.
☐ Volt pixels under 3%. ☐ Bottom 25% has enough contrast headroom for `#9AA3AD` text on glass.
☐ ≤300 KB.

---

### B2 — Triumph result backdrop

**Purpose / where.** Optional upgrade over `HeroScene variant="triumph"` behind MatchResultScreen
and the season summary after a win. Same room as B1, warmer light, rays.
**Destination.** `apps/game/public/art/heroes/result-triumph.webp` — WebP, 1179×2556, ≤300 KB.

```
The same fictional football stadium at dusk seen from a high seat behind the goal, 35mm lens, but
now warm and one stop brighter — never bright. The far stand is a smooth parabolic bowl with its
rim about 42% down the frame at centre, rising toward the edges; seating reads as banded geometry.
Four floodlight masts on the far rim throw a warm gold #FFD76A glow at low intensity through soft
haze. Broad, soft upward light rays fan from behind the far stand into the graphite sky, low
contrast and diffuse. The sky is a four-stop ramp #07070A → #141007 → #1A1309 → #07060A. The pitch
below glows faintly gold-touched over near-black desaturated green #0A1410–#0E1C16, white markings
at 16% opacity. Crowd bokeh is warm: #FFD76A and #FFF0C4 points with a scattering of #C8FF2E, the
accent staying under 3% of the frame. Elated but restrained; the gold does the work a confetti
cannon would. Premium broadcast-graphics art direction, dark glassmorphism, low-key lighting with
deep falloff, film-grade contrast, blacks retain detail, rendered CGI matte-painting quality.
--ar 1179:2556
```

**Negative prompt**

```
text, letters, words, numbers, typography, watermark, signature, scoreboard, advertising
hoardings, sponsor boards, logo, brand marks, real club crests, real stadium architecture,
recognisable arena, heraldry, real people, faces, players, trophy in frame, cartoon, clip art,
bright saturated green grass, daylight, orange sunset sky, teal-and-orange grade, rainbow,
fireworks, pyrotechnics, confetti, streamers, ticker tape, god rays with hard edges, lens flare,
bloom haze, crowd faces, busy clutter, border, frame, UI mockup, banding
```

**Post-processing.** Crop to 1179×2556. Multiply a `#050607` bottom scrim, 0% at 45% height →
62% at the bottom. Desaturate the gold by ~10% if it reads
as orange — the target is `#FFD76A`, not amber. `cwebp -q 82 -m 6`.

**Acceptance.** ☐ Recognisably the *same ground* as B1 (bowl shape and mast positions match).
☐ Rays are diffuse, no hard-edged shafts. ☐ Volt under 3%. ☐ No confetti or pyro. ☐ ≤300 KB.

---

### B3 — Consolation result backdrop

**Purpose / where.** Optional upgrade over `HeroScene variant="consolation"` after a defeat. Muted,
not sad — the screen still has to be readable by somebody who is annoyed.
**Destination.** `apps/game/public/art/heroes/result-consolation.webp` — WebP, 1179×2556, ≤300 KB.

```
The same fictional football stadium at dusk from the same high seat behind the goal, 35mm lens,
now cooler, dimmer and emptied out. The parabolic far stand sits with its rim about 42% down the
frame at centre; seating reads as banded geometry. Four floodlight masts throw a cold, weak
#9EB2C8 light at very low intensity. Fine rain falls through the light as soft grey streaks,
suggested rather than drawn, catching only faintly near the masts. The sky is a four-stop ramp
#04060A → #080C12 → #0A1016 → #04060A. The pitch is near-black desaturated green #0A1410–#0E1C16
with a wet sheen and white markings at 16% opacity. Crowd bokeh has lost its warmth entirely:
#7E8DA0, #5C6675 and #93A3B8 points, thinner and more scattered than a full house. A single very
faint indigo #7C8CFF rim line along the near touchline is the only accent, under 2% of the frame.
Quiet, cold, over. Premium broadcast-graphics art direction, dark glassmorphism, low-key lighting
with deep falloff, film-grade contrast, blacks retain detail, rendered CGI matte-painting quality.
--ar 1179:2556
```

**Negative prompt**

```
text, letters, words, numbers, typography, watermark, signature, scoreboard, advertising
hoardings, sponsor boards, logo, brand marks, real club crests, real stadium architecture,
recognisable arena, heraldry, real people, faces, players, dejected figures, cartoon, clip art,
melodrama, heavy storm, lightning, puddle reflections of a skyline, bright saturated green grass,
daylight, teal-and-orange grade, rainbow, lens flare, bloom haze, crowd faces, busy clutter,
border, frame, UI mockup, banding, motion blur streaks across the whole frame
```

**Post-processing.** Crop to 1179×2556. Multiply a `#050607` bottom scrim, 0% at 45% height →
50% at the bottom — lighter than the other two hero plates, because this one is already dark and
over-scrimming turns it to mud. `cwebp -q 82 -m 6`.

**Acceptance.** ☐ Same ground geometry as B1/B2. ☐ Rain is visible but never the subject.
☐ No volt anywhere; the only accent is indigo. ☐ `#F4F6F8` text on glass still passes 7:1 over the
brightest region. ☐ ≤300 KB.

---

### B4 — Trophy hero renders ×5

Optional painted upgrades over the five hand-authored SVGs in `design/domain/silverware.tsx`, used
at hero scale only (TrophyMoment, the trophy room). The SVGs remain the source of truth for lists
and small sizes — a render must **agree with the silhouette**, not reinterpret it. All five sit on
the same 100×132 box with a two-tier plinth occupying the bottom quarter and a recessed dark
engraving band across it, and all five are lit from the upper left with exactly one sheen. The five
entries below are independent: each carries its whole prompt, its own destination and its own
checks, and none of them needs anything from its neighbours.

---

#### B4a — League chalice

**Purpose / where.** Optional painted upgrade over the `league` SVG in
`design/domain/silverware.tsx`, at hero scale only (TrophyMoment, the trophy room). The SVG stays
the source of truth for lists and anything under 34 px; this render must agree with its silhouette,
not reinterpret it. The piece sits on the shared 100×132 box with a two-tier plinth in the bottom
quarter and a recessed dark engraving band across it, lit from the upper left with exactly one
sheen.
**Destination.** `apps/game/public/art/trophies/league.webp` — WebP with alpha, 600×792 (the 100:132
box at 6×), **≤120 KB**.

```
A single fictional gold trophy, centred, isolated on a fully transparent background, lit from the
upper left by one cool key light with one soft fill. The trophy is a tall fluted chalice: a wide
flared bowl tapering to a rounded base, three shallow vertical flutes running down its face, a
bright horizontal rim band across the top that is the brightest element on the piece, and two long
swept handles that arc outward from just below the rim and curl back in at the bowl's waist. Below
the bowl, a short stem, a flattened spherical knop, and a tapered foot onto the plinth. The metal
is a spun gold with a six-stop ramp: #7A5716 in the shadow, #B8862B on the turn, #FFD76A on the lit
face, #FFF0C4 at the hot core, #D8A441 cooling, #8A6320 at the far edge. Exactly one specular sheen
runs down the upper-left flank of the piece; there is no second highlight anywhere. The trophy
stands on a two-tier dark graphite plinth, #14171B over #0E1013, with a recessed near-black
engraving band across its front carrying two blank ruled lines and one tiny electric-lime #C8FF2E
tick at the right end — the only non-gold colour in the image, under 1% of the frame. Vertical
composition, the piece filling about 80% of the frame height above the plinth. Premium
broadcast-graphics art direction, product-render lighting, film-grade contrast, no environment, no
floor, no reflection.
--ar 25:33
```

**Negative prompt**

```
text, letters, words, numbers, engraved names, dates, typography, watermark, signature, logo,
brand marks, sponsor marks, real trophy, recognisable trophy, replica of an existing cup, real
club crests, heraldry, lions, eagles, crowns, wreaths, laurel, ribbons, real people, faces,
figurines, hands holding, cartoon, clip art, plastic, chrome, silver, rose gold, brass, copper,
rust, tarnish, marble, wood, background, environment, table, pedestal room, stadium behind,
floor reflection, mirror reflection, cast shadow, drop shadow, multiple highlights, rim light,
bokeh, sparkles, glitter, confetti, gem stones, diamonds, second trophy, group of trophies
```

**Post-processing.** Remove background to true alpha (matte the gold edges — gold on transparent
fringes green if the matte is sloppy). Scale so the plinth's base sits on the bottom edge of the
600×792 box and the piece is horizontally centred. **Overlay the `league` SVG at 30% opacity and
check the silhouettes align within ~4% before accepting.** `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Silhouette matches the `league` SVG within ~4%. ☐ Exactly one sheen.
☐ Volt appears once, as a tick on the engraving band, under 1% of pixels. ☐ Zero engraved glyphs.
☐ Alpha is clean at 100% zoom, no green fringe. ☐ ≤120 KB.

---

#### B4b — Cup

**Purpose / where.** Optional painted upgrade over the `cup` SVG in
`design/domain/silverware.tsx`, at hero scale only (TrophyMoment, the trophy room). The SVG stays
the source of truth for lists and anything under 34 px; this render must agree with its silhouette,
not reinterpret it. The piece sits on the shared 100×132 box with a two-tier plinth in the bottom
quarter and a recessed dark engraving band across it, lit from the upper left with exactly one
sheen.
**Destination.** `apps/game/public/art/trophies/cup.webp` — WebP with alpha, 600×792 (the 100:132
box at 6×), **≤120 KB**.

```
A single fictional gold trophy, centred, isolated on a fully transparent background, lit from the
upper left by one cool key light with one soft fill. The trophy is squat, wide and lidded: a
shallow broad bowl, a domed lid above a bright horizontal collar, and a small spherical finial on a
short post at the very top. Two closed vertical ring handles sit on either side, taller than they
are wide, passing behind the bowl's edge. A recessed dark rectangular panel crosses the bowl's face
with one blank ruled line, and a faint eight-point star is embossed low on the bowl. Short stem,
tapered foot onto the plinth. The metal is a spun gold with a six-stop ramp: #7A5716 in the shadow,
#B8862B on the turn, #FFD76A on the lit face, #FFF0C4 at the hot core, #D8A441 cooling, #8A6320 at
the far edge. Exactly one specular sheen runs down the upper-left flank of the piece; there is no
second highlight anywhere. The trophy stands on a two-tier dark graphite plinth, #14171B over
#0E1013, with a recessed near-black engraving band across its front carrying two blank ruled lines
and one tiny electric-lime #C8FF2E tick at the right end — the only non-gold colour in the image,
under 1% of the frame. Vertical composition, the piece filling about 80% of the frame height above
the plinth. Premium broadcast-graphics art direction, product-render lighting, film-grade contrast,
no environment, no floor, no reflection.
--ar 25:33
```

**Negative prompt**

```
text, letters, words, numbers, engraved names, dates, typography, watermark, signature, logo,
brand marks, sponsor marks, real trophy, recognisable trophy, replica of an existing cup, real
club crests, heraldry, lions, eagles, crowns, wreaths, laurel, ribbons, real people, faces,
figurines, hands holding, cartoon, clip art, plastic, chrome, silver, rose gold, brass, copper,
rust, tarnish, marble, wood, background, environment, table, pedestal room, stadium behind,
floor reflection, mirror reflection, cast shadow, drop shadow, multiple highlights, rim light,
bokeh, sparkles, glitter, confetti, gem stones, diamonds, second trophy, group of trophies
```

**Post-processing.** Remove background to true alpha (matte the gold edges — gold on transparent
fringes green if the matte is sloppy). Scale so the plinth's base sits on the bottom edge of the
600×792 box and the piece is horizontally centred. **Overlay the `cup` SVG at 30% opacity and
check the silhouettes align within ~4% before accepting.** `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Silhouette matches the `cup` SVG within ~4%. ☐ Exactly one sheen.
☐ Volt appears once, as a tick on the engraving band, under 1% of pixels. ☐ Zero engraved glyphs
(the embossed star is a shape, not a mark). ☐ Alpha is clean at 100% zoom, no green fringe.
☐ ≤120 KB.

---

#### B4c — Super cup salver

**Purpose / where.** Optional painted upgrade over the `superCup` SVG in
`design/domain/silverware.tsx`, at hero scale only (TrophyMoment, the trophy room). The SVG stays
the source of truth for lists and anything under 34 px; this render must agree with its silhouette,
not reinterpret it. The piece sits on the shared 100×132 box with a two-tier plinth in the bottom
quarter and a recessed dark engraving band across it, lit from the upper left with exactly one
sheen.
**Destination.** `apps/game/public/art/trophies/super-cup.webp` — WebP with alpha, 600×792 (the
100:132 box at 6×), **≤120 KB**. Note the kebab-case filename; `superCup.webp` is not an override.

```
A single fictional gold trophy, centred, isolated on a fully transparent background, lit from the
upper left by one cool key light with one soft fill. The piece is not a cup at all: a broad
shield-shaped salver on a low stand. The shield is wide at the shoulders, straight-sided, and
sweeps to a rounded point at the bottom. Its face is recessed dark, and a geometric radial star
with eight straight bars sits at its centre, with a small dark circle at the hub and a tiny
electric-lime dot at the very middle. A blank recessed nameplate crosses the shield low down. The
shield sits on a short square post and a tapered foot onto the plinth. The metal is a spun gold
with a six-stop ramp: #7A5716 in the shadow, #B8862B on the turn, #FFD76A on the lit face, #FFF0C4
at the hot core, #D8A441 cooling, #8A6320 at the far edge. Exactly one specular sheen runs down the
upper-left flank of the piece; there is no second highlight anywhere. The salver stands on a
two-tier dark graphite plinth, #14171B over #0E1013, with a recessed near-black engraving band
across its front carrying two blank ruled lines and one tiny electric-lime #C8FF2E tick at the
right end — the volt at the star's hub and this tick are the only non-gold colour in the image,
together under 1% of the frame. Vertical composition, the piece filling about 80% of the frame
height above the plinth. Premium broadcast-graphics art direction, product-render lighting,
film-grade contrast, no environment, no floor, no reflection.
--ar 25:33
```

**Negative prompt**

```
text, letters, words, numbers, engraved names, dates, typography, watermark, signature, logo,
brand marks, sponsor marks, real trophy, recognisable trophy, replica of an existing cup, real
club crests, heraldry, lions, eagles, crowns, wreaths, laurel, ribbons, real people, faces,
figurines, hands holding, cartoon, clip art, plastic, chrome, silver, rose gold, brass, copper,
rust, tarnish, marble, wood, background, environment, table, pedestal room, stadium behind,
floor reflection, mirror reflection, cast shadow, drop shadow, multiple highlights, rim light,
bokeh, sparkles, glitter, confetti, gem stones, diamonds, second trophy, group of trophies
```

**Post-processing.** Remove background to true alpha (matte the gold edges — gold on transparent
fringes green if the matte is sloppy). Scale so the plinth's base sits on the bottom edge of the
600×792 box and the piece is horizontally centred. **Overlay the `superCup` SVG at 30% opacity and
check the silhouettes align within ~4% before accepting.** `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Silhouette matches the `superCup` SVG within ~4%. ☐ Exactly one sheen.
☐ Volt appears only at the star's hub and as the engraving tick, under 1% of pixels.
☐ Zero engraved glyphs — the nameplate is blank. ☐ The shield never reads as heraldry.
☐ Alpha is clean at 100% zoom, no green fringe. ☐ ≤120 KB.

---

#### B4d — Golden boot

**Purpose / where.** Optional painted upgrade over the `boot` SVG in
`design/domain/silverware.tsx`, at hero scale only (TrophyMoment, the trophy room). The SVG stays
the source of truth for lists and anything under 34 px; this render must agree with its silhouette,
not reinterpret it. The piece sits on the shared 100×132 box with a two-tier plinth in the bottom
quarter and a recessed dark engraving band across it, lit from the upper left with exactly one
sheen.
**Destination.** `apps/game/public/art/trophies/boot.webp` — WebP with alpha, 600×792 (the 100:132
box at 6×), **≤120 KB**.

```
A single fictional gold trophy, centred, isolated on a fully transparent background, lit from the
upper left by one cool key light with one soft fill. The trophy is a gold football boot mounted at
a fourteen-degree tilt on a slim vertical post. The boot is stylised and geometric — a smooth sole
plate, a clean low-cut upper, four straight lace bars across the instep, and four rounded studs
under the sole. No branding, no side stripes, no panel stitching. The post runs from the boot's
heel down to a tapered foot on the plinth. The metal is a spun gold with a six-stop ramp: #7A5716
in the shadow, #B8862B on the turn, #FFD76A on the lit face, #FFF0C4 at the hot core, #D8A441
cooling, #8A6320 at the far edge. Exactly one specular sheen runs down the upper-left flank of the
piece; there is no second highlight anywhere. The post stands on a two-tier dark graphite plinth,
#14171B over #0E1013, with a recessed near-black engraving band across its front carrying two blank
ruled lines and one tiny electric-lime #C8FF2E tick at the right end — the only non-gold colour in
the image, under 1% of the frame. Vertical composition, the piece filling about 80% of the frame
height above the plinth. Premium broadcast-graphics art direction, product-render lighting,
film-grade contrast, no environment, no floor, no reflection.
--ar 25:33
```

**Negative prompt**

```
text, letters, words, numbers, engraved names, dates, typography, watermark, signature, logo,
brand marks, sponsor marks, real trophy, recognisable trophy, replica of an existing cup, real
club crests, heraldry, lions, eagles, crowns, wreaths, laurel, ribbons, real people, faces,
figurines, hands holding, cartoon, clip art, plastic, chrome, silver, rose gold, brass, copper,
rust, tarnish, marble, wood, background, environment, table, pedestal room, stadium behind,
floor reflection, mirror reflection, cast shadow, drop shadow, multiple highlights, rim light,
bokeh, sparkles, glitter, confetti, gem stones, diamonds, second trophy, group of trophies,
real boot model, manufacturer stripes, swoosh, leather texture, laces tied in a bow, sock, foot
```

**Post-processing.** Remove background to true alpha (matte the gold edges — gold on transparent
fringes green if the matte is sloppy). Scale so the plinth's base sits on the bottom edge of the
600×792 box and the piece is horizontally centred. **Overlay the `boot` SVG at 30% opacity and
check the silhouettes align within ~4% before accepting** — the tilt angle is the thing that
drifts. `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Silhouette matches the `boot` SVG within ~4%, tilt included. ☐ Exactly one sheen.
☐ Volt appears once, as a tick on the engraving band, under 1% of pixels. ☐ Zero engraved glyphs
and no manufacturer marking of any kind. ☐ Alpha is clean at 100% zoom, no green fringe.
☐ ≤120 KB.

---

#### B4e — Legacy monolith

**Purpose / where.** Optional painted upgrade over the `legacy` SVG in
`design/domain/silverware.tsx`, at hero scale only (TrophyMoment, the trophy room). The SVG stays
the source of truth for lists and anything under 34 px; this render must agree with its silhouette,
not reinterpret it. The piece sits on the shared 100×132 box with a two-tier plinth in the bottom
quarter and a recessed dark engraving band across it, lit from the upper left with exactly one
sheen.
**Destination.** `apps/game/public/art/trophies/legacy.webp` — WebP with alpha, 600×792 (the
100:132 box at 6×), **≤120 KB**.

```
A single fictional gold trophy, centred, isolated on a fully transparent background, lit from the
upper left by one cool key light with one soft fill. The trophy is a tapered monolith: a four-sided
column, wider at the base than the top, with a faceted pyramidal cap. A recessed near-black panel
runs most of the column's height, and three five-pointed gold stars are stacked evenly up it, equal
in size. A bright horizontal collar crosses just above the plinth. Severe, counted, dynastic. The
metal is a spun gold with a six-stop ramp: #7A5716 in the shadow, #B8862B on the turn, #FFD76A on
the lit face, #FFF0C4 at the hot core, #D8A441 cooling, #8A6320 at the far edge. Exactly one
specular sheen runs down the upper-left flank of the piece; there is no second highlight anywhere.
The column stands on a two-tier dark graphite plinth, #14171B over #0E1013, with a recessed
near-black engraving band across its front carrying two blank ruled lines and one tiny
electric-lime #C8FF2E tick at the right end — the only non-gold colour in the image, under 1% of
the frame. Vertical composition, the piece filling about 80% of the frame height above the plinth.
Premium broadcast-graphics art direction, product-render lighting, film-grade contrast, no
environment, no floor, no reflection.
--ar 25:33
```

**Negative prompt**

```
text, letters, words, numbers, engraved names, dates, typography, watermark, signature, logo,
brand marks, sponsor marks, real trophy, recognisable trophy, replica of an existing cup, real
club crests, heraldry, lions, eagles, crowns, wreaths, laurel, ribbons, real people, faces,
figurines, hands holding, cartoon, clip art, plastic, chrome, silver, rose gold, brass, copper,
rust, tarnish, marble, wood, background, environment, table, pedestal room, stadium behind,
floor reflection, mirror reflection, cast shadow, drop shadow, multiple highlights, rim light,
bokeh, sparkles, glitter, confetti, gem stones, diamonds, second trophy, group of trophies,
obelisk with hieroglyphs, monument inscription, more or fewer than three stars
```

**Post-processing.** Remove background to true alpha (matte the gold edges — gold on transparent
fringes green if the matte is sloppy). Scale so the plinth's base sits on the bottom edge of the
600×792 box and the piece is horizontally centred. **Overlay the `legacy` SVG at 30% opacity and
check the silhouettes align within ~4% before accepting** — the taper is the thing that drifts.
`cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Silhouette matches the `legacy` SVG within ~4%. ☐ Exactly three stars, equal in
size and evenly stacked. ☐ Exactly one sheen. ☐ Volt appears once, as a tick on the engraving band,
under 1% of pixels. ☐ Zero engraved glyphs. ☐ Alpha is clean at 100% zoom, no green fringe.
☐ ≤120 KB.

---

### B5 — Legendary foil tile (seamless)

**Purpose / where.** Optional texture override for `CardFoil` / `.cf-foil` on the legendary
PlayerCard variant. The CSS gradient version stays and is what renders under reduced transparency.
**Destination.** `apps/game/public/art/textures/foil-legendary.webp` — WebP, **seamless** 512×512,
≤48 KB. Composited at low opacity (≤12%) in `screen` blend, so the tile is authored bright.

```
A seamless tileable texture of printed trading-card foil, flat to camera, no perspective. Two
families of fine parallel bands cross at different pitches and angles — one set at about 18
degrees with a narrow pitch, one at about 72 degrees with a wider pitch — beating into a soft
moiré interference the way real foil does. Over them, one very slow conic hue sweep shifts the
colour through cool violet #A78BFA, gold #FFD76A and a whisper of electric lime #C8FF2E, all at
low saturation. Everything sits on a near-black graphite ground #0E1013. The whole texture is
low-contrast and subtle; the brightest band is only slightly brighter than the ground. Even
distribution, no focal point, no centre, no hotspot, edges continue cleanly on all four sides.
Premium broadcast-graphics art direction, film-grade contrast, blacks retain detail, rendered
material study, not photography.
--ar 1:1 --tile
```

**Negative prompt**

```
text, letters, numbers, watermark, signature, logo, brand marks, holographic sticker, rainbow
prism, full-spectrum rainbow, oil slick, soap bubble, saturated colours, neon, glitter, sparkles,
star flares, sequins, crumpled foil, wrinkles, creases, folds, scratches, dust, fingerprints,
photographic paper texture, fabric weave, carbon fibre, hexagon pattern, centre hotspot, vignette,
seam, visible tile edge, border, frame, perspective, depth of field, blur, noise, banding
```

**Post-processing.** Verify tiling with a 3×3 offset test; heal any seam by hand. Clamp the
histogram so no pixel exceeds ~65% luminance (the card composite adds the rest). `cwebp -q 88`.

**Acceptance.** ☐ 3×3 tile shows no seam and no repeating hotspot. ☐ No pixel above ~65% luma.
☐ Reads as interference, not as rainbow. ☐ Under a 12%-opacity screen composite it is visible but
never competes with the portrait. ☐ ≤48 KB.

---

### B6 — Club-reveal celebration kit

`HeroReveal` at the end of club creation — the payoff for the customiser. This is the one P1 item
ASSET_PLAN §6 still lists as genuinely absent. The kit is **two plates plus one SFX**: the burst
(B6a) and the motes (B6b) below, plus **D6 Signing sting**, which the reveal reuses unchanged. The
crest itself is always the procedural `ClubBadge` composited on top at runtime, never generated
(§7). Both plates are composited with `screen`, so they are authored bright on true alpha.

---

#### B6a — Reveal burst plate

**Purpose / where.** The radial ray plate behind the crest in `HeroReveal`, scaled and rotated at
runtime. Optional: without it the reveal falls back to the existing rays + crossfade. The
procedural `ClubBadge` lands in the centre of this plate, so the middle of the frame must be
completely empty.
**Destination.** `apps/game/public/art/heroes/reveal-burst.webp` — WebP with alpha, 1024×1024,
**≤90 KB**.

```
A radial light burst isolated on a fully transparent background, centred, with a completely empty
hole in the middle about 34% of the frame's width where nothing is drawn. From the edge of that
hole, twelve soft tapered rays of light fan outward to the frame edges, alternating long and
short, each fading to nothing before it arrives. The rays are cool white #F4F6F8 at their base
falling to #9AA3AD, with three of the twelve tinted electric lime #C8FF2E at low opacity as the
only accent, under 3% of the frame. A faint circular haze ring surrounds the hole. Everything is
soft-edged, diffuse and low contrast; no ray has a hard boundary. Premium broadcast-graphics art
direction, dark glassmorphism palette, film-grade contrast, blacks retain detail, rendered CGI
quality, not photography.
--ar 1:1
```

**Negative prompt**

```
text, letters, numbers, typography, watermark, signature, logo, brand marks, crest, badge, shield,
emblem, heraldry, real club crests, real people, faces, silhouettes, cartoon, clip art, fireworks,
pyrotechnics, sparks, confetti, streamers, ticker tape, glitter, star shapes, cross flares, lens
flare, anamorphic streak, chromatic aberration, rainbow, saturated colours, hard-edged rays,
god rays through clouds, sun, background, sky, environment, solid background, black background,
white background, border, frame, vignette
```

**Post-processing.** Remove background to true alpha; confirm the central hole is fully transparent
(the crest lands there). Premultiply nothing — the runtime composites with `screen`.
`cwebp -q 88 -alpha_q 100`.

**Acceptance.** ☐ Burst centre is 100% transparent across a 340 px-wide circle. ☐ No ray has a hard
edge at 200% zoom. ☐ Volt under 3%. ☐ Survives being rotated arbitrarily without revealing a seam
or a corner. ☐ Absent, the reveal still plays as rays + crossfade. ☐ ≤90 KB.

---

#### B6b — Reveal motes plate

**Purpose / where.** The drifting light-mote layer in `HeroReveal`, one layer, parallaxed over the
burst. Optional: without it the reveal falls back to the existing rays + crossfade. Composited with
`screen` at low opacity, so it is authored bright on true alpha.
**Destination.** `apps/game/public/art/heroes/reveal-motes.webp` — WebP with alpha, 1024×1024,
**≤60 KB**.

```
A scatter of soft out-of-focus light motes isolated on a fully transparent background, evenly
distributed with no cluster and no centre. About forty circular bokeh points at varying sizes from
tiny to medium, all very soft-edged, in cool white #F4F6F8 and muted #9AA3AD at low opacity, with
four or five motes tinted electric lime #C8FF2E as the only accent, under 3% of the frame. No mote
is fully opaque. No streaks, no trails, no shapes other than circles. Premium broadcast-graphics
art direction, dark glassmorphism palette, film-grade contrast, blacks retain detail, rendered CGI
quality, not photography.
--ar 1:1
```

**Negative prompt**

```
text, letters, numbers, typography, watermark, signature, logo, brand marks, crest, badge, shield,
emblem, heraldry, real club crests, real people, faces, silhouettes, cartoon, clip art, fireworks,
pyrotechnics, sparks, confetti, streamers, ticker tape, glitter, star shapes, cross flares, lens
flare, anamorphic streak, chromatic aberration, rainbow, saturated colours, hard-edged rays,
god rays through clouds, sun, background, sky, environment, solid background, black background,
white background, border, frame, vignette
```

**Post-processing.** Remove background to true alpha. Premultiply nothing — the runtime composites
with `screen`. Check the distribution by tiling the plate against itself: no cluster may read as a
shape. `cwebp -q 88 -alpha_q 100`.

**Acceptance.** ☐ Motes are evenly distributed with no cluster and no centre. ☐ No mote is fully
opaque. ☐ Volt under 3%. ☐ Survives being rotated and parallaxed arbitrarily without revealing a
seam or a corner. ☐ Absent, the reveal still plays as rays + crossfade. ☐ ≤60 KB.

---

### B7 — Editorial news illustration plates ×5

Optional painted upgrades over the five inline motifs in `StoryArt` (`design/domain/feed.tsx`):
transfer, injury, rivalry, fans, result. They sit on a 200×100 plate behind the seeded colour bands
at the head of a lead feed story and are seen at roughly 28 px tall in a list, so **each must read
as one shape at thumbnail size**. The story's seeded accent colour is applied at runtime, so exactly
one element per plate is generated in a neutral light tone the app can tint, and all five must share
one stroke weight so they read as a set. The five entries below are independent: each carries its
whole prompt, its own destination and its own checks.

---

#### B7a — Transfer plate

**Purpose / where.** Optional painted upgrade over the `transfer` motif in `StoryArt`
(`design/domain/feed.tsx`). It sits on a 200×100 plate behind the seeded colour bands at the head
of a lead feed story and is seen at roughly 28 px tall in a list — **so it must read as one shape
at thumbnail size**. The story's seeded accent colour is applied at runtime, so exactly one
element is generated in a neutral light tone the app can tint, and its stroke weight must match
the other four plates in the set (transfer, injury, rivalry, fans, result).
**Destination.** `apps/game/public/art/stories/transfer.webp` — WebP with alpha, 800×400 (the
200×100 plate at 4×), **≤40 KB**.

```
A single editorial pictogram, isolated on a fully transparent background, centred, occupying about
70% of a 2:1 landscape frame. The drawing is a contract sheet with a folded top-right corner,
three short ruled text lines across its body, and a fountain pen crossing it diagonally from the
upper right. The heavier neutral stroke is the looping signature scrawled across the lower part of
the sheet. Drawn as clean geometric line work of uniform weight — strokes about 2 units on a
100-unit grid — with round caps and round joins, no fill, no shading, no gradient, no perspective.
Lines are ink #F4F6F8 at high opacity for the structure and muted #9AA3AD at low opacity for
secondary detail; exactly one element in the drawing is picked out in a slightly heavier stroke in
pale neutral #E8ECEF, which will be recoloured later. Node count is deliberately low: the whole
drawing is under a dozen strokes. Premium broadcast-graphics art direction, editorial pictogram,
reads as one silhouette at thumbnail size.
--ar 2:1
```

**Negative prompt**

```
text, letters, words, numbers, digits, scoreline, typography, watermark, signature as typography,
logo, brand marks, real club crests, heraldry, lions, eagles, crowns, real people, faces, hands,
bodies, crowd, cartoon, mascot, anime, 3D render, isometric, shading, gradient, drop shadow,
fill colour, colour, saturated colour, thick black outlines, sketchy hand-drawn line, variable
stroke weight, calligraphy, background, solid background, white background, border, frame, circle
badge behind the icon, busy detail, more than a dozen strokes, perspective, depth
```

**Post-processing.** Remove background to true alpha. Normalise the stroke weight against the
other four plates in the set so all five read as one family (overlay them and compare), and scale
this plate to occupy the same optical area as the others. `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Reads unmistakably as "a deal was signed" at 28 px tall. ☐ The ruled lines are
ruled marks, never letters. ☐ Stroke weight matches the other four plates in the set. ☐ Exactly
one element is in the recolourable neutral #E8ECEF. ☐ No text, digits or crest. ☐ ≤40 KB.

---

#### B7b — Injury plate

**Purpose / where.** Optional painted upgrade over the `injury` motif in `StoryArt`
(`design/domain/feed.tsx`). It sits on a 200×100 plate behind the seeded colour bands at the head
of a lead feed story and is seen at roughly 28 px tall in a list — **so it must read as one shape
at thumbnail size**. The story's seeded accent colour is applied at runtime, so exactly one
element is generated in a neutral light tone the app can tint, and its stroke weight must match
the other four plates in the set (transfer, injury, rivalry, fans, result).
**Destination.** `apps/game/public/art/stories/injury.webp` — WebP with alpha, 800×400 (the
200×100 plate at 4×), **≤40 KB**.

```
A single editorial pictogram, isolated on a fully transparent background, centred, occupying about
70% of a 2:1 landscape frame. The drawing is a thick medical cross, and a horizontal heartbeat
trace running straight through it from edge to edge. The heavier neutral stroke is the trace
itself, which spikes once and then flatlines toward the right. Drawn as clean geometric line work
of uniform weight — strokes about 2 units on a 100-unit grid — with round caps and round joins, no
fill, no shading, no gradient, no perspective. Lines are ink #F4F6F8 at high opacity for the
structure and muted #9AA3AD at low opacity for secondary detail; exactly one element in the
drawing is picked out in a slightly heavier stroke in pale neutral #E8ECEF, which will be
recoloured later. Node count is deliberately low: the whole drawing is under a dozen strokes.
Premium broadcast-graphics art direction, editorial pictogram, reads as one silhouette at
thumbnail size.
--ar 2:1
```

**Negative prompt**

```
text, letters, words, numbers, digits, scoreline, typography, watermark, signature as typography,
logo, brand marks, real club crests, heraldry, lions, eagles, crowns, real people, faces, hands,
bodies, crowd, cartoon, mascot, anime, 3D render, isometric, shading, gradient, drop shadow,
fill colour, colour, saturated colour, thick black outlines, sketchy hand-drawn line, variable
stroke weight, calligraphy, background, solid background, white background, border, frame, circle
badge behind the icon, busy detail, more than a dozen strokes, perspective, depth
```

**Post-processing.** Remove background to true alpha. Normalise the stroke weight against the
other four plates in the set so all five read as one family (overlay them and compare), and scale
this plate to occupy the same optical area as the others. `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Reads unmistakably as "injury" at 28 px tall. ☐ The trace spikes exactly once,
then flatlines. ☐ Stroke weight matches the other four plates in the set. ☐ Exactly one element is
in the recolourable neutral #E8ECEF. ☐ No text, digits or crest. ☐ ≤40 KB.

---

#### B7c — Rivalry plate

**Purpose / where.** Optional painted upgrade over the `rivalry` motif in `StoryArt`
(`design/domain/feed.tsx`). It sits on a 200×100 plate behind the seeded colour bands at the head
of a lead feed story and is seen at roughly 28 px tall in a list — **so it must read as one shape
at thumbnail size**. The story's seeded accent colour is applied at runtime, so exactly one
element is generated in a neutral light tone the app can tint, and its stroke weight must match
the other four plates in the set (transfer, injury, rivalry, fans, result).
**Destination.** `apps/game/public/art/stories/rivalry.webp` — WebP with alpha, 800×400 (the
200×100 plate at 4×), **≤40 KB**.

```
A single editorial pictogram, isolated on a fully transparent background, centred, occupying about
70% of a 2:1 landscape frame. The drawing is two simplified shield outlines turned away from each
other, one tilted slightly left and one slightly right, with a clear empty gap between them. The
heavier neutral stroke is a lightning bolt filling that gap vertically. Drawn as clean geometric
line work of uniform weight — strokes about 2 units on a 100-unit grid — with round caps and round
joins, no fill, no shading, no gradient, no perspective. Lines are ink #F4F6F8 at high opacity for
the structure and muted #9AA3AD at low opacity for secondary detail; exactly one element in the
drawing is picked out in a slightly heavier stroke in pale neutral #E8ECEF, which will be
recoloured later. Node count is deliberately low: the whole drawing is under a dozen strokes.
Premium broadcast-graphics art direction, editorial pictogram, reads as one silhouette at
thumbnail size.
--ar 2:1
```

**Negative prompt**

```
text, letters, words, numbers, digits, scoreline, typography, watermark, signature as typography,
logo, brand marks, real club crests, heraldry, lions, eagles, crowns, real people, faces, hands,
bodies, crowd, cartoon, mascot, anime, 3D render, isometric, shading, gradient, drop shadow,
fill colour, colour, saturated colour, thick black outlines, sketchy hand-drawn line, variable
stroke weight, calligraphy, background, solid background, white background, border, frame, circle
badge behind the icon, busy detail, more than a dozen strokes, perspective, depth
```

**Post-processing.** Remove background to true alpha. Normalise the stroke weight against the
other four plates in the set so all five read as one family (overlay them and compare), and scale
this plate to occupy the same optical area as the others. `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Reads unmistakably as "two sides, one grudge" at 28 px tall. ☐ Both shields are
blank outlines — no device, no charge, nothing heraldic. ☐ Stroke weight matches the other four
plates in the set. ☐ Exactly one element is in the recolourable neutral #E8ECEF. ☐ No text, digits
or crest. ☐ ≤40 KB.

---

#### B7d — Fans plate

**Purpose / where.** Optional painted upgrade over the `fans` motif in `StoryArt`
(`design/domain/feed.tsx`). It sits on a 200×100 plate behind the seeded colour bands at the head
of a lead feed story and is seen at roughly 28 px tall in a list — **so it must read as one shape
at thumbnail size**. The story's seeded accent colour is applied at runtime, so exactly one
element is generated in a neutral light tone the app can tint, and its stroke weight must match
the other four plates in the set (transfer, injury, rivalry, fans, result).
**Destination.** `apps/game/public/art/stories/fans.webp` — WebP with alpha, 800×400 (the 200×100
plate at 4×), **≤40 KB**.

```
A single editorial pictogram, isolated on a fully transparent background, centred, occupying about
70% of a 2:1 landscape frame. The drawing is a supporters' scarf held taut and overhead, drawn as
two arcing bands with four short fringe strokes hanging beneath, and behind it a rectangular flag
on a vertical pole. The heavier neutral stroke is the flag. Drawn as clean geometric line work of
uniform weight — strokes about 2 units on a 100-unit grid — with round caps and round joins, no
fill, no shading, no gradient, no perspective. Lines are ink #F4F6F8 at high opacity for the
structure and muted #9AA3AD at low opacity for secondary detail; exactly one element in the
drawing is picked out in a slightly heavier stroke in pale neutral #E8ECEF, which will be
recoloured later. Node count is deliberately low: the whole drawing is under a dozen strokes.
Premium broadcast-graphics art direction, editorial pictogram, reads as one silhouette at
thumbnail size.
--ar 2:1
```

**Negative prompt**

```
text, letters, words, numbers, digits, scoreline, typography, watermark, signature as typography,
logo, brand marks, real club crests, heraldry, lions, eagles, crowns, real people, faces, hands,
bodies, crowd, cartoon, mascot, anime, 3D render, isometric, shading, gradient, drop shadow,
fill colour, colour, saturated colour, thick black outlines, sketchy hand-drawn line, variable
stroke weight, calligraphy, background, solid background, white background, border, frame, circle
badge behind the icon, busy detail, more than a dozen strokes, perspective, depth
```

**Post-processing.** Remove background to true alpha. Normalise the stroke weight against the
other four plates in the set so all five read as one family (overlay them and compare), and scale
this plate to occupy the same optical area as the others. `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Reads unmistakably as "supporters" at 28 px tall. ☐ Scarf and flag are blank —
no stripes, no mark. ☐ Stroke weight matches the other four plates in the set. ☐ Exactly one
element is in the recolourable neutral #E8ECEF. ☐ No text, digits or crest. ☐ ≤40 KB.

---

#### B7e — Result plate

**Purpose / where.** Optional painted upgrade over the `result` motif in `StoryArt`
(`design/domain/feed.tsx`). It sits on a 200×100 plate behind the seeded colour bands at the head
of a lead feed story and is seen at roughly 28 px tall in a list — **so it must read as one shape
at thumbnail size**. The story's seeded accent colour is applied at runtime, so exactly one
element is generated in a neutral light tone the app can tint, and its stroke weight must match
the other four plates in the set (transfer, injury, rivalry, fans, result).
**Destination.** `apps/game/public/art/stories/result.webp` — WebP with alpha, 800×400 (the
200×100 plate at 4×), **≤40 KB**.

```
A single editorial pictogram, isolated on a fully transparent background, centred, occupying about
70% of a 2:1 landscape frame. The drawing is a rounded scoreboard panel containing two blank
rounded plates side by side with a short dash between them — no digits. Six short rays burst
outward from the panel's corners and top. The heavier neutral stroke is the right-hand plate and
the rays. Drawn as clean geometric line work of uniform weight — strokes about 2 units on a
100-unit grid — with round caps and round joins, no fill, no shading, no gradient, no perspective.
Lines are ink #F4F6F8 at high opacity for the structure and muted #9AA3AD at low opacity for
secondary detail; exactly one element in the drawing is picked out in a slightly heavier stroke in
pale neutral #E8ECEF, which will be recoloured later. Node count is deliberately low: the whole
drawing is under a dozen strokes. Premium broadcast-graphics art direction, editorial pictogram,
reads as one silhouette at thumbnail size.
--ar 2:1
```

**Negative prompt**

```
text, letters, words, numbers, digits, scoreline, typography, watermark, signature as typography,
logo, brand marks, real club crests, heraldry, lions, eagles, crowns, real people, faces, hands,
bodies, crowd, cartoon, mascot, anime, 3D render, isometric, shading, gradient, drop shadow,
fill colour, colour, saturated colour, thick black outlines, sketchy hand-drawn line, variable
stroke weight, calligraphy, background, solid background, white background, border, frame, circle
badge behind the icon, busy detail, more than a dozen strokes, perspective, depth
```

**Post-processing.** Remove background to true alpha. Normalise the stroke weight against the
other four plates in the set so all five read as one family (overlay them and compare), and scale
this plate to occupy the same optical area as the others. `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Reads unmistakably as "a result came in" at 28 px tall. ☐ Zero digits anywhere —
both plates are blank. ☐ Stroke weight matches the other four plates in the set. ☐ Exactly one
element is in the recolourable neutral #E8ECEF. ☐ No text, digits or crest. ☐ ≤40 KB.

---

### B8 — Website device-mockup scene

**Purpose / where.** The hero band on `website/index.html`. Note the split: the **device shell and
environment** may be generated; the **screen content must be a real capture of the build** (§7).
**Destination.** `website/hero-devices.webp` — WebP, 2400×1350, ≤220 KB. Screens composited in post.

```
Three blank modern smartphones floating in a dark studio void, arranged in a loose overlapping
fan: one centred and face-on, one behind-left rotated about 18 degrees away from camera, one
behind-right rotated about 18 degrees the other way and slightly lower. The phones are simple
bezel-less slabs with uniform thin dark frames and softly rounded corners; their screens are
completely blank flat #0E1013 with no content, no reflection and no glare. Materials are matte
graphite #14171B with a single soft specular sheen down the left edge of each device and no second
highlight. The background is an empty graphite gradient from #08090B at the edges to #0E1013 near
the centre, with one faint cool rim light from the upper left and a very soft contact shadow
beneath the group. A thin electric-lime #C8FF2E rim catch runs along one edge of the centre device
only, under 2% of the frame. Studio product photography lighting, three-quarter view, 50mm lens,
deep depth of field. Premium broadcast-graphics art direction, dark glassmorphism, film-grade
contrast, blacks retain detail.
--ar 16:9
```

**Negative prompt**

```
text, letters, numbers, typography, watermark, signature, logo, brand marks, apple logo, phone
manufacturer branding, camera bump detail, notch, dynamic island, UI, app screenshot, home
screen, icons, wallpaper, screen content, screen glare, screen reflection, hands, fingers, real
people, faces, desk, table, plants, coffee, office, lifestyle scene, cartoon, clip art, bright
background, white background, studio backdrop seam, colourful gradient, rainbow, lens flare,
bokeh, depth-of-field blur, tilt shift, border, frame, banding
```

**Post-processing.** Perspective-warp real screenshots of the build (the same captures used for the
App Store set) into each blank screen; add a 6% screen-space gradient so they sit in the light.
Crop to 2400×1350. `cwebp -q 84`.

**Acceptance.** ☐ Screens are genuinely blank in the generated plate. ☐ No manufacturer branding or
notch. ☐ Composited screenshots are real build captures, not mockups. ☐ Volt under 2%. ☐ ≤220 KB.

---

## 5. P2 — polish

### C1 — Stadium-bowl haze plate

**Purpose / where.** Atmosphere layer over the live pitch canvas and behind hero surfaces, replacing
the CSS-only haze in `design/surfaces/material.ts` where a real gradient field looks better.
**Destination.** `apps/game/public/art/textures/stadium-haze.webp` — WebP with alpha, 1600×900,
≤80 KB. Composited at ≤18% opacity.

```
A soft field of atmospheric haze isolated on a fully transparent background, no objects at all. A
broad low-lying band of cool blue-grey mist, #9EB2C8 at very low opacity, thickens across the
lower two-thirds and thins to nothing at the top. Four wide, extremely diffuse pools of cold
#D6E8FF light bloom from above the frame at evenly spaced intervals, as if four floodlights sat
just out of shot, each fading out well before it reaches the bottom edge. Fine, even volumetric
grain throughout; no structure, no edges, no shapes, no focal point. Very low contrast: the
brightest point is only slightly brighter than the darkest. Premium broadcast-graphics art
direction, film-grade contrast, rendered volumetric study, not photography.
--ar 16:9
```

**Negative prompt**

```
text, letters, numbers, watermark, logo, brand marks, stadium, stands, seats, floodlight masts,
pitch, grass, lines, people, faces, crowd, silhouettes, buildings, clouds, sky, smoke plume,
fog machine, dry ice, hard-edged light beams, god rays, lens flare, sun, rainbow, saturated
colour, warm colour, orange, high contrast, dark background, black background, solid background,
border, frame, vignette, noise, banding, visible tiling
```

**Post-processing.** Remove background to true alpha. Clamp max luminance to ~45%. Check the plate
at 18% opacity over `#0A1410` — it must lift the field without washing it. `cwebp -q 84 -alpha_q 100`.

**Acceptance.** ☐ Zero recognisable objects. ☐ Max luma ≤45%. ☐ At 18% opacity over the pitch it
raises the floor by roughly one stop and no more. ☐ No hard edge anywhere. ☐ ≤80 KB.

---

### C2 — Ball sprite

**Purpose / where.** Upgrade over the gradient ball drawn by `features/matchday/live/pitchRenderer.ts`.
The renderer sprite-caches, so this is a single top-down still, drawn once and blitted.
**Destination.** `apps/game/public/art/sprites/ball.webp` — WebP with alpha, 256×256 (128 @2x),
≤20 KB.

```
A single football seen from directly above, centred, isolated on a fully transparent background,
filling about 88% of a square frame. The ball is a matte off-white sphere, #F4F6F8 on the lit side
falling to #9AA3AD in shadow, lit from the upper left by one soft key with a single small specular
sheen at the upper left and no second highlight. Seams are drawn as a small central pentagon with
four seam lines radiating from its vertices, recessed and rendered in dark graphite #14171B at low
contrast — visible but never graphic. The lower-right quadrant carries a soft occlusion shading.
No cast shadow on the ground, no contact shadow, no motion blur. Clean, small-scale, legible at
sixteen pixels. Premium broadcast-graphics art direction, product-render lighting, film-grade
contrast, rendered CGI quality.
--ar 1:1
```

**Negative prompt**

```
text, letters, numbers, watermark, signature, logo, brand marks, sponsor marks, manufacturer
branding, real ball model, full truncated icosahedron hexagon pattern, classic black-and-white
panel ball, coloured panels, saturated colour, neon, glowing ball, fire, trail, motion blur,
grass, pitch, background, environment, cast shadow, drop shadow, reflection, multiple highlights,
rim light, cartoon, clip art, sticker outline, thick outlines, dirt, scuffs, wet sheen, border,
frame
```

**Post-processing.** Remove background to alpha; the alpha edge must be a clean circle (a soft
half-pixel feather only). Centre to the exact pixel centre. Verify at 16 px and 24 px on
`#0A1410` — if the seams disappear, raise their contrast slightly rather than their width.
`cwebp -q 92 -alpha_q 100`.

**Acceptance.** ☐ Perfect circle in alpha, centred within 1 px. ☐ Reads as a ball at 16 px on the
dark pitch. ☐ Exactly one highlight. ☐ No branding or panel pattern. ☐ ≤20 KB.

---

### C3 — Kit fabric micro-noise tile

**Purpose / where.** Overlay on kit swatches and the sprite-cached shirts in the pitch renderer, to
break up flat club colour. Composited at ≤8% opacity in `overlay`, so it is authored as neutral
grey with no colour of its own.
**Destination.** `apps/game/public/art/textures/kit-fabric.webp` — WebP, **seamless** 256×256,
≤16 KB.

```
A seamless tileable close-up of technical sports-jersey fabric, flat to camera, no perspective,
completely desaturated neutral grey around 50% luminance (#7F7F7F, zero saturation). The weave is a fine regular knit with a
subtle repeating micro-rib and a scatter of tiny ventilation perforations at low contrast. The
whole texture is extremely low contrast — the difference between the brightest and darkest thread
is small — and evenly distributed with no focal point, no centre, no hotspot, and edges that
continue cleanly on all four sides. Material study, macro, even flat lighting with no directional
key. Premium broadcast-graphics art direction, film-grade contrast, rendered material, not
photography.
--ar 1:1 --tile
```

**Negative prompt**

```
text, letters, numbers, watermark, logo, brand marks, sponsor marks, jersey number, stripes,
hoops, chevrons, club pattern, colour, saturated colour, blue, red, green, seam, stitching, hem,
collar, sleeve, garment shape, folds, wrinkles, drape, shadow, highlight, directional light, wet
fabric, sweat, dust, pilling, carbon fibre, hexagon mesh, honeycomb, visible tile edge, repeating
motif, centre hotspot, vignette, border, frame, depth of field, blur, noise grain, banding
```

**Post-processing.** Force to greyscale (any residual colour tints every club). Normalise mean
luminance to exactly 50% so `overlay` is a no-op on average. 3×3 seam test. `cwebp -q 90`.

**Acceptance.** ☐ Mean luminance 50% ±2. ☐ Zero saturation. ☐ 3×3 tile shows no seam and no visible
repeat motif. ☐ At 8% overlay on a club colour it adds texture without shifting the hue. ☐ ≤16 KB.

---

### C4 — Reward-fly particle sheet

**Purpose / where.** H8 "objective claimed" — reward tokens flying to the balance chip. A sprite
sheet of one token at eight rotations, blitted along the flight path.
**Destination.** `apps/game/public/art/sprites/reward-tokens.webp` — WebP with alpha, 1024×256
(8 frames of 128², left to right, uniform padding), ≤40 KB.

```
Eight frames in a single horizontal strip, evenly spaced, each frame a square containing one
identical small gold token seen at a different rotation about its vertical axis — from fully
face-on in the first frame, through progressively narrower ellipses, to nearly edge-on in the
fifth, then opening back out. Isolated on a fully transparent background. The token is a plain
convex disc with a raised bevelled rim, spun gold with a ramp of #7A5716 shadow, #B8862B turn,
#FFD76A face and #FFF0C4 hot core, lit from the upper left with exactly one specular sheen per
frame and no second highlight. The face is completely blank — no emblem, no relief, no engraving.
Each token is centred in its frame with generous even padding and never touches a frame edge. No
motion blur, no trails, no shadows. Premium broadcast-graphics art direction, product-render
lighting, film-grade contrast, rendered CGI quality.
--ar 4:1
```

**Negative prompt**

```
text, letters, numbers, currency symbols, denomination, typography, watermark, logo, brand marks,
crest, emblem, relief portrait, engraving, real coin, dollar, euro, bitcoin, poker chip, medal,
ribbon, real people, faces, cartoon, clip art, sparkles, glitter, trails, motion blur, streaks,
cast shadow, drop shadow, reflection, mirror, background, solid background, uneven spacing, frames
touching, grid, borders between frames, more than eight tokens, silver, chrome, plastic
```

**Post-processing.** Slice to exactly 8×128 px cells, re-centre each token in its cell, equalise
brightness across frames (generators drift). Remove background to alpha. `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Exactly 8 cells at 128² with the token centred in each. ☐ Rotation sequence plays
smoothly when cycled at 12 fps. ☐ Faces are blank — no glyph or emblem. ☐ Consistent brightness
across frames. ☐ ≤40 KB.

---

### C5 — Special-rule sweep plate

**Purpose / where.** H6 "special rule activates" — a `--color-special` wash sweeping across the
pitch. A single wide gradient plate translated across the pitch surface.
**Destination.** `apps/game/public/art/textures/rule-sweep.webp` — WebP with alpha, 2048×512,
≤48 KB. Composited at ≤22% opacity in `screen`.

```
A single soft horizontal sweep of light isolated on a fully transparent background, no objects.
The sweep is a wide vertical band of violet #A78BFA at low opacity, brightest along a narrow core
and falling away smoothly over a long distance to both left and right until it reaches nothing at
the frame edges. The band leans about eight degrees off vertical. A faint cooler #7C8CFF fringe
trails its left side. Fully transparent above and below is not required — the sweep runs the full
height of the frame with a slight softening at the top and bottom edges. Extremely soft, no hard
boundary anywhere, very low contrast. Premium broadcast-graphics art direction, film-grade
contrast, rendered volumetric study, not photography.
--ar 4:1
```

**Negative prompt**

```
text, letters, numbers, watermark, logo, brand marks, objects, shapes, stars, sparkles, particles,
lightning, energy crackle, lens flare, anamorphic streak, hard edge, sharp gradient stop, banding,
rainbow, saturated colour, green, volt, lime, orange, background, solid background, black
background, border, frame, vignette, pitch, grass, players, people, faces, cartoon, clip art
```

**Post-processing.** Remove background to alpha. Verify the left and right edge columns are fully
transparent so the plate can translate on and off screen invisibly. `cwebp -q 86 -alpha_q 100`.

**Acceptance.** ☐ Leftmost and rightmost 16 px columns are fully transparent. ☐ No volt or green
anywhere — special is violet, and mixing the two breaks the semantic mapping. ☐ No hard edge at
200% zoom. ☐ Translating it across the pitch shows no banding. ☐ ≤48 KB.

---

## 6. Audio

`design/audio.ts` already synthesises the whole cue set with WebAudio, so **every file here is an
override**, installed as an `AudioDriver` via `setAudioDriver()` — not a gap. The synthesised pack
stays the fallback and is what plays when the files fail to load.

**House rules for the whole pack.** Dark, restrained, broadcast — the audio equivalent of the
graphite palette. Cues are short and mixed low; ambience is a floor, never an event. No music beds
under UI. No voice, ever. No real stadium recordings, no real chants, no recognisable songs
(the licensing architecture forbids real identity in audio exactly as it does in art).

**Format for all cues.** Render at 48 kHz / 24-bit, deliver **AAC-LC `.m4a` 128 kbps** as primary
and **Ogg Vorbis `.ogg` q4** as fallback. Destination `apps/game/public/audio/<cue>.{m4a,ogg}` —
the basename must equal the `SfxCue` string exactly, or, for the cues that ship intensity variants,
the cue string plus the documented suffix. Trim silence to zero at both ends except where a loop is
specified. True peak ≤ −1.0 dBTP on every file. Each entry below repeats the spec it needs, so no
entry has to be read against this table.

| Entry | File basename | Duration | Integrated loudness | Budget (per format) |
|---|---|---|---|---|
| D1a | `crowd-bed` | 20 s, seamless loop | −34 LUFS | ≤180 KB |
| D1b | `crowd-bed-low` | 20 s, seamless loop | −34 LUFS | ≤180 KB |
| D1c | `crowd-bed-high` | 20 s, seamless loop | −34 LUFS | ≤180 KB |
| D1d | `crowd-bed-rain` | 20 s, seamless loop | −34 LUFS | ≤180 KB |
| D2 | `goalRoar` | 2.2 s | −16 LUFS | ≤40 KB |
| D3a | `kickOff` | 0.9 s | −18 LUFS | ≤24 KB |
| D3b | `fullTime` | 1.8 s | −18 LUFS | ≤24 KB |
| D4a | `decisionTick-low` | 0.12 s | −22 LUFS | ≤10 KB |
| D4b | `decisionTick-mid` | 0.12 s | −22 LUFS | ≤10 KB |
| D4c | `decisionTick-high` | 0.12 s | −22 LUFS | ≤10 KB |
| D5 | `trophyFanfare` | 2.6 s | −15 LUFS | ≤48 KB |
| D6 | `signingSting` | 1.6 s | −18 LUFS | ≤32 KB |
| D7 | `rewardChime` | 0.7 s | −20 LUFS | ≤16 KB |
| D8a | `uiTick` | 0.06 s | −26 LUFS | ≤8 KB |
| D8b | `uiSelect` | 0.11 s | −26 LUFS | ≤8 KB |

`crowd-bed` is the only ambience file P1 needs; `crowd-bed-low`, `crowd-bed-high` and
`crowd-bed-rain` are the P2 "ambient audio v2" item. A driver that does not implement intensity
variants loads `decisionTick-mid` as its `decisionTick`.

---

### D1 — Crowd ambience loops ×4

The floor under a live match, started and stopped by `AudioDriver.ambience()`. It must be
unnoticeable — the moment a player can identify a repeating detail, it has failed. `crowd-bed` is
the base bed and the only one P1 needs; the three intensity variants are the P2 "ambient audio v2"
item and are crossfaded against the base by match intensity. **All four must be rendered from one
source bed so that crossfading between them never sounds like a cut to a different stadium**, and
all four are 20-second seamless loops at −34 LUFS.

---

#### D1a — Crowd ambience, base bed

**Purpose / where.** The default ambience floor under a live match, started and stopped by
`AudioDriver.ambience()`. Unnoticeable by design. This is the bed the three intensity variants are
derived from, so it is rendered first and the others are rendered from the same source — crossfades
between them must never sound like a cut to a different stadium.
**Destination.** `apps/game/public/audio/crowd-bed.m4a` + `apps/game/public/audio/crowd-bed.ogg` —
AAC-LC 128 kbps and Ogg Vorbis q4, 20 s seamless loop, −34 LUFS, **≤180 KB per format**.

```
A seamless 20-second loop of distant football-crowd ambience recorded from high in an empty-ish
stand. Dense, diffuse, wide stereo murmur with no individual voices audible and no words, no
chanting, no singing, no drums, no clapping pattern, no whistling. Low-frequency room rumble under
a smooth mid-band wash; gentle slow swells of two or three decibels every few seconds so it
breathes, but no event, no peak, no reaction. Reverberant, far away, behind glass. Neutral in
mood — neither excited nor hostile. Mixed very low as a background floor. The last second must
match the first for a click-free loop.
```

**Negative prompt / avoid**

```
voices, words, speech, commentary, announcer, PA system, chanting, singing, football songs, drums,
horns, vuvuzela, air horn, clapping rhythm, whistles, referee whistle, ball kicks, music, melody,
tonal drone, synth pad, hum, 50Hz buzz, mono, narrow stereo, sudden peaks, applause bursts,
laughter, children, animals, traffic, wind buffeting, clipping, pumping compression, audible loop
point, room tone silence
```

**Post-processing.** Crossfade the last 500 ms into the head, then verify a zero-crossing at the
splice. High-pass at 30 Hz. Loudness-normalise to −34 LUFS integrated, true peak −1.0 dBTP. Encode
AAC-LC 128 kbps + Ogg q4. Play it on loop for five minutes and listen for a recurring event. **Keep
the render session — D1b, D1c and D1d must come from this same source bed.**

**Acceptance.** ☐ No click, thump or level jump at the loop point after 10 consecutive plays.
☐ No identifiable voice, word or chant. ☐ −34 LUFS ±0.5. ☐ Stereo width is wide but mono-compatible
(no phase cancellation on fold-down). ☐ ≤180 KB per format.

---

#### D1b — Crowd ambience, low intensity

**Purpose / where.** The thinnest ambience layer in the P2 "ambient audio v2" set, crossfaded in by
`AudioDriver.ambience()` when the match is quiet. **It must be rendered from the same source bed as
`crowd-bed` so that crossfading between the four never sounds like a cut to a different stadium.**
**Destination.** `apps/game/public/audio/crowd-bed-low.m4a` + `apps/game/public/audio/crowd-bed-low.ogg`
— AAC-LC 128 kbps and Ogg Vorbis q4, 20 s seamless loop, −34 LUFS, **≤180 KB per format**.

```
A seamless 20-second loop of distant football-crowd ambience recorded from high in an empty-ish
stand, thinner and sparser than a full house. Diffuse, wide stereo murmur with noticeably fewer
bodies in it — audibly emptier, with more room and less density — and no individual voices audible,
no words, no chanting, no singing, no drums, no clapping pattern, no whistling. Low-frequency room
rumble under a smooth mid-band wash; very gentle slow swells of about one decibel every few
seconds, half the depth of a full crowd, so it breathes faintly but has no event, no peak, no
reaction. Reverberant, far away, behind glass. Neutral in mood — neither excited nor hostile. Mixed
very low as a background floor. The last second must match the first for a click-free loop.
```

**Negative prompt / avoid**

```
voices, words, speech, commentary, announcer, PA system, chanting, singing, football songs, drums,
horns, vuvuzela, air horn, clapping rhythm, whistles, referee whistle, ball kicks, music, melody,
tonal drone, synth pad, hum, 50Hz buzz, mono, narrow stereo, sudden peaks, applause bursts,
laughter, children, animals, traffic, wind buffeting, clipping, pumping compression, audible loop
point, room tone silence
```

**Post-processing.** Derive it from the D1a source bed rather than generating a fresh crowd.
Crossfade the last 500 ms into the head, then verify a zero-crossing at the splice. High-pass at
30 Hz. Loudness-normalise to −34 LUFS integrated, true peak −1.0 dBTP. Encode AAC-LC 128 kbps +
Ogg q4. Crossfade it against `crowd-bed` and confirm the transition reads as the same crowd
thinning out.

**Acceptance.** ☐ No click, thump or level jump at the loop point after 10 consecutive plays.
☐ Crossfaded with `crowd-bed` it is audibly the *same* stadium, not a second one. ☐ Swell depth is
roughly half the base bed's. ☐ No identifiable voice, word or chant. ☐ −34 LUFS ±0.5.
☐ ≤180 KB per format.

---

#### D1c — Crowd ambience, high intensity

**Purpose / where.** The densest ambience layer in the P2 "ambient audio v2" set, crossfaded in by
`AudioDriver.ambience()` when the match is live. It is still a floor, never an event. **It must be
rendered from the same source bed as `crowd-bed` so that crossfading between the four never sounds
like a cut to a different stadium.**
**Destination.** `apps/game/public/audio/crowd-bed-high.m4a` +
`apps/game/public/audio/crowd-bed-high.ogg` — AAC-LC 128 kbps and Ogg Vorbis q4, 20 s seamless
loop, −34 LUFS, **≤180 KB per format**.

```
A seamless 20-second loop of distant football-crowd ambience recorded from high in a well-filled
stand, denser and about one stop more energetic than a half-empty ground. Dense, diffuse, wide
stereo murmur with no individual voices audible and no words, no chanting, no singing, no drums, no
clapping pattern, no whistling — the extra energy is in density and mid-band presence, never in an
identifiable reaction. Low-frequency room rumble under a smooth mid-band wash; slow swells of three
or four decibels every few seconds so it breathes, but no event, no peak, no goal reaction.
Reverberant, far away, behind glass. Engaged but neutral in mood — neither celebratory nor hostile.
Mixed very low as a background floor. The last second must match the first for a click-free loop.
```

**Negative prompt / avoid**

```
voices, words, speech, commentary, announcer, PA system, chanting, singing, football songs, drums,
horns, vuvuzela, air horn, clapping rhythm, whistles, referee whistle, ball kicks, music, melody,
tonal drone, synth pad, hum, 50Hz buzz, mono, narrow stereo, sudden peaks, applause bursts, roar,
goal reaction, laughter, children, animals, traffic, wind buffeting, clipping, pumping compression,
audible loop point, room tone silence
```

**Post-processing.** Derive it from the D1a source bed rather than generating a fresh crowd.
Crossfade the last 500 ms into the head, then verify a zero-crossing at the splice. High-pass at
30 Hz. Loudness-normalise to −34 LUFS integrated, true peak −1.0 dBTP — the extra energy must not
arrive as extra level. Encode AAC-LC 128 kbps + Ogg q4. Crossfade it against `crowd-bed` and check
the transition reads as the same crowd filling up.

**Acceptance.** ☐ No click, thump or level jump at the loop point after 10 consecutive plays.
☐ Crossfaded with `crowd-bed` it is audibly the *same* stadium, not a second one. ☐ Never reads as
a reaction to an event. ☐ No identifiable voice, word or chant. ☐ −34 LUFS ±0.5.
☐ ≤180 KB per format.

---

#### D1d — Crowd ambience, rain

**Purpose / where.** The wet-weather ambience layer in the P2 "ambient audio v2" set, crossfaded in
by `AudioDriver.ambience()` when the match is played in rain. **It must be rendered from the same
source bed as `crowd-bed` so that crossfading between the four never sounds like a cut to a
different stadium.**
**Destination.** `apps/game/public/audio/crowd-bed-rain.m4a` +
`apps/game/public/audio/crowd-bed-rain.ogg` — AAC-LC 128 kbps and Ogg Vorbis q4, 20 s seamless
loop, −34 LUFS, **≤180 KB per format**.

```
A seamless 20-second loop of distant football-crowd ambience recorded from high in an empty-ish
stand, in the rain. Dense, diffuse, wide stereo murmur with no individual voices audible and no
words, no chanting, no singing, no drums, no clapping pattern, no whistling, with slightly less
high-frequency air than a dry night so the crowd sits further back. Under it, a fine, even, steady
rain hiss with no heavy drops, no drumming on a roof and no gusts — a smooth wet floor rather than
a weather effect. Low-frequency room rumble beneath both; gentle slow swells of two or three
decibels every few seconds so the crowd breathes, but no event, no peak, no reaction. Reverberant,
far away, behind glass. Neutral in mood — neither excited nor hostile. Mixed very low as a
background floor. The last second must match the first for a click-free loop.
```

**Negative prompt / avoid**

```
voices, words, speech, commentary, announcer, PA system, chanting, singing, football songs, drums,
horns, vuvuzela, air horn, clapping rhythm, whistles, referee whistle, ball kicks, music, melody,
tonal drone, synth pad, hum, 50Hz buzz, mono, narrow stereo, sudden peaks, applause bursts,
laughter, children, animals, traffic, thunder, lightning, storm, wind buffeting, heavy downpour,
rain on a tin roof, individual raindrops, dripping, splashing, puddles, clipping, pumping
compression, audible loop point, room tone silence
```

**Post-processing.** Derive it from the D1a source bed rather than generating a fresh crowd; layer
the rain under it. Crossfade the last 500 ms into the head, then verify a zero-crossing at the
splice. High-pass at 30 Hz, and shelve down above 9 kHz so the rain never hisses on a phone
speaker. Loudness-normalise to −34 LUFS integrated, true peak −1.0 dBTP. Encode AAC-LC 128 kbps +
Ogg q4.

**Acceptance.** ☐ No click, thump or level jump at the loop point after 10 consecutive plays.
☐ Crossfaded with `crowd-bed` it is audibly the *same* stadium, now wet. ☐ Rain is a floor, never
an event — no individual drops. ☐ No identifiable voice, word or chant. ☐ −34 LUFS ±0.5.
☐ ≤180 KB per format.

---

### D2 — Goal roar

**Purpose / where.** `goalRoar`, behind H1 "goal scored (yours)". Sits *under* the visual, not on
top of it. Never fires for a conceded goal — H2 is deliberately smaller.
**Destination.** `apps/game/public/audio/goalRoar.m4a` + `apps/game/public/audio/goalRoar.ogg` —
AAC-LC 128 kbps and Ogg Vorbis q4, 2.2 s, −16 LUFS, **≤40 KB per format**.

```
A 2.2-second crowd goal reaction: a fast swell from a low murmur into a full-throated roar in
about 400 milliseconds, holding for half a second, then decaying naturally over the remainder into
a residual excited hum. Dense and diffuse, no individual voices, no words, no chant. A subtle
low-frequency sub-bass push under the front edge gives it weight. Reverberant stadium space, wide
stereo. Exciting but broadcast-controlled — the sound of a camera microphone with a limiter on it,
not a raw crowd right next to you.
```

**Negative prompt / avoid**

```
voices, words, commentary, announcer shouting, "goal", chanting, singing, air horn, vuvuzela,
whistle, music, fanfare, cymbal crash, drum hit, riser, whoosh, cinematic braam, sub drop, clipped
peaks, distortion, mono, applause only, laughter, sports-crowd stock cliché, fade-in from silence,
abrupt cut-off, long tail beyond three seconds
```

**Post-processing.** Trim head to the first sample of the swell. Fade the tail to zero by 2.2 s.
High-pass at 35 Hz, limit to −1.0 dBTP, normalise to −16 LUFS. It must duck cleanly under the
existing ambience bed rather than replacing it — check them playing together.

**Acceptance.** ☐ Peak arrives within 400–500 ms of the start. ☐ Fully decayed by 2.2 s.
☐ No word is intelligible at any playback level. ☐ Layered over `crowd-bed` it reads as the same
crowd getting louder, not as a second crowd. ☐ −16 LUFS ±0.5.

---

### D3 — Whistles ×2

`kickOff` (one long peep, the match is on) and `fullTime` (three peeps, it is over). The most
literal cues in the pack and the easiest to get wrong by making them loud. **Both files must be
rendered from one source whistle in one session** — a listener will hear immediately if full time
is blown by a different referee than kick-off — and both are normalised to −18 LUFS.

---

#### D3a — Kick-off whistle

**Purpose / where.** `kickOff` — one long peep, the match is on. Fired once at the start of a live
match. **Render it from the same source whistle, in the same session, as D3b `fullTime`: the two
files must be audibly the same whistle in the same stadium.**
**Destination.** `apps/game/public/audio/kickOff.m4a` + `apps/game/public/audio/kickOff.ogg` —
AAC-LC 128 kbps and Ogg Vorbis q4, 0.9 s, −18 LUFS, **≤24 KB per format**.

```
A single referee's whistle blast, 0.9 seconds, one clean sustained pea-whistle tone with a fast
attack, a steady body with a light natural warble, and a short natural release. Recorded at
distance in a large reverberant stadium space so the tail carries a short slap and a wide diffuse
decay. Bright but not piercing; the fundamental sits around 3.4 kHz with a controlled harmonic
above it. Nothing else in the recording.
```

**Negative prompt / avoid**

```
voices, crowd, commentary, music, multiple whistles at once, electronic whistle, kettle whistle,
bird whistle, slide whistle, human whistling, sports coach whistle indoors, dry close-mic
recording, no reverberation, harsh piercing sibilance above 8 kHz, distortion, clipping, mono
only, wind noise, breath noise, mouth noise, handling noise, background hiss, abrupt cut-off,
reverse reverb, delay repeats
```

**Post-processing.** De-ess above 8 kHz — an unfiltered whistle is physically painful on phone
speakers held close. Normalise to −18 LUFS, limit to −1.0 dBTP. **Render this and `fullTime` from
one source and keep their timbre identical**; A/B them back to back before accepting either.

**Acceptance.** ☐ Audibly the *same whistle* as `fullTime`, in the same space. ☐ No energy above
12 kHz. ☐ Reads as one clean sustained blast at phone-speaker volume. ☐ Not the loudest thing in
the pack. ☐ −18 LUFS ±0.5. ☐ ≤24 KB per format.

---

#### D3b — Full-time whistle

**Purpose / where.** `fullTime` — three peeps, it is over. Fired once at the end of a live match.
**Render it from the same source whistle, in the same session, as D3a `kickOff`: the two files must
be audibly the same whistle in the same stadium.**
**Destination.** `apps/game/public/audio/fullTime.m4a` + `apps/game/public/audio/fullTime.ogg` —
AAC-LC 128 kbps and Ogg Vorbis q4, 1.8 s, −18 LUFS, **≤24 KB per format**.

```
Three referee's whistle blasts over 1.8 seconds — short, short, long — with about 180 milliseconds
between the first two and 220 before the last, the final blast held roughly twice as long as the
others and released with a slight downward bend. Each blast is one clean pea-whistle tone with a
fast attack, a steady body with a light natural warble and a short natural release; the fundamental
sits around 3.4 kHz with a controlled harmonic above it. Recorded at distance in a large
reverberant stadium space so each tail carries a short slap and a wide diffuse decay. Bright but
not piercing. Nothing else in the recording.
```

**Negative prompt / avoid**

```
voices, crowd, commentary, music, multiple whistles at once, electronic whistle, kettle whistle,
bird whistle, slide whistle, human whistling, sports coach whistle indoors, dry close-mic
recording, no reverberation, harsh piercing sibilance above 8 kHz, distortion, clipping, mono
only, wind noise, breath noise, mouth noise, handling noise, background hiss, abrupt cut-off,
reverse reverb, delay repeats
```

**Post-processing.** De-ess above 8 kHz — an unfiltered whistle is physically painful on phone
speakers held close. Normalise to −18 LUFS, limit to −1.0 dBTP. **Render this and `kickOff` from
one source and keep their timbre identical**; A/B them back to back before accepting either.

**Acceptance.** ☐ Audibly the *same whistle* as `kickOff`, in the same space. ☐ Reads
unambiguously as three blasts at phone-speaker volume. ☐ No energy above 12 kHz. ☐ Not the loudest
thing in the pack. ☐ −18 LUFS ±0.5. ☐ ≤24 KB per format.

---

### D4 — Decision tick ×3

`decisionTick`, the countdown under H5's timed decision prompt. Fired repeatedly as the volt ring
drains, with `intensity` escalating, so the driver picks one of three files by intensity band. This
is the cue most at risk of becoming irritating, so it is the quietest in the pack. **All three must
be the same object: render them from one source click and keep them within 2 LU of each other —
escalation is timbral, never a volume ramp.** A driver that does not implement variants loads
`decisionTick-mid` as its `decisionTick`.

---

#### D4a — Decision tick, low intensity

**Purpose / where.** `decisionTick` at low `intensity` — the start of H5's countdown, while there is
still plenty of time. **Render it from the same source click as D4b and D4c and keep all three
within 2 LU of each other: escalation is timbral, never a volume ramp.**
**Destination.** `apps/game/public/audio/decisionTick-low.m4a` +
`apps/game/public/audio/decisionTick-low.ogg` — AAC-LC 128 kbps and Ogg Vorbis q4, 0.12 s,
−22 LUFS, **≤10 KB per format**.

```
A single short mechanical tick, 120 milliseconds, dry and close: a small wooden-and-metal click
with a sharp transient, a brief woody body a little below 900 Hz and almost no tail, softer and
duller than a reference tick — the quiet end of a countdown, unhurried. Precise, neutral,
clock-like rather than musical. No pitch centre a listener could hum. Completely dry — no
reverberation, no room, no space.
```

**Negative prompt / avoid**

```
melody, tone, pitch, musical note, bell, chime, beep, sine, square wave, synth blip, digital UI
sound, watch alarm, alarm clock, buzzer, reverb, delay, echo, room ambience, stereo width, crowd,
voices, music, long tail, sustain, whoosh, riser, distortion, clipping, harshness above 9 kHz,
double click, flam, inconsistent timbre between variants
```

**Post-processing.** Trim to exactly 120 ms with a 2 ms fade-out. Normalise to −22 LUFS, limit to
−1.0 dBTP. **Check it against `decisionTick-mid` and `decisionTick-high`: all three must sit within
2 LU of each other** and read as one object at three levels of urgency.

**Acceptance.** ☐ Under 130 ms including tail. ☐ No perceptible pitch. ☐ Within 2 LU of the mid and
high ticks. ☐ Audibly the same object as them, only calmer. ☐ Fired 20 times in 10 seconds it is
still tolerable. ☐ −22 LUFS ±0.5. ☐ ≤10 KB per format.

---

#### D4b — Decision tick, mid intensity

**Purpose / where.** `decisionTick` at mid `intensity` — the reference tick, and the file a driver
without variant support loads as plain `decisionTick`. **Render it from the same source click as
D4a and D4c and keep all three within 2 LU of each other: escalation is timbral, never a volume
ramp.**
**Destination.** `apps/game/public/audio/decisionTick-mid.m4a` +
`apps/game/public/audio/decisionTick-mid.ogg` — AAC-LC 128 kbps and Ogg Vorbis q4, 0.12 s,
−22 LUFS, **≤10 KB per format**.

```
A single short mechanical tick, 120 milliseconds, dry and close: a small wooden-and-metal click
with a sharp transient, a brief woody body around 900 Hz and almost no tail. Precise, neutral,
clock-like rather than musical. No pitch centre a listener could hum. Completely dry — no
reverberation, no room, no space.
```

**Negative prompt / avoid**

```
melody, tone, pitch, musical note, bell, chime, beep, sine, square wave, synth blip, digital UI
sound, watch alarm, alarm clock, buzzer, reverb, delay, echo, room ambience, stereo width, crowd,
voices, music, long tail, sustain, whoosh, riser, distortion, clipping, harshness above 9 kHz,
double click, flam, inconsistent timbre between variants
```

**Post-processing.** Trim to exactly 120 ms with a 2 ms fade-out. Normalise to −22 LUFS, limit to
−1.0 dBTP. **Check it against `decisionTick-low` and `decisionTick-high`: all three must sit within
2 LU of each other** and read as one object at three levels of urgency. Render the other two from
this one.

**Acceptance.** ☐ Under 130 ms including tail. ☐ No perceptible pitch. ☐ Within 2 LU of the low and
high ticks. ☐ Audibly the same object as them. ☐ Fired 20 times in 10 seconds it is still
tolerable. ☐ −22 LUFS ±0.5. ☐ ≤10 KB per format.

---

#### D4c — Decision tick, high intensity

**Purpose / where.** `decisionTick` at high `intensity` — the last seconds of H5's countdown, when
the volt ring is nearly drained. **Render it from the same source click as D4a and D4b and keep all
three within 2 LU of each other: escalation is timbral, never a volume ramp.**
**Destination.** `apps/game/public/audio/decisionTick-high.m4a` +
`apps/game/public/audio/decisionTick-high.ogg` — AAC-LC 128 kbps and Ogg Vorbis q4, 0.12 s,
−22 LUFS, **≤10 KB per format**.

```
A single short mechanical tick, 120 milliseconds, dry and close: a small wooden-and-metal click
with a very fast sharp transient, a brief tight body around 900 Hz with a touch more
high-frequency snap than a reference tick, and almost no tail. It reads as more urgent purely
through timbre — brighter and tighter, never louder. Precise, neutral, clock-like rather than
musical. No pitch centre a listener could hum. Completely dry — no reverberation, no room, no
space.
```

**Negative prompt / avoid**

```
melody, tone, pitch, musical note, bell, chime, beep, sine, square wave, synth blip, digital UI
sound, watch alarm, alarm clock, buzzer, reverb, delay, echo, room ambience, stereo width, crowd,
voices, music, long tail, sustain, whoosh, riser, distortion, clipping, harshness above 9 kHz,
double click, flam, inconsistent timbre between variants, louder than the other variants
```

**Post-processing.** Trim to exactly 120 ms with a 2 ms fade-out. Normalise to −22 LUFS, limit to
−1.0 dBTP. **Check it against `decisionTick-low` and `decisionTick-mid`: all three must sit within
2 LU of each other** — if this one feels more urgent because it is louder, it is wrong.

**Acceptance.** ☐ Under 130 ms including tail. ☐ No perceptible pitch. ☐ Within 2 LU of the low and
mid ticks. ☐ More urgent than them purely through timbre. ☐ Fired 20 times in 10 seconds it is
still tolerable. ☐ −22 LUFS ±0.5. ☐ ≤10 KB per format.

---

### D5 — Trophy fanfare

**Purpose / where.** `trophyFanfare`, H9 — the biggest moment in the product. The only cue allowed
to feel like a fanfare, and the only one allowed to be tonal.
**Destination.** `apps/game/public/audio/trophyFanfare.m4a` +
`apps/game/public/audio/trophyFanfare.ogg` — AAC-LC 128 kbps and Ogg Vorbis q4, 2.6 s, −15 LUFS,
**≤48 KB per format**.

```
A 2.6-second gold arpeggio: three struck metallic tones rising in a bright major triad, each with
a bell-like attack and a long shimmering tail, arriving about 220 milliseconds apart, resolving on
a fourth sustained tone an octave above the first that rings out and decays over the final second.
Underneath, one deep soft sub-bass swell rises through the first half and settles. The metal is
warm and struck — glockenspiel and small tuned bells rather than brass or synth. Large hall
reverberation, wide stereo, cinematic but restrained. Triumphant without being brassy or military.
```

**Negative prompt / avoid**

```
brass fanfare, trumpets, horns, orchestra, strings, timpani roll, cymbal crash, military march,
drum kit, snare roll, choir, voices, words, cheering, applause, synth lead, saw wave, 8-bit,
chiptune, arcade jingle, casino win sound, slot machine, coin sound, video-game level-up, dubstep,
sub drop, riser, whoosh, distortion, clipping, detuning, dissonance, minor key, long tail beyond
three seconds, abrupt cut-off
```

**Post-processing.** Trim the head to the first transient. Tail must be fully decayed by 2.6 s (the
moment is skippable by tap, and a cue that outlives its visual is a bug). High-pass at 40 Hz,
normalise to −15 LUFS — the loudest cue in the pack, and only just.

**Acceptance.** ☐ Fully decayed by 2.6 s. ☐ No brass, no choir, no arcade timbre. ☐ Cut off
mid-play at 1.0 s (the skip case) it does not click. ☐ −15 LUFS ±0.5. ☐ ≤48 KB per format.

---

### D6 — Signing sting

**Purpose / where.** `signingSting`, H7 (card flip from silhouette to portrait) and reused by the
B6 club reveal. A low swell into a single bell — the shape is "something arrived", not "you won".
**Destination.** `apps/game/public/audio/signingSting.m4a` +
`apps/game/public/audio/signingSting.ogg` — AAC-LC 128 kbps and Ogg Vorbis q4, 1.6 s, −18 LUFS,
**≤32 KB per format**.

```
A 1.6-second sting: a low, dark filtered swell rises from nothing over about 900 milliseconds,
gaining brightness as it opens, and resolves into one clean struck bell tone that rings for the
remaining 700 milliseconds and decays to silence. The bell is bright, metallic and singular — one
strike, no arpeggio, no chord. A subtle low-frequency body sits under the swell. Medium hall
reverberation, wide stereo. Confident and expensive rather than celebratory.
```

**Negative prompt / avoid**

```
fanfare, brass, orchestra, choir, voices, words, cheering, applause, arpeggio, chord, melody,
multiple bells, church bell, gong, cymbal, gunshot, impact, braam, cinematic hit, sub drop,
dubstep, synth lead, 8-bit, arcade, coin sound, cash register, notification sound, phone alert,
distortion, clipping, harsh transient, long tail beyond two seconds, abrupt cut-off, reverse
cymbal, white-noise riser
```

**Post-processing.** Align the bell strike to land at exactly 900 ms so it can be timed against the
card flip. Fade to zero by 1.6 s. Normalise to −18 LUFS.

**Acceptance.** ☐ Bell strike at 900 ms ±30 ms. ☐ Exactly one bell strike. ☐ Silent by 1.6 s.
☐ Distinguishable from D5 in a blind A/B. ☐ ≤32 KB per format.

---

### D7 — Reward chime

**Purpose / where.** `rewardChime`, H8 — objective claimed, reward opened. Fires more often than any
other celebratory cue, so it is short and small.
**Destination.** `apps/game/public/audio/rewardChime.m4a` + `apps/game/public/audio/rewardChime.ogg` —
AAC-LC 128 kbps and Ogg Vorbis q4, 0.7 s, −20 LUFS, **≤16 KB per format**.

```
A 0.7-second reward chime: two bright metallic tones a perfect fifth apart, the second following
the first by about 120 milliseconds, both with fast bell-like attacks and short shimmering tails
that decay together to silence. Small, light and clean; a soft short reverberation gives it space
without a tail. Positive and quick. No bass, no swell, no build.
```

**Negative prompt / avoid**

```
fanfare, brass, orchestra, choir, voices, cheering, applause, melody longer than two notes, chord
stack, arcade jingle, coin sound, cash register, slot machine, video-game level-up, notification
sound, phone alert, message tone, synth lead, 8-bit, chiptune, sub-bass, kick drum, whoosh, riser,
distortion, clipping, harsh sibilance, long reverb tail, long decay, abrupt cut-off
```

**Post-processing.** Trim to 0.7 s with the tail fully decayed. Normalise to −20 LUFS — noticeably
quieter than D5 and D6, because it fires far more often.

**Acceptance.** ☐ Exactly two tones. ☐ Under 0.7 s including tail. ☐ Fired five times in ten
seconds it does not grate. ☐ Quieter than the fanfare and the sting. ☐ ≤16 KB per format.

---

### D8 — UI tick and select ×2

`uiTick` (a value moved under the finger: tab, segmented control) and `uiSelect` (a choice
committed: primary button). The quietest things in the product; they should register as texture,
not as sound. **Both must be rendered from the same source object in one session so they are
audibly one family**, and both are normalised to −26 LUFS.

---

#### D8a — UI tick

**Purpose / where.** `uiTick` — a value moved under the finger: tab change, segmented control,
stepper. Fires more often than anything else in the product, so it is the quietest thing in it.
**Render it from the same source object as D8b `uiSelect` so the two are audibly one family.**
**Destination.** `apps/game/public/audio/uiTick.m4a` + `apps/game/public/audio/uiTick.ogg` —
AAC-LC 128 kbps and Ogg Vorbis q4, 0.06 s, −26 LUFS, **≤8 KB per format**.

```
A 60-millisecond soft click. A single tiny transient with a very short damped body and no tail,
dry and close, neutral in timbre with no discernible pitch. The sound of a well-made switch, heard
quietly. Nothing else in the recording — no room, no reverberation, no space.
```

**Negative prompt / avoid**

```
beep, sine tone, melody, musical note, chime, bell, digital UI sound, iOS keyboard click, camera
shutter, typewriter, mouse click stock sound, buzzer, error tone, notification, alert, reverb,
delay, echo, room ambience, stereo width, long tail, sustain, whoosh, distortion, clipping,
harshness above 9 kHz, double click, flam, inconsistent timbre between the two
```

**Post-processing.** Trim to 60 ms including the tail, with a 2 ms fade-out. Normalise to −26 LUFS,
limit to −1.0 dBTP. **Render it from the same source as `uiSelect`** and A/B the two before
accepting either. Verify on a phone speaker at 30% volume that it is not startling.

**Acceptance.** ☐ Under 60 ms including tail. ☐ Audibly the same object as `uiSelect`, only
smaller. ☐ No pitch. ☐ At −26 LUFS it sits below the ambience bed's peaks. ☐ ≤8 KB per format.

---

#### D8b — UI select

**Purpose / where.** `uiSelect` — a choice committed: primary button, confirmed option. It is a
confirmation, not a celebration; the difference from `uiTick` is one very short tonal ring, nothing
more. **Render it from the same source object as D8a `uiTick` so the two are audibly one family.**
**Destination.** `apps/game/public/audio/uiSelect.m4a` + `apps/game/public/audio/uiSelect.ogg` —
AAC-LC 128 kbps and Ogg Vorbis q4, 0.11 s, −26 LUFS, **≤8 KB per format**.

```
A 110-millisecond soft click with a little more body than a bare tick and one very short, low-level
tonal ring at its tail — just enough to read as confirmation rather than movement. Dry, close and
neutral in character, with no melody and no pitch a listener could hum. The sound of a well-made
switch being committed, heard quietly. Nothing else in the recording — no room, no reverberation,
no space.
```

**Negative prompt / avoid**

```
beep, sine tone, melody, musical note, chime, bell, digital UI sound, iOS keyboard click, camera
shutter, typewriter, mouse click stock sound, buzzer, error tone, notification, alert, reverb,
delay, echo, room ambience, stereo width, long tail, sustain, whoosh, distortion, clipping,
harshness above 9 kHz, double click, flam, inconsistent timbre between the two
```

**Post-processing.** Trim to 110 ms including the tail, with a 2 ms fade-out. Normalise to
−26 LUFS, limit to −1.0 dBTP. **Render it from the same source as `uiTick`** and A/B the two before
accepting either. Verify on a phone speaker at 30% volume that it is not startling.

**Acceptance.** ☐ Under 110 ms including tail. ☐ Audibly the same object as `uiTick`, only
committed. ☐ No hummable pitch. ☐ At −26 LUFS it sits below the ambience bed's peaks.
☐ ≤8 KB per format.

---

## 7. Do NOT generate with AI

| Never generate | Why | Do this instead |
|---|---|---|
| **App Store screenshots ×8 (+3 iPad)** | Apple guideline 2.3.1 requires screenshots to show the actual product. A generated or mocked-up screen is a rejection. | Capture the real build at 1290×2796 (and 2064×2752), staged per `APP_STORE.md` §5, ranked: decision sheet, home, market, pitch, feed, table, squad, club identity. |
| **Anything containing the wordmark, a caption or any typography** | The type stack is system SF Pro; a generator cannot set it, and generated glyphs are always subtly wrong. Every prompt above bans text for this reason. | Generate the plate, then set type in a design tool — on glass, never directly on imagery. |
| **`favicon.ico`** | It is a multi-resolution container derived from the existing `favicon.svg`, not artwork. | Re-run `tools/brand/render.mjs` against `icon.html` and pack 16/32/48 px into the `.ico`. |
| **Club crests, kits and player portraits** | `ClubBadge`, `kit.ts` and `face.tsx` are seeded generators that must scale to newgens forever. A file cannot cover an unbounded set, and `LICENSING_ARCHITECTURE.md` G7 requires generated identities to come from an original component set. | Extend the generator. Hand-painted plates are only ever an *overlay* on top of it. |
| **Real creator or footballer likenesses** | `LICENSING_ARCHITECTURE.md` §6.1: no real person, no photo, no caricature, **and no "legally distinct" near-miss**. Licensed identities enter through `RightsMetadata`, never through the art pipeline. | Nothing. Base content is 100% fictional. |
| **Real stadiums, league marks, sponsor boards, broadcast overlays** | Same section: no recognisable stadium architecture, no real crest, no sponsor mark, no reproduction of a real broadcast graphics package. | The prompts above explicitly ban all of these in their negatives; keep them there. |

---

## 8. Integration notes

### 8.1 The override contract

Everything under `apps/game/public/` is served from the site root: `public/art/heroes/title-stadium.webp`
→ `/art/heroes/title-stadium.webp`. Nothing imports these through the bundler, so a missing file is
a 404 on an `<img>`/`Image()`, not a build error.

Every consumer follows the same shape — **probe, then fall back to the procedural component**:

```tsx
// The image is decoration. The scene is the product.
<div className="relative">
  <HeroScene variant="title" />           {/* always mounted; always correct */}
  <img
    src="/art/heroes/title-stadium.webp"
    alt=""
    aria-hidden
    loading="eager"
    decoding="async"
    onError={(e) => { e.currentTarget.style.display = 'none'; }}
    className="absolute inset-0 h-full w-full object-cover"
  />
</div>
```

Rules that apply to every class:

1. **The procedural component is never unmounted.** The raster covers it; it does not replace it.
2. **`onError` hides the override, never surfaces an error.** No retry, no toast, no console noise.
3. **Overrides are `aria-hidden` decoration.** They carry no information (DESIGN_SYSTEM §8.6).
4. **Reduced transparency and `[data-reduced-effects='true']` hide the override first**, exactly as
   they already hide the procedural drawing — the wrapper's solid fill is what remains.
5. **No override is on the critical path.** Nothing awaits a decode before rendering a screen.

### 8.2 Per-class specifics

| Class | Path prefix | Fallback | Notes |
|---|---|---|---|
| Hero scenes (B1–B3) | `/art/heroes/` | `HeroScene` in `design/hero/scenes.tsx` | `object-fit: cover`, never letterbox. Scrim is baked into the file. |
| Trophies (B4a–B4e) | `/art/trophies/` | `Silverware` in `design/domain/silverware.tsx` | Hero sizes only. Lists and anything under 34 px keep the SVG — the raster costs a decode for no visible gain. |
| Reveal kit (B6a–B6b) | `/art/heroes/` | rays + crossfade in `HeroReveal` | `ClubBadge` composites on top at runtime; the burst's centre must stay transparent. |
| Story plates (B7a–B7e) | `/art/stories/` | `MOTIF_ART` in `design/domain/feed.tsx` | Tint the recolourable stroke with the story's seeded accent via a CSS filter or a masked fill; do not bake colour in. |
| Textures & sprites (B5, C1–C5) | `/art/textures/`, `/art/sprites/` | `.cf-foil`, `design/surfaces/material.ts`, `pitchRenderer.ts` gradients | The pitch renderer must sprite-cache a loaded image once and keep drawing its gradient until the decode resolves. |
| Audio (D1–D8) | `/audio/` | `createWebAudioDriver()` in `design/audio.ts` | Install a file-backed `AudioDriver` via `setAudioDriver()`; on any load failure, call `setAudioDriver(null)` to restore synthesis. Honour `GameSettings.sound` and page visibility exactly as the built-in driver does. |
| Icon / splash / web | xcassets, `website/` | none — these are the only genuinely required files | Must stay in sync with `--color-base` `#08090B` across `capacitor.config.ts`, the launch screen and the `theme-color` meta. |

### 8.3 Filenames are contracts

The destination paths in this document are the exact strings the code will probe. A file at
`/art/heroes/title_stadium.webp` or `/art/trophies/superCup.webp` is not a broken override — it is
*no override at all*, and it looks identical to the asset not having been made. Copy the paths.

---

*Every prompt in this pack was derived from `docs/DESIGN_SYSTEM.md`, `apps/game/src/design/tokens.css`
and the shipped procedural art it must sit beside. If a token changes, the hex values here change
with it — the design system is the source of truth, not this document.*
