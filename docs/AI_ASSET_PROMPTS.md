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
   post-processing, acceptance checks.
2. **Paste the prompt verbatim** into Midjourney / Higgsfield / DALL·E / SDXL / Flux (images) or
   ElevenLabs SFX / Suno-class tools (audio). Every prompt already inlines the universal style block
   and the palette — you never assemble fragments, and the tool never needs repo context.
3. **Post-process per spec.** Nothing ships straight out of a generator: crop, scrim, compress.
4. **Drop it at the exact destination path.** Filenames are contracts (§6). A typo silently means
   "no override", which looks identical to "asset not made yet".
5. **Verify against the acceptance checklist** before committing.

### 1.1 Universal style block (already inlined in every prompt below)

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

### 1.2 Universal negative prompt (already inlined in every entry below)

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

- **Aspect ratio.** Midjourney-style flags are given as `--ar`. For SDXL/Flux, generate at the
  nearest supported bucket and upscale; the entry states the final pixel size, which is the
  contract, not the generation size.
- **Compression.** `cwebp -q 82 -m 6 in.png -o out.webp` for photographic plates,
  `cwebp -q 90 -alpha_q 100` for anything with alpha, `pngquant --quality 80-95` + `oxipng -o4`
  for the PNGs the store requires. Weight budgets below are hard ceilings, not targets.
- **Text safety.** Any plate that sits behind UI must end its post-process with a bottom-weighted
  scrim: multiply a `#050607` linear gradient (0% at the top of the safe area → 62% at the bottom)
  before compressing. The design system forbids text sitting directly on imagery.

---

## 2. P0 — launch-blocking

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

## 3. P1 — high player-visible

All P1 image overrides live under `apps/game/public/art/…` and are served from `/art/…`. Each has a
procedural component behind it (§6).

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

**Post-processing.** Crop to 1179×2556. Bottom scrim as B1. Desaturate the gold by ~10% if it reads
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

**Post-processing.** Crop to 1179×2556. Bottom scrim as B1, but lighter (max 50%) — this plate is
already dark and over-scrimming turns it to mud. `cwebp -q 82 -m 6`.

**Acceptance.** ☐ Same ground geometry as B1/B2. ☐ Rain is visible but never the subject.
☐ No volt anywhere; the only accent is indigo. ☐ `#F4F6F8` text on glass still passes 7:1 over the
brightest region. ☐ ≤300 KB.

---

### B4 — Trophy hero renders ×5

**Purpose / where.** Optional painted upgrades over the five hand-authored SVGs in
`design/domain/silverware.tsx`, used at hero scale only (TrophyMoment, the trophy room). The SVGs
remain the source of truth for lists and small sizes — a render must **agree with the silhouette**,
not reinterpret it. All five sit on a 100×132 box with a two-tier plinth occupying the bottom
quarter and a recessed dark engraving band across it, and all five are lit from the upper left with
exactly one sheen.
**Destination.** `apps/game/public/art/trophies/{league,cup,super-cup,boot,legacy}.webp` — WebP with
alpha, 600×792 (the 100:132 box at 6×), **≤120 KB each**.

Shared preamble — **inline this at the top of each of the five prompts**:

```
A single fictional gold trophy, centred, isolated on a fully transparent background, lit from the
upper left by one cool key light with one soft fill. The metal is a spun gold with a six-stop
ramp: #7A5716 in the shadow, #B8862B on the turn, #FFD76A on the lit face, #FFF0C4 at the hot
core, #D8A441 cooling, #8A6320 at the far edge. Exactly one specular sheen runs down the
upper-left flank of the piece; there is no second highlight anywhere. The trophy stands on a
two-tier dark graphite plinth, #14171B over #0E1013, with a recessed near-black engraving band
across its front carrying two blank ruled lines and one tiny electric-lime #C8FF2E tick at the
right end — the only non-gold colour in the image, under 1% of the frame. Vertical composition,
the piece filling about 80% of the frame height above the plinth. Premium broadcast-graphics art
direction, product-render lighting, film-grade contrast, no environment, no floor, no reflection.
```

