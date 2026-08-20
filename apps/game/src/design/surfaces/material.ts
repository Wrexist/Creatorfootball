import type { CSSProperties } from 'react';

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
 * Club-colour ambient bleed.
 *
 * The surface picks up a directional glow of the club's primary, as though the
 * object were sitting in that club's light. Strength is capped well below the
 * point where it would start eating text contrast - the bleed is environment,
 * and the type on top of it still has to clear 4.5:1 against the darkest
 * corner of the panel.
 */
export function bleedStyle(color?: string, strength = 26): CSSProperties {
  if (!color) return {};
  return {
    ['--bleed' as string]: color,
    ['--bleed-strength' as string]: String(Math.max(0, Math.min(42, strength))),
  } as CSSProperties;
}
