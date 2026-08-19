export const clamp = (v: number, min: number, max: number): number =>
  v < min ? min : v > max ? max : v;

export const clamp01 = (v: number): number => clamp(v, 0, 1);

export const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;

export const invLerp = (a: number, b: number, v: number): number =>
  a === b ? 0 : clamp01((v - a) / (b - a));

export const round = (v: number, dp = 0): number => {
  const f = 10 ** dp;
  return Math.round(v * f) / f;
};

/** Logistic curve. Maps an unbounded advantage score into a probability. */
export const logistic = (x: number, steepness = 1): number =>
  1 / (1 + Math.exp(-x * steepness));

/** Sum of an array of numbers. */
export const sum = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0);

/** Arithmetic mean; returns 0 for an empty array rather than NaN. */
export const mean = (xs: readonly number[]): number => (xs.length ? sum(xs) / xs.length : 0);

/** Weighted mean of {value, weight} pairs. */
export const weightedMean = (
  entries: readonly { value: number; weight: number }[],
): number => {
  const total = sum(entries.map((e) => e.weight));
  if (total <= 0) return 0;
  return sum(entries.map((e) => e.value * e.weight)) / total;
};

export const stdDev = (xs: readonly number[]): number => {
  if (xs.length < 2) return 0;
  const m = mean(xs);
  return Math.sqrt(mean(xs.map((x) => (x - m) ** 2)));
};

export const percentile = (xs: readonly number[], p: number): number => {
  if (!xs.length) return 0;
  const sorted = xs.slice().sort((a, b) => a - b);
  const idx = clamp(Math.round((p / 100) * (sorted.length - 1)), 0, sorted.length - 1);
  return sorted[idx] as number;
};

/** Move `current` toward `target` by at most `maxDelta`. */
export const approach = (current: number, target: number, maxDelta: number): number => {
  const diff = target - current;
  if (Math.abs(diff) <= maxDelta) return target;
  return current + Math.sign(diff) * maxDelta;
};

/** Exponential decay toward a resting value — used by momentum, morale, sentiment. */
export const decayToward = (current: number, resting: number, rate: number): number =>
  current + (resting - current) * clamp01(rate);

export const isFiniteNumber = (v: unknown): v is number =>
  typeof v === 'number' && Number.isFinite(v);
