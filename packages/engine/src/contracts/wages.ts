import type { ClubId } from '../core/brand';
import { clamp, clamp01 } from '../core/math';
import type { Ledger, PostContext } from '../economy/ledger';
import type { Player } from '../players/player';
import { WAGE_BALANCE as W } from '../transfers/balance';
import { wageDemand, type ValuationContext } from '../transfers/valuation';
import { concede, demandedTerms, packageValue, type TalksContext } from './negotiation';
import { rolePromiseDelta, type Contract } from './contract';
import type { NegotiationTerms } from '../game/state';

/**
 * Wages, renewals and bonus payouts.
 *
 * Wages are the pressure that makes every other decision cost something: they
 * are paid every cycle whether or not the player plays, they rise as the squad
 * improves, and they are the mechanism by which a club that over-achieves
 * without growing its revenue quietly destroys itself. Bonuses are the opposite
 * lever — cheap to promise, expensive when they land.
 */

export { wageDemand };

/** Total weekly wage commitment for a set of contracts. */
export function wageBill(contracts: readonly Contract[]): number {
  return contracts.reduce((sum, c) => sum + Math.max(0, c.wage), 0);
}

export interface WagePressure {
  readonly bill: number;
  readonly budget: number;
  /** >1 means the squad costs more than the club planned for. */
  readonly ratio: number;
  readonly state: 'HEALTHY' | 'TIGHT' | 'OVERCOMMITTED';
  readonly headroom: number;
}

export function wagePressure(contracts: readonly Contract[], budgetPerCycle: number): WagePressure {
  const bill = wageBill(contracts);
  const budget = Math.max(1, budgetPerCycle);
  const ratio = bill / budget;
  const state = ratio > 1.08 ? 'OVERCOMMITTED' : ratio > 0.9 ? 'TIGHT' : 'HEALTHY';
  return { bill, budget, ratio, state, headroom: Math.round(budget - bill) };
}

// --- Renewals ---------------------------------------------------------------

export interface RenewalAssessment {
  /** True when the player believes he has outgrown his deal. */
  readonly wantsMore: boolean;
  readonly currentWage: number;
  readonly deservedWage: number;
  readonly ratio: number;
  readonly demand: NegotiationTerms;
  /** Cycles before the contract runs out. Under ~12 the club is losing leverage fast. */
  readonly weeksRemaining: number;
  readonly urgency: 'NONE' | 'SOON' | 'URGENT' | 'CRITICAL';
  readonly summary: string;
}

/**
 * Does this contract need attention? A player performing well above what he is
 * paid is the single most common source of squad unrest, and the game should
 * surface it before it becomes a crisis rather than after.
 */
export function assessRenewal(
  p: Player,
  contract: Contract,
  ctx: TalksContext,
): RenewalAssessment {
  const deserved = wageDemand(p, { ...ctx.valuation, buyingClubReputation: ctx.clubReputation });
  const ratio = deserved / Math.max(1, contract.wage);
  const promise = rolePromiseDelta(contract);
  const demand = demandedTerms(p, { ...ctx, isRenewal: true, rolePromiseDelta: promise });

  const weeks = contract.weeksRemaining;
  const urgency =
    weeks <= 6 ? 'CRITICAL' : weeks <= 14 ? 'URGENT' : weeks <= 30 ? 'SOON' : 'NONE';

  const wantsMore = ratio >= W.RENEWAL_TRIGGER_RATIO || (promise > 0.35 && ratio >= 1.05);
  const summary = wantsMore
    ? `He is playing like a ${Math.round(deserved).toLocaleString('en-GB')}/week player on ${Math.round(contract.wage).toLocaleString('en-GB')}.`
    : `His deal still reflects what he gives you.`;

  return {
    wantsMore,
    currentWage: contract.wage,
    deservedWage: Math.round(deserved),
    ratio,
    demand,
    weeksRemaining: weeks,
    urgency,
    summary,
  };
}

export type RenewalVerdict = 'SIGNED' | 'COUNTERED' | 'REFUSED' | 'INSULTED';

export interface RenewalResponse {
  readonly verdict: RenewalVerdict;
  readonly counter: NegotiationTerms | null;
  /** Deltas the caller applies to the player's mental profile. Never mutated here. */
  readonly moraleDelta: number;
  readonly loyaltyDelta: number;
  readonly message: string;
}

