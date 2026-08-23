# Creator Football — Asset Production Plan

> Companion to `docs/MASTER_PROMPT.md`. Answers: *"what assets do I need to create that fit the
> game?"* Derived from a full inventory of every procedural art system in the codebase (August 2026).
>
> **Prime directive:** every hand-made asset is an *override layer* over a working procedural path —
> never a replacement, never load-bearing if the file fails to load. This preserves the repo's
> "no 404s" guarantee and the licensing fallback architecture.

---

## 1. Current state (what renders today — all code, zero image/audio assets)

| System | File | What it draws |
|---|---|---|
| Seed engine | `apps/game/src/design/seed.ts` | Deterministic `SeedStream`; basis of all art |
| Faces | `design/domain/PlayerPortrait.tsx` | Seeded SVG faces (10 skin tones, hair styles/colours, facial hair), club-gradient backdrop; CreatorAvatar + tier rings variant |
| Manager portrait | `features/creation/ManagerPortrait.tsx` | Touchline outfits + accessories for customiser |
| Club crests | `design/domain/ClubBadge.tsx` | Shape×Pattern×Motif geometric emblems — best visual in the product; keep procedural forever (scales to newgens) |
| Live pitch | `features/matchday/live/pitchRenderer.ts` | Canvas 2D: pre-rasterised turf, sprite-cached shirts, ball gradients, possession wash, WIDE/FOLLOW cameras |
| Kits | `features/matchday/shared/kit.ts` | Per-club palettes, keeper strips, contrast-safe ink |
| News art | `design/domain/feed.tsx` (`StoryArt`) | Abstract skewed colour bands from `imageSeed` |
| Hero moments | `design/hero/moments.tsx` | GoalBurst volt wordmark, HeroReveal rays, TrophyMoment (**renders a 112px line icon — no real trophy art exists**), SigningMoment card flip |
| Effects | `design/hero/effects.tsx` | ShinyText, SpotlightCard, GlareHover, GradualBlur |
| Textures | `design/surfaces/material.ts` + tokens.css | CSS-only pitch/stadium/haze textures |
| Icons | `design/icons.tsx` | ~60 hand-drawn 24px stroke icons |
| Audio | `design/audio.ts` | WebAudio-synthesised cue set (whistles, goal roar, crowd bed, UI, fanfares) — no files, no network |

Static assets that exist: iOS `AppIcon-1024.png` + three identical splash copies; website favicon
data-URI SVG. **No og:image despite declaring `summary_large_image`.** Audio is no longer empty:
Audio pack v1 shipped as synthesis rather than files (§3), so haptics and sound now run side by
side off the same call sites.

---

## 2. P0 — launch-blocking (~15 files)

| Asset | Spec → destination | Notes |
|---|---|---|
| Final app icon master | SVG master + PNG 1024² → xcassets `AppIcon` | Polish the existing volt-ball mark; verify legibility at 40–60px |
| Splash final | PNG 2732² (+ dark variant) → replace 3 identical Splash copies | Mark + wordmark on `#08090B` |
| Store screenshots ×8 (+3 iPad optional) | PNG 1290×2796 → App Store Connect | Conversion-ranked per APP_STORE.md §5: decision sheet, home, market, pitch, feed, table, squad, club identity. Needs staged game states |
| Web favicon set | `favicon.svg`, `favicon.ico`, `icon-192.png`, `apple-touch-icon.png` 180² → `website/` | Derive from icon master |
| Social share card | 1200×630 JPG/WebP → `website/og-image.jpg` + add og/twitter meta tags | Currently declared but missing |
| ASC marketing icon | PNG 1024² | Same master as app icon |

## 3. P1 — high player-visible (~55–90 items)

