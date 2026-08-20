/**
 * Every tunable number the transfer economy reads.
 *
 * These live here rather than inline so that a designer can retune the market
 * without touching a line of logic, and so that a balance change is a single
 * reviewable diff. The trade-off is one extra indirection at every read site;
 * that is worth it for a system whose whole job is "does this price feel right".
 */

export const TRANSFER_BALANCE = {
  /** Cash value of a player rated exactly at the league average, before modifiers. */
  BASE_VALUE_AT_AVERAGE: 1_200_000,
  /**
   * Multiplier applied per point of overall above (or below) league average.
   * Compounding rather than linear: the gap between an 80 and an 86 must feel
   * enormous, because that is the gap that decides titles.
   *
   * Lowered from 1.118. At 1.118 a league spanning 25 overall points spanned
   * *two orders of magnitude* in price — the top of the market was 100x the
   * bottom, the best player a club at the foot of the table could reach was
   * rated 61 against a weakest starter of 60, and the transfer window was not a
   * decision. 1.095 keeps the top of the market unreachable-but-visible (~30x)
   * while putting the tier immediately above the player inside a season's
   * budget, which is where the whole emotional point of the system lives.
   */
  VALUE_PER_OVERALL: 1.095,
  /** A squad filler still costs something; nobody is free. */
  MIN_VALUE: 25_000,
  /** Hard ceiling so a runaway save cannot produce nonsense numbers. */
  MAX_VALUE: 240_000_000,

  /** Ability peaks here; either side of the window value is discounted. */
  AGE_PEAK_START: 24,
  AGE_PEAK_END: 28,
  /** Raw-ability discount per year below the peak window (offset by potential). */
  YOUTH_ABILITY_DISCOUNT_PER_YEAR: 0.028,
  /** Value lost per year past the peak window. */
  DECLINE_PER_YEAR: 0.105,
  /** Steeper cliff once a career is visibly ending. */
  STEEP_DECLINE_AGE: 32,
  STEEP_DECLINE_PER_YEAR: 0.075,
  /** Nobody is worthless: floor for the age multiplier. */
  AGE_MULT_FLOOR: 0.12,

  /** Extra value per point of unrealised potential, scaled by how much career is left. */
  POTENTIAL_PREMIUM_PER_POINT: 0.024,
  /** Potential stops being worth paying for at this age. */
  POTENTIAL_IRRELEVANT_AGE: 30,
  /** Cap so a 16-year-old with a 95 ceiling is expensive, not priceless. */
  POTENTIAL_PREMIUM_CAP: 1.15,

  /** Value swing at form +1 / -1. Hot players cost more; this is the market overreacting. */
  FORM_SWING: 0.3,
  /** Minimum appearances before form is trusted at full weight. */
  FORM_CONFIDENCE_APPEARANCES: 6,

  /** Value swing at scarcity index 2.0 (twice as scarce as normal). */
  SCARCITY_SWING: 0.35,
  /** Premium per rival club actively chasing him. */
  DEMAND_PER_SUITOR: 0.07,
  DEMAND_CAP: 0.35,

  /**
   * Contract weeks at or above which there is no run-down discount at all.
   * Raised from 40 (under two seasons) to 60 so that a player in the final year
   * of his deal is visibly cheaper — the single most reliable route to an
   * affordable upgrade for a club that cannot outbid anyone.
   */
  CONTRACT_SAFE_WEEKS: 60,
  /** Multiplier at zero weeks remaining — the "he can leave for nothing" cliff. */
  CONTRACT_EXPIRING_MULT: 0.22,
  /** A free agent commands no fee, but the wage demand rises to compensate. */
  FREE_AGENT_WAGE_PREMIUM: 0.18,

  /** Value lost per week of injury remaining. */
  INJURY_DISCOUNT_PER_WEEK: 0.02,
  INJURY_DISCOUNT_CAP: 0.35,

  /** Value swing between reputation 0 and 100. Fame is worth real money. */
  REPUTATION_SWING: 0.25,

  /** Asking-price premium by the role the player currently holds at the selling club. */
  ROLE_PREMIUM: {
    STAR: 1.9, STARTER: 1.42, ROTATION: 1.1, SQUAD: 0.94, PROSPECT: 1.28,
  } as Readonly<Record<string, number>>,
  /** Extra premium when he is comfortably the best player at the club. */
  IRREPLACEABLE_PREMIUM: 0.3,
  /** A seller sitting on cash does not need to deal; a broke seller does. */
  SELLER_WEALTH_PREMIUM: 0.3,
  SELLER_DISTRESS_DISCOUNT: 0.28,
  /** Cash-to-wage-bill ratio at or above which a seller counts as comfortable. */
  SELLER_COMFORT_RATIO: 8,
  /** Premium charged to a buyer whose reputation exceeds the seller's. The big-club tax. */
  BIG_CLUB_TAX: 0.32,
  /** A strong negotiator shaves this much off the asking price. */
  NEGOTIATION_LEVERAGE: 0.14,
  /** Sellers never quote below this share of market value. */
  ASKING_FLOOR_MULT: 0.6,
} as const;

