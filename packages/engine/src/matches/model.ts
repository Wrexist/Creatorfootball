import type { Player } from '../players/player';
import type { AttributeKey } from '../players/attributes';
import type { Position } from '../players/positions';
import { familiarity } from '../players/positions';
import type { TraitCondition, TraitModifierKey } from '../players/traits';
import { traitModifier, traitMultiplier } from '../players/traits';
import type { TacticVector } from '../tactics/tactics';
import type { Rng } from '../core/rng';
import { clamp, clamp01, lerp } from '../core/math';
import { BALANCE } from './balance';

/**
 * The probability model.
 *
 * Everything the simulator asks of chance goes through this file, and nothing
 * here knows about events, commentary or match state — it takes numbers and
 * returns numbers. That separation is what makes the model testable in
 * isolation and re-tunable without touching the tick loop.
 *
 * Two ideas carry most of the weight:
 *
 * 1. **Effective attributes.** A player is never his raw attribute. He is that
 *    attribute after fitness, in-match fatigue, how well he knows the slot he
 *    is standing in, his form, his confidence, the noise of the crowd, the
 *    weight of the occasion and his traits. Every one of those is a lever the
 *    rest of the game pulls on, which is why they all resolve here.
 *
 * 2. **Continuous xG.** A chance is a location, a body position and a set of
 *    people. It resolves to a real number between ~0.02 and ~0.9, and the goal
 *    is a single Bernoulli draw on that number. There is no "20% chance to
 *    score" anywhere in this engine.
 */

// --------------------------------------------------------------------------
// Effective attributes
// --------------------------------------------------------------------------

/** Which trait modifier sharpens which attribute. Unmapped attributes take no trait effect. */
const TRAIT_FOR_ATTRIBUTE: Partial<Record<AttributeKey, TraitModifierKey>> = {
  finishing: 'shotConversion',
  shooting: 'shotConversion',
  passing: 'passAccuracy',
  crossing: 'passAccuracy',
  vision: 'creativity',
  dribbling: 'dribbleSuccess',
  technique: 'dribbleSuccess',
  defending: 'tackleSuccess',
  positioning: 'tackleSuccess',
  reflexes: 'saveChance',
  strength: 'duelWin',
  physical: 'duelWin',
  pace: 'counterThreat',
  acceleration: 'counterThreat',
  composure: 'pressResistance',
  decisionMaking: 'pressResistance',
};

/** How much a hostile or lifted crowd moves each attribute. Legs care less than heads. */
const ATMOSPHERE_SENSITIVITY: Partial<Record<AttributeKey, number>> = {
  composure: 1, finishing: 0.9, decisionMaking: 0.9, reflexes: 0.8, passing: 0.7,
  vision: 0.7, technique: 0.6, shooting: 0.6, dribbling: 0.5, defending: 0.5,
  positioning: 0.5, crossing: 0.5, strength: 0.2, physical: 0.2, pace: 0.15,
  acceleration: 0.15, stamina: 0.1,
};

export interface EffectiveContext {
  /** Trait conditions satisfied right now: BIG_MATCH, DERBY, LATE_GAME, LOSING, HOME, YOUNG, VETERAN. */
  readonly conditions: readonly TraitCondition[];
  /** The slot the player is actually standing in, which may not be his position. */
  readonly slotPosition: Position;
  /** 0 = fresh, 1 = spent. */
  readonly fatigue: number;
  /** 1 = fit, below 1 = playing through something. */
  readonly capacity: number;
  /** -1 (crowd against him) .. +1 (crowd behind him). */
  readonly atmosphere: number;
  /** 0-1 weight of the occasion; interacts with the player's pressureHandling. */
  readonly pressure: number;
}

/**
 * base x fitness x fatigue x familiarity x form x confidence x atmosphere x
 * pressure x traits. Deliberately multiplicative: a tired player out of
 * position in a hostile stadium in a cup final compounds, which is exactly the
 * story the player should be able to read off the pitch.
 */
