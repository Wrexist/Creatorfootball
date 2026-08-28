import { describe, expect, it } from 'vitest';
import { chooseFit, type FitInputs } from './FitText';
import { snapToScale } from './type';

/**
 * The fitting decision, without a DOM.
 *
 * `chooseFit` is the whole of `FitText`'s judgement — which candidate, at what
 * size, wrapped or not. It is pure: it asks a callback how wide a string is and
 * does arithmetic on the answer. That matters here because the bug this guards
 * is arithmetic, and arithmetic bugs in layout are invisible until two pieces
 * of text are already printed on top of each other.
 *
 * The bug: a wrapped name was sized from the *area* it needed — total width
 * divided across the line budget — which says nothing about any one line. A
 * name whose longest word was wider than the slot at that size overflowed
 * sideways, and since these live in flex rows that do not clip, the overflow
 * landed on whatever sat beside it. On the home screen that was the scoreline:
 * "Liverpool FC" printed straight through the "2".
 */

/**
 * Stand-in for text measurement: a fixed width per character at the reference
 * size. Real faces are proportional, but every constraint under test is a
 * *ratio* of two measured widths, and a ratio does not care.
 *
 * 55 units per character at a 100px reference is about right for the bold
 * display face these names are set in.
 */
const CHAR = 55;
const widthAt = (text: string): number => text.length * CHAR;

/**
 * The slot that actually broke, measured off a 393pt phone: the club-name half
 * of `ScorePanel` is about 79px wide once the colour post, the badge and the
 * gaps are taken out, and its name is set in the `section` role — a 17px
 * ceiling over a 13px floor — across two lines.
 */
const scorePanel = (over: Partial<FitInputs> = {}): FitInputs => ({
  available: 79,
  lines: 2,
  floor: 13,
  ceiling: 17,
  quantise: snapToScale,
  widthAt,
  reference: 100,
  ...over,
});

/** Width the longest word of `text` actually renders at, in px. */
const longestWordAt = (text: string, size: number): number =>
  Math.max(...text.split(/\s+/).map((word) => (widthAt(word) / 100) * size));

describe('chooseFit on one line', () => {
  it('takes the full name at the ceiling when it fits outright', () => {
    const result = chooseFit(['Vale'], scorePanel({ available: 200 }));
    expect(result).toMatchObject({ text: 'Vale', wrap: false, size: 17 });
  });

  it('shrinks within the role before reaching for a shorter name', () => {
    // A complete name that has to shrink beats an abbreviation that does not.
    const result = chooseFit(
      ['Saltpine Harriers', 'Saltpine', 'SPH'],
      scorePanel({ lines: 1, available: 150 }),
    );
    expect(result?.text).toBe('Saltpine Harriers');
    expect(result?.size).toBeLessThan(17);
    expect(result?.size).toBeGreaterThanOrEqual(13);
  });

  it('falls through to the short name only once the floor fails', () => {
    const result = chooseFit(
      ['Saltpine Harriers', 'Saltpine', 'SPH'],
      scorePanel({ lines: 1, available: 60 }),
    );
    expect(result?.text).toBe('Saltpine');
  });

  it('reports nothing fitting rather than returning an overflowing size', () => {
    // The caller's cue to drop to the floor and break mid-word. Quietly
    // returning a floor-clamped size here is the subtle form of the same bug —
    // snapping clamps upward, so an answer of 4px comes back as 11px and looks
    // like it fits while overflowing by the width of the card.
    expect(chooseFit(['Unbreakablename'], scorePanel({ lines: 1, available: 8 }))).toBeNull();
  });
});

describe('chooseFit when it has to wrap', () => {
  it('never sizes a name so its longest word overflows the slot', () => {
    // The regression, in the exact slot it shipped in. Sized from area alone
    // this came back at the 17px ceiling, where "Liverpool" alone is 84px wide
    // in a 79px slot — and those 5px landed on the scoreline.
    const result = chooseFit(['Liverpool FC'], scorePanel());
    expect(result).not.toBeNull();
    expect(result?.wrap).toBe(true);
    expect(longestWordAt('Liverpool FC', result?.size ?? 0)).toBeLessThanOrEqual(79);
  });

  it('holds that guarantee across names and slot widths', () => {
    const names = [
      'Liverpool FC', 'Saltpine Harriers United', 'Duskford Rovers',
      'Vantage Point FC', 'Kingsway Athletic', 'A B',
    ];
    for (const name of names) {
      for (const available of [40, 60, 79, 100, 160]) {
        const result = chooseFit([name], scorePanel({ available }));
        if (!result?.wrap) continue;
        const rendered = longestWordAt(result.text, result.size);
        expect(rendered, `"${name}" in ${available}px overflows by ${rendered - available}px`)
          .toBeLessThanOrEqual(available);
      }
    }
  });

  it('still prefers wrapping the full name over shortening it', () => {
    // The word constraint tightens the chosen size. It must not tighten it so
    // far that the full name drops below the floor and the abbreviation wins —
    // the whole point of this primitive is that names do not get shortened
    // while there is still a legible size available.
    const result = chooseFit(['Duskford Rovers', 'Duskford', 'DKR'], scorePanel());
    expect(result).toMatchObject({ text: 'Duskford Rovers', wrap: true });
  });

  it('will not wrap a single word, which has nowhere to break', () => {
    // "Kings / way" is a worse outcome than "KWR", so a candidate with no
    // break opportunity is passed over rather than snapped in half.
    const result = chooseFit(['Kingsway', 'KWR'], scorePanel({ available: 30 }));
    expect(result?.text).toBe('KWR');
  });
});
