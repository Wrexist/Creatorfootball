import { clamp, clamp01 } from '../core/math';
import type { Player } from '../players/player';
import { traitModifier } from '../players/traits';
import { NEGOTIATION_BALANCE as N, WAGE_BALANCE as W } from '../transfers/balance';
import {
  deservedRole, roleWagePremium, wageDemand, type ValuationContext,
} from '../transfers/valuation';
import { emptyBonuses, type Contract, type SquadRole } from './contract';
import type { NegotiationTerms } from '../game/state';

/**
 * Contract terms: what a player wants, and whether what you offered is enough.
 *
 * This module is deliberately separate from the transfer *flow*. The same
 * willingness maths has to answer three different questions — "will he join
 * us", "will he re-sign", "will he stay if a rival bids" — and duplicating it
 * across those three screens is how contract systems end up contradicting
 * themselves.
 *
 * Everything here is pure: no randomness, no ledger. Chance lives in the flow.
 */

const ROLE_ORDER: readonly SquadRole[] = ['PROSPECT', 'SQUAD', 'ROTATION', 'STARTER', 'STAR'];

export interface TalksContext {
  readonly valuation: ValuationContext;
  /** Reputation, 0-100, of the club making the offer. */
  readonly clubReputation: number;
  /** Where that club currently sits, 1 = top. */
  readonly leaguePosition: number;
  readonly leagueSize: number;
  /** Manager charisma / negotiation, 0-100. A persuasive manager closes deals. */
  readonly managerCharisma: number;
  /** Reputation of the club he would be leaving, when there is one. */
  readonly currentClubReputation?: number;
  /** True when this is a renewal at his existing club, which loyalty helps rather than hinders. */
  readonly isRenewal?: boolean;
  /** How the club has actually used him, -1..+1 from rolePromiseDelta. */
  readonly rolePromiseDelta?: number;
}

export interface WillingnessBreakdown {
  readonly wage: number;
  readonly role: number;
  readonly clubReputation: number;
  readonly leaguePosition: number;
  readonly charisma: number;
  readonly ambitionFit: number;
  /** Weighted total, 0-1. Compared against the accept/consider thresholds. */
  readonly score: number;
  /** Human-readable driver of the score, best and worst. */
  readonly bestFactor: string;
  readonly worstFactor: string;
}

/** The package the player opens with, before anybody haggles. */
export function demandedTerms(
  p: Player,
  ctx: TalksContext,
  opts: { fee?: number; years?: number; role?: SquadRole } = {},
): NegotiationTerms {
  const role = opts.role ?? deservedRole(p, ctx.valuation);
  const base = wageDemand(p, { ...ctx.valuation, buyingClubReputation: ctx.clubReputation });
  const wage = Math.round(base * (1 + roleWagePremium(p, role, ctx.valuation)));
  const years = opts.years ?? preferredYears(p);
  return {
    fee: Math.round(opts.fee ?? 0),
    wage: Math.round(wage * (1 + (years - 3) * W.LENGTH_PREMIUM_PER_YEAR)),
    years,
    role,
    signingBonus: Math.round(wage * W.SIGNING_BONUS_WEEKS),
    releaseClause: p.mental.ambition >= 70 ? Math.round(wage * 38 * years * 2.2) : null,
    goalBonus: Math.round(wage * W.GOAL_BONUS_SHARE),
    appearanceBonus: Math.round(wage * W.APPEARANCE_BONUS_SHARE),
  };
}

/** Older players want security; ambitious young ones want a short deal and options. */
export function preferredYears(p: Player): number {
  if (p.age >= 32) return 1;
  if (p.age >= 29) return 2;
  if (p.mental.ambition >= 75 && p.age <= 24) return 3;
  if (p.age <= 21) return 5;
  return 4;
}

/** 0-1 satisfaction with a wage, measured against what he asked for. */
function wageScore(offered: number, demanded: number): number {
  if (demanded <= 0) return 1;
  const ratio = offered / demanded;
  // Below 70% of the demand he stops listening; above 110% extra money buys
  // diminishing goodwill, which is what stops "just throw cash at it" working.
  if (ratio <= 0.7) return clamp01(ratio / 0.7) * 0.25;
  if (ratio <= 1) return 0.25 + ((ratio - 0.7) / 0.3) * 0.65;
  return clamp01(0.9 + Math.min(0.1, (ratio - 1) * 0.25));
}