export function effectiveAttribute(p: Player, key: AttributeKey, ctx: EffectiveContext): number {
  const base = p.attributes[key];

  const fitness = 1 - BALANCE.FITNESS_WEIGHT * (1 - clamp01(p.fitness / 100));
  const fatigue = 1 - BALANCE.FATIGUE_ATTR_PENALTY * clamp01(ctx.fatigue);
  const fam = Math.max(
    BALANCE.FAMILIARITY_FLOOR,
    Math.max(
      familiarity(p.position, ctx.slotPosition),
      p.secondaryPositions.includes(ctx.slotPosition) ? 0.88 : 0,
    ),
  );
  const form = 1 + BALANCE.FORM_WEIGHT * clamp(p.form.rating, -1, 1);

  // Morale resilience: how much of a bad head a player carries onto the pitch.
  // It only ever bites downward — a resilient player is not better when things
  // are going well, he is simply harder to knock over when they are not.
  const resilience = clamp(traitModifier(p.traitIds, 'moraleResilience', ctx.conditions), -0.6, 0.6);
  const confidenceGap = (p.mental.confidence - 50) / 50;
  const confidence = 1 + BALANCE.CONFIDENCE_WEIGHT * confidenceGap
    * (confidenceGap < 0 ? 1 - resilience : 1);

  const sensitivity = ATMOSPHERE_SENSITIVITY[key] ?? 0.4;
  const atmosphere = 1 + BALANCE.ATMOSPHERE_WEIGHT * ctx.atmosphere * sensitivity;

  // Pressure only bites players who cannot handle it; a 90 stays a 90.
  const exposure = (1 - clamp01(p.mental.pressureHandling / 100)) * Math.max(0, 1 - resilience);
  const pressure = 1 - BALANCE.PRESSURE_WEIGHT * ctx.pressure * exposure * sensitivity;

  const traitKey = TRAIT_FOR_ATTRIBUTE[key];
  const trait = traitKey ? traitMultiplier(p.traitIds, traitKey, ctx.conditions) : 1;

  // Occasion traits lift the whole player rather than one attribute, at half weight.
  const occasion = 1
    + 0.5 * traitModifier(p.traitIds, 'bigMatchBonus', ctx.conditions)
    + 0.5 * traitModifier(p.traitIds, 'lateGameBonus', ctx.conditions);

  const value = base * fitness * fatigue * fam * form * confidence
    * atmosphere * pressure * trait * occasion * clamp(ctx.capacity, 0.2, 1);

  return clamp(value, 1, 130);
}

// --------------------------------------------------------------------------
// Team aggregates
// --------------------------------------------------------------------------

export type SlotRole = 'GK' | 'DEF' | 'MID' | 'ATT';

export interface UnitView {
  readonly player: Player;
  readonly role: SlotRole;
  readonly ctx: EffectiveContext;
}

export interface TeamAggregates {
  /** Ability to finish and occupy dangerous positions. */
  readonly attack: number;
  /** Ability to manufacture a chance for someone else. */
  readonly creation: number;
  /** Ability to move the ball up the pitch under pressure. */
  readonly progression: number;
  /** Ability to stop the above. */
  readonly defence: number;
  /** Ability to win the ball back high and repeatedly. */
  readonly pressing: number;
  /** Set-piece and cross threat, including the `aerialThreat` trait. */
  readonly aerial: number;
  /** Raw running speed of the unit; drives the ball over the top. */
  readonly pace: number;
  /** The keeper, alone. */
  readonly keeper: number;
  /** Mean discipline, 0-99; drives the card model. */
  readonly discipline: number;
  /** Outfielders currently on the pitch. */
  readonly outfield: number;
  /**
   * Mean trait modifier across the side for the keys the model reads at team
   * level rather than through a single attribute. Computed here so no read site
   * has to walk the squad again.
   */
  readonly traits: Readonly<Record<TeamTraitKey, number>>;
}

/** Trait keys the model reads as a team-level mean. */
export const TEAM_TRAIT_KEYS = [
  'passAccuracy', 'dribbleSuccess', 'pressResistance', 'tackleSuccess',
  'duelWin', 'counterThreat', 'aerialThreat', 'chemistry', 'teammateMorale',
] as const;
export type TeamTraitKey = (typeof TEAM_TRAIT_KEYS)[number];

interface AggregateSpec {
  readonly attributes: readonly (readonly [AttributeKey, number])[];
  readonly roleWeights: Record<SlotRole, number>;
}

