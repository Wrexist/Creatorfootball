/**
 * Sponsorship tuning.
 *
 * REVENUE-MIX RATIONALE. Creator football monetises attention, not turnstiles:
 * reference creator leagues take 85-90% of revenue from sponsorship against
 * ~40% for a conventional sports property, and explicitly refuse to charge
 * fans because free-to-watch *is* the sponsorship pitch. So sponsorship is the
 * dominant income line in this game, it is priced off REACH rather than off
 * fandom or gate, and it is deliberately VOLATILE.
 *
 * The volatility is not flavour. Real creator leagues have closed national
 * divisions and lost broadcast deals inside eighteen months. A club that sets
 * its wage bill against peak sponsorship must be one bad season from distress,
 * because that is both authentic and a better game loop than monotonic growth.
 */
export const SPONSOR_BALANCE = {
  /**
   * Reach (impressions per cycle) at which a sponsor pays its stated
   * `baseValue`. Content packs express `baseValue` as cash per cycle at this
   * reach and at reputation 50.
   */
  REACH_REFERENCE: 1_500_000,
  /** Sub-linear: doubling reach does not double the cheque. */
  REACH_EXPONENT: 0.62,
  REACH_FACTOR_MIN: 0.25,
  REACH_FACTOR_MAX: 3.4,

  /** Value swing between reputation 0 and 100. Credibility is priced separately from reach. */
  REPUTATION_SWING: 0.5,

  /** Slot multipliers. The shirt is worth more than everything else combined. */
  SLOT_MULTIPLIER: {
    SHIRT: 1, SLEEVE: 0.35, STADIUM: 0.42, TRAINING: 0.28, CREATOR: 0.55,
  } as Readonly<Record<string, number>>,

  /** Signing fee as a multiple of the per-cycle value. Paid up front, on signature. */
  SIGNING_FEE_CYCLES: 4,

  /** Deal lengths offered, in cycles. Longer deals lock in a rate — for both sides. */
  DEAL_LENGTHS: [12, 24, 38] as readonly number[],

  /**
   * The sponsorship climate. Deterministic, autocorrelated noise in this band,
   * regenerated every CLIMATE_PERIOD cycles. Below 1 the market is contracting:
   * fewer offers, smaller cheques, sponsors declining to renew.
   */
  CLIMATE_MIN: 0.58,
  CLIMATE_MAX: 1.32,
  CLIMATE_PERIOD: 9,

  /** Offers generated per refresh, before gating. */
  OFFERS_PER_REFRESH: 3,
  /** Cycles an offer stays on the table. */
  OFFER_LIFETIME: 3,
  /** In a contracting market (climate below this) offers become rare. */
  CLIMATE_DROUGHT_THRESHOLD: 0.85,
  DROUGHT_OFFER_CHANCE: 0.35,

  /** Followers a club needs before tier-N sponsors will look at it, per tier. */
  FOLLOWERS_PER_TIER: 250_000,

  // --- Satisfaction and failure -------------------------------------------
  /** Satisfaction starts here and moves toward what the club is delivering. */
  START_SATISFACTION: 65,
  SATISFACTION_RESPONSE: 0.18,
  /** Satisfaction contribution from league position (top of the table = full). */
  POSITION_WEIGHT: 35,
  /** From fan sentiment — sponsors read the room. */
  SENTIMENT_WEIGHT: 25,
  /** From reach growth: a shrinking audience is the fastest way to lose a sponsor. */
  REACH_GROWTH_WEIGHT: 40,
  /** Below this the sponsor terminates early. */
  TERMINATION_THRESHOLD: 25,
  /** Termination penalty as a multiple of the per-cycle value. */
  TERMINATION_PENALTY_CYCLES: 6,
  /** Reputation and sentiment damage when a sponsor walks. */
  TERMINATION_REPUTATION_HIT: 3,
  TERMINATION_SENTIMENT_HIT: 6,

  /** Satisfaction at or above which the sponsor offers a renewal at expiry. */
  RENEWAL_THRESHOLD: 60,
  /** Renewal uplift on a happy deal, before the climate is applied. */
  RENEWAL_UPLIFT: 0.15,
  /** Even a happy sponsor declines to renew this often in a soft market. */
  RENEWAL_DECLINE_CHANCE_IN_DOWNTURN: 0.45,

  /** Bonus reward as a multiple of the per-cycle value when a condition is met. */
  BONUS_REWARD_CYCLES: 8,
} as const;
