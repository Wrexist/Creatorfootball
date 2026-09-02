import { describe, expect, it } from 'vitest';
import type { PitchFrame, PlayerId } from '@cf/engine';
import { BALL_PASS_SPEED, BALL_SHOT_SPEED, PitchMotion } from './motion';

/**
 * The presentation layer between the simulator's snapshots and the pixels.
 *
 * The simulator says where everybody is every tick. The renderer has to get
 * them there without teleporting, keep the ball attached to whoever has it,
 * fly it between them when it changes hands, freeze when the match is paused
 * and carry on cleanly when it is not. None of this may feed back into the
 * simulation: `PitchMotion` reads frames and produces positions, and that is
 * all it does.
 */

const frame = (over: Partial<PitchFrame> & { players?: PitchFrame['players'] }): PitchFrame => ({
  tick: 0, minute: 0, ball: { x: 0.5, y: 0.5 }, ballHolder: null, phase: 'BUILD_UP', players: [], ...over,
});
/** Advance in frames of 16 ms, the way the render loop does. */
const run = (m: PitchMotion, from: number, to: number): void => { for (let t = from + 16; t <= to; t += 16) m.advance(t); m.advance(to); };
const pid = (id: string): PlayerId => id as PlayerId;
const unit = (id: string, x: number, y: number, over: Partial<PitchFrame['players'][number]> = {}) => ({
  playerId: pid(id), side: 'home' as const, x, y, hasBall: false, state: 'RUNNING' as const, stamina: 90, ...over,
});

describe('player motion', () => {
  it('TEST 11: a shirt travels between two snapshots rather than jumping', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, players: [unit('a', 0.2, 0.5)] }), 0);
    m.setFrame(frame({ tick: 2, players: [unit('a', 0.4, 0.5)] }), 240);
    // Halfway through the interval the shirt is between the two positions, not at either.
    m.advance(360);
    const mid = m.node('a')!;
    expect(mid.x).toBeGreaterThan(0.21);
    expect(mid.x).toBeLessThan(0.39);
    // By the time the next snapshot is due, he has arrived.
    m.advance(480);
    expect(m.node('a')!.x).toBeCloseTo(0.4, 3);
  });

  it('never moves a shirt faster than the snapshots ask, so a dropped frame cannot lurch', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, players: [unit('a', 0.2, 0.5)] }), 0);
    m.setFrame(frame({ tick: 2, players: [unit('a', 0.4, 0.5)] }), 240);
    let last = 0.2;
    for (let t = 256; t <= 480; t += 16) {
      m.advance(t);
      const x = m.node('a')!.x;
      expect(x).toBeGreaterThanOrEqual(last - 1e-9);
      expect(x - last).toBeLessThan(0.04);
      last = x;
    }
  });

  it('TEST 15: pause freezes the picture — with no new snapshot, motion settles and stays put', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, players: [unit('a', 0.2, 0.5)] }), 0);
    m.setFrame(frame({ tick: 2, players: [unit('a', 0.4, 0.5)] }), 240);
    m.advance(2000);
    expect(m.node('a')!.x).toBeCloseTo(0.4, 6);
    expect(m.settled()).toBe(true);
    m.advance(30_000);
    expect(m.node('a')!.x).toBeCloseTo(0.4, 6);
  });

  it('TEST 16: resuming after a pause continues from where the shirt is, without a teleport', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, players: [unit('a', 0.2, 0.5)] }), 0);
    m.setFrame(frame({ tick: 2, players: [unit('a', 0.4, 0.5)] }), 240);
    m.advance(360); // paused mid-travel
    const paused = m.node('a')!.x;
    // A long gap, then the next snapshot: the measured interval must not become the pause.
    m.setFrame(frame({ tick: 3, players: [unit('a', 0.45, 0.5)] }), 20_360);
    expect(m.node('a')!.x).toBeCloseTo(paused, 6);
    m.advance(20_376);
    const after = m.node('a')!.x;
    expect(Math.abs(after - paused)).toBeLessThan(0.02);
    m.advance(21_000);
    expect(m.node('a')!.x).toBeCloseTo(0.45, 3);
  });

  it('TEST 17: rapid snapshots do not jitter — direction changes are followed, not amplified', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, players: [unit('a', 0.5, 0.5)] }), 0);
    let t = 0;
    const xs: number[] = [];
    for (let i = 1; i <= 20; i++) {
      t += 100;
      m.setFrame(frame({ tick: i + 1, players: [unit('a', 0.5 + (i % 2 ? 0.03 : -0.03), 0.5)] }), t);
      for (let f = 16; f <= 100; f += 16) { m.advance(t + f); xs.push(m.node('a')!.x); }
    }
    // Never further from the centre than the snapshots themselves.
    for (const x of xs) expect(Math.abs(x - 0.5)).toBeLessThanOrEqual(0.03 + 1e-9);
  });

  it('TEST 18: a substitute appears at his own position and the man he replaced is gone', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, players: [unit('off', 0.3, 0.3)] }), 0);
    m.setFrame(frame({ tick: 2, players: [unit('on', 0.31, 0.3)] }), 240);
    expect(m.node('off')).toBeUndefined();
    expect(m.node('on')!.x).toBeCloseTo(0.31, 6);
    expect([...m.ids()]).toEqual(['on']);
  });

  it('reduced motion snaps to every snapshot', () => {
    const m = new PitchMotion({ reducedMotion: true });
    m.setFrame(frame({ tick: 1, players: [unit('a', 0.2, 0.5)] }), 0);
    m.setFrame(frame({ tick: 2, players: [unit('a', 0.4, 0.5)] }), 240);
    expect(m.node('a')!.x).toBeCloseTo(0.4, 6);
  });
});

