import type { Club } from '../clubs/club';
import type { SponsorTemplate } from '../content/schema';
import { clamp, clamp01, lerp } from '../core/math';
import { hashString, type Rng } from '../core/rng';
import type { Ledger, PostContext } from '../economy/ledger';
import type { SponsorDeal, SponsorOffer, SponsorState } from '../game/state';
import { SPONSOR_BALANCE as S } from './balance';

/**
 * Sponsorship — the dominant income line.
 *
 * Sponsors buy REACH, not fandom and not the gate. The club's online following
 * plus the aggregate reach of its creators is the product being sold; the
 * football is the reason anyone tunes in. Reputation prices credibility on top.
 *
 * Two properties make this a game rather than an annuity. First, offers are
 * gated on reputation AND follower count, so sponsorship progression is felt as
 * a ladder you climb. Second, the market has a *climate* that contracts as well
 * as expands: a club that sized its wage bill against a peak deal can find that
 * deal gone at renewal. See sponsors/balance.ts for why.
 */

export interface SponsorRegistry {
  sponsors(): readonly SponsorTemplate[];
}

export interface SponsorContext {
  readonly cycle: number;
  readonly season: number;
  /** Impressions the club delivers per cycle. The thing sponsors actually buy. */
  readonly reach: number;
  /** Reach last cycle, for the growth term in satisfaction. */
  readonly previousReach?: number;
  readonly leaguePosition: number;
  readonly leagueSize: number;
  /** Manager `brandBuilding`, 0-100. A commercial manager gets better offers. */
  readonly brandBuilding?: number;
  /** Facility `creatorReach` effect, additive around 0. */
  readonly creatorReachBonus?: number;
  /** Save seed, so the sponsorship climate is reproducible across sessions. */
  readonly seed: string;
}

/**
 * The sponsorship climate, 0.58-1.32. Deterministic and autocorrelated: it
 * drifts smoothly over roughly nine cycles rather than flickering, so a
 * downturn is something the player can see coming and plan around.
 */
export function sponsorMarketIndex(seed: string, cycle: number): number {
  const period = S.CLIMATE_PERIOD;
  const anchor = Math.floor(cycle / period);
  const at = (i: number): number => hashString(`climate:${seed}:${i}`) / 0xffffffff;
  const t = (cycle - anchor * period) / period;
  // Smoothstep between anchors so the curve has no corners.
  const smooth = t * t * (3 - 2 * t);
  return lerp(
    lerp(S.CLIMATE_MIN, S.CLIMATE_MAX, at(anchor)),
    lerp(S.CLIMATE_MIN, S.CLIMATE_MAX, at(anchor + 1)),
    smooth,
  );
}

/** How much reach is worth relative to the reference club. Sub-linear by design. */
export function reachFactor(reach: number): number {
  const ratio = Math.max(0, reach) / S.REACH_REFERENCE;
  return clamp(ratio ** S.REACH_EXPONENT, S.REACH_FACTOR_MIN, S.REACH_FACTOR_MAX);
}

/** What a given sponsor would pay this club, per cycle. */
export function sponsorValue(
  template: SponsorTemplate,
  slot: string,
  club: Club,
  ctx: SponsorContext,
): number {
  const climate = sponsorMarketIndex(ctx.seed, ctx.cycle);
  const reputation = 1 + ((club.reputation - 50) / 50) * S.REPUTATION_SWING;
  const brand = 1 + (((ctx.brandBuilding ?? 50) - 50) / 50) * 0.2;
  const value =
    template.baseValue *
    (S.SLOT_MULTIPLIER[slot] ?? 0.3) *
    reachFactor(ctx.reach * (1 + (ctx.creatorReachBonus ?? 0))) *
    Math.max(0.3, reputation) *
    brand *
    climate;
  return Math.max(0, Math.round(value));
}

