import { describe, expect, it } from 'vitest';
import { SeedStream, hashSeed } from './seed';

/**
 * These guard a defect that was invisible on screen until you looked at
 * hundreds of portraits side by side: channels of the same seed were
 * correlated, so the whole system could reach only 76 distinct faces across
 * 200,000 seeds, and skin tone effectively determined facial hair.
 */
const FEATURES = ['skin', 'hair', 'hairColor', 'facialHair', 'jaw', 'width', 'brow', 'eyes', 'nose', 'mouth'];

describe('procedural seeding', () => {
  it('is deterministic for a given seed and label', () => {
    expect(new SeedStream('abc').channel('skin')).toBe(new SeedStream('abc').channel('skin'));
  });

  it('gives different labels genuinely different values', () => {
    const stream = new SeedStream('same-seed');
    const values = FEATURES.map((f) => stream.channel(f));
    expect(new Set(values).size).toBe(FEATURES.length);
  });

  it('reaches a large space of distinct combinations', () => {
    const faces = new Set<string>();
    for (let i = 0; i < 20_000; i += 1) {
      const stream = new SeedStream(`player_${i}`);
      faces.add(FEATURES.map((f) => stream.int(f, 6)).join(','));
    }
    // Before the fix this was 76 across ten times as many seeds.
    expect(faces.size).toBeGreaterThan(19_000);
  });

  it('keeps features independent of one another', () => {
    // Every combination of skin tone and facial hair must be reachable, or the
    // art system is quietly encoding a correlation nobody asked for.
    const pairs = new Set<string>();
    for (let i = 0; i < 20_000; i += 1) {
      const stream = new SeedStream(`p${i}`);
      pairs.add(`${stream.int('skin', 6)}:${stream.int('facialHair', 6)}`);
    }
    expect(pairs.size).toBe(36);
  });

  it('distributes each channel roughly uniformly', () => {
    const buckets = new Array(10).fill(0) as number[];
    for (let i = 0; i < 40_000; i += 1) {
      const bucket = new SeedStream(`u${i}`).int('skin', 10);
      buckets[bucket] = (buckets[bucket] ?? 0) + 1;
    }
    for (const count of buckets) {
      expect(count).toBeGreaterThan(3_000);
      expect(count).toBeLessThan(5_000);
    }
  });

  it('makes adjacent seeds look unrelated', () => {
    const a = new SeedStream('player_1000');
    const b = new SeedStream('player_1001');
    const differing = FEATURES.filter((f) => a.int(f, 6) !== b.int(f, 6));
    expect(differing.length).toBeGreaterThanOrEqual(6);
  });

  it('hashes stably across calls', () => {
    expect(hashSeed('creator-football')).toBe(hashSeed('creator-football'));
    expect(hashSeed('a')).not.toBe(hashSeed('b'));
  });
});