| Asset | Spec → destination | Consumer / fallback |
|---|---|---|
| Trophy silverware set | 1 champion cup + 3–5 competition variants; SVG ≤512 viewBox or WebP 512² → `public/art/trophies/` | `TrophyMoment` (product's biggest moment currently renders an icon), TrophyRoom plinths, History. Keep `IconTrophy` as absent-file fallback |
| Portrait upgrade | Artist-expanded feature library inside the seeded generator (textured hair types, accessories, expressions) OR ~10 hand-painted style plates WebP 240² | Must keep seeded generation for 20k+ players/newgens — plates are overlays, not replacements |
| Title hero scene | Stadium-at-dusk full-bleed backdrop (crowd bokeh, floodlights, volt accents); layered WebP/SVG ≈1179×2556 → `public/art/heroes/title-stadium.webp` | TitleScreen/onboarding; typographic-only layout must survive reduced-transparency |
| Result backdrops ×2 | Triumph + consolation, WebP 1179×2556 | MatchResultScreen, season summary |
| ~~**Audio pack v1**~~ **DONE — synthesised, not recorded** | crowd ambience bed, goal roar swell, kick-off/full-time whistles, UI tick/select, escalating decision-timer tick, trophy fanfare, signing sting, reward chime → `apps/game/src/design/audio.ts` | Built with oscillators + seeded noise buffers + filters instead of `.m4a`, per the prime directive: zero bytes on disk means zero 404s and no licensing. Mirrors the `haptics.ts` driver pattern (`setAudioDriver`), silent no-op without WebAudio, gated on the `Sound effects` setting (`GameSettings.sound`, default on) and on page visibility. A recorded pack can still land later as an `AudioDriver` override |
| Legendary card foil | Seamless tile WebP 512² → `public/art/cards/foil.webp` | PlayerCard legendary variant + GlareHover; plain glass fallback |
| Editorial illustrations ×5 | transfer/injury/rivalry/fan-culture/result-reaction; SVG 400×200 → `public/art/news/` | StoryArt override; seeded bands remain default |
| Club-reveal celebration kit | Crest-assemble choreography (Lottie/motion) + 1 SFX | HeroReveal on creation; rays+crossfade fallback |

## 4. P2 — polish (~15–22 items)

Stadium-bowl haze plate (WebP 1600×900) · ball sprite upgrade with seam detail (128² @2x canvas
sprite) · kit fabric micro-noise tile 256² · reward-fly particle sheet · special-rule sweep VFX ·
website device mockups ×3–6 rendered from live build · Android adaptive icon layers (when Android
ships) · ambient audio v2: crowd intensity loops ×3 + rain variant.

---

## 5. Style guide for any artist (condensed; full rules in DESIGN_SYSTEM.md)

- **Material:** premium broadcast graphics, dark glassmorphism — not a website, not a cartoon.
- **Palette:** graphite base `#050607/#08090B`; surfaces `#0E1013→#262B33`; ink `#F4F6F8`, muted
  `#9AA3AD`, faint `#646D78`. Volt accent `#C8FF2E` (bright `#DCFF6B`, deep `#9ECC12`) = state only,
  ≤3% of pixels. Semantic: win `#34D399`, warn `#FBBF24`, danger `#F4525A`, info `#7C8CFF`,
  special `#A78BFA`. Trophy gold `#B8862B→#FFD76A`. Pitch: desaturated near-black greens
  (`#0A1410/#0E1C16`), lines white@16%.
- **Shape:** radii ladder 6/10/14/20/26/34/pill. Bold geometric emblems — NO pseudo-heraldry,
  no clip-art, one specular sheen max.
- **Motion:** transform+opacity only; exits faster than entries; bouncy springs = celebrations only;
  assets must survive reduced-motion (crossfade) and reduced-transparency (solid surfaces).
- **Type:** system SF Pro stack; tabular numerals; text never sits directly on imagery — always glass.
- **Legal:** 100% fictional universe. No real names/likenesses/crests/kits/handles/broadcast marks,
  no near-misses. Any licensed art needs a fictional fallback that degrades whole-entity.

## 6. Where to spend first

1. **P0 store screenshots + icon/splash polish** — unblockable presence gap, cheapest conversion win.
2. ~~**Audio pack v1**~~ — shipped as synthesis (`design/audio.ts`). A recorded pack is now an
   optional override, not a gap.
3. **Trophy set** — the product's biggest moment deserves real art.
4. **Title hero scene** — audit-flagged cheapest perceived-production-value win.

Totals: **P0 ≈15 files · P1 ≈55–90 items · P2 ≈15–22 items.**
