import type { Club } from '../clubs/club';
import type { Contract, SquadRole } from '../contracts/contract';
import { clamp, clamp01 } from '../core/math';
import type { Player } from '../players/player';
import { traitMultiplier } from '../players/traits';
import { TRANSFER_BALANCE as T, WAGE_BALANCE as W } from './balance';

/**
 * What a footballer is worth, and what he wants paying.
 *
 * Valuation is deliberately a *stack of multipliers over one base curve* rather
 * than a lookup table: it means every input the player can see in the UI (form,
 * age, contract length, position scarcity, how many clubs are sniffing) moves
 * the number in a direction they can predict, which is what makes the market
 * feel like something you can read rather than a slot machine.
 *
 * Nothing here is random. Randomness belongs in negotiation, not in price.
 */

export interface ValuationContext {
  readonly cycle: number;
  readonly season: number;
  /** League-wide price level. 1.0 at the start; the economy inflates it as clubs get richer. */
  readonly inflation: number;
  /** Mean overall across every squad in the league — what "average" is measured against. */
  readonly leagueAverageOverall: number;
  /** position -> scarcity index. 1 = normally supplied, 2 = twice as scarce, so twice as coveted. */
  readonly positionScarcity: Readonly<Record<string, number>>;
  /** How many clubs are actively chasing him right now. */
  readonly suitorCount: number;
  /** His current deal, when we know it. A player in his final months is cheap. */
  readonly contract: Contract | null;
  /** Reputation, 0-100, of the club trying to buy. Big clubs pay a premium. */
  readonly buyingClubReputation?: number;
  /** Overalls of the selling club's other squad members, for judging squad importance. */
  readonly sellingSquadOveralls?: readonly number[];
  /** 0-100 negotiation attribute of the manager doing the buying. */
  readonly managerNegotiation?: number;
}

export const defaultValuationContext = (
  over: Partial<ValuationContext> = {},
): ValuationContext => ({
  cycle: 0,
  season: 1,
  inflation: 1,
  leagueAverageOverall: 60,
  positionScarcity: {},
  suitorCount: 0,
  contract: null,
  ...over,
});

/** Ability-only age multiplier. Potential is priced separately so youth is not double-counted. */
function ageMultiplier(age: number): number {
  if (age < T.AGE_PEAK_START) {
    return Math.max(
      T.AGE_MULT_FLOOR,
      1 - (T.AGE_PEAK_START - age) * T.YOUTH_ABILITY_DISCOUNT_PER_YEAR,
    );
  }
  if (age <= T.AGE_PEAK_END) return 1;
  const past = age - T.AGE_PEAK_END;
  const steep = Math.max(0, age - T.STEEP_DECLINE_AGE);
  return Math.max(
    T.AGE_MULT_FLOOR,
    1 - past * T.DECLINE_PER_YEAR - steep * T.STEEP_DECLINE_PER_YEAR,
  );
}

/** Unrealised ceiling is only worth paying for while there is career left to realise it in. */
function potentialMultiplier(p: Player): number {
  const headroom = Math.max(0, p.potential - p.overall);
  const careerLeft = clamp01((T.POTENTIAL_IRRELEVANT_AGE - p.age) / 12);
  const premium = headroom * T.POTENTIAL_PREMIUM_PER_POINT * careerLeft;
  return 1 + Math.min(T.POTENTIAL_PREMIUM_CAP, premium);
}

/** The market overreacts to a hot streak, but only once there is a streak to react to. */
function formMultiplier(p: Player): number {
  const trust = clamp01(p.form.appearances / T.FORM_CONFIDENCE_APPEARANCES);
  return 1 + clamp(p.form.rating, -1, 1) * T.FORM_SWING * trust;
}