function meetsRequirements(template: SponsorTemplate, club: Club): boolean {
  if (club.reputation < template.requiresReputation) return false;
  const followerGate =
    template.requiresFollowers ?? Math.max(0, (template.tier - 1) * S.FOLLOWERS_PER_TIER);
  return club.fans.onlineFollowers >= followerGate;
}

/** Human-readable gates, so the UI can show what a locked sponsor is waiting for. */
export function requirementLabels(template: SponsorTemplate): string[] {
  const out = [`Reputation ${template.requiresReputation}+`];
  const followers = template.requiresFollowers ?? Math.max(0, (template.tier - 1) * S.FOLLOWERS_PER_TIER);
  if (followers > 0) out.push(`${(followers / 1000).toFixed(0)}k followers`);
  return out;
}

const BONUS_KINDS = ['WINS', 'GOALS', 'CLEAN_SHEETS', 'TOP_HALF_FINISH', 'FOLLOWER_GROWTH'] as const;
export type SponsorBonusKind = (typeof BONUS_KINDS)[number];

export const BONUS_LABELS: Record<string, string> = {
  WINS: 'wins',
  GOALS: 'goals scored',
  CLEAN_SHEETS: 'clean sheets',
  TOP_HALF_FINISH: 'top-half finish',
  FOLLOWER_GROWTH: 'new followers',
};

/**
 * Generate the offers on the table this cycle. Gated hard on reputation and
 * followers so that unlocking a tier-4 sponsor feels like an achievement rather
 * than a timer expiring.
 */
export function generateSponsorOffers(
  club: Club,
  registry: SponsorRegistry,
  rng: Rng,
  ctx: SponsorContext,
  activeDeals: readonly SponsorDeal[] = [],
): SponsorOffer[] {
  const stream = rng.fork(`sponsors:${club.id}:${ctx.cycle}`);
  const climate = sponsorMarketIndex(ctx.seed, ctx.cycle);

  // In a contracting market the phone simply stops ringing.
  if (climate < S.CLIMATE_DROUGHT_THRESHOLD && !stream.chance(S.DROUGHT_OFFER_CHANCE)) return [];

  const takenSlots = new Set(activeDeals.map((d) => d.slot));
  const eligible = registry
    .sponsors()
    .filter((t) => meetsRequirements(t, club))
    .filter((t) => t.slots.some((slot) => !takenSlots.has(slot as SponsorDeal['slot'])));
  if (eligible.length === 0) return [];

  const chosen = stream.sample(eligible, S.OFFERS_PER_REFRESH);
  const offers: SponsorOffer[] = [];

  for (const template of chosen) {
    const openSlots = template.slots.filter((s) => !takenSlots.has(s as SponsorDeal['slot']));
    const slot = (openSlots[stream.int(0, openSlots.length - 1)] ?? template.slots[0] ?? 'SHIRT') as SponsorOffer['slot'];
    const valuePerCycle = sponsorValue(template, slot, club, ctx);
    if (valuePerCycle <= 0) continue;

    const weeks = stream.pick(S.DEAL_LENGTHS);
    const kind = stream.pick(BONUS_KINDS);
    const target = bonusTargetFor(kind, club, weeks, stream);

    offers.push({
      id: `offer_${club.id}_${template.id}_${ctx.cycle}`,
      sponsorId: template.id,
      name: template.name,
      sector: template.sector,
      slot,
      valuePerCycle,
      signingFee: Math.round(valuePerCycle * S.SIGNING_FEE_CYCLES),
      weeks,
      requirements: requirementLabels(template),
      bonusCondition: {
        kind,
        target,
        reward: Math.round(valuePerCycle * S.BONUS_REWARD_CYCLES),
      },
      expiresCycle: ctx.cycle + S.OFFER_LIFETIME,
      accent: template.accent,
    });
  }
  return offers;
}

