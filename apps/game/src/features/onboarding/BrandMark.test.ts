import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * `BrandMark` carries the traced crest as a literal, and it has to.
 *
 * It renders in the entry chunk, before anything else has downloaded, so it
 * cannot import the path from a data file the bundler would have to resolve
 * separately, and it certainly cannot fetch it. The cost of that is a copy —
 * and a copy of generated output is a copy that goes stale the first time
 * somebody re-runs the tracer and forgets the paste.
 *
 * So: this compares the literal against the tracer's committed output. It
 * fails loudly on a mark that has been regenerated but not carried across,
 * which is the one way this file can be wrong without anything looking wrong.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(here, '..', '..', '..', '..', '..');

const source = readFileSync(path.join(here, 'BrandMark.tsx'), 'utf8');
const traced = readFileSync(path.join(repoRoot, 'tools/brand/mark.path.txt'), 'utf8').trim();

describe('the drawn brand mark', () => {
  it('inlines exactly the path the tracer last wrote', () => {
    const match = /const MARK_PATH =\s*'([^']+)';/.exec(source);
    expect(match, 'BrandMark.tsx no longer declares a single-quoted MARK_PATH').not.toBeNull();
    expect(match?.[1]).toBe(traced);
  });

  it('fills that path with even-odd, so the counters stay open', () => {
    // Without this the C and the F fill solid and the mark becomes a blob —
    // legible enough at 56px to survive review, and wrong at 16px in a tab.
    expect(source).toContain('fillRule="evenodd"');
  });

  it('takes its colour from the cascade rather than a hard-coded value', () => {
    // The mark sits on graphite in the app and on white in a share image; a
    // literal fill would be invisible on one of them.
    expect(source).toContain('fill="currentColor"');
  });
});
