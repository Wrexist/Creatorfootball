import type { MatchId } from '../core/brand';
import type { Side } from './events';

/**
 * Live decisions.
 *
 * The player influences a match through a small number of high-stakes choices,
 * not constant micromanagement. Each prompt states the situation in one line,
 * offers 2-3 options, and every option is a genuine trade-off — there is never
 * an obviously correct answer.
 */
export interface DecisionOption {
  readonly id: string;
  readonly label: string;
  /** One line of plain language: what this actually does. */
  readonly effect: string;
  /** Applied to the team's TacticVector for `durationMinutes`. */
  readonly modifiers: Readonly<Record<string, number>>;
  readonly durationMinutes: number;
  /** Shown as a subtle risk indicator on the button. */
  readonly risk: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface DecisionPrompt {
  readonly id: string;
  readonly matchId: MatchId;
  readonly minute: number;
  readonly tick: number;
  readonly side: Side;
  /** The trigger, named so the UI can theme the prompt. */
  readonly trigger: DecisionTrigger;
  /** "You're getting pinned back." — one sentence, no jargon. */
  readonly situation: string;
  readonly options: readonly DecisionOption[];
  /** Seconds of real time before the default option auto-applies. 0 = pause indefinitely. */
  readonly timeoutSeconds: number;
  readonly defaultOptionId: string;
}

export const DECISION_TRIGGERS = [
  'UNDER_PRESSURE', 'STRIKER_ISOLATED', 'LOSING_MIDFIELD', 'CHASING_GAME',
  'PROTECTING_LEAD', 'MOMENTUM_SWING', 'KEY_PLAYER_TIRED', 'OPPONENT_SHAPE_CHANGE',
  'INJURY_DECISION', 'CARD_RISK', 'SPECIAL_RULE_CHOICE', 'CREATOR_OPPORTUNITY',
  'HALFTIME_TALK', 'SET_PIECE_CALL',
] as const;
export type DecisionTrigger = (typeof DECISION_TRIGGERS)[number];

export interface DecisionOutcome {
  readonly promptId: string;
  readonly optionId: string;
  readonly minute: number;
  /** Filled in after the match: did this choice measurably help? Drives post-match feedback. */
  readonly evaluation?: {
    readonly xgDelta: number;
    readonly xgAgainstDelta: number;
    readonly verdict: 'WORKED' | 'NEUTRAL' | 'BACKFIRED';
  };
}
