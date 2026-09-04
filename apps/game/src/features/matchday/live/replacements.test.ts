import { describe, expect, it } from 'vitest';
import { Rng, generatePlayer, type Player, type Position, type SubstitutionRefusal } from '@cf/engine';
import { BASE_NAME_BANK } from '@cf/engine/content/packs/base/nameBank';
import { rankReplacements, type BenchSeat, type ReplacementContext } from './replacements';

/**
 * Who comes on.
 *
 * The game recommends; the player decides. The first name has to answer "the
 * safest, strongest normal replacement", which is not the same question as
 * "the best player on the bench". A keeper coming off is replaced by a keeper,
 * a centre-back by somebody who can play there, and the highest rating alone
 * never wins a slot it cannot play. Every legal player stays reachable;
 * every illegal one is named as such rather than hidden or quietly disabled.
 */

const rng = new Rng('replacements');
let n = 0;
function player(position: Position, overall: number, fitness = 100, extra: Partial<Player> = {}): Player {
  n += 1;
  const p = generatePlayer(rng.fork(`p${n}`), {
    targetOverall: overall, position, idPrefix: 'rep', idIndex: n, nameBank: BASE_NAME_BANK,
  });
  return { ...p, fitness, ...extra };
}

const seats = (players: readonly Player[], unavailable: Record<string, SubstitutionRefusal> = {}): BenchSeat[] =>
  players.map((p) => {
    const reason = unavailable[p.id];
    return reason ? { player: p, available: false, reason } : { player: p, available: true };
  });

const CTX: ReplacementContext = { scoreline: 'LEVEL', elapsed: 0.5 };

describe('replacement ranking', () => {
  it('TEST A: a goalkeeper coming off is replaced by the eligible keeper first, above any outfield player', () => {
    const gk = player('GK', 62);
    const benchGk = player('GK', 58, 100);
    const star = player('ST', 84, 100);
    const ranked = rankReplacements(gk, seats([star, benchGk]), CTX);
    expect(ranked[0]?.player.id).toBe(benchGk.id);
    expect(ranked[0]?.label).toBe('BEST_FIT');
    // The striker is still there — reachable, never hidden — but not recommended.
    expect(ranked.map((r) => r.player.id)).toContain(star.id);
    expect(ranked.find((r) => r.player.id === star.id)?.label).toBeUndefined();
  });

  it('TEST B: an outfield player is replaced by somebody who can play his position', () => {
    const cb = player('CB', 70);
    const otherCb = player('CB', 66);
    const winger = player('LW', 72);
    const ranked = rankReplacements(cb, seats([winger, otherCb]), CTX);
    expect(ranked[0]?.player.id).toBe(otherCb.id);
    expect(ranked[0]?.label).toBe('BEST_FIT');
  });

  it('TEST C: the highest rating alone does not win', () => {
    const cb = player('CB', 70);
    const rightBack = player('RB', 68, 100, { secondaryPositions: ['CB'] });
    const brilliantStriker = player('ST', 90, 100);
    const ranked = rankReplacements(cb, seats([brilliantStriker, rightBack]), CTX);
    expect(ranked[0]?.player.id).toBe(rightBack.id);
  });

  it('a spent replacement loses to a fresh one of similar quality', () => {
    const cm = player('CM', 70);
    const tired = player('CM', 72, 40);
    const fresh = player('CM', 69, 100);
    const ranked = rankReplacements(cm, seats([tired, fresh]), CTX);
    expect(ranked[0]?.player.id).toBe(fresh.id);
  });

  it('TEST D: chasing the game late, an attacking option is named; protecting a lead, a defensive one', () => {
    const cm = player('CM', 70);
    const likeForLike = player('CM', 70, 100);
    const striker = player('ST', 71, 100);
    const stopper = player('CDM', 71, 100);
    const chasing = rankReplacements(cm, seats([likeForLike, striker, stopper]), { scoreline: 'TRAILING', elapsed: 0.8 });
    expect(chasing[0]?.player.id).toBe(likeForLike.id);
    expect(chasing.find((r) => r.player.id === striker.id)?.label).toBe('ATTACKING');
    const protecting = rankReplacements(cm, seats([likeForLike, striker, stopper]), { scoreline: 'LEADING', elapsed: 0.8 });
    expect(protecting.find((r) => r.player.id === stopper.id)?.label).toBe('DEFENSIVE');
    // Early and level, nobody is told to gamble.
    const early = rankReplacements(cm, seats([likeForLike, striker, stopper]), { scoreline: 'LEVEL', elapsed: 0.2 });
    expect(early.some((r) => r.label === 'ATTACKING' || r.label === 'DEFENSIVE')).toBe(false);
  });

  it('TEST E: every legal player is listed, once, however poor a fit', () => {
    const gk = player('GK', 60);
    const bench = [player('ST', 50), player('CB', 55), player('GK', 40), player('LW', 80), player('CM', 60)];
    const ranked = rankReplacements(gk, seats(bench), CTX);
    expect(ranked.map((r) => r.player.id).sort()).toEqual(bench.map((p) => p.id).sort());
    expect(new Set(ranked.map((r) => r.player.id)).size).toBe(bench.length);
  });

  it('TEST F: an illegal player is kept, flagged with the reason, and never recommended', () => {
    const cb = player('CB', 70);
    const used = player('CB', 75);
    const fine = player('CB', 60);
    const ranked = rankReplacements(cb, seats([used, fine], { [used.id]: 'ALREADY_USED' }), CTX);
    const flagged = ranked.find((r) => r.player.id === used.id);
    expect(flagged?.available).toBe(false);
    expect(flagged?.reason).toBe('ALREADY_USED');
    expect(flagged?.label).toBeUndefined();
    expect(ranked[0]?.player.id).toBe(fine.id);
    // Legal names come before illegal ones, whatever their rating.
    expect(ranked.findIndex((r) => r.player.id === fine.id)).toBeLessThan(ranked.findIndex((r) => r.player.id === used.id));
  });

  it('is deterministic: the same inputs rank the same way', () => {
    const cb = player('CB', 70);
    const bench = [player('CB', 66), player('RB', 68), player('ST', 90)];
    const a = rankReplacements(cb, seats(bench), CTX).map((r) => [r.player.id, r.label]);
    const b = rankReplacements(cb, seats(bench), CTX).map((r) => [r.player.id, r.label]);
    expect(a).toEqual(b);
  });
});
