/**
 * Progression tuning.
 *
 * Objectives are the game's request-line: they tell the player what the world
 * wants from them. Two numbers matter most — how many are live at once (too
 * many and none of them feel important) and how hard they are (a target the
 * table says is impossible reads as a bug, not a challenge).
 */
export const PROGRESSION_BALANCE = {
  /** Live objectives at any one time, season targets excluded. */
  maxActive: 5,
  /** Season targets, which persist for the whole season. */
  maxSeasonTargets: 2,
  /** Minimum importance mix: at least one objective at or above this. */
  headlineImportance: 4,

  /** Difficulty positioning inside the feasible band, by difficulty setting. */
  difficultyBand: { CASUAL: 0.35, STANDARD: 0.55, DEMANDING: 0.75 } as const,
  /** A target must beat current progress by at least this fraction to be offered. */
  minChallengeMargin: 0.15,

  /** Reward scaling with importance. */
  rewardImportanceScale: [0, 0.6, 0.8, 1, 1.35, 1.8] as const,
  /** Reward scaling with how far above the feasible floor the target sits. */
  rewardStretchScale: 0.6,

  /** Estimated win rate floor/ceiling used when sizing match-count targets. */
  winRateFloor: 0.18,
  winRateCeiling: 0.72,

  /**
   * How much a live record has to be beaten by before it is news again.
   *
   * A record is a story when it is *broken*, not when it is nudged. The biggest
   * winning margin improved by one goal seven times in a single season and
   * printed the same headline every time; requiring a real step means the
   * record book still tracks the truth but the press only speak when something
   * actually changed.
   */
  recordMinImprovement: {
    /** Goals the biggest winning margin must be beaten by. */
    BIGGEST_WIN: 3,
  } as Readonly<Record<string, number>>,
  /** Multiple of the standing record signing a new fee must clear. */
  recordSigningStep: 1.25,

  /** Legacy: appearances before a player can be considered for legend status. */
  legendAppearances: 60,
  legendGoalContributions: 40,
  /** Milestones retained. */
  maxMilestones: 120,
} as const;

/**
 * The board.
 *
 * A one-tier league has no relegation destination, so the classic punishment
 * for failure does not exist here — which is why the ladder has to have teeth
 * of its own. Pressure is *derived*, never accumulated: each cycle it is read
 * straight off position-vs-expectation, sentiment and form, so a good month
 * genuinely cools a bad board. The ultimatum numbers are the documented
 * promise to the player: two wins from four, or else.
 */
export const BOARD_BALANCE = {
  /** Pressure points per league place below the reputation-implied position. */
  positionGapPerPlace: 8,
  /** Fan sentiment the board treats as neutral (matches the fans' resting point). */
  sentimentNeutral: 55,
  /** Maximum pressure contribution from sentiment, at sentiment zero. */
  sentimentDeficitWeight: 24,
  /** Extra pressure per net sentiment point lost recently, over this window. */
  sentimentTrendWeight: 0.4,
  sentimentTrendClamp: 12,
  sentimentTrendWindowCycles: 6,
  /** Recent-form window in matches, and its weights. */
  formWindow: 5,
  formLossWeight: 5,
  formWinRelief: 3,

  /** Ladder thresholds on derived pressure, 0-100. */
  thresholds: { RESTLESS: 20, ANGRY: 45, ULTIMATUM: 70 } as const,

  /** The public promise: survive the next N matches with at least M wins. */
  ultimatumWindowCycles: 4,
  ultimatumTargetWins: 2,
  /** Cycles before the board will issue another ultimatum after issuing one. */
  reissueCooldownCycles: 10,

  /** Failing an ultimatum: the wage budget takes this proportional cut... */
  wageBudgetCutFraction: 0.18,
  /** ...but never below this, because squads must stay payable. */
  wageBudgetFloor: 50_000,
  /** Forced sale price as a fraction of market value: listed to move. */
  forcedListingPriceFactor: 0.9,
  /** Satisfaction hit per active sponsor deal, pushing renewal below threshold. */
  sponsorSatisfactionPenalty: 45,
} as const;
