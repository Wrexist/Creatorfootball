/**
 * World-simulation tuning.
 *
 * Everything a designer would want to move lives here. The cascade numbers in
 * particular are the difference between "the world reacted" and "the world
 * overreacted": a red card should sting for two cycles, not sink a season.
 */
export const CASCADE_BALANCE = {
  /** How many generations of knock-on reactions a single event may produce. */
  maxDepth: 3,
  /** Hard cap on reactions per cycle so a chaotic matchday cannot melt the feed. */
  maxNodesPerCycle: 220,
  /** Reaction strength multiplier per generation of depth. */
  depthFalloff: 0.55,

  redCard: {
    suspensionMatches: 1,
    /** Extra match banned when the red came in a high-heat derby. */
    derbySuspensionBonus: 1,
    playerMorale: -14,
    squadMorale: -3,
    fanSentiment: -3.5,
    rivalryIntensity: 5,
    mediaImportance: 4,
  },
  marqueeSigning: {
    /** Fee as a multiple of the club's cycle wage budget that reads as "marquee". */
    feeToWageBudgetRatio: 6,
    fanExcitement: 8,
    fanExpectation: 5,
    fanSentiment: 4,
    reputation: 1.5,
    mediaImportance: 4,
  },
  shockDefeat: {
    /** Goal margin at which a defeat becomes a story rather than a result. */
    marginThreshold: 3,
    /** Reputation gap (opponent below us) that makes any defeat a shock. */
    reputationGap: 12,
    fanSentiment: -6,
    squadMorale: -5,
    managerPressure: 12,
    mediaImportance: 4,
  },
  bigWin: {
    marginThreshold: 3,
    fanSentiment: 5,
    squadMorale: 4,
    managerPressure: -8,
    reputation: 0.8,
  },
  derby: {
    /** Rivalry intensity above which a fixture is treated as a derby. */
    intensityThreshold: 60,
    rivalryWinBump: 3,
    rivalryLossBump: 2,
  },
  breakout: {
    fanExcitement: 6,
    reputation: 0.6,
    mediaImportance: 4,
    /** Cycles after a breakout that rival interest leaks. */
    interestDelayCycles: 1,
  },
  injury: {
    /** Weeks out at which an injury becomes newsworthy. */
    newsworthyWeeks: 4,
    playerMorale: -10,
    fanSentiment: -1.5,
    squadMorale: -1.5,
  },
  managerPressure: {
    /** Pressure above which the press start asking the question. */
    storyThreshold: 45,
    /** Pressure above which the board is briefing against you. */
    crisisThreshold: 72,
    /** Pressure bled off per cycle when nothing bad happens. */
    decayPerCycle: 6,
    /** Winless run length that starts generating pressure on its own. */
    winlessRun: 4,
    winlessPressurePerMatch: 7,
  },
  record: {
    mediaImportance: 5,
    fanSentiment: 3,
  },
  /** Selling a player: what counts as losing someone who mattered. */
  playerSold: {
    /** Fee as a multiple of the seller's cycle wage budget that reads as a big sale. */
    feeToWageBudgetRatio: 5,
    fanSentiment: -4,
    squadMorale: -2,
  },
  motm: {
    playerMorale: 5,
  },
  recovery: {
    playerMorale: 6,
  },
  attendance: {
    /** Fill rate at or above which the ground counts as full. */
    fullThreshold: 0.97,
    /** Fill rate at or below which the empty seats are the story. */
    emptyThreshold: 0.55,
  },
  youthPromotion: {
    fanExcitement: 3,
  },
  sponsorLost: {
    fanSentiment: -3,
  },
} as const;

export const WORLD_BALANCE = {
  /** AI clubs processed per tick. Keeps a 12-club league linear, not quadratic. */
  maxAiTurnsPerCycle: 12,
  /** Squad players examined per club when drifting form and fitness. */
  maxSquadScan: 40,

  form: {
    /** Rolling form decays toward zero when a player is not playing. */
    idleDecay: 0.18,
    /** Random walk applied to form each cycle, scaled by 1 - consistency/100. */
    driftScale: 0.16,
    /** Fitness recovered per cycle of rest. */
    fitnessRecovery: 12,
    /** Fitness lost per cycle of heavy involvement. */
    fitnessDrain: 4,
  },
  injuries: {
    /** Base chance per player per cycle across the league. */
    basePerCycle: 0.012,
    /** Extra risk from low fitness (at 0 fitness). */
    fatigueMultiplier: 2.4,
    /** Extra risk for players over 30. */
    veteranMultiplier: 1.35,
    /** Extra risk for players under 20 (growth-related). */
    youthMultiplier: 1.1,
    severityWeights: { KNOCK: 46, MINOR: 30, MODERATE: 16, SERIOUS: 6, SEASON: 2 } as const,
    weeksBySeverity: { KNOCK: [1, 1], MINOR: [1, 3], MODERATE: [3, 6], SERIOUS: [6, 14], SEASON: [16, 30] } as const,
  },
  development: {
    /** Chance per cycle that a developing player moves an attribute. */
    chancePerCycle: 0.22,
    /** Age at which growth turns to decline. */
    peakAge: 28,
    declineAge: 31,
    /** Maximum attribute step in one cycle. */
    maxStep: 2,
    /** Overall gain in a season that counts as a breakout for a young player. */
    breakoutOverallGain: 5,
    breakoutMaxAge: 21,
  },
  fans: {
    /** Sentiment pulled toward this resting point each cycle. */
    restingSentiment: 55,
    driftRate: 0.06,
    /** Online followers gained per 1000 impressions of positive coverage. */
    followersPerImpression: 0.0022,
    /** Followers lost per 1000 impressions of hostile coverage. */
    followerLossPerImpression: 0.0008,
    /** Expectation creeps up when the club is doing well. */
    expectationDrift: 0.04,
  },
  market: {
    /** Market value drifts toward the form-adjusted valuation each cycle. */
    driftRate: 0.08,
    /** Form's influence on value: ±this fraction at ±1 form. */
    formSwing: 0.18,
    /** Value decay per year of age past the peak. */
    agePenaltyPerYear: 0.05,
  },
  /** Retained tail sizes so a long save does not grow without bound. */
  retention: {
    stories: 90,
    posts: 180,
    eventLog: 600,
    milestones: 120,
  },
} as const;

/**
 * Emergent-story thresholds.
 *
 * These are the lines between "a thing happened" and "a thing worth telling a
 * story about". Set them too low and the feed cries wolf; too high and the
 * payoff never arrives.
 */
export const EMERGENT_BALANCE = {
  derbyStreak: 3,
  cleanSheetRun: 3,
  unbeatenRun: 5,
  winlessRun: 5,
  /** Signings above this multiple of the club's cycle wage budget are "expensive". */
  flopFeeToWageBudget: 4,
  /** Appearances a signing needs before we are entitled to judge it. */
  flopMinAppearances: 5,
  flopMaxRating: 6.4,
  flopMaxGoalContributions: 2,
  /** Overall points gained in a season that constitutes a breakout arc. */
  breakoutGain: 5,
  breakoutMaxAge: 21,
  /** Points separating the top two that counts as a title race. */
  titleRacePoints: 2,
  /** Fraction of the season that must be played before a title race is a story. */
  titleRaceProgress: 0.6,
  /** Cycles before the same emergent story may be told about the same subject again. */
  cooldownCycles: 8,
} as const;