const SPECS: Record<Exclude<keyof TeamAggregates, 'keeper' | 'discipline' | 'outfield' | 'traits'>, AggregateSpec> = {
  attack: {
    attributes: [['finishing', 3], ['shooting', 2], ['positioning', 1.2], ['composure', 1.2], ['technique', 1]],
    roleWeights: { GK: 0, DEF: 0.12, MID: 0.5, ATT: 1 },
  },
  creation: {
    attributes: [['vision', 3], ['passing', 2.6], ['technique', 1.4], ['decisionMaking', 1.4], ['crossing', 1]],
    roleWeights: { GK: 0.05, DEF: 0.3, MID: 1, ATT: 0.7 },
  },
  progression: {
    attributes: [['passing', 2.2], ['dribbling', 2], ['technique', 1.6], ['pace', 1.2], ['composure', 1.2], ['decisionMaking', 1.2]],
    roleWeights: { GK: 0.08, DEF: 0.45, MID: 1, ATT: 0.75 },
  },
  defence: {
    attributes: [['defending', 3.2], ['positioning', 2.4], ['strength', 1.4], ['physical', 1.2], ['decisionMaking', 1]],
    roleWeights: { GK: 0, DEF: 1, MID: 0.6, ATT: 0.16 },
  },
  pressing: {
    attributes: [['stamina', 2.2], ['pace', 1.8], ['defending', 1.8], ['acceleration', 1.4], ['physical', 1]],
    roleWeights: { GK: 0, DEF: 0.7, MID: 1, ATT: 0.85 },
  },
  aerial: {
    attributes: [['strength', 2.4], ['physical', 2], ['positioning', 1.4], ['finishing', 1]],
    roleWeights: { GK: 0, DEF: 0.9, MID: 0.6, ATT: 1 },
  },
  pace: {
    attributes: [['pace', 3], ['acceleration', 2.4], ['stamina', 1]],
    roleWeights: { GK: 0, DEF: 0.75, MID: 0.9, ATT: 1 },
  },
};

/** Aggregates that take a direct per-player trait multiplier on top of their attributes. */
const AGGREGATE_TRAIT: Partial<Record<keyof typeof SPECS, TraitModifierKey>> = {
  aerial: 'aerialThreat',
  pace: 'counterThreat',
};

/**
 * Aggregates are means, so they answer "how good is this unit" rather than "how
 * many bodies are in it". Manpower is folded back in separately: a team down to
 * six outfielders defends worse in a way a mean would hide completely.
 */
export function computeAggregates(units: readonly UnitView[], expectedOutfield: number): TeamAggregates {
  const outfield = units.filter((u) => u.role !== 'GK').length;
  const result: Record<string, number> = {};

  for (const [name, spec] of Object.entries(SPECS)) {
    let total = 0;
    let weight = 0;
    for (const u of units) {
      const rw = spec.roleWeights[u.role];
      if (rw <= 0) continue;
      let sub = 0;
      let subWeight = 0;
      for (const [key, w] of spec.attributes) {
        sub += effectiveAttribute(u.player, key, u.ctx) * w;
        subWeight += w;
      }
      const traitKey = AGGREGATE_TRAIT[name as keyof typeof SPECS];
      const traitScale = traitKey ? traitMultiplier(u.player.traitIds, traitKey, u.ctx.conditions) : 1;
      total += (sub / subWeight) * traitScale * rw;
      weight += rw;
    }
    result[name] = weight > 0 ? total / weight : 40;
  }

  const gk = units.find((u) => u.role === 'GK');
  const keeper = gk
    ? (effectiveAttribute(gk.player, 'reflexes', gk.ctx) * 3
      + effectiveAttribute(gk.player, 'positioning', gk.ctx) * 1.6
      + effectiveAttribute(gk.player, 'composure', gk.ctx) * 1.2
      + effectiveAttribute(gk.player, 'decisionMaking', gk.ctx) * 1) / 6.8
    // An empty net is not a keeper. This happens after a keeper is sent off.
    : 22;

  const discipline = units.length
    ? units.reduce((a, u) => a + u.player.mental.discipline, 0) / units.length
    : 50;

  const traits: Record<string, number> = {};
  for (const key of TEAM_TRAIT_KEYS) {
    let total = 0;
    for (const u of units) total += traitModifier(u.player.traitIds, key, u.ctx.conditions);
    traits[key] = units.length ? total / units.length : 0;
  }

  const size = expectedOutfield > 0 ? outfield / expectedOutfield : 1;
  const defenceManpower = 0.4 + 0.6 * size;
  const pressManpower = 0.35 + 0.65 * size;
  const attackManpower = 0.72 + 0.28 * size;

  return {
    attack: (result['attack'] as number) * attackManpower,
    creation: (result['creation'] as number) * attackManpower,
    progression: (result['progression'] as number) * (0.78 + 0.22 * size),
    defence: (result['defence'] as number) * defenceManpower,
    pressing: (result['pressing'] as number) * pressManpower,
    aerial: result['aerial'] as number,
    pace: (result['pace'] as number) * (0.8 + 0.2 * size),
    keeper,
    discipline,
    outfield,
    traits: traits as Readonly<Record<TeamTraitKey, number>>,
  };
}

