/**
 * Every number a designer would ever want to move lives here.
 *
 * The rule for this file: if a constant appears inline anywhere else in
 * `matches/`, that is a bug. Each entry documents what it controls and the
 * range within which the simulation still produces football.
 *
 * Calibrated against `docs/SIMULATION_REFERENCE_DATA.md` for the 30-minute
 * short format (GK + 6 outfield), which supersedes the provisional bands in the
 * integration contract:
 *
 *   goals/match (blended)        6.0 - 9.0, target ~7.0
 *   goals/minute                 0.20 - 0.30
 *   normal-play goal rate        0.16 - 0.18 /min; rule-window 2-4x that
 *   shots/match (both teams)     24 - 40
 *   conversion                   18 - 28%
 *   ball in play                 ~90% of clock (boards keep it alive)
 *   yellows                      0.5 - 2.0 /match; reds 0.01 - 0.06
 *   injuries                     0.08 - 0.14 per team per match
 *   home advantage               ZERO by default (single neutral venue)
 *   heavy-mismatch favourite     75 - 85%, never above 90%
 *
 * The single most important constant in the whole engine is the goals-per-minute
 * multiplier against eleven-a-side: roughly 7x. Everything else is downstream.
 */
export const BALANCE = {
  // ---------------------------------------------------------------- clock ---
  /** Simulation ticks per match minute. 10 = one tick per six seconds. 6-20. */
  TICKS_PER_MINUTE: 10,
  /** Ticks the clock stops for after a goal, for the restart. 2-8. */
  GOAL_RESTART_TICKS: 3,
  /** Ticks lost to an injury stoppage. 3-12. */
  INJURY_STOPPAGE_TICKS: 5,
  /** Ticks lost to a substitution. Rolling subs in this format, so it is cheap. 1-4. */
  SUB_STOPPAGE_TICKS: 1,
  /** Ticks lost to a card being shown. 1-4. */
  CARD_STOPPAGE_TICKS: 2,
  /** Share of stoppage time handed back as added time at the end of a half. 0-1. */
  ADDED_TIME_RECOVERY: 0.5,
  /** Hard cap on added time per half, in match minutes. 1-6. */
  MAX_ADDED_MINUTES: 3,
  /** How often team-level aggregates are rebuilt, in ticks. Higher is faster,
   *  lower tracks fatigue more tightly. 1-20. */
  AGGREGATE_REFRESH_TICKS: 10,

  // ------------------------------------------------------------ possession ---
  /** Zone (0 own goal, 1 opponent goal) a possession restarts from after a turnover. */
  RESTART_ZONE: 0.32,
  /** Zone at or above which the attacking team is in the final third. 0.6-0.8. */
  FINAL_THIRD_ZONE: 0.68,
  /** Mean zone gained by a successful progression tick. 0.06-0.25. */
  PROGRESSION_STEP: 0.16,
  /** Zone lost when a progression attempt is forced backwards. 0.02-0.12. */
  RECYCLE_STEP: 0.055,
  /** Base per-tick probability that a progression attempt succeeds at parity. 0.4-0.85. */
  PROGRESSION_BASE: 0.66,
  /** Maximum progression-probability swing the rating gap may produce, in
   *  either direction. The gap enters through a tanh (see RATING_GAP_SOFTNESS),
   *  so this is the value a runaway mismatch converges on. 0.005-0.05. */
  PROGRESSION_EDGE_MAX: 0.0165,
  /** Base per-tick turnover probability at parity outside the final third. 0.1-0.3. */
  TURNOVER_BASE: 0.15,
  /** Extra turnover probability at maximum press. 0.02-0.15. */
  TURNOVER_PRESS: 0.07,
  /** Turnover probability multiplier once inside the final third. 1.0-2.0. */
  TURNOVER_FINAL_THIRD: 1.4,
  /** Maximum turnover-probability swing the rating gap may produce. 0.005-0.05. */
  TURNOVER_EDGE_MAX: 0.0155,
  /**
   * Rating points at which the gap term reaches ~76% of its maximum.
   *
   * The gap used to enter linearly, so a 30-point mismatch was three times a
   * 10-point one at every term at once and the league produced 15-1 results.
   * A tanh keeps small gaps behaving exactly as before and saturates the
   * extremes: quality still tells, it just stops compounding without limit.
   * Lower = a small gap already decides matches; higher = quality tells slowly.
   * 8-30.
   */
  RATING_GAP_SOFTNESS: 17,
  /**
   * How much attacking where the opponent is not helps a team move the ball.
   *
   * Read as the absolute gap between the two sides' `widthBias`: a wide shape
   * against a compact block, or a narrow one against a stretched defence, finds
   * the pitch easier than two teams occupying the same space. This is the
   * rock-paper-scissors term for the width axis. 0-0.08.
   */
  SHAPE_MISMATCH_WEIGHT: 0.035,
  /**
   * Goal margin at which the side in front starts managing the game instead of
   * chasing more. Below this nothing changes. This is game management, not
   * rubber-banding: the trailing side gets NO compensating bonus, it is only
   * the leader who eases off, which is what a real 5-0 looks like at minute 20.
   * 2-5.
   */
  GAME_STATE_EASE_MARGIN: 3,
  /** Shot-rate reduction per goal of margin beyond the threshold. 0-0.2. */
  GAME_STATE_EASE_PER_GOAL: 0.11,
  /** Cap on that reduction, so a leader never stops playing entirely. 0-0.6. */
  GAME_STATE_EASE_MAX: 0.42,
  /**
   * Goals a side can score before it eases off regardless of the margin.
   *
   * The margin term alone does nothing about a 13-13, and a thirty-minute
   * match in which one side has already scored six is not one in which they
   * are still chasing a seventh at the same rate. This is the term that keeps
   * the absurd end of the distribution out of a real fixture list. 4-8.
   */
  GAME_STATE_ROUT_GOALS: 4,
  /** Share of turnovers recorded as a tackle rather than an interception. 0.3-0.7. */
  TACKLE_SHARE: 0.45,
  /** Ticks of elevated counter threat after winning the ball high. 2-10. */
  COUNTER_WINDOW_TICKS: 4,
  /** Zone bonus granted when a turnover happens in the opponent's half. 0-0.35. */
  COUNTER_ZONE_BONUS: 0.22,

  // ---------------------------------------------------------------- shots ---
  /** Base per-tick shot probability in the final third at parity. 0.2-0.5. */
  SHOT_BASE: 0.218,
  /**
   * How much `attackVolume` scales shot frequency.
   *
   * Deliberately below 1: an attacking instruction should buy chances, not
   * multiply them. At 0.85 a league full of aggressive AI shapes scored a goal
   * a game more than two neutral sides did, which is how a 6.4-goal engine
   * produced an 8-goal fixture list. 0.3-1.2.
   */
  SHOT_VOLUME_WEIGHT: 0.7,
  /** How much a counter-attack window raises shot frequency. 0-0.5. */
  SHOT_COUNTER_BONUS: 0.22,
  /**
   * Hard ceiling on the per-tick shot probability AFTER the swing-window and
   * openness multipliers are applied.
   *
   * `shotChance` clamps itself, but the simulator then multiplies the result by
   * the window multiplier and by the match's openness draw, and those two
   * compound: an open match inside a window could reach a shot on every single
   * final-third tick, which is where 20-goal scorelines came from. A side can
   * be relentless; it cannot shoot every six seconds. 0.4-0.8.
   */
  SHOT_CHANCE_CEILING: 0.72,
  /**
   * Hard ceiling on the stacked xG multiplier from the per-match draws
   * (openness x momentum x creator lift). Same compounding problem at the other
   * end of the pipeline. The swing-window multiplier is applied AFTER this, so
   * the ceiling bounds the noise without capping the format. 1.2-2.0.
   */
  XG_MULTIPLIER_CEILING: 1.55,
  /** Share of final-third possessions that end in a cross rather than a shot. 0.05-0.3. */
  CROSS_RATE: 0.15,
  /** How much a wide shape raises the cross rate (and a narrow one lowers it).
   *  Together with XG_AERIAL_WEIGHT this is what WIDE actually buys. 0-1. */
  CROSS_WIDTH_WEIGHT: 0.6,
  /** Chance a blocked or saved shot produces a corner. 0.2-0.6. */
  CORNER_FROM_BLOCK: 0.36,
  /** Chance a corner produces an immediate shot. 0.2-0.6. */
  CORNER_SHOT_CHANCE: 0.4,
  /** Chance a final-third free kick is taken directly at goal. 0.1-0.5. */
  FREE_KICK_SHOT_CHANCE: 0.3,
  /** Chance an attack is flagged offside per final-third tick. 0-0.06. */
  OFFSIDE_RATE: 0.012,
  /** How much a high defensive line raises the offside rate. 0-1.5. */
  OFFSIDE_LINE_WEIGHT: 0.9,

  // --------------------------------------------------- the ball over the top ---
  /**
   * The price of a high line, charged.
   *
   * `spaceBehind` used to have one consumer worth 0.14 offsides a match, which
   * meant a high line and a high press were close to free. These five constants
   * are the counterplay: outside the final third, the team in possession may
   * play a ball in behind the last line, and if it comes off the runner is
   * through on the keeper. The rate scales with the DEFENDING side's
   * `spaceBehind` and with the attacking side's counter-attacking intent and
   * raw pace, so a high line is only expensive against someone equipped to run
   * at it — which is what makes DIRECT passing, `counterWeight`, LOW_BLOCK and
   * the `speedster` trait all mean something at once.
   */
  /** Per-tick chance of a ball over the top at a neutral line, outside the
   *  final third. 0.002-0.02. */
  THROUGH_BALL_BASE: 0.0017,
  /** Multiplier inside a counter window — the moment the space is really
   *  there, right after a turnover. 1-8. */
  THROUGH_BALL_COUNTER_MULT: 4.0,
  /** How sharply `spaceBehind` scales the rate: rate x (space / 0.5) ^ this.
   *  1 = linear, higher = a high line is punished disproportionately. 1-3. */
  THROUGH_BALL_SPACE_EXPONENT: 1.9,
  /** How much the attacking side's pace advantage scales the rate. 0-2. */
  THROUGH_BALL_PACE_WEIGHT: 0.85,
  /** How much the attacking side's `counterWeight` scales the rate. 0-2. */
  THROUGH_BALL_COUNTER_WEIGHT: 0.9,
  /** How much the runner's `counterThreat` trait scales the rate. 0-3. */
  THROUGH_BALL_TRAIT_WEIGHT: 1.6,

  // ------------------------------------------------------------------- xG ---
  /** xG of a shot from the centre of the six-yard box with no pressure. 0.5-0.95. */
  XG_MAX: 0.78,
  /** xG floor for a hopeful effort. 0.01-0.06. */
  XG_MIN: 0.022,
  /** Decay constant for distance: xG falls off as exp(-DIST_DECAY * distance). 2-7. */
  XG_DIST_DECAY: 3.9,
  /** Extra penalty for shooting from a tight angle. 0.3-1.5. */
  XG_ANGLE_PENALTY: 0.8,
  /** Multiplier range from defensive pressure: 1 = free header, this = crowded out. 0.35-0.8. */
  XG_PRESSURE_FLOOR: 0.55,
  /** How much the shooter's finishing (vs. a 55 baseline) scales xG. 0.2-0.9. */
  XG_FINISHING_WEIGHT: 0.26,
  /** How much assist quality scales xG. 0.1-0.6. */
  XG_ASSIST_WEIGHT: 0.3,
  /**
   * How much the keeper's quality (vs. a 55 baseline) suppresses xG. 0.1-0.6.
   *
   * Held close to XG_FINISHING_WEIGHT on purpose. When finishing outweighed
   * goalkeeping by better than two to one, every quality mismatch raised the
   * TOTAL rather than just the margin — the favourite's extra conversion was
   * not offset by the favourite's better keeper — and a league with a
   * twenty-five point spread scored a goal and a half a game more than two
   * even sides did.
   */
  XG_KEEPER_WEIGHT: 0.24,
  /** Multiplier applied to xG when the shot arrives on the counter. 1.0-1.6. */
  XG_COUNTER_BONUS: 1.18,
  /** Multiplier applied to xG for a shot arriving from a ball in behind: this
   *  is a run at the keeper, not a shot through bodies. 1.2-2.0. */
  XG_THROUGH_BALL_BONUS: 1.7,
  /** How much the aerial-quality gap between the two sides scales a headed
   *  chance. This is where the `aerialThreat` trait and the `aerial` team
   *  aggregate are read. 0-1.2. */
  XG_AERIAL_WEIGHT: 0.6,
  /** How much a narrow defensive block is exposed to a delivery from wide.
   *  This is what makes WIDE a genuine answer to NARROW. 0-1. */
  AERIAL_NARROW_EXPOSURE: 0.45,
  // ------------------------------------------------------ trait read sites ---
  /**
   * How hard a trait modifier lands where the model reads it.
   *
   * Traits used to reach the simulation only by sharpening one attribute,
   * which meant a modifier advertised on the card as +14% arrived at the
   * scoreboard as about +4% — measurably nothing. Each weight below is a
   * direct read at the point the trait claims to act, sized so that a squad
   * carrying the trait is distinguishable from one that does not over a
   * thousand paired matches.
   */
  /** How much the shooter's `shotConversion` trait scales xG directly, on top
   *  of the finishing attribute it already sharpens. 0-1.2. */
  TRAIT_SHOT_CONVERSION_WEIGHT: 0.6,
  /** How much the creator's `creativity` trait scales the quality of the pass
   *  that made the chance. 0-1. */
  TRAIT_CREATIVITY_WEIGHT: 0.5,
  /** How much a team's mean `pressResistance` trait suppresses turnovers
   *  against it. 0-0.8. */
  TRAIT_PRESS_RESISTANCE_WEIGHT: 0.45,
  /** How much a team's mean `tackleSuccess`/`duelWin` traits raise the
   *  turnovers it wins. 0-0.8. */
  TRAIT_TACKLE_WEIGHT: 0.4,
  /** How much a team's mean `passAccuracy`/`dribbleSuccess` traits raise its
   *  progression. 0-0.8. */
  TRAIT_PROGRESSION_WEIGHT: 0.35,
  /** How much the keeper's `saveChance` trait moves the save share. 0-0.8. */
  TRAIT_SAVE_WEIGHT: 0.45,
  /**
   * Squad cohesion: the mean of `chemistry` and `teammateMorale` across the
   * starting side, applied once to every aggregate. Both keys had no consumer
   * anywhere in the engine while the profile screen labelled them for the
   * player. A dressing room that works is worth a couple of overall points to
   * the whole team, which is exactly the size this should be. 0-0.3.
   */
  COHESION_WEIGHT: 0.13,

  // ------------------------------------------------------------- xG (cont) ---
  /** Multiplier applied to xG for a headed chance from a cross. 0.5-1.0. */
  XG_HEADER_FACTOR: 0.86,
  /** xG assigned to the format's one-on-one penalty run. 0.6-0.85. */
  XG_PENALTY: 0.72,
  /** Spread of the shot's lateral position off the centre of the goal, before
   *  chance quality narrows it. Higher = more shots from tight angles. 0.1-0.35. */
  SHOT_WIDTH_SPREAD: 0.2,
  /** xG threshold above which a chance is a "big chance". 0.2-0.45. */
  BIG_CHANCE_XG: 0.3,
  /** Global conversion trim. The single knob for "the league scores too much". 0.6-1.4. */
  CONVERSION_SCALE: 0.63,
  /**
   * How much a team's level varies from match to match — the "which version of
   * them turned up" term. Drawn once per team per match and applied to every
   * aggregate. This is the single biggest source of upsets, and the reason a
   * heavy favourite tops out below 90% instead of running away with every
   * fixture.
   *
   * It carries more of the engine's overdispersion than it used to: a
   * TEAM-level draw widens the spread of team goals without correlating the two
   * scorelines, where a MATCH-level draw widens both at once and is therefore
   * what produces a 14-11. Same variance, far less absurdity. 0-0.2.
   */
  TEAM_PERFORMANCE_SIGMA: 0.13,
  /**
   * Per-match openness. Every match draws one shared multiplier on chance
   * creation for BOTH sides. This is what makes goal counts overdispersed
   * relative to Poisson (the dossier's negative-binomial requirement) and what
   * correlates the two scorelines, so 6-5 and 0-1 both happen.
   *
   * It is applied exactly once, to chance creation. It used to be applied to
   * the shot rate AND again to xG, which squared it and produced a tail of
   * twenty-goal fixtures. 0-0.3.
   */
  MATCH_OPENNESS_SIGMA: 0.25,
  /**
   * How much a side's `volatility` widens its own performance draw.
   *
   * `volatility` is written by eleven tactic tables and every live decision and
   * was read by nothing, while the UI showed it to the player as "Swinginess".
   * This is its first real consumer: a bold or reckless setup does not turn up
   * at a predictable level, it turns up at a *less* predictable one. That is a
   * genuine two-way bet — it converts draws into wins and wins into defeats —
   * rather than a bonus. 0-1.5.
   */
  VOLATILITY_PERFORMANCE_WEIGHT: 0.95,
  /**
   * How much `volatility` widens the shot-location distribution inside
   * `buildChance`. A chaotic side takes worse shots and better ones. 0-1.5.
   */
  VOLATILITY_LOCATION_WEIGHT: 0.5,
  /**
   * Mean correction for the widening above.
   *
   * xG is a concave function of how square and how close the shot is, so
   * widening the location distribution lowers its mean *by construction*. Left
   * uncorrected, `volatility` was not variance at all — it was an 11% tax on
   * chance quality wearing variance as a disguise, which is precisely the trap
   * a "swinginess" stat has to avoid. This restores the mean so a volatile side
   * takes better shots and worse ones rather than uniformly worse ones. Tuned
   * by measuring xG-per-shot at RECKLESS against the default. 0-0.5.
   */
  VOLATILITY_XG_COMPENSATION: 0.21,

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
  /** Base per-tick foul probability by the defending team at parity. 0.01-0.06. */
  FOUL_BASE: 0.0235,
  /** How much pressing raises the foul rate. 0-1.2. */
  FOUL_PRESS_WEIGHT: 0.55,
  /** How much a full-intensity rivalry raises the foul rate. 0-0.8. */
  FOUL_RIVALRY_WEIGHT: 0.3,
  /** Probability a foul inside the box becomes a penalty. 0.2-0.7. */
  PENALTY_FROM_BOX_FOUL: 0.45,
  /** Zone above which a foul may be a penalty. 0.85-0.96. */
  PENALTY_ZONE: 0.9,

  // ---------------------------------------------------------------- cards ---
  /** Probability a foul is punished with a yellow at neutral discipline. 0.05-0.25. */
  YELLOW_FROM_FOUL: 0.08,
  /** Probability a foul is a straight red at neutral discipline. 0-0.01. */
  RED_FROM_FOUL: 0.001,
  /** How much a full-intensity rivalry raises card rates. 0-1.0. */
  CARD_RIVALRY_WEIGHT: 0.45,
  /** How much low player discipline (0 = terrible) raises card rates. 0-1.0. */
  CARD_DISCIPLINE_WEIGHT: 0.55,
  /** How much manager discipline suppresses card rates. 0-0.5. */
  CARD_MANAGER_WEIGHT: 0.28,
  /** Multiplier on card probability for a foul that stopped a clear chance. 1-4. */
  CARD_TACTICAL_FOUL: 2.1,

  // ------------------------------------------------------------- injuries ---
  /**
   * Per-tick, per-team injury probability at neutral load. Denominator is
   * TEAM-PITCH-MINUTES, fixed once and used everywhere — mixing player-hours
   * and team-minutes is the classic calibration bug in this class of model.
   * Target 0.08-0.14 injuries per team per match. 0.0001-0.0006.
   */
  INJURY_BASE: 0.00021,
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
  /**
   * Fatigue accrued per tick by a 55-stamina player at neutral tactics.
   *
   * Thirty minutes is a short window for legs to be a price, so this is
   * deliberately steeper than an eleven-a-side equivalent: over a full match a
   * starter loses roughly a third of his freshness at neutral instructions and
   * closer to half at a full press. That gap is what a high press is supposed
   * to be paid for in. 0.0006-0.004.
   */
  FATIGUE_PER_TICK: 0.0019,
  /** How much stamina (vs. 55 baseline) reduces the drain. 0.2-1.0. */
  FATIGUE_STAMINA_WEIGHT: 0.6,
  /**
   * Extra drain for the team without the ball, chasing it — scaled by how far
   * up the pitch that team chases. A low block without the ball is compact and
   * cheap; a high press without the ball is a sprint. Charging both the same
   * made LOW_BLOCK end matches MORE tired than the default, which inverted its
   * advertised benefit. 0-0.6.
   */
  FATIGUE_OUT_OF_POSSESSION: 0.3,
  /** How strongly the chasing team's own aggression scales that extra drain.
   *  0 = every shape chases equally; 1 = only a high press really runs. 0-1.5. */
  FATIGUE_CHASE_AGGRESSION: 1.1,
  /** Effective-attribute loss at fatigue 1.0. 0.15-0.5. */
  FATIGUE_ATTR_PENALTY: 0.42,
  /**
   * How much a pressing side's own accumulated fatigue erodes its press.
   *
   * A press that cannot be sustained is the whole point of pressing: at the end
   * of a match a spent team still standing high wins the ball back far less
   * often than the instruction claims. Without this, `pressRecovery` was a
   * constant for ninety ticks of dead legs. 0-1.
   */
  PRESS_FATIGUE_DECAY: 0.7,
  /** Fatigue a substitute starts on relative to a starter. 0-0.15. */
  SUB_START_FATIGUE: 0.03,
  /** Fatigue above which the AI starts wanting to substitute. 0.3-0.8. */
  SUB_FATIGUE_THRESHOLD: 0.42,
  /** Earliest match fraction at which the AI will make a routine substitution. 0.2-0.8. */
  SUB_EARLIEST_FRACTION: 0.4,
  /**
   * Match fraction at which a TRAILING AI makes its one scripted call.
   * Late enough that the scoreline means something, early enough that there
   * is real match left for the change to act on. 0.5-0.8.
   */
  TRAILING_RESPONSE_FRACTION: 0.65,

  // -------------------------------------------------- effective attributes ---
  /** Weight of match fitness (0-100) on effective attributes. 0.05-0.3. */
  FITNESS_WEIGHT: 0.16,
  /** Weight of rolling form (-1..1) on effective attributes. 0.02-0.15. */
  FORM_WEIGHT: 0.06,
  /** Weight of confidence (0-100, 50 neutral) on effective attributes. 0.02-0.15. */
  CONFIDENCE_WEIGHT: 0.07,
  /**
   * Weight of crowd atmosphere on composure-linked attributes.
   *
   * COUNTS TOWARD THE AUDIENCE CAP. `ctx.atmosphere` is non-zero only when the
   * arena is filled by one side's support, so this is a SECOND application of
   * the same quantity as SUPPORT_ADVANTAGE_MAX and the two must be sized
   * together: reach is the thing a creator signing raises fastest, and an
   * audience effect that outgrows the cap is a pay-to-win boundary rather than
   * a balance miss. `balance.test.ts > keeps the audience modifier under a
   * six-point swing` measures the two channels jointly and is the gate. 0-0.05.
   */
  ATMOSPHERE_WEIGHT: 0.015,
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
  /**
   * There is NO home advantage in this competition: every match is played at
   * the same neutral venue on a shared matchday. This slot is reused as the
   * audience/support modifier — whose fans filled the arena — and is capped so
   * it can never move win probability by more than about six percentage points,
   * the size of the measured real-world home effect.
   *
   * COUNTS TOWARD THE AUDIENCE CAP together with ATMOSPHERE_WEIGHT; see the
   * note there. Neither may be raised without re-measuring the joint swing,
   * and the cap is a product constraint, not a tuning knob. 0-0.04.
   */
  SUPPORT_ADVANTAGE_MAX: 0.01,
  /** Attendance treated as "full house" for the atmosphere term. */
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
  /**
   * Rules are CLOCK-ANCHORED, not random. Every half ends with a guaranteed
   * swing window of this many minutes, announced in advance. Two per match.
   * That is the format's identity: a predictable moment the player can plan
   * for, and two designed re-engagement beats inside a 30-minute session.
   * 2-5.
   */
  SWING_WINDOW_MINUTES: 3,
  /**
   * Shot-rate multiplier inside a swing window (fewer bodies, more space).
   *
   * The realised goal rate inside a window is well below the product of this
   * and the xG multiplier, because the shot term only applies on final-third
   * ticks and possession still has to get there. Tuned against the measured
   * window-to-normal goal ratio, whose documented target is 2-4x. 1.2-2.6.
   */
  SWING_WINDOW_SHOT_MULTIPLIER: 2.8,
  /** xG multiplier inside a swing window. 1.0-1.8. */
  SWING_WINDOW_XG_MULTIPLIER: 1.72,
  /** Vector deltas applied to BOTH teams for the length of any swing window. */
  SWING_WINDOW_MODIFIERS: {
    attackVolume: 0.34,
    defensiveSolidity: -0.24,
    volatility: 0.3,
    fatigueRate: 0.12,
    spaceBehind: 0.12,
  } as Readonly<Record<string, number>>,
  /** Minimum match minutes between a played rule card and the next one. 2-10. */
  SPECIAL_RULE_GAP_MINUTES: 4,

  // -------------------------------------------------------- creator moments ---
  /** Per-tick probability of a creator moment at creatorPresence = 1. 0-0.01. */
  CREATOR_MOMENT_RATE: 0.0018,
  /** Momentum swing a creator moment produces. 0.05-0.4. */
  CREATOR_MOMENT_MOMENTUM: 0.2,
  /** Chance-creation multiplier the crowd lift gives, and how long it lasts (ticks). */
  CREATOR_MOMENT_BOOST: 0.08,
  CREATOR_MOMENT_TICKS: 25,
  /** Minimum match minutes between creator moments. 4-15. */
  CREATOR_MOMENT_GAP_MINUTES: 7,

  // -------------------------------------------------------------- tie-break ---
  /** Shots each side takes in the one-on-one shootout before sudden death. 3-5. */
  SHOOTOUT_ROUNDS: 3,
  /** Base conversion of a shootout run at parity. 0.4-0.75. */
  SHOOTOUT_BASE: 0.58,
  /** How much taker-vs-keeper quality moves shootout conversion. 0.1-0.5. */
  SHOOTOUT_EDGE: 0.3,

  // --------------------------------------------------------------- ratings ---
  /** Every player starts here and earns or loses from it. 5.5-6.5. */
  RATING_BASE: 6.0,
  RATING_GOAL: 1.0,
  RATING_ASSIST: 0.65,
  RATING_KEY_PASS: 0.14,
  RATING_SHOT_ON_TARGET: 0.09,
  RATING_BIG_CHANCE_MISSED: -0.36,
  RATING_TACKLE: 0.11,
  RATING_INTERCEPTION: 0.1,
  RATING_DUEL_WON: 0.045,
  RATING_DUEL_LOST: -0.035,
  RATING_SAVE: 0.22,
  RATING_GOAL_CONCEDED_GK: -0.26,
  RATING_GOAL_CONCEDED_DEF: -0.13,
  RATING_CLEAN_SHEET_GK: 0.9,
  RATING_CLEAN_SHEET_DEF: 0.5,
  RATING_YELLOW: -0.28,
  RATING_RED: -1.6,
  RATING_PASS_ACCURACY_SWING: 0.7,
  /** Ratings are pulled toward the base for players with few minutes. */
  RATING_MINUTES_REFERENCE: 20,
  RATING_MIN: 1.0,
  RATING_MAX: 10.0,
  /** Extra weight given to the winning side when picking man of the match. 0-0.5. */
  MOTM_WINNER_BONUS: 0.22,
} as const;

export type BalanceKey = keyof typeof BALANCE;
