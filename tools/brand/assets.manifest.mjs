/**
 * The image side of `docs/AI_ASSET_PROMPTS.md` §2, as data.
 *
 * One row per deliverable *file*, transcribed from the deliverable manifest
 * table and the per-entry post-processing notes. The table is the source of
 * truth for `dest`, `format`, `width`, `height` and `budgetKB`; the two fields
 * the table does not carry — `alpha` and `fit` — are derived from each entry's
 * post-processing block and are the judgement calls flagged in
 * `tools/brand/README.md`.
 *
 * Audio (the D-entries) is deliberately absent: `ingest.mjs` is images only.
 *
 * Fit modes:
 *   cover   — fill the target box and centre-crop the overflow. For full-bleed
 *             plates whose entry says "crop, do not letterbox".
 *   contain — fit the whole source inside the box and centre it, leaving
 *             transparent (alpha assets) or `#050607` (opaque assets) margins.
 *             For isolated subjects that must not lose an edge.
 *   exact   — source and target already agree; scale straight to the box.
 *             Only safe when the aspect ratios match, so it behaves as `cover`
 *             if they do not.
 *
 * `scrim` is the bottom-weighted (or, for A3, left-weighted) `#050607`
 * multiply gradient the entry's post-processing calls for: `alpha` runs from
 * `from` to `to` as a fraction of the height (`axis: 'y'`, 0 = top) or the
 * width (`axis: 'x'`, 0 = left).
 */

/** The graphite ground the generators fall back to when asked for "no background". */
export const KEY_COLORS = ['#050607', '#08090B'];

/** Matte colour for opaque assets that need letterbox margins. */
export const LETTERBOX = '#050607';

/** @typedef {{ axis: 'x' | 'y', from: number, to: number, fromAlpha: number, toAlpha: number }} Scrim */

