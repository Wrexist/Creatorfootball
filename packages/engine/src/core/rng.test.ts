import { describe, expect, it, beforeEach } from 'vitest';
import { Rng, drainForkCollisions, setForkCollisionMode } from './rng';

describe('seeded randomness', () => {
  beforeEach(() => {
    setForkCollisionMode('report');
    drainForkCollisions();
  });

  it('reproduces an identical sequence from the same seed', () => {
    const a = Array.from({ length: 50 }, () => new Rng('seed').raw());
    const b = Array.from({ length: 50 }, () => new Rng('seed').raw());
    expect(a).toEqual(b);
  });

  it('produces different sequences for different seeds', () => {
    const a = new Rng('one');
    const b = new Rng('two');
    const drawsA = Array.from({ length: 20 }, () => a.raw());
    const drawsB = Array.from({ length: 20 }, () => b.raw());
    expect(drawsA).not.toEqual(drawsB);
  });

  it('restores exactly from a serialised state', () => {
    const original = new Rng('restore');
    for (let i = 0; i < 17; i++) original.raw();
    const restored = Rng.restore(original.serialize());
    expect(restored.raw()).toBe(new Rng('restore', 17).raw());
  });

  it('keeps forked streams independent of the parent and of each other', () => {
    const parent = new Rng('root');
    const a = parent.fork('transfers');
    const b = parent.fork('matches');
    expect(Array.from({ length: 10 }, () => a.raw()))
      .not.toEqual(Array.from({ length: 10 }, () => b.raw()));
  });

  it('makes a fork deterministic for a given label', () => {
    const first = new Rng('root').fork('media').raw();
    const second = new Rng('root').fork('media').raw();
    expect(first).toBe(second);
  });

  it('reports when the same label is forked twice from one stream', () => {
    const parent = new Rng('root');
    parent.fork('players');
    parent.fork('players');
    const collisions = drainForkCollisions();
    expect(collisions).toHaveLength(1);
    expect(collisions[0]?.label).toBe('players');
  });

  it('throws on a fork collision when asked to', () => {
    setForkCollisionMode('throw');
    const parent = new Rng('root');
    parent.fork('dup');
    expect(() => parent.fork('dup')).toThrow(/forkSequential/);
    setForkCollisionMode('report');
  });

  it('gives forkSequential a distinct stream per index without collisions', () => {
    const parent = new Rng('root');
    const streams = Array.from({ length: 5 }, (_, i) => parent.forkSequential('club', i));
    const firstDraws = streams.map((s) => s.raw());
    expect(new Set(firstDraws).size).toBe(5);
    expect(drainForkCollisions()).toHaveLength(0);
  });

  it('stays inside its stated bounds', () => {
    const rng = new Rng('bounds');
    for (let i = 0; i < 500; i++) {
      const v = rng.raw();
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThan(1);
      const n = rng.int(3, 7);
      expect(n).toBeGreaterThanOrEqual(3);
      expect(n).toBeLessThanOrEqual(7);
    }
  });

  it('respects weights, including zero-weight entries', () => {
    const rng = new Rng('weights');
    const counts = { a: 0, b: 0, never: 0 };
    const items = [
      { key: 'a' as const, w: 3 },
      { key: 'b' as const, w: 1 },
      { key: 'never' as const, w: 0 },
    ];
    for (let i = 0; i < 4000; i++) counts[rng.weighted(items, (x) => x.w).key]++;
    expect(counts.never).toBe(0);
    // Roughly 3:1, with generous tolerance for sampling noise.
    expect(counts.a / counts.b).toBeGreaterThan(2.3);
    expect(counts.a / counts.b).toBeLessThan(4.0);
  });

  it('shuffles without mutating the input or losing elements', () => {
    const rng = new Rng('shuffle');
    const input = [1, 2, 3, 4, 5, 6, 7, 8];
    const out = rng.shuffle(input);
    expect(input).toEqual([1, 2, 3, 4, 5, 6, 7, 8]);
    expect(out.slice().sort((a, b) => a - b)).toEqual(input);
  });

  it('produces a normal distribution with the requested shape', () => {
    const rng = new Rng('normal');
    const samples = Array.from({ length: 8000 }, () => rng.normal(50, 10));
    const mean = samples.reduce((a, b) => a + b, 0) / samples.length;
    const sd = Math.sqrt(samples.reduce((acc, v) => acc + (v - mean) ** 2, 0) / samples.length);
    expect(mean).toBeGreaterThan(48.5);
    expect(mean).toBeLessThan(51.5);
    expect(sd).toBeGreaterThan(9);
    expect(sd).toBeLessThan(11);
  });
});
