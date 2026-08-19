/**
 * Deterministic seeded randomness for procedural art (portraits, avatars,
 * badges, crowd noise, sparkline placeholders).
 *
 * This is intentionally *not* the engine's `Rng`: the engine's stream is a
 * simulation resource whose consumption order is part of the save's
 * determinism contract. Rendering must never draw from it, or scrolling a list
 * would change match results. This is a separate, pure, stateless hash.
 */

/** FNV-1a 32-bit. Fast, dependency-free, and good enough for visual variety. */
export function hashSeed(seed: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i += 1) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * A tiny counter-based PRNG. Counter-based (rather than stateful) so that any
 * layer of a procedural drawing can ask for "value #7 of this seed" without
 * caring whether earlier layers drew first — which keeps a portrait stable even
 * if we later add a feature between two existing ones.
 */
export class SeedStream {
  private readonly root: number;
  private counter = 0;

  constructor(seed: string) {
    this.root = hashSeed(seed);
  }

  /** Named channels stay stable when unrelated channels are added or removed. */
  channel(label: string): number {
    const h = hashSeed(label) ^ this.root;
    // xorshift32 finaliser: cheap avalanche so adjacent seeds look unrelated.
    let x = h >>> 0 || 1;
    x ^= x << 13; x >>>= 0;
    x ^= x >>> 17;
    x ^= x << 5; x >>>= 0;
    return x / 0x100000000;
  }

  next(): number {
    this.counter += 1;
    return this.channel(`#${this.counter}`);
  }

  /** Integer in [0, n). */
  int(label: string, n: number): number {
    return Math.floor(this.channel(label) * n) % Math.max(1, n);
  }

  /** Float in [min, max]. */
  range(label: string, min: number, max: number): number {
    return min + this.channel(label) * (max - min);
  }

  pick<T>(label: string, items: readonly T[]): T {
    // `noUncheckedIndexedAccess` is on; the modulo guarantees the index exists
    // for any non-empty array, and an empty array is a programming error.
    const item = items[this.int(label, items.length)];
    if (item === undefined) throw new Error('SeedStream.pick called with an empty array');
    return item;
  }

  /** True with probability p. */
  chance(label: string, p: number): boolean {
    return this.channel(label) < p;
  }
}

/** Convenience for one-off draws where constructing a stream is noise. */
export const seededPick = <T,>(seed: string, items: readonly T[]): T =>
  new SeedStream(seed).pick('pick', items);