/** A running-down contract is the single biggest discount in the game. */
export function contractMultiplier(contract: Contract | null): number {
  if (!contract) return T.CONTRACT_EXPIRING_MULT;
  const weeks = Math.max(0, contract.weeksRemaining);
  if (weeks >= T.CONTRACT_SAFE_WEEKS) return 1;
  const t = weeks / T.CONTRACT_SAFE_WEEKS;
  return T.CONTRACT_EXPIRING_MULT + (1 - T.CONTRACT_EXPIRING_MULT) * t;
}

function scarcityMultiplier(p: Player, ctx: ValuationContext): number {
  const scarcity = ctx.positionScarcity[p.position] ?? 1;
  return clamp(1 + (scarcity - 1) * T.SCARCITY_SWING, 0.7, 1 + T.SCARCITY_SWING * 2);
}

function demandMultiplier(ctx: ValuationContext): number {
  return 1 + Math.min(T.DEMAND_CAP, Math.max(0, ctx.suitorCount) * T.DEMAND_PER_SUITOR);
}

function injuryMultiplier(p: Player): number {
  if (!p.injury) return 1;
  return 1 - Math.min(T.INJURY_DISCOUNT_CAP, p.injury.weeksRemaining * T.INJURY_DISCOUNT_PER_WEEK);
}

/**
 * Market value: what the wider market thinks he is worth, ignoring who is buying.
 * `askingPrice` is what one specific selling club will actually quote you.
 */
export function marketValue(p: Player, ctx: ValuationContext): number {
  const delta = p.overall - ctx.leagueAverageOverall;
  const base = T.BASE_VALUE_AT_AVERAGE * T.VALUE_PER_OVERALL ** delta;

  const reputation = 1 + ((p.reputation - 50) / 50) * T.REPUTATION_SWING;

  const value =
    base *
    ageMultiplier(p.age) *
    potentialMultiplier(p) *
    formMultiplier(p) *
    contractMultiplier(ctx.contract) *
    scarcityMultiplier(p, ctx) *
    demandMultiplier(ctx) *
    injuryMultiplier(p) *
    reputation *
    traitMultiplier(p.traitIds, 'marketValue') *
    Math.max(0.25, ctx.inflation);

  return Math.round(clamp(value, T.MIN_VALUE, T.MAX_VALUE));
}

/** 0-1: how central this player is to the squad he is currently in. */
export function squadImportance(p: Player, squadOveralls: readonly number[] | undefined): number {
  if (!squadOveralls || squadOveralls.length === 0) return 0.5;
  const better = squadOveralls.filter((o) => o > p.overall).length;
  return clamp01(1 - better / Math.max(1, squadOveralls.length - 1));
}

/**
 * What the selling club quotes. This is where the negotiation actually starts,
 * and it is deliberately *not* market value: a club that does not need to sell,
 * selling its best player, to a richer rival, will price you out of it.
 */
export function askingPrice(
  p: Player,
  sellingClub: Club | null,
  ctx: ValuationContext,
): number {
  const value = marketValue(p, ctx);
  if (!sellingClub) return 0; // free agent: no fee, only wages and an agent

  const role: SquadRole = ctx.contract?.role ?? 'SQUAD';
  let price = value * (T.ROLE_PREMIUM[role] ?? 1);

  // Squad importance on top of the contractual role: losing your only good
  // centre-back is a different problem from losing one of four.
  const importance = squadImportance(p, ctx.sellingSquadOveralls);
  price *= 1 + importance * T.IRREPLACEABLE_PREMIUM;

  // A seller sitting on cash relative to its wage bill can simply say no.
  const wageBill = Math.max(1, sellingClub.finance.wageBudgetPerCycle);
  const comfort = clamp01(sellingClub.finance.transferBudget / (wageBill * T.SELLER_COMFORT_RATIO));
  const distress = sellingClub.finance.debt > 0 && sellingClub.finance.transferBudget <= 0 ? 1 : 0;
  price *= 1 + comfort * T.SELLER_WEALTH_PREMIUM - distress * T.SELLER_DISTRESS_DISCOUNT;

  // The big-club tax: the quote goes up when the buyer visibly has money.
  const buyerRep = ctx.buyingClubReputation ?? sellingClub.reputation;
  const repGap = clamp01((buyerRep - sellingClub.reputation) / 50);
  price *= 1 + repGap * T.BIG_CLUB_TAX;

  // A good negotiator gets the conversation started lower.
  const leverage = ((ctx.managerNegotiation ?? 50) - 50) / 50;
  price *= 1 - leverage * T.NEGOTIATION_LEVERAGE;

  return Math.round(clamp(Math.max(price, value * T.ASKING_FLOOR_MULT), T.MIN_VALUE, T.MAX_VALUE));
}