/**
 * Answer a renewal offer. Refusing a justified demand is *allowed* — it just
 * costs morale now and loyalty later, which is exactly the tension we want:
 * you can keep a cheap contract, but the player will remember.
 */
export function respondToRenewal(
  p: Player,
  contract: Contract,
  offer: NegotiationTerms | null,
  ctx: TalksContext,
): RenewalResponse {
  const assessment = assessRenewal(p, contract, ctx);

  // A flat refusal to negotiate at all.
  if (offer === null) {
    if (!assessment.wantsMore) {
      return { verdict: 'REFUSED', counter: null, moraleDelta: 0, loyaltyDelta: 0, message: 'He was not asking for anything.' };
    }
    return {
      verdict: 'INSULTED',
      counter: null,
      moraleDelta: -W.RENEWAL_REFUSAL_MORALE,
      loyaltyDelta: -W.RENEWAL_REFUSAL_LOYALTY,
      message: 'He asked for a new deal and was turned away. That will not be forgotten.',
    };
  }

  const demandValue = packageValue(assessment.demand);
  const offerValue = packageValue(offer);
  const ratio = offerValue / Math.max(1, demandValue);

  if (ratio >= 1.05) {
    return {
      verdict: 'SIGNED',
      counter: null,
      moraleDelta: W.RENEWAL_GENEROSITY_MORALE,
      loyaltyDelta: 4,
      message: 'He signed on the spot — that is more than he expected.',
    };
  }
  if (ratio >= 0.93) {
    return { verdict: 'SIGNED', counter: null, moraleDelta: 3, loyaltyDelta: 2, message: 'Terms agreed.' };
  }
  if (ratio >= 0.72) {
    return {
      verdict: 'COUNTERED',
      counter: concede(assessment.demand, offer, 0.3),
      moraleDelta: 0,
      loyaltyDelta: 0,
      message: 'His agent came back with a revised package.',
    };
  }
  const insulting = ratio < 0.55;
  return {
    verdict: insulting ? 'INSULTED' : 'REFUSED',
    counter: null,
    moraleDelta: insulting ? -W.RENEWAL_REFUSAL_MORALE : -3,
    loyaltyDelta: insulting ? -W.RENEWAL_REFUSAL_LOYALTY : -1,
    message: insulting
      ? 'He took the offer as an insult.'
      : 'He turned it down and expects a serious proposal.',
  };
}

/** Apply a renewal to a contract without mutating the original. */
export function renewContract(contract: Contract, terms: NegotiationTerms, cycle: number): Contract {
  const weeks = Math.max(1, Math.round(terms.years * 38));
  return {
    ...contract,
    wage: Math.round(terms.wage),
    weeksRemaining: weeks,
    totalWeeks: weeks,
    role: (terms.role as Contract['role']) ?? contract.role,
    releaseClause: terms.releaseClause,
    signedCycle: cycle,
    // The role promise is measured from the signature, so the clock resets.
    minutesPlayed: 0,
    minutesAvailable: 0,
    bonuses: {
      ...contract.bonuses,
      appearance: Math.round(terms.appearanceBonus),
      goal: Math.round(terms.goalBonus),
    },
  };
}

// --- Bonuses ----------------------------------------------------------------

export interface BonusTriggers {
  readonly appearances?: number;
  readonly goals?: number;
  readonly cleanSheets?: number;
  /** Set when the player hit his season performance target. */
  readonly seasonPerformance?: boolean;
  readonly trophy?: boolean;
  readonly promotion?: boolean;
}

export interface BonusPayout {
  readonly kind: keyof BonusTriggers;
  readonly amount: number;
  readonly memo: string;
}