// --------------------------------------------------------------------------
// Possession
// --------------------------------------------------------------------------

export interface PossessionInput {
  readonly attack: TeamAggregates;
  readonly defence: TeamAggregates;
  readonly attackVector: TacticVector;
  readonly defenceVector: TacticVector;
  readonly zone: number;
  readonly finalThird: boolean;
  /** +/- multiplier band from momentum, already capped by MOMENTUM_MAX_EFFECT. */
  readonly momentumBoost: number;
  /** Crowd/home multiplier for the team in possession. */
  readonly homeBoost: number;
  /** Mean fatigue of the defending side, 0-1. A spent press stops pressing. */
  readonly defenceFatigue: number;
  /** Goals the team in possession is ahead by; negative when behind. */
  readonly leadMargin: number;
}

/**
 * Diminishing returns on the quality gap.
 *
 * Every term that reads the attack-minus-defence gap goes through this. A tanh
 * leaves a ten-point gap behaving as it always did and stops a thirty-point one
 * from being three times as large at four terms simultaneously — which is what
 * turned a real fixture list into a run of 15-1 scorelines while the
 * evenly-matched aggregate audit stayed green.
 */
export const gapTerm = (gap: number, max: number): number =>
  Math.tanh(gap / BALANCE.RATING_GAP_SOFTNESS) * max;

/** Probability a progression attempt moves the ball meaningfully forward. */
export function progressionChance(input: PossessionInput): number {
  const atk = input.attack.progression * (0.9 + 0.2 * input.attackVector.possessionBias);
  const def = input.defence.defence * input.defenceVector.defensiveSolidity;
  const edge = gapTerm(atk - def, BALANCE.PROGRESSION_EDGE_MAX);
  // A press that has run itself into the ground stops dragging on anybody.
  const pressDrag = 0.09 * input.defenceVector.aggression * pressUpkeep(input.defenceFatigue);
  // Players who keep the ball under pressure move it forward more often.
  const trait = BALANCE.TRAIT_PROGRESSION_WEIGHT
    * (input.attack.traits.passAccuracy + input.attack.traits.dribbleSuccess) * 0.5;
  return clamp(
    (BALANCE.PROGRESSION_BASE + edge - pressDrag + input.momentumBoost * 0.5) * (1 + trait),
    0.22, 0.92,
  );
}

/** What is left of a pressing instruction once the legs have gone, 0-1. */
export const pressUpkeep = (fatigue: number): number =>
  Math.max(0.25, 1 - BALANCE.PRESS_FATIGUE_DECAY * clamp01(fatigue));

/** Probability the defending team wins the ball on this tick. */
export function turnoverChance(input: PossessionInput): number {
  // Softened: pressing quality is a nudge, not a second strength multiplier.
  const pressQuality = 0.55 + 0.45 * (input.defence.pressing / 55);
  // The press is only worth what the pressing side can still run.
  const press = BALANCE.TURNOVER_PRESS * input.defenceVector.pressRecovery * 2 * pressQuality
    * pressUpkeep(input.defenceFatigue)
    * (1 + BALANCE.TRAIT_TACKLE_WEIGHT
      * (input.defence.traits.tackleSuccess + input.defence.traits.duelWin) * 0.5);

  const atk = input.attack.progression * (0.92 + 0.16 * input.attackVector.possessionBias);
  const def = input.defence.defence * input.defenceVector.defensiveSolidity;
  const edge = gapTerm(def - atk, BALANCE.TURNOVER_EDGE_MAX);

  let p = (BALANCE.TURNOVER_BASE + press + edge)
    * Math.max(0.4, 1 - BALANCE.TRAIT_PRESS_RESISTANCE_WEIGHT * input.attack.traits.pressResistance);
  if (input.finalThird) p *= BALANCE.TURNOVER_FINAL_THIRD;
  p *= 1 - input.momentumBoost * 0.5;
  p *= 1 - 0.12 * (input.attackVector.possessionBias - 0.5) * 2;
  return clamp(p, 0.03, 0.62);
}

/** Probability the team in possession takes a shot on this final-third tick. */
export function shotChance(input: PossessionInput, counterWindow: boolean): number {
  const volume = 1 + (input.attackVector.attackVolume - 1) * BALANCE.SHOT_VOLUME_WEIGHT;
  const patience = 1 - 0.3 * (input.attackVector.chanceQuality - 0.5) * 2;
  const crowding = 1 - 0.18 * (input.defenceVector.defensiveSolidity - 1);
  const manpower = clamp(input.attack.outfield / Math.max(1, input.defence.outfield), 0.7, 1.45);
  let p = BALANCE.SHOT_BASE * volume * patience * crowding * (0.85 + 0.15 * manpower);
  if (counterWindow) p += BALANCE.SHOT_COUNTER_BONUS * input.attackVector.counterWeight;
  p *= 1 + input.momentumBoost;
  p *= input.homeBoost;
  p *= gameManagement(input.leadMargin);
  return clamp(p, 0.05, 0.75);
}