function roleScore(p: Player, offered: SquadRole, ctx: TalksContext): number {
  const deserved = deservedRole(p, ctx.valuation);
  const gap = ROLE_ORDER.indexOf(offered) - ROLE_ORDER.indexOf(deserved);
  if (gap >= 1) return 1;
  if (gap === 0) return 0.85;
  // A star offered rotation is insulted, not merely disappointed.
  return clamp01(0.85 + gap * 0.42);
}

/**
 * How much the player wants this move. The thing that makes this feel alive is
 * that no single lever is sufficient: a mid-table club offering a rotation role
 * cannot buy a star no matter what it pays, because the wage term is capped.
 */
export function playerWillingness(
  p: Player,
  offer: NegotiationTerms,
  ctx: TalksContext,
): WillingnessBreakdown {
  const demand = demandedTerms(p, ctx, { years: offer.years, role: offer.role as SquadRole });

  const wage = wageScore(offer.wage, demand.wage);
  const role = roleScore(p, (offer.role as SquadRole) ?? 'SQUAD', ctx);
  const clubReputation = clamp01(
    0.35 + (ctx.clubReputation - (ctx.currentClubReputation ?? 0)) / 100 + ctx.clubReputation / 160,
  );
  const leaguePosition = clamp01(
    1 - (ctx.leaguePosition - 1) / Math.max(1, ctx.leagueSize - 1),
  );
  const charisma = clamp01(ctx.managerCharisma / 100);

  // Ambition decides how much the prestige terms matter at all. A 30-ambition
  // journeyman genuinely does not care that you are eighth.
  const ambition = clamp01(p.mental.ambition / 100);
  const ambitionFit = clamp01(1 - ambition * (1 - (clubReputation + leaguePosition) / 2));

  const wts = N.WILLINGNESS_WEIGHTS;
  let score =
    wage * (wts.wage ?? 0) +
    role * (wts.role ?? 0) +
    clubReputation * (wts.clubReputation ?? 0) +
    leaguePosition * (wts.leaguePosition ?? 0) +
    charisma * (wts.charisma ?? 0) +
    ambitionFit * (wts.ambitionFit ?? 0);

  // Loyalty pulls in opposite directions depending on which side of the desk
  // you are sitting on.
  const loyalty = (p.mental.loyalty - 50) / 100;
  score += ctx.isRenewal ? loyalty * 0.12 : -loyalty * 0.14;

  // Being under-used at his current club is the strongest push factor there is.
  const promise = ctx.rolePromiseDelta ?? 0;
  score += ctx.isRenewal ? promise * 0.08 : Math.max(0, -promise) * 0.16;

  // Morale colours everything; a miserable player will listen to anyone.
  score += ((p.mental.morale - 50) / 100) * (ctx.isRenewal ? 0.1 : -0.08);

  // Mercenaries are moved by money and nothing else; the wage term already
  // reflects that, so the trait only sharpens their indifference to prestige.
  const mercenary = traitModifier(p.traitIds, 'wageDemand');
  if (mercenary > 0) score += (wage - 0.5) * mercenary * 0.4;

  const factors: readonly { key: string; value: number }[] = [
    { key: 'the wage', value: wage },
    { key: 'the role on offer', value: role },
    { key: 'the club’s standing', value: clubReputation },
    { key: 'where you sit in the table', value: leaguePosition },
    { key: 'the manager’s pitch', value: charisma },
    { key: 'his ambition', value: ambitionFit },
  ];
  const sorted = factors.slice().sort((a, b) => b.value - a.value);

  return {
    wage, role, clubReputation, leaguePosition, charisma, ambitionFit,
    score: clamp01(score),
    bestFactor: sorted[0]?.key ?? 'the wage',
    worstFactor: sorted[sorted.length - 1]?.key ?? 'the wage',
  };
}

export type TermsVerdict = 'ACCEPT' | 'COUNTER' | 'REJECT';

export interface TermsEvaluation {
  readonly verdict: TermsVerdict;
  readonly willingness: WillingnessBreakdown;
  readonly counter: NegotiationTerms | null;
  readonly reason: string;
}

/**
 * Judge a package. A counter is generated only when there is a package the
 * player would actually sign — otherwise this returns a flat rejection, which
 * is what stops negotiations from becoming an infinite haggling loop.
 */
