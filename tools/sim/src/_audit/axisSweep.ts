import { DEFAULT_TACTICS } from '@cf/engine';
import { squadOf, duel, fmt, pts, winPct } from './tacticsLib';

const N = Number(globalThis.process?.env?.['N'] ?? 600);

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

// Two equal squads, generated independently.
const A = squadOf('sweepA', 65);
const B = squadOf('sweepB', 65);

console.log(`Single-axis sweep vs the BALANCED default, ${N} matches per cell, sides alternated.`);
console.log(`Baseline sanity (default vs default):`);
console.log('  ' + fmt(duel('def', {}, 'def', {}, N, A, B)));
console.log('');

const all: { axis: string; value: string; ppg: number; win: number; line: string }[] = [];
for (const [axis, values] of Object.entries(AXES)) {
  console.log(`--- ${axis} ---`);
  for (const v of values) {
    const r = duel(`${axis}=${v}`, { [axis]: v } as never, 'default', {}, N, A, B);
    const isDefault = (DEFAULT_TACTICS as Record<string, string>)[axis] === v;
    const line = `  ${v.padEnd(15)}${isDefault ? '*' : ' '} ${fmt(r)}`;
    console.log(line);
    all.push({ axis, value: v, ppg: pts(r), win: winPct(r), line });
  }
}

console.log('\n=== Ranked by points per game against the default ===');
for (const a of all.sort((x, y) => y.ppg - x.ppg)) {
  console.log(`  ${(a.axis + '=' + a.value).padEnd(28)} ppg ${a.ppg.toFixed(3)}  win ${a.win.toFixed(1)}%`);
}
