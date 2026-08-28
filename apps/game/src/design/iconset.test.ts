import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * The icon sheet, read as source rather than rendered.
 *
 * Icons are hand-drawn here, one `<path d="…">` at a time, and the failure mode
 * that costs the most is the one nobody sees while drawing: two glyphs that end
 * up as the same picture. In the sheet they are two entries with two names; in
 * the product they are two icon-only buttons side by side in a header, doing
 * different things, wearing the same silhouette — which is exactly what
 * happened to "reorder the squad" and "sort and filter", both drawn as a pair of
 * opposed vertical arrows.
 *
 * The test is deliberately a *source* test. Rendering the set needs a DOM the
 * suite does not have, and the geometry is what the question is about anyway.
 */

const here = path.dirname(fileURLToPath(import.meta.url));
const source = readFileSync(path.join(here, 'icons.tsx'), 'utf8');

/** Every `icon('Name', …)` entry with the drawing commands inside it. */
function drawings(): Map<string, string> {
  const found = new Map<string, string>();
  // Each entry runs from its name to the start of the next one, which is
  // enough: the file is one flat list of them.
  const starts = [...source.matchAll(/icon\('(\w+)',/g)];
  starts.forEach((match, index) => {
    const from = match.index ?? 0;
    const to = index + 1 < starts.length ? (starts[index + 1]?.index ?? source.length) : source.length;
    const body = source.slice(from, to);
    const geometry = [...body.matchAll(/\b(?:d|cx|cy|r|x|y|width|height|rx|points|transform)="([^"]*)"/g)]
      .map((m) => m[1])
      .join('|')
      .replace(/\s+/g, ' ')
      .trim();
    found.set(match[1] ?? '', geometry);
  });
  return found;
}

describe('the icon set', () => {
  const set = drawings();

  it('was parsed at all', () => {
    // Guards the regex above: a rewrite of the file that this cannot read would
    // otherwise make every assertion below pass vacuously.
    expect(set.size).toBeGreaterThan(40);
    expect(set.get('IconSort')).toBeTruthy();
  });

  it('draws no two icons identically', () => {
    const byGeometry = new Map<string, string[]>();
    for (const [name, geometry] of set) {
      if (!geometry) continue;
      byGeometry.set(geometry, [...(byGeometry.get(geometry) ?? []), name]);
    }
    const collisions = [...byGeometry.values()].filter((names) => names.length > 1);
    expect(collisions, `these icons are the same drawing: ${JSON.stringify(collisions)}`).toEqual([]);
  });

  it('keeps sort and swap visually apart, since they sit side by side', () => {
    // The specific pair this test was written for. They are not merely
    // different drawings — one runs along y and the other along x, so no amount
    // of squinting at a 24px button confuses them.
    const sort = set.get('IconSort') ?? '';
    const swap = set.get('IconSwap') ?? '';
    expect(sort).not.toBe(swap);
    // `V`/`v` draw a vertical line, `H`/`h` a horizontal one; the shorthand is
    // how each of these two states its axis.
    expect(/[Vv]\d/.test(sort), 'IconSort should run vertically').toBe(true);
    expect(/[Hh]\d/.test(swap), 'IconSwap should run horizontally').toBe(true);
  });
});
