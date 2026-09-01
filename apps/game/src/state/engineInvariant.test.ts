import { describe, expect, it } from 'vitest';
import { readdirSync, readFileSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

/**
 * The snapshot-compute-apply invariant.
 *
 * A feature engine takes a decision like this:
 *
 *     const s = useGameStore.getState().state;   // snapshot
 *     const result = engineFunction(s, ...);     // compute from the snapshot
 *     store.apply((current) => merge(current, result));
 *
 * `apply` hands the mutator the *live* state, but the values being merged in
 * were computed from the snapshot. Six of the ten call sites in this app do
 * exactly that, and one ignores `current` altogether and returns a state built
 * wholly from its snapshot.
 *
 * That is safe today for one reason and one reason only: every one of these
 * paths runs to completion synchronously, so the live state cannot have moved
 * between the snapshot and the apply. Nothing states that requirement, and
 * nothing enforces it. A future author adding a single `await` — to confirm a
 * transfer with a dialog, to fetch something, to await a haptic — would open a
 * window in which the cycle can advance, and the apply would then write
 * snapshot-derived data over a newer world. Money computed against last week's
 * ledger, a squad written over a squad that has since changed. It would not
 * throw, and it would not fail a test. It would just quietly be wrong.
 *
 * So the invariant is:
 *
 *   A module that commits state through `apply` must contain no asynchronous
 *   boundary. Snapshot, compute and apply must occur in one synchronous run.
 *
 * This test enforces it. It finds the modules by looking for `.apply(` rather
 * than from a hardcoded list, so an engine written next year is covered the day
 * it is written, and the guard cannot drift away from the code it guards.
 *
 * If a feature genuinely needs to await something, the await belongs *outside*
 * the snapshot: do the async work first, then snapshot, compute and apply.
 */

const FEATURES = fileURLToPath(new URL('../features', import.meta.url));

function sourceFiles(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry);
    if (statSync(path).isDirectory()) { out.push(...sourceFiles(path)); continue; }
    if (/\.tsx?$/.test(entry) && !/\.test\.tsx?$/.test(entry)) out.push(path);
  }
  return out;
}

/**
 * Comments and string literals removed, so the word "await" in a sentence and
 * a route called "/async" cannot fail the build.
 */
function stripNonCode(source: string): string {
  return source
    .replace(/\/\*[\s\S]*?\*\//g, ' ')
    .replace(/(^|[^:])\/\/[^\n]*/g, '$1 ')
    .replace(/`(?:\\[\s\S]|[^\\`])*`/g, '``')
    .replace(/'(?:\\[\s\S]|[^\\'])*'/g, "''")
    .replace(/"(?:\\[\s\S]|[^\\"])*"/g, '""');
}

/** Anything that can yield execution mid-function. */
const ASYNC_BOUNDARIES: readonly { readonly pattern: RegExp; readonly what: string }[] = [
  { pattern: /\basync\b/, what: 'an async function' },
  { pattern: /\bawait\b/, what: 'an await' },
  { pattern: /\.then\s*\(/, what: 'a .then() continuation' },
  { pattern: /\bnew\s+Promise\b/, what: 'a Promise' },
];

interface Committer { readonly file: string; readonly code: string; readonly applyCount: number; }

const committers: Committer[] = sourceFiles(FEATURES)
  .map((file) => ({ file, code: stripNonCode(readFileSync(file, 'utf8')) }))
  .filter((f) => /\.apply\s*\(/.test(f.code))
  .map((f) => ({ ...f, applyCount: (f.code.match(/\.apply\s*\(/g) ?? []).length }));

const relative = (file: string): string => file.slice(FEATURES.length + 1);

describe('snapshot-compute-apply invariant', () => {
  it('finds the modules that commit game state', () => {
    // A guard that silently matches nothing is worse than no guard, so the
    // discovery itself is asserted.
    expect(committers.length).toBeGreaterThan(0);
    const total = committers.reduce((sum, c) => sum + c.applyCount, 0);
    expect(total).toBeGreaterThanOrEqual(committers.length);
  });

  it.each(committers.map((c) => [relative(c.file), c] as const))(
    '%s commits state without an async boundary',
    (_name, committer) => {
      const found = ASYNC_BOUNDARIES.filter((b) => b.pattern.test(committer.code));
      expect(
        found.map((b) => b.what),
        `${relative(committer.file)} commits state through apply() and now contains ` +
        `${found.map((b) => b.what).join(' and ')}. Between snapshotting state and ` +
        'applying results derived from it, execution must not yield: the world can ' +
        'move in that window and the apply would write stale data over it. Do the ' +
        'async work first, then snapshot, compute and apply in one synchronous run.',
      ).toEqual([]);
    },
  );
});
