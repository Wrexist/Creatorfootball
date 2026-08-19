import { clamp, clamp01 } from '../core/math';
import { hashString, type Rng } from '../core/rng';
import type { AttributeKey } from '../players/attributes';
import { ATTRIBUTE_KEYS, overallFor } from '../players/attributes';
import type { InjuryState, Player } from '../players/player';
import { traitMultiplier } from '../players/traits';
import { TRAINING_BALANCE as T } from './balance';
import type { TrainingIntensity, TrainingProgram } from './programs';

/**
 * Individual development.
 *
 * Two ideas carry this module. First, growth is a *product* of many small
 * multipliers rather than a sum, so a player who is young, playing, professional
 * and well coached develops dramatically faster than one who is merely young —
 * which is the whole reason to care about squad selection. Second, every player
 * has a hidden growth character derived from his id, so two identical prospects
 * given identical treatment do not produce identical careers.
 *
 * Fractional gains are resolved by dice rather than accumulated in a hidden
 * field: a rate of 0.4 points is a 40% chance of +1 this cycle. Expected value
 * is exact, the Player shape stays frozen, and progress feels like events
 * rather than a bar creeping up.
 */

export interface DevelopmentContext {
  readonly cycle: number;
  readonly program: TrainingProgram;
  readonly intensity: TrainingIntensity;
  /** Facility `trainingGain` effect, additive around 0. */
  readonly trainingGain: number;
  /** Facility `injuryResistance` effect, additive around 0 (higher is safer). */
  readonly injuryResistance: number;
  /** Facility `youthQuality` effect, additive around 0. Only helps under-21s. */
  readonly youthQuality: number;
  /** Manager `playerDevelopment`, 0-100. */
  readonly managerDevelopment: number;
  /** Share of available minutes this player has actually had, 0-1. */
  readonly minutesShare: number;
  /** Optional single attribute this player is working on. */
  readonly focusAttribute?: AttributeKey;
}

export interface PlayerDevelopment {
  readonly playerId: Player['id'];
  readonly attributeDeltas: Readonly<Partial<Record<AttributeKey, number>>>;
  readonly overallBefore: number;
  readonly overallAfter: number;
  /** Raw growth rate before dice. Exposed for balance tooling, not for the UI. */
  readonly growthPressure: number;
  readonly potentialDelta: number;
  readonly fitnessDelta: number;
  readonly moraleDelta: number;
  readonly injury: InjuryState | null;
  readonly notes: readonly string[];
}

/** Hidden, deterministic per-player growth character. Same player, same career shape. */
export function growthCharacter(playerId: string): number {
  const h = hashString(`growth:${playerId}`) / 0xffffffff;
  return T.CHARACTER_MIN + h * (T.CHARACTER_MAX - T.CHARACTER_MIN);
}

/** Age curve: fast to 21, tapering to nothing at 30, negative after 31. */
export function ageGrowthFactor(age: number): number {
  if (age <= T.PEAK_GROWTH_AGE_END) {
    // Very young players are physically limited even though they learn fastest.
    const ramp = clamp01((age - (T.PEAK_GROWTH_AGE_START - 2)) / 3);
    return 0.55 + ramp * 0.45;
  }
  if (age >= T.GROWTH_ZERO_AGE) return 0;
  return clamp01((T.GROWTH_ZERO_AGE - age) / (T.GROWTH_ZERO_AGE - T.PEAK_GROWTH_AGE_END));
}

function headroomFactor(p: Player): number {
  const headroom = Math.max(0, p.potential - p.overall);
  return clamp01(headroom / T.HEADROOM_REFERENCE) ** T.HEADROOM_EXPONENT;
}

function minutesFactor(share: number): number {
  const t = clamp01(share / T.MINUTES_SATURATION);
  return T.MINUTES_FLOOR_MULTIPLIER + t * (T.MINUTES_FULL_MULTIPLIER - T.MINUTES_FLOOR_MULTIPLIER);
}

