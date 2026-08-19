import { describe, expect, it } from 'vitest';
import type { TacticSetup, TacticVector } from './tactics';
import { DEFAULT_TACTICS } from './tactics';
import { applyVectorModifiers, toTacticVector } from './vector';
import { DEFAULT_FORMATION_ID } from './formations';

const base: TacticSetup = {
  ...DEFAULT_TACTICS,
  formationId: DEFAULT_FORMATION_ID,
  lineup: {},
  bench: [],
  captainId: null,
  setPieceTakerId: null,
  penaltyTakerId: null,
};
const ctx = { squadQuality: 65, managerTactical: 55 };
const vec = (over: Partial<TacticSetup>): TacticVector => toTacticVector({ ...base, ...over }, ctx);

/**
 * The design rule under test: no setting is a free upgrade. Each case below
 * names the thing the instruction buys and the thing it costs, and asserts both.
 */
describe('toTacticVector trade-offs', () => {
  const neutral = vec({});

  it('is finite and inside its documented ranges', () => {
    for (const [, v] of Object.entries(neutral)) {
      expect(Number.isFinite(v)).toBe(true);
    }
    expect(neutral.aggression).toBeGreaterThanOrEqual(0);
    expect(neutral.aggression).toBeLessThanOrEqual(1);
    expect(neutral.widthBias).toBeGreaterThanOrEqual(-1);
    expect(neutral.widthBias).toBeLessThanOrEqual(1);
  });

  it('high press: buys turnovers, costs stamina and the space behind', () => {
    const v = vec({ press: 'HIGH_PRESS' });
    expect(v.pressRecovery).toBeGreaterThan(neutral.pressRecovery);
    expect(v.fatigueRate).toBeGreaterThan(neutral.fatigueRate);
    expect(v.spaceBehind).toBeGreaterThan(neutral.spaceBehind);
  });

  it('low block: buys solidity, costs the ball and the press', () => {
    const v = vec({ press: 'LOW_BLOCK' });
    expect(v.defensiveSolidity).toBeGreaterThan(neutral.defensiveSolidity);
    expect(v.possessionBias).toBeLessThan(neutral.possessionBias);
    expect(v.pressRecovery).toBeLessThan(neutral.pressRecovery);
  });

  it('reckless: buys attacking output, costs solidity and control', () => {
    const v = vec({ risk: 'RECKLESS' });
    expect(v.attackVolume).toBeGreaterThan(neutral.attackVolume);
    expect(v.defensiveSolidity).toBeLessThan(neutral.defensiveSolidity);
    expect(v.volatility).toBeGreaterThan(neutral.volatility);
  });

  it('patient tempo: buys chance quality, costs volume and the counter', () => {
    const v = vec({ tempo: 'PATIENT' });
    expect(v.chanceQuality).toBeGreaterThan(neutral.chanceQuality);
    expect(v.attackVolume).toBeLessThan(neutral.attackVolume);
    expect(v.counterWeight).toBeLessThan(neutral.counterWeight);
  });

  it('direct passing: buys the counter, costs possession and chance quality', () => {
    const v = vec({ passing: 'DIRECT' });
    expect(v.counterWeight).toBeGreaterThan(neutral.counterWeight);
    expect(v.possessionBias).toBeLessThan(neutral.possessionBias);
    expect(v.chanceQuality).toBeLessThan(neutral.chanceQuality);
  });

  it('man marking: buys turnovers, costs fouls and shape', () => {
    const v = vec({ marking: 'MAN' });
    expect(v.pressRecovery).toBeGreaterThan(neutral.pressRecovery);
    expect(v.foulRate).toBeGreaterThan(neutral.foulRate);
    expect(v.spaceBehind).toBeGreaterThan(neutral.spaceBehind);
  });

  it('a high line: buys territory, costs the space behind', () => {
    const v = vec({ line: 'HIGH' });
    expect(v.possessionBias).toBeGreaterThan(neutral.possessionBias);
    expect(v.spaceBehind).toBeGreaterThan(neutral.spaceBehind);
  });

  it('wide: buys volume, costs chance quality', () => {
    const v = vec({ width: 'WIDE' });
    expect(v.widthBias).toBeGreaterThan(neutral.widthBias);
    expect(v.attackVolume).toBeGreaterThan(neutral.attackVolume);
    expect(v.chanceQuality).toBeLessThan(neutral.chanceQuality);
  });

  it('every setting moves at least two terms in opposing directions', () => {
    const cases: Partial<TacticSetup>[] = [
      { tempo: 'FRANTIC' }, { press: 'MID_BLOCK' }, { line: 'DEEP' }, { width: 'NARROW' },
      { passing: 'SHORT' }, { buildUp: 'FROM_THE_BACK' }, { buildUp: 'BYPASS' },
      { focus: 'CENTRE' }, { focus: 'LEFT' }, { marking: 'ZONAL' }, { risk: 'CAUTIOUS' },
      { counter: 'ALWAYS' }, { counter: 'NEVER' }, { subStrategy: 'AGGRESSIVE' },
      { subStrategy: 'CONSERVATIVE' }, { tempo: 'QUICK' }, { risk: 'BOLD' },
    ];
    for (const c of cases) {
      const v = vec(c) as unknown as Record<string, number>;
      const n = neutral as unknown as Record<string, number>;
      const ups = Object.keys(n).filter((k) => (v[k] as number) > (n[k] as number) + 1e-9);
      const downs = Object.keys(n).filter((k) => (v[k] as number) < (n[k] as number) - 1e-9);
      expect(ups.length + downs.length, `${JSON.stringify(c)} changed nothing`).toBeGreaterThanOrEqual(2);
      expect(ups.length, `${JSON.stringify(c)} has no upside`).toBeGreaterThanOrEqual(1);
      expect(downs.length, `${JSON.stringify(c)} has no downside`).toBeGreaterThanOrEqual(1);
    }
  });
});

describe('context terms', () => {
  it('a better coach gets more out of the same instruction, but never flips its sign', () => {
    const good = toTacticVector({ ...base, press: 'HIGH_PRESS' }, { squadQuality: 65, managerTactical: 95 });
    const poor = toTacticVector({ ...base, press: 'HIGH_PRESS' }, { squadQuality: 65, managerTactical: 15 });
    expect(good.pressRecovery).toBeGreaterThan(poor.pressRecovery);
    expect(good.spaceBehind).toBeGreaterThan(poor.spaceBehind);
  });

  it('a weak squad pays more and collects less for pressing high', () => {
    const strong = toTacticVector({ ...base, press: 'HIGH_PRESS' }, { squadQuality: 90, managerTactical: 55 });
    const weak = toTacticVector({ ...base, press: 'HIGH_PRESS' }, { squadQuality: 35, managerTactical: 55 });
    expect(strong.pressRecovery).toBeGreaterThan(weak.pressRecovery);
    expect(weak.fatigueRate).toBeGreaterThan(strong.fatigueRate);
  });
});

describe('applyVectorModifiers', () => {
  it('adds deltas and re-clamps so no stack escapes the legal range', () => {
    const v = vec({});
    const out = applyVectorModifiers(v, { attackVolume: 99, aggression: -99, unknownKey: 5 });
    expect(out.attackVolume).toBeLessThanOrEqual(2.0);
    expect(out.aggression).toBe(0);
    expect((out as unknown as Record<string, number>)['unknownKey']).toBeUndefined();
  });
});
