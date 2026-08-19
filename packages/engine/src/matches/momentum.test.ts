import { describe, expect, it } from 'vitest';
import { BALANCE } from './balance';
import { MomentumTracker, momentumBand, momentumBoost } from './momentum';

describe('momentum', () => {
  it('starts neutral and stays inside [-1, 1]', () => {
    const m = new MomentumTracker();
    expect(m.current).toBe(0);
    for (let t = 1; t < 400; t++) {
      m.impulse('GOAL', 'home');
      m.impulse('BIG_CHANCE', 'home');
      const v = m.tick(t, 'home', 0.6, 0);
      expect(v).toBeGreaterThanOrEqual(-1);
      expect(v).toBeLessThanOrEqual(1);
    }
    expect(m.current).toBeGreaterThan(0.4);
  });

  it('swings toward whoever is actually creating the chances', () => {
    const m = new MomentumTracker();
    for (let t = 1; t < 120; t++) m.tick(t, 'away', 0, 0.35);
    expect(m.current).toBeLessThan(-0.2);
  });

  it('decays back toward neutral when nothing is happening', () => {
    const m = new MomentumTracker();
    for (let t = 1; t < 80; t++) m.tick(t, 'home', 0.4, 0);
    const peak = m.current;
    for (let t = 80; t < 400; t++) m.tick(t, null, 0, 0);
    expect(Math.abs(m.current)).toBeLessThan(Math.abs(peak));
  });

  it('is capped in what it can do to an outcome, and never rewards the losing side', () => {
    expect(momentumBoost(1, 'home')).toBeCloseTo(BALANCE.MOMENTUM_MAX_EFFECT, 6);
    expect(momentumBoost(1, 'away')).toBeCloseTo(-BALANCE.MOMENTUM_MAX_EFFECT, 6);
    expect(Math.abs(momentumBoost(5, 'home'))).toBeLessThanOrEqual(BALANCE.MOMENTUM_MAX_EFFECT);
    // The cap has to stay small: this is the anti-rubber-banding guarantee.
    expect(BALANCE.MOMENTUM_MAX_EFFECT).toBeLessThanOrEqual(0.1);
  });

  it('only announces a shift once it has genuinely moved', () => {
    const m = new MomentumTracker();
    for (let t = 1; t < 20; t++) m.tick(t, t % 2 === 0 ? 'home' : 'away', 0.02, 0.02);
    expect(m.shouldAnnounce()).toBe(false);
    for (let t = 20; t < 200; t++) { m.impulse('GOAL', 'home'); m.tick(t, 'home', 0.5, 0); }
    expect(m.shouldAnnounce()).toBe(true);
    expect(m.shouldAnnounce()).toBe(false);
  });

  it('is wiped back toward level by the half-time whistle', () => {
    const m = new MomentumTracker();
    for (let t = 1; t < 200; t++) { m.impulse('GOAL', 'home'); m.tick(t, 'home', 0.5, 0); }
    const before = m.current;
    m.halfTime(80);
    expect(Math.abs(m.current)).toBeLessThan(Math.abs(before));
  });

  it('bands the value for the UI', () => {
    expect(momentumBand(-0.9)).toBe('AWAY_STRONG');
    expect(momentumBand(0)).toBe('EVEN');
    expect(momentumBand(0.9)).toBe('HOME_STRONG');
  });
});
