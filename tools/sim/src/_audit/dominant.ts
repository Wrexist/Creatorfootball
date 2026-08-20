import { DEFAULT_TACTICS } from '@cf/engine';
import { squadOf, duelPoints, paired, type Opts } from './tacticsLib';

const N = Number(globalThis.process?.env?.['N'] ?? 1200);
const AXES: Record<string, string[]> = {
  press: ['LOW_BLOCK', 'MID_BLOCK', 'BALANCED', 'HIGH_PRESS'],
  line: ['DEEP', 'NORMAL', 'HIGH'],
  tempo: ['PATIENT', 'BALANCED', 'QUICK', 'FRANTIC'],
  passing: ['DIRECT', 'MIXED', 'SHORT'],
  buildUp: ['FROM_THE_BACK', 'BALANCED', 'BYPASS'],
  marking: ['ZONAL', 'MIXED', 'MAN'],
  risk: ['CAUTIOUS', 'MEASURED', 'BOLD', 'RECKLESS'],
  counter: ['NEVER', 'WHEN_ON', 'ALWAYS'],
  width: ['NARROW', 'BALANCED', 'WIDE'],
  focus: ['LEFT', 'CENTRE', 'RIGHT', 'BALANCED'],
  subStrategy: ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'],
};

const A = squadOf('sweepA', 65), B = squadOf('sweepB', 65);
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const winPct = (x: number[]) => (x.filter((v) => v === 3).length / x.length) * 100;

// --- Greedy hill climb against the BALANCED default opponent --------------
let cur: Opts = {};
let curPts = duelPoints(cur, {}, N, A, B);
console.log(`Greedy hill climb vs the BALANCED default, ${N} matches per evaluation.`);
console.log(`start: default  ${mean(curPts).toFixed(3)} ppg  ${winPct(curPts).toFixed(1)}% wins\n`);

for (let pass = 0; pass < 2; pass++) {
  for (const [axis, values] of Object.entries(AXES)) {
    let bestV: string | null = null, bestPts = curPts, bestM = mean(curPts);
    for (const v of values) {
      if ((cur as Record<string, string>)[axis] === v) continue;
      const cand = { ...cur, [axis]: v } as Opts;
      const p = duelPoints(cand, {}, N, A, B);
      if (mean(p) > bestM + 0.02) { bestM = mean(p); bestV = v; bestPts = p; }
    }
    if (bestV) {
      cur = { ...cur, [axis]: bestV } as Opts;
      curPts = bestPts;
      console.log(`  pass ${pass + 1}: ${axis} -> ${bestV}   now ${mean(curPts).toFixed(3)} ppg  ${winPct(curPts).toFixed(1)}% wins`);
    }
  }
}
console.log(`\nBEST FOUND: ${JSON.stringify({ ...DEFAULT_TACTICS, ...cur })}`);
console.log(`vs default: ${mean(curPts).toFixed(3)} ppg, ${winPct(curPts).toFixed(1)}% wins (default baseline ${mean(duelPoints({}, {}, N, A, B)).toFixed(3)})`);

// --- Does it beat the whole field? ---------------------------------------
console.log(`\nBest setup against every single-axis variant of the default:`);
let worstWin = 100, worstLabel = '';
for (const [axis, values] of Object.entries(AXES)) {
  for (const v of values) {
    const p = duelPoints(cur, { [axis]: v } as Opts, N, A, B);
    const w = winPct(p);
    if (w < worstWin) { worstWin = w; worstLabel = `${axis}=${v}`; }
    console.log(`  vs ${(axis + '=' + v).padEnd(26)} ${mean(p).toFixed(3)} ppg  ${w.toFixed(1)}% wins`);
  }
}
console.log(`\nWorst matchup for the best setup: ${worstLabel} at ${worstWin.toFixed(1)}% wins.`);

// --- Mirror check: does it beat ITSELF-as-opponent? ----------------------
const mirror = duelPoints(cur, cur, N, A, B);
console.log(`Mirror (best vs best): ${mean(mirror).toFixed(3)} ppg, ${winPct(mirror).toFixed(1)}% wins.`);

// --- How much squad quality is the tactic worth? -------------------------
console.log(`\nHow much squad quality does the best setup buy?`);
for (const edge of [0, 5, 10, 15, 20]) {
  const weak = squadOf(`weakE-${edge}`, 65 - edge);
  const p = duelPoints(cur, {}, N, weak, B);
  console.log(`  best setup on a squad ${edge} overall WORSE than the opponent: ${mean(p).toFixed(3)} ppg, ${winPct(p).toFixed(1)}% wins`);
}
