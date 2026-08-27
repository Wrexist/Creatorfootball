/**
 * The generated-art override registry.
 *
 * Every path here is an *override* over a procedural path that already draws.
 * The filenames are contracts with `tools/brand/assets.manifest.mjs`: a typo
 * means "no override", which is indistinguishable from "not made yet" — and
 * both are fine, because the component behind the asset still draws.
 *
 * Nothing in this file may become load-bearing. If you find yourself removing
 * a procedural fallback because "the asset is always there", stop: the asset
 * is never always there. It is one 404, one corrupt byte, or one slow network
 * away from absent, and the product has to survive that without a visual bug.
 */

/** Base path for every generated plate. Vite serves `public/` from the root. */
const ART = '/art';

export const ART_ASSETS = {
  /** B6a — radial ray plate behind the crest in `HeroReveal`. */
  revealBurst: `${ART}/heroes/reveal-burst.webp`,
  /** B6b — drifting light-mote layer, parallaxed over the burst. */
  revealMotes: `${ART}/heroes/reveal-motes.webp`,
  /** C1 — atmosphere over the live pitch and behind hero surfaces. */
  stadiumHaze: `${ART}/textures/stadium-haze.webp`,
  /** C5 — `--color-special` wash sweeping across the pitch. */
  ruleSweep: `${ART}/textures/rule-sweep.webp`,
  /** C2 — top-down ball, sprite-cached by the pitch renderer. */
  ball: `${ART}/sprites/ball.webp`,
  /** C4 — 8-frame reward-token strip, blitted along the flight path. */
  rewardTokens: `${ART}/sprites/reward-tokens.webp`,
} as const;

export type ArtAssetName = keyof typeof ART_ASSETS;
