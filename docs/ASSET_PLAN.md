# Creator Football — Asset Production Plan

> Companion to `docs/MASTER_PROMPT.md`. Answers: *"what assets do I need to create that fit the
> game?"* Derived from a full inventory of every procedural art system in the codebase (August 2026).
>
> **Producing the assets:** `docs/AI_ASSET_PROMPTS.md` holds copy-paste-ready generation prompts,
> destinations, budgets and acceptance checks for every item below that is still open.
>
> **Prime directive:** every hand-made asset is an *override layer* over a working procedural path —
> never a replacement, never load-bearing if the file fails to load. This preserves the repo's
> "no 404s" guarantee and the licensing fallback architecture.

---

## 1. Current state (what renders today — all code, zero image/audio assets)

| System | File | What it draws |
|---|---|---|
| Seed engine | `apps/game/src/design/seed.ts` | Deterministic `SeedStream`; basis of all art |
| Faces | `design/domain/PlayerPortrait.tsx` + `design/domain/face.tsx` | Seeded SVG faces, premium pass shipped: depth shading, 7 face shapes, 16 hair styles, 4 hairlines, 9 facial-hair styles, brows/eyes/expressions and a rare accessory, each on its own seed channel; club-gradient backdrop; CreatorAvatar + tier rings variant |
| Manager portrait | `features/creation/ManagerPortrait.tsx` | Touchline outfits + accessories for customiser |
| Club crests | `design/domain/ClubBadge.tsx` | Shape×Pattern×Motif geometric emblems — best visual in the product; keep procedural forever (scales to newgens) |
| Live pitch | `features/matchday/live/pitchRenderer.ts` | Canvas 2D: pre-rasterised turf, sprite-cached shirts, ball gradients, possession wash, WIDE/FOLLOW cameras |
| Kits | `features/matchday/shared/kit.ts` | Per-club palettes, keeper strips, contrast-safe ink |
| News art | `design/domain/feed.tsx` (`StoryArt`) | Seeded skewed colour bands from `imageSeed`, plus five editorial motifs (transfer, injury, rivalry, fan culture, result reaction) matched from the story's own tags |
| Hero moments | `design/hero/moments.tsx` | GoalBurst volt wordmark, HeroReveal rays, TrophyMoment (now staged with real `Silverware`), SigningMoment card flip |
| Silverware | `design/domain/silverware.tsx` | Five hand-authored SVG trophies — league cup, cup, super-cup salver, golden boot, legacy monolith — layered gold, plinth, engraving band, one sheen |
| Hero scenes | `design/hero/scenes.tsx` | Stadium-at-dusk backdrops in three moods (title / triumph / consolation): parabolic bowl, floodlights, seeded crowd bokeh, rays or rain |
| Effects | `design/hero/effects.tsx` | ShinyText, SpotlightCard, GlareHover/GlareSweep, CardFoil (legendary finish), GradualBlur |
| Textures | `design/surfaces/material.ts` + tokens.css | CSS-only pitch/stadium/haze textures |
| Icons | `design/icons.tsx` | ~60 hand-drawn 24px stroke icons |
| Audio | `design/audio.ts` | WebAudio-synthesised cue set (whistles, goal roar, crowd bed, UI, fanfares) — no files, no network |

Static assets that exist: iOS `AppIcon-1024.png` + three identical splash copies; website
`favicon.svg`, `og-image.jpg`, `icon-192.png` and `apple-touch-icon.png` — the last three
rasterised from HTML/SVG compositions rather than painted, so the master is text and re-rendering
them is a script run. The `summary_large_image` declaration is now backed by a real card on every
page. Audio is no longer empty:
Audio pack v1 shipped as synthesis rather than files (§3), so haptics and sound now run side by
side off the same call sites.

---

## 2. P0 — launch-blocking (~15 files)