/** The full multiplier stack, exposed so tests and tuning tools can inspect it. */
export function growthRate(p: Player, ctx: DevelopmentContext): number {
  const intensity = T.INTENSITY[ctx.intensity] ?? T.INTENSITY.NORMAL;
  const professional = 1 + ((p.mental.professionalism - 50) / 50) * T.PROFESSIONALISM_SWING;
  const morale = 1 + ((p.mental.morale - 50) / 50) * T.MORALE_SWING;
  const manager = 1 + ((ctx.managerDevelopment - 50) / 50) * T.MANAGER_SWING;
  const facility = 1 + ctx.trainingGain * T.FACILITY_WEIGHT;
  const fitness = p.fitness < T.FITNESS_GROWTH_THRESHOLD ? 0.5 : 1;

  const youthBias =
    ctx.program.youthBias > 0
      ? p.age <= T.YOUTH_AGE_LIMIT
        ? T.YOUTH_BONUS * (1 + ctx.youthQuality)
        : T.YOUTH_PENALTY
      : 1;

  return (
    T.GROWTH_BASE *
    ageGrowthFactor(p.age) *
    headroomFactor(p) *
    minutesFactor(ctx.minutesShare) *
    Math.max(0.2, professional) *
    Math.max(0.2, morale) *
    Math.max(0.2, manager) *
    Math.max(0.3, facility) *
    fitness *
    (intensity?.growth ?? 1) *
    ctx.program.effort *
    youthBias *
    traitMultiplier(p.traitIds, 'developmentRate') *
    growthCharacter(p.id)
  );
}

/** Turn a fractional point gain into an integer using a single die roll. */
function resolvePoints(rate: number, rng: Rng): number {
  const whole = Math.trunc(rate);
  const frac = rate - whole;
  return whole + (rng.raw() < Math.abs(frac) ? Math.sign(frac) : 0);
}

function rollInjury(p: Player, ctx: DevelopmentContext, rng: Rng): InjuryState | null {
  const intensity = T.INTENSITY[ctx.intensity] ?? T.INTENSITY.NORMAL;
  const fatiguePenalty = Math.max(0, 50 - p.fitness) * T.INJURY_PER_FATIGUE_POINT;
  const agePenalty = 1 + Math.max(0, p.age - 30) * T.INJURY_AGE_PER_YEAR;
  const chance =
    (T.INJURY_BASE_CHANCE + fatiguePenalty) *
    (intensity?.injury ?? 1) *
    ctx.program.injuryBias *
    agePenalty *
    traitMultiplier(p.traitIds, 'injuryRisk') *
    Math.max(0.25, 1 - ctx.injuryResistance);

  if (!rng.chance(clamp01(chance))) return null;

  const severity = rng.weighted(
    ['KNOCK', 'MINOR', 'MODERATE', 'SERIOUS', 'SEASON'] as const,
    (s) => ({ KNOCK: 52, MINOR: 28, MODERATE: 13, SERIOUS: 6, SEASON: 1 })[s],
  );
  return {
    severity,
    weeksRemaining: T.INJURY_WEEKS[severity] ?? 1,
    description: `Picked up in ${ctx.program.name.toLowerCase()} training`,
    sustainedCycle: ctx.cycle,
  };
}

/**
 * Develop one player for one cycle. Returns a described delta; the player
 * passed in is never mutated. `applyDevelopment` is the only place a Player
 * object changes shape.
 */
