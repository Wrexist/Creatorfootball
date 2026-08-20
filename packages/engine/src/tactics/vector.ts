import type { TacticSetup, TacticVector } from './tactics';
import { clamp, clamp01 } from '../core/math';

/**
 * Tactics -> numbers.
 *
 * The design rule this file enforces: **every setting pushes at least two
 * opposing terms**. There is no instruction here that is strictly better than
 * its neighbours, so "what shape do I play" stays a decision rather than a
 * lookup. The comment above each table names the trade-off in words; the table
 * itself is the same statement in numbers, and the two must never disagree.
 *
 * Deltas are additive around a neutral vector. Fields documented in
 * `tactics.ts` as multipliers sit at 1.0 neutral; fields documented as 0-1
 * sit at 0.5.
 */

type Delta = Partial<Record<keyof TacticVector, number>>;

/**
 * Tempo — how quickly the team wants to move the ball forward.
 * Trade-off: slow tempo buys control and better chances but concedes volume
 * and kills the counter; frantic tempo buys shot volume and chaos but the
 * chances are worse, the ball is surrendered more often and legs go early.
 */
const TEMPO: Record<TacticSetup['tempo'], Delta> = {
  PATIENT:  { possessionBias: +0.10, chanceQuality: +0.10, attackVolume: -0.10, counterWeight: -0.10, fatigueRate: -0.05, volatility: -0.06 },
  BALANCED: {},
  QUICK:    { attackVolume: +0.09, counterWeight: +0.08, possessionBias: -0.05, chanceQuality: -0.05, fatigueRate: +0.08 },
  FRANTIC:  { attackVolume: +0.18, volatility: +0.24, chanceQuality: -0.06, possessionBias: -0.12, fatigueRate: +0.07, foulRate: +0.06 },
};

/**
 * Press intensity — where the team tries to win the ball.
 * Trade-off: pressing high generates turnovers in dangerous areas but burns
 * stamina, opens the space behind the last line and racks up fouls — and both
 * of those are now charged: fatigue erodes `pressRecovery` itself as the match
 * goes on, and `spaceBehind` converts into balls over the top. Sitting in a low
 * block surrenders the ball and the pitch, and buys back cheap legs, a shut
 * door in behind and the best transition in the game.
 */
const PRESS: Record<TacticSetup['press'], Delta> = {
  LOW_BLOCK:  { defensiveSolidity: +0.27, spaceBehind: -0.19, pressRecovery: -0.26, possessionBias: -0.12, aggression: -0.26, fatigueRate: -0.14, counterWeight: +0.24, attackVolume: -0.04, chanceQuality: +0.07 },
  MID_BLOCK:  { defensiveSolidity: +0.10, spaceBehind: -0.07, pressRecovery: -0.09, aggression: -0.11, fatigueRate: -0.06, possessionBias: -0.04, counterWeight: +0.06 },
  BALANCED:   {},
  HIGH_PRESS: { pressRecovery: +0.24, aggression: +0.26, attackVolume: +0.09, spaceBehind: +0.21, fatigueRate: +0.26, foulRate: +0.11, defensiveSolidity: -0.09 },
};

/**
 * Defensive line height.
 * Trade-off: a high line compresses the pitch and helps the press win the ball
 * back, but every ball over the top is a one-on-one — and since `spaceBehind`
 * now converts into real chances in behind, that is a bill the high line
 * actually pays. A deep line is unpickable in behind and hands the opponent
 * forty yards of free build-up.
 */
const LINE: Record<TacticSetup['line'], Delta> = {
  DEEP:   { spaceBehind: -0.21, defensiveSolidity: +0.12, possessionBias: -0.09, pressRecovery: -0.10, counterWeight: +0.10, attackVolume: -0.06 },
  NORMAL: {},
  HIGH:   { spaceBehind: +0.24, possessionBias: +0.10, pressRecovery: +0.10, defensiveSolidity: -0.07, attackVolume: +0.04, volatility: +0.05 },
};

/**
 * Width.
 * Trade-off: wide play manufactures more entries and crosses but from lower
 * value positions and with a stretched defensive block. Narrow owns the centre
 * and the best chance locations, and lets the opponent have the flanks — which
 * is a real cost, because a delivery into a compact block is the one chance a
 * narrow shape cannot defend (see AERIAL_NARROW_EXPOSURE). The two also read
 * each other: SHAPE_MISMATCH_WEIGHT rewards whichever side is attacking the
 * channels the other has left alone, so width is the axis with the clearest
 * rock-paper-scissors in it.
 */
const WIDTH: Record<TacticSetup['width'], Delta> = {
  NARROW:   { widthBias: -0.5, chanceQuality: +0.07, defensiveSolidity: +0.05, attackVolume: -0.10, spaceBehind: +0.06 },
  BALANCED: {},
  WIDE:     { widthBias: +0.5, attackVolume: +0.14, chanceQuality: -0.06, defensiveSolidity: -0.03, fatigueRate: +0.02 },
};

