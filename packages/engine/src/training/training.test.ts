import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { makeClub, makeContract, makePlayer, makeState, testRegistry, type PlayerOverrides } from '../economy/testing';
import { emptyAttributes } from '../players/attributes';
import { emptyMental } from '../players/mental';
import type { Player } from '../players/player';
import { stdDev } from '../core/math';
import { applyDevelopment, developPlayer, growthRate, type DevelopmentContext } from './development';
import { programById, TRAINING_PROGRAMS } from './programs';
import { runTrainingCycle, type TrainingCycleContext } from './training';

const prospect = (id: string, over: Omit<PlayerOverrides, 'id'> = {}): Player =>
  makePlayer({
    id,
    age: 19,
    attributes: emptyAttributes(58),
    overall: 58,
    potential: 84,
    fitness: 95,
    mental: { ...emptyMental(60), professionalism: 65, morale: 65 },
    ...over,
  });

const devContext = (over: Partial<DevelopmentContext> = {}): DevelopmentContext => ({
  cycle: 1,
  program: programById('TECHNICAL'),
  intensity: 'NORMAL',
  trainingGain: 0,
  injuryResistance: 0,
  youthQuality: 0,
  managerDevelopment: 55,
  minutesShare: 0.7,
  ...over,
});

/** Total overall gained over `cycles` weeks of training. */
function simulate(player: Player, ctx: DevelopmentContext, cycles: number, seed: string): number {
  const rng = new Rng(seed);
  let current = player;
  for (let cycle = 0; cycle < cycles; cycle++) {
    const dev = developPlayer(current, rng, { ...ctx, cycle });
    current = applyDevelopment(current, dev);
    // Keep him fresh so the comparison isolates the variable under test.
    current = { ...current, fitness: 95, injury: null };
  }
  return current.overall - player.overall;
}

describe('the programs themselves', () => {
  it('is a small set, and every one costs something', () => {
    expect(TRAINING_PROGRAMS.length).toBe(7);
    for (const program of TRAINING_PROGRAMS) {
      expect(program.tradeOff.length).toBeGreaterThan(10);
      const hasCost =
        Object.values(program.weights).some((w) => (w ?? 0) < 0) ||
        program.recovery ||
        program.youthBias > 0;
      expect(hasCost).toBe(true);
    }
  });

  it('trades growth against injury risk and fatigue as intensity rises', () => {
    const p = prospect('int');
    const light = growthRate(p, devContext({ intensity: 'LIGHT' }));
    const normal = growthRate(p, devContext({ intensity: 'NORMAL' }));
    const hard = growthRate(p, devContext({ intensity: 'HARD' }));
    expect(light).toBeLessThan(normal);
    expect(hard).toBeGreaterThan(normal);

    const rng = new Rng('fatigue');
    const lightDev = developPlayer(p, rng, devContext({ intensity: 'LIGHT' }));
    const hardDev = developPlayer(p, rng, devContext({ intensity: 'HARD' }));
    expect(Math.abs(hardDev.fitnessDelta)).toBeGreaterThan(Math.abs(lightDev.fitnessDelta));
  });

  it('costs technical growth when the squad only does fitness work', () => {
    const p = prospect('fit', { attributes: { ...emptyAttributes(58), technique: 70 } });
    const rng = new Rng('technique');
    let current = p;
    for (let cycle = 0; cycle < 25; cycle++) {
      current = applyDevelopment(current, developPlayer(current, rng, devContext({
        cycle, program: programById('FITNESS'),
      })));
      current = { ...current, fitness: 95, injury: null };
    }
    expect(current.attributes.technique).toBeLessThan(70);
    expect(current.attributes.stamina).toBeGreaterThan(58);
  });

  it('makes recovery restore fitness instead of spending it', () => {
    const tired = prospect('tired', { fitness: 55 });
    const dev = developPlayer(tired, new Rng('rec'), devContext({ program: programById('RECOVERY') }));
    expect(dev.fitnessDelta).toBeGreaterThan(0);
    expect(dev.injury).toBeNull();
  });
});

describe('development', () => {
  it('develops a player who plays far faster than the same player on the bench', () => {
    let playing = 0;
    let benched = 0;
    for (let i = 0; i < 25; i++) {
      const p = prospect(`p${i}`);
      playing += simulate(p, devContext({ minutesShare: 0.9 }), 30, `play-${i}`);
      benched += simulate(p, devContext({ minutesShare: 0.02 }), 30, `bench-${i}`);
    }
    expect(playing).toBeGreaterThan(benched * 1.4);
  });

  it('gives two identical prospects genuinely different careers', () => {
    const gains: number[] = [];
    for (let i = 0; i < 30; i++) {
      // Same age, same attributes, same potential, same treatment — only the id differs.
      gains.push(simulate(prospect(`twin_${i}`), devContext(), 30, 'shared-seed'));
    }
    expect(stdDev(gains)).toBeGreaterThan(0.8);
    expect(new Set(gains).size).toBeGreaterThan(3);
  });

  it('respects the potential ceiling and the age curve', () => {
    const capped = prospect('capped', { potential: 59 });
    const open = prospect('open', { potential: 90 });
    expect(simulate(open, devContext(), 30, 'ceiling')).toBeGreaterThan(
      simulate(capped, devContext(), 30, 'ceiling'),
    );

    const veteran = makePlayer({
      id: 'vet', age: 34, attributes: emptyAttributes(70), overall: 70, potential: 70, fitness: 95,
    });
    expect(simulate(veteran, devContext(), 30, 'age')).toBeLessThanOrEqual(0);
  });

  it('rewards professionalism, morale, facilities and a developer manager', () => {
    const lazy = prospect('lazy', { mental: { ...emptyMental(60), professionalism: 15, morale: 30 } });
    const pro = prospect('pro', { mental: { ...emptyMental(60), professionalism: 92, morale: 88 } });
    expect(growthRate(pro, devContext())).toBeGreaterThan(growthRate(lazy, devContext()) * 1.5);

    const p = prospect('facility');
    expect(growthRate(p, devContext({ trainingGain: 0.6 })))
      .toBeGreaterThan(growthRate(p, devContext({ trainingGain: 0 })));
    expect(growthRate(p, devContext({ managerDevelopment: 90 })))
      .toBeGreaterThan(growthRate(p, devContext({ managerDevelopment: 30 })));
  });

  it('never pushes an attribute outside 1-99 or leaves overall stale', () => {
    const maxed = makePlayer({ id: 'max', age: 18, attributes: emptyAttributes(99), overall: 99, potential: 99 });
    const dev = developPlayer(maxed, new Rng('clamp'), devContext());
    const applied = applyDevelopment(maxed, dev);
    for (const value of Object.values(applied.attributes)) {
      expect(value).toBeGreaterThanOrEqual(1);
      expect(value).toBeLessThanOrEqual(99);
    }
    expect(applied.potential).toBeGreaterThanOrEqual(applied.overall);
  });
});