/**
 * A side four goals up in a thirty-minute match stops chasing a fifth. This is
 * the only place the scoreline touches the model, it only ever slows the side
 * in FRONT, and the side behind gets nothing for being behind — a compensating
 * bonus would make every comeback feel manufactured.
 */
export function gameManagement(leadMargin: number): number {
  const excess = Math.max(0, leadMargin - BALANCE.GAME_STATE_EASE_MARGIN);
  if (excess <= 0) return 1;
  return 1 - Math.min(BALANCE.GAME_STATE_EASE_MAX, excess * BALANCE.GAME_STATE_EASE_PER_GOAL);
}

// --------------------------------------------------------------------------
// The ball over the top
// --------------------------------------------------------------------------

export interface ThroughBallInput {
  /** The DEFENDING side's `spaceBehind`, 0-1. */
  readonly spaceBehind: number;
  /** The attacking side's `counterWeight`, 0-1. */
  readonly counterWeight: number;
  /** Attacking side's `pace` aggregate. */
  readonly attackPace: number;
  /** Defending side's `pace` aggregate — the recovery runners. */
  readonly defencePace: number;
  /** Mean `counterThreat` trait modifier of the attacking side. */
  readonly traitThreat: number;
  /** True in the ticks straight after a turnover, when the space is real. */
  readonly counterWindow: boolean;
}

/**
 * Per-tick probability that the side in possession plays a ball in behind the
 * last line and puts a runner through. This is the consumer `spaceBehind` never
 * had: without it a high line and a high press cost nothing but 0.14 offsides.
 */
export function throughBallChance(input: ThroughBallInput): number {
  const space = Math.pow(clamp01(input.spaceBehind) / 0.5, BALANCE.THROUGH_BALL_SPACE_EXPONENT);
  const intent = 1 + BALANCE.THROUGH_BALL_COUNTER_WEIGHT * (clamp01(input.counterWeight) - 0.5) * 2;
  const legs = 1 + BALANCE.THROUGH_BALL_PACE_WEIGHT
    * clamp((input.attackPace - input.defencePace) / 55, -0.6, 0.6);
  const trait = Math.max(0.3, 1 + BALANCE.THROUGH_BALL_TRAIT_WEIGHT * input.traitThreat);
  const window = input.counterWindow ? BALANCE.THROUGH_BALL_COUNTER_MULT : 1;
  return clamp(
    BALANCE.THROUGH_BALL_BASE * space * Math.max(0.2, intent) * Math.max(0.3, legs) * trait * window,
    0, 0.35,
  );
}

// --------------------------------------------------------------------------
// Chances and xG
// --------------------------------------------------------------------------

export interface ChanceInput {
  /** Zone the possession had reached, 0-1. */
  readonly zone: number;
  /** -1 central .. +1 wide; pushes the shot location off centre. */
  readonly widthBias: number;
  /** 0-1; higher means the team works the ball into better positions. */
  readonly chanceQuality: number;
  readonly counter: boolean;
  readonly header: boolean;
  readonly setPiece: boolean;
  readonly penalty: boolean;
  /** The chance arrived from a ball in behind: a run at the keeper. */
  readonly throughBall?: boolean;
  /**
   * Aerial edge on a headed chance: the gap between the two sides' `aerial`
   * aggregates plus whatever a narrow block leaves open at the far post.
   * Ignored on a shot that is not a header.
   */
  readonly aerialEdge?: number;
  /** The shooter's `shotConversion` trait modifier. */
  readonly shooterConversion?: number;
  /** The creator's `creativity` trait modifier. */
  readonly creatorFlair?: number;
  /** The attacking side's `volatility`, 1 = neutral. Widens the shot location. */
  readonly volatility?: number;
  /** 0-1 defensive pressure on the shooter. */
  readonly pressure: number;
  /** Effective finishing of the shooter. */
  readonly finishing: number;
  /** Effective composure of the shooter. */
  readonly composure: number;
  /** 0-1 quality of the pass that created it; 0 when he made it himself. */
  readonly assistQuality: number;
  /** Effective keeper rating of the defending side. */
  readonly keeper: number;
  /** Multiplier from special rules, momentum and crowd. Keep near 1. */
  readonly multiplier: number;
}