/**
 * Passing style.
 * Trade-off: short passing keeps the ball and works better openings, but walks
 * into a press and never catches anyone in transition. Direct passing bypasses
 * the press and feeds counters at the cost of possession and chance quality.
 */
const PASSING: Record<TacticSetup['passing'], Delta> = {
  DIRECT: { counterWeight: +0.15, possessionBias: -0.15, chanceQuality: -0.09, attackVolume: +0.08, fatigueRate: -0.03 },
  MIXED:  {},
  SHORT:  { possessionBias: +0.15, chanceQuality: +0.09, counterWeight: -0.13, attackVolume: -0.05, volatility: +0.05 },
};

/**
 * Build-up route.
 * Trade-off: playing out from the back is the highest-value way to break a
 * press and the fastest way to gift a goal. Bypassing it is safe in your own
 * third and hands the ball straight back.
 */
const BUILD_UP: Record<TacticSetup['buildUp'], Delta> = {
  FROM_THE_BACK: { possessionBias: +0.11, chanceQuality: +0.06, volatility: +0.11, defensiveSolidity: -0.05 },
  BALANCED:      {},
  BYPASS:        { counterWeight: +0.11, possessionBias: -0.13, fatigueRate: +0.05, chanceQuality: -0.06, defensiveSolidity: +0.05 },
};

/**
 * Attacking focus.
 * Trade-off: loading one flank overloads it and makes the team readable; going
 * through the middle gets you into better positions against fewer defenders.
 */
const FOCUS: Record<TacticSetup['focus'], Delta> = {
  LEFT:     { widthBias: +0.22, attackVolume: +0.05, chanceQuality: -0.04, volatility: +0.04 },
  RIGHT:    { widthBias: +0.22, attackVolume: +0.05, chanceQuality: -0.04, volatility: +0.04 },
  CENTRE:   { widthBias: -0.26, chanceQuality: +0.06, attackVolume: -0.04, defensiveSolidity: +0.03 },
  BALANCED: {},
};

/**
 * Marking scheme.
 * Trade-off: man-marking wins the ball earlier and higher, and drags the shape
 * apart while conceding fouls. Zonal holds shape and lets good movement find
 * the gaps between the zones.
 */
const MARKING: Record<TacticSetup['marking'], Delta> = {
  ZONAL: { defensiveSolidity: +0.09, foulRate: -0.07, pressRecovery: -0.07, volatility: -0.05 },
  MIXED: {},
  MAN:   { pressRecovery: +0.13, foulRate: +0.11, spaceBehind: +0.08, defensiveSolidity: -0.04, fatigueRate: +0.08 },
};

/**
 * Risk appetite. The purest expression of the trade-off principle: risk buys
 * attacking output with defensive solidity and buys variance with control.
 */
const RISK: Record<TacticSetup['risk'], Delta> = {
  CAUTIOUS: { defensiveSolidity: +0.13, attackVolume: -0.18, volatility: -0.15, chanceQuality: +0.04 },
  MEASURED: {},
  BOLD:     { attackVolume: +0.14, defensiveSolidity: -0.08, volatility: +0.17 },
  RECKLESS: { attackVolume: +0.26, defensiveSolidity: -0.11, volatility: +0.36, spaceBehind: +0.06, foulRate: +0.08 },
};

/**
 * Counter-attacking instruction.
 * Trade-off: always countering converts every turnover into a fast break, but
 * the team stops building anything and the chances are snatched. Never
 * countering keeps everyone in shape and wastes the best moment to attack.
 */
const COUNTER: Record<TacticSetup['counter'], Delta> = {
  NEVER:   { counterWeight: -0.22, possessionBias: +0.08, defensiveSolidity: +0.05, attackVolume: -0.05 },
  WHEN_ON: {},
  ALWAYS:  { counterWeight: +0.24, chanceQuality: -0.07, possessionBias: -0.11, fatigueRate: +0.09 },
};

/**
 * Substitution policy. Mostly read by the substitution logic, but it belongs in
 * the vector too: a manager who empties the bench early has fresher legs and a
 * less settled team.
 */
const SUB_STRATEGY: Record<TacticSetup['subStrategy'], Delta> = {
  CONSERVATIVE: { fatigueRate: +0.05, volatility: -0.04 },
  BALANCED:     {},
  AGGRESSIVE:   { fatigueRate: -0.06, volatility: +0.05, chanceQuality: -0.02 },
};

const NEUTRAL: TacticVector = {
  aggression: 0.5,
  attackVolume: 1,
  defensiveSolidity: 1,
  spaceBehind: 0.5,
  fatigueRate: 1,
  possessionBias: 0.5,
  pressRecovery: 0.5,
  counterWeight: 0.5,
  chanceQuality: 0.5,
  foulRate: 1,
  widthBias: 0,
  volatility: 1,
};

