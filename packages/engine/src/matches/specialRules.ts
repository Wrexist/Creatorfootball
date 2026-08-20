import type { Side } from './events';

/**
 * Special rules.
 *
 * Modelled on short-format creator football, where a period of the match runs
 * under a modified rule. They are earned or drafted, never universally on, and
 * every one has a counter. A rule that cannot be played against is a bug.
 */
export const SPECIAL_RULE_IDS = [
  'DOUBLE_GOAL', 'POWER_PLAY', 'LAST_STAND', 'LOCKDOWN', 'ALL_IN',
  'CREATOR_MOMENT', 'NUMBERS_GAME', 'LONG_RANGE', 'CAPTAINS_CALL', 'SUDDEN_SPARK',
] as const;
export type SpecialRuleId = (typeof SPECIAL_RULE_IDS)[number];

export interface SpecialRuleDefinition {
  readonly id: SpecialRuleId;
  readonly name: string;
  /** What it does, in one sentence the player reads on the card. */
  readonly description: string;
  /** Why you might not want it, in one sentence. Always populated. */
  readonly counterplay: string;
  /** Which side it benefits: the holder, both teams, or is decided by the state of play. */
  readonly beneficiary: 'HOLDER' | 'BOTH' | 'TRAILING';
  readonly durationMinutes: number;
  /** Earliest minute it may fire, as a fraction of match length. */
  readonly earliestPhase: number;
  readonly latestPhase: number;
  /** Applied to the beneficiary's TacticVector while active. */
  readonly modifiers: Readonly<Record<string, number>>;
  /** Applied to the opposing side while active — this is the counterplay in numbers. */
  readonly opponentModifiers?: Readonly<Record<string, number>>;
  /** Goals scored while active are multiplied by this. */
  readonly goalMultiplier?: number;
  /**
   * Multiplies this side's shot rate for as long as the rule is live.
   *
   * The vector terms an attacking card would naturally push are all
   * self-limiting in the possession loop — `attackVolume` ends possessions
   * sooner, `chanceQuality` trades shots away through the patience term — which
   * is why the attacking cards measured at zero however large their modifiers
   * were. This is the one lever with a direct, unhedged effect on how often a
   * side gets a shot away, and it is the swing window's own mechanism. Above 1
   * for a card that puts bodies forward. Defaults to 1.
   */
  readonly shotRateScale?: number;
  /**
   * Scales the swing window's shot-rate multiplier while this rule is live.
   *
   * A rule that multiplies the SCOREBOARD has to divide the football, or the
   * window runs at the normal swing rate and then doubles it: a fixture list
   * whose pool contained Double Reward scored a goal and a half a game more
   * than one that did not. Below 1 the window is tighter and every chance
   * carries more; above 1 it is looser. Defaults to 1.
   */
  readonly windowShotScale?: number;
  readonly rarity: 'COMMON' | 'RARE' | 'EPIC';
  readonly accent: string;
}

export interface ActiveSpecialRule {
  readonly ruleId: SpecialRuleId;
  readonly side: Side | 'both';
  readonly startMinute: number;
  readonly endMinute: number;
  /** Why it fired — shown to the player so it never feels arbitrary. */
  readonly reason: string;
}

/** A rule the club holds and may deploy. Earned through objectives and rewards. */
export interface RuleCard {
  readonly ruleId: SpecialRuleId;
  readonly quantity: number;
  readonly acquiredCycle: number;
}