| Variant | Subject sentence to append | File |
|---|---|---|
| **league** | `The trophy is a tall fluted chalice: a wide flared bowl tapering to a rounded base, three shallow vertical flutes running down its face, a bright horizontal rim band across the top that is the brightest element on the piece, and two long swept handles that arc outward from just below the rim and curl back in at the bowl's waist. Below the bowl, a short stem, a flattened spherical knop, and a tapered foot onto the plinth.` | `league.webp` |
| **cup** | `The trophy is squat, wide and lidded: a shallow broad bowl, a domed lid above a bright horizontal collar, and a small spherical finial on a short post at the very top. Two closed vertical ring handles sit on either side, taller than they are wide, passing behind the bowl's edge. A recessed dark rectangular panel crosses the bowl's face with one blank ruled line, and a faint eight-point star is embossed low on the bowl. Short stem, tapered foot onto the plinth.` | `cup.webp` |
| **superCup** | `Not a cup: a broad shield-shaped salver on a low stand. The shield is wide at the shoulders, straight-sided, and sweeps to a rounded point at the bottom. Its face is recessed dark, and a geometric radial star with eight straight bars sits at its centre, with a small dark circle at the hub and a tiny electric-lime dot at the very middle. A blank recessed nameplate crosses the shield low down. The shield sits on a short square post and a tapered foot onto the plinth.` | `super-cup.webp` |
| **boot** | `The trophy is a gold football boot mounted at a fourteen-degree tilt on a slim vertical post. The boot is stylised and geometric — a smooth sole plate, a clean low-cut upper, four straight lace bars across the instep, and four rounded studs under the sole. No branding, no side stripes, no panel stitching. The post runs from the boot's heel down to a tapered foot on the plinth.` | `boot.webp` |
| **legacy** | `The trophy is a tapered monolith: a four-sided column, wider at the base than the top, with a faceted pyramidal cap. A recessed near-black panel runs most of the column's height, and three five-pointed gold stars are stacked evenly up it, equal in size. A bright horizontal collar crosses just above the plinth. Severe, counted, dynastic.` | `legacy.webp` |

