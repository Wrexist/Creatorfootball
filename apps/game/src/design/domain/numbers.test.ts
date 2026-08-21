import { describe, expect, it } from 'vitest';
import { formatCount, formatDelta, formatMoney, formatWeeks, sidesWord } from './numbers';

/**
 * The post-match screen once printed `-8.157399521093865`, twice, on a tile
 * whose value was rounded and whose delta was not. The cause was a default
 * format that passed the raw number straight through, so every caller that did
 * not supply its own formatter inherited the defect. These lock the default
 * path shut: anything that can reach a screen unrounded eventually will.
 */
describe('formatDelta', () => {
  it('never emits a raw float', () => {
    expect(formatDelta(-8.157399521093865)).toBe('-8.2');
    expect(formatDelta(0.1 + 0.2)).toBe('+0.3');
  });

  it('keeps integers exact and groups them', () => {
    expect(formatDelta(4)).toBe('+4');
    expect(formatDelta(-1200)).toBe('-1,200');
    expect(formatDelta(0)).toBe('0');
  });

  it('drops the decimal where a tenth is noise', () => {
    expect(formatDelta(1284.62)).toBe('+1,285');
  });

  it('honours an explicit precision', () => {
    expect(formatDelta(-8.157399521093865, 3)).toBe('-8.157');
    expect(formatDelta(2.5, 0)).toBe('+3');
  });

  it('never signs a rounded zero', () => {
    expect(formatDelta(-0.000001)).toBe('0');
    expect(formatDelta(0.0004)).toBe('0');
  });

  it('produces nothing longer than a person would write', () => {
    for (const value of [1 / 3, -2 / 7, 12345.6789, -0.000001, 99.95, Math.PI]) {
      const digits = formatDelta(value).replace(/^[+-]/, '');
      expect(digits, `formatDelta(${value})`).toMatch(/^\d{1,3}(,\d{3})*(\.\d)?$/);
    }
  });
});

/**
 * The engine's tick is a "cycle". Players do not have cycles, they have
 * matchweeks - and the product was rendering both, for the same field, one tab
 * apart. Every duration the kit shows comes through this one function.
 */
describe('formatWeeks', () => {
  it('speaks in weeks, never cycles', () => {
    expect(formatWeeks(3)).toBe('3w');
    expect(formatWeeks(3, 'long')).toBe('3 weeks');
    expect(formatWeeks(1, 'long')).toBe('1 week');
  });

  it('rounds and never goes negative', () => {
    expect(formatWeeks(2.6)).toBe('3w');
    expect(formatWeeks(-4)).toBe('0w');
  });
});

/** The two compact formatters are load-bearing on every dashboard. */
describe('compact figures', () => {
  it('formats money without ever showing a float tail', () => {
    expect(formatMoney(8_400_000)).toBe('£8.40M');
    expect(formatMoney(-1_234)).toBe('-£1.2K');
    expect(formatMoney(8_400_000, false)).toBe('£8,400,000');
  });

  it('formats counts the way a follower total reads', () => {
    expect(formatCount(96_000)).toBe('96.0K');
    expect(formatCount(14_000_000)).toBe('14M');
  });
});

describe('sidesWord', () => {
  it('names the small-sided counts this game actually fields', () => {
    expect(sidesWord(7)).toBe('seven');
  });

  it('keeps working for a conventional full side', () => {
    expect(sidesWord(11)).toBe('eleven');
  });

  it('falls back to digits for anything else', () => {
    expect(sidesWord(4)).toBe('4');
    expect(sidesWord(0)).toBe('0');
    expect(sidesWord(13)).toBe('13');
  });
});
