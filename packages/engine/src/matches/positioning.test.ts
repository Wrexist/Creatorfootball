import { describe, expect, it } from 'vitest';
import { asId } from '../core/brand';
import type { PlayerId } from '../core/brand';
import { PositionEngine, ballPoint, toAbsolute, toRelative } from './positioning';
import type { FrameInput, PositioningUnit } from './positioning';
import { formationById, DEFAULT_FORMATION_ID } from '../tactics/formations';
import type { Side } from './events';

const formation = formationById(DEFAULT_FORMATION_ID);

const units = (possession: Side): PositioningUnit[] =>
  (['home', 'away'] as const).flatMap((side) =>
    formation.slots.map((slot) => ({
      playerId: asId<PlayerId>(`${side}-${slot.id}`),
      side,
      slot,
      stamina: 80,
      pace: 70,
      hasBall: false,
      teamInPossession: side === possession,
      down: false,
    })));

const input = (over: Partial<FrameInput> = {}): FrameInput => ({
  tick: 1, minute: 0, phase: 'BUILD_UP', possession: 'home', zone: 0.3, channel: 0.5,
  ballHolder: null, units: units('home'), celebratingSide: null, ...over,
});

describe('pitch frames', () => {
  it('places everybody on the pitch', () => {
    const engine = new PositionEngine();
    const frame = engine.frame(input());
    expect(frame.players).toHaveLength(formation.slots.length * 2);
    for (const p of frame.players) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
      expect(p.stamina).toBeGreaterThanOrEqual(0);
    }
  });

  it('keeps the two keepers in their own goalmouths', () => {
    const engine = new PositionEngine();
    let frame = engine.frame(input());
    for (let t = 2; t < 20; t++) frame = engine.frame(input({ tick: t, zone: 0.85 }));
    const homeGk = frame.players.find((p) => p.playerId === 'home-gk');
    const awayGk = frame.players.find((p) => p.playerId === 'away-gk');
    expect(homeGk?.x).toBeLessThan(0.35);
    expect(awayGk?.x).toBeGreaterThan(0.65);
  });

  it('reads as two shapes, not one crowd: the away block sits ahead of the home block', () => {
    const engine = new PositionEngine();
    let frame = engine.frame(input());
    for (let t = 2; t < 25; t++) frame = engine.frame(input({ tick: t }));
    const homeMean = mean(frame.players.filter((p) => p.side === 'home').map((p) => p.x));
    const awayMean = mean(frame.players.filter((p) => p.side === 'away').map((p) => p.x));
    expect(homeMean).toBeLessThan(awayMean);
  });

  it('slides the whole block up the pitch as the attack advances', () => {
    const deep = settle({ zone: 0.15 });
    const high = settle({ zone: 0.92 });
    const deepMean = mean(deep.players.filter((p) => p.side === 'home').map((p) => p.x));
    const highMean = mean(high.players.filter((p) => p.side === 'home').map((p) => p.x));
    expect(highMean).toBeGreaterThan(deepMean + 0.1);
  });

  it('squeezes toward the ball rather than staying on a lattice', () => {
    const left = settle({ zone: 0.6, channel: 0.05 });
    const right = settle({ zone: 0.6, channel: 0.95 });
    const leftMean = mean(left.players.filter((p) => p.side === 'home').map((p) => p.y));
    const rightMean = mean(right.players.filter((p) => p.side === 'home').map((p) => p.y));
    expect(rightMean).toBeGreaterThan(leftMean);
  });

  it('moves players at a believable speed rather than teleporting them', () => {
    const engine = new PositionEngine();
    const first = engine.frame(input({ zone: 0.1 }));
    const second = engine.frame(input({ tick: 2, zone: 0.95 }));
    for (const p of second.players) {
      const before = first.players.find((q) => q.playerId === p.playerId);
      if (!before) continue;
      expect(Math.hypot(p.x - before.x, p.y - before.y)).toBeLessThan(0.25);
    }
  });

  it('marks the man on the ball, the presser and the injured', () => {
    const engine = new PositionEngine();
    const custom = units('home');
    (custom[3] as PositioningUnit) = { ...(custom[3] as PositioningUnit), hasBall: true };
    (custom[1] as PositioningUnit) = { ...(custom[1] as PositioningUnit), down: true };
    const frame = engine.frame(input({
      units: custom, ballHolder: custom[3]?.playerId ?? null, phase: 'SHOT',
    }));
    expect(frame.players[3]?.state).toBe('SHOOTING');
    expect(frame.players[1]?.state).toBe('DOWN');
    expect(frame.players.some((p) => p.state === 'PRESSING' || p.state === 'TACKLING')).toBe(true);
  });

  it('is deterministic: same input, same frame', () => {
    const a = new PositionEngine().frame(input());
    const b = new PositionEngine().frame(input());
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('coordinate mapping', () => {
  it('mirrors the away half and round-trips', () => {
    expect(toAbsolute('home', 0.2, 0.3)).toEqual({ x: 0.2, y: 0.3 });
    expect(toAbsolute('away', 0.2, 0.3)).toEqual({ x: 0.8, y: 0.7 });
    const back = toRelative('away', 0.8, 0.7);
    expect(back.x).toBeCloseTo(0.2, 6);
    expect(back.y).toBeCloseTo(0.3, 6);
  });

  it('puts the ball where the possessing team says it is', () => {
    expect(ballPoint('home', 0.8, 0.5).x).toBeCloseTo(0.8, 6);
    expect(ballPoint('away', 0.8, 0.5).x).toBeCloseTo(0.2, 6);
    expect(ballPoint(null, 0.8, 0.5)).toEqual({ x: 0.5, y: 0.5 });
  });
});

function settle(over: Partial<FrameInput>) {
  const engine = new PositionEngine();
  let frame = engine.frame(input(over));
  for (let t = 2; t < 30; t++) frame = engine.frame(input({ ...over, tick: t }));
  return frame;
}

const mean = (xs: number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