export const WAGE_BALANCE = {
  /** Weekly wage for a league-average player. */
  /**
   * Weekly wage for a league-average player, before every other modifier.
   *
   * Calibrated so a club's wage bill lands in football's normal 50-70% band
   * against its own turnover. At 9,000 the bottom club's squad cost 148% of
   * everything it earned on the day the save was created — structurally
   * insolvent before a ball was kicked, which then blocked squad replenishment
   * and started a decline no player could recover from.
   */
  BASE_WAGE_AT_AVERAGE: 4_600,
  /** Compounding per point of overall above average — wages inflate faster than fees at the top. */
  WAGE_PER_OVERALL: 1.088,
  MIN_WAGE: 900,
  MAX_WAGE: 900_000,

  /** Wage swing between ambition 0 and 100. The ambitious want paying like it. */
  AMBITION_SWING: 0.26,
  /** Wage swing between reputation 0 and 100. */
  REPUTATION_SWING: 0.2,
  /** Young players with a big ceiling already price it in. */
  POTENTIAL_SWING: 0.18,
  /** Peak earning window — wages lag ability on the way up and lead it on the way down. */
  PEAK_EARNING_AGE: 27,
  AGE_SWING_PER_YEAR: 0.018,
  AGE_SWING_CAP: 0.22,

  /** Joining a prestigious club is worth taking less; a small club must overpay. */
  CLUB_PRESTIGE_DISCOUNT: 0.1,
  CLUB_OBSCURITY_PREMIUM: 0.2,

  /** How much a role below what he thinks he deserves inflates the wage he asks for. */
  ROLE_INSULT_PREMIUM: 0.22,
  /** Longer deals cost slightly more per week — he is pricing in the risk. */
  LENGTH_PREMIUM_PER_YEAR: 0.02,

  /** Renewal: performing this far above his current wage percentile triggers a demand. */
  RENEWAL_TRIGGER_RATIO: 1.22,
  /** Morale lost when a justified renewal demand is refused. */
  RENEWAL_REFUSAL_MORALE: 9,
  /** Loyalty lost on a second refusal — this is what eventually loses you the player. */
  RENEWAL_REFUSAL_LOYALTY: 6,
  /** Morale gained when a renewal is agreed above his demand. */
  RENEWAL_GENEROSITY_MORALE: 7,

  /** Standard bonus sizes, expressed as a share of weekly wage. */
  APPEARANCE_BONUS_SHARE: 0.12,
  GOAL_BONUS_SHARE: 0.35,
  CLEAN_SHEET_BONUS_SHARE: 0.22,
  SEASON_PERFORMANCE_BONUS_SHARE: 6,
  TROPHY_BONUS_SHARE: 12,
  /** Signing bonus as a multiple of weekly wage, before agent haggling. */
  SIGNING_BONUS_WEEKS: 8,
} as const;

