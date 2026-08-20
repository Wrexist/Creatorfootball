import type {
  DecisionOption, DecisionTrigger, MatchEvent, MatchEventType, PlayPhase, SpecialRuleId,
} from '@cf/engine';
import type { PillTone } from '@/design';

/**
 * Matchday vocabulary.
 *
 * Every label the player reads during a match is resolved here rather than
 * inline, for one reason: a match throws forty events a minute at the screen
 * and the difference between "legible at a glance" and "a wall of enum names"
 * is entirely in this file. Nothing here derives an outcome — it only names
 * what the simulation already decided.
 */

export const PHASE_LABEL: Record<PlayPhase, string> = {
  BUILD_UP: 'Building',
  PROGRESSION: 'Progressing',
  FINAL_THIRD: 'Final third',
  SHOT: 'Shot',
  TRANSITION: 'Transition',
  PRESS: 'Pressing',
  SET_PIECE: 'Set piece',
  RESTART: 'Restart',
  CELEBRATION: 'Celebration',
  STOPPAGE: 'Stoppage',
};

/**
 * The phase read as a sentence, for the screen reader and for the reduced-
 * motion pitch, where the animation is not carrying the story on its own.
 */
export const PHASE_HINT: Record<PlayPhase, string> = {
  BUILD_UP: 'playing out from the back',
  PROGRESSION: 'moving the ball upfield',
  FINAL_THIRD: 'camped in the final third',
  SHOT: 'shooting',
  TRANSITION: 'breaking at speed',
  PRESS: 'pressing high',
  SET_PIECE: 'set piece in the box',
  RESTART: 'restarting play',
  CELEBRATION: 'celebrating',
  STOPPAGE: 'play stopped',
};

export const TRIGGER_LABEL: Record<DecisionTrigger, string> = {
  UNDER_PRESSURE: 'Under pressure',
  STRIKER_ISOLATED: 'Striker isolated',
  LOSING_MIDFIELD: 'Losing midfield',
  CHASING_GAME: 'Chasing the game',
  PROTECTING_LEAD: 'Protecting the lead',
  MOMENTUM_SWING: 'Momentum swing',
  KEY_PLAYER_TIRED: 'Legs going',
  OPPONENT_SHAPE_CHANGE: 'They have changed shape',
  INJURY_DECISION: 'Injury call',
  CARD_RISK: 'Card risk',
  SPECIAL_RULE_CHOICE: 'Rule window',
  CREATOR_OPPORTUNITY: 'Creator moment',
  HALFTIME_TALK: 'Half-time team talk',
  SET_PIECE_CALL: 'Set piece call',
};

export const RISK_TONE: Record<DecisionOption['risk'], PillTone> = {
  LOW: 'positive',
  MEDIUM: 'warning',
  HIGH: 'danger',
};

export const RISK_LABEL: Record<DecisionOption['risk'], string> = {
  LOW: 'Safe',
  MEDIUM: 'Calculated',
  HIGH: 'Gamble',
};

export const SPECIAL_RULE_TONE: Record<SpecialRuleId, PillTone> = {
  DOUBLE_GOAL: 'volt',
  POWER_PLAY: 'warning',
  LAST_STAND: 'danger',
  LOCKDOWN: 'info',
  ALL_IN: 'danger',
  CREATOR_MOMENT: 'special',
  NUMBERS_GAME: 'warning',
  LONG_RANGE: 'info',
  CAPTAINS_CALL: 'positive',
  SUDDEN_SPARK: 'special',
};

/** Events the UI treats as a scoring moment. Everything else is narrative. */
export const isGoalEvent = (event: MatchEvent): boolean =>
  event.type === 'GOAL' || event.type === 'PENALTY_SCORED';

/** Events worth a row of their own in a compact feed. */
const QUIET_EVENTS: ReadonlySet<MatchEventType> = new Set<MatchEventType>([
  'PASS', 'CARRY', 'CROSS', 'POSSESSION_CHANGE', 'COMMENTARY', 'MOMENTUM_SHIFT',
]);

