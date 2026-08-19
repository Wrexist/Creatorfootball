/**
 * Every number a designer would ever want to move lives here.
 *
 * The rule for this file: if a constant appears inline anywhere else in
 * `matches/`, that is a bug. Each entry documents what it controls and the
 * range within which the simulation still produces football. Values outside the
 * stated range are not forbidden — they are how you build a joke mode — but
 * they will fail the aggregate realism test.
 *
 * Calibrated against the 30-minute, seven-a-side default format:
 * total goals 4.5-6.5, shots 8-14 per team, conversion 12-20%, possession
 * inside 35-65%, 1-3 yellows, <0.12 reds, <0.15 injuries per match.
 */
export const BALANCE = {
  // ---------------------------------------------------------------- clock ---
  /** Simulation ticks per match minute. 10 = one tick per six seconds. 6-20. */
  TICKS_PER_MINUTE: 10,
  /** Ticks the clock stops for after a goal, for the restart. 2-8. */
  GOAL_RESTART_TICKS: 4,
  /** Ticks lost to an injury stoppage. 3-12. */
  INJURY_STOPPAGE_TICKS: 6,
  /** Ticks lost to a substitution. 1-4. */
  SUB_STOPPAGE_TICKS: 2,
  /** Ticks lost to a card being shown. 1-4. */
  CARD_STOPPAGE_TICKS: 2,
  /** Added time per half, in ticks, per stoppage-worthy event. 2-6. */
  ADDED_TICKS_PER_STOPPAGE: 3,
  /** Hard cap on added time per half, in match minutes. 1-6. */
  MAX_ADDED_MINUTES: 3,
  /** How often team-level aggregates are rebuilt, in ticks. Higher is faster,
   *  lower tracks fatigue more tightly. 1-20. */
  AGGREGATE_REFRESH_TICKS: 10,

  // ------------------------------------------------------------ possession ---
  /** Zone (0 own goal, 1 opponent goal) a possession restarts from after a turnover. */
  RESTART_ZONE: 0.3,
  /** Zone at or above which the attacking team is in the final third. 0.6-0.8. */
  FINAL_THIRD_ZONE: 0.68,
  /** Mean zone gained by a successful progression tick. 0.06-0.2. */
  PROGRESSION_STEP: 0.13,
  /** Zone lost when a progression attempt is forced backwards. 0.02-0.12. */
  RECYCLE_STEP: 0.06,
  /** Base per-tick probability that a progression attempt succeeds at parity. 0.4-0.8. */
  PROGRESSION_BASE: 0.62,
  /** How strongly the attack/defence rating gap swings progression. 0.02-0.12. */
  PROGRESSION_EDGE: 0.055,
  /** Base per-tick turnover probability at parity outside the final third. 0.1-0.3. */
  TURNOVER_BASE: 0.155,
  /** Extra turnover probability at maximum press. 0.02-0.15. */
  TURNOVER_PRESS: 0.075,
  /** Turnover probability multiplier once inside the final third. 1.0-2.0. */
  TURNOVER_FINAL_THIRD: 1.45,
  /** How strongly the rating gap swings turnovers. 0.02-0.12. */
  TURNOVER_EDGE: 0.05,
  /** Share of turnovers recorded as a tackle rather than an interception. 0.3-0.7. */
  TACKLE_SHARE: 0.45,
  /** Ticks of elevated counter threat after winning the ball high. 2-10. */
  COUNTER_WINDOW_TICKS: 4,
  /** Zone bonus granted when a turnover happens in the opponent's half. 0-0.35. */
  COUNTER_ZONE_BONUS: 0.22,

  // ---------------------------------------------------------------- shots ---
  /** Base per-tick shot probability in the final third at parity. 0.2-0.5. */
  SHOT_BASE: 0.335,
  /** How much `attackVolume` scales shot frequency. 0.3-1.2. */
  SHOT_VOLUME_WEIGHT: 0.85,
  /** How much a counter-attack window raises shot frequency. 0-0.5. */
  SHOT_COUNTER_BONUS: 0.22,
  /** Share of final-third possessions that end in a cross rather than a shot. 0.05-0.3. */
  CROSS_RATE: 0.14,
  /** Chance a blocked or saved shot produces a corner. 0.2-0.6. */
  CORNER_FROM_BLOCK: 0.38,
  /** Chance a corner produces an immediate shot. 0.2-0.6. */
  CORNER_SHOT_CHANCE: 0.42,
  /** Chance a final-third free kick is taken directly at goal. 0.1-0.5. */
  FREE_KICK_SHOT_CHANCE: 0.3,
  /** Chance an attack is flagged offside per final-third tick. 0-0.06. */
  OFFSIDE_RATE: 0.016,
  /** How much a high defensive line raises the offside rate. 0-1.5. */
  OFFSIDE_LINE_WEIGHT: 0.9,

  // ------------------------------------------------------------------- xG ---
  /** xG of a shot from the centre of the six-yard box with no pressure. 0.5-0.95. */
  XG_MAX: 0.78,
  /** xG floor for a hopeful effort. 0.01-0.06. */
  XG_MIN: 0.022,
  /** Decay constant for distance: xG falls off as exp(-DIST_DECAY * distance). 2-7. */
  XG_DIST_DECAY: 4.1,
  /** Extra penalty for shooting from a tight angle. 0.3-1.5. */
  XG_ANGLE_PENALTY: 0.85,
  /** Multiplier range from defensive pressure: 1 = free header, this = crowded out. 0.35-0.8. */
  XG_PRESSURE_FLOOR: 0.52,
  /** How much the shooter's finishing (vs. a 55 baseline) scales xG. 0.2-0.9. */
  XG_FINISHING_WEIGHT: 0.55,
  /** How much assist quality scales xG. 0.1-0.6. */
  XG_ASSIST_WEIGHT: 0.3,
  /** How much the keeper's quality (vs. a 55 baseline) suppresses xG. 0.1-0.6. */
  XG_KEEPER_WEIGHT: 0.28,
  /** Multiplier applied to xG when the shot arrives on the counter. 1.0-1.6. */
  XG_COUNTER_BONUS: 1.18,
  /** Multiplier applied to xG for a headed chance from a cross. 0.5-1.0. */
  XG_HEADER_FACTOR: 0.78,
  /** xG assigned to a penalty. 0.7-0.85. */
  XG_PENALTY: 0.78,
  /** xG threshold above which a chance is a "big chance". 0.2-0.45. */
  BIG_CHANCE_XG: 0.3,
  /** Global conversion trim. The single knob for "the league scores too much". 0.6-1.4. */
  CONVERSION_SCALE: 1.0,

  // ------------------------------------------------------- shot resolution ---
  /** Of shots that do not score, the share the keeper saves at parity. 0.25-0.5. */
  SAVE_SHARE: 0.4,
  /** Of shots that do not score, the share blocked by a defender. 0.1-0.35. */
  BLOCK_SHARE: 0.2,
  /** Of shots that do not score, the share that hits the frame. 0.02-0.12. */
  POST_SHARE: 0.055,
  /** How much keeper quality shifts save share away from off-target misses. 0-0.3. */
  SAVE_KEEPER_WEIGHT: 0.16,

  // ------------------------------------------------------------ set pieces ---
  /** Base per-tick foul probability by the defending team at parity. 0.02-0.06. */
  FOUL_BASE: 0.031,
  /** How much pressing raises the foul rate. 0-1.2. */
  FOUL_PRESS_WEIGHT: 0.55,
  /** How much a full-intensity rivalry raises the foul rate. 0-0.8. */
  FOUL_RIVALRY_WEIGHT: 0.3,
  /** Probability a foul inside the box becomes a penalty. 0.2-0.7. */
  PENALTY_FROM_BOX_FOUL: 0.45,
  /** Zone above which a foul may be a penalty. 0.85-0.96. */
  PENALTY_ZONE: 0.9,

  // ---------------------------------------------------------------- cards ---
  /** Probability a foul is punished with a yellow at neutral discipline. 0.08-0.25. */
  YELLOW_FROM_FOUL: 0.132,
  /** Probability a foul is a straight red at neutral discipline. 0-0.01. */
  RED_FROM_FOUL: 0.0022,
  /** How much a full-intensity rivalry raises card rates. 0-1.0. */
  CARD_RIVALRY_WEIGHT: 0.45,
  /** How much low player discipline (0 = terrible) raises card rates. 0-1.0. */
  CARD_DISCIPLINE_WEIGHT: 0.55,
  /** How much manager discipline suppresses card rates. 0-0.5. */
  CARD_MANAGER_WEIGHT: 0.28,
  /** Multiplier on card probability for a foul that stopped a clear chance. 1-4. */
  CARD_TACTICAL_FOUL: 2.1,

  // ------------------------------------------------------------- injuries ---
  /** Per-tick, per-team injury probability at neutral load. 0.00005-0.0006. */
  INJURY_BASE: 0.000195,
  /** How much fatigue multiplies injury risk (at fatigue 1.0). 0-3. */
  INJURY_FATIGUE_WEIGHT: 1.6,
  /** How much a physical tactical setup multiplies injury risk. 0-1. */
  INJURY_INTENSITY_WEIGHT: 0.45,
  /** Severity weights: knock, minor, moderate, serious, season. Must sum > 0. */
  INJURY_SEVERITY_WEIGHTS: [46, 27, 17, 8, 2] as const,
  /** Weeks out per severity band, [min, max]. */
  INJURY_WEEKS: [[0, 0], [1, 2], [3, 5], [6, 12], [16, 30]] as const,
  /** Effective-capacity multiplier for a player forced to stay on injured. 0.4-0.85. */
  INJURED_CAPACITY: 0.62,

  // ---------------------------------------------------------------- fatigue ---
  /** Fatigue accrued per tick by a 50-stamina player at neutral tactics. 0.0006-0.002. */
  FATIGUE_PER_TICK: 0.00118,
  /** How much stamina (vs. 55 baseline) reduces the drain. 0.2-1.0. */
  FATIGUE_STAMINA_WEIGHT: 0.6,
  /** Extra drain for the team without the ball, chasing it. 0-0.6. */
  FATIGUE_OUT_OF_POSSESSION: 0.25,
  /** Effective-attribute loss at fatigue 1.0. 0.15-0.45. */
  FATIGUE_ATTR_PENALTY: 0.3,
  /** Fatigue a substitute starts on relative to a starter. 0-0.15. */
  SUB_START_FATIGUE: 0.03,
  /** Fatigue above which the AI starts wanting to substitute. 0.3-0.8. */
  SUB_FATIGUE_THRESHOLD: 0.46,
  /** Earliest match fraction at which the AI will make a routine substitution. 0.3-0.8. */
  SUB_EARLIEST_FRACTION: 0.45,

  // -------------------------------------------------- effective attributes ---
  /** Weight of match fitness (0-100) on effective attributes. 0.05-0.3. */
  FITNESS_WEIGHT: 0.16,
  /** Weight of rolling form (-1..1) on effective attributes. 0.02-0.15. */
  FORM_WEIGHT: 0.06,
  /** Weight of confidence (0-100, 50 neutral) on effective attributes. 0.02-0.15. */
  CONFIDENCE_WEIGHT: 0.07,
  /** Weight of crowd atmosphere on composure-linked attributes. 0.02-0.15. */
  ATMOSPHERE_WEIGHT: 0.06,
  /** Weight of pressure handling in big matches. 0.02-0.2. */
  PRESSURE_WEIGHT: 0.09,
  /** Floor for the position-familiarity multiplier so a bad slot is a cost, not a death sentence. 0.3-0.7. */
  FAMILIARITY_FLOOR: 0.45,

  // -------------------------------------------------------------- momentum ---
  /** Ticks in the rolling window that momentum summarises. 30-120. */
  MOMENTUM_WINDOW_TICKS: 60,
  /** Per-tick pull of the momentum signal toward its target. 0.02-0.2. */
  MOMENTUM_RESPONSE: 0.07,
  /** Per-tick pull back toward zero when nothing is happening. 0.005-0.05. */
  MOMENTUM_DECAY: 0.016,
  /** Weight of recent xG difference in the momentum target. 0-2. */
  MOMENTUM_XG_WEIGHT: 1.15,
  /** Weight of recent possession share in the momentum target. 0-1. */
  MOMENTUM_POSSESSION_WEIGHT: 0.55,
  /** Weight of recent discrete events (goals, cards, big chances). 0-1.5. */
  MOMENTUM_EVENT_WEIGHT: 0.8,
  /** Momentum shift required to emit a MOMENTUM_SHIFT event. 0.2-0.6. */
  MOMENTUM_SHIFT_THRESHOLD: 0.34,
  /**
   * HARD CAP on what momentum is allowed to do to outcomes. Momentum multiplies
   * chance creation and duel odds by at most (1 +/- this). It is a summary of
   * what has happened, not a hand on the scale — keep it small. 0-0.1.
   */
  MOMENTUM_MAX_EFFECT: 0.06,

  // ------------------------------------------------------------ atmosphere ---
  /** Home advantage at full strength, as a multiplier on chance creation. 0-0.15. */
  HOME_ADVANTAGE_MAX: 0.075,
  /** Attendance (as a fraction of a 20k reference) contribution to atmosphere. 0-1. */
  ATTENDANCE_REFERENCE: 20000,
  /** How much rivalry intensity raises match volatility. 0-0.5. */
  RIVALRY_VOLATILITY: 0.22,
  /** How much importance (1-5) raises the pressure term. 0-0.3. */
  IMPORTANCE_PRESSURE: 0.14,

  // --------------------------------------------------------------- manager ---
  /** Weight of the manager's motivation bonus on the half-time reset. 0-0.3. */
  MANAGER_MOTIVATION_WEIGHT: 0.12,
  /** Weight of the manager's adaptability on live-decision effect size. 0-0.6. */
  MANAGER_ADAPTABILITY_WEIGHT: 0.35,

  // ------------------------------------------------------------- decisions ---
  /** Minimum match minutes between two decision prompts. Contract minimum is 6. */
  DECISION_COOLDOWN_MINUTES: 6,
  /** Earliest minute a prompt may fire, as a fraction of match length. 0-0.3. */
  DECISION_EARLIEST_FRACTION: 0.12,
  /** Latest minute a prompt may fire, as a fraction of match length. 0.7-1.0. */
  DECISION_LATEST_FRACTION: 0.93,
  /** Window in minutes either side of a decision used to judge whether it worked. 4-12. */
  DECISION_EVAL_WINDOW: 8,
  /** Net xG-per-minute swing that counts as the decision having worked. 0.005-0.05. */
  DECISION_WORKED_THRESHOLD: 0.014,
  /** Seconds the UI gives the player before auto-applying the default option. */
  DECISION_TIMEOUT_SECONDS: 15,

  // ---------------------------------------------------------- special rules ---
  /** Probability per eligible rule that a scheduled rule actually fires. 0.3-1. */
  SPECIAL_RULE_FIRE_CHANCE: 0.85,
  /** Minimum match minutes between two special rule windows. 2-10. */
  SPECIAL_RULE_GAP_MINUTES: 4,

  // -------------------------------------------------------- creator moments ---
  /** Per-tick probability of a creator moment at creatorPresence = 1. 0-0.01. */
  CREATOR_MOMENT_RATE: 0.0016,
  /** Momentum swing a creator moment produces. 0.05-0.4. */
  CREATOR_MOMENT_MOMENTUM: 0.2,
  /** Chance-creation multiplier the crowd lift gives, and how long it lasts (ticks). */
  CREATOR_MOMENT_BOOST: 0.08,
  CREATOR_MOMENT_TICKS: 25,
  /** Minimum match minutes between creator moments. 4-15. */
  CREATOR_MOMENT_GAP_MINUTES: 7,

  // --------------------------------------------------------------- ratings ---
  /** Every player starts here and earns or loses from it. 5.5-6.5. */
  RATING_BASE: 6.0,
  RATING_GOAL: 1.15,
  RATING_ASSIST: 0.72,
  RATING_KEY_PASS: 0.16,
  RATING_SHOT_ON_TARGET: 0.1,
  RATING_BIG_CHANCE_MISSED: -0.42,
  RATING_TACKLE: 0.11,
  RATING_INTERCEPTION: 0.1,
  RATING_DUEL_WON: 0.045,
  RATING_DUEL_LOST: -0.035,
  RATING_SAVE: 0.24,
  RATING_GOAL_CONCEDED_GK: -0.32,
  RATING_GOAL_CONCEDED_DEF: -0.15,
  RATING_CLEAN_SHEET_GK: 0.75,
  RATING_CLEAN_SHEET_DEF: 0.45,
  RATING_YELLOW: -0.28,
  RATING_RED: -1.6,
  RATING_PASS_ACCURACY_SWING: 0.7,
  /** Ratings are scaled toward the base for players with few minutes. */
  RATING_MINUTES_REFERENCE: 20,
  RATING_MIN: 1.0,
  RATING_MAX: 10.0,
  /** Extra weight given to the winning side when picking man of the match. 0-0.5. */
  MOTM_WINNER_BONUS: 0.22,
} as const;

export type BalanceKey = keyof typeof BALANCE;
