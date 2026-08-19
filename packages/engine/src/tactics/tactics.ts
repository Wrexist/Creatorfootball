import type { PlayerId } from '../core/brand';
import type { Position } from '../players/positions';

/**
 * Tactics create trade-offs, never flat bonuses.
 *
 * Every slider below feeds at least two opposing terms in the match model: a
 * high press raises turnover creation AND raises fatigue AND opens space in
 * behind. If a setting only ever helps, it is a bug in the design.
 */

export interface Formation {
  readonly id: string;
  readonly name: string;
  /** Ordered slots. Index 0 is always the goalkeeper. */
  readonly slots: readonly FormationSlot[];
  readonly shape: 'BALANCED' | 'ATTACKING' | 'DEFENSIVE' | 'WIDE' | 'NARROW';
  readonly blurb: string;
}

export interface FormationSlot {
  readonly id: string;
  readonly position: Position;
  /** Normalised pitch coordinates for the animated renderer. x: 0 own goal -> 1 opponent goal. */
  readonly x: number;
  readonly y: number;
  readonly role: 'GK' | 'DEF' | 'MID' | 'ATT';
}

export type Tempo = 'PATIENT' | 'BALANCED' | 'QUICK' | 'FRANTIC';
export type PressIntensity = 'LOW_BLOCK' | 'MID_BLOCK' | 'BALANCED' | 'HIGH_PRESS';
export type DefensiveLine = 'DEEP' | 'NORMAL' | 'HIGH';
export type Width = 'NARROW' | 'BALANCED' | 'WIDE';
export type PassingStyle = 'DIRECT' | 'MIXED' | 'SHORT';
export type BuildUp = 'FROM_THE_BACK' | 'BALANCED' | 'BYPASS';
export type AttackingFocus = 'LEFT' | 'CENTRE' | 'RIGHT' | 'BALANCED';
export type Marking = 'ZONAL' | 'MIXED' | 'MAN';
export type RiskLevel = 'CAUTIOUS' | 'MEASURED' | 'BOLD' | 'RECKLESS';
export type CounterStyle = 'NEVER' | 'WHEN_ON' | 'ALWAYS';
export type SubStrategy = 'CONSERVATIVE' | 'BALANCED' | 'AGGRESSIVE';

export interface TacticSetup {
  readonly formationId: string;
  /** slotId -> playerId. A missing slot means the sim auto-fills from the bench. */
  readonly lineup: Readonly<Record<string, PlayerId | null>>;
  readonly bench: readonly PlayerId[];
  readonly captainId: PlayerId | null;
  readonly tempo: Tempo;
  readonly press: PressIntensity;
  readonly line: DefensiveLine;
  readonly width: Width;
  readonly passing: PassingStyle;
  readonly buildUp: BuildUp;
  readonly focus: AttackingFocus;
  readonly marking: Marking;
  readonly risk: RiskLevel;
  readonly counter: CounterStyle;
  readonly subStrategy: SubStrategy;
  readonly setPieceTakerId: PlayerId | null;
  readonly penaltyTakerId: PlayerId | null;
}

/** Numeric projection of a TacticSetup, consumed by the match model. */
export interface TacticVector {
  /** How far up the pitch the team defends, 0-1. */
  readonly aggression: number;
  /** Chance-creation volume multiplier. */
  readonly attackVolume: number;
  /** Defensive solidity multiplier. */
  readonly defensiveSolidity: number;
  /** Space conceded in behind, 0-1 (higher is worse defensively). */
  readonly spaceBehind: number;
  /** Fatigue accumulation multiplier. */
  readonly fatigueRate: number;
  /** Share of possession this shape wants. */
  readonly possessionBias: number;
  /** Turnover generation in the opponent half. */
  readonly pressRecovery: number;
  /** Weight given to counter-attacking transitions. */
  readonly counterWeight: number;
  /** Shot quality vs. shot quantity trade-off, 0-1 (1 = fewer, better chances). */
  readonly chanceQuality: number;
  /** Foul propensity multiplier. */
  readonly foulRate: number;
  /** Wing vs. central bias, -1 central .. +1 wide. */
  readonly widthBias: number;
  /** Variance multiplier: reckless setups swing games both ways. */
  readonly volatility: number;
}

export const DEFAULT_TACTICS: Omit<TacticSetup, 'formationId' | 'lineup' | 'bench' | 'captainId' | 'setPieceTakerId' | 'penaltyTakerId'> = {
  tempo: 'BALANCED',
  press: 'BALANCED',
  line: 'NORMAL',
  width: 'BALANCED',
  passing: 'MIXED',
  buildUp: 'BALANCED',
  focus: 'BALANCED',
  marking: 'MIXED',
  risk: 'MEASURED',
  counter: 'WHEN_ON',
  subStrategy: 'BALANCED',
};
