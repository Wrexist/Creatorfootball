import { describe, expect, it } from 'vitest';
import type { DecisionTrigger } from '@cf/engine';
import { masteryLines } from './mastery';

const tally = (served: number, worked: number, matches: number) => ({ served, worked, matches });

describe('masteryLines', () => {
  it('says nothing when no call has ever been graded', () => {
    expect(masteryLines({})).toEqual([]);
  });

  it('phrases one family as a single honest line', () => {
    const lines = masteryLines({
      UNDER_PRESSURE: tally(18, 11, 23),
    });

    expect(lines).toEqual(['Your pressing calls: 61% worked across 23 matches.']);
  });

  it('uses the singular for a single match', () => {
    const lines = masteryLines({
      HALFTIME_TALK: tally(1, 1, 1),
    });

    expect(lines).toEqual(['Your half-time talks: 100% worked across 1 match.']);
  });

  it('rounds the rate without ever promising more than happened', () => {
    const lines = masteryLines({
      CHASING_GAME: tally(3, 0, 2),
    });

    expect(lines).toEqual(['Your chasing-the-game calls: 0% worked across 2 matches.']);
  });

  it('emits one line per family with history, in trigger order', () => {
    const lines = masteryLines({
      SET_PIECE_CALL: tally(4, 1, 3),
      UNDER_PRESSURE: tally(10, 5, 6),
    });

    expect(lines).toHaveLength(2);
    expect(lines[0]).toMatch(/pressing calls/);
    expect(lines[1]).toMatch(/set-piece calls/);
  });

  it('covers every trigger a record could name', () => {
    const triggers: DecisionTrigger[] = [
      'UNDER_PRESSURE', 'STRIKER_ISOLATED', 'LOSING_MIDFIELD', 'CHASING_GAME',
      'PROTECTING_LEAD', 'MOMENTUM_SWING', 'KEY_PLAYER_TIRED', 'OPPONENT_SHAPE_CHANGE',
      'INJURY_DECISION', 'CARD_RISK', 'SPECIAL_RULE_CHOICE', 'CREATOR_OPPORTUNITY',
      'HALFTIME_TALK', 'SET_PIECE_CALL',
    ];
    for (const trigger of triggers) {
      expect(masteryLines({ [trigger]: tally(2, 1, 2) })[0]).toContain(trigger === 'HALFTIME_TALK' ? 'talks' : 'calls');
    }
  });
});
