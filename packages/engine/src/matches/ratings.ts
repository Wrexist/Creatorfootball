import type { PlayerId } from '../core/brand';
import { clamp } from '../core/math';
import type { SlotRole } from './model';
import type { Side } from './events';
import { BALANCE } from './balance';

/**
 * Player ratings.
 *
 * Ratings are built from what a player *did*, never from the scoreline. A
 * keeper who makes seven saves in a 4-0 defeat comes out well; a striker who
 * misses two clear chances in a 3-0 win does not. That is the whole point: the
 * rating has to be the thing the player argues with, and it can only earn that
 * by being defensible line by line.
 *
 * Conceding is the one place the team result enters, and only for the players
 * who were responsible for defending — weighted so it never swamps individual
 * contribution.
 */
export interface RatingInput {
  readonly playerId: PlayerId;
  readonly role: SlotRole;
  readonly minutes: number;
  readonly goals: number;
  readonly assists: number;
  readonly shots: number;
  readonly shotsOnTarget: number;
  readonly keyPasses: number;
  readonly passes: number;
  readonly passesCompleted: number;
  readonly tackles: number;
  readonly interceptions: number;
  readonly duelsWon: number;
  readonly duelsLost: number;
  readonly saves: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly bigChancesMissed: number;
  /** Goals the player's team conceded while he was on the pitch. */
  readonly goalsConcededWhileOn: number;
  /** True when the team kept a clean sheet and he played most of the match. */
  readonly cleanSheet: boolean;
  /** Full match length, used to scale contribution rates. */
  readonly matchMinutes: number;
}

export function ratePlayer(input: RatingInput): number {
  let r = BALANCE.RATING_BASE;

  r += input.goals * BALANCE.RATING_GOAL;
  r += input.assists * BALANCE.RATING_ASSIST;
  r += input.keyPasses * BALANCE.RATING_KEY_PASS;
  r += input.shotsOnTarget * BALANCE.RATING_SHOT_ON_TARGET;
  r += input.bigChancesMissed * BALANCE.RATING_BIG_CHANCE_MISSED;

  r += input.tackles * BALANCE.RATING_TACKLE;
  r += input.interceptions * BALANCE.RATING_INTERCEPTION;
  r += input.duelsWon * BALANCE.RATING_DUEL_WON;
  r += input.duelsLost * BALANCE.RATING_DUEL_LOST;
  r += input.saves * BALANCE.RATING_SAVE;

  // Passing is judged against a 78% baseline, and only once a player has made
  // enough passes for the percentage to mean anything.
  if (input.passes >= 6) {
    const accuracy = input.passesCompleted / input.passes;
    r += (accuracy - 0.78) * BALANCE.RATING_PASS_ACCURACY_SWING;
  }

  if (input.role === 'GK') {
    r += input.goalsConcededWhileOn * BALANCE.RATING_GOAL_CONCEDED_GK;
    if (input.cleanSheet) r += BALANCE.RATING_CLEAN_SHEET_GK;
  } else if (input.role === 'DEF') {
    r += input.goalsConcededWhileOn * BALANCE.RATING_GOAL_CONCEDED_DEF;
    if (input.cleanSheet) r += BALANCE.RATING_CLEAN_SHEET_DEF;
  }

  r += input.yellowCards * BALANCE.RATING_YELLOW;
  r += input.redCards * BALANCE.RATING_RED;

  // A substitute with six minutes cannot have earned a 9.0 or deserved a 3.0.
  const exposure = Math.min(1, input.minutes / Math.max(1, BALANCE.RATING_MINUTES_REFERENCE));
  r = BALANCE.RATING_BASE + (r - BALANCE.RATING_BASE) * (0.45 + 0.55 * exposure);

  return Math.round(clamp(r, BALANCE.RATING_MIN, BALANCE.RATING_MAX) * 10) / 10;
}

export interface MotmCandidate {
  readonly playerId: PlayerId;
  readonly side: Side;
  readonly rating: number;
  readonly goals: number;
  readonly assists: number;
  readonly minutes: number;
}

/**
 * Man of the match. The rating does the work; the winning side gets a small
 * thumb on the scale because that is how the award is actually given, and a
 * decisive contribution breaks ties ahead of raw rating.
 */
export function pickManOfTheMatch(
  candidates: readonly MotmCandidate[],
  winner: Side | 'draw',
): PlayerId | null {
  let best: MotmCandidate | null = null;
  let bestScore = -Infinity;

  for (const c of candidates) {
    if (c.minutes <= 0) continue;
    let score = c.rating;
    if (winner !== 'draw' && c.side === winner) score += BALANCE.MOTM_WINNER_BONUS;
    score += c.goals * 0.05 + c.assists * 0.03;
    if (score > bestScore) { bestScore = score; best = c; }
  }

  return best ? best.playerId : null;
}
