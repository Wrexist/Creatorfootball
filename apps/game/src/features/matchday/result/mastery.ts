import { DECISION_TRIGGERS, type DecisionRecord, type DecisionTrigger } from '@cf/engine';

/**
 * The career line for a family of calls, in the voice the rest of matchday
 * uses. One family reads one way ("half-time talks"); every other trigger is
 * a kind of call. The figures are the engine's own tallies — the rate is only
 * ever worked-of-served, so the line cannot promise more than happened.
 */
const CALL_FAMILY: Record<DecisionTrigger, string> = {
  UNDER_PRESSURE: 'pressing calls',
  STRIKER_ISOLATED: 'isolated-striker calls',
  LOSING_MIDFIELD: 'midfield calls',
  CHASING_GAME: 'chasing-the-game calls',
  PROTECTING_LEAD: 'lead-protection calls',
  MOMENTUM_SWING: 'momentum calls',
  KEY_PLAYER_TIRED: 'fresh-legs calls',
  OPPONENT_SHAPE_CHANGE: 'shape-response calls',
  INJURY_DECISION: 'injury calls',
  CARD_RISK: 'card-risk calls',
  SPECIAL_RULE_CHOICE: 'rule-window calls',
  CREATOR_OPPORTUNITY: 'creator calls',
  HALFTIME_TALK: 'half-time talks',
  SET_PIECE_CALL: 'set-piece calls',
};

/**
 * One career aggregate line per trigger family with history, ordered by the
 * engine's own trigger list so the panel never reshuffles between matches.
 */
export function masteryLines(record: DecisionRecord): string[] {
  return DECISION_TRIGGERS
    .filter((trigger) => (record[trigger]?.served ?? 0) > 0)
    .map((trigger) => {
      const tally = record[trigger];
      if (!tally) return null;
      const pct = Math.round((tally.worked / tally.served) * 100);
      const across = tally.matches === 1 ? '1 match' : `${tally.matches} matches`;
      return `Your ${CALL_FAMILY[trigger]}: ${pct}% worked across ${across}.`;
    })
    .filter((line): line is string => line !== null);
}