describe('ball motion', () => {
  it('TEST 14: the ball sits with the man who has it, wherever the simulator\'s coarse point is', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, ball: { x: 0.9, y: 0.1 }, ballHolder: pid('a'), players: [unit('a', 0.3, 0.5, { hasBall: true })] }), 0);
    run(m, 0, 500);
    const b = m.ball();
    expect(Math.hypot(b.x - 0.3, b.y - 0.5)).toBeLessThan(0.05);
  });

  it('TEST 13: a change of hands is a pass — the ball travels to the receiver at a bounded speed', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, ballHolder: pid('a'), players: [unit('a', 0.2, 0.5, { hasBall: true }), unit('b', 0.6, 0.5)] }), 0);
    run(m, 0, 400);
    m.setFrame(frame({ tick: 2, ballHolder: pid('b'), players: [unit('a', 0.2, 0.5), unit('b', 0.6, 0.5, { hasBall: true })] }), 400);
    let last = m.ball().x;
    for (let t = 416; t <= 1200; t += 16) {
      m.advance(t);
      const x = m.ball().x;
      expect(x).toBeGreaterThanOrEqual(last - 1e-9);
      expect(x - last).toBeLessThanOrEqual(BALL_PASS_SPEED * 0.016 + 1e-6);
      last = x;
    }
    expect(Math.hypot(m.ball().x - 0.6, m.ball().y - 0.5)).toBeLessThan(0.05);
  });

  it('a shot flies at the goal the shooter is attacking', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, ballHolder: pid('a'), players: [unit('a', 0.8, 0.5, { hasBall: true })] }), 0);
    run(m, 0, 400);
    m.setFrame(frame({ tick: 2, phase: 'SHOT', ballHolder: pid('a'), players: [unit('a', 0.8, 0.5, { hasBall: true, state: 'SHOOTING' })] }), 400);
    m.setFrame(frame({ tick: 3, phase: 'SHOT', ballHolder: null, ball: { x: 0.5, y: 0.5 }, players: [unit('a', 0.8, 0.5)] }), 640);
    run(m, 640, 900);
    const b = m.ball();
    expect(b.x).toBeGreaterThan(0.85);
    expect(BALL_SHOT_SPEED).toBeGreaterThan(BALL_PASS_SPEED);
  });

  it('a stoppage holds the ball where play stopped instead of jumping to the centre circle', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, ballHolder: pid('a'), players: [unit('a', 0.7, 0.3, { hasBall: true })] }), 0);
    run(m, 0, 500);
    m.setFrame(frame({ tick: 2, phase: 'STOPPAGE', ballHolder: null, ball: { x: 0.5, y: 0.5 }, players: [unit('a', 0.7, 0.3)] }), 500);
    run(m, 500, 1500);
    const b = m.ball();
    expect(Math.hypot(b.x - 0.7, b.y - 0.3)).toBeLessThan(0.08);
  });

  it('with no carrier named, the ball is with the man nearest the simulator\'s point, and a change of nearest man is a pass', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, ball: { x: 0.4, y: 0.5 }, players: [unit('a', 0.41, 0.5), unit('b', 0.7, 0.5)] }), 0);
    run(m, 0, 400);
    expect(Math.hypot(m.ball().x - 0.41, m.ball().y - 0.5)).toBeLessThan(0.03);
    m.setFrame(frame({ tick: 2, ball: { x: 0.69, y: 0.5 }, players: [unit('a', 0.41, 0.5), unit('b', 0.7, 0.5)] }), 400);
    let last = m.ball().x;
    for (let t = 416; t <= 1200; t += 16) {
      m.advance(t);
      expect(m.ball().x).toBeGreaterThanOrEqual(last - 1e-9);
      last = m.ball().x;
    }
    expect(Math.hypot(m.ball().x - 0.7, m.ball().y - 0.5)).toBeLessThan(0.03);
  });

  it('a settled ball stops moving entirely, so a paused match repaints nothing', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, ballHolder: pid('a'), players: [unit('a', 0.3, 0.5, { hasBall: true })] }), 0);
    run(m, 0, 2000);
    expect(m.settled()).toBe(true);
    expect(m.advance(2016)).toBe(false);
    expect(m.advance(2032)).toBe(false);
  });

  it('TEST 20: once the match is over and everything has settled, there is nothing left to animate', () => {
    const m = new PitchMotion();
    m.setFrame(frame({ tick: 1, ballHolder: pid('a'), players: [unit('a', 0.2, 0.5, { hasBall: true })] }), 0);
    m.setFrame(frame({ tick: 2, ballHolder: pid('a'), players: [unit('a', 0.25, 0.5, { hasBall: true })] }), 240);
    expect(m.settled()).toBe(false);
    run(m, 240, 3000);
    expect(m.settled()).toBe(true);
  });
});
