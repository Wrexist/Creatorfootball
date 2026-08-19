import type { ClubId, ContractId, PlayerId } from '../core/brand';

export type SquadRole = 'STAR' | 'STARTER' | 'ROTATION' | 'SQUAD' | 'PROSPECT';

export const SQUAD_ROLE_LABELS: Record<SquadRole, string> = {
  STAR: 'Star Player', STARTER: 'First Team', ROTATION: 'Rotation',
  SQUAD: 'Squad Player', PROSPECT: 'Prospect',
};

/** Minimum share of available minutes a role promises. Breaking it costs morale. */
export const ROLE_MINUTES_EXPECTATION: Record<SquadRole, number> = {
  STAR: 0.85, STARTER: 0.65, ROTATION: 0.35, SQUAD: 0.12, PROSPECT: 0.05,
};

export interface ContractBonuses {
  readonly appearance: number;
  readonly goal: number;
  readonly cleanSheet: number;
  readonly seasonPerformance: number;
  readonly trophy: number;
  readonly promotion: number;
}

export interface Contract {
  readonly id: ContractId;
  readonly playerId: PlayerId;
  readonly clubId: ClubId;
  /** Wage per cycle, in cash. */
  readonly wage: number;
  /** Remaining cycles. Reaches 0 -> free agent. */
  readonly weeksRemaining: number;
  readonly totalWeeks: number;
  readonly signingBonus: number;
  readonly bonuses: ContractBonuses;
  readonly role: SquadRole;
  readonly releaseClause: number | null;
  readonly loyaltyBonus: number;
  readonly signedCycle: number;
  /** Minutes actually played since signing, vs. what the role promised. */
  readonly minutesPlayed: number;
  readonly minutesAvailable: number;
}

export const emptyBonuses = (): ContractBonuses => ({
  appearance: 0, goal: 0, cleanSheet: 0, seasonPerformance: 0, trophy: 0, promotion: 0,
});

/** -1 (badly under-used) .. +1 (over-delivered on the promise). */
export function rolePromiseDelta(contract: Contract): number {
  if (contract.minutesAvailable <= 0) return 0;
  const actual = contract.minutesPlayed / contract.minutesAvailable;
  const promised = ROLE_MINUTES_EXPECTATION[contract.role];
  return Math.max(-1, Math.min(1, (actual - promised) / Math.max(0.15, promised)));
}
