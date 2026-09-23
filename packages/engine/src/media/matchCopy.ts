import type { ContentHook } from '../simulation/ports';

/** Large margins get factual copy, without inventing a venue or match events. */
export function routCopy(hook: ContentHook): { headline: string; body: string } | null {
  const margin = Number(hook.facts.margin);
  const {club, opponent, score} = hook.tokens;
  if (hook.depth !== 0 || !Number.isFinite(margin) || margin < 4 || !club || !opponent || !score) return null;
  if (hook.facts.result === 'WIN') return {
    headline: `${club} sweep past ${opponent}, ${score}`,
    body: `${club} finish with a ${margin}-goal win over ${opponent}. The final score is ${score}, a result that gives both clubs plenty to take into their next match.`,
  };
  if (hook.facts.result === 'LOSS') return {
    headline: `Heavy defeat for ${club} against ${opponent}, ${score}`,
    body: `${club} lose by ${margin} goals against ${opponent}. The final score is ${score}; recovery and preparation are the next tasks for the squad.`,
  };
  return null;
}
