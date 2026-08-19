import { ATTRIBUTE_KEYS, overallFor, type AttributeKey, type Attributes } from '../../players/attributes';
import type { Position } from '../../players/positions';

/**
 * Positional raw-attribute shapes.
 *
 * The overall rating is already position-weighted, so a naive generator would
 * produce a centre back who is simply "a striker with different weights" — the
 * same flat numbers read through a different lens. That is the thing this table
 * exists to prevent. Each position declares how far every raw attribute sits
 * from the player's underlying level, and how much it varies, so a 78 centre
 * back genuinely cannot finish and a 78 winger genuinely cannot defend.
 *
 * Offsets are in attribute points around the player's `core` level; spreads are
 * the standard deviation of the per-player noise on top. Keeping the two apart
 * means a designer can widen the variety of a position without moving its
 * identity.
 */

export interface AttributeShape {
  readonly offset: number;
  readonly spread: number;
}

export type PositionProfile = Readonly<Record<AttributeKey, AttributeShape>>;

const DEFAULT_SPREAD = 6;

const shape = (
  offsets: Partial<Record<AttributeKey, number>>,
  spreads: Partial<Record<AttributeKey, number>> = {},
): PositionProfile =>
  Object.fromEntries(
    ATTRIBUTE_KEYS.map((k) => [
      k,
      { offset: offsets[k] ?? 0, spread: spreads[k] ?? DEFAULT_SPREAD },
    ]),
  ) as PositionProfile;

/** Outfielders are terrible keepers. This is the number that makes that true. */
const OUTFIELD_REFLEXES = -42;

export const POSITION_PROFILES: Readonly<Record<Position, PositionProfile>> = {
  GK: shape(
    {
      reflexes: 16, positioning: 8, composure: 4, decisionMaking: 2, physical: -1,
      strength: -4, passing: -8, stamina: -12, technique: -12, defending: -18,
      pace: -22, acceleration: -23, dribbling: -25, crossing: -28, shooting: -34, finishing: -36,
    },
    { reflexes: 5, positioning: 5, passing: 8, pace: 9, dribbling: 9, shooting: 10, finishing: 10 },
  ),
  CB: shape(
    {
      defending: 12, positioning: 10, strength: 10, physical: 8, composure: 2,
      decisionMaking: 2, stamina: -2, passing: -4, pace: -6, acceleration: -8,
      technique: -10, vision: -12, dribbling: -16, crossing: -18, shooting: -22,
      finishing: -26, reflexes: OUTFIELD_REFLEXES,
    },
    { defending: 4.5, positioning: 4.5, strength: 5, pace: 7.5, finishing: 8, dribbling: 7.5 },
  ),
  LB: shape(
    {
      stamina: 10, pace: 8, crossing: 6, acceleration: 6, defending: 4, positioning: 2,
      passing: -1, dribbling: -2, physical: -2, composure: -3, decisionMaking: -2,
      strength: -4, technique: -4, vision: -6, shooting: -18, finishing: -22,
      reflexes: OUTFIELD_REFLEXES,
    },
    { stamina: 4.5, pace: 5.5, crossing: 6.5, defending: 5.5, finishing: 8 },
  ),
  RB: shape(
    {
      stamina: 10, pace: 8, crossing: 6, acceleration: 6, defending: 4, positioning: 2,
      passing: -1, dribbling: -2, physical: -2, composure: -3, decisionMaking: -2,
      strength: -4, technique: -4, vision: -6, shooting: -18, finishing: -22,
      reflexes: OUTFIELD_REFLEXES,
    },
    { stamina: 4.5, pace: 5.5, crossing: 6.5, defending: 5.5, finishing: 8 },
  ),
  CDM: shape(
    {
      defending: 8, positioning: 8, decisionMaking: 6, stamina: 6, strength: 5,
      passing: 4, composure: 3, physical: 3, vision: 1, technique: -3,
      pace: -6, acceleration: -7, dribbling: -8, crossing: -10, shooting: -12,
      finishing: -18, reflexes: OUTFIELD_REFLEXES,
    },
    { defending: 4.5, positioning: 4.5, passing: 5.5, decisionMaking: 5, finishing: 8 },
  ),
  CM: shape(
    {
      passing: 8, stamina: 8, vision: 7, decisionMaking: 6, technique: 4,
      composure: 3, dribbling: 2, positioning: -1, defending: -2, crossing: -2,
      physical: -3, pace: -4, acceleration: -4, strength: -4, shooting: -6,
      finishing: -12, reflexes: OUTFIELD_REFLEXES,
    },
    { passing: 4.5, vision: 5, stamina: 4.5, technique: 5, finishing: 7.5 },
  ),
  CAM: shape(
    {
      vision: 10, technique: 9, passing: 8, dribbling: 8, composure: 4,
      decisionMaking: 4, shooting: 4, crossing: 2, acceleration: 1, pace: -1,
      finishing: -2, stamina: -2, physical: -8, strength: -9, positioning: -10,
      defending: -16, reflexes: OUTFIELD_REFLEXES,
    },
    { vision: 5, technique: 5, dribbling: 5.5, defending: 7.5, strength: 7 },
  ),
  LW: shape(
    {
      pace: 12, acceleration: 12, dribbling: 12, crossing: 7, technique: 6,
      finishing: 2, stamina: 2, shooting: 0, composure: -1, vision: -2,
      passing: -3, decisionMaking: -3, physical: -8, strength: -9, positioning: -12,
      defending: -18, reflexes: OUTFIELD_REFLEXES,
    },
    { pace: 4.5, acceleration: 4.5, dribbling: 5, crossing: 6.5, defending: 7.5 },
  ),
  RW: shape(
    {
      pace: 12, acceleration: 12, dribbling: 12, crossing: 7, technique: 6,
      finishing: 2, stamina: 2, shooting: 0, composure: -1, vision: -2,
      passing: -3, decisionMaking: -3, physical: -8, strength: -9, positioning: -12,
      defending: -18, reflexes: OUTFIELD_REFLEXES,
    },
    { pace: 4.5, acceleration: 4.5, dribbling: 5, crossing: 6.5, defending: 7.5 },
  ),
  ST: shape(
    {
      finishing: 14, shooting: 11, composure: 6, positioning: 5, strength: 5,
      pace: 4, acceleration: 4, physical: 3, technique: 2, dribbling: 0,
      decisionMaking: -2, stamina: -4, vision: -6, passing: -8, crossing: -10,
      defending: -22, reflexes: OUTFIELD_REFLEXES,
    },
    { finishing: 4.5, shooting: 5, composure: 5, defending: 7.5, passing: 7 },
  ),
};

