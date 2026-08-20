import type { CSSProperties } from 'react';
import { darken, luminance } from '../color';

/**
 * Football in the material, rather than football on top of it.
 *
 * Three textures, all opt-in, all drawn into the surface they belong to. None
 * of them is ever a page background: a mown-stripe pattern behind a whole
 * screen competes with every card on it and turns the product into a themed
 * skin. Used on one hero surface at a time they do the opposite - they make
 * that one object feel like it belongs to a sport.
 *
 * All three are removed entirely under `prefers-reduced-transparency` and under
 * the in-app "Reduce effects" setting (see tokens.css). They carry no
 * information, so removing them costs nothing.
 */
export type SurfaceTexture = 'none' | 'pitch' | 'stadium' | 'haze';

export const TEXTURE_CLASS: Record<SurfaceTexture, string> = {
  none: '',
  /** Mown stripes, masked away from the top so a headline never sits on them. */
  pitch: 'tex-pitch',
  /** Floodlight pools entering from the top edge, with falloff to the floor. */
  stadium: 'tex-stadium',
  /** Cold air over a lit pitch. Deliberately almost invisible. */
  haze: 'tex-haze',
};

/**
 * The brightest a bleed colour is allowed to be.
 *
 * Every measured contrast failure in this product came from the same two
 * mistakes: painting a token onto a tint of its own hue, and painting text onto
 * a club colour. This is the guardrail for the second one. Content packs ship
 * clubs in amber (`#e4a11b`, relative luminance 0.42) as happily as in navy,
 * and an amber bleed at full strength took `ink-muted` on a hero surface to
 * **2.28:1**. Capping the *luminance* rather than the alpha is what makes the
 * guarantee hold for every club a pack can invent, including ones that do not
 * exist yet.
 */
const MAX_BLEED_LUMINANCE = 0.055;

/**
 * Darken a club colour until it is dark enough to sit behind text, keeping its
 * hue. A navy or a claret passes through untouched; an amber or a lime is
 * deepened until the type on top of it clears AA. The club is still recognisably
 * present - it is light in a room, not a highlighter.
 */
export function tameBleed(color: string): string {
  let tamed = color;
  for (let i = 0; i < 24 && luminance(tamed) > MAX_BLEED_LUMINANCE; i += 1) {
    tamed = darken(tamed, 0.08);
  }
  return tamed;
}

/**
 * Club-colour ambient bleed.
 *
 * The surface picks up a directional glow of the club's primary, as though the
 * object were sitting in that club's light. Two things keep it safe: the colour
 * is passed through `tameBleed` first, and the strength is capped. Measured on
 * the worst case the kit can produce - a `glass-4` hero, in its brightest
 * light-pool corner, bleeding a club's primary at the cap - `ink` clears 11:1
 * and `ink-muted` clears 4.5:1 for every identity in the shipped packs.
 */
export function bleedStyle(color?: string, strength = 26): CSSProperties {
  if (!color) return {};
  return {
    ['--bleed' as string]: tameBleed(color),
    ['--bleed-strength' as string]: String(Math.max(0, Math.min(34, strength))),
  } as CSSProperties;
}