describe('runTrainingCycle', () => {
  function squadState() {
    const players: Record<string, Player> = {};
    const contracts: Record<string, ReturnType<typeof makeContract>> = {};
    const squad: string[] = [];
    for (let i = 0; i < 12; i++) {
      const id = `sq_${i}`;
      const p = prospect(id, { age: 18 + i, clubId: 'club_home', contractId: `ct_${i}` });
      players[id] = p;
      contracts[`ct_${i}`] = makeContract({
        id: `ct_${i}`, playerId: id, clubId: 'club_home',
        minutesPlayed: i * 100, minutesAvailable: 1_200,
      });
      squad.push(id);
    }
    const club = makeClub({ id: 'club_home', isPlayerClub: true, squad, facilityLevels: { training_centre: 3 } });
    return makeState({
      clubs: { club_home: club },
      players,
      contracts,
      playerClubId: club.id,
      training: { programId: 'TECHNICAL', intensity: 'NORMAL', individualFocus: {}, lastResults: [] },
    });
  }

  const cycleCtx = (over: Partial<TrainingCycleContext> = {}): TrainingCycleContext => ({
    clubId: 'club_home' as never,
    cycle: 4,
    season: 1,
    registry: testRegistry,
    managerDevelopment: 65,
    ...over,
  });

  it('returns deltas without mutating the state it was given', () => {
    const state = squadState();
    const before = JSON.stringify(state.players);
    const result = runTrainingCycle(state, new Rng('cycle'), cycleCtx());
    expect(JSON.stringify(state.players)).toBe(before);
    expect(Object.keys(result.players).length).toBeGreaterThan(0);
    expect(result.program.id).toBe('TECHNICAL');
  });

  it('produces a spread of results across the squad rather than one uniform bump', () => {
    let state = squadState();
    const rng = new Rng('spread');
    const result = runTrainingCycle(state, rng, cycleCtx());
    // Growth pressure differs player by player even before the dice are rolled.
    expect(new Set(result.developments.map((d) => Math.round(d.growthPressure * 1000))).size)
      .toBeGreaterThan(5);

    const start = { ...state.players };
    for (let cycle = 0; cycle < 12; cycle++) {
      const step = runTrainingCycle(state, rng, cycleCtx({ cycle }));
      state = { ...state, players: { ...state.players, ...step.players } };
    }
    const gains = Object.keys(start).map(
      (id) => (state.players[id]?.overall ?? 0) - (start[id]?.overall ?? 0),
    );
    expect(new Set(gains).size).toBeGreaterThan(2);
  });

  it('sends the youth programme’s benefit to the youngsters', () => {
    const state = squadState();
    const youth = runTrainingCycle(state, new Rng('y'), cycleCtx({ programId: 'YOUTH' }));
    const young = youth.developments.filter((d) => (state.players[d.playerId]?.age ?? 0) <= 21);
    const old = youth.developments.filter((d) => (state.players[d.playerId]?.age ?? 0) > 21);
    const meanPressure = (rows: typeof young) =>
      rows.length ? rows.reduce((s, r) => s + r.growthPressure, 0) / rows.length : 0;
    expect(meanPressure(young)).toBeGreaterThan(meanPressure(old) * 2);
  });

  it('sends injured players to the physio rather than the training pitch', () => {
    const state = squadState();
    const injured = {
      ...state,
      players: {
        ...state.players,
        sq_0: {
          ...state.players.sq_0!,
          injury: { severity: 'MODERATE' as const, weeksRemaining: 5, description: 'Hamstring', sustainedCycle: 0 },
        },
      },
    };
    const result = runTrainingCycle(injured, new Rng('injured'), cycleCtx());
    const treated = result.players.sq_0!;
    expect(treated.injury!.weeksRemaining).toBeLessThan(5);
    expect(result.developments.some((d) => d.playerId === 'sq_0')).toBe(false);
  });

  it('makes hard training visibly more dangerous over a season', () => {
    let lightInjuries = 0;
    let hardInjuries = 0;
    for (let seed = 0; seed < 12; seed++) {
      const state = squadState();
      const rng = new Rng(`risk-${seed}`);
      for (let cycle = 0; cycle < 15; cycle++) {
        lightInjuries += runTrainingCycle(state, rng, cycleCtx({ cycle, intensity: 'LIGHT' })).injuries.length;
        hardInjuries += runTrainingCycle(state, rng, cycleCtx({ cycle, intensity: 'HARD' })).injuries.length;
      }
    }
    expect(hardInjuries).toBeGreaterThan(lightInjuries);
  });
});