**Negative prompt (all five)**

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
600×792 box and the piece is horizontally centred. **Overlay the corresponding SVG at 30% opacity
and check the silhouettes align within ~4% before accepting.** `cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Silhouette matches its SVG counterpart within ~4%. ☐ Exactly one sheen.
☐ Volt appears once, as a tick on the engraving band, under 1% of pixels. ☐ Zero engraved glyphs.
☐ Alpha is clean at 100% zoom, no green fringe. ☐ ≤120 KB.

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

**Purpose / where.** `HeroReveal` at the end of club creation — the payoff for the customiser. This
is the one P1 item ASSET_PLAN §6 still lists as genuinely absent. The kit is **two plates plus one
SFX**; the crest itself is always the procedural `ClubBadge` composited on top at runtime, never
generated (§5).
**Destination.**
- `apps/game/public/art/heroes/reveal-burst.webp` — WebP with alpha, 1024×1024, ≤90 KB (radial ray
  plate, scaled and rotated behind the crest).
- `apps/game/public/art/heroes/reveal-motes.webp` — WebP with alpha, 1024×1024, ≤60 KB (drifting
  light motes, one layer, parallaxed).
- SFX: see **D7 Signing sting** (the reveal reuses `signingSting`).

Prompt — **burst plate**:

```
A radial light burst isolated on a fully transparent background, centred, with a completely empty
hole in the middle about 34% of the frame's width where nothing is drawn. From the edge of that
hole, twelve soft tapered rays of light fan outward to the frame edges, alternating long and
short, each fading to nothing before it arrives. The rays are cool white #F4F6F8 at their base
falling to #9AA3AD, with three of the twelve tinted electric lime #C8FF2E at low opacity as the
only accent, under 3% of the frame. A faint circular haze ring surrounds the hole. Everything is
soft-edged, diffuse and low contrast; no ray has a hard boundary. Premium broadcast-graphics art
direction, film-grade contrast, blacks retain detail, rendered CGI quality, not photography.
--ar 1:1
```

Prompt — **motes plate**:

```
A scatter of soft out-of-focus light motes isolated on a fully transparent background, evenly
distributed with no cluster and no centre. About forty circular bokeh points at varying sizes from
tiny to medium, all very soft-edged, in cool white #F4F6F8 and muted #9AA3AD at low opacity, with
four or five motes tinted electric lime #C8FF2E. No mote is fully opaque. No streaks, no trails,
no shapes other than circles. Premium broadcast-graphics art direction, film-grade contrast,
rendered CGI quality, not photography.
--ar 1:1
```

**Negative prompt (both)**

```
text, letters, numbers, typography, watermark, signature, logo, brand marks, crest, badge, shield,
emblem, heraldry, real club crests, real people, faces, silhouettes, cartoon, clip art, fireworks,
pyrotechnics, sparks, confetti, streamers, ticker tape, glitter, star shapes, cross flares, lens
flare, anamorphic streak, chromatic aberration, rainbow, saturated colours, hard-edged rays,
god rays through clouds, sun, background, sky, environment, solid background, black background,
white background, border, frame, vignette
```

**Post-processing.** Both plates: remove background to true alpha, confirm the burst's central hole
is fully transparent (the crest lands there). Premultiply nothing — the runtime composites with
`screen`. `cwebp -q 88 -alpha_q 100`.

**Acceptance.** ☐ Burst centre is 100% transparent across a 340 px-wide circle. ☐ No ray has a hard
edge at 200% zoom. ☐ Volt under 3% on each plate. ☐ Both plates survive being rotated arbitrarily
without revealing a seam or a corner. ☐ Kit degrades to the existing rays+crossfade if absent.

---

### B7 — Editorial news illustration plates ×5

**Purpose / where.** Optional painted upgrades over the five inline motifs in `StoryArt`
(`design/domain/feed.tsx`): transfer, injury, rivalry, fans, result. They sit on a 200×100 plate
behind the seeded colour bands at the head of a lead feed story, and are seen at roughly 28 px tall
in a list — **so they must read as one shape at thumbnail size.** The story's seeded accent colour
is applied at runtime, so generate the accent element in a neutral light tone the app can tint.
**Destination.** `apps/game/public/art/stories/{transfer,injury,rivalry,fans,result}.webp` — WebP
with alpha, 800×400 (the 200×100 plate at 4×), **≤40 KB each**.

Shared preamble — **inline this at the top of each of the five prompts**:

```
A single editorial pictogram, isolated on a fully transparent background, centred, occupying about
70% of a 2:1 landscape frame. Drawn as clean geometric line work of uniform weight — strokes about
2 units on a 100-unit grid — with round caps and round joins, no fill, no shading, no gradient, no
perspective. Lines are ink #F4F6F8 at high opacity for the structure and muted #9AA3AD at low
opacity for secondary detail; exactly one element in the drawing is picked out in a slightly
heavier stroke in pale neutral #E8ECEF, which will be recoloured later. Node count is deliberately
low: the whole drawing is under a dozen strokes. Premium broadcast-graphics art direction,
editorial pictogram, reads as one silhouette at thumbnail size.
```

| Motif | Subject sentence to append | File |
|---|---|---|
| **transfer** | `A contract sheet with a folded top-right corner, three short ruled text lines across its body, and a fountain pen crossing it diagonally from the upper right. The heavier neutral stroke is the looping signature scrawled across the lower part of the sheet.` | `transfer.webp` |
| **injury** | `A thick medical cross, and a horizontal heartbeat trace running straight through it from edge to edge. The heavier neutral stroke is the trace itself, which spikes once and then flatlines toward the right.` | `injury.webp` |
| **rivalry** | `Two simplified shield outlines turned away from each other, one tilted slightly left and one slightly right, with a clear empty gap between them. The heavier neutral stroke is a lightning bolt filling that gap vertically.` | `rivalry.webp` |
| **fans** | `A supporters' scarf held taut and overhead, drawn as two arcing bands with four short fringe strokes hanging beneath, and behind it a rectangular flag on a vertical pole. The heavier neutral stroke is the flag.` | `fans.webp` |
| **result** | `A rounded scoreboard panel containing two blank rounded plates side by side with a short dash between them — no digits. Six short rays burst outward from the panel's corners and top. The heavier neutral stroke is the right-hand plate and the rays.` | `result.webp` |