function bonusTargetFor(kind: SponsorBonusKind, club: Club, weeks: number, rng: Rng): number {
  switch (kind) {
    case 'WINS': return Math.max(2, Math.round(weeks * rng.float(0.3, 0.45)));
    case 'GOALS': return Math.max(5, Math.round(weeks * rng.float(1.4, 2.2)));
    case 'CLEAN_SHEETS': return Math.max(2, Math.round(weeks * rng.float(0.15, 0.28)));
    case 'TOP_HALF_FINISH': return 1;
    default: return Math.max(10_000, Math.round(club.fans.onlineFollowers * rng.float(0.12, 0.3)));
  }
}

/** Sign an offer. The signing fee arrives immediately; the rest arrives per cycle. */
export function signSponsorOffer(
  club: Club,
  offer: SponsorOffer,
  ledger: Ledger,
  ctx: PostContext,
): { ok: boolean; deal: SponsorDeal | null; reason: string } {
  const posted = ledger.credit(club.id, 'SPONSOR_REVENUE', offer.signingFee,
    `${offer.name} signing fee (${offer.slot.toLowerCase()})`, ctx,
    { idempotencyKey: `sponsor-signing:${offer.id}`, metadata: { sponsorId: offer.sponsorId } });
  if (!posted.ok) return { ok: false, deal: null, reason: 'That deal has already been signed.' };

  return {
    ok: true,
    reason: `${offer.name} have signed on as your ${offer.slot.toLowerCase()} partner.`,
    deal: {
      id: `deal_${offer.id}`,
      sponsorId: offer.sponsorId,
      name: offer.name,
      ...(offer.sector ? { sector: offer.sector } : {}),
      slot: offer.slot,
      valuePerCycle: offer.valuePerCycle,
      weeksRemaining: offer.weeks,
      satisfaction: S.START_SATISFACTION,
      bonusCondition: offer.bonusCondition
        ? { ...offer.bonusCondition, progress: 0 }
        : undefined,
    },
  };
}

export interface SponsorProgress {
  readonly wins?: number;
  readonly goals?: number;
  readonly cleanSheets?: number;
  readonly topHalfFinish?: boolean;
  readonly followerGrowth?: number;
}

export interface SponsorCycleResult {
  readonly sponsors: SponsorState;
  readonly income: number;
  readonly bonusesPaid: number;
  readonly penalties: number;
  readonly expired: readonly { name: string; renewed: boolean }[];
  readonly terminated: readonly { name: string; reason: string }[];
  /** Reputation and sentiment damage the caller applies to the club. */
  readonly reputationDelta: number;
  readonly sentimentDelta: number;
  readonly notes: readonly string[];
}

/** Satisfaction target from what the club is actually delivering this cycle. */
function satisfactionTarget(club: Club, ctx: SponsorContext): number {
  const positional = clamp01(1 - (ctx.leaguePosition - 1) / Math.max(1, ctx.leagueSize - 1));
  const sentiment = clamp01(club.fans.sentiment / 100);
  const previous = ctx.previousReach ?? ctx.reach;
  // Growth is measured, not level: sponsors renew on trajectory.
  const growth = previous <= 0 ? 0.5 : clamp01(0.5 + (ctx.reach - previous) / Math.max(1, previous));
  return clamp(
    positional * S.POSITION_WEIGHT + sentiment * S.SENTIMENT_WEIGHT + growth * S.REACH_GROWTH_WEIGHT,
    0,
    100,
  );
}

/**
 * Advance every active deal by one cycle: pay the money, move satisfaction,
 * progress bonus conditions, and let sponsors walk or decline to renew.
 */
