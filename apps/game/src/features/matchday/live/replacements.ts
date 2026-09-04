import { familiarity, type Player, type Position, type SubstitutionRefusal } from '@cf/engine';

/**
 * Who should come on.
 *
 * The manager taps the man coming off; this orders the bench so the safest,
 * strongest normal replacement is first and the rest follow in the order a
 * coach would consider them. It recommends; it never chooses. Every seat on
 * the bench is returned, the unavailable ones last and flagged with the
 * simulator's own reason, so nobody is hidden and nobody is offered who cannot
 * come on.
 *
 * "Best" is not "highest rated". A striker is not a replacement for a keeper
 * whatever his number, and a tired seventy is not better than a fresh
 * sixty-eight in the same shirt. The score is the player's quality, discounted
 * by how well he plays the departing man's position (the engine's own
 * familiarity table, over his natural and secondary positions) and by how
 * much he has left in his legs. The match context adds a label, not a
 * reordering: chasing the game late, an attacker on the bench is pointed out
 * as the attacking option; protecting a lead, a defender as the defensive one.
 * The like-for-like choice stays first, because that is the question the
 * first row answers.
 */

export type ReplacementLabel = 'BEST_FIT' | 'FRESH_LEGS' | 'ATTACKING' | 'DEFENSIVE';

export const REPLACEMENT_LABEL: Record<ReplacementLabel, string> = {
  BEST_FIT: 'Best fit',
  FRESH_LEGS: 'Fresh legs',
  ATTACKING: 'Attacking option',
  DEFENSIVE: 'Defensive option',
};

export type BenchSeat =
  | { readonly player: Player; readonly available: true }
  | { readonly player: Player; readonly available: false; readonly reason: SubstitutionRefusal };

export interface ReplacementContext {
  readonly scoreline: 'TRAILING' | 'LEVEL' | 'LEADING';
  /** 0-1 of the match played. */
  readonly elapsed: number;
}

export interface RankedReplacement {
  readonly player: Player;
  readonly available: boolean;
  readonly reason?: SubstitutionRefusal;
  /** How well he covers the departing man's position, 0-1. */
  readonly fit: number;
  readonly score: number;
  readonly label?: ReplacementLabel;
}

/** A keeper's shirt is not covered by an outfield player, however good. */
const OUTFIELD_FOR_KEEPER = 0.15;
/** Familiarity below this is not "can play there", it is "is on the pitch". */
const COMPATIBLE = 0.6;
/** The last part of the match, where a change is about the scoreline. */
const LATE = 0.55;
/** Who "an attacking option" and "a defensive option" can be. */
const ATTACKING: ReadonlySet<Position> = new Set(['ST', 'LW', 'RW', 'CAM']);
const DEFENSIVE: ReadonlySet<Position> = new Set(['CB', 'LB', 'RB', 'CDM']);

export function positionFit(candidate: Player, target: Player['position']): number {
  if (target === 'GK') return candidate.position === 'GK' ? 1 : OUTFIELD_FOR_KEEPER;
  if (candidate.position === 'GK') return OUTFIELD_FOR_KEEPER;
  let fit = familiarity(candidate.position, target);
  for (const secondary of candidate.secondaryPositions) {
    fit = Math.max(fit, familiarity(secondary, target) * 0.96);
  }
  return fit;
}

/** Quality, tempered by fit and by legs. */
function replacementScore(candidate: Player, fit: number): number {
  const legs = 0.55 + 0.45 * Math.max(0, Math.min(100, candidate.fitness)) / 100;
  return candidate.overall * fit * legs;
}

export function rankReplacements(
  out: Player,
  bench: readonly BenchSeat[],
  ctx: ReplacementContext,
): RankedReplacement[] {
  const ranked: RankedReplacement[] = bench.map((seat) => {
    const fit = positionFit(seat.player, out.position);
    return seat.available
      ? { player: seat.player, available: true, fit, score: replacementScore(seat.player, fit) }
      : { player: seat.player, available: false, reason: seat.reason, fit, score: replacementScore(seat.player, fit) };
  });

  // Available first, then by score, then by name so the order is stable.
  ranked.sort((a, b) => {
    if (a.available !== b.available) return a.available ? -1 : 1;
    if (b.score !== a.score) return b.score - a.score;
    return a.player.id.localeCompare(b.player.id);
  });

  const labelled = ranked.map((r) => ({ ...r }));
  const legal = labelled.filter((r) => r.available);
  const best = legal[0];
  if (!best) return labelled;

  // The first name is the answer to "who should I bring on". If the only
  // options cannot really play there, say nothing rather than call it a fit.
  if (best.fit >= COMPATIBLE) (best as { label?: ReplacementLabel }).label = 'BEST_FIT';

  // Somebody who plays there and has clearly more in his legs than the best.
  const fresher = legal.find((r) => r !== best && r.fit >= COMPATIBLE && r.player.fitness >= best.player.fitness + 12);
  if (fresher) (fresher as { label?: ReplacementLabel }).label = 'FRESH_LEGS';

  // Late on, the scoreline suggests a different kind of change. One name each.
  if (ctx.elapsed >= LATE && ctx.scoreline !== 'LEVEL') {
    const wanted = ctx.scoreline === 'TRAILING' ? ATTACKING : DEFENSIVE;
    const label: ReplacementLabel = ctx.scoreline === 'TRAILING' ? 'ATTACKING' : 'DEFENSIVE';
    const option = legal.find((r) => !r.label && wanted.has(r.player.position));
    if (option) (option as { label?: ReplacementLabel }).label = label;
  }

  return labelled;
}

/** The reason a change was refused, in the manager's language. */
export function refusalMessage(reason: SubstitutionRefusal): string {
  switch (reason) {
    case 'NO_SUBS_LEFT': return 'You have no changes left.';
    case 'NOT_ON_PITCH': return 'He is not on the pitch, so he cannot come off.';
    case 'NOT_ON_BENCH': return 'He is not on the bench for this match.';
    case 'ALREADY_USED': return 'He has already played today and cannot come back on.';
    case 'SENT_OFF': return 'He was sent off and cannot come on.';
    case 'INJURED': return 'He is injured and cannot come on.';
    case 'SAME_PLAYER': return 'Pick a different player to come on.';
    default: return 'That change is not allowed.';
  }
}
