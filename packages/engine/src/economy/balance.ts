/**
 * Economy tuning: the cycle that ties every other system together.
 *
 * REVENUE-MIX RATIONALE. Creator football is an audience business. Reference
 * points from the research dossier: creator leagues take 85-90% of revenue from
 * sponsorship (vs ~40% for a conventional sports property); a creator club with
 * two million subscribers averaged 216 through the turnstiles; the most
 * commercially successful crossover club still takes only ~14% of revenue on
 * matchday and lost money at record turnover. So the intended mix here is
 * roughly:
 *
 *    sponsorship  ~60-75%   priced off REACH        (sponsors/)
 *    merchandise  ~15-25%   priced off REACH+FANDOM (this file)
 *    matchday     ~8-15%    priced off ATTENDANCE   (fans/)
 *
 * Gate income is deliberately small. It buys atmosphere, identity and a fan
 * loop the player can feel — not solvency. `REVENUE_MIX_TARGET` below is
 * asserted in the tests so a future retune cannot quietly invert the model.
 */
export const ECONOMY_BALANCE = {
  /** Sanity envelope for the income mix, asserted in economy/cycle.test.ts. */
  REVENUE_MIX_TARGET: {
    sponsorshipMin: 0.5,
    matchdayMax: 0.22,
  } as Readonly<Record<string, number>>,

  // --- Merchandise ---------------------------------------------------------
  /** Per-cycle merch spend by an actual supporter. Small; there are not many of them. */
  MERCH_PER_FAN: 0.85,
  /**
   * Per-cycle merch spend per unit of raw reach. This is the impulse-buy line —
   * a shirt bought by someone who will never attend a match, which for a creator
   * club is most of the retail business.
   */
  /**
   * Merchandise conversion from reach, applied as `reach ** MERCH_REACH_EXPONENT`.
   *
   * This term used to be linear, which made revenue explode once clubs were
   * given creator-league audiences: a club with 31M reach turned over £211M a
   * season, roughly six times the real turnover of the largest creator-owned
   * club in existence. Reality is emphatically sub-linear — audience converts
   * to money worse and worse as it grows, which is the same lossy-conversion
   * principle the fan model already encodes. The exponent is the brake; the
   * coefficient is calibrated so a club at the 1.5M-reach sponsorship reference
   * point is roughly unchanged.
   */
  MERCH_PER_REACH: 1.12,
  MERCH_REACH_EXPONENT: 0.72,
  /** Price fans consider fair for a shirt. */
  MERCH_PRICE_REFERENCE: 55,
  /** Elasticity of merch volume to price. Less elastic than tickets: it is a souvenir. */
  MERCH_ELASTICITY: -0.75,
  MERCH_FACTOR_MIN: 0.4,
  MERCH_FACTOR_MAX: 1.5,
  /** Swing from the squad's summed `commercialValue` trait modifiers. */
  MERCH_STAR_SWING: 0.45,

  // --- Wages ---------------------------------------------------------------
  /** Cash-to-wage-bill ratio below which the board starts worrying. */
  WATCH_RATIO: 3,
  STRAIN_RATIO: 1.5,
  /** Interest added to an emergency loan, charged once at draw-down. */
  LOAN_INTEREST: 0.08,
  /** Emergency loans are drawn with this much headroom so the club is not back next cycle. */
  LOAN_BUFFER_CYCLES: 1.5,
  /** Debt ceiling as a multiple of the per-cycle wage bill. Beyond this: insolvency. */
  DEBT_CEILING_WAGE_MULTIPLE: 26,
  /** Share of outstanding debt repaid each cycle when the club can afford it. */
  DEBT_REPAYMENT_RATE: 0.06,
  /** Minimum cash kept back before repaying debt. */
  DEBT_REPAYMENT_RESERVE_CYCLES: 2,

  /** Consequences of insolvency. These are sporting, not just financial. */
  INSOLVENCY_SENTIMENT_HIT: 14,
  INSOLVENCY_REPUTATION_HIT: 5,
  INSOLVENCY_MORALE_HIT: 8,
  /** Squad wage budget is cut to this share of the bill while insolvent. */
  INSOLVENCY_WAGE_BUDGET_RATIO: 0.75,

  // --- Budgets -------------------------------------------------------------
  /** Share of net surplus that the board releases as transfer budget. */
  SURPLUS_TO_TRANSFER_BUDGET: 0.55,
  /** Wage budget drifts toward this multiple of sustainable income. */
  WAGE_BUDGET_INCOME_SHARE: 0.55,
  WAGE_BUDGET_DRIFT: 0.15,

  /** Balance below this many cycles of wages triggers a BALANCE_LOW warning. */
  LOW_BALANCE_WARNING_CYCLES: 2,

  // --- Reputation feedback -------------------------------------------------
  /** Reputation drifts toward a target set by results, reach and commercial standing. */
  REPUTATION_DRIFT: 0.05,
  REPUTATION_FROM_POSITION: 45,
  REPUTATION_FROM_REACH: 30,
  REPUTATION_FROM_SENTIMENT: 25,
} as const;

/**
 * Audit tolerances. Money is rounded at every Ledger post, so exact equality is
 * the wrong test; these bands are what "reconciles" actually means.
 */
export const AUDIT_BALANCE = {
  /** Absolute cash tolerance when reconciling wages against contracts. */
  WAGE_TOLERANCE: 2,
  /** Absolute cash tolerance when reconciling a transfer fee against the ledger. */
  TRANSFER_TOLERANCE: 2,
  /** Cycles of history the wage reconciliation looks back over. */
  WAGE_LOOKBACK_CYCLES: 1,
} as const;