export function advanceSponsorDeals(
  club: Club,
  sponsors: SponsorState,
  progress: SponsorProgress,
  rng: Rng,
  ledger: Ledger,
  ctx: SponsorContext,
  postCtx: PostContext,
): SponsorCycleResult {
  const stream = rng.fork(`sponsordeals:${club.id}:${ctx.cycle}`);
  const climate = sponsorMarketIndex(ctx.seed, ctx.cycle);
  const target = satisfactionTarget(club, ctx);

  const active: SponsorDeal[] = [];
  const expired: { name: string; renewed: boolean }[] = [];
  const terminated: { name: string; reason: string }[] = [];
  const notes: string[] = [];
  let income = 0;
  let bonusesPaid = 0;
  let penalties = 0;
  let reputationDelta = 0;
  let sentimentDelta = 0;

  for (const deal of sponsors.active) {
    const payment = Math.max(0, Math.round(deal.valuePerCycle));
    const posted = ledger.credit(club.id, 'SPONSOR_REVENUE', payment,
      `${deal.name} — ${deal.slot.toLowerCase()} sponsorship`, postCtx,
      { idempotencyKey: `sponsor:${deal.id}:${postCtx.cycle}`, metadata: { sponsorId: deal.sponsorId } });
    if (posted.ok) income += payment;

    const satisfaction = clamp(
      deal.satisfaction + (target - deal.satisfaction) * S.SATISFACTION_RESPONSE,
      0,
      100,
    );

    let bonus = deal.bonusCondition;
    if (bonus) {
      const delta = bonusProgressDelta(bonus.kind, progress);
      const nextProgress = bonus.progress + delta;
      if (bonus.progress < bonus.target && nextProgress >= bonus.target) {
        const paid = ledger.credit(club.id, 'SPONSOR_REVENUE', bonus.reward,
          `${deal.name} bonus: ${BONUS_LABELS[bonus.kind] ?? bonus.kind} target met`, postCtx,
          { idempotencyKey: `sponsor-bonus:${deal.id}`, metadata: { sponsorId: deal.sponsorId } });
        if (paid.ok) {
          bonusesPaid += bonus.reward;
          notes.push(`${deal.name} paid out on their ${BONUS_LABELS[bonus.kind] ?? bonus.kind} bonus.`);
        }
      }
      bonus = { ...bonus, progress: nextProgress };
    }

    // A sponsor whose club has collapsed does not wait for the deal to run out.
    if (satisfaction < S.TERMINATION_THRESHOLD) {
      const penalty = Math.round(deal.valuePerCycle * S.TERMINATION_PENALTY_CYCLES);
      const charged = ledger.debit(club.id, 'PENALTY', penalty,
        `${deal.name} terminated the ${deal.slot.toLowerCase()} deal early`, postCtx,
        { allowOverdraft: true, metadata: { sponsorId: deal.sponsorId } });
      if (charged.ok) penalties += penalty;
      reputationDelta -= S.TERMINATION_REPUTATION_HIT;
      sentimentDelta -= S.TERMINATION_SENTIMENT_HIT;
      terminated.push({ name: deal.name, reason: 'Performance clause triggered.' });
      notes.push(`${deal.name} have walked away. That is a hole in the budget.`);
      continue;
    }

    const weeksRemaining = deal.weeksRemaining - 1;
    if (weeksRemaining > 0) {
      active.push({ ...deal, weeksRemaining, satisfaction, bonusCondition: bonus });
      continue;
    }

    // Expiry. Renewal is not automatic even when they are happy.
    const wantsToRenew =
      satisfaction >= S.RENEWAL_THRESHOLD &&
      !(climate < S.CLIMATE_DROUGHT_THRESHOLD && stream.chance(S.RENEWAL_DECLINE_CHANCE_IN_DOWNTURN));

    if (wantsToRenew) {
      const renewedValue = Math.round(
        deal.valuePerCycle * (1 + S.RENEWAL_UPLIFT) * clamp(climate, 0.5, 1.4),
      );
      active.push({
        ...deal,
        valuePerCycle: renewedValue,
        weeksRemaining: stream.pick(S.DEAL_LENGTHS),
        satisfaction,
        bonusCondition: bonus ? { ...bonus, progress: 0 } : undefined,
      });
      expired.push({ name: deal.name, renewed: true });
      notes.push(`${deal.name} renewed at ${renewedValue.toLocaleString('en-GB')} per cycle.`);
    } else {
      expired.push({ name: deal.name, renewed: false });
      notes.push(`${deal.name} declined to renew.`);
    }
  }

  const available = sponsors.available.filter((o) => o.expiresCycle >= ctx.cycle);

  return {
    sponsors: { available, active },
    income,
    bonusesPaid,
    penalties,
    expired,
    terminated,
    reputationDelta,
    sentimentDelta,
    notes,
  };
}

