import { ROLE_MINUTES_EXPECTATION } from '../contracts/contract';
import type { ClubId, PlayerId } from '../core/brand';
import { clamp, clamp01 } from '../core/math';
import type { Rng } from '../core/rng';
import { facilityEffect, type FacilityRegistry } from '../facilities/facilities';
import type { GameState, TrainingResult, TrainingState } from '../game/state';
import { ATTRIBUTE_LABELS, type AttributeKey } from '../players/attributes';
import type { Player } from '../players/player';
import { TRAINING_BALANCE as T } from './balance';
import { applyDevelopment, developPlayer, growthRate, type DevelopmentContext, type PlayerDevelopment } from './development';
import { programById, type TrainingIntensity, type TrainingProgram } from './programs';

export { TRAINING_PROGRAMS, programById, PROGRAM_BY_ID, INTENSITY_LABELS } from './programs';
export type { TrainingProgram, TrainingIntensity } from './programs';

/**
 * The weekly training cycle.
 *
 * This is where the squad screen and the development model meet. The important
 * design property is that the *same* program applied to the *same* squad
 * produces meaningfully different outcomes per player: minutes, age, headroom,
 * professionalism, morale and a hidden per-player growth character all feed in.
 * A manager who reads that spread and selects around it is playing the game
 * properly; one who picks "Attack, Hard" every week is not.
 */

export interface TrainingCycleContext {
  readonly clubId: ClubId;
  readonly cycle: number;
  readonly season: number;
  readonly registry: FacilityRegistry;
  /** Manager `playerDevelopment`, 0-100. */
  readonly managerDevelopment: number;
  /** Overrides for the state's stored program/intensity, used by the AI and by tests. */
  readonly programId?: string;
  readonly intensity?: TrainingIntensity;
  /** playerId -> share of available minutes, 0-1. Falls back to the contracted role. */
  readonly minutesShare?: Readonly<Record<string, number>>;
  /** Include the youth squad in the session. Defaults to true for the YOUTH program. */
  readonly includeYouth?: boolean;
}

export interface TrainingInjury {
  readonly playerId: PlayerId;
  readonly severity: string;
  readonly weeks: number;
  readonly note: string;
}

export interface TrainingCycleResult {
  /** Only the players who changed. Merge into state; never a full squad copy. */
  readonly players: Readonly<Record<string, Player>>;
  readonly results: readonly TrainingResult[];
  readonly developments: readonly PlayerDevelopment[];
  readonly injuries: readonly TrainingInjury[];
  readonly breakouts: readonly PlayerId[];
  readonly cohesionDelta: number;
  readonly training: TrainingState;
  readonly program: TrainingProgram;
  readonly intensity: TrainingIntensity;
  readonly summary: string;
}

/**
 * Share of minutes a player has actually been getting. Real minutes beat the
 * contracted expectation whenever we have them — a STAR who is being benched
 * must develop like a bench player, not like a star.
 */
export function minutesShareFor(
  state: GameState,
  player: Player,
  override?: Readonly<Record<string, number>>,
): number {
  const explicit = override?.[player.id];
  if (explicit !== undefined) return clamp01(explicit);
  const contract = player.contractId ? state.contracts[player.contractId] : undefined;
  if (contract && contract.minutesAvailable > 0) {
    return clamp01(contract.minutesPlayed / contract.minutesAvailable);
  }
  if (contract) return ROLE_MINUTES_EXPECTATION[contract.role];
  return 0.2;
}

