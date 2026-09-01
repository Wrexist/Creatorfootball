import type { TacticSetup, AttackingFocus } from '../tactics/tactics';
import type { GameState } from '../game/state';
import type { ClubId } from '../core/brand';
import type { PlayShape } from './aiClub';
import { playShapeOf, counterLeanAgainst } from './aiClub';
import { clamp } from '../core/math';

/**
 * What the league has actually seen you do.
 *
 * The opponent used to counter the player by reading `playerClub.tactics`
 * directly — the setup sitting in the tactics screen at that moment. That is
 * omniscience wearing a scouting report's clothes: it knew a change before a
 * ball had been kicked with it, and it knew nothing at all about what the
 * player had really been doing for the last month. The comment at the call
 * site described the intended design ("the shape the player has been playing
 * all month"); the code implemented a different, unearned one.
 *
 * This module is that intended design. Every match the player actually plays
 * files one observation. The AI reads only those observations, so:
 *
 *  - a first meeting is played blind, on the club's own identity;
 *  - a pattern has to be *repeated* before anyone counters it;
 *  - changing your approach genuinely buys you time, because the record still
 *    says what you used to do;
 *  - and no club ever reacts to a tactic it has not seen.
 *
 * The point of all this is one feeling, arriving unprompted somewhere in the
 * second month: *they have figured me out.* It only lands if it was earned,
 * which means the model has to be allowed to be wrong.
 */

/** One filed observation: how the player set up for a match that was played. */
export interface TendencySample {
  readonly cycle: number;
  readonly shape: PlayShape;
  readonly focus: AttackingFocus;
  readonly formationId: string;
}

export interface OpponentModel {
  /** Newest last. Bounded — see MAX_SAMPLES. */
  readonly samples: readonly TendencySample[];
}

export const EMPTY_OPPONENT_MODEL: OpponentModel = { samples: [] };

/**
 * Six matches is a month and a half of football: long enough for a habit to be
 * visible, short enough that a genuine change of approach is believed within a
 * few weeks rather than held against the player all season.
 */
export const MAX_SAMPLES = 6;

/** Below this many observations nobody claims to know anything. */
const MIN_SAMPLES = 2;

/** Observations at which the evidence term saturates. */
const EVIDENCE_FULL = 4;

/**
 * A tendency has to be what the player does *more often than not*.
 *
 * Countering is a commitment: the club gives up its own shape to do it. A bare
 * plurality — pressing in two of the last four — is not evidence of a habit,
 * it is evidence of a manager who varies. Requiring a real majority is what
 * makes mixing your approach up an actual counter-strategy rather than a
 * cosmetic one, and it is why the model is allowed to answer "I don't know".
 */
const MIN_AGREEMENT = 0.5;

/**
 * Confidence a club needs before it abandons its own shape to counter yours.
 *
 * Scaled by the manager's adaptability so clubs differ: a sharp manager acts on
 * a hunch, a poor one wants to be certain and is often too late. Neither ever
 * reaches certainty from a single match.
 */
const COUNTER_THRESHOLD_SHARP = 0.34;
const COUNTER_THRESHOLD_BLUNT = 0.72;

export interface TendencyRead<T> {
  readonly value: T;
  /** 0-1. Agreement among observations, damped by how few there are. */
  readonly confidence: number;
  /** How many of the observations showed this. */
  readonly matching: number;
  readonly samples: number;
}

/** Record one observation, dropping the oldest once the window is full. */
export function observeTactics(
  model: OpponentModel,
  tactics: TacticSetup,
  cycle: number,
): OpponentModel {
  const sample: TendencySample = {
    cycle,
    shape: playShapeOf(tactics),
    focus: tactics.focus,
    formationId: tactics.formationId,
  };
  return { samples: [...model.samples, sample].slice(-MAX_SAMPLES) };
}

/**
 * The most-repeated value of one dimension, with how strongly it is believed.
 *
 * Confidence multiplies agreement by evidence, so four matches of the same
 * shape reads far louder than two, and a player who mixes it up is never
 * confidently read at all — which is the correct answer, not a failure.
 */
function dominant<T extends string>(
  samples: readonly TendencySample[],
  pick: (s: TendencySample) => T,
): TendencyRead<T> | null {
  if (samples.length < MIN_SAMPLES) return null;

  const counts = new Map<T, number>();
  for (const sample of samples) {
    const key = pick(sample);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }

  let best: T | null = null;
  let bestCount = 0;
  // Iterate the samples rather than the map so ties resolve to the value seen
  // most recently first, deterministically, with no dependence on insertion
  // order of a Map built from an unordered source.
  for (let i = samples.length - 1; i >= 0; i--) {
    const key = pick(samples[i] as TendencySample);
    const count = counts.get(key) ?? 0;
    if (count > bestCount) { best = key; bestCount = count; }
  }
  if (best === null) return null;

  const agreement = bestCount / samples.length;
  if (agreement <= MIN_AGREEMENT) return null;
  const evidence = Math.min(1, samples.length / EVIDENCE_FULL);
  return {
    value: best,
    confidence: clamp(agreement * evidence, 0, 1),
    matching: bestCount,
    samples: samples.length,
  };
}

export interface OpponentRead {
  readonly shape: TendencyRead<PlayShape> | null;
  readonly focus: TendencyRead<AttackingFocus> | null;
  readonly formation: TendencyRead<string> | null;
  readonly samples: number;
}

export function readOpponent(model: OpponentModel): OpponentRead {
  const samples = model.samples;
  return {
    shape: dominant(samples, (s) => s.shape),
    focus: dominant(samples, (s) => s.focus),
    formation: dominant(samples, (s) => s.formationId),
    samples: samples.length,
  };
}

