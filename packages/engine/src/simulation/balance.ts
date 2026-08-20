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
  /**
   * The dressing room.
   *
   * These are the read sites for `chemistry`, `teammateMorale` and
   * `moraleResilience` — three trait modifier keys that the player profile
   * screen labelled and that no line of code consumed. They are deliberately
   * sized to be *measurable*: a squad full of Team Players should visibly
   * outperform a squad full of Selfish ones over a season, not by a rounding
   * error.
   */
  chemistry: {
    /** Cohesion of a squad with no chemistry traits at all, 0-1. */
    neutralCohesion: 0.5,
    /** Cohesion moved per point of mean squad `chemistry` modifier. */
    cohesionPerChemistryPoint: 1.6,
    /** Morale a squad settles at with neutral form and neutral cohesion. */
    restingMorale: 58,
    /** Morale points per unit of league-points share above 0.4 (a mid-table pace). */
    moralePerFormShare: 55,
    /** Morale points per unit of cohesion above neutral. */
    moralePerCohesion: 40,
    /** Morale points contributed per unit of summed squad `teammateMorale`. */
    moralePerTeammatePoint: 5,
    /** Share of the gap to the resting point closed each cycle. */
    moraleDriftRate: 0.22,
    /** Form rating (-1..1) a squad drifts toward per unit of cohesion above neutral. */
    formPerCohesion: 0.55,
  },

  /**
   * Rivalries that are born rather than seeded. When the cascade wants to heat
   * up a pairing with no history, this is the temperature it starts at — warm
   * enough to matter, cold enough that a real derby still outranks it.
   */
  rivalries: {
    bornIntensity: 35,
  },
  /** Reputation movement worth telling the press about, in points. */
  reputationNews: {
    minDelta: 0.5,
  },
  /** Cash below which the board starts briefing, and how often it is said. */
  financeNews: {
    lowBalance: 120_000,
    repeatCooldownCycles: 8,
  },
  /** Impressions a creator post needs before it counts as a moment. */
  creatorNews: {
    momentReach: 900_000,
  },
  /** Bids and rejections announced per cycle, so the market has texture without noise. */
  transferNews: {
    maxBidEventsPerCycle: 2,
  },

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

/**
 * How AI clubs react to how their season is going.
 *
 * Twelve seasons produced two champions and a player's club that finished
 * twelfth ten times, because nothing in `aiClub.ts` responded to failure at
 * all. These are the numbers that decide whether a league can change hands.
 */
export const AI_BALANCE = {
  /** Points-per-available share assumed before a season has any matches in it. */
  neutralPointsPace: 0.4,
  /**
   * How heavily failing your own supporters' expectations counts, against
   * failing the expectations your reputation sets. This is the term that lets a
   * small club feel pressure at all — the old formula gave a low-reputation
   * club sitting last a desperation of exactly zero, forever.
   */
  expectationWeight: 1.1,

  /** Desperation at or above which an ageing squad is torn up rather than patched. */
  rebuildDesperation: 0.35,
  /** Mean squad age at or above which the answer is a rebuild, not a signing. */
  rebuildAge: 27.5,
  rebuildSellPressure: 0.3,
  rebuildYouthRate: 0.35,
  rebuildPotentialWeight: 0.4,
  rebuildOverallWeight: 0.3,
  /** Years the target age band shifts down by while rebuilding. */
  rebuildAgeShift: 4,

  /** Desperation at or above which a club will abandon its own tactical identity. */
  changeApproachDesperation: 0.45,
  /** Chance per cycle that it actually does, once it has reached that point. */
  changeApproachChance: 0.25,

  /** Normalised league position at or below which a club counts as cruising. */
  complacencyPosition: 0.2,
  /** Reputation at or above which cruising turns into complacency. */
  complacencyReputation: 70,
  /**
   * Desperation below which a club at the top counts as comfortable. Not zero:
   * a big club's supporters always want more, so a strict reading of
   * "meeting expectations" would mean no champion is ever complacent and the
   * lever that lets a title change hands would never fire.
   */
  complacencyDesperation: 0.2,
  /** What complacency does to spending. A champion that stops investing is how
   *  a title changes hands; without this the strongest club compounds forever. */
  complacencyAggression: 0.6,
  complacencyReinvest: 0.55,
} as const;