const ZERO_ONE_KEYS: readonly (keyof TacticVector)[] = [
  'aggression', 'spaceBehind', 'possessionBias', 'pressRecovery', 'counterWeight', 'chanceQuality',
];

export interface TacticVectorContext {
  /** Mean effective quality of the starting XI, 1-99. */
  readonly squadQuality: number;
  /** Manager `tacticalKnowledge`, 1-99. */
  readonly managerTactical: number;
}

/**
 * Project a `TacticSetup` onto the numeric vector the match model consumes.
 *
 * Two context terms shape how much the instructions actually land:
 * - `managerTactical` scales the magnitude of every delta. A good coach gets
 *   more out of the same instruction; a poor one gets a diluted version of it.
 *   It never flips a sign, so it cannot turn a downside into an upside.
 * - `squadQuality` gates the physically demanding parts. A weak squad asked to
 *   press high pays the full fatigue bill and collects a fraction of the
 *   turnovers, which is the whole reason underdogs sit deep.
 */
export function toTacticVector(t: TacticSetup, ctx: TacticVectorContext): TacticVector {
  const gain = 0.82 + 0.36 * clamp01(ctx.managerTactical / 100);
  const quality = clamp01(ctx.squadQuality / 100);

  const acc: Record<string, number> = {};
  const apply = (d: Delta): void => {
    for (const [k, v] of Object.entries(d)) acc[k] = (acc[k] ?? 0) + (v as number) * gain;
  };

  apply(TEMPO[t.tempo]);
  apply(PRESS[t.press]);
  apply(LINE[t.line]);
  apply(WIDTH[t.width]);
  apply(PASSING[t.passing]);
  apply(BUILD_UP[t.buildUp]);
  apply(FOCUS[t.focus]);
  apply(MARKING[t.marking]);
  apply(RISK[t.risk]);
  apply(COUNTER[t.counter]);
  apply(SUB_STRATEGY[t.subStrategy]);

  const out: Record<string, number> = {};
  for (const [k, base] of Object.entries(NEUTRAL)) {
    out[k] = base + (acc[k] ?? 0);
  }

  // Squad quality gates the physical instructions rather than the shape ones.
  const demand = Math.max(0, (out['aggression'] as number) - 0.5) + Math.max(0, (out['fatigueRate'] as number) - 1);
  out['pressRecovery'] = (out['pressRecovery'] as number) * (0.78 + 0.44 * quality);
  out['fatigueRate'] = (out['fatigueRate'] as number) * (1 + 0.35 * demand * (1 - quality));

  for (const k of ZERO_ONE_KEYS) out[k] = clamp01(out[k] as number);
  out['attackVolume'] = clamp(out['attackVolume'] as number, 0.5, 1.7);
  out['defensiveSolidity'] = clamp(out['defensiveSolidity'] as number, 0.5, 1.6);
  out['fatigueRate'] = clamp(out['fatigueRate'] as number, 0.6, 2.0);
  out['foulRate'] = clamp(out['foulRate'] as number, 0.5, 1.8);
  out['volatility'] = clamp(out['volatility'] as number, 0.5, 1.9);
  out['widthBias'] = clamp(out['widthBias'] as number, -1, 1);

  return out as unknown as TacticVector;
}

/**
 * Apply a bag of named deltas (from a live decision, a special rule, or an AI
 * adjustment) on top of an already-computed vector, re-clamping afterwards so
 * no stack of modifiers can push a term out of its legal range.
 */
export function applyVectorModifiers(
  v: TacticVector,
  modifiers: Readonly<Record<string, number>>,
): TacticVector {
  const out: Record<string, number> = { ...(v as unknown as Record<string, number>) };
  for (const [k, delta] of Object.entries(modifiers)) {
    if (!(k in out)) continue;
    out[k] = (out[k] as number) + delta;
  }
  for (const k of ZERO_ONE_KEYS) out[k] = clamp01(out[k] as number);
  out['attackVolume'] = clamp(out['attackVolume'] as number, 0.4, 2.0);
  out['defensiveSolidity'] = clamp(out['defensiveSolidity'] as number, 0.4, 1.8);
  out['fatigueRate'] = clamp(out['fatigueRate'] as number, 0.5, 2.4);
  out['foulRate'] = clamp(out['foulRate'] as number, 0.4, 2.2);
  out['volatility'] = clamp(out['volatility'] as number, 0.4, 2.2);
  out['widthBias'] = clamp(out['widthBias'] as number, -1, 1);
  return out as unknown as TacticVector;
}

export { FORMATIONS, formationById, autoLineup, formationsFor, DEFAULT_FORMATION_ID } from './formations';
