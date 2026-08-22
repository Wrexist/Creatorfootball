import { describe, expect, it } from 'vitest';
import type { DecisionOutcome, DecisionTrigger } from '../matches/decisions';
import type { DecisionRecord } from './state';
import { foldDecisionRecord, initialDecisionRecord } from './decisionRecord';

const graded = (
  trigger: DecisionTrigger,
  verdict: 'WORKED' | 'NEUTRAL' | 'BACKFIRED',
): DecisionOutcome =>
  ({ promptId: `p_${trigger}_${verdict}`, optionId: 'o1', minute: 12, trigger, evaluation: { xgDelta: 0.1, xgAgainstDelta: 0, verdict } });

const ungraded = (trigger: DecisionTrigger): DecisionOutcome =>
  ({ promptId: `p_${trigger}_raw`, optionId: 'o1', minute: 30, trigger });

describe('foldDecisionRecord', () => {
  it('seeds an empty record', () => {
    expect(initialDecisionRecord()).toEqual({});
  });

  it('counts served and worked per trigger', () => {
    const record = foldDecisionRecord(initialDecisionRecord(), [
      graded('HALFTIME_TALK', 'WORKED'),
      graded('UNDER_PRESSURE', 'BACKFIRED'),
    ]);

    expect(record.HALFTIME_TALK).toEqual({ served: 1, worked: 1, matches: 1 });
    expect(record.UNDER_PRESSURE).toEqual({ served: 1, worked: 0, matches: 1 });
  });

  it('counts NEUTRAL calls as served but not worked', () => {
    const record = foldDecisionRecord(initialDecisionRecord(), [graded('CHASING_GAME', 'NEUTRAL')]);
    expect(record.CHASING_GAME).toEqual({ served: 1, worked: 0, matches: 1 });
  });

  it('repeats within one match add to served and worked but only once to matches', () => {
    const record = foldDecisionRecord(initialDecisionRecord(), [
      graded('PROTECTING_LEAD', 'WORKED'),
      graded('PROTECTING_LEAD', 'WORKED'),
      graded('PROTECTING_LEAD', 'NEUTRAL'),
    ]);

    expect(record.PROTECTING_LEAD).toEqual({ served: 3, worked: 2, matches: 1 });
  });

  it('accumulates across matches', () => {
    let record: DecisionRecord = initialDecisionRecord();
    record = foldDecisionRecord(record, [graded('MOMENTUM_SWING', 'WORKED')]);
    record = foldDecisionRecord(record, [graded('MOMENTUM_SWING', 'BACKFIRED')]);

    expect(record.MOMENTUM_SWING).toEqual({ served: 2, worked: 1, matches: 2 });
  });

  it('ignores decisions the engine could not grade', () => {
    const record = foldDecisionRecord(initialDecisionRecord(), [
      ungraded('CARD_RISK'),
      ({ promptId: 'p_raw_no_trigger', optionId: 'o1', minute: 44, evaluation: { xgDelta: 0, xgAgainstDelta: 0, verdict: 'WORKED' } }),
    ]);

    expect(record).toEqual({});
  });

  it('leaves untouched triggers alone', () => {
    const before: DecisionRecord = { SET_PIECE_CALL: { served: 4, worked: 3, matches: 3 } };
    const record = foldDecisionRecord(before, [graded('INJURY_DECISION', 'WORKED')]);

    expect(record.SET_PIECE_CALL).toEqual({ served: 4, worked: 3, matches: 3 });
    expect(record.INJURY_DECISION).toEqual({ served: 1, worked: 1, matches: 1 });
  });
});
