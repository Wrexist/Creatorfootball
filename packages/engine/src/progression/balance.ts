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

  /** Legacy: appearances before a player can be considered for legend status. */
  legendAppearances: 60,
  legendGoalContributions: 40,
  /** Milestones retained. */
  maxMilestones: 120,
} as const;
