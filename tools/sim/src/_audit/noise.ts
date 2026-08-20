import { squadOf, duel, pts, winPct } from './tacticsLib';
const A = squadOf('sweepA', 65), B = squadOf('sweepB', 65);
const N = 800;
const vals: number[] = [];
for (const tag of ['r1', 'r2', 'r3', 'r4', 'r5', 'r6', 'r7', 'r8']) {
  const r = duel(tag, {}, 'default', {}, N, A, B);
  vals.push(pts(r));
  console.log(`${tag}: ppg ${pts(r).toFixed(3)} win ${winPct(r).toFixed(1)}% GF ${(r.gf / r.n).toFixed(2)} GA ${(r.ga / r.n).toFixed(2)}`);
}
const m = vals.reduce((a, b) => a + b) / vals.length;
const sd = Math.sqrt(vals.reduce((a, b) => a + (b - m) ** 2, 0) / (vals.length - 1));
console.log(`mean ${m.toFixed(3)} sd-between-runs ${sd.toFixed(3)}  (theoretical SE ~0.050)`);
