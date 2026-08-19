/**
 * Facility tuning.
 *
 * Deliberately thin: the *numbers* for what a facility does at each level live
 * in the content pack (`FacilityDef.effects`), never here and never in logic.
 * These constants only govern the meta-rules of building — how long, how much
 * it hurts to run, and what happens when you cannot pay for what you built.
 */
export const FACILITY_BALANCE = {
  /** Reserved prefixes stored inside `club.facilityLevels`. */
  PROJECT_CYCLES_PREFIX: '__build:',
  PROJECT_TARGET_PREFIX: '__buildTo:',

  /** Multiplier on the content pack's stated upgrade cycles. Global build-speed dial. */
  BUILD_SPEED: 1,
  /** Cycles an upgrade takes if the content pack does not state one. */
  DEFAULT_UPGRADE_CYCLES: 3,
  /** Upkeep per cycle if the content pack does not state one, as a share of build cost. */
  DEFAULT_UPKEEP_RATIO: 0.004,

  /** Only this many projects may run at once. Money is not the only constraint. */
  MAX_CONCURRENT_PROJECTS: 2,

  /** Skipping upkeep degrades a facility this often — deferred maintenance is real debt. */
  DECAY_CHANCE_WHEN_UNPAID: 0.25,
  /** Sentiment hit when a facility visibly degrades. */
  DECAY_SENTIMENT_PENALTY: 4,

  /** Cost multiplier for rushing a build to completion immediately. */
  RUSH_COST_MULTIPLIER: 2.2,
} as const;
