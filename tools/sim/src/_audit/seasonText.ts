import { advanceCycle, Ledger, formatMoney, computeStandings } from '@cf/engine';
import { startGame, registry, EPOCH, CYCLE_MS, ledgerOf } from '../harness';

let state = startGame('text-1');
const reg = registry();
const storyLines: string[] = [];
const postLines: string[] = [];
const objectiveEvents: string[] = [];
const income: number[] = [], spend: number[] = [];

for (let i = 0; i < 22; i++) {
  const r = advanceCycle(state, { now: EPOCH + i * CYCLE_MS, registry: reg, ledger: Ledger.restore(state.ledger) });
  state = r.state;
  income.push(r.summary.income); spend.push(r.summary.expenditure);
  for (const s of r.stories) storyLines.push(`w${r.summary.week} [${s.outlet ?? '?'}] ${s.headline}`);
  for (const p of r.posts) postLines.push(`w${r.summary.week} @${(p as { author?: string }).author ?? '?'}: ${(p as { text?: string; body?: string }).text ?? (p as { body?: string }).body ?? JSON.stringify(p).slice(0, 120)}`);
  if (r.summary.objectivesCompleted) objectiveEvents.push(`w${r.summary.week}: ${r.summary.objectivesCompleted} objective(s) completed`);
}

console.log(`=== ONE SEASON of media headlines (${storyLines.length} total) ===`);
for (const l of storyLines) console.log('  ' + l);
const heads = storyLines.map((l) => l.replace(/^w\d+ \[[^\]]*\] /, ''));
console.log(`\ndistinct headlines: ${new Set(heads).size} / ${heads.length}`);
const hc = new Map<string, number>();
for (const h of heads) hc.set(h, (hc.get(h) ?? 0) + 1);
console.log('most repeated headlines:');
for (const [h, c] of [...hc.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10)) console.log(`  ${c}x  ${h}`);

console.log(`\n=== SOCIAL POSTS, weeks 1-3 sample ===`);
for (const l of postLines.filter((l) => /^w[123]:|^w[123] /.test(l)).slice(0, 40)) console.log('  ' + l);
const bodies = postLines.map((l) => l.replace(/^w\d+ @[^:]*: /, ''));
console.log(`\ntotal posts ${bodies.length}, distinct ${new Set(bodies).size}`);
const pc = new Map<string, number>();
for (const b of bodies) pc.set(b, (pc.get(b) ?? 0) + 1);
console.log('most repeated posts:');
for (const [b, c] of [...pc.entries()].sort((a, b2) => b2[1] - a[1]).slice(0, 10)) console.log(`  ${c}x  ${b}`);

console.log(`\n=== ECONOMY ===`);
console.log(`income/cycle mean ${formatMoney(income.reduce((a, b) => a + b, 0) / 22)}, spend ${formatMoney(spend.reduce((a, b) => a + b, 0) / 22)}`);
console.log(`end cash ${formatMoney(ledgerOf(state).cashOf(state.playerClubId))}`);
console.log(`objectives: ${state.objectives.active.length} active, ${state.objectives.completed.length} completed, seasonTargets ${state.objectives.seasonTargets.length}`);
console.log('completed objective titles:');
const oc = new Map<string, number>();
for (const o of state.objectives.completed) oc.set(o.title, (oc.get(o.title) ?? 0) + 1);
for (const [t, c] of [...oc.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${c}x ${t}`);
console.log('\nactive objectives now:');
for (const o of state.objectives.active) console.log(`  [${o.status}] ${o.title} — ${o.progress}/${o.target}`);