/**
 * Weekly wage the player expects. Contracts, not fees, are what actually
 * bankrupt a club, so this curve is steeper at the top than the value curve.
 */
export function wageDemand(p: Player, ctx: ValuationContext): number {
  const delta = p.overall - ctx.leagueAverageOverall;
  let wage = W.BASE_WAGE_AT_AVERAGE * W.WAGE_PER_OVERALL ** delta;

  wage *= 1 + ((p.mental.ambition - 50) / 50) * W.AMBITION_SWING;
  wage *= 1 + ((p.reputation - 50) / 50) * W.REPUTATION_SWING;

  const headroom = Math.max(0, p.potential - p.overall);
  wage *= 1 + clamp01(headroom / 20) * W.POTENTIAL_SWING;

  const ageGap = Math.abs(p.age - W.PEAK_EARNING_AGE);
  wage *= 1 - Math.min(W.AGE_SWING_CAP, ageGap * W.AGE_SWING_PER_YEAR);

  // Prestige is part of the package: he will take less to join a big club and
  // needs paying extra to drop into obscurity.
  if (ctx.buyingClubReputation !== undefined) {
    const rep = clamp01(ctx.buyingClubReputation / 100);
    wage *= 1 - rep * W.CLUB_PRESTIGE_DISCOUNT + (1 - rep) * W.CLUB_OBSCURITY_PREMIUM;
  }

  // No fee to collect means the money has to come from somewhere.
  if (!ctx.contract) wage *= 1 + T.FREE_AGENT_WAGE_PREMIUM;

  wage *= traitMultiplier(p.traitIds, 'wageDemand');
  wage *= Math.max(0.25, ctx.inflation);

  return Math.round(clamp(wage, W.MIN_WAGE, W.MAX_WAGE));
}

/** Wage uplift demanded when the role on offer is below what he believes he is. */
export function roleWagePremium(p: Player, offeredRole: SquadRole, ctx: ValuationContext): number {
  const deserved = deservedRole(p, ctx);
  const order: readonly SquadRole[] = ['PROSPECT', 'SQUAD', 'ROTATION', 'STARTER', 'STAR'];
  const gap = order.indexOf(deserved) - order.indexOf(offeredRole);
  if (gap <= 0) return 0;
  return gap * W.ROLE_INSULT_PREMIUM;
}

/** The role a player believes his ability and reputation entitle him to. */
export function deservedRole(p: Player, ctx: ValuationContext): SquadRole {
  const delta = p.overall - ctx.leagueAverageOverall;
  const ego = (p.mental.ambition - 50) / 25; // ±2 rating points of self-belief
  const effective = delta + ego;
  if (effective >= 12) return 'STAR';
  if (effective >= 5) return 'STARTER';
  if (effective >= -3) return 'ROTATION';
  if (p.age <= 20 && p.potential - p.overall >= 8) return 'PROSPECT';
  return 'SQUAD';
}

/** Total cash a signing commits the buyer to over the life of the deal. */
export function totalCommitment(fee: number, wage: number, years: number, signingBonus: number): number {
  const weeksPerYear = 38;
  return Math.round(fee + signingBonus + wage * weeksPerYear * Math.max(0, years));
}
