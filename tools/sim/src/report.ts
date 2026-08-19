/**
 * Shared reporting for the headless audit harness.
 *
 * These tools run the real engine with no UI, which is only possible because
 * the engine has no UI or platform dependencies. Their output is meant to be
 * read by a human designer, so it is formatted for a terminal rather than
 * emitted as raw JSON.
 */

const ESC = String.fromCharCode(27);
const RESET = ESC + '[0m';
const DIM = ESC + '[2m';
const BOLD = ESC + '[1m';
const GREEN = ESC + '[32m';
const RED = ESC + '[31m';
const YELLOW = ESC + '[33m';

export const heading = (text: string): void => {
  const line = '-'.repeat(Math.max(0, 72 - text.length - 3));
  console.log(`\n${BOLD}${text}${RESET} ${DIM}${line}${RESET}`);
};

export const note = (text: string): void => console.log(`${DIM}${text}${RESET}`);

export interface Check {
  readonly label: string;
  readonly value: number;
  readonly min?: number;
  readonly max?: number;
  readonly unit?: string;
  readonly dp?: number;
}

export interface CheckResult extends Check {
  readonly pass: boolean;
}

export function evaluate(checks: readonly Check[]): CheckResult[] {
  return checks.map((c) => ({
    ...c,
    pass:
      (c.min === undefined || c.value >= c.min) &&
      (c.max === undefined || c.value <= c.max) &&
      Number.isFinite(c.value),
  }));
}

export function printChecks(checks: readonly CheckResult[]): boolean {
  const labelWidth = Math.max(...checks.map((c) => c.label.length), 10);
  let allPass = true;

  for (const c of checks) {
    if (!c.pass) allPass = false;
    const dp = c.dp ?? 2;
    const value = `${c.value.toFixed(dp)}${c.unit ?? ''}`;
    const bandParts: string[] = [];
    if (c.min !== undefined) bandParts.push(`>= ${c.min}`);
    if (c.max !== undefined) bandParts.push(`<= ${c.max}`);
    const band = bandParts.length ? `${DIM}target ${bandParts.join(', ')}${RESET}` : '';
    const mark = c.pass ? `${GREEN}PASS${RESET}` : `${RED}FAIL${RESET}`;
    console.log(`  ${mark}  ${c.label.padEnd(labelWidth)}  ${value.padStart(12)}   ${band}`);
  }
  return allPass;
}

export function table(rows: readonly Record<string, string | number>[]): void {
  if (!rows.length) { note('  (no rows)'); return; }
  const columns = Object.keys(rows[0] as Record<string, unknown>);
  const widths = columns.map((col) =>
    Math.max(col.length, ...rows.map((r) => String(r[col] ?? '').length)),
  );
  const header = columns.map((c, i) => c.padEnd(widths[i] as number)).join('  ');
  console.log(`  ${DIM}${header}${RESET}`);
  for (const row of rows) {
    console.log(`  ${columns.map((c, i) => String(row[c] ?? '').padEnd(widths[i] as number)).join('  ')}`);
  }
}

export const warn = (text: string): void => console.log(`  ${YELLOW}WARN${RESET}  ${text}`);
export const fail = (text: string): void => console.log(`  ${RED}FAIL${RESET}  ${text}`);
export const pass = (text: string): void => console.log(`  ${GREEN}PASS${RESET}  ${text}`);

export function summarise(name: string, ok: boolean): void {
  console.log(
    ok
      ? `\n${GREEN}${BOLD}[OK] ${name} passed${RESET}\n`
      : `\n${RED}${BOLD}[X] ${name} failed${RESET}\n`,
  );
}

/** Distribution helpers used across every audit. */
export const stats = (values: readonly number[]) => {
  if (!values.length) return { n: 0, mean: 0, sd: 0, min: 0, max: 0, p05: 0, p50: 0, p95: 0 };
  const sorted = values.slice().sort((a, b) => a - b);
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const sd = Math.sqrt(values.reduce((acc, v) => acc + (v - mean) ** 2, 0) / n);
  const at = (p: number) => sorted[Math.min(n - 1, Math.max(0, Math.round((p / 100) * (n - 1))))] as number;
  return { n, mean, sd, min: sorted[0] as number, max: sorted[n - 1] as number, p05: at(5), p50: at(50), p95: at(95) };
};

/** Histogram for scoreline and balance distributions, printed as text bars. */
export function histogram(values: readonly number[], buckets: number, label: string): void {
  if (!values.length) return;
  const min = Math.min(...values);
  const max = Math.max(...values);
  const width = (max - min) / buckets || 1;
  const counts = new Array(buckets).fill(0) as number[];
  for (const v of values) {
    const idx = Math.min(buckets - 1, Math.floor((v - min) / width));
    counts[idx] = (counts[idx] as number) + 1;
  }
  const peak = Math.max(...counts);
  note(`  ${label}`);
  counts.forEach((count, i) => {
    const lo = (min + i * width).toFixed(1);
    const bar = '#'.repeat(Math.round((count / peak) * 40));
    console.log(`    ${lo.padStart(7)} | ${bar} ${DIM}${count}${RESET}`);
  });
}
