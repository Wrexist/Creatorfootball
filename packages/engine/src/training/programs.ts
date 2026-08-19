import type { AttributeKey } from '../players/attributes';

/**
 * The seven training programs.
 *
 * Seven, not seventy. A management game earns its depth from choices the player
 * can hold in their head, and a wall of sliders is not depth — it is homework.
 * Every program here has at least one negative weight, so picking it is always
 * also declining something else, and every one states its cost in plain English
 * for the UI to show.
 */

export type TrainingIntensity = 'LIGHT' | 'NORMAL' | 'HARD';

export interface TrainingProgram {
  readonly id: string;
  readonly name: string;
  readonly blurb: string;
  /** Attribute pull. Negative values actively erode an attribute. */
  readonly weights: Readonly<Partial<Record<AttributeKey, number>>>;
  /** How exposed each attribute is to age decline under this program, 0-1. */
  readonly declineExposure: Readonly<Partial<Record<AttributeKey, number>>>;
  /** Overall growth multiplier. Recovery work grows almost nothing. */
  readonly effort: number;
  readonly fatigueCost: number;
  readonly injuryBias: number;
  /** Restores fitness instead of spending it. */
  readonly recovery: boolean;
  /** >0 concentrates the benefit on under-21s and starves everyone else. */
  readonly youthBias: number;
  /** Contribution to squad cohesion per cycle. */
  readonly cohesion: number;
  /** The cost, stated plainly. This string is shown to the player. */
  readonly tradeOff: string;
}

export const TRAINING_PROGRAMS: readonly TrainingProgram[] = [
  {
    id: 'ATTACK',
    name: 'Attacking Play',
    blurb: 'Finishing drills, movement in the box, final-third rehearsal.',
    weights: {
      finishing: 3, shooting: 2.6, dribbling: 1.8, composure: 1.2, technique: 1,
      defending: -1.1, positioning: -0.6,
    },
    declineExposure: { pace: 0.6, acceleration: 0.6 },
    effort: 1, fatigueCost: 1, injuryBias: 1, recovery: false, youthBias: 0, cohesion: 0.3,
    tradeOff: 'Your defensive shape rots while everyone practises shooting.',
  },
  {
    id: 'DEFENCE',
    name: 'Defensive Structure',
    blurb: 'Block work, marking, pressing triggers, set-piece defending.',
    weights: {
      defending: 3, positioning: 2.6, strength: 1.4, decisionMaking: 1.2,
      dribbling: -1, finishing: -0.9,
    },
    declineExposure: { pace: 0.5, physical: 0.5 },
    effort: 1, fatigueCost: 0.95, injuryBias: 0.95, recovery: false, youthBias: 0, cohesion: 0.6,
    tradeOff: 'Attackers lose sharpness in front of goal.',
  },
  {
    id: 'FITNESS',
    name: 'Fitness',
    blurb: 'Running, gym, conditioning. Hard, unglamorous work.',
    weights: {
      stamina: 3, physical: 2.4, strength: 2, pace: 1.4, acceleration: 1.2,
      technique: -1.2, vision: -0.8, passing: -0.6,
    },
    declineExposure: {},
    effort: 1.05, fatigueCost: 1.5, injuryBias: 1.6, recovery: false, youthBias: 0, cohesion: 0,
    tradeOff: 'Nobody touches a ball. Technique and vision decay, and legs break.',
  },
  {
    id: 'TECHNICAL',
    name: 'Technical Work',
    blurb: 'First touch, passing patterns, delivery, close control.',
    weights: {
      technique: 2.8, passing: 2.6, crossing: 1.8, dribbling: 1.6, vision: 1.2,
      physical: -1, stamina: -0.9,
    },
    declineExposure: { physical: 0.7, stamina: 0.7 },
    effort: 1, fatigueCost: 0.75, injuryBias: 0.7, recovery: false, youthBias: 0, cohesion: 0.4,
    tradeOff: 'The squad gets sharper and softer at the same time.',
  },
  {
    id: 'TACTICAL',
    name: 'Tactical Sessions',
    blurb: 'Video, shape, rehearsed patterns, decision-making under pressure.',
    weights: {
      decisionMaking: 2.8, positioning: 2.2, composure: 1.8, vision: 1.4,
      pace: -0.8, acceleration: -0.7,
    },
    declineExposure: { pace: 0.8, acceleration: 0.8 },
    effort: 0.9, fatigueCost: 0.5, injuryBias: 0.5, recovery: false, youthBias: 0, cohesion: 1.2,
    tradeOff: 'Lots of standing about. Physical edge dulls.',
  },
  {
    id: 'RECOVERY',
    name: 'Recovery',
    blurb: 'Rest, pool work, physio. Nobody improves; everybody heals.',
    weights: { composure: 0.4 },
    declineExposure: {},
    effort: 0.15, fatigueCost: 0, injuryBias: 0, recovery: true, youthBias: 0, cohesion: 0.2,
    tradeOff: 'A week of development thrown away to protect what you have.',
  },
  {
    id: 'YOUTH',
    name: 'Youth Focus',
    blurb: 'The kids train with the first team and the seniors carry them.',
    weights: {
      technique: 2, passing: 1.8, decisionMaking: 1.8, dribbling: 1.6, finishing: 1.2,
      strength: 0.8,
    },
    declineExposure: { pace: 0.5 },
    effort: 1, fatigueCost: 0.9, injuryBias: 1.15, recovery: false, youthBias: 1, cohesion: -0.3,
    tradeOff: 'Your senior players stagnate for a season so the academy does not.',
  },
] as const;

export const PROGRAM_BY_ID: ReadonlyMap<string, TrainingProgram> = new Map(
  TRAINING_PROGRAMS.map((p) => [p.id, p]),
);

export const programById = (id: string): TrainingProgram =>
  PROGRAM_BY_ID.get(id) ?? (TRAINING_PROGRAMS[0] as TrainingProgram);

export const INTENSITY_LABELS: Record<TrainingIntensity, string> = {
  LIGHT: 'Light', NORMAL: 'Normal', HARD: 'Hard',
};
