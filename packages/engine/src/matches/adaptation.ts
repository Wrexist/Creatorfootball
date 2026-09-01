import type { AttackingFocus, TacticSetup } from '../tactics/tactics';
import type { PlayShape } from '../simulation/aiClub';
import { playShapeOf } from '../simulation/aiClub';
import { counterPlan, readMajority } from '../simulation/opponentModel';

/**
 * Mid-match opponent adaptation: the other manager solving the player.
 *
 * The pre-match model (`opponentModel.ts`) files one observation per match
 * played — the shape and the attacking focus the player actually walked out
 * with — and counters what it has seen repeated. This is the same read taken
 * inside a match: one observation per attack the player's side actually makes,
 * in whatever shape it is in at that moment. Same majority rule, same
 * adaptability threshold, same `counterPlan` deciding the answer, so the
 * scouting report before the match and the change during it can never
 * disagree about what "a pattern" is or what to do about it.
 *
 * Why attacks, and not the tactics themselves? Because the rule that governs
 * the pre-match model governs this one: nobody reacts to a tactic that has not
 * been played. A change the player has just made is invisible until their side
 * has attacked in it — and it has to attack in it MIN_SAMPLES times before it
 * is a pattern, and out-vote whatever the last window still says. That is what
 * makes "no instant counter to a change" a structural guarantee rather than a
 * timer, and what makes mixing your approach up a real defence: a side that
 * keeps switching flank is never confidently read at all.
 *
 * The emergent routes an attack takes in this simulation — a cross, a ball in
 * behind, a counter — were measured first and rejected as the observable. The
 * tactics move them by a few percent each; the dice move them by far more.
 * Against a side set up as wide as the game allows the crossing majority the
 * rule needs appeared in one match in ten, and just as often against a side
 * set up narrow. An opponent "reading" that would be reading noise and taking
 * credit for it. Reading the shape a side keeps attacking in is what the
 * opposing bench actually does, and the read is honest.
 *
 * Everything here is a pure function of three things: what was observed, who
 * is deciding, and whether they have already moved this half. The scoreline,
 * momentum and the clock are not inputs and are not representable in the
 * input type. That is deliberate: a manager may sit off because you keep
 * pressing high; a manager must never sit off because you are winning. The
 * first is football. The second is the game deciding the result.
 */

/** One attack, as the other bench saw it: the shape it was played in. */
export interface AttackSample {
  readonly shape: PlayShape;
  readonly focus: AttackingFocus;
}

/**
 * The last eight attacks. Long enough that a habit is visible, short enough
 * that a genuine change of approach out-votes the old one within a few phases
 * of play rather than being held against the player for the rest of the match.
 */
export const WINDOW = 8;

/**
 * Five attacks in the same shape before anybody will call it a pattern. At one
 * attack every couple of minutes that is a quarter of a half of watching,
 * which is what "enough evidence" should feel like from the touchline.
 */
export const MIN_SAMPLES = 5;

export interface AdaptationInput {
  /** The *other* side's recent attacks, oldest first, bounded. */
  readonly observed: readonly AttackSample[];
  /** The deciding side's own setup as it stands. */
  readonly current: TacticSetup;
  /** Adaptability of the manager deciding, 1-99. */
  readonly adaptability: number;
  /** This side has already changed shape this half, by any mechanism. */
  readonly changedShapeThisPeriod: boolean;
  /** This side has already spent its adaptation this half. */
  readonly adaptedThisPeriod: boolean;
}

export type AdaptationRead = 'SHAPE' | 'FOCUS';

export interface Adaptation {
  /** Which dimension was read. One per adaptation: it is a targeted answer. */
  readonly read: AdaptationRead;
  /** What was seen: a `PlayShape` or an `AttackingFocus`. */
  readonly pattern: PlayShape | AttackingFocus;
  readonly change: Partial<TacticSetup>;
  /** Commentary tag: the touchline sentence the live feed shows. */
  readonly tag: string;
  /** The post-match sentence: what they did about it, in the past tense. */
  readonly recap: string;
  readonly matching: number;
  readonly samples: number;
}