function bonusProgressDelta(kind: string, progress: SponsorProgress): number {
  switch (kind) {
    case 'WINS': return progress.wins ?? 0;
    case 'GOALS': return progress.goals ?? 0;
    case 'CLEAN_SHEETS': return progress.cleanSheets ?? 0;
    case 'TOP_HALF_FINISH': return progress.topHalfFinish ? 1 : 0;
    case 'FOLLOWER_GROWTH': return progress.followerGrowth ?? 0;
    default: return 0;
  }
}

/** Total sponsorship income per cycle. The headline number on the finance screen. */
export const sponsorIncomePerCycle = (sponsors: SponsorState): number =>
  sponsors.active.reduce((sum, d) => sum + Math.max(0, d.valuePerCycle), 0);

/** One-line read on the commercial market, for the UI. */
export function climateLabel(index: number): string {
  if (index >= 1.18) return 'Booming — brands are chasing the league.';
  if (index >= 1.0) return 'Healthy.';
  if (index >= S.CLIMATE_DROUGHT_THRESHOLD) return 'Cooling. Renewals are getting harder.';
  return 'Contracting. Budgets are being cut across the board.';
}


/**
 * The commercial portfolio a club already has when you take it over.
 *
 * A new save must never start with zero sponsorship. Offer generation is gated
 * by the market climate, so on some seeds it legitimately returns nothing —
 * correct behaviour for a club shopping for a *new* partner, wrong for
 * establishing the shirt deal every real club already carries. This builds that
 * inherited deal directly, part-way through its term, so the player arrives
 * mid-contract with a renewal to think about rather than a blank slate.
 */
export function inheritedSponsorDeals(
  club: Club,
  registry: SponsorRegistry,
  rng: Rng,
  ctx: SponsorContext,
  maxSlots = 3,
): SponsorDeal[] {
  const stream = rng.fork(`inherited:${club.id}`);
  const deals: SponsorDeal[] = [];
  const taken = new Set<SponsorDeal['slot']>();
  const usedSponsors = new Set<string>();

  // Shirt first — it is the deal every club has and the one worth most — then
  // whatever else the club's standing can support.
  const SLOT_ORDER: SponsorDeal['slot'][] = ['SHIRT', 'SLEEVE', 'STADIUM', 'TRAINING', 'CREATOR'];

  for (const slot of SLOT_ORDER) {
    if (deals.length >= maxSlots) break;
    const eligible = registry
      .sponsors()
      .filter((t) => !usedSponsors.has(t.id))
      .filter((t) => meetsRequirements(t, club))
      .filter((t) => t.slots.includes(slot));
    if (eligible.length === 0) continue;

    // The best partner the club could realistically have attracted, not a
    // random one: an established club should not be wearing the smallest brand
    // in the league on its shirt.
    const best = eligible.reduce((top, t) => (t.tier > top.tier ? t : top), eligible[0] as SponsorTemplate);
    const valuePerCycle = sponsorValue(best, slot, club, ctx);
    if (valuePerCycle <= 0) continue;

    usedSponsors.add(best.id);
    taken.add(slot);
    deals.push({
      id: `deal_inherited_${club.id}_${slot.toLowerCase()}`,
      sponsorId: best.id,
      name: best.name,
      slot,
      valuePerCycle,
      // Staggered expiry, so renewals arrive as separate decisions across the
      // season rather than as one cliff.
      weeksRemaining: stream.int(12, 40),
      satisfaction: stream.int(52, 74),
    });
  }

  return deals;
}
