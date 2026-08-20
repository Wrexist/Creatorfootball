import { simulateMatch } from '@cf/engine';
import { squadOf, teamOf, setup } from './tacticsLib';

const A = squadOf('cA', 68), B = squadOf('cB', 64);
const res = simulateMatch(setup('comm-1', teamOf('home', A, {}), teamOf('away', B, {}),
  { enabledSpecialRules: ['DOUBLE_GOAL', 'SUDDEN_SPARK'] }));

const withText = res.events.filter((e) => e.text && e.text.length > 0);
const counts = new Map<string, number>();
for (const e of withText) counts.set(e.text, (counts.get(e.text) ?? 0) + 1);
console.log(`one match: ${res.events.length} events, ${withText.length} carry text, ${counts.size} distinct lines`);
console.log(`\nmost repeated lines in this single match:`);
for (const [t, c] of [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 15)) {
  console.log(`  ${String(c).padStart(3)}x  ${t}`);
}

console.log(`\n--- the first 60 events a viewer would see (importance >= 2) ---`);
for (const e of res.events.filter((x) => x.importance >= 2).slice(0, 60)) {
  console.log(`  ${String(e.minute).padStart(2)}' [${e.type}] ${e.text}`);
}

// Distinct lines per event type across 200 matches.
const perType = new Map<string, Set<string>>();
const perTypeN = new Map<string, number>();
for (let i = 0; i < 200; i++) {
  const r = simulateMatch(setup(`comm-${i}`, teamOf('home', A, {}), teamOf('away', B, {}),
    { enabledSpecialRules: ['DOUBLE_GOAL', 'SUDDEN_SPARK'] }));
  for (const e of r.events) {
    if (!e.text) continue;
    if (!perType.has(e.type)) perType.set(e.type, new Set());
    perType.get(e.type)!.add(e.text);
    perTypeN.set(e.type, (perTypeN.get(e.type) ?? 0) + 1);
  }
}
console.log(`\n--- distinct commentary lines per event type, 200 matches ---`);
for (const [t, s] of [...perType.entries()].sort((a, b) => (perTypeN.get(b[0]) ?? 0) - (perTypeN.get(a[0]) ?? 0))) {
  console.log(`  ${t.padEnd(20)} ${String(perTypeN.get(t)).padStart(6)} lines emitted, ${String(s.size).padStart(4)} distinct`);
}