export function evaluateTermsOffer(
  p: Player,
  offer: NegotiationTerms,
  ctx: TalksContext,
  patience: number,
): TermsEvaluation {
  const willingness = playerWillingness(p, offer, ctx);
  const demand = demandedTerms(p, ctx, { years: offer.years, role: offer.role as SquadRole });

  if (willingness.score >= N.PLAYER_ACCEPT_SCORE) {
    return { verdict: 'ACCEPT', willingness, counter: null, reason: `He is sold on ${willingness.bestFactor}.` };
  }

  const structurallyImpossible =
    willingness.role < 0.3 || willingness.clubReputation < 0.18 || patience <= N.PATIENCE_COLLAPSE;
  if (willingness.score < N.PLAYER_CONSIDER_SCORE || structurallyImpossible) {
    return {
      verdict: 'REJECT',
      willingness,
      counter: null,
      reason: `He is not interested — ${willingness.worstFactor} kills it.`,
    };
  }

  return {
    verdict: 'COUNTER',
    willingness,
    counter: concede(demand, offer, N.PLAYER_CONCESSION_RATE),
    reason: `He would talk, but ${willingness.worstFactor} needs work.`,
  };
}

/** Move a demand part-way toward an offer. Neither side ever caves in one step. */
export function concede(
  demand: NegotiationTerms,
  offer: NegotiationTerms,
  rate: number,
): NegotiationTerms {
  const blend = (a: number, b: number): number => Math.round(a + (b - a) * clamp01(rate));
  return {
    ...demand,
    fee: blend(demand.fee, offer.fee),
    wage: Math.max(offer.wage, blend(demand.wage, offer.wage)),
    signingBonus: blend(demand.signingBonus, offer.signingBonus),
    goalBonus: blend(demand.goalBonus, offer.goalBonus),
    appearanceBonus: blend(demand.appearanceBonus, offer.appearanceBonus),
    // Structural terms are not divisible: he either gets the role or he does not.
    years: offer.years,
    role: demand.role,
    releaseClause: demand.releaseClause,
  };
}

/** Package value in cash terms, for comparing two offers at a glance. */
export function packageValue(t: NegotiationTerms): number {
  return Math.round(t.fee + t.signingBonus + t.wage * 38 * Math.max(1, t.years));
}

/** Turn agreed terms into a Contract. The single place contracts are born. */
export function contractFromTerms(
  id: Contract['id'],
  playerId: Contract['playerId'],
  clubId: Contract['clubId'],
  terms: NegotiationTerms,
  signedCycle: number,
): Contract {
  const weeksPerYear = 38;
  const weeks = Math.max(1, Math.round(terms.years * weeksPerYear));
  return {
    id,
    playerId,
    clubId,
    wage: Math.round(terms.wage),
    weeksRemaining: weeks,
    totalWeeks: weeks,
    signingBonus: Math.round(terms.signingBonus),
    bonuses: {
      ...emptyBonuses(),
      appearance: Math.round(terms.appearanceBonus),
      goal: Math.round(terms.goalBonus),
      cleanSheet: Math.round(terms.wage * W.CLEAN_SHEET_BONUS_SHARE),
      seasonPerformance: Math.round(terms.wage * W.SEASON_PERFORMANCE_BONUS_SHARE),
      trophy: Math.round(terms.wage * W.TROPHY_BONUS_SHARE),
      promotion: Math.round(terms.wage * W.TROPHY_BONUS_SHARE * 0.6),
    },
    role: (terms.role as SquadRole) ?? 'SQUAD',
    releaseClause: terms.releaseClause,
    loyaltyBonus: 0,
    signedCycle,
    minutesPlayed: 0,
    minutesAvailable: 0,
  };
}

/** Convenience for the UI: is this player even open to being approached? */
export function willListenToApproach(p: Player, ctx: TalksContext): boolean {
  if (ctx.isRenewal) return true;
  const promise = ctx.rolePromiseDelta ?? 0;
  const settled = p.mental.loyalty >= N.LOYALTY_REFUSAL_THRESHOLD && promise >= -0.1 && p.mental.morale >= 55;
  return !settled;
}

export const roleRank = (role: SquadRole): number => ROLE_ORDER.indexOf(role);
export const clampRole = (v: number): SquadRole =>
  ROLE_ORDER[clamp(Math.round(v), 0, ROLE_ORDER.length - 1)] ?? 'SQUAD';
