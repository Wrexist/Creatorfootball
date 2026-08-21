import type { GameState } from '../game/state';
import { clamp } from '../core/math';
import { SOCIAL_ACTION_BALANCE as A } from './balance';
import { socialWorld, type PlayerAction } from './worldState';

/**
 * Social standing.
 *
 * What the world thinks of the way you conduct yourself, derived entirely from
 * what you actually did. There is no hidden score to farm: every entry in the
 * action log carries the warmth and credibility of the act at the time it was
 * committed, weighted by how loudly it was said and decayed by how long ago.
 *
 * Two axes, because one produces a ladder and a ladder produces a correct
 * answer. Warmth is whether you are kind or cruel in public; credibility is
 * whether the things you say turn out to be true. The five characters below
 * are the corners of that square, and each of them is a genuinely different
 * way to be famous — none is the good one.
 */

export const STANDINGS = ['UNKNOWN', 'BELOVED', 'RESPECTED', 'FEARED', 'DIVISIVE', 'CLOWN'] as const;
export type Standing = (typeof STANDINGS)[number];

export interface SocialStanding {
  readonly standing: Standing;
  readonly label: string;
  readonly blurb: string;
  /** -1 (cruel) .. +1 (generous). */
  readonly warmth: number;
  /** -1 (talks nonsense) .. +1 (says the true thing). */
  readonly credibility: number;
  /** How much of a public voice the club has, unbounded above ~0. */
  readonly volume: number;
  /** Multiplier applied to the reach of anything the player publishes. */
  readonly reachMultiplier: number;
  /** Multiplier on how hard hostile coverage lands. */
  readonly hostilityMultiplier: number;
  /** Number of recorded acts inside the window. */
  readonly acts: number;
}

const LABELS: Record<Standing, { label: string; blurb: string }> = {
  UNKNOWN: {
    label: 'Unknown quantity',
    blurb: 'Nobody outside your own supporters has formed an opinion yet. Everything you say still counts as a first impression.',
  },
  BELOVED: {
    label: 'Beloved',
    blurb: 'You are the club people root for from a distance. Rivals find it infuriating, which helps.',
  },
  RESPECTED: {
    label: 'Respected',
    blurb: 'You say what you mean and it usually turns out to be true. Nobody quotes you for fun, but everybody believes you.',
  },
  FEARED: {
    label: 'Feared',
    blurb: 'You pick fights and you win them. It travels a long way and it costs you the benefit of the doubt.',
  },
  DIVISIVE: {
    label: 'Divisive',
    blurb: 'Half the sport is on you and half of it is at you. Nobody scrolls past.',
  },
  CLOWN: {
    label: 'A running joke',
    blurb: 'You are loud, you are wrong, and the clips have their own audience now. Reach has never been the problem.',
  },
};

/**
 * Classify a warmth/credibility/volume point.
 *
 * Volume gates everything: a club that has barely spoken is an unknown
 * quantity however kindly it did it. The corners are then read off the two
 * axes, with the mixed case — loud, and pulling in both directions — landing on
 * divisive rather than being rounded to whichever axis happened to be larger.
 */
export function classify(warmth: number, credibility: number, volume: number): Standing {
  const s = A.standing;
  if (volume < s.knownVolume) return 'UNKNOWN';
  const warm = warmth >= s.definiteAt;
  const cold = warmth <= -s.definiteAt;
  const solid = credibility >= s.definiteAt;
  const hollow = credibility <= -s.definiteAt;

  if (cold && hollow) return 'CLOWN';
  if (cold && solid) return 'FEARED';
  if (warm && solid) return 'RESPECTED';
  if (warm && hollow) return 'DIVISIVE';
  if (cold) return 'FEARED';
  if (hollow) return 'CLOWN';
  if (warm) return 'BELOVED';
  return 'DIVISIVE';
}

/** Weight one act by how loudly it was said and how long ago. */
const weightOf = (action: PlayerAction, cycle: number): number => {
  const age = Math.max(0, cycle - action.cycle);
  if (age > A.standing.windowCycles) return 0;
  return Math.max(0.05, action.volume) * A.standing.decayPerCycle ** age;
};

export function socialStanding(state: GameState): SocialStanding {
  const world = socialWorld(state);
  const cycle = state.clock.cycle;

  let totalWeight = 0;
  let warmthSum = 0;
  let credibilitySum = 0;
  let volume = 0;
  let acts = 0;

  for (const action of world.actions) {
    const weight = weightOf(action, cycle);
    if (weight <= 0) continue;
    totalWeight += weight;
    warmthSum += action.warmth * weight;
    credibilitySum += action.credibility * weight;
    volume += weight;
    acts++;
  }

  const warmth = totalWeight > 0 ? clamp(warmthSum / totalWeight, -1, 1) : 0;
  const credibility = totalWeight > 0 ? clamp(credibilitySum / totalWeight, -1, 1) : 0;
  const standing = classify(warmth, credibility, volume);

  return {
    standing,
    ...LABELS[standing],
    warmth: Math.round(warmth * 100) / 100,
    credibility: Math.round(credibility * 100) / 100,
    volume: Math.round(volume * 100) / 100,
    reachMultiplier: A.standing.reachBonus[standing],
    hostilityMultiplier: A.standing.hostility[standing],
    acts,
  };
}

/**
 * Facts the standing publishes to the template layer.
 *
 * Content keys on these, which is how the world starts *talking to you
 * differently* rather than merely displaying a badge: a rival writing about a
 * club everybody finds funny picks a different line from one writing about a
 * club everybody is frightened of.
 */
export const standingFacts = (standing: SocialStanding): Record<string, string | number> => ({
  standing: standing.standing,
  standingWarmth: Math.round(standing.warmth * 100),
  standingCredibility: Math.round(standing.credibility * 100),
  standingVolume: Math.round(standing.volume * 10) / 10,
});
