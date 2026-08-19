import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { BALANCE } from './balance';
import {
  buildChance, computeAggregates, defensivePressure, effectiveAttribute, fatigueDelta,
  resolveShot, rollInjury,
} from './model';
import type { ChanceInput, EffectiveContext, UnitView } from './model';
import { makeTestPlayer } from './testSupport';
import { toTacticVector } from '../tactics/vector';
import { DEFAULT_TACTICS } from '../tactics/tactics';
import { DEFAULT_FORMATION_ID } from '../tactics/formations';

const rng = new Rng('model');
const striker = makeTestPlayer(rng, { id: 'st1', position: 'ST', target: 70, age: 26 });
const keeper = makeTestPlayer(rng, { id: 'gk1', position: 'GK', target: 70, age: 28 });

const ctx = (over: Partial<EffectiveContext> = {}): EffectiveContext => ({
  conditions: [], slotPosition: 'ST', fatigue: 0, capacity: 1, atmosphere: 0, pressure: 0, ...over,
});

const tactics = {
  ...DEFAULT_TACTICS, formationId: DEFAULT_FORMATION_ID, lineup: {}, bench: [],
  captainId: null, setPieceTakerId: null, penaltyTakerId: null,
};
const neutralVector = toTacticVector(tactics, { squadQuality: 65, managerTactical: 55 });

describe('effective attributes', () => {
  it('degrade with fatigue', () => {
    const fresh = effectiveAttribute(striker, 'finishing', ctx({ fatigue: 0 }));
    const spent = effectiveAttribute(striker, 'finishing', ctx({ fatigue: 1 }));
    expect(spent).toBeLessThan(fresh);
    expect(spent / fresh).toBeCloseTo(1 - BALANCE.FATIGUE_ATTR_PENALTY, 1);
  });

  it('degrade out of position', () => {
    const natural = effectiveAttribute(striker, 'finishing', ctx({ slotPosition: 'ST' }));
    const misplaced = effectiveAttribute(striker, 'finishing', ctx({ slotPosition: 'CB' }));
    expect(misplaced).toBeLessThan(natural);
    expect(misplaced).toBeGreaterThan(0);
  });

  it('respond to confidence and to playing hurt', () => {
    const confident = { ...striker, mental: { ...striker.mental, confidence: 95 } };
    const shot = { ...striker, mental: { ...striker.mental, confidence: 10 } };
    expect(effectiveAttribute(confident, 'finishing', ctx()))
      .toBeGreaterThan(effectiveAttribute(shot, 'finishing', ctx()));
    expect(effectiveAttribute(striker, 'finishing', ctx({ capacity: BALANCE.INJURED_CAPACITY })))
      .toBeLessThan(effectiveAttribute(striker, 'finishing', ctx()));
  });

  it('only fire a conditional trait when its condition holds', () => {
    const clutch = { ...striker, traitIds: ['clutch'] };
    const early = effectiveAttribute(clutch, 'finishing', ctx({ conditions: [] }));
    const late = effectiveAttribute(clutch, 'finishing', ctx({ conditions: ['LATE_GAME'] }));
    expect(late).toBeGreaterThan(early);
    expect(early).toBeCloseTo(effectiveAttribute(striker, 'finishing', ctx()), 5);
  });

  it('protect a player who handles pressure and punish one who does not', () => {
    const cool = { ...striker, mental: { ...striker.mental, pressureHandling: 95 } };
    const fragile = { ...striker, mental: { ...striker.mental, pressureHandling: 10 } };
    const big = ctx({ pressure: 1 });
    expect(effectiveAttribute(cool, 'composure', big)).toBeGreaterThan(effectiveAttribute(fragile, 'composure', big));
  });
});

describe('team aggregates', () => {
  const unit = (role: UnitView['role'], target: number): UnitView => ({
    player: makeTestPlayer(rng, { id: `u${role}${target}`, position: role === 'GK' ? 'GK' : role === 'DEF' ? 'CB' : role === 'MID' ? 'CM' : 'ST', target }),
    role,
    ctx: ctx({ slotPosition: role === 'GK' ? 'GK' : role === 'DEF' ? 'CB' : role === 'MID' ? 'CM' : 'ST' }),
  });

  it('rank a better squad above a worse one', () => {
    const good = computeAggregates([unit('GK', 80), unit('DEF', 80), unit('MID', 80), unit('ATT', 80)], 6);
    const bad = computeAggregates([unit('GK', 45), unit('DEF', 45), unit('MID', 45), unit('ATT', 45)], 6);
    expect(good.attack).toBeGreaterThan(bad.attack);
    expect(good.defence).toBeGreaterThan(bad.defence);
    expect(good.keeper).toBeGreaterThan(bad.keeper);
  });

  it('drop when the team is a man short, which a plain mean would hide', () => {
    const full = computeAggregates([unit('GK', 65), unit('DEF', 65), unit('DEF', 65), unit('MID', 65), unit('MID', 65), unit('ATT', 65)], 5);
    const short = computeAggregates([unit('GK', 65), unit('DEF', 65), unit('MID', 65), unit('MID', 65), unit('ATT', 65)], 5);
    expect(short.defence).toBeLessThan(full.defence);
    expect(short.pressing).toBeLessThan(full.pressing);
  });

  it('treat an empty goal as far worse than any keeper', () => {
    const noKeeper = computeAggregates([unit('DEF', 65), unit('MID', 65)], 5);
    const withKeeper = computeAggregates([unit('GK', 40), unit('DEF', 65), unit('MID', 65)], 5);
    expect(noKeeper.keeper).toBeLessThan(withKeeper.keeper);
  });
});