| Asset | Spec → destination | Notes |
|---|---|---|
| Final app icon master | SVG master + PNG 1024² → xcassets `AppIcon` | Polish the existing volt-ball mark; verify legibility at 40–60px |
| Splash final | PNG 2732² (+ dark variant) → replace 3 identical Splash copies | Mark + wordmark on `#08090B` |
| Store screenshots ×8 (+3 iPad optional) | PNG 1290×2796 → App Store Connect | Conversion-ranked per APP_STORE.md §5: decision sheet, home, market, pitch, feed, table, squad, club identity. Needs staged game states |
| ~~Web favicon set~~ **DONE (except `.ico`)** | `favicon.svg` + `icon-192.png` + `apple-touch-icon.png` 180² → `website/` | Volt-ball mark redrawn as vector to match the iOS AppIcon (four seams, one sheen, graphite ground); PNGs rasterised from `icon.html` via headless Chromium. A `.ico` is still outstanding and only matters for legacy Windows browsers |
| ~~Social share card~~ **DONE** | 1200×630 JPEG → `website/og-image.jpg`, ~50 KB | Stadium-at-dusk composition on `#08090B` with the wordmark on glass and one volt rail; drawn as HTML/SVG and rasterised. `og:image`/`twitter:image` (+ dimensions and alt) now on all four pages, alongside the new favicon links |
| ASC marketing icon | PNG 1024² | Same master as app icon |

## 3. P1 — high player-visible (~55–90 items)

| Asset | Spec → destination | Consumer / fallback |
|---|---|---|
| ~~Trophy silverware set~~ **DONE — procedural, not files** | 5 variants in `design/domain/silverware.tsx` (100×132 viewBox) | Staged in `TrophyMoment`, the trophy room and history. Hand-authored rather than seeded, because there are five trophies in the universe and they should be recognisable; no file means no 404 in front of the moment that matters |
| ~~Portrait upgrade~~ **DONE — expanded generator** | `design/domain/face.tsx`: depth shading, 7 face shapes, 16 hair styles, 4 hairlines, 9 facial-hair styles, 5 brow/eye shapes, 3 expressions, a rare accessory | Seeded generation kept, as required — each feature reads its own named channel, so a face is stable forever and adding a feature never reshuffles the existing ones. Hand-painted plates remain possible as an overlay on top |
| ~~Title hero scene~~ **DONE — procedural** | `HeroScene variant="title"` in `design/hero/scenes.tsx` | TitleScreen/onboarding. One paint, no blur, no per-frame work; the drawing is removed under reduced transparency and the wrapper's solid fill is already the colour it resolves to |
| ~~Result backdrops ×2~~ **DONE — procedural** | `HeroScene` `triumph` / `consolation` | MatchResultScreen, season summary. Same bowl and floodlights in all three moods; what changes is the temperature of the light and what falls through it |
| ~~**Audio pack v1**~~ **DONE — synthesised, not recorded** | crowd ambience bed, goal roar swell, kick-off/full-time whistles, UI tick/select, escalating decision-timer tick, trophy fanfare, signing sting, reward chime → `apps/game/src/design/audio.ts` | Built with oscillators + seeded noise buffers + filters instead of `.m4a`, per the prime directive: zero bytes on disk means zero 404s and no licensing. Mirrors the `haptics.ts` driver pattern (`setAudioDriver`), silent no-op without WebAudio, gated on the `Sound effects` setting (`GameSettings.sound`, default on) and on page visibility. A recorded pack can still land later as an `AudioDriver` override |
| ~~Legendary card foil~~ **DONE — procedural, not a tile** | `.cf-foil` in `tokens.css` + `CardFoil` in `design/hero/effects.tsx` | PlayerCard legendary variant. Two repeating gradients at different pitches and angles beat into the interference a printed foil makes, with one conic for the hue shift; `GlareSweep` supplies the hover pass. Every stop under 12% alpha, masked off the card's foot, removed entirely under reduced transparency — which leaves the plain glass card underneath |
| ~~Editorial illustrations ×5~~ **DONE — inline** | transfer / injury / rivalry / fan-culture / result-reaction, drawn inside `StoryArt` on the 200×100 plate | Motif is matched from the story's `tags` at render time (`storyMotifFor`), so nothing is authored per story. Seeded bands remain the base layer and the whole picture for anything unmatched — a facility upgrade or a sponsor deal correctly gets no motif |
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
3. ~~**Trophy set**~~ — shipped as `design/domain/silverware.tsx`.
4. ~~**Title hero scene**~~ — shipped as `design/hero/scenes.tsx`, with both result moods.
5. **What is left that is genuinely absent art:** store screenshots ×8, the splash/app-icon
   polish pass, `favicon.ico`, the club-reveal celebration kit, and all of P2. Everything else
   above now renders from code.

Totals: **P0 ≈15 files · P1 ≈55–90 items · P2 ≈15–22 items.**