**Negative prompt (all five)**

```
text, letters, words, numbers, digits, scoreline, typography, watermark, signature as typography,
logo, brand marks, real club crests, heraldry, lions, eagles, crowns, real people, faces, hands,
bodies, crowd, cartoon, mascot, anime, 3D render, isometric, shading, gradient, drop shadow,
fill colour, colour, saturated colour, thick black outlines, sketchy hand-drawn line, variable
stroke weight, calligraphy, background, solid background, white background, border, frame, circle
badge behind the icon, busy detail, more than a dozen strokes, perspective, depth
```

**Post-processing.** Remove background to true alpha. Normalise stroke weight across all five so
they read as one set (overlay them and compare). Scale each to occupy the same optical area.
`cwebp -q 90 -alpha_q 100`.

**Acceptance.** ☐ Each is identifiable at 28 px tall. ☐ All five share the same stroke weight.
☐ Exactly one element per plate is in the recolourable neutral. ☐ No digits on the result plate.
☐ ≤40 KB each.

---

### B8 — Website device-mockup scene

**Purpose / where.** The hero band on `website/index.html`. Note the split: the **device shell and
environment** may be generated; the **screen content must be a real capture of the build** (§5).
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

## 4. P2 — polish

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
completely desaturated neutral grey around 50% luminance. The weave is a fine regular knit with a
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

## 5. Audio

`design/audio.ts` already synthesises the whole cue set with WebAudio, so **every file here is an
override**, installed as an `AudioDriver` via `setAudioDriver()` — not a gap. The synthesised pack
stays the fallback and is what plays when the files fail to load.

**House rules for the whole pack.** Dark, restrained, broadcast — the audio equivalent of the
graphite palette. Cues are short and mixed low; ambience is a floor, never an event. No music beds
under UI. No voice, ever. No real stadium recordings, no real chants, no recognisable songs
(the licensing architecture forbids real identity in audio exactly as it does in art).

**Format for all cues.** Render at 48 kHz / 24-bit, deliver **AAC-LC `.m4a` 128 kbps** as primary
and **Ogg Vorbis `.ogg` q4** as fallback. Destination `apps/game/public/audio/<cue>.{m4a,ogg}` —
the basename must equal the `SfxCue` string exactly. Trim silence to zero at both ends except where
a loop is specified. True peak ≤ −1.0 dBTP on every file.

| # | Cue (`SfxCue`) | Duration | Integrated loudness | Budget (per format) |
|---|---|---|---|---|
| D1 | *ambience bed* → `crowd-bed` | 20 s, seamless loop | −34 LUFS | ≤180 KB |
| D2 | `goalRoar` | 2.2 s | −16 LUFS | ≤40 KB |
| D3 | `kickOff` / `fullTime` | 0.9 s / 1.8 s | −18 LUFS | ≤24 KB each |
| D4 | `decisionTick` | 0.12 s ×3 intensities | −22 LUFS | ≤10 KB each |
| D5 | `trophyFanfare` | 2.6 s | −15 LUFS | ≤48 KB |
| D6 | `signingSting` | 1.6 s | −18 LUFS | ≤32 KB |
| D7 | `rewardChime` | 0.7 s | −20 LUFS | ≤16 KB |
| D8 | `uiTick` / `uiSelect` | 0.06 s / 0.11 s | −26 LUFS | ≤8 KB each |

