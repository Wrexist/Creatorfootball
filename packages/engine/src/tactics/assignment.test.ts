import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { assign, assignMax } from './assignment';

/**
 * The claim this file has to earn is "optimal", not "good".
 *
 * A team sheet that is merely plausible is what the greedy version already
 * produced, and the whole reason for replacing it was that plausible and
 * optimal are different answers often enough to matter. So the central test is
 * not a hand-picked case — it is a brute-force comparison over hundreds of
 * random matrices, which is the only way to be sure of a claim like this.
 */

/**
 * Every assignment of rows to distinct columns, scored exhaustively.
 *
 * Deliberately without the usual "give up once the partial sum exceeds the best
 * complete one" prune. That prune is only valid when costs cannot be negative,
 * and these can — the maximising caller negates its scores. With negatives a
 * partial sum can be worse than the incumbent and still lead somewhere better,
 * so the prune quietly returns a *suboptimal* answer and the reference becomes
 * less trustworthy than the thing it is checking. The matrices here are at most
 * 6x11; exhaustive is affordable and exhaustive is the point.
 */
function bruteForceMin(cost: readonly (readonly number[])[]): number {
  const rows = cost.length;
  const cols = cost[0]?.length ?? 0;
  let best = Infinity;
  const used = new Array<boolean>(cols).fill(false);

  const walk = (row: number, total: number): void => {
    if (row === rows) { best = Math.min(best, total); return; }
    for (let c = 0; c < cols; c += 1) {
      if (used[c]) continue;
      used[c] = true;
      walk(row + 1, total + (cost[row]?.[c] ?? 0));
      used[c] = false;
    }
  };
  walk(0, 0);
  return best;
}

describe('assign', () => {
  it('beats the greedy answer on the case greedy gets wrong', () => {
    // Two slots, two players. Ellis is the better centre back *and* nearly as
    // good a striker; Novak can only defend. Filling the defence first takes
    // Ellis and strands Novak up front.
    const score = [
      [80, 78], // Ellis
      [70, 40], // Novak
    ];
    const result = assignMax(score);
    expect(result.cost).toBe(148);
    // Ellis up front, Novak at the back — the swap greedy cannot see.
    expect(result.columnFor).toEqual([1, 0]);
  });

  it('matches brute force on hundreds of random square matrices', () => {
    const rng = new Rng('assignment-square');
    for (let trial = 0; trial < 200; trial += 1) {
      const n = rng.int(1, 6);
      const cost = Array.from({ length: n }, () =>
        Array.from({ length: n }, () => rng.int(-100, 100)));
      expect(assign(cost).cost, `n=${n} ${JSON.stringify(cost)}`).toBe(bruteForceMin(cost));
    }
  });

  it('matches brute force when there are more columns than rows', () => {
    // The normal shape here: a few slots against a whole squad.
    const rng = new Rng('assignment-wide');
    for (let trial = 0; trial < 200; trial += 1) {
      const rows = rng.int(1, 4);
      const cols = rows + rng.int(0, 4);
      const cost = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => rng.int(-100, 100)));
      expect(assign(cost).cost, `${rows}x${cols}`).toBe(bruteForceMin(cost));
    }
  });

  it('handles negative costs, which is how callers maximise', () => {
    const cost = [[-5, -1], [-1, -5]];
    expect(assign(cost).cost).toBe(-10);
  });

  it('gives every row a distinct column', () => {
    const rng = new Rng('assignment-distinct');
    for (let trial = 0; trial < 50; trial += 1) {
      const rows = rng.int(1, 5);
      const cols = rows + rng.int(0, 5);
      const cost = Array.from({ length: rows }, () =>
        Array.from({ length: cols }, () => rng.float()));
      const { columnFor } = assign(cost);
      expect(columnFor).toHaveLength(rows);
      expect(new Set(columnFor).size).toBe(rows);
      for (const c of columnFor) {
        expect(c).toBeGreaterThanOrEqual(0);
        expect(c).toBeLessThan(cols);
      }
    }
  });

  it('reports the cost of the assignment it returns', () => {
    const rng = new Rng('assignment-cost');
    const cost = Array.from({ length: 5 }, () =>
      Array.from({ length: 9 }, () => rng.int(0, 50)));
    const { columnFor, cost: total } = assign(cost);
    const summed = columnFor.reduce((acc, c, r) => acc + (cost[r]?.[c] ?? 0), 0);
    expect(total).toBe(summed);
  });

  it('is stable: the same matrix always gives the same answer', () => {
    // The AI picks a side for every club every week. A solver that resolved
    // ties differently on identical input would make a save non-reproducible.
    const rng = new Rng('assignment-stable');
    const cost = Array.from({ length: 6 }, () =>
      Array.from({ length: 11 }, () => rng.int(0, 30)));
    const first = assign(cost);
    for (let i = 0; i < 5; i += 1) expect(assign(cost)).toEqual(first);
  });

  it('is trivially correct on the degenerate shapes', () => {
    expect(assign([]).cost).toBe(0);
    expect(assign([[7]])).toEqual({ columnFor: [0], cost: 7 });
  });

  it('refuses a matrix with fewer columns than rows rather than half-answering', () => {
    // More slots than players is a squad problem. Returning a partial team
    // sheet that looks complete is the worst possible response to it.
    expect(() => assign([[1, 2], [3, 4], [5, 6]])).toThrow(RangeError);
  });
});

describe('assignMax', () => {
  it('maximises rather than minimises', () => {
    const score = [[1, 9], [9, 1]];
    expect(assignMax(score).cost).toBe(18);
  });

  it('agrees with assign on the negated matrix', () => {
    const rng = new Rng('assignment-max');
    const score = Array.from({ length: 4 }, () =>
      Array.from({ length: 7 }, () => rng.int(0, 100)));
    const negated = score.map((row) => row.map((v) => -v));
    expect(assignMax(score).cost).toBe(-assign(negated).cost);
  });
});