export function developPlayer(p: Player, rng: Rng, ctx: DevelopmentContext): PlayerDevelopment {
  const stream = rng.fork(`develop:${p.id}:${ctx.cycle}`);
  const intensity = T.INTENSITY[ctx.intensity] ?? T.INTENSITY.NORMAL;
  const notes: string[] = [];
  const deltas: Partial<Record<AttributeKey, number>> = {};

  const rate = growthRate(p, ctx) * stream.float(T.NOISE_MIN, T.NOISE_MAX);

  // Ageing: physical attributes go first, and they go whether you train or not.
  const decline = p.age > T.DECLINE_AGE ? (p.age - T.DECLINE_AGE) * T.DECLINE_PER_YEAR : 0;

  const weights = ctx.program.weights;
  const focus = ctx.focusAttribute;
  const totalWeight = ATTRIBUTE_KEYS.reduce((s, k) => s + Math.abs(weights[k] ?? 0), 0) || 1;

  for (const key of ATTRIBUTE_KEYS) {
    const weight = weights[key] ?? 0;
    const current = p.attributes[key];
    let share = (weight / totalWeight) * rate * ATTRIBUTE_KEYS.length * 0.35;

    if (focus) {
      share = key === focus
        ? share + rate * T.FOCUS_SHARE
        : share * (1 - T.FOCUS_SHARE * 0.5);
    }

    if (decline > 0 && ctx.program.declineExposure[key]) {
      share -= decline * (ctx.program.declineExposure[key] ?? 0);
    }

    if (share === 0) continue;
    const points = resolvePoints(share, stream);
    if (points === 0) continue;
    const next = clamp(current + points, 1, 99);
    if (next !== current) deltas[key] = next - current;
  }

  const nextAttributes = { ...p.attributes };
  for (const [key, delta] of Object.entries(deltas)) {
    nextAttributes[key as AttributeKey] = clamp(
      p.attributes[key as AttributeKey] + (delta ?? 0), 1, 99,
    );
  }
  const overallAfter = overallFor(nextAttributes, p.position);

  // The ceiling itself can move — coaching a wonderkid well is worth something
  // beyond this season, and a player past his mid-twenties only ever loses it.
  let potentialDelta = 0;
  if (stream.chance(T.POTENTIAL_DRIFT_CHANCE)) {
    const up = p.age < T.POTENTIAL_HARDENS_AGE && ctx.managerDevelopment >= 60 && ctx.trainingGain > 0;
    potentialDelta = up ? stream.int(1, T.POTENTIAL_DRIFT_MAX) : -stream.int(0, 1);
  }

  const fatigue = ctx.program.recovery
    ? T.RECOVERY_PER_CYCLE * (intensity?.growth ?? 1)
    : -T.FATIGUE_PER_CYCLE * (intensity?.fatigue ?? 1) * ctx.program.fatigueCost;

  const injury = ctx.program.recovery ? null : rollInjury(p, ctx, stream);
  if (injury) notes.push(`${p.displayName} picked up a ${injury.severity.toLowerCase()} in training.`);

  const moraleDelta =
    (intensity?.morale ?? 0) +
    (ctx.program.recovery ? 1.5 : 0) +
    (overallAfter > p.overall ? 1 : 0);

  if (overallAfter - p.overall >= T.BREAKOUT_THRESHOLD) {
    notes.push(`${p.displayName} has taken a real step forward.`);
  }

  return {
    playerId: p.id,
    attributeDeltas: deltas,
    overallBefore: p.overall,
    overallAfter,
    growthPressure: rate,
    potentialDelta,
    fitnessDelta: fatigue,
    moraleDelta,
    injury,
    notes,
  };
}

/** Apply a described development. Returns a new Player. */
export function applyDevelopment(p: Player, dev: PlayerDevelopment): Player {
  const attributes = { ...p.attributes };
  for (const [key, delta] of Object.entries(dev.attributeDeltas)) {
    attributes[key as AttributeKey] = clamp(
      attributes[key as AttributeKey] + (delta ?? 0), 1, 99,
    );
  }
  const overall = overallFor(attributes, p.position);
  return {
    ...p,
    attributes,
    overall,
    potential: clamp(Math.max(overall, p.potential + dev.potentialDelta), 1, 99),
    fitness: clamp(p.fitness + dev.fitnessDelta, 0, 100),
    mental: { ...p.mental, morale: clamp(p.mental.morale + dev.moraleDelta, 0, 100) },
    injury: dev.injury ?? p.injury,
  };
}
