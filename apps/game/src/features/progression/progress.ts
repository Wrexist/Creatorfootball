import type { Objective } from '@cf/engine';

/**
 * How an objective's progress is *shown*.
 *
 * This file exists because of a real defect: "Finish in the top half" rendered
 * as "12 / 8" with a full bar while the club sat twelfth of twelve. The screen
 * had assumed every target counts upward, so a maximum-type target being missed
 * by four places arrived at `min(100, 150%)` and drew itself as achieved. A
 * progress bar that says "done" about the thing you are failing worst at is the
 * worst kind of interface lie, because it is confident.
 *
 * Two rules fix it, and the second one holds even if the first is ever wrong:
 *
 *   1. For a target that is a *maximum* — league position, cards, a wage
 *      ceiling — progress is inverted: closeness is `target ÷ progress`.
 *   2. **Nothing renders as complete unless the engine says it is complete.**
 *      `Objective.status` is the only authority on that. Where the engine has
 *      not marked an objective COMPLETED or CLAIMED, the bar is capped below
 *      full no matter what the arithmetic produces.
 *
 * Rule 2 is deliberately belt-and-braces: it is derived from engine state
 * alone, so a new objective kind this file has never heard of still cannot be
 * drawn as finished while it is being missed.
 */

/**
 * Kinds whose target is a ceiling rather than a floor.
 *
 * This mirrors `lowerIsBetter` on the engine's own kind definitions, which are
 * not currently re-exported from `@cf/engine`. When they are, this set should
 * be deleted and `objectiveKind(id)?.lowerIsBetter` read directly — the engine
 * must stay the single source of truth for what an objective means.
 */
const LOWER_IS_BETTER: ReadonlySet<string> = new Set(['LEAGUE_POSITION', 'AVOID_RED_CARDS']);

/** The bar never reaches the end while the objective is still live. */
const LIVE_CEILING = 92;

export interface ObjectiveProgress {
  /** 0-100, for the bar. */
  readonly percent: number;
  /** True only when the engine has marked it done. */
  readonly settled: boolean;
  readonly failed: boolean;
  /** True when the current reading is outside a maximum-type target. */
  readonly missingTarget: boolean;
  readonly lowerIsBetter: boolean;
  /** The bar's left-hand label, in plain language. */
  readonly label: string;
  /** The bar's right-hand figure. */
  readonly valueLabel: string;
  readonly tone: 'volt' | 'positive' | 'warning' | 'danger';
}

export function objectiveProgress(objective: Objective): ObjectiveProgress {
  const { progress, target, status } = objective;
  const settled = status === 'COMPLETED' || status === 'CLAIMED';
  const failed = status === 'FAILED';

  // Direction. The declared set is the primary signal; a live objective whose
  // reading has passed its target without the engine completing it is a
  // maximum-type target too, whatever kind it claims to be.
  const declared = LOWER_IS_BETTER.has(objective.kind);
  const impliedByState = !settled && !failed && target > 0 && progress > target;
  const lowerIsBetter = declared || impliedByState;

  const missingTarget = lowerIsBetter && progress > target;

  let ratio: number;
  if (settled) ratio = 1;
  else if (target <= 0) ratio = 0;
  else if (lowerIsBetter) ratio = progress <= 0 ? 1 : Math.min(1, target / progress);
  else ratio = Math.min(1, progress / target);

  const percent = settled ? 100 : Math.min(LIVE_CEILING, Math.round(ratio * 100));

  const label = settled
    ? status === 'CLAIMED' ? 'Done and paid' : 'Done — waiting on you'
    : failed
      ? 'Missed'
      : lowerIsBetter
        ? missingTarget
          ? `At ${progress}. Needs to be ${target} or better.`
          : `At ${progress}, inside the target of ${target}. Hold it to the deadline.`
        : `${progress} of ${target} so far`;

  const valueLabel = settled
    ? 'Complete'
    : lowerIsBetter
      ? missingTarget ? `${progress - target} away` : 'On track'
      : `${percent}%`;

  const tone: ObjectiveProgress['tone'] = settled
    ? 'positive'
    : failed || missingTarget
      ? 'danger'
      : lowerIsBetter
        ? 'warning'
        : 'volt';

  return { percent, settled, failed, missingTarget, lowerIsBetter, label, valueLabel, tone };
}
