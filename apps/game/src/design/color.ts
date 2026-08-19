/**
 * Colour maths for procedurally generated art.
 *
 * Club colours come from content packs, which means the design system cannot
 * know at build time whether a motif drawn in a club's accent will be legible
 * on that club's primary. These helpers let the badge and card renderers pick a
 * readable foreground at runtime instead of shipping twelve special cases.
 */

export interface Rgb {
  readonly r: number;
  readonly g: number;
  readonly b: number;
}

const HEX_SHORT = /^#?([0-9a-f])([0-9a-f])([0-9a-f])$/i;
const HEX_LONG = /^#?([0-9a-f]{2})([0-9a-f]{2})([0-9a-f]{2})$/i;

export function parseColor(input: string): Rgb {
  const short = HEX_SHORT.exec(input.trim());
  if (short?.[1] && short[2] && short[3]) {
    return {
      r: parseInt(short[1] + short[1], 16),
      g: parseInt(short[2] + short[2], 16),
      b: parseInt(short[3] + short[3], 16),
    };
  }
  const long = HEX_LONG.exec(input.trim());
  if (long?.[1] && long[2] && long[3]) {
    return {
      r: parseInt(long[1], 16),
      g: parseInt(long[2], 16),
      b: parseInt(long[3], 16),
    };
  }
  // A malformed colour must not blow up a render — fall back to graphite.
  return { r: 20, g: 23, b: 27 };
}

export const toHex = ({ r, g, b }: Rgb): string =>
  `#${[r, g, b].map((v) => Math.round(Math.min(255, Math.max(0, v))).toString(16).padStart(2, '0')).join('')}`;

export const rgba = (color: string, alpha: number): string => {
  const { r, g, b } = parseColor(color);
  return `rgb(${r} ${g} ${b} / ${alpha})`;
};

/** WCAG relative luminance. */
export function luminance(color: string): number {
  const { r, g, b } = parseColor(color);
  const channel = (v: number): number => {
    const s = v / 255;
    return s <= 0.03928 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4;
  };
  return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
}

export function contrastRatio(a: string, b: string): number {
  const la = luminance(a);
  const lb = luminance(b);
  const [hi, lo] = la > lb ? [la, lb] : [lb, la];
  return (hi + 0.05) / (lo + 0.05);
}

/** Near-white or near-black, whichever reads better on `background`. */
export const readableOn = (background: string): string =>
  luminance(background) > 0.42 ? '#08090b' : '#f4f6f8';

/**
 * Pick the first candidate that clears `minRatio` against the background,
 * falling back to plain black/white. Used for badge motifs, where a club's
 * declared accent is preferred but must not be used if it disappears.
 */
export function pickReadable(
  background: string,
  candidates: readonly string[],
  minRatio = 3,
): string {
  for (const candidate of candidates) {
    if (contrastRatio(background, candidate) >= minRatio) return candidate;
  }
  return readableOn(background);
}

export function mix(a: string, b: string, t: number): string {
  const ca = parseColor(a);
  const cb = parseColor(b);
  return toHex({
    r: ca.r + (cb.r - ca.r) * t,
    g: ca.g + (cb.g - ca.g) * t,
    b: ca.b + (cb.b - ca.b) * t,
  });
}

export const lighten = (color: string, t: number): string => mix(color, '#ffffff', t);
export const darken = (color: string, t: number): string => mix(color, '#000000', t);