export const NEGOTIATION_BALANCE = {
  /** Cycles a negotiation may run before it lapses on its own. */
  DEFAULT_DEADLINE_CYCLES: 6,
  /** Starting patience for each side, 0-100. */
  CLUB_START_PATIENCE: 100,
  PLAYER_START_PATIENCE: 100,

  /** Patience burned by an offer this far below the demand (per 10% shortfall). */
  CLUB_PATIENCE_PER_10_PERCENT_SHORT: 16,
  PLAYER_PATIENCE_PER_10_PERCENT_SHORT: 14,
  /** Patience burned simply by another round of talks. Time is a cost. */
  PATIENCE_PER_ROUND: 6,
  /** Below this, the counterparty walks. */
  PATIENCE_COLLAPSE: 0,

  /** Accept immediately at or above this share of the asking price. */
  CLUB_ACCEPT_RATIO: 0.98,
  /** Consider (counter rather than reject) at or above this share. */
  CLUB_CONSIDER_RATIO: 0.72,
  /** Below this, the offer is treated as an insult and costs double patience. */
  CLUB_INSULT_RATIO: 0.55,
  INSULT_PATIENCE_MULTIPLIER: 2,

  /** The player's own thresholds, measured against his demanded package value. */
  PLAYER_ACCEPT_SCORE: 0.62,
  PLAYER_CONSIDER_SCORE: 0.4,

  /** Weights inside the player's willingness score. They must sum to 1. */
  WILLINGNESS_WEIGHTS: {
    wage: 0.34, role: 0.22, clubReputation: 0.18, leaguePosition: 0.1,
    charisma: 0.08, ambitionFit: 0.08,
  } as Readonly<Record<string, number>>,

  /** A club's counter moves this far toward the offer each round — it never caves at once. */
  CLUB_CONCESSION_RATE: 0.35,
  PLAYER_CONCESSION_RATE: 0.28,

  /** Agent takes this share of the fee (or of first-year wages for a free transfer). */
  AGENT_FEE_SHARE: 0.06,
  AGENT_FEE_MIN: 25_000,
  /** How much a greedy agent inflates his cut when rivals are circling. */
  AGENT_RIVAL_GREED: 0.5,

  /**
   * Hijack risk, expressed as the total probability of losing the player to a
   * rival across a whole negotiation rather than per round.
   *
   * The old model had no term for the offer, so overpaying bought nothing and
   * roughly half of all negotiations — the modal outcome of the entire transfer
   * system — were decided by a roll the player could not influence. Target
   * shape: 15-25% of a well-run, well-funded negotiation lost to a rival,
   * falling sharply as the offer strengthens and rising with dithering and with
   * the number of clubs in the room.
   */
  /** Risk with no rivals at all — the agent shopping you around on his own. */
  HIJACK_BASE_RISK: 0.1,
  /** Added risk per rival club actually in the room (capped at three). */
  HIJACK_RISK_PER_SUITOR: 0.09,
  /**
   * Risk scales as (fee / asking price) ^ this. Negative and steep: 150% of the
   * asking price cuts risk to ~40% of par, 200% to ~20%. This is the term whose
   * absence made the whole mechanic a dice roll.
   */
  HIJACK_OFFER_EXPONENT: -2.2,
  /** Clamp on the offer ratio so a derisory or absurd bid cannot break the curve. */
  HIJACK_OFFER_FLOOR: 0.4,
  HIJACK_OFFER_CEILING: 2.5,
  /** Share of hijack risk a maximally charismatic manager talks away. */
  HIJACK_CHARISMA_RELIEF: 0.35,
  /** Share of hijack risk removed by a player who already wants the move. */
  HIJACK_PLAYER_WILL_RELIEF: 0.3,
  /**
   * How fast the cumulative risk curve approaches its total. Higher means the
   * damage lands early; at 0.55 roughly two thirds of the total risk is spent
   * by the third round of talks, so dithering is expensive but not instant.
   */
  HIJACK_PACE: 0.55,
  /** A hijacker bids this much above your standing offer. */
  HIJACK_BID_PREMIUM: 0.12,

  /** Per-round chance the player simply loses interest once patience is low. */
  LOSE_INTEREST_PATIENCE_THRESHOLD: 40,
  LOSE_INTEREST_CHANCE: 0.22,

  /** Chance the counterparty stalls for a cycle instead of answering. Deadlines bite. */
  DELAY_CHANCE: 0.12,
  /** Loyalty above which a player refuses to even discuss leaving mid-contract. */
  LOYALTY_REFUSAL_THRESHOLD: 82,
} as const;

