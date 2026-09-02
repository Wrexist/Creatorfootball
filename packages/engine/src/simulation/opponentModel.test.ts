import { describe, expect, it } from 'vitest';
import { DEFAULT_TACTICS, type TacticSetup } from '../tactics/tactics';
import {
  EMPTY_OPPONENT_MODEL, MAX_SAMPLES, counterPlan, counterThreshold,
  observeTactics, readOpponent, type OpponentModel,
} from './opponentModel';

const tactics = (over: Partial<TacticSetup> = {}): TacticSetup => ({
  ...DEFAULT_TACTICS,
  formationId: '3-2-1',
  lineup: {},
  bench: [],
  captainId: null,
  setPieceTakerId: null,
  penaltyTakerId: null,
  ...over,
});

const BUS = tactics({ press: 'LOW_BLOCK', risk: 'CAUTIOUS' });
const PRESS = tactics({ press: 'HIGH_PRESS', line: 'HIGH' });

const observeMany = (t: TacticSetup, times: number, from: OpponentModel = EMPTY_OPPONENT_MODEL): OpponentModel => {
  let model = from;
  for (let i = 0; i < times; i++) model = observeTactics(model, t, i + 1);
  return model;
};

describe('opponent model', () => {
  it('files one observation per match, newest last', () => {
    const model = observeMany(BUS, 3);
    expect(model.samples).toHaveLength(3);
    expect(model.samples.at(-1)?.cycle).toBe(3);
    expect(model.samples.every((s) => s.shape === 'LOW_BLOCK')).toBe(true);
  });

  it('keeps the window bounded so a long career cannot grow the save', () => {
    const model = observeMany(BUS, MAX_SAMPLES + 20);
    expect(model.samples).toHaveLength(MAX_SAMPLES);
    // The window holds the most recent matches, not the first ones.
    expect(model.samples.at(-1)?.cycle).toBe(MAX_SAMPLES + 20);
  });

  it('claims to know nothing from a single match', () => {
    expect(readOpponent(observeMany(BUS, 1)).shape).toBeNull();
    expect(readOpponent(EMPTY_OPPONENT_MODEL).shape).toBeNull();
  });

  it('grows more confident as a pattern repeats', () => {
    const two = readOpponent(observeMany(BUS, 2)).shape;
    const four = readOpponent(observeMany(BUS, 4)).shape;
    expect(two).not.toBeNull();
    expect(four).not.toBeNull();
    expect(four?.confidence).toBeGreaterThan(two?.confidence ?? 1);
    expect(four?.value).toBe('LOW_BLOCK');
  });

  it('never reads a player who mixes their approach up', () => {
    let model = EMPTY_OPPONENT_MODEL;
    model = observeTactics(model, BUS, 1);
    model = observeTactics(model, PRESS, 2);
    model = observeTactics(model, tactics(), 3);
    model = observeTactics(model, PRESS, 4);

    // Nobody, however sharp, gets a confident read on this.
    expect(counterPlan(readOpponent(model), 100).lean).toEqual({});
  });

  it('believes a genuine change of approach once it has been repeated', () => {
    // A long history of parking the bus...
    let model = observeMany(BUS, MAX_SAMPLES);
    expect(counterPlan(readOpponent(model), 100).lean.press).toBe('HIGH_PRESS');

    // ...then the player changes, and keeps changing.
    model = observeMany(PRESS, MAX_SAMPLES, model);
    const lean = counterPlan(readOpponent(model), 100).lean;
    expect(lean.line).toBe('DEEP');
    expect(lean.buildUp).toBe('BYPASS');
  });

  it('makes a sharper manager act on less evidence than a poor one', () => {
    expect(counterThreshold(100)).toBeLessThan(counterThreshold(0));

    const model = observeMany(BUS, 2);
    const sharp = counterPlan(readOpponent(model), 95).lean;
    const blunt = counterPlan(readOpponent(model), 10).lean;

    expect(sharp.press).toBe('HIGH_PRESS');
    // The poor manager has seen exactly the same thing and has not acted yet.
    expect(blunt).toEqual({});
  });

  it('crowds a flank the player keeps using, and says so', () => {
    const model = observeMany(tactics({ focus: 'LEFT' }), 4);
    const plan = counterPlan(readOpponent(model), 100);
    expect(plan.lean.marking).toBe('MAN');
    expect(plan.lean.width).toBe('NARROW');
    expect(plan.notes.join(' ')).toContain('left');
  });

  it('leaves a balanced side alone rather than drifting to a league average', () => {
    const plan = counterPlan(readOpponent(observeMany(tactics(), 6)), 100);
    expect(plan.lean).toEqual({});
    expect(plan.notes).toEqual([]);
  });

  it('always explains, in words, whatever it has decided to do', () => {
    const model = observeMany(BUS, 4);
    const plan = counterPlan(readOpponent(model), 100);
    // A silent counter is a counter the player cannot learn from.
    expect(Object.keys(plan.lean).length).toBeGreaterThan(0);
    expect(plan.notes.length).toBeGreaterThan(0);
    expect(plan.notes.every((n) => n.trim().length > 0)).toBe(true);
  });

  /**
   * The preview warns in the future tense; the result screen explains in the
   * past. Both come from the one decision, so a match can never be previewed
   * with one read and recapped with another.
   */
  it('tells the same read before and after the match', () => {
    const model = observeMany(BUS, 4);
    const plan = counterPlan(readOpponent(model), 100);
    expect(plan.recap).toHaveLength(plan.notes.length);
    expect(plan.recap.every((r) => r.trim().length > 0)).toBe(true);
    // Past tense, not a restatement of the warning.
    expect(plan.recap[0]).toMatch(/came in having watched/);
    expect(plan.notes[0]).not.toMatch(/came in having watched/);
  });

  it('has nothing to recap when it had nothing to say', () => {
    const plan = counterPlan(readOpponent(observeMany(tactics(), 6)), 100);
    expect(plan.recap).toEqual([]);
  });

  it('records the observation, never the live tactics object', () => {
    const model = observeTactics(EMPTY_OPPONENT_MODEL, BUS, 1);
    const sample = model.samples[0];
    expect(sample).toBeDefined();
    expect(Object.keys(sample ?? {}).sort()).toEqual(['cycle', 'focus', 'formationId', 'shape']);
  });
});