---

### D1 — Crowd ambience loop (+ v2 variants)

**Purpose / where.** The floor under a live match, started and stopped by `AudioDriver.ambience()`.
It must be unnoticeable — the moment a player can identify a repeating detail, it has failed.
**Destination.** `apps/game/public/audio/crowd-bed.m4a` + `.ogg`. P2 "ambient audio v2" adds
`crowd-bed-low`, `crowd-bed-high` and `crowd-bed-rain` at the same spec, crossfaded by intensity.

```
A seamless 20-second loop of distant football-crowd ambience recorded from high in an empty-ish
stand. Dense, diffuse, wide stereo murmur with no individual voices audible and no words, no
chanting, no singing, no drums, no clapping pattern, no whistling. Low-frequency room rumble under
a smooth mid-band wash; gentle slow swells of two or three decibels every few seconds so it
breathes, but no event, no peak, no reaction. Reverberant, far away, behind glass. Neutral in
mood — neither excited nor hostile. Mixed very low as a background floor. The last second must
match the first for a click-free loop.
```
Variants: `crowd-bed-low` = thinner, sparser, half the swell depth. `crowd-bed-high` = denser and
one stop more energetic, still with no identifiable chant. `crowd-bed-rain` = the base bed with a
fine, even rain hiss layered under it and slightly less high-frequency air.

**Negative prompt / avoid**

```
voices, words, speech, commentary, announcer, PA system, chanting, singing, football songs, drums,
horns, vuvuzela, air horn, clapping rhythm, whistles, referee whistle, ball kicks, music, melody,
tonal drone, synth pad, hum, 50Hz buzz, mono, narrow stereo, sudden peaks, applause bursts,
laughter, children, animals, traffic, wind buffeting, clipping, pumping compression, audible loop
point, room tone silence
```

**Post-processing.** Crossfade the last 500 ms into the head, then verify a zero-crossing at the
splice. High-pass at 30 Hz. Loudness-normalise to −34 LUFS integrated, true peak −1.0 dBTP.
Encode AAC-LC 128 kbps + Ogg q4. Play it on loop for five minutes and listen for a recurring event.

**Acceptance.** ☐ No click, thump or level jump at the loop point after 10 consecutive plays.
☐ No identifiable voice, word or chant. ☐ −34 LUFS ±0.5. ☐ Stereo width is wide but mono-compatible
(no phase cancellation on fold-down). ☐ ≤180 KB per format.

---

### D2 — Goal roar

**Purpose / where.** `goalRoar`, behind H1 "goal scored (yours)". Sits *under* the visual, not on
top of it. Never fires for a conceded goal — H2 is deliberately smaller.

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

### D3 — Whistles

**Purpose / where.** `kickOff` (one long peep, match starts) and `fullTime` (three peeps, it is
over). The most literal cues in the pack and the easiest to get wrong by making them loud.

