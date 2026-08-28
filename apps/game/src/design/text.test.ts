import { describe, expect, it } from 'vitest';
import { humanise, ordinalWord, plural, sentenceCase } from './text';

/**
 * `humanise` exists because four different versions of it did.
 *
 * The match screens, the club screens, the squad screens and the social feed
 * had each written their own `value.replace(/_/g, ' ').toLowerCase()`, and one
 * of them — the broadcast view's — lower-cased only the tail of the string, so
 * the same engine constant came out as "high press trigger" in one place and
 * "High press trigger" in another. That is not a formatting preference; it is
 * two different answers to the same question in one product.
 */

describe('humanise', () => {
  it('turns an engine constant into words', () => {
    expect(humanise('HIGH_PRESS_TRIGGER')).toBe('high press trigger');
    expect(humanise('fan_unrest')).toBe('fan unrest');
    expect(humanise('kebab-case-value')).toBe('kebab case value');
  });

  it('lower-cases the whole string, not just the tail', () => {
    // The specific bug in the version this replaced: `value.charAt(0) +
    // value.slice(1).toLowerCase()` leaves the first character shouting.
    expect(humanise('WIN')).toBe('win');
    expect(humanise('DERBY_DEFEAT')).toBe('derby defeat');
  });

  it('collapses runs of separators rather than leaving gaps', () => {
    expect(humanise('a__b')).toBe('a b');
    expect(humanise('_leading')).toBe('leading');
    expect(humanise('trailing_')).toBe('trailing');
  });

  it('composes with sentenceCase for the places that want a capital', () => {
    expect(sentenceCase(humanise('MARQUEE_SIGNING'))).toBe('Marquee signing');
  });

  it('is safe on an empty string', () => {
    expect(humanise('')).toBe('');
  });
});

describe('sentenceCase', () => {
  it('capitalises the first letter and leaves the rest alone', () => {
    expect(sentenceCase('hamstring strain')).toBe('Hamstring strain');
    // Deliberately does not lower-case the tail: engine copy sometimes carries
    // a proper noun, and "Won at Ashcombe" must not become "Won at ashcombe".
    expect(sentenceCase('won at Ashcombe')).toBe('Won at Ashcombe');
  });

  it('is safe on an empty string', () => {
    expect(sentenceCase('')).toBe('');
  });
});

describe('plural', () => {
  it('picks the singular only for exactly one', () => {
    expect(plural(1, 'game', 'games')).toBe('game');
    expect(plural(0, 'game', 'games')).toBe('games');
    expect(plural(2, 'game', 'games')).toBe('games');
  });
});

describe('ordinalWord', () => {
  it('says a league position rather than numbering it', () => {
    expect(ordinalWord(1)).toBe('first');
    expect(ordinalWord(12)).toBe('twelfth');
  });

  it('falls back to a numeral once the words stop earning their space', () => {
    expect(ordinalWord(13)).toBe('13th');
  });
});
