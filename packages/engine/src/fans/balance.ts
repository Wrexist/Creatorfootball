/**
 * Fan-model tuning.
 *
 * REVENUE-MIX RATIONALE (read this before changing any number below).
 * Creator football is an audience business wearing a football club's cost base.
 * Real reference points: a creator club with >2m subscribers averaged 216
 * through the turnstiles; creator leagues take 85-90% of revenue from
 * sponsorship against ~40% for a conventional sports property; even the most
 * successful crossover club takes 52% of revenue commercially and only ~14%
 * on matchday. So this model deliberately makes the gate a *minor* income line
 * and routes the money through reach.
 *
 * The model therefore tracks THREE separate quantities with lossy conversion
 * between them, because collapsing them is what makes club sims feel fake:
 *
 *   REACH   (onlineFollowers + creator reach) — huge, cheap, volatile
 *     ↓ x REACH_TO_FANDOM_BASE (~1%) — "reach is not fandom"
 *   FANDOM  (fans.base) — real supporters, slow to win, slow to lose
 *     ↓ x attendance share, capped by the stadium
 *   GATE    (attendance) — atmosphere and identity, small money
 *
 * A club can be enormous online and play in front of nobody. That is a valid,
 * playable state, not a bug.
 */
export const FAN_BALANCE = {
  /** Sentiment moves this share of the way to its target each cycle. */
  SENTIMENT_RESPONSE: 0.22,
  /** Sentiment points per point of (performance - expectation). The core feedback term. */
  GAP_TO_SENTIMENT: 0.85,
  /** Resting sentiment when performance exactly meets expectation. */
  SENTIMENT_NEUTRAL: 50,

  /**
   * Expectation drifts toward what the club looks like it should achieve.
   * This is THE brake on the fan loop: success raises expectation, which
   * subtracts straight back out of the sentiment target, so no amount of
   * winning produces runaway sentiment.
   */
  EXPECTATION_DRIFT: 0.07,
  /** Expectation contributed by reputation, per reputation point. */
  EXPECTATION_PER_REPUTATION: 0.55,
  /** Expectation added by a strong league position (1st = full weight). */
  EXPECTATION_FROM_POSITION: 28,
  /** Spending money publicly raises the bar you will be judged against. */
  EXPECTATION_PER_MILLION_NET_SPEND: 1.1,
  EXPECTATION_SPEND_CAP: 14,
  /** Winning things permanently raises what is considered normal. */
  EXPECTATION_PER_TROPHY: 6,
  EXPECTATION_MIN: 20,
  EXPECTATION_MAX: 96,

  /** Weight of recent results vs. league position in the performance score. */
  RESULT_WEIGHT: 0.45,
  POSITION_WEIGHT: 0.55,
  /** How many recent results are remembered. Fans have short memories. */
  RESULT_MEMORY: 6,

  /** Sentiment bonus at maximum entertainment (all-out attacking, lots of goals). */
  STYLE_BONUS: 9,
  /** Sentiment bonus from having genuine stars, scaled by summed fanAppeal. */
  STAR_BONUS: 8,
  /** Sentiment bonus from active, positive creator output. */
  CREATOR_BONUS: 7,
  /** Sentiment hit for selling a player the terraces had adopted. */
  CULT_HERO_SALE_PENALTY: 11,
  /** Sentiment bump per marquee signing. Announcements are cheap dopamine. */
  MARQUEE_SIGNING_BONUS: 5,
  /** Derby results count roughly double a normal result, in both directions. */
  DERBY_SWING: 7,
  TROPHY_SWING: 18,
  RELEGATION_SWING: -28,

  /** Ticket price fans consider fair. Above it, sentiment and attendance both fall. */
  TICKET_PRICE_REFERENCE: 14,
  /** Sentiment lost per unit of price above the reference. Pricing is a real decision. */
  SENTIMENT_PER_PRICE_UNIT: 0.7,
  /** Attendance elasticity to price. -1.1 means a 10% rise costs ~11% of the gate. */
  PRICE_ELASTICITY: -1.1,
  /** Elasticity is bounded so the curve stays sane at extreme prices. */
  PRICE_FACTOR_MIN: 0.35,
  PRICE_FACTOR_MAX: 1.35,

  /** Trust and loyalty are slow-moving; they are what survives a bad season. */
  TRUST_RESPONSE: 0.09,
  LOYALTY_RESPONSE: 0.03,
  EXCITEMENT_RESPONSE: 0.35,
  EXCITEMENT_RESTING: 32,

  // --- Reach layer ---------------------------------------------------------
  /** Followers gained per unit of creator reach delivered in a cycle. */
  FOLLOWERS_PER_REACH: 0.012,
  /** Multiplier on follower growth from sentiment. Winning makes content spread. */
  FOLLOWER_SENTIMENT_SWING: 1.2,
  /** Baseline follower churn per cycle. Attention is rented, never owned. */
  FOLLOWER_CHURN: 0.018,
  /** Follower ceiling as a multiple of the club's reputation-implied audience. */
  FOLLOWER_CAP_PER_REPUTATION: 260_000,

  // --- Fandom layer --------------------------------------------------------
  /**
   * Share of online followers that ever becomes real support. Deliberately
   * ~1%: this single constant is what encodes "2m subscribers, 216 fans".
   */
  REACH_TO_FANDOM_BASE: 0.011,
  /** Creator fanConversion (0-1) can roughly triple that rate at its best. */
  REACH_TO_FANDOM_CREATOR_SWING: 2.0,
  /** Sentiment multiplier on conversion: nobody adopts a club they resent. */
  REACH_TO_FANDOM_SENTIMENT_SWING: 1.1,
  /** Local support that exists regardless of reach, per point of reputation. */
  LOCAL_SUPPORT_PER_REPUTATION: 320,
  /** Fandom moves this share of the way to its target per cycle — slow both ways. */
  FANDOM_DRIFT: 0.06,
  /** Fandom can never fall below this share of its peak in one season. */
  FANDOM_FLOOR_RATIO: 0.55,

  // --- Attendance ----------------------------------------------------------
  /** Share of the fandom that is realistically in the market for a ticket. */
  ATTENDANCE_SHARE_OF_FANDOM: 0.42,
  /** Fill rate at neutral sentiment before any modifier. */
  BASE_FILL: 0.55,
  /** Fill swing between sentiment 0 and 100. */
  FILL_SENTIMENT_SWING: 0.45,
  /** Importance multiplier per point of fixture importance above 3. */
  IMPORTANCE_FILL_BONUS: 0.09,
  /** Random matchday noise, ± this share. Weather, kick-off time, life. */
  ATTENDANCE_NOISE: 0.05,
  /** Nobody is ever completely alone. */
  MIN_FILL: 0.04,
  /** Season tickets as a share of fandom, scaled by loyalty. */
  SEASON_TICKET_SHARE: 0.22,

  // --- Matchday money (deliberately the smallest line) ---------------------
  /** Food, drink and programme spend per head. */
  CONCESSION_PER_HEAD: 3.2,
  /** Matchday retail per head — impulse buying, separate from the merch line. */
  MATCHDAY_MERCH_PER_HEAD: 1.9,
  /** Hospitality per seat of capacity, scaled by stadium quality. */
  HOSPITALITY_PER_CAPACITY: 0.55,
  /** Season-ticket revenue is recognised per match at a discount to walk-up. */
  SEASON_TICKET_DISCOUNT: 0.72,
} as const;
