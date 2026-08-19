/**
 * Training and development tuning.
 *
 * The design rule this encodes: a training week must be a *choice*, not a
 * slider. There are seven programs and three intensities — 21 combinations —
 * and every one of them costs something. Growth is bought with fatigue and
 * injury risk; safety is bought with stagnation.
 */
export const TRAINING_BALANCE = {
  /** Attribute points a perfectly-placed player gains per cycle at full rate. */
  GROWTH_BASE: 0.42,

  /** Ages between which development is fastest. */
  PEAK_GROWTH_AGE_START: 16,
  PEAK_GROWTH_AGE_END: 21,
  /** Growth reaches zero here and turns into decline after DECLINE_AGE. */
  GROWTH_ZERO_AGE: 30,
  DECLINE_AGE: 31,
  /** Attribute points lost per cycle per year past DECLINE_AGE. */
  DECLINE_PER_YEAR: 0.035,

  /**
   * Headroom (potential − overall) is the ceiling on growth. The exponent below
   * 1 means a player near his ceiling still creeps forward rather than freezing,
   * which reads far better than a hard stop.
   */
  HEADROOM_REFERENCE: 12,
  HEADROOM_EXPONENT: 0.65,

  /**
   * Minutes are the single biggest development lever. A 19-year-old on the
   * bench must visibly fall behind a 19-year-old who plays — this is the
   * constant that makes squad selection a development decision.
   */
  MINUTES_FLOOR_MULTIPLIER: 0.35,
  MINUTES_FULL_MULTIPLIER: 1.45,
  /** Share of available minutes at which the full multiplier is reached. */
  MINUTES_SATURATION: 0.7,

  /** Swing from professionalism 0 → 100. Attitude compounds over a career. */
  PROFESSIONALISM_SWING: 0.45,
  /** Swing from morale 0 → 100. An unhappy player does not improve. */
  MORALE_SWING: 0.3,
  /** Swing from manager `playerDevelopment` 0 → 100. */
  MANAGER_SWING: 0.5,
  /** Multiplier applied to the facility `trainingGain` effect. */
  FACILITY_WEIGHT: 1,

  /**
   * Every player carries a hidden, id-derived growth character in this range.
   * Two identical prospects on the same program must not produce identical
   * careers — this is what makes scouting and patience meaningful.
   */
  CHARACTER_MIN: 0.72,
  CHARACTER_MAX: 1.34,
  /** Per-cycle random noise on top of the character multiplier. */
  NOISE_MIN: 0.72,
  NOISE_MAX: 1.28,

  /** Intensity: growth, fatigue and injury all move together. Never a free lunch. */
  INTENSITY: {
    LIGHT: { growth: 0.62, fatigue: 0.5, injury: 0.45, morale: 0.6 },
    NORMAL: { growth: 1, fatigue: 1, injury: 1, morale: 0 },
    HARD: { growth: 1.38, fatigue: 1.75, injury: 2.3, morale: -0.9 },
  } as Readonly<Record<string, { growth: number; fatigue: number; injury: number; morale: number }>>,

  /** Base fitness lost per cycle at NORMAL intensity on a standard program. */
  FATIGUE_PER_CYCLE: 7,
  /** Fitness recovered per cycle when not being worked. */
  RECOVERY_PER_CYCLE: 11,
  /** Below this fitness, growth is halved — you cannot train a exhausted player. */
  FITNESS_GROWTH_THRESHOLD: 60,

  /** Base per-cycle training injury chance at NORMAL intensity. */
  INJURY_BASE_CHANCE: 0.012,
  /** Extra injury chance per point of fitness below 50. */
  INJURY_PER_FATIGUE_POINT: 0.0006,
  /** Age multiplier on injury risk, applied per year past 30. */
  INJURY_AGE_PER_YEAR: 0.07,
  /** Weeks out, by severity roll. */
  INJURY_WEEKS: { KNOCK: 1, MINOR: 2, MODERATE: 5, SERIOUS: 12, SEASON: 26 } as Readonly<Record<string, number>>,

  /** Overall gain in one cycle that counts as a breakout worth a news story. */
  BREAKOUT_THRESHOLD: 2,

  /** Individual focus concentrates this share of a player's growth on one attribute. */
  FOCUS_SHARE: 0.5,

  /** Youth program: multiplier applied to players at or under this age, and above it. */
  YOUTH_AGE_LIMIT: 21,
  YOUTH_BONUS: 1.55,
  YOUTH_PENALTY: 0.35,

  /** Potential itself can move: a wonderkid who is coached well raises his ceiling. */
  POTENTIAL_DRIFT_CHANCE: 0.05,
  POTENTIAL_DRIFT_MAX: 1,
  /** Age past which the ceiling only ever falls. */
  POTENTIAL_HARDENS_AGE: 24,
} as const;
