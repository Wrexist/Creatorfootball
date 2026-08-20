import { DEFAULT_TACTICS } from '@cf/engine';
import { squadOf, duelPoints, paired } from './tacticsLib';

const N = Number(globalThis.process?.env?.['N'] ?? 2000);
const AXES: Record<string, string[]> = {
  tempo: ['PATIENT', 'BALANCED', 'QUICK', 'FRANTIC'],
  press: ['LOW_BLOCK', 'MID_BLOCK', 'BALANCED', 'HIGH_PRESS'],
  line: ['DEEP', 'NORMAL', 'HIGH'],
  width: ['NARROW', 'BALANCED', 'WIDE'],
  passing: ['DIRECT', 'MIXED', 'SHORT'],
  buildUp: ['FROM_THE_BACK', 'BALANCED', 'BYPASS'],
  focus: ['LEFT', 'CENTRE', 'RIGHT', 'BALANCED'],
  marking: ['ZONAL', 'MIXED', 'MAN'],
  risk: ['CAUTIOUS', 'MEASURED', 'BOLD', 'RECKLESS'],
  counter: ['NEVER', 'WHEN_ON', 'ALWAYS'],
  subStrategy: ['CONSERVATIVE', 'BALANCED', 'AGGRESSIVE'],
};

const A = squadOf('sweepA', 65), B = squadOf('sweepB', 65);
const base = duelPoints({}, {}, N, A, B);
const bm = base.reduce((a, b) => a + b, 0) / N;
console.log(`Paired single-axis sweep (common random numbers), ${N} matches per cell.`);
console.log(`Default vs default baseline: ${bm.toFixed(3)} ppg\n`);
console.log(`  ${'setting'.padEnd(26)} ${'ppg'.padStart(6)} ${'Δppg'.padStart(7)} ${'SE'.padStart(6)} ${'z'.padStart(6)}`);

const rows: { k: string; ppg: number; d: number; z: number }[] = [];
for (const [axis, values] of Object.entries(AXES)) {
  for (const v of values) {
    const p = duelPoints({ [axis]: v } as never, {}, N, A, B);
    const m = p.reduce((a, b) => a + b, 0) / N;
    const st = paired(p, base);
    const isDef = (DEFAULT_TACTICS as Record<string, string>)[axis] === v;
    const k = `${axis}=${v}${isDef ? ' *' : ''}`;
    rows.push({ k, ppg: m, d: st.diff, z: st.z });
    console.log(`  ${k.padEnd(26)} ${m.toFixed(3).padStart(6)} ${(st.diff >= 0 ? '+' : '') + st.diff.toFixed(3)} ${st.se.toFixed(3).padStart(6)} ${st.z.toFixed(2).padStart(6)}`);
  }
}
console.log('\nRanked by ppg:');
for (const r of [...rows].sort((a, b) => b.ppg - a.ppg)) {
  console.log(`  ${r.k.padEnd(26)} ${r.ppg.toFixed(3)}  (z=${r.z.toFixed(2)})`);
}
const best = rows.reduce((a, b) => (a.ppg > b.ppg ? a : b));
const worst = rows.reduce((a, b) => (a.ppg < b.ppg ? a : b));
console.log(`\nWhole single-axis space spans ${worst.ppg.toFixed(3)} .. ${best.ppg.toFixed(3)} ppg (${(best.ppg - worst.ppg).toFixed(3)} range).`);