/** Work out what a contract owes for what actually happened. Pure. */
export function bonusPayouts(contract: Contract, triggers: BonusTriggers, playerName: string): BonusPayout[] {
  const out: BonusPayout[] = [];
  const b = contract.bonuses;
  const push = (kind: keyof BonusTriggers, amount: number, memo: string): void => {
    if (amount > 0) out.push({ kind, amount: Math.round(amount), memo });
  };
  push('appearances', b.appearance * (triggers.appearances ?? 0), `Appearance bonus — ${playerName}`);
  push('goals', b.goal * (triggers.goals ?? 0), `Goal bonus — ${playerName}`);
  push('cleanSheets', b.cleanSheet * (triggers.cleanSheets ?? 0), `Clean sheet bonus — ${playerName}`);
  if (triggers.seasonPerformance) push('seasonPerformance', b.seasonPerformance, `Season performance bonus — ${playerName}`);
  if (triggers.trophy) push('trophy', b.trophy, `Trophy bonus — ${playerName}`);
  if (triggers.promotion) push('promotion', b.promotion, `Promotion bonus — ${playerName}`);
  return out;
}

export interface BonusSettlement {
  readonly total: number;
  readonly paid: readonly BonusPayout[];
  readonly unpaid: readonly BonusPayout[];
}

/**
 * Pay bonuses through the Ledger. Idempotency keys are mandatory here: a bonus
 * is the classic double-claim exploit, and `auditEconomy` looks for exactly this.
 */
export function payBonuses(
  ledger: Ledger,
  clubId: ClubId,
  contract: Contract,
  triggers: BonusTriggers,
  playerName: string,
  ctx: PostContext,
): BonusSettlement {
  const payouts = bonusPayouts(contract, triggers, playerName);
  const paid: BonusPayout[] = [];
  const unpaid: BonusPayout[] = [];
  for (const payout of payouts) {
    const result = ledger.debit(clubId, 'PERFORMANCE_BONUS', payout.amount, payout.memo, ctx, {
      idempotencyKey: `bonus:${contract.id}:${payout.kind}:${ctx.cycle}`,
      metadata: { playerId: contract.playerId, kind: payout.kind },
    });
    if (result.ok) paid.push(payout);
    else unpaid.push(payout);
  }
  return { total: paid.reduce((s, p) => s + p.amount, 0), paid, unpaid };
}

/** Advance a contract by one cycle. Returns a new contract; expiry is the caller's business. */
export function tickContract(contract: Contract, minutesPlayed: number, minutesAvailable: number): Contract {
  return {
    ...contract,
    weeksRemaining: Math.max(0, contract.weeksRemaining - 1),
    minutesPlayed: contract.minutesPlayed + Math.max(0, minutesPlayed),
    minutesAvailable: contract.minutesAvailable + Math.max(0, minutesAvailable),
  };
}

/**
 * Morale consequence of how the club has used him versus what it promised.
 * This is the enforcement arm of `rolePromiseDelta`: benching a STAR must be
 * visible in the squad screen within a couple of cycles, not at season end.
 */
export function rolePromiseMoraleDelta(contract: Contract): number {
  const delta = rolePromiseDelta(contract);
  if (contract.minutesAvailable < 180) return 0; // too early to judge
  // Under-use hurts roughly twice as much as over-use helps. Broken promises
  // are remembered; kept ones are merely expected.
  return delta < 0 ? clamp(delta * 6, -6, 0) : clamp(delta * 2.5, 0, 2.5);
}

/** Free-agent status check used by the market and the audit. */
export const isExpired = (c: Contract): boolean => c.weeksRemaining <= 0;

/** Share of a player's market value that a release payoff costs. */
export function releaseCost(contract: Contract): number {
  return Math.round(contract.wage * Math.min(contract.weeksRemaining, 52) * 0.55);
}

/** Wage inflation the club has to live with as it grows. One of the fan-loop brakes. */
export function wageInflationFor(reputation: number, sentiment: number): number {
  // A club that becomes attractive also becomes expensive: everyone it signs
  // knows it can pay, and everyone already there knows it too.
  const rep = clamp01(reputation / 100);
  const buzz = clamp01(sentiment / 100);
  return 1 + rep * 0.35 + buzz * 0.1;
}

/** Convert a ValuationContext into the TalksContext shape used above. */
export function talksContextFrom(
  valuation: ValuationContext,
  opts: {
    clubReputation: number; leaguePosition: number; leagueSize: number;
    managerCharisma: number; currentClubReputation?: number;
    isRenewal?: boolean; rolePromiseDelta?: number;
  },
): TalksContext {
  return { valuation, ...opts };
}