```
kickOff: a single referee's whistle blast, 0.9 seconds, one clean sustained pea-whistle tone with
a fast attack, a steady body with a light natural warble, and a short natural release. Recorded at
distance in a large reverberant stadium space so the tail carries a short slap and a wide diffuse
decay. Bright but not piercing; the fundamental sits around 3.4 kHz with a controlled harmonic
above it. Nothing else in the recording.

fullTime: three referee's whistle blasts over 1.8 seconds — short, short, long — with about 180
milliseconds between the first two and 220 before the last, the final blast held roughly twice as
long as the others and released with a slight downward bend. Same whistle, same distant
reverberant stadium space as the single blast. Nothing else in the recording.
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
speakers held close. Match the two files' whistle timbre exactly (render both from one source).
Normalise both to −18 LUFS, limit to −1.0 dBTP.

**Acceptance.** ☐ Both files are audibly the *same whistle*. ☐ No energy above 12 kHz.
☐ `fullTime` reads unambiguously as three blasts at phone-speaker volume. ☐ Neither is the loudest
thing in the pack. ☐ ≤24 KB per file per format.

---

### D4 — Decision tick

**Purpose / where.** `decisionTick`, the countdown under H5's timed decision prompt. Fired
repeatedly as the volt ring drains, with `intensity` escalating. Three files, crossfaded by
intensity — this is the cue most at risk of becoming irritating, so it is the quietest.

```
A single short mechanical tick, 120 milliseconds, dry and close: a small wooden-and-metal click
with a sharp transient, a brief woody body around 900 Hz and almost no tail. Precise, neutral,
clock-like rather than musical. No pitch centre a listener could hum. Completely dry — no
reverberation, no room, no space.

Escalation variants, identical in character: the low-intensity tick is softer, duller and slightly
lower; the mid tick is the reference above; the high-intensity tick is brighter and tighter with a
faster transient and a touch more high-frequency snap, and reads as more urgent purely through
timbre, not through being louder.
```

**Negative prompt / avoid**

```
melody, tone, pitch, musical note, bell, chime, beep, sine, square wave, synth blip, digital UI
sound, watch alarm, alarm clock, buzzer, reverb, delay, echo, room ambience, stereo width, crowd,
voices, music, long tail, sustain, whoosh, riser, distortion, clipping, harshness above 9 kHz,
double click, flam, inconsistent timbre between variants
```

**Post-processing.** Trim to exactly 120 ms with a 2 ms fade-out. Keep all three variants within
2 LU of each other — escalation is timbral, never a volume ramp. Normalise to −22 LUFS.

**Acceptance.** ☐ Under 130 ms including tail. ☐ No perceptible pitch. ☐ The three variants read as
one object getting more urgent. ☐ Fired 20 times in 10 seconds it is still tolerable. ☐ ≤10 KB each.

---

### D5 — Trophy fanfare

**Purpose / where.** `trophyFanfare`, H9 — the biggest moment in the product. The only cue allowed
to feel like a fanfare, and the only one allowed to be tonal.

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

### D8 — UI tick and select

**Purpose / where.** `uiTick` (value moved under the finger: tab, segmented control) and `uiSelect`
(a choice committed: primary button). The quietest things in the product; they should register as
texture, not as sound.

```
uiTick: a 60-millisecond soft click. A single tiny transient with a very short damped body and no
tail, dry and close, neutral in timbre with no discernible pitch. The sound of a well-made switch,
heard quietly.