export interface Chance {
  readonly x: number;
  readonly y: number;
  readonly xg: number;
  readonly big: boolean;
  readonly header: boolean;
  readonly distance: number;
}

/**
 * Build a chance. Location comes first, because location is most of xG: a good
 * team is one that reaches better locations more often, not one with a secret
 * bonus applied at the moment of the shot.
 */
export function buildChance(rng: Rng, input: ChanceInput): Chance {
  if (input.penalty) {
    return { x: 0.88, y: 0.5, xg: clamp(BALANCE.XG_PENALTY * input.multiplier, 0.4, 0.95), big: true, header: false, distance: 0.12 };
  }

  // Better sides get closer and squarer; a shot from a wide setup starts wider.
  // `volatility` widens both draws: a chaotic side finds better positions and
  // worse ones, which is what "swings games both ways" has to mean numerically.
  const swing = 1 + BALANCE.VOLATILITY_LOCATION_WEIGHT * ((input.volatility ?? 1) - 1);
  const quality = clamp01(input.chanceQuality);
  const spread = clamp(swing, 0.5, 2);
  const advance = lerp(0.04, 0.2, quality) * rng.float(1 - 0.6 * spread, 1 + 0.4 * spread);
  const x = clamp(Math.max(input.zone, BALANCE.FINAL_THIRD_ZONE) + advance, 0.66, 0.97);

  const widthSpread = lerp(0.1, 0.3, clamp01((input.widthBias + 1) / 2)) * (input.setPiece ? 0.7 : 1);
  const offset = rng.normal(0, widthSpread * spread) * lerp(1.15, 0.75, quality);
  const y = clamp(0.5 + offset, 0.06, 0.94);

  const dx = 1 - x;
  const dy = Math.abs(y - 0.5);
  const distance = Math.sqrt(dx * dx + (dy * 0.8) * (dy * 0.8));
  const angle = 1 / (1 + BALANCE.XG_ANGLE_PENALTY * (dy / (dx + 0.08)));

  let xg = BALANCE.XG_MAX * Math.exp(-BALANCE.XG_DIST_DECAY * distance) * angle;

  // Pressure: the difference between a free shot and one taken with a leg in.
  xg *= lerp(BALANCE.XG_PRESSURE_FLOOR, 1, 1 - clamp01(input.pressure));

  // The shooter. Finishing sets the mean, composure narrows the gap under duress.
  const shooter = (input.finishing * 0.72 + input.composure * 0.28);
  xg *= 1 + BALANCE.XG_FINISHING_WEIGHT * ((shooter - 55) / 55);
  // A finisher's trait is read here as well as through his finishing attribute:
  // a 14% modifier that reaches xG as 4% is not a trait a player can feel.
  xg *= Math.max(0.4, 1 + BALANCE.TRAIT_SHOT_CONVERSION_WEIGHT * (input.shooterConversion ?? 0));

  // A chance served on a plate is worth more than one dug out alone.
  xg *= 1 + BALANCE.XG_ASSIST_WEIGHT * (clamp01(input.assistQuality) - 0.35);
  xg *= Math.max(0.5, 1 + BALANCE.TRAIT_CREATIVITY_WEIGHT * (input.creatorFlair ?? 0));

  // The keeper is part of chance quality, not only of the save roll.
  xg *= 1 - BALANCE.XG_KEEPER_WEIGHT * ((input.keeper - 55) / 55);

  if (input.counter) xg *= BALANCE.XG_COUNTER_BONUS;
  if (input.throughBall) xg *= BALANCE.XG_THROUGH_BALL_BONUS;
  if (input.header) {
    // The aerial aggregate is finally read: who wins the ball in the box, and
    // how exposed the defending block is to a delivery from wide.
    xg *= BALANCE.XG_HEADER_FACTOR
      * Math.max(0.35, 1 + BALANCE.XG_AERIAL_WEIGHT * (input.aerialEdge ?? 0));
  }
  if (input.setPiece) xg *= 0.9;

  xg *= input.multiplier * BALANCE.CONVERSION_SCALE;

  const value = clamp(xg, BALANCE.XG_MIN, 0.92);
  return { x, y, xg: value, big: value >= BALANCE.BIG_CHANCE_XG, header: input.header, distance };
}

export type ShotResult = 'GOAL' | 'SAVE' | 'BLOCK' | 'MISS' | 'POST';

