import { simulateMatch } from '@cf/engine';
import { squadOf, teamOf, setup } from './tacticsLib';

const A = squadOf('shapeA', 68), B = squadOf('shapeB', 64);
const N = Number(globalThis.process?.env?.['N'] ?? 300);

const typeCount = new Map<string, number>();
const impCount = new Map<number, number>();
let totalEvents = 0;
const perMinuteHi: number[] = new Array(31).fill(0);   // importance>=3 events per minute
const perMinuteAll: number[] = new Array(31).fill(0);
const lulls: number[] = [];      // longest gap in match-minutes with no importance>=3 event
const commentaryDupes: number[] = [];
const momentumSwings: number[] = [];

for (let i = 0; i < N; i++) {
  const res = simulateMatch(setup(`shape-${i}`,
    teamOf('home', A, {}), teamOf('away', B, {}),
    { enabledSpecialRules: ['DOUBLE_GOAL', 'NUMBERS_GAME', 'LONG_RANGE', 'SUDDEN_SPARK'] }));
  totalEvents += res.events.length;
  let lastHi = 0, worst = 0;
  const texts: string[] = [];
  for (const e of res.events) {
    typeCount.set(e.type, (typeCount.get(e.type) ?? 0) + 1);
    impCount.set(e.importance, (impCount.get(e.importance) ?? 0) + 1);
    const m = Math.min(30, Math.floor(e.minute));
    perMinuteAll[m]! += 1;
    if (e.importance >= 3) {
      perMinuteHi[m]! += 1;
      worst = Math.max(worst, e.minute - lastHi);
      lastHi = e.minute;
    }
    if (e.text) texts.push(e.text);
  }
  worst = Math.max(worst, res.durationMinutes - lastHi);
  lulls.push(worst);
  commentaryDupes.push(texts.length - new Set(texts).size);
  momentumSwings.push(res.events.filter((e) => e.type === 'MOMENTUM_SHIFT').length);
}

const m = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
console.log(`${N} matches, 68 vs 64 overall, swing windows on.\n`);
console.log(`events per match: ${(totalEvents / N).toFixed(1)}`);
console.log('by importance:');
for (const k of [1, 2, 3, 4, 5]) console.log(`  ${k}: ${((impCount.get(k) ?? 0) / N).toFixed(2)} per match`);
console.log('\nby type (per match, >0.05 only):');
for (const [t, c] of [...typeCount.entries()].sort((a, b) => b[1] - a[1])) {
  if (c / N >= 0.05) console.log(`  ${t.padEnd(20)} ${(c / N).toFixed(2)}`);
}
console.log(`\nlongest silent stretch (no importance>=3 event), mean ${m(lulls).toFixed(1)} min, max ${Math.max(...lulls).toFixed(1)} min`);
console.log(`repeated commentary lines within one match: mean ${m(commentaryDupes).toFixed(2)}`);
console.log(`MOMENTUM_SHIFT events per match: ${m(momentumSwings).toFixed(2)}`);
console.log('\nimportance>=3 events per match minute (the shape of a match):');
for (let i = 0; i < 31; i++) {
  const v = perMinuteHi[i]! / N;
  console.log(`  min ${String(i).padStart(2)} ${'#'.repeat(Math.round(v * 20))} ${v.toFixed(2)}`);
}
