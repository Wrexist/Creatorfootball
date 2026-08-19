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
  const confidence = 1 + BALANCE.CONFIDENCE_WEIGHT * ((p.mental.confidence - 50) / 50);

  const sensitivity = ATMOSPHERE_SENSITIVITY[key] ?? 0.4;
  const atmosphere = 1 + BALANCE.ATMOSPHERE_WEIGHT * ctx.atmosphere * sensitivity;

  // Pressure only bites players who cannot handle it; a 90 stays a 90.
  const exposure = 1 - clamp01(p.mental.pressureHandling / 100);
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
  /** Set-piece and cross threat. */
  readonly aerial: number;
  /** The keeper, alone. */
  readonly keeper: number;
  /** Mean discipline, 0-99; drives the card model. */
  readonly discipline: number;
  /** Outfielders currently on the pitch. */
  readonly outfield: number;
}

interface AggregateSpec {
  readonly attributes: readonly (readonly [AttributeKey, number])[];
  readonly roleWeights: Record<SlotRole, number>;
}

const SPECS: Record<Exclude<keyof TeamAggregates, 'keeper' | 'discipline' | 'outfield'>, AggregateSpec> = {
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
      total += (sub / subWeight) * rw;
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
    keeper,
    discipline,
    outfield,
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
}

/** Probability a progression attempt moves the ball meaningfully forward. */
export function progressionChance(input: PossessionInput): number {
  const atk = input.attack.progression * (0.9 + 0.2 * input.attackVector.possessionBias);
  const def = input.defence.defence * input.defenceVector.defensiveSolidity;
  const edge = ((atk - def) / 10) * BALANCE.PROGRESSION_EDGE;
  const pressDrag = 0.09 * input.defenceVector.aggression;
  return clamp(BALANCE.PROGRESSION_BASE + edge - pressDrag + input.momentumBoost * 0.5, 0.22, 0.92);
}

/** Probability the defending team wins the ball on this tick. */
export function turnoverChance(input: PossessionInput): number {
  // Softened: pressing quality is a nudge, not a second strength multiplier.
  const pressQuality = 0.55 + 0.45 * (input.defence.pressing / 55);
  const press = BALANCE.TURNOVER_PRESS * input.defenceVector.pressRecovery * 2 * pressQuality;

  const atk = input.attack.progression * (0.92 + 0.16 * input.attackVector.possessionBias);
  const def = input.defence.defence * input.defenceVector.defensiveSolidity;
  const edge = ((def - atk) / 10) * BALANCE.TURNOVER_EDGE;

  let p = BALANCE.TURNOVER_BASE + press + edge;
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
  return clamp(p, 0.05, 0.75);
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
  const quality = clamp01(input.chanceQuality);
  const advance = lerp(0.04, 0.2, quality) * rng.float(0.4, 1.4);
  const x = clamp(Math.max(input.zone, BALANCE.FINAL_THIRD_ZONE) + advance, 0.66, 0.97);

  const widthSpread = lerp(0.1, 0.3, clamp01((input.widthBias + 1) / 2)) * (input.setPiece ? 0.7 : 1);
  const offset = rng.normal(0, widthSpread) * lerp(1.15, 0.75, quality);
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

  // A chance served on a plate is worth more than one dug out alone.
  xg *= 1 + BALANCE.XG_ASSIST_WEIGHT * (clamp01(input.assistQuality) - 0.35);

  // The keeper is part of chance quality, not only of the save roll.
  xg *= 1 - BALANCE.XG_KEEPER_WEIGHT * ((input.keeper - 55) / 55);

  if (input.counter) xg *= BALANCE.XG_COUNTER_BONUS;
  if (input.header) xg *= BALANCE.XG_HEADER_FACTOR;
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
export function resolveShot(rng: Rng, xg: number, keeper: number, blockPressure: number): ShotResult {
  if (rng.chance(clamp01(xg))) return 'GOAL';

  const keeperEdge = BALANCE.SAVE_KEEPER_WEIGHT * ((keeper - 55) / 55);
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
  const chasing = input.inPossession ? 1 : 1 + BALANCE.FATIGUE_OUT_OF_POSSESSION;
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