uiSelect: a 110-millisecond soft click with slightly more body than the tick and one very short,
low-level tonal ring at its tail — just enough to read as confirmation rather than movement. Same
dry, close, neutral character. No melody, no pitch a listener could hum.
```

**Negative prompt / avoid**

```
beep, sine tone, melody, musical note, chime, bell, digital UI sound, iOS keyboard click, camera
shutter, typewriter, mouse click stock sound, buzzer, error tone, notification, alert, reverb,
delay, echo, room ambience, stereo width, long tail, sustain, whoosh, distortion, clipping,
harshness above 9 kHz, double click, flam, inconsistent timbre between the two
```

**Post-processing.** Render both from the same source so they are audibly the same object.
Normalise to −26 LUFS. Verify on a phone speaker at 30% volume that neither is startling.

**Acceptance.** ☐ Both under their stated duration including tail. ☐ Audibly one family.
☐ No pitch. ☐ At −26 LUFS they sit below the ambience bed's peaks. ☐ ≤8 KB each per format.

---

## 6. Do NOT generate with AI

| Never generate | Why | Do this instead |
|---|---|---|
| **App Store screenshots ×8 (+3 iPad)** | Apple guideline 2.3.1 requires screenshots to show the actual product. A generated or mocked-up screen is a rejection. | Capture the real build at 1290×2796 (and 2064×2752), staged per `APP_STORE.md` §5, ranked: decision sheet, home, market, pitch, feed, table, squad, club identity. |
| **Anything containing the wordmark, a caption or any typography** | The type stack is system SF Pro; a generator cannot set it, and generated glyphs are always subtly wrong. Every prompt above bans text for this reason. | Generate the plate, then set type in a design tool — on glass, never directly on imagery. |
| **`favicon.ico`** | It is a multi-resolution container derived from the existing `favicon.svg`, not artwork. | Re-run `tools/brand/render.mjs` against `icon.html` and pack 16/32/48 px into the `.ico`. |
| **Club crests, kits and player portraits** | `ClubBadge`, `kit.ts` and `face.tsx` are seeded generators that must scale to newgens forever. A file cannot cover an unbounded set, and `LICENSING_ARCHITECTURE.md` G7 requires generated identities to come from an original component set. | Extend the generator. Hand-painted plates are only ever an *overlay* on top of it. |
| **Real creator or footballer likenesses** | `LICENSING_ARCHITECTURE.md` §6.1: no real person, no photo, no caricature, **and no "legally distinct" near-miss**. Licensed identities enter through `RightsMetadata`, never through the art pipeline. | Nothing. Base content is 100% fictional. |
| **Real stadiums, league marks, sponsor boards, broadcast overlays** | Same section: no recognisable stadium architecture, no real crest, no sponsor mark, no reproduction of a real broadcast graphics package. | The prompts above explicitly ban all of these in their negatives; keep them there. |

---

## 7. Integration notes

### 7.1 The override contract

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

### 7.2 Per-class specifics

| Class | Path prefix | Fallback | Notes |
|---|---|---|---|
| Hero scenes (B1–B3) | `/art/heroes/` | `HeroScene` in `design/hero/scenes.tsx` | `object-fit: cover`, never letterbox. Scrim is baked into the file. |
| Trophies (B4) | `/art/trophies/` | `Silverware` in `design/domain/silverware.tsx` | Hero sizes only. Lists and anything under 34 px keep the SVG — the raster costs a decode for no visible gain. |
| Reveal kit (B6) | `/art/heroes/` | rays + crossfade in `HeroReveal` | `ClubBadge` composites on top at runtime; the burst's centre must stay transparent. |
| Story plates (B7) | `/art/stories/` | `MOTIF_ART` in `design/domain/feed.tsx` | Tint the recolourable stroke with the story's seeded accent via a CSS filter or a masked fill; do not bake colour in. |
| Textures & sprites (B5, C1–C5) | `/art/textures/`, `/art/sprites/` | `.cf-foil`, `design/surfaces/material.ts`, `pitchRenderer.ts` gradients | The pitch renderer must sprite-cache a loaded image once and keep drawing its gradient until the decode resolves. |
| Audio (D1–D8) | `/audio/` | `createWebAudioDriver()` in `design/audio.ts` | Install a file-backed `AudioDriver` via `setAudioDriver()`; on any load failure, call `setAudioDriver(null)` to restore synthesis. Honour `GameSettings.sound` and page visibility exactly as the built-in driver does. |
| Icon / splash / web | xcassets, `website/` | none — these are the only genuinely required files | Must stay in sync with `--color-base` `#08090B` across `capacitor.config.ts`, the launch screen and the `theme-color` meta. |

### 7.3 Filenames are contracts

The destination paths in this document are the exact strings the code will probe. A file at
`/art/heroes/title_stadium.webp` or `/art/trophies/superCup.webp` is not a broken override — it is
*no override at all*, and it looks identical to the asset not having been made. Copy the paths.

---

*Every prompt in this pack was derived from `docs/DESIGN_SYSTEM.md`, `apps/game/src/design/tokens.css`
and the shipped procedural art it must sit beside. If a token changes, the hex values here change
with it — the design system is the source of truth, not this document.*