export const MARKET_BALANCE = {
  /** Share of the league's out-of-favour players that surface as listings each refresh. */
  LISTING_RATE: 0.09,
  /** Squad size above which AI clubs start listing fringe players. */
  SQUAD_COMFORT_SIZE: 20,
  /**
   * Squad size above which a club will listen on anyone outside its best
   * `DEPTH_PROTECTED` players. A twenty-man squad with eleven starters has
   * assets it is not using, and refusing to model that is what left the market
   * stocked exclusively with players nobody wanted.
   */
  DEPTH_SQUAD_SIZE: 16,
  DEPTH_PROTECTED: 12,
  /**
   * The window's promise.
   *
   * An open window must reliably put a few genuinely tempting, affordable
   * upgrades in front of the player, or the one strategic decision of the
   * between-match loop resolves to "there is nothing to buy". This is a floor
   * on *visibility*, not a cheat: it only reveals players their clubs were
   * already willing to sell, at their real asking price. If nothing eligible is
   * affordable, nothing appears.
   */
  WINDOW_MIN_UPGRADES: 4,
  /** How far above the weakest starter a listing must be to count as an upgrade. */
  UPGRADE_MARGIN: 2,
  /** A player under this share of his role's promised minutes is listable. */
  NEGLECTED_MINUTES_RATIO: 0.5,
  /** Free agents generated per refresh when the pool is thin. */
  FREE_AGENT_POOL_TARGET: 6,
  /** Rumours generated per refresh. Noise, but grounded in real interest. */
  RUMOURS_PER_REFRESH: 3,
  RUMOUR_MIN_CREDIBILITY: 0.15,
  /** Cycles a rumour survives before it is dropped from the feed. */
  RUMOUR_LIFETIME_CYCLES: 4,
  /** Value drift applied each refresh toward the freshly computed valuation. */
  VALUE_DRIFT_RATE: 0.35,
  /** Interest a listing attracts per point of overall above league average. */
  INTEREST_PER_OVERALL_POINT: 0.08,
  MAX_INTERESTED_CLUBS: 5,
} as const;

export const SCOUTING_BALANCE = {
  /** Widest band shown at zero confidence, in attribute points either side. */
  MAX_BAND: 18,
  /** Curve on the band: >1 means early scouting pays off fast, then tapers. */
  BAND_NARROWING_EXPONENT: 1.6,
  /** Confidence at which a band collapses to the exact value. */
  EXACT_CONFIDENCE: 0.995,

  /** Cycles each depth of report takes at scouting facility level 0. */
  DEPTH_CYCLES: { BASIC: 1, DETAILED: 3, DEEP: 6 } as Readonly<Record<string, number>>,
  /** Confidence delivered by each depth, before facility accuracy. */
  DEPTH_CONFIDENCE: { BASIC: 0.3, DETAILED: 0.6, DEEP: 0.95 } as Readonly<Record<string, number>>,
  /** Cash cost per depth. Deep knowledge is a genuine investment. */
  DEPTH_COST: { BASIC: 12_000, DETAILED: 45_000, DEEP: 140_000 } as Readonly<Record<string, number>>,
  /** Attributes revealed exactly per depth, on top of the narrowed band. */
  DEPTH_REVEALS: { BASIC: 2, DETAILED: 5, DEEP: 12 } as Readonly<Record<string, number>>,

  /** Simultaneous assignments at facility level 0, and per extra facility level. */
  BASE_CAPACITY: 2,
  CAPACITY_PER_SCOUT_SPEED: 3,
  /** Manager scouting attribute contribution to confidence gained. */
  MANAGER_SCOUTING_SWING: 0.3,
  /** Confidence decays slowly: a two-season-old report is not current. */
  CONFIDENCE_DECAY_PER_CYCLE: 0.004,
} as const;
