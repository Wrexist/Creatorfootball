/**
 * Optimal one-to-one assignment — the Hungarian method, shortest-augmenting-path form.
 *
 * Picking a team is an assignment problem, and assignment problems are the
 * textbook case where being greedy is not merely imperfect but *reliably*
 * wrong. Fill the slots one at a time, best player first, and the first slot
 * considered takes the best all-rounder in the squad — leaving a later slot,
 * which only that all-rounder could really play, to somebody who cannot play it
 * at all. The team sheet looks sensible slot by slot and is worse than one a
 * player would have picked by hand.
 *
 * The classic shape of it, with two slots and two players:
 *
 *              centre back   striker
 *   Ellis          80           78
 *   Novak          70           40
 *
 * Greedy fills the centre back first, takes Ellis at 80, and is left putting
 * Novak up front for 40 — a total of 120. Swapping them scores 148. No amount
 * of tuning the *scores* fixes that; the order of the loop is the bug.
 *
 * This solves it exactly instead. Cost is minimised, rows are assigned to
 * distinct columns, and every row gets a column (so it needs at least as many
 * columns as rows — for a team sheet, at least as many players as slots).
 *
 * ## Why this variant
 *
 * The `O(n²m)` shortest-augmenting-path formulation with dual potentials, as
 * opposed to the matrix-reduction one usually taught first. It handles
 * rectangular inputs natively — which is the normal case here, a handful of
 * slots against a whole squad — and it never has to pad the matrix out to a
 * square with dummy rows, which is where padded implementations tend to go
 * wrong on ties.
 *
 * A team sheet is at most 11 slots against maybe 30 players. This runs in
 * microseconds; the reason to care about the complexity at all is that the
 * match simulator also calls it to pick sides for every AI club.
 */

/** Sentinel for "no column assigned", and for the algorithm's virtual row 0. */
const NONE = -1;

export interface AssignmentResult {
  /** `columnFor[row]` is the column that row was assigned, or `NONE`. */
  readonly columnFor: readonly number[];
  /** Total cost of the assignment. */
  readonly cost: number;
}

/**
 * Assign every row to a distinct column so the total cost is as low as
 * possible.
 *
 * `cost[r][c]` may be any finite number, negative included — which is how a
 * caller maximises a score rather than minimising a cost: negate it. Rows must
 * not outnumber columns; with more slots than players the caller has a squad
 * problem, not an assignment problem, and should say so rather than being
 * handed a partial answer that looks complete.
 */
export function assign(cost: readonly (readonly number[])[]): AssignmentResult {
  const rows = cost.length;
  if (rows === 0) return { columnFor: [], cost: 0 };
  const cols = cost[0]?.length ?? 0;
  if (cols < rows) {
    throw new RangeError(`assign needs at least as many columns as rows, got ${cols} for ${rows}`);
  }

  // One-indexed working arrays: index 0 is the algorithm's virtual row/column,
  // which is what lets an augmenting path start from "nowhere" without a
  // special case on every loop. `potentialRow`/`potentialCol` are the duals.
  const potentialRow = new Float64Array(rows + 1);
  const potentialCol = new Float64Array(cols + 1);
  /** `rowAt[c]` is the row currently holding column `c`, or 0 for none. */
  const rowAt = new Int32Array(cols + 1);
  /** Back-pointers along the augmenting path being built. */
  const cameFrom = new Int32Array(cols + 1);

  const minSlack = new Float64Array(cols + 1);
  const visited = new Uint8Array(cols + 1);

  for (let row = 1; row <= rows; row += 1) {
    rowAt[0] = row;
    let col = 0;
    minSlack.fill(Infinity);
    visited.fill(0);

    // Grow a shortest augmenting path from `row` until it reaches a free
    // column. Each pass either extends the path or improves the duals; the
    // loop cannot spin, because every pass marks one more column visited.
    do {
      visited[col] = 1;
      const fromRow = rowAt[col] ?? 0;
      let delta = Infinity;
      let nextCol = NONE;

      for (let c = 1; c <= cols; c += 1) {
        if (visited[c]) continue;
        const reduced = (cost[fromRow - 1]?.[c - 1] ?? Infinity)
          - (potentialRow[fromRow] ?? 0) - (potentialCol[c] ?? 0);
        if (reduced < minSlack[c]!) {
          minSlack[c] = reduced;
          cameFrom[c] = col;
        }
        if (minSlack[c]! < delta) {
          delta = minSlack[c]!;
          nextCol = c;
        }
      }

      if (nextCol === NONE) {
        // Unreachable for a finite cost matrix with cols >= rows, but a NaN or
        // an Infinity in the input would land here rather than looping forever.
        throw new RangeError('assign received a cost matrix with no finite assignment');
      }

      // Shift the duals so the chosen edge becomes tight, keeping every
      // already-tight edge tight.
      for (let c = 0; c <= cols; c += 1) {
        if (visited[c]) {
          potentialRow[rowAt[c]!] = potentialRow[rowAt[c]!]! + delta;
          potentialCol[c] = potentialCol[c]! - delta;
        } else {
          minSlack[c] = minSlack[c]! - delta;
        }
      }
      col = nextCol;
    } while (rowAt[col] !== 0);

    // Walk the path back, flipping each edge: every column on it takes the row
    // its predecessor held, and the free column at the end takes `row`.
    do {
      const previous = cameFrom[col]!;
      rowAt[col] = rowAt[previous]!;
      col = previous;
    } while (col !== 0);
  }

  const columnFor = new Array<number>(rows).fill(NONE);
  let total = 0;
  for (let c = 1; c <= cols; c += 1) {
    const row = rowAt[c]!;
    if (row > 0) {
      columnFor[row - 1] = c - 1;
      total += cost[row - 1]?.[c - 1] ?? 0;
    }
  }
  return { columnFor, cost: total };
}

/**
 * Assign every row to the distinct column that maximises the total score.
 *
 * The form callers actually want: team selection maximises fit rather than
 * minimising cost, and negating in one place is better than every caller
 * remembering to.
 */
export function assignMax(score: readonly (readonly number[])[]): AssignmentResult {
  const negated = score.map((row) => row.map((value) => -value));
  const result = assign(negated);
  return { columnFor: result.columnFor, cost: -result.cost };
}
