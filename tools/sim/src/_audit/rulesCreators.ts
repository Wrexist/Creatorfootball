import { SPECIAL_RULES, type SpecialRuleId } from '@cf/engine';
import { squadOf, duelPoints, paired, teamOf, setup, type Opts } from './tacticsLib';
import { simulateMatch } from '@cf/engine';

const N = Number(globalThis.process?.env?.['N'] ?? 1500);
const A = squadOf('rA', 65), B = squadOf('rB', 65);
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
const win = (x: number[]) => (x.filter((v) => v === 3).length / x.length) * 100;

// --- 1. Do the four swing-window rules change the balance of the match? ---
console.log(`Swing windows: which rule is drawn, and what it does. ${N} matches per cell.\n`);
const WINDOW_RULES: SpecialRuleId[] = ['DOUBLE_GOAL', 'NUMBERS_GAME', 'LONG_RANGE', 'SUDDEN_SPARK'];
for (const r of [null, ...WINDOW_RULES]) {
  const over = { enabledSpecialRules: r ? [r] : [] } as never;
  let gf = 0, ga = 0, n = 0;
  const perms = [
    { h: teamOf('home', A, {}), a: teamOf('away', B, {}), hHome: true },
    { h: teamOf('home', B, {}), a: teamOf('away', A, {}), hHome: false },
  ];
  for (let i = 0; i < N; i++) {
    const p = perms[i % 2]!;
    const res = simulateMatch(setup(`rule-${i}`, p.h, p.a, over));
    gf += res.homeScore + res.awayScore; n++;
    ga += Math.abs(res.homeScore - res.awayScore);
  }
  console.log(`  ${(r ?? 'NO RULES').padEnd(16)} goals/match ${(gf / n).toFixed(2)}  mean margin ${(ga / n).toFixed(2)}`);
}

// --- 2. Rule cards: the human holds one, the AI never can. ----------------
console.log(`\nRule cards (only the player's club can ever hold one — matchSetup.ts:58).`);
console.log(`Held card played at the first legal moment vs an opponent with none:`);
const CARDS: SpecialRuleId[] = ['POWER_PLAY', 'LOCKDOWN', 'ALL_IN', 'CREATOR_MOMENT', 'CAPTAINS_CALL', 'LAST_STAND'];
const baseline = duelPoints({}, {}, N, A, B);
console.log(`  no card (control)      ${mean(baseline).toFixed(3)} ppg  ${win(baseline).toFixed(1)}% W`);
for (const card of CARDS) {
  // Replay the same duel but the home side holds and plays the card.
  const pts: number[] = [];
  const perms = [
    { h: teamOf('home', A, {}), a: teamOf('away', B, {}), hHome: true },
    { h: teamOf('home', B, {}), a: teamOf('away', A, {}), hHome: false },
  ];
  for (let i = 0; i < N; i++) {
    const p = perms[i % 2]!;
    const home = p.hHome ? { ...p.h, ruleCards: [card], isPlayerControlled: true } : p.h;
    const away = p.hHome ? p.a : { ...p.a, ruleCards: [card], isPlayerControlled: true };
    const s = setup(`card-${i}`, home as never, away as never, { enabledSpecialRules: [] });
    const res = simulateMatchWithCard(s, card, p.hHome ? 'home' : 'away');
    const f = p.hHome ? res.homeScore : res.awayScore, ag = p.hHome ? res.awayScore : res.homeScore;
    pts.push(f > ag ? 3 : f === ag ? 1 : 0);
  }
  const st = paired(pts, baseline);
  console.log(`  ${card.padEnd(22)} ${mean(pts).toFixed(3)} ppg  ${win(pts).toFixed(1)}% W  Δ${(st.diff >= 0 ? '+' : '') + st.diff.toFixed(3)} (z ${(st.diff / st.se).toFixed(2)})`);
}

import { MatchSimulator, type MatchSetup } from '@cf/engine';
function simulateMatchWithCard(s: MatchSetup, card: SpecialRuleId, side: 'home' | 'away') {
  const sim = new MatchSimulator(s);
  let played = false, guard = 0;
  while (!sim.isComplete && guard++ < 5000) {
    if (!played && sim.minute() >= 16) played = sim.playRuleCard(side, card) || played;
    sim.step();
  }
  return sim.finish();
}

// --- 3. Creators: what does creatorPresence actually buy? ------------------
console.log(`\nCreator presence in the match engine (creatorPresence 0 vs 1):`);
for (const presence of [0, 0.25, 0.5, 1]) {
  const pts: number[] = []; let moments = 0;
  const perms = [
    { h: { ...teamOf('home', A, {}), creatorPresence: presence }, a: teamOf('away', B, {}), hHome: true },
    { h: teamOf('home', B, {}), a: { ...teamOf('away', A, {}), creatorPresence: presence }, hHome: false },
  ];
  for (let i = 0; i < N; i++) {
    const p = perms[i % 2]!;
    const res = simulateMatch(setup(`cre-${i}`, p.h as never, p.a as never, { enabledSpecialRules: [] }));
    moments += res.events.filter((e) => e.type === 'CREATOR_MOMENT').length;
    const f = p.hHome ? res.homeScore : res.awayScore, ag = p.hHome ? res.awayScore : res.homeScore;
    pts.push(f > ag ? 3 : f === ag ? 1 : 0);
  }
  const st = paired(pts, baseline);
  console.log(`  presence ${String(presence).padEnd(6)} ${mean(pts).toFixed(3)} ppg  ${win(pts).toFixed(1)}% W  creator moments/match ${(moments / N).toFixed(2)}  Δ${(st.diff >= 0 ? '+' : '') + st.diff.toFixed(3)} (z ${(st.diff / (st.se || 1)).toFixed(2)})`);
}
