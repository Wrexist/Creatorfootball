import { describe, expect, it } from 'vitest';
import { ordinal, sidesWord } from '../../../design/domain/numbers';
import { shouldConfirmMatchExit } from './format';

/**
 * The exit gate once lived inline in MatchLiveScreen; extracting it made the
 * one rule that protects a live match from a stray tap testable at all.
 */
describe('shouldConfirmMatchExit', () => {
  it('asks nothing before kick-off', () => {
    expect(shouldConfirmMatchExit(0, 'PLAYING')).toBe(false);
    expect(shouldConfirmMatchExit(0, 'IDLE')).toBe(false);
  });

  it('asks nothing after full time', () => {
    expect(shouldConfirmMatchExit(30, 'COMPLETE')).toBe(false);
  });

  it('guards every minute after the first, in any live state', () => {
    expect(shouldConfirmMatchExit(1, 'PLAYING')).toBe(true);
    expect(shouldConfirmMatchExit(14, 'PAUSED')).toBe(true);
    expect(shouldConfirmMatchExit(22, 'AWAITING_DECISION')).toBe(true);
  });
});

describe('ordinal', () => {
  it('says positions the way tables do', () => {
    expect(ordinal(1)).toBe('1st');
    expect(ordinal(2)).toBe('2nd');
    expect(ordinal(3)).toBe('3rd');
    expect(ordinal(4)).toBe('4th');
    expect(ordinal(7)).toBe('7th');
    expect(ordinal(12)).toBe('12th');
  });

  it('survives the teens and larger fields', () => {
    expect(ordinal(11)).toBe('11th');
    expect(ordinal(13)).toBe('13th');
    expect(ordinal(21)).toBe('21st');
    expect(ordinal(22)).toBe('22nd');
  });
});

describe('sidesWord', () => {
  it('names the small-sided counts this game actually fields', () => {
    expect(sidesWord(7)).toBe('seven');
    expect(sidesWord(11)).toBe('eleven');
  });
});
