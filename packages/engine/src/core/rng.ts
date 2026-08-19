/**
 * Centralised seeded randomness.
 *
 * RULE: no domain module may call Math.random(). Every stochastic decision in
 * the simulation flows through an Rng instance derived from the save seed, so
 * that (same seed + same inputs) === (same result). This is what makes replays,
 * regression tests, balance audits and bug reproduction possible.
 */

/** Non-cryptographic string hash used to derive stream seeds from labels. */
export function hashString(str: string): number {
  let h = 2166136261 >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
  }
  return h >>> 0;
}

/** sfc32 — fast, small state, excellent statistical quality for game use. */
function sfc32(a: number, b: number, c: number, d: number): () => number {
  return function next(): number {
    a >>>= 0; b >>>= 0; c >>>= 0; d >>>= 0;
    let t = (a + b) | 0;
    a = b ^ (b >>> 9);
    b = (c + (c << 3)) | 0;
    c = (c << 21) | (c >>> 11);
    d = (d + 1) | 0;
    t = (t + d) | 0;
    c = (c + t) | 0;
    return (t >>> 0) / 4294967296;
  };
}

export interface RngState {
  readonly seed: string;
  readonly calls: number;
}

export class Rng {
  private readonly next: () => number;
  private _calls = 0;

  constructor(readonly seed: string, skip = 0) {
    const h = hashString(seed);
    this.next = sfc32(h ^ 0x9e3779b9, h ^ 0x85ebca6b, h ^ 0xc2b2ae35, h ^ 0x27d4eb2f);
    // Discard the first values: sfc32 needs a short warm-up to decorrelate.
    for (let i = 0; i < 12; i++) this.next();
    for (let i = 0; i < skip; i++) this.raw();
  }

  /** Float in [0, 1). */
  raw(): number {
    this._calls++;
    return this.next();
  }

  get calls(): number { return this._calls; }

  serialize(): RngState { return { seed: this.seed, calls: this._calls }; }

  static restore(state: RngState): Rng { return new Rng(state.seed, state.calls); }

  /**
   * Derive an independent child stream. Use this to isolate subsystems so that
   * adding a die roll in the transfer market cannot shift match outcomes.
   */
  fork(label: string): Rng {
    return new Rng(`${this.seed}:${label}`);
  }

  /** Float in [min, max). */
  float(min = 0, max = 1): number { return min + this.raw() * (max - min); }

  /** Integer in [min, max] inclusive. */
  int(min: number, max: number): number {
    if (max < min) return min;
    return min + Math.floor(this.raw() * (max - min + 1));
  }

  /** True with probability p. */
  chance(p: number): boolean { return this.raw() < p; }

  pick<T>(items: readonly T[]): T {
    if (items.length === 0) throw new Error('Rng.pick: empty array');
    return items[Math.floor(this.raw() * items.length)] as T;
  }

  /** Weighted pick. Weights need not be normalised; non-positive weights are skipped. */
  weighted<T>(items: readonly T[], weight: (item: T, index: number) => number): T {
    if (items.length === 0) throw new Error('Rng.weighted: empty array');
    let total = 0;
    const weights: number[] = [];
    for (let i = 0; i < items.length; i++) {
      const w = Math.max(0, weight(items[i] as T, i));
      weights.push(w);
      total += w;
    }
    if (total <= 0) return this.pick(items);
    let roll = this.raw() * total;
    for (let i = 0; i < items.length; i++) {
      roll -= weights[i] as number;
      if (roll <= 0) return items[i] as T;
    }
    return items[items.length - 1] as T;
  }

  /** Fisher-Yates. Returns a new array; never mutates the input. */
  shuffle<T>(items: readonly T[]): T[] {
    const out = items.slice();
    for (let i = out.length - 1; i > 0; i--) {
      const j = Math.floor(this.raw() * (i + 1));
      const tmp = out[i] as T;
      out[i] = out[j] as T;
      out[j] = tmp;
    }
    return out;
  }

  /** Sample n distinct items (or all of them if n exceeds the pool). */
  sample<T>(items: readonly T[], n: number): T[] {
    return this.shuffle(items).slice(0, Math.max(0, Math.min(n, items.length)));
  }

  /** Box-Muller normal sample. */
  normal(mean = 0, stdDev = 1): number {
    const u1 = Math.max(this.raw(), 1e-12);
    const u2 = this.raw();
    return mean + stdDev * Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  /** Normal sample clamped to a range — the workhorse for attribute generation. */
  normalClamped(mean: number, stdDev: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, this.normal(mean, stdDev)));
  }

  /** Triangular distribution — useful when a mode is more meaningful than a mean. */
  triangular(min: number, mode: number, max: number): number {
    const u = this.raw();
    const c = (mode - min) / (max - min);
    return u < c
      ? min + Math.sqrt(u * (max - min) * (mode - min))
      : max - Math.sqrt((1 - u) * (max - min) * (max - mode));
  }
}

/** Convenience for tests and content generation. */
export const rngFrom = (seed: string): Rng => new Rng(seed);