/**
 * The goal itself is one Bernoulli draw on xG, so aggregate xG and aggregate
 * goals agree by construction. Everything after that only decides what the
 * highlight looks like — and who gets credited with a save.
 */
export function resolveShot(
  rng: Rng, xg: number, keeper: number, blockPressure: number, keeperTrait = 0,
): ShotResult {
  if (rng.chance(clamp01(xg))) return 'GOAL';

  const keeperEdge = BALANCE.SAVE_KEEPER_WEIGHT * ((keeper - 55) / 55)
    + BALANCE.TRAIT_SAVE_WEIGHT * keeperTrait;
  const save = clamp(BALANCE.SAVE_SHARE + keeperEdge, 0.15, 0.65);
  const block = clamp(BALANCE.BLOCK_SHARE * (0.7 + 0.6 * clamp01(blockPressure)), 0.05, 0.45);
  const post = BALANCE.POST_SHARE;
  const total = save + block + post;
  const roll = rng.raw();
  if (roll < save) return 'SAVE';
  if (roll < save + block) return 'BLOCK';
  if (roll < total) return 'POST';
  return 'MISS';
}

/** Probability the keeper keeps it out, exposed for tests and for the UI's shot map. */
export const saveProbability = (xg: number, keeper: number): number =>
  (1 - clamp01(xg)) * clamp(BALANCE.SAVE_SHARE + BALANCE.SAVE_KEEPER_WEIGHT * ((keeper - 55) / 55), 0.15, 0.65);

// --------------------------------------------------------------------------
// Duels, passes, fouls, cards
// --------------------------------------------------------------------------

/** Symmetric contest. Returns true when the first rating wins. */
export function duelWin(rng: Rng, a: number, b: number, bias = 0): boolean {
  const p = clamp01(0.5 + (a - b) / 90 + bias);
  return rng.chance(p);
}

/** Pass completion given passer quality and the pressure he is under. */
export function passSuccess(rng: Rng, passer: number, pressure: number, defenderQuality: number): boolean {
  const base = 0.62 + 0.3 * ((passer - 50) / 60);
  const p = clamp(base - 0.22 * clamp01(pressure) - 0.1 * ((defenderQuality - 55) / 55), 0.25, 0.96);
  return rng.chance(p);
}

export interface FoulInput {
  readonly defenceVector: TacticVector;
  readonly rivalry: number;      // 0-1
  readonly pressure: number;     // 0-1, how stretched the defence is
  readonly finalThird: boolean;
}

export function foulChance(input: FoulInput): number {
  let p = BALANCE.FOUL_BASE * input.defenceVector.foulRate;
  p *= 1 + BALANCE.FOUL_PRESS_WEIGHT * input.defenceVector.aggression;
  p *= 1 + BALANCE.FOUL_RIVALRY_WEIGHT * clamp01(input.rivalry);
  p *= 1 + 0.3 * clamp01(input.pressure);
  if (input.finalThird) p *= 1.25;
  return clamp(p, 0, 0.2);
}

export interface CardInput {
  readonly offender: Player;
  readonly conditions: readonly TraitCondition[];
  readonly rivalry: number;
  readonly managerDiscipline: number;   // 0-100
  readonly stoppedClearChance: boolean;
  readonly alreadyBooked: boolean;
}

export type CardResult = 'NONE' | 'YELLOW' | 'RED';

export function resolveCard(rng: Rng, input: CardInput): CardResult {
  const traitRisk = 1 + traitModifier(input.offender.traitIds, 'cardRisk', input.conditions);
  const discipline = 1 + BALANCE.CARD_DISCIPLINE_WEIGHT * ((55 - input.offender.mental.discipline) / 55);
  const rivalry = 1 + BALANCE.CARD_RIVALRY_WEIGHT * clamp01(input.rivalry);
  const manager = 1 - BALANCE.CARD_MANAGER_WEIGHT * ((input.managerDiscipline - 50) / 100);
  const tactical = input.stoppedClearChance ? BALANCE.CARD_TACTICAL_FOUL : 1;

  const scale = Math.max(0.2, traitRisk) * Math.max(0.3, discipline) * rivalry * Math.max(0.5, manager) * tactical;

  if (rng.chance(clamp01(BALANCE.RED_FROM_FOUL * scale))) return 'RED';
  if (rng.chance(clamp01(BALANCE.YELLOW_FROM_FOUL * scale))) {
    return input.alreadyBooked ? 'RED' : 'YELLOW';
  }
  return 'NONE';
}

// --------------------------------------------------------------------------
// Fatigue and injury
// --------------------------------------------------------------------------

