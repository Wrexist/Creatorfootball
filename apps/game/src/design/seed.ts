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

/** murmur3 finaliser: full avalanche, so one changed input bit moves half the output. */
function fmix32(h: number): number {
  let x = h >>> 0;
  x ^= x >>> 16;
  x = Math.imul(x, 0x85ebca6b);
  x ^= x >>> 13;
  x = Math.imul(x, 0xc2b2ae35);
  x ^= x >>> 16;
  return x >>> 0;
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

  /**
   * Named channels stay stable when unrelated channels are added or removed.
   *
   * The label is mixed *through* the hash function rather than XORed into the
   * root. XOR is linear: a label could only ever flip fixed bits of the root,
   * and the single xorshift round that followed did not diffuse them, so
   * different channels of the same seed stayed strongly correlated. The visible
   * cost was severe — the whole portrait system could reach only 32 distinct
   * faces across every possible seed, and the correlation tied features
   * together, so skin tone effectively determined facial hair. Multiplicative
   * mixing plus a full murmur3 finaliser restores channel independence.
   */
  channel(label: string): number {
    let h = this.root;
    for (let i = 0; i < label.length; i += 1) {
      h ^= label.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    return fmix32(h) / 0x100000000;
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
