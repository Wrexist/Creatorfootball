import type { DecisionOutcome, DecisionTrigger } from '../matches/decisions';
import type { DecisionRecord } from './state';

/**
 * The player's career record at live decisions.
 *
 * Nothing else in the save retains how past calls turned out — results keep
 * outcomes, not verdicts — so this fold runs wherever a result is applied and
 * only counts calls the engine actually graded. A call with no measurement has
 * no honest outcome, and inventing one would be worse than a smaller number.
 */
export const initialDecisionRecord = (): DecisionRecord => ({});

export function foldDecisionRecord(
  record: DecisionRecord,
  decisions: readonly DecisionOutcome[],
): DecisionRecord {
  let next = record;
  // Distinct triggers within this one match, so `matches` rises once per
  // match per trigger however many times the same question came back.
  const seen: Partial<Record<DecisionTrigger, true>> = {};

  for (const decision of decisions) {
    const { trigger, evaluation } = decision;
    if (!trigger || !evaluation) continue;

    const prev = next[trigger] ?? { served: 0, worked: 0, matches: 0 };
    next = {
      ...next,
      [trigger]: {
        served: prev.served + 1,
        worked: prev.worked + (evaluation.verdict === 'WORKED' ? 1 : 0),
        matches: prev.matches + (seen[trigger] ? 0 : 1),
      },
    };
    seen[trigger] = true;
  }

  return next;
}
