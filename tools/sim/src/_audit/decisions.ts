import { MatchSimulator, type DecisionPrompt } from '@cf/engine';
import { squadOf, teamOf, setup } from './tacticsLib';

/**
 * Live decisions: does the option you pick change the result?
 * For each prompt raised, the harness always picks option index k. Under common
 * random numbers, the only difference between runs is which option was chosen.
 */
const N = Number(globalThis.process?.env?.['N'] ?? 1000);
const A = squadOf('decA', 65), B = squadOf('decB', 65);

function playPickingIndex(seed: string, idx: number, log?: Map<string, number>): { pts: number; gf: number; ga: number } {
  const s = setup(seed, teamOf('home', A, {}), teamOf('away', B, {}),
    { enabledSpecialRules: ['DOUBLE_GOAL', 'NUMBERS_GAME', 'LONG_RANGE', 'SUDDEN_SPARK'] });
  const cfg = { ...s.config, liveDecisions: true, maxDecisions: 3 };
  const sim = new MatchSimulator({ ...s, config: cfg, home: { ...s.home, isPlayerControlled: true } });
  let guard = 0;
  while (!sim.isComplete && guard++ < 5000) {
    const prompt: DecisionPrompt | null = sim.pendingDecision();
    if (prompt) {
      if (log) log.set(prompt.trigger, (log.get(prompt.trigger) ?? 0) + 1);
      const opt = prompt.options[Math.min(idx, prompt.options.length - 1)]!;
      sim.resolveDecision(prompt.id, opt.id);
      continue;
    }
    sim.step();
  }
  const r = sim.finish();
  return { pts: r.homeScore > r.awayScore ? 3 : r.homeScore === r.awayScore ? 1 : 0, gf: r.homeScore, ga: r.awayScore };
}

const triggers = new Map<string, number>();
const results: Record<number, { pts: number[]; gf: number; ga: number }> = {};
for (const idx of [0, 1, 2]) results[idx] = { pts: [], gf: 0, ga: 0 };
for (let i = 0; i < N; i++) {
  for (const idx of [0, 1, 2]) {
    const r = playPickingIndex(`dec-${i}`, idx, idx === 0 ? triggers : undefined);
    results[idx]!.pts.push(r.pts); results[idx]!.gf += r.gf; results[idx]!.ga += r.ga;
  }
}
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
function paired(x: number[], y: number[]) {
  const n = x.length; let s = 0;
  for (let i = 0; i < n; i++) s += x[i]! - y[i]!;
  const m = s / n; let v = 0;
  for (let i = 0; i < n; i++) v += ((x[i]! - y[i]!) - m) ** 2;
  return { d: m, se: Math.sqrt(v / (n - 1) / n) };
}
console.log(`Live decisions: always pick option #k, ${N} matches per policy, identical seeds.\n`);
for (const idx of [0, 1, 2]) {
  const r = results[idx]!;
  const st = paired(r.pts, results[0]!.pts);
  console.log(`  always option #${idx + 1}: ${mean(r.pts).toFixed(3)} ppg  GF ${(r.gf / N).toFixed(2)}  GA ${(r.ga / N).toFixed(2)}` +
    (idx > 0 ? `   Δ vs #1 ${(st.d >= 0 ? '+' : '') + st.d.toFixed(3)} (SE ${st.se.toFixed(3)}, z ${(st.d / st.se).toFixed(2)})` : ''));
}
console.log(`\nprompt triggers raised (per ${N} matches):`);
for (const [t, c] of [...triggers.entries()].sort((a, b) => b[1] - a[1])) console.log(`  ${t.padEnd(26)} ${c} (${(c / N).toFixed(2)} per match)`);