export const isNoteworthy = (event: MatchEvent): boolean =>
  !QUIET_EVENTS.has(event.type) || event.importance >= 3;

const EVENT_TONE: Partial<Record<MatchEventType, PillTone>> = {
  GOAL: 'volt',
  PENALTY_SCORED: 'volt',
  PENALTY_MISSED: 'danger',
  RED_CARD: 'danger',
  YELLOW_CARD: 'warning',
  INJURY: 'danger',
  SAVE: 'info',
  POST: 'warning',
  SUBSTITUTION: 'neutral',
  SPECIAL_RULE_START: 'special',
  SPECIAL_RULE_END: 'special',
  CREATOR_MOMENT: 'special',
  DECISION_RESOLVED: 'info',
  TACTICAL_CHANGE: 'info',
};

export const eventTone = (event: MatchEvent): PillTone => EVENT_TONE[event.type] ?? 'neutral';

export const minuteLabel = (minute: number): string => `${Math.max(0, Math.floor(minute))}'`;

/**
 * Clock in mm:ss. The simulation only reports whole minutes, so the seconds
 * field is a presentation flourish driven by tick fraction — never read back.
 */
export const clockLabel = (minute: number): string => {
  const m = Math.max(0, Math.floor(minute));
  return `${String(m).padStart(2, '0')}:00`;
};

export const scoreLine = (home: number, away: number): string => `${home} – ${away}`;

/** "You are 2-1 up", written from the player's side, for announcements. */
export function stateOfPlay(
  homeScore: number, awayScore: number, playerIsHome: boolean,
): string {
  const us = playerIsHome ? homeScore : awayScore;
  const them = playerIsHome ? awayScore : homeScore;
  if (us === them) return `Level at ${us}-${them}`;
  return us > them ? `Leading ${us}-${them}` : `Trailing ${us}-${them}`;
}

/** Momentum as words, so the bar is never the only channel carrying it. */
export function momentumPhrase(momentum: number, homeName: string, awayName: string): string {
  const magnitude = Math.abs(momentum);
  if (magnitude < 0.12) return 'Momentum is even';
  const side = momentum > 0 ? homeName : awayName;
  if (magnitude < 0.4) return `${side} edging it`;
  if (magnitude < 0.7) return `${side} on top`;
  return `${side} in full control`;
}

export const percent = (value: number): string => `${Math.round(value * 100)}%`;

export const one = (value: number): string => value.toFixed(1);

export const two = (value: number): string => value.toFixed(2);

/* --- presentation vocabulary ------------------------------------------ */

/**
 * Camera names, written for someone who has never played a football game.
 * "Wide" and "Follow" say what you will see; the hint says why you would pick
 * it, and is read out by assistive tech in place of a mystery icon.
 */
export const CAMERA_LABEL = {
  WIDE: 'Wide',
  FOLLOW: 'Follow',
} as const satisfies Record<string, string>;

export const CAMERA_HINT = {
  WIDE: 'The whole pitch, so you can read the shape.',
  FOLLOW: 'Close on the ball, so you can read the moment.',
} as const satisfies Record<string, string>;

/** Speed names. Short enough to sit in a rail without being cut in half. */
export const SPEED_LABEL = {
  SLOW: 'Slow',
  NORMAL: 'Normal',
  FAST: 'Fast',
  INSTANT: 'Skip',
} as const satisfies Record<string, string>;

/** The full sentence behind the short speed name, for the sheet and for a11y. */
export const SPEED_HINT = {
  SLOW: 'Half pace. Every phase is readable.',
  NORMAL: 'The default. A match takes a few minutes.',
  FAST: 'Double pace. Good once you trust your side.',
  INSTANT: 'As fast as the phone can run it.',
} as const satisfies Record<string, string>;
