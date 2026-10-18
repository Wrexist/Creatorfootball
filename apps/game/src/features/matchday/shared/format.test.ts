import { describe, expect, it } from 'vitest';
import { ordinal, sidesWord } from '../../../design/domain/numbers';
import { matchExitPlan } from './format';

/**
 * The exit rule once lived inline in MatchLiveScreen; extracting it made the
 * one rule that decides whether a live match can be walked away from testable.
 */
describe('matchExitPlan', () => {
  it('lets the player walk out freely before kick-off', () => {
    expect(matchExitPlan('IDLE')).toBe('LEAVE');
  });

  it('plays the match out from the first tick, so a live match cannot be quit and replayed', () => {
    expect(matchExitPlan('PLAYING')).toBe('PLAY_OUT');
    expect(matchExitPlan('PAUSED')).toBe('PLAY_OUT');
    expect(matchExitPlan('AWAITING_DECISION')).toBe('PLAY_OUT');
  });

  it('never routes around the save after full time', () => {
    expect(matchExitPlan('COMPLETE')).toBe('SAVE_RESULT');
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