export interface FatigueInput {
  readonly player: Player;
  readonly conditions: readonly TraitCondition[];
  readonly vector: TacticVector;
  readonly inPossession: boolean;
  readonly fatigue: number;
}

/**
 * Fatigue is the price of every aggressive instruction, which is what turns a
 * high press from a free buff into a decision. It compounds: a tired player
 * both performs worse and gets injured more often.
 */
export function fatigueDelta(input: FatigueInput): number {
  const stamina = input.player.attributes.stamina;
  const staminaFactor = 1 - BALANCE.FATIGUE_STAMINA_WEIGHT * ((stamina - 55) / 55);
  const trait = Math.max(0.4, 1 + traitModifier(input.player.traitIds, 'staminaDrain', input.conditions));
  // Chasing the ball costs, but how much depends on where you chase it. A
  // compact low block without the ball is cheap; a high press without the ball
  // is a sprint. Charging both the same made LOW_BLOCK the most tiring shape
  // in the game, which inverted its whole reason for existing.
  const chasing = input.inPossession
    ? 1
    : 1 + BALANCE.FATIGUE_OUT_OF_POSSESSION
      * (1 + BALANCE.FATIGUE_CHASE_AGGRESSION * (clamp01(input.vector.aggression) - 0.5));
  const fitness = 1 + 0.3 * (1 - clamp01(input.player.fitness / 100));
  // The last stretch costs more than the first: fatigue feeds itself.
  const compounding = 1 + 0.35 * clamp01(input.fatigue);
  return BALANCE.FATIGUE_PER_TICK
    * Math.max(0.35, staminaFactor)
    * trait
    * chasing
    * fitness
    * compounding
    * input.vector.fatigueRate;
}

export interface InjuryInput {
  readonly vector: TacticVector;
  readonly meanFatigue: number;
  readonly rivalry: number;
}

export function injuryChance(input: InjuryInput): number {
  const intensity = 1 + BALANCE.INJURY_INTENSITY_WEIGHT * ((input.vector.fatigueRate - 1) + (input.vector.foulRate - 1));
  const fatigue = 1 + BALANCE.INJURY_FATIGUE_WEIGHT * clamp01(input.meanFatigue);
  const rivalry = 1 + 0.35 * clamp01(input.rivalry);
  return Math.max(0, BALANCE.INJURY_BASE * intensity * fatigue * rivalry);
}

export const INJURY_SEVERITIES = ['KNOCK', 'MINOR', 'MODERATE', 'SERIOUS', 'SEASON'] as const;
export type ModelInjurySeverity = (typeof INJURY_SEVERITIES)[number];

export function rollInjury(rng: Rng, player: Player, conditions: readonly TraitCondition[]): {
  severity: ModelInjurySeverity;
  weeksOut: number;
} {
  const proneness = Math.max(0.3, 1 + traitModifier(player.traitIds, 'injuryRisk', conditions));
  const weights = BALANCE.INJURY_SEVERITY_WEIGHTS;
  const index = rng.weighted(
    [0, 1, 2, 3, 4],
    (i) => (weights[i] as number) * (i >= 2 ? proneness : 1),
  );
  const severity = INJURY_SEVERITIES[index] as ModelInjurySeverity;
  const band = BALANCE.INJURY_WEEKS[index] as readonly [number, number];
  const recovery = 1 - 0.25 * ((player.mental.professionalism - 50) / 100);
  const weeksOut = Math.max(0, Math.round(rng.int(band[0], band[1]) * recovery));
  return { severity, weeksOut };
}

// --------------------------------------------------------------------------
// Shared helpers
// --------------------------------------------------------------------------

/** How hard the defence is squeezing right now, 0-1. Feeds xG, fouls and passing. */
export function defensivePressure(
  defence: TeamAggregates,
  defenceVector: TacticVector,
  zone: number,
): number {
  const quality = clamp01((defence.defence - 30) / 60);
  const commitment = clamp01(0.35 + 0.5 * defenceVector.defensiveSolidity * 0.6 + 0.3 * defenceVector.aggression);
  // Defences are densest in their own box and thinnest on the halfway line.
  const density = clamp01(0.4 + 0.75 * Math.max(0, zone - 0.5));
  return clamp01(0.25 + 0.75 * (quality * 0.25 + commitment * 0.4 + density * 0.35));
}

/** Space in behind the last line, 0-1. High lines and pressing raise it. */
export function spaceInBehind(defenceVector: TacticVector): number {
  return clamp01(defenceVector.spaceBehind);
}
