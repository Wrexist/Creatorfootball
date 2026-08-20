import { advanceCycle, Ledger } from '@cf/engine';
import { startGame, registry, EPOCH, CYCLE_MS } from '../harness';

const reg = registry();
const totals: number[] = [];
const margins: number[] = [];
const shots: number[] = [];
let big = 0;
for (let s = 0; s < 8; s++) {
  let state = startGame(`score-${s}`);
  for (let i = 0; i < 22; i++) {
    const r = advanceCycle(state, { now: EPOCH + i * CYCLE_MS, registry: reg, ledger: Ledger.restore(state.ledger) });
    state = r.state;
    for (const m of r.results) {
      const t = m.homeScore + m.awayScore;
      totals.push(t);
      margins.push(Math.abs(m.homeScore - m.awayScore));
      shots.push(m.homeStats.shots, m.awayStats.shots);
      if (t >= 12) big++;
    }
  }
}
const st = (x: number[]) => {
  const m = x.reduce((a, b) => a + b, 0) / x.length;
  const sd = Math.sqrt(x.reduce((a, b) => a + (b - m) ** 2, 0) / x.length);
  const sorted = [...x].sort((a, b) => a - b);
  return { m, sd, p50: sorted[Math.floor(x.length / 2)], p95: sorted[Math.floor(x.length * 0.95)], max: sorted.at(-1) };
};
const g = st(totals), mg = st(margins), sh = st(shots);
console.log(`${totals.length} in-game league matches across 8 seasons`);
console.log(`goals per match  mean ${g.m.toFixed(2)}  sd ${g.sd.toFixed(2)}  median ${g.p50}  p95 ${g.p95}  max ${g.max}   (target 6.0-9.0)`);
console.log(`winning margin   mean ${mg.m.toFixed(2)}  p95 ${mg.p95}  max ${mg.max}`);
console.log(`shots per team   mean ${sh.m.toFixed(2)}  max ${sh.max}   (target 12-20)`);
console.log(`matches with 12+ goals: ${big} (${((big / totals.length) * 100).toFixed(1)}%)`);
const hist = new Map<number, number>();
for (const t of totals) hist.set(t, (hist.get(t) ?? 0) + 1);
console.log('goal-total distribution:');
for (const k of [...hist.keys()].sort((a, b) => a - b)) {
  console.log(`  ${String(k).padStart(2)}: ${'#'.repeat(Math.round((hist.get(k)! / totals.length) * 200))} ${((hist.get(k)! / totals.length) * 100).toFixed(1)}%`);
}