/** Height in cm: mean and spread by position. Keepers and centre backs are tall. */
export const POSITION_HEIGHT: Readonly<Record<Position, readonly [number, number]>> = {
  GK: [191, 4.5], CB: [188, 5], LB: [178, 5], RB: [178, 5], CDM: [183, 5.5],
  CM: [180, 5.5], CAM: [176, 6], LW: [175, 6], RW: [175, 6], ST: [183, 6.5],
};

/** Probability the player is left-footed, by position. `both` is rolled separately. */
export const POSITION_LEFT_FOOT_CHANCE: Readonly<Record<Position, number>> = {
  GK: 0.18, CB: 0.3, LB: 0.78, RB: 0.08, CDM: 0.22, CM: 0.24,
  CAM: 0.28, LW: 0.62, RW: 0.12, ST: 0.24,
};

/**
 * Shirt-number preference by position, tried in order. Squad generation walks
 * these so numbers read like a real teamsheet rather than 1..18.
 */
export const POSITION_SHIRT_PREFERENCE: Readonly<Record<Position, readonly number[]>> = {
  GK: [1, 12, 13, 31, 25],
  CB: [4, 5, 6, 15, 24, 33, 3],
  LB: [3, 16, 23, 26, 34],
  RB: [2, 18, 22, 27, 35],
  CDM: [6, 8, 14, 28, 36],
  CM: [8, 10, 14, 17, 20, 29],
  CAM: [10, 20, 21, 37, 11],
  LW: [11, 7, 19, 30, 38],
  RW: [7, 17, 19, 32, 39],
  ST: [9, 19, 21, 29, 40],
};

/** The exact-position build used when a caller has not asked for one. */
export const POSITION_FREQUENCY: readonly { position: Position; weight: number }[] = [
  { position: 'GK', weight: 10 },
  { position: 'CB', weight: 16 },
  { position: 'LB', weight: 8 },
  { position: 'RB', weight: 8 },
  { position: 'CDM', weight: 8 },
  { position: 'CM', weight: 15 },
  { position: 'CAM', weight: 8 },
  { position: 'LW', weight: 8 },
  { position: 'RW', weight: 8 },
  { position: 'ST', weight: 11 },
];

/** Which secondary positions a player of each natural position plausibly covers. */
export const SECONDARY_CANDIDATES: Readonly<Record<Position, readonly Position[]>> = {
  GK: [],
  CB: ['LB', 'RB', 'CDM'],
  LB: ['LW', 'CB', 'RB'],
  RB: ['RW', 'CB', 'LB'],
  CDM: ['CM', 'CB'],
  CM: ['CDM', 'CAM'],
  CAM: ['CM', 'LW', 'RW', 'ST'],
  LW: ['RW', 'CAM', 'ST', 'LB'],
  RW: ['LW', 'CAM', 'ST', 'RB'],
  ST: ['CAM', 'LW', 'RW'],
};

/** Build a full attribute record from a core level plus a position profile. */
export const attributesFromProfile = (
  position: Position,
  core: number,
  overrides: Partial<Record<AttributeKey, number>> = {},
): Attributes => {
  const profile = POSITION_PROFILES[position];
  const out = {} as Record<AttributeKey, number>;
  for (const key of ATTRIBUTE_KEYS) {
    const value = overrides[key] ?? core + profile[key].offset;
    out[key] = Math.max(1, Math.min(99, Math.round(value)));
  }
  return out;
};

/**
 * Deterministic authoring helper: attributes whose position-weighted overall
 * lands on `targetOverall`. Hand-written player templates state the rating a
 * designer means, and this finds the raw numbers that produce it — so a named
 * star cannot silently drift when the position weights are rebalanced.
 */
export const attributesForOverall = (
  position: Position,
  targetOverall: number,
  overrides: Partial<Record<AttributeKey, number>> = {},
): Attributes => {
  let core = targetOverall;
  let attributes = attributesFromProfile(position, core, overrides);
  for (let i = 0; i < 24; i++) {
    const delta = targetOverall - overallFor(attributes, position);
    if (delta === 0) break;
    core += delta;
    attributes = attributesFromProfile(position, core, overrides);
  }
  return attributes;
};