describe('chance quality and xG', () => {
  const input = (over: Partial<ChanceInput> = {}): ChanceInput => ({
    zone: 0.8, widthBias: 0, chanceQuality: 0.5, counter: false, header: false,
    setPiece: false, penalty: false, pressure: 0.5, finishing: 60, composure: 60,
    assistQuality: 0.4, keeper: 60, multiplier: 1, ...over,
  });

  it('is a continuous value inside a plausible band, never a coin flip', () => {
    const values: number[] = [];
    for (let i = 0; i < 500; i++) values.push(buildChance(new Rng(`c${i}`), input()).xg);
    const unique = new Set(values.map((v) => v.toFixed(4)));
    expect(unique.size).toBeGreaterThan(400);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(BALANCE.XG_MIN);
      expect(v).toBeLessThanOrEqual(0.92);
    }
  });

  it('rises closer to goal and falls under pressure', () => {
    const mean = (over: Partial<ChanceInput>): number => {
      let t = 0;
      for (let i = 0; i < 400; i++) t += buildChance(new Rng(`m${i}`), input(over)).xg;
      return t / 400;
    };
    expect(mean({ zone: 0.92 })).toBeGreaterThan(mean({ zone: 0.7 }));
    expect(mean({ pressure: 1 })).toBeLessThan(mean({ pressure: 0 }));
    expect(mean({ finishing: 90 })).toBeGreaterThan(mean({ finishing: 40 }));
    expect(mean({ keeper: 90 })).toBeLessThan(mean({ keeper: 40 }));
    expect(mean({ assistQuality: 0.95 })).toBeGreaterThan(mean({ assistQuality: 0.05 }));
    expect(mean({ counter: true })).toBeGreaterThan(mean({ counter: false }));
  });

  it('converts at its own xG over a large sample', () => {
    const xg = 0.32;
    let goals = 0;
    const n = 20000;
    for (let i = 0; i < n; i++) if (resolveShot(new Rng(`r${i}`), xg, 60, 0.5) === 'GOAL') goals += 1;
    expect(goals / n).toBeGreaterThan(xg - 0.02);
    expect(goals / n).toBeLessThan(xg + 0.02);
  });

  it('sends roughly half of everything else to the keeper, a defender or the frame', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 5000; i++) {
      const r = resolveShot(new Rng(`s${i}`), 0.15, 60, 0.5);
      counts[r] = (counts[r] ?? 0) + 1;
    }
    expect(counts['SAVE']).toBeGreaterThan(0);
    expect(counts['BLOCK']).toBeGreaterThan(0);
    expect(counts['MISS']).toBeGreaterThan(0);
    expect(counts['POST']).toBeGreaterThan(0);
  });
});

describe('pressure and fatigue', () => {
  it('presses hardest near the box and least at halfway', () => {
    const agg = computeAggregates([], 6);
    expect(defensivePressure(agg, neutralVector, 0.9)).toBeGreaterThan(defensivePressure(agg, neutralVector, 0.4));
  });

  it('drains a low-stamina player faster than a high-stamina one', () => {
    const engine = { ...striker, attributes: { ...striker.attributes, stamina: 90 } };
    const lungs = { ...striker, attributes: { ...striker.attributes, stamina: 30 } };
    const args = { conditions: [], vector: neutralVector, inPossession: true, fatigue: 0 };
    expect(fatigueDelta({ ...args, player: lungs })).toBeGreaterThan(fatigueDelta({ ...args, player: engine }));
  });

  it('drains more when chasing the ball than when holding it', () => {
    const args = { player: striker, conditions: [], vector: neutralVector, fatigue: 0 };
    expect(fatigueDelta({ ...args, inPossession: false })).toBeGreaterThan(fatigueDelta({ ...args, inPossession: true }));
  });

  it('compounds: the last ten minutes cost more than the first', () => {
    const args = { player: striker, conditions: [], vector: neutralVector, inPossession: true };
    expect(fatigueDelta({ ...args, fatigue: 0.8 })).toBeGreaterThan(fatigueDelta({ ...args, fatigue: 0 }));
  });

  it('costs more under a pressing setup than a low block', () => {
    const high = toTacticVector({ ...tactics, press: 'HIGH_PRESS' }, { squadQuality: 65, managerTactical: 55 });
    const low = toTacticVector({ ...tactics, press: 'LOW_BLOCK' }, { squadQuality: 65, managerTactical: 55 });
    const args = { player: striker, conditions: [], inPossession: true, fatigue: 0.3 };
    expect(fatigueDelta({ ...args, vector: high })).toBeGreaterThan(fatigueDelta({ ...args, vector: low }));
  });
});

describe('injuries', () => {
  it('skews toward knocks and only rarely ends a season', () => {
    const counts: Record<string, number> = {};
    for (let i = 0; i < 4000; i++) {
      const { severity } = rollInjury(new Rng(`i${i}`), keeper, []);
      counts[severity] = (counts[severity] ?? 0) + 1;
    }
    expect(counts['KNOCK'] ?? 0).toBeGreaterThan(counts['SEASON'] ?? 0);
    expect((counts['SEASON'] ?? 0) / 4000).toBeLessThan(0.06);
  });

  it('hits an injury-prone player with worse outcomes', () => {
    const prone = { ...keeper, traitIds: ['injury_prone'] };
    const weeks = (p: typeof keeper): number => {
      let t = 0;
      for (let i = 0; i < 2000; i++) t += rollInjury(new Rng(`w${i}`), p, []).weeksOut;
      return t;
    };
    expect(weeks(prone)).toBeGreaterThan(weeks(keeper));
  });
});