/** Run one training cycle for a club. Returns deltas; state is never mutated. */
export function runTrainingCycle(
  state: GameState,
  rng: Rng,
  ctx: TrainingCycleContext,
): TrainingCycleResult {
  const club = state.clubs[ctx.clubId];
  const program = programById(ctx.programId ?? state.training.programId);
  const intensity: TrainingIntensity = ctx.intensity ?? state.training.intensity;

  const trainingGain = club ? facilityEffect(club, 'trainingGain', ctx.registry) : 0;
  const injuryResistance = club ? facilityEffect(club, 'injuryResistance', ctx.registry) : 0;
  const youthQuality = club ? facilityEffect(club, 'youthQuality', ctx.registry) : 0;
  const injuryRecovery = club ? facilityEffect(club, 'injuryRecovery', ctx.registry) : 0;

  const includeYouth = ctx.includeYouth ?? program.youthBias > 0;
  const roster: PlayerId[] = club
    ? [...club.squad, ...(includeYouth ? club.youthSquad : [])]
    : [];

  const players: Record<string, Player> = {};
  const results: TrainingResult[] = [];
  const developments: PlayerDevelopment[] = [];
  const injuries: TrainingInjury[] = [];
  const breakouts: PlayerId[] = [];

  for (const playerId of roster) {
    const player = state.players[playerId];
    if (!player) continue;

    // An injured player is not in the session; he is with the physio. Better
    // medical facilities are what turns four weeks out into three.
    if (player.injury) {
      const healed = 1 + Math.max(0, injuryRecovery);
      const weeksRemaining = Math.max(0, player.injury.weeksRemaining - healed);
      players[playerId] = {
        ...player,
        injury: weeksRemaining <= 0 ? null : { ...player.injury, weeksRemaining },
        fitness: clamp(player.fitness + T.RECOVERY_PER_CYCLE * 0.6, 0, 100),
      };
      continue;
    }

    const devCtx: DevelopmentContext = {
      cycle: ctx.cycle,
      program,
      intensity,
      trainingGain,
      injuryResistance,
      youthQuality,
      managerDevelopment: ctx.managerDevelopment,
      minutesShare: minutesShareFor(state, player, ctx.minutesShare),
      focusAttribute: state.training.individualFocus[playerId] as AttributeKey | undefined,
    };

    const dev = developPlayer(player, rng, devCtx);
    developments.push(dev);
    players[playerId] = applyDevelopment(player, dev);

    for (const [key, delta] of Object.entries(dev.attributeDeltas)) {
      if (!delta) continue;
      results.push({
        playerId: player.id,
        cycle: ctx.cycle,
        attribute: ATTRIBUTE_LABELS[key as AttributeKey] ?? key,
        delta,
        note: delta > 0
          ? `${program.name}: ${player.displayName} improved.`
          : `${program.name}: ${player.displayName} slipped back.`,
      });
    }

    if (dev.injury) {
      injuries.push({
        playerId: player.id,
        severity: dev.injury.severity,
        weeks: dev.injury.weeksRemaining,
        note: dev.injury.description,
      });
    }
    if (dev.overallAfter - dev.overallBefore >= T.BREAKOUT_THRESHOLD) breakouts.push(player.id);
  }

  const gains = results.filter((r) => r.delta > 0).length;
  const losses = results.filter((r) => r.delta < 0).length;
  const summary =
    `${program.name} (${intensity.toLowerCase()}): ${gains} improvement${gains === 1 ? '' : 's'}, ` +
    `${losses} regression${losses === 1 ? '' : 's'}` +
    (injuries.length ? `, ${injuries.length} injury${injuries.length === 1 ? '' : ' problems'}.` : '.');

  return {
    players,
    results,
    developments,
    injuries,
    breakouts,
    cohesionDelta: program.cohesion,
    training: {
      ...state.training,
      programId: program.id,
      intensity,
      // The panel shows the most recent session only; history lives in the event log.
      lastResults: results.slice(0, 40),
    },
    program,
    intensity,
    summary,
  };
}

/**
 * Projected growth for a squad under a given program, for the "what will this
 * do?" preview. Deterministic and dice-free: it reports expected value.
 */
export function projectTraining(
  state: GameState,
  ctx: TrainingCycleContext,
): { playerId: PlayerId; expectedGain: number; risk: number }[] {
  const club = state.clubs[ctx.clubId];
  if (!club) return [];
  const program = programById(ctx.programId ?? state.training.programId);
  const intensity: TrainingIntensity = ctx.intensity ?? state.training.intensity;
  const trainingGain = facilityEffect(club, 'trainingGain', ctx.registry);
  const injuryResistance = facilityEffect(club, 'injuryResistance', ctx.registry);
  const youthQuality = facilityEffect(club, 'youthQuality', ctx.registry);
  const intensityRow = T.INTENSITY[intensity] ?? T.INTENSITY.NORMAL;

  const out: { playerId: PlayerId; expectedGain: number; risk: number }[] = [];
  for (const playerId of club.squad) {
    const player = state.players[playerId];
    if (!player) continue;
    // Re-uses growthRate rather than duplicating the curve, so the preview can
    // never silently disagree with what actually happens.
    const rate = growthRate(player, {
      cycle: ctx.cycle, program, intensity, trainingGain, injuryResistance, youthQuality,
      managerDevelopment: ctx.managerDevelopment,
      minutesShare: minutesShareFor(state, player, ctx.minutesShare),
    });
    out.push({
      playerId,
      expectedGain: Math.round(rate * 100) / 100,
      risk: Math.round(
        (T.INJURY_BASE_CHANCE * (intensityRow?.injury ?? 1) * program.injuryBias) * 10000,
      ) / 100,
    });
  }
  return out;
}