/** File one attack. */
export function sampleOf(tactics: TacticSetup): AttackSample {
  return { shape: playShapeOf(tactics), focus: tactics.focus };
}

/** Record one attack, dropping the oldest once the window is full. */
export function observeAttack(log: readonly AttackSample[], sample: AttackSample): AttackSample[] {
  return [...log, sample].slice(-WINDOW);
}

const SHAPE_TAG: Record<PlayShape, string> = {
  LOW_BLOCK: 'adaptPressHigh',
  HIGH_PRESS: 'adaptGoLong',
  BALANCED: '',
};

const FOCUS_TAG: Record<AttackingFocus, string> = {
  LEFT: 'adaptFlank',
  RIGHT: 'adaptFlank',
  CENTRE: 'adaptMiddle',
  BALANCED: '',
};

/**
 * The post-match sentence for a change made *during* the match. The pre-match
 * recap in `opponentModel.ts` says what they came in knowing; these say what
 * they saw once the match was under way and what they did about it.
 */
const SHAPE_RECAP: Record<PlayShape, string> = {
  LOW_BLOCK: 'They watched you sit deep, then pushed up and pressed to pull that block apart.',
  HIGH_PRESS: 'They watched you press high, then sat off and went long into the space behind.',
  BALANCED: '',
};

const FOCUS_RECAP: Record<AttackingFocus, string> = {
  LEFT: 'They saw you keep building down your left, and crowded it.',
  RIGHT: 'They saw you keep building down your right, and crowded it.',
  CENTRE: 'They saw you keep working the middle, and packed it.',
  BALANCED: '',
};

const MAJORITY = { minSamples: MIN_SAMPLES, evidenceFull: WINDOW };

/** True when the lean would change nothing: the side is already set up that way. */
function alreadyInEffect(current: TacticSetup, lean: Partial<TacticSetup>): boolean {
  return (Object.keys(lean) as (keyof TacticSetup)[]).every((k) => current[k] === lean[k]);
}

/**
 * Decide whether to adapt, and to what.
 *
 * Returns null far more often than not, and that is the design: no evidence,
 * mixed evidence, a manager who has not read it yet, a side that has already
 * moved this half, a balanced approach with nothing in it to attack, or a
 * pattern this side already came in set up to counter all mean "do nothing".
 * The adaptation is rare enough to be an event.
 *
 * Shape is read first and answered alone; focus only if the shape gave nothing
 * to answer. One dimension per adaptation keeps the response targeted — the
 * player can see what changed and turn it round.
 */
export function decideAdaptation(input: AdaptationInput): Adaptation | null {
  if (input.adaptedThisPeriod || input.changedShapeThisPeriod) return null;

  const shape = readMajority(input.observed.map((s) => s.shape), MAJORITY);
  const focus = readMajority(input.observed.map((s) => s.focus), MAJORITY);
  const empty = { shape: null, focus: null, formation: null, samples: input.observed.length };

  interface Candidate {
    readonly read: AdaptationRead;
    readonly change: Partial<TacticSetup>;
    readonly tag: string;
    readonly recap: string;
    readonly matching: number;
    readonly samples: number;
    readonly pattern: PlayShape | AttackingFocus;
  }
  const candidates: Candidate[] = [];
  if (shape) {
    candidates.push({
      read: 'SHAPE',
      change: counterPlan({ ...empty, shape }, input.adaptability).lean,
      tag: SHAPE_TAG[shape.value], recap: SHAPE_RECAP[shape.value],
      matching: shape.matching, samples: shape.samples, pattern: shape.value,
    });
  }
  if (focus) {
    candidates.push({
      read: 'FOCUS',
      change: counterPlan({ ...empty, focus }, input.adaptability).lean,
      tag: FOCUS_TAG[focus.value], recap: FOCUS_RECAP[focus.value],
      matching: focus.matching, samples: focus.samples, pattern: focus.value,
    });
  }

  for (const c of candidates) {
    if (Object.keys(c.change).length === 0) continue;
    if (alreadyInEffect(input.current, c.change)) continue;
    return c;
  }
  return null;
}
