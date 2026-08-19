import { portraitFeatures } from '@/design';
import type { ManagerAppearance } from '@cf/engine';
import { SKIN_TONES } from './appearance';

/**
 * Turning appearance choices into a portrait the design system will draw.
 *
 * The procedural portrait is a pure function of a seed string: it hashes the
 * seed into ten independent feature channels. That is exactly the property we
 * want for twenty thousand generated players — a face costs zero bytes and is
 * stable forever — and exactly the wrong shape for a customiser, where the
 * player picks the features and the string has to follow.
 *
 * So we invert it by search. Candidate seeds are enumerated until one hashes to
 * the four channels the player chose, which is cheap because the hash is
 * FNV-1a: the expected search is a few thousand evaluations, i.e. under a
 * millisecond, and the result is memoised per combination.
 *
 * Two consequences worth stating, because they are the reason this approach was
 * chosen over adding a features prop to the design system:
 *  - The seed is *derived*, not stored. Any screen anywhere in the app can call
 *    `managerPortraitSeed(manager.appearance)` and get the identical face from
 *    the saved manager, with nothing extra in the save format.
 *  - If the design system ever changes its feature tables, the search simply
 *    fails to find a perfect match and returns the closest one. The portrait
 *    stays valid; it does not crash and it does not go blank.
 */

export interface PortraitTraits {
  /** Exact skin hex from the renderer's palette. */
  readonly skin: string;
  readonly hair: string;
  readonly hairStyle: string;
  readonly facialHair: string;
}

/** Silhouette and hair read first at portrait scale, so they are weighted highest. */
const WEIGHT = { hairStyle: 4, skin: 3, hair: 2, facialHair: 2 } as const;
const PERFECT = WEIGHT.hairStyle + WEIGHT.skin + WEIGHT.hair + WEIGHT.facialHair;

/**
 * Enough attempts to find a perfect match for essentially every combination
 * (the search space is ~8,000 wide), with a hard ceiling so a renderer change
 * can never turn a keystroke into a frozen frame.
 */
const MAX_ATTEMPTS = 60_000;

const cache = new Map<string, string>();
/** Bounded: a player can only make so many faces in one session, but never trust that. */
const MAX_CACHE = 256;

function score(seed: string, traits: PortraitTraits): number {
  const f = portraitFeatures(seed);
  return (
    (f.hairStyle === traits.hairStyle ? WEIGHT.hairStyle : 0) +
    (f.skin === traits.skin ? WEIGHT.skin : 0) +
    (f.hair === traits.hair ? WEIGHT.hair : 0) +
    (f.facialHair === traits.facialHair ? WEIGHT.facialHair : 0)
  );
}

/** The seed whose portrait matches `traits` as closely as the renderer allows. */
export function solvePortraitSeed(traits: PortraitTraits): string {
  const key = `${traits.skin}|${traits.hair}|${traits.hairStyle}|${traits.facialHair}`;
  const cached = cache.get(key);
  if (cached !== undefined) return cached;

  let best = key;
  let bestScore = -1;
  for (let i = 0; i < MAX_ATTEMPTS; i += 1) {
    const candidate = `cf-mgr-${key}-${i}`;
    const value = score(candidate, traits);
    if (value > bestScore) {
      best = candidate;
      bestScore = value;
      if (value === PERFECT) break;
    }
  }

  if (cache.size >= MAX_CACHE) cache.clear();
  cache.set(key, best);
  return best;
}

const FALLBACK_SKIN = '#d9a77c';

const skinHexFor = (tone: number): string =>
  SKIN_TONES.find((s) => s.tone === tone)?.hex ?? FALLBACK_SKIN;

/**
 * The engine's own manager generator writes appearance in its vocabulary
 * (`short_crop`, `ash`) because it has no renderer to answer to. The builder in
 * this flow writes the renderer's vocabulary, so that what the player picked is
 * what gets drawn. Both must produce a face, so anything unrecognised is
 * translated here rather than silently degrading to a random head.
 */
const ENGINE_HAIR_STYLE: Readonly<Record<string, string>> = {
  short_crop: 'short', swept_back: 'waves', tied_back: 'bun', messy: 'curls',
  side_part: 'short', braids: 'curls', short_neat: 'fade', bob: 'long',
  thinning: 'bald', shaved: 'bald',
};

const ENGINE_HAIR_COLOR: Readonly<Record<string, string>> = {
  black: '#1b1613', dark: '#2e2119', brown: '#4a3121', auburn: '#8d6034',
  blond: '#d8b36a', grey: '#7d7d7d', ash: '#c9c9c9', white: '#c9c9c9',
};

const isHex = (value: string): boolean => /^#[0-9a-f]{6}$/i.test(value);

export function toPortraitTraits(appearance: ManagerAppearance): PortraitTraits {
  return {
    skin: skinHexFor(appearance.skinTone),
    hair: isHex(appearance.hairColor)
      ? appearance.hairColor.toLowerCase()
      : ENGINE_HAIR_COLOR[appearance.hairColor] ?? '#2e2119',
    hairStyle: ENGINE_HAIR_STYLE[appearance.hairStyle] ?? appearance.hairStyle,
    facialHair: appearance.facialHair,
  };
}

/**
 * The one function the rest of the app should use. Same appearance in, same
 * face out, on every screen and in every session.
 */
export function managerPortraitSeed(appearance: ManagerAppearance): string {
  return solvePortraitSeed(toPortraitTraits(appearance));
}
