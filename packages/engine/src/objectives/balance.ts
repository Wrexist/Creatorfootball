/**
 * Objective feasibility tuning.
 *
 * Every number here answers the same question: what is the most a club in this
 * situation could reasonably be asked for? They are the difference between a
 * demanding objective and an insulting one.
 */
export const OBJECTIVE_BALANCE = {
  /** Share of the expected wins in the remaining fixtures we may ask for. */
  winTargetHeadroom: 0.85,
  /** League-average goals per match, used to size scoring targets. */
  goalsPerMatch: 2.2,
  /** Share of matches a competent side keeps a clean sheet in. */
  cleanSheetRate: 0.35,
  /** One red card is tolerated per this many matches. */
  matchesPerAllowedRedCard: 6,
  /** How far up and down the table an objective may reach. */
  maxPositionsToClimb: 4,
  maxPositionsToSlip: 2,
  /** Attribute points a squad can plausibly add per remaining match. */
  developmentPerMatch: 0.8,
  /** Follower growth band, as a multiplier on the current audience. */
  followerGrowth: [1.02, 1.25] as const,
  /** Fan-sentiment gain band, in points. */
  sentimentGain: [2, 18] as const,
  sentimentCeiling: 95,
  /** Share of matches producing a man of the match from our squad. */
  motmRate: 0.6,
  /** Balance above which two facility upgrades is a fair ask. */
  twoUpgradesBalance: 2_000_000,
  /** League position at or above which silverware is a legitimate demand. */
  trophyContenderPosition: 3,
} as const;