/** Confidence this manager needs before acting. Higher adaptability acts sooner. */
export function counterThreshold(adaptability: number): number {
  const sharpness = clamp(adaptability / 100, 0, 1);
  return COUNTER_THRESHOLD_BLUNT - (COUNTER_THRESHOLD_BLUNT - COUNTER_THRESHOLD_SHARP) * sharpness;
}

export interface CounterPlan {
  readonly lean: Partial<TacticSetup>;
  /**
   * Player-facing sentences describing what has been noticed and what is being
   * done about it. Generated here, beside the decision, so the scouting report
   * the player reads can never drift from the tactics the AI actually brings.
   */
  readonly notes: readonly string[];
  /**
   * The same read, told after the match. The preview says what they *will*
   * do; the result screen says what they *did* and why — closing the loop the
   * preview opened, so a counter the player was warned about is named again
   * where its consequence is visible. Both tenses come from one decision, so
   * they cannot disagree.
   */
  readonly recap: readonly string[];
}

const SHAPE_NOTE: Record<PlayShape, string> = {
  LOW_BLOCK: 'sitting deep and defending your box',
  HIGH_PRESS: 'pressing high and squeezing the pitch',
  BALANCED: 'keeping a balanced shape',
};

const SHAPE_ANSWER: Record<PlayShape, string> = {
  LOW_BLOCK: 'They will press you high and stretch the pitch to pull that block apart.',
  HIGH_PRESS: 'They will sit off, go long over your line and run at the space you leave behind.',
  BALANCED: '',
};

const SHAPE_RECAP: Record<PlayShape, string> = {
  LOW_BLOCK: 'They came in having watched you sit deep, and pressed high to pull that block apart.',
  HIGH_PRESS: 'They came in having watched you press high, sat off, and went long into the space behind.',
  BALANCED: '',
};

const FOCUS_RECAP: Record<AttackingFocus, string> = {
  LEFT: 'They knew you build down your left and crowded it.',
  RIGHT: 'They knew you build down your right and crowded it.',
  CENTRE: 'They knew you work the middle and packed it.',
  BALANCED: '',
};

const FOCUS_NOTE: Record<AttackingFocus, string> = {
  LEFT: 'building almost everything down your left',
  RIGHT: 'building almost everything down your right',
  CENTRE: 'working the ball through the middle',
  BALANCED: '',
};

/**
 * What this club will do about what it has seen.
 *
 * Two independent reads, so the counter is not a single rock-paper-scissors
 * throw: shape decides the block, and a repeated attacking flank pulls their
 * marking and width across to meet it. A club that has read neither keeps its
 * own identity — drifting toward a league-wide average would make every
 * opponent feel the same, which is the failure mode this whole system exists
 * to avoid.
 */
export function counterPlan(read: OpponentRead, adaptability: number): CounterPlan {
  const threshold = counterThreshold(adaptability);
  const lean: Record<string, unknown> = {};
  const notes: string[] = [];
  const recap: string[] = [];

  const shape = read.shape;
  if (shape && shape.confidence >= threshold && shape.value !== 'BALANCED') {
    const counter = counterLeanAgainst(shape.value);
    if (counter) {
      Object.assign(lean, counter);
      notes.push(
        `They have watched you ${SHAPE_NOTE[shape.value]} in ${shape.matching} of your last ${shape.samples}. ${SHAPE_ANSWER[shape.value]}`.trim(),
      );
      recap.push(SHAPE_RECAP[shape.value]);
    }
  }

  const focus = read.focus;
  if (focus && focus.confidence >= threshold && focus.value !== 'BALANCED') {
    // Man-marking and a narrow shape crowd a predictable flank. Deliberately
    // not a counter to everything: it costs them width of their own.
    Object.assign(lean, { marking: 'MAN', width: focus.value === 'CENTRE' ? 'WIDE' : 'NARROW' });
    notes.push(
      `They know you have been ${FOCUS_NOTE[focus.value]} — expect that side to be crowded.`,
    );
    recap.push(FOCUS_RECAP[focus.value]);
  }

  return { lean: lean as Partial<TacticSetup>, notes, recap };
}

/**
 * The plan an AI club brings to a match against the player.
 *
 * Lives here rather than in `aiClub` on purpose: this module already imports
 * `aiClub` for the shape vocabulary, and importing back the other way would
 * create a module cycle. The one this repository already shipped built
 * cleanly, passed every unit test, and died on load — see the note in
 * `apps/game/vite.config.ts`. The `GameState` import above is type-only and
 * erases at compile, so nothing cyclical survives into the bundle.
 */
export function counterPlanVsPlayer(state: GameState, adaptability: number): CounterPlan {
  return counterPlan(readOpponent(state.opponentModel), adaptability);
}

/**
 * What this specific opponent has worked out about you, ready to render.
 *
 * The preview screen shows these notes before kick-off, which is the whole
 * point of the system: an opponent that quietly counters you is just a harder
 * match, and reads as the game cheating. An opponent that *tells you what it
 * noticed* turns the same simulation into a decision — keep the shape that got
 * you here and back yourself, or change it and give up what you are good at.
 *
 * Both the notes and the tactics come from one call, so the briefing can never
 * describe a plan different from the one that walks onto the pitch.
 */
export function scoutingReportAgainst(state: GameState, opponentClubId: ClubId): CounterPlan {
  const club = state.clubs[opponentClubId];
  const manager = club?.managerId ? state.managers[club.managerId] : undefined;
  return counterPlanVsPlayer(state, manager?.attributes.adaptability ?? 50);
}
