/**
 * Churn tuning.
 *
 * The engine cannot see wall-clock gaps between sessions, so the caller supplies
 * the observations and this module owns the thresholds — keeping the definition
 * of "at risk" in one place rather than scattered across product surfaces.
 */
export const CHURN_BALANCE = {
  /** Cycles of no progress that counts as stalling. */
  stalledCycles: 3,
  /** Consecutive defeats that historically precede a lapse. */
  losingStreak: 4,
  /** Fan sentiment at or below which the save stops being fun. */
  sentimentCollapse: 25,
  /** Onboarding steps completed below which a drop is "early". */
  earlyOnboardingStep: 3,
} as const;