export const ASSETS = [
  // ---- A — the brand identity slots ---------------------------------------
  //
  // The app icon, the launch image and the share card used to live here, fed
  // by one-off generations dropped in `inbox/`. They do not any more: they are
  // derived from the committed masters in `masters/` by `icons.mjs`, together
  // with every favicon, `.ico` and PWA icon in the repo, so that the identity
  // has exactly one source and re-deriving it is a command rather than an
  // export session. See `tools/brand/README.md` § "Two pipelines, one brand".
  //
  // This file keeps what it was always best at: the *generated* game art
  // below, where each destination is one download that will never be made
  // twice.

  // ---- B — high player-visible --------------------------------------------
  {
    id: 'B1',
    name: 'Title hero scene',
    dest: 'apps/game/public/art/heroes/title-stadium.webp',
    format: 'webp',
    width: 1179,
    height: 2556,
    budgetKB: 300,
    alpha: false,
    fit: 'cover',
    flatten: '#050607',
    scrim: { axis: 'y', from: 0.45, to: 1, fromAlpha: 0, toAlpha: 0.62 },
    note: 'The component crops and never letterboxes, so this one crops too.',
  },
  {
    id: 'B2',
    name: 'Triumph result backdrop',
    dest: 'apps/game/public/art/heroes/result-triumph.webp',
    format: 'webp',
    width: 1179,
    height: 2556,
    budgetKB: 300,
    alpha: false,
    fit: 'cover',
    flatten: '#050607',
    scrim: { axis: 'y', from: 0.45, to: 1, fromAlpha: 0, toAlpha: 0.62 },
  },
  {
    id: 'B3',
    name: 'Consolation result backdrop',
    dest: 'apps/game/public/art/heroes/result-consolation.webp',
    format: 'webp',
    width: 1179,
    height: 2556,
    budgetKB: 300,
    alpha: false,
    fit: 'cover',
    flatten: '#050607',
    scrim: { axis: 'y', from: 0.45, to: 1, fromAlpha: 0, toAlpha: 0.5 },
    note: 'Lighter scrim than B1/B2 — this plate is already dark and over-scrimming muddies it.',
  },
  ...['league', 'cup', 'super-cup', 'boot', 'legacy'].map((slug, i) => ({
    id: `B4${'abcde'[i]}`,
    name: `Trophy — ${slug}`,
    dest: `apps/game/public/art/trophies/${slug}.webp`,
    format: 'webp',
    width: 600,
    height: 792,
    budgetKB: 120,
    alpha: true,
    fit: 'contain',
    note: 'Isolated subject on transparency; the 100:132 box at 6×.',
  })),
  {
    id: 'B5',
    name: 'Legendary foil tile (seamless)',
    dest: 'apps/game/public/art/textures/foil-legendary.webp',
    format: 'webp',
    width: 512,
    height: 512,
    budgetKB: 48,
    alpha: false,
    fit: 'cover',
    flatten: '#0E1013',
    note: 'Seamlessness cannot be verified here — run the 3×3 offset test by eye.',
  },
  {
    id: 'B6a',
    name: 'Reveal burst plate',
    dest: 'apps/game/public/art/heroes/reveal-burst.webp',
    format: 'webp',
    width: 1024,
    height: 1024,
    budgetKB: 90,
    alpha: true,
    fit: 'contain',
  },
  {
    id: 'B6b',
    name: 'Reveal motes plate',
    dest: 'apps/game/public/art/heroes/reveal-motes.webp',
    format: 'webp',
    width: 1024,
    height: 1024,
    budgetKB: 60,
    alpha: true,
    fit: 'contain',
  },
  ...['transfer', 'injury', 'rivalry', 'fans', 'result'].map((slug, i) => ({
    id: `B7${'abcde'[i]}`,
    name: `Story plate — ${slug}`,
    dest: `apps/game/public/art/stories/${slug}.webp`,
    format: 'webp',
    width: 800,
    height: 400,
    budgetKB: 40,
    alpha: true,
    fit: 'contain',
    note: 'Line-art plate; contain keeps the optical area consistent across the set of five.',
  })),
  {
    id: 'B8',
    name: 'Website device-mockup scene',
    dest: 'website/hero-devices.webp',
    format: 'webp',
    width: 2400,
    height: 1350,
    budgetKB: 220,
    alpha: false,
    fit: 'cover',
    flatten: '#050607',
    note: 'Screens are composited in a design tool before ingest, not here.',
  },

  // ---- C — polish ----------------------------------------------------------
  {
    id: 'C1',
    name: 'Stadium-bowl haze plate',
    dest: 'apps/game/public/art/textures/stadium-haze.webp',
    format: 'webp',
    width: 1600,
    height: 900,
    budgetKB: 80,
    alpha: true,
    fit: 'cover',
    note: 'Full-bleed haze: cropping is safe, letterboxing would leave a visible edge.',
  },
  {
    id: 'C2',
    name: 'Ball sprite',
    dest: 'apps/game/public/art/sprites/ball.webp',
    format: 'webp',
    width: 256,
    height: 256,
    budgetKB: 20,
    alpha: true,
    fit: 'contain',
    note: 'The alpha edge must stay a whole circle, so never crop.',
  },
  {
    id: 'C3',
    name: 'Kit fabric micro-noise tile',
    dest: 'apps/game/public/art/textures/kit-fabric.webp',
    format: 'webp',
    width: 256,
    height: 256,
    budgetKB: 16,
    alpha: false,
    fit: 'cover',
    flatten: '#808080',
    grayscale: true,
    normalizeMean: 128,
    note: 'Forced to greyscale and normalised to a mean luminance of 50% so `overlay` is a no-op on average.',
  },
  {
    id: 'C4',
    name: 'Reward-fly particle sheet',
    dest: 'apps/game/public/art/sprites/reward-tokens.webp',
    format: 'webp',
    width: 1024,
    height: 256,
    budgetKB: 40,
    alpha: true,
    fit: 'contain',
    note: '8×128² cells. The source must already be an 8-up 4:1 strip — this script scales the strip, it does not re-slice or re-centre cells.',
  },
  {
    id: 'C5',
    name: 'Special-rule sweep plate',
    dest: 'apps/game/public/art/textures/rule-sweep.webp',
    format: 'webp',
    width: 2048,
    height: 512,
    budgetKB: 48,
    alpha: true,
    fit: 'contain',
    note: 'Contain keeps the left and right edge columns transparent so the sweep can translate off-screen.',
  },

  // ---- E — brand art inside the game ---------------------------------------
  //
  // The crest and the lockup, cut out of the same masters the app icon comes
  // from, so the mark a player sees on the splash is the mark on their home
  // screen. Like everything else here these are overrides: every surface that
  // uses one draws without it too.
  {
    id: 'E1',
    name: 'Crest — isolated',
    dest: 'apps/game/public/art/emblems/crest.webp',
    format: 'webp',
    width: 560,
    height: 678,
    budgetKB: 90,
    alpha: true,
    fit: 'contain',
    note: 'The master already carries alpha. Contain, because a clipped shield edge is the one thing that would look broken.',
  },
  {
    id: 'E2',
    name: 'Crest — arena plate',
    dest: 'apps/game/public/art/heroes/crest-arena.webp',
    format: 'webp',
    width: 1440,
    height: 810,
    budgetKB: 140,
    alpha: false,
    fit: 'cover',
    flatten: '#050607',
    note: 'Landscape backdrop behind the crest on hero surfaces. Full-bleed, so it crops.',
  },
  {
    id: 'E3',
    name: 'Wordmark lockup',
    dest: 'apps/game/public/art/brand/wordmark.webp',
    format: 'webp',
    width: 1024,
    height: 410,
    budgetKB: 70,
    alpha: false,
    fit: 'contain',
    flatten: '#000000',
    note: [
      'Crest and wordmark set together, on black rather than on alpha.',
      'Keying this one costs twice: the glow around the lockup *is* the artwork,',
      'so a key either eats it or leaves a halo, and the ragged alpha channel it',
      'produces is encoded losslessly and blows the budget on its own. Composited',
      'with `screen` over the product\'s graphite ground, black is transparent and',
      'the glow survives intact. The 2.5:1 box is the master\'s own aspect.',
    ].join(' '),
  },
];

/** @param {string} id */
export function findAsset(id) {
  const want = id.toLowerCase();
  return ASSETS.find((a) => a.id.toLowerCase() === want) ?? null;
}

/** Basename of the destination, without extension — `league`, `og-image`, … */
export function destSlug(asset) {
  const base = asset.dest.split('/').pop() ?? '';
  return base.replace(/\.[^.]+$/, '');
}
