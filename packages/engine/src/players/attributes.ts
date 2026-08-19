import type { Position } from './positions';
import { clamp, weightedMean } from '../core/math';

/**
 * Technical / physical attributes, 1-99.
 *
 * Deliberately fewer than a hardcore management sim: every attribute here is
 * read by at least one simulation subsystem. We do not ship decorative numbers.
 */
export const ATTRIBUTE_KEYS = [
  'pace', 'acceleration', 'shooting', 'finishing', 'passing', 'vision',
  'dribbling', 'technique', 'crossing', 'defending', 'positioning',
  'physical', 'strength', 'stamina', 'decisionMaking', 'composure', 'reflexes',
] as const;
export type AttributeKey = (typeof ATTRIBUTE_KEYS)[number];
export type Attributes = Record<AttributeKey, number>;

export const ATTRIBUTE_LABELS: Record<AttributeKey, string> = {
  pace: 'Pace', acceleration: 'Acceleration', shooting: 'Shooting', finishing: 'Finishing',
  passing: 'Passing', vision: 'Vision', dribbling: 'Dribbling', technique: 'Technique',
  crossing: 'Crossing', defending: 'Defending', positioning: 'Positioning',
  physical: 'Physical', strength: 'Strength', stamina: 'Stamina',
  decisionMaking: 'Decision Making', composure: 'Composure', reflexes: 'Reflexes',
};

export const ATTRIBUTE_CATEGORIES: Record<string, readonly AttributeKey[]> = {
  Physical: ['pace', 'acceleration', 'physical', 'strength', 'stamina'],
  Attacking: ['shooting', 'finishing', 'dribbling', 'technique', 'crossing'],
  Playmaking: ['passing', 'vision', 'decisionMaking'],
  Defending: ['defending', 'positioning'],
  Mentality: ['composure'],
  Goalkeeping: ['reflexes'],
};

/**
 * Per-position attribute weighting. This is what makes a 78-rated centre back a
 * different object from a 78-rated winger rather than the same number twice.
 * Weights are normalised at read time, so they need not sum to 1.
 */
export const POSITION_WEIGHTS: Record<Position, Partial<Record<AttributeKey, number>>> = {
  GK: { reflexes: 5, positioning: 3, composure: 2, decisionMaking: 2, physical: 1.5, passing: 1, strength: 1 },
  CB: { defending: 5, positioning: 4, strength: 3, physical: 2.5, composure: 2, pace: 1.5, passing: 1.5, decisionMaking: 2 },
  LB: { defending: 3.2, pace: 3, stamina: 3, crossing: 2.5, positioning: 2, physical: 1.8, passing: 1.8, acceleration: 2 },
  RB: { defending: 3.2, pace: 3, stamina: 3, crossing: 2.5, positioning: 2, physical: 1.8, passing: 1.8, acceleration: 2 },
  CDM: { defending: 4, positioning: 3.5, passing: 3, decisionMaking: 3, stamina: 2.5, strength: 2.2, composure: 2 },
  CM: { passing: 4, vision: 3.5, stamina: 3.2, decisionMaking: 3, technique: 2.5, dribbling: 2, defending: 2, composure: 2 },
  CAM: { vision: 4.2, passing: 3.8, technique: 3.5, dribbling: 3.2, shooting: 2.5, composure: 2.5, decisionMaking: 2.5 },
  LW: { pace: 4, acceleration: 3.8, dribbling: 4, crossing: 3, technique: 2.8, finishing: 2.2, stamina: 2 },
  RW: { pace: 4, acceleration: 3.8, dribbling: 4, crossing: 3, technique: 2.8, finishing: 2.2, stamina: 2 },
  ST: { finishing: 5, shooting: 4, composure: 3, positioning: 3, pace: 2.6, strength: 2.4, technique: 2, acceleration: 2.2 },
};

/** Position-weighted overall rating, 1-99. */
export function overallFor(attributes: Attributes, position: Position): number {
  const weights = POSITION_WEIGHTS[position];
  const entries = Object.entries(weights).map(([key, weight]) => ({
    value: attributes[key as AttributeKey],
    weight: weight as number,
  }));
  return clamp(Math.round(weightedMean(entries)), 1, 99);
}

export const emptyAttributes = (fill = 50): Attributes =>
  Object.fromEntries(ATTRIBUTE_KEYS.map((k) => [k, fill])) as Attributes;

/** The three attributes that most define this player, for compact cards. */
export function keyAttributes(attributes: Attributes, position: Position, n = 3): AttributeKey[] {
  const weights = POSITION_WEIGHTS[position];
  return (Object.keys(weights) as AttributeKey[])
    .sort((a, b) => {
      const scoreA = attributes[a] * (weights[a] ?? 0);
      const scoreB = attributes[b] * (weights[b] ?? 0);
      return scoreB - scoreA;
    })
    .slice(0, n);
}
