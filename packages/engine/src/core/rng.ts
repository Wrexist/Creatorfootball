/**
 * Centralised seeded randomness.
 *
 * RULE: no domain module may call Math.random(). Every stochastic decision in
 * the simulation flows through an Rng instance derived from the save seed, so
 * that (same seed + same inputs) === (same result). This is what makes replays,
 * regression tests, balance audits and bug reproduction possible.
 */

/** Non-cryptographic string hash used to derive stream seeds from labels. */
export function hashString(str: string, offset = 2166136261): number {
  let h = offset >>> 0;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = Math.imul(h, 16777619) >>> 0;
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
 * Four independent 32-bit lanes for the generator's state.
 *
 * The lanes used to be one hash XORed with four constants, which meant the
 * generator's real state space was 2^32 rather than 2^128 — two seeds colliding
 * in that single hash produced byte-identical worlds, and the lanes were
 * linearly related to one another at the start of every stream. Each lane is
 * now hashed from a distinct FNV basis and finalised separately, so the seed
 * space is the full width of the state and the lanes are independent.
 */
function seedLanes(seed: string): [number, number, number, number] {
  return [
    fmix32(hashString(seed, 0x811c9dc5)),
    fmix32(hashString(seed, 0x1000193)),
    fmix32(hashString(`${seed}#1`, 0x9e3779b9)),
    fmix32(hashString(`${seed}#2`, 0x85ebca6b)),
  ];
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
  private forkedLabels = new Set<string>();

  constructor(readonly seed: string, skip = 0) {
    const [a, b, c, d] = seedLanes(seed);
    this.next = sfc32(a, b, c, d);
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
   *
   * A fork is a pure function of (seed, label): forking the same label twice
   * deliberately returns the same stream, because that is what makes a
   * subsystem reproducible in isolation. The hazard is doing it by accident —
   * two call sites that both fork 'players' silently share a stream and their
   * "independent" draws are identical. In development that is reported;
   * `forkSequential` is the correct tool when you genuinely want N distinct
   * children under one label.
   */
  fork(label: string): Rng {
    if (this.forkedLabels.has(label)) {
      reportForkCollision(this.seed, label);
    }
    this.forkedLabels.add(label);
    return new Rng(`${this.seed}:${label}`);
  }

  /**
   * Derive the n-th distinct child under a label. Use inside loops, where every
   * iteration needs its own stream but the label is naturally the same.
   */
  forkSequential(label: string, index: number): Rng {
    return new Rng(`${this.seed}:${label}#${index}`);
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

/* ------------------------------------------------------- fork diagnostics */

export interface ForkCollision {
  readonly seed: string;
  readonly label: string;
}

let collisionMode: 'report' | 'throw' | 'off' = 'report';
const collisions: ForkCollision[] = [];

function reportForkCollision(seed: string, label: string): void {
  if (collisionMode === 'off') return;
  const collision: ForkCollision = { seed, label };
  if (collisionMode === 'throw') {
    throw new Error(
      `Rng.fork('${label}') was called twice on the same stream. Both children ` +
      `will produce identical values. Use forkSequential('${label}', i) instead.`,
    );
  }
  collisions.push(collision);
}

/**
 * `throw` in tests and audits, where an accidental shared stream is a defect;
 * `report` in development; `off` in production, where a duplicated stream is a
 * balance bug rather than a reason to lose a player's save.
 */
export const setForkCollisionMode = (mode: 'report' | 'throw' | 'off'): void => {
  collisionMode = mode;
};

export const drainForkCollisions = (): ForkCollision[] =>
  collisions.splice(0, collisions.length);

/**
 * Seed space is 32 bits, so roughly 4.3 billion distinct worlds. That is an
 * accepted limit: it is far beyond what a single-player game needs, and
 * widening it would shift every generated sequence and invalidate the tuned
 * balance figures for no gameplay benefit. If this engine is ever used to
 * arbitrate matches server-side across many concurrent games, revisit it then —
 * that is the case where collisions start to matter.
 */
export const RNG_SEED_BITS = 32;
