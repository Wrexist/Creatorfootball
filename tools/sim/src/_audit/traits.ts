import { simulateMatch, TRAITS, type Player } from '@cf/engine';
import { squadOf, teamOf, setup } from './tacticsLib';

const N = Number(globalThis.process?.env?.['N'] ?? 1200);
const BASE = squadOf('traitBase', 65);
const OPP = squadOf('traitOpp', 65);

/** Give every outfielder in the squad the trait (where positions allow). */
function withTrait(squad: Player[], traitId: string): Player[] {
  const def = TRAITS.find((t) => t.id === traitId)!;
  return squad.map((p) => {
    if (def.positions?.length && !def.positions.includes(p.position)) return p;
    return { ...p, traitIds: [...p.traitIds.filter((x) => x !== traitId), traitId] };
  });
}
function stripped(squad: Player[]): Player[] {
  return squad.map((p) => ({ ...p, traitIds: [] as string[] }));
}

const clean = stripped(BASE);
const cleanOpp = stripped(OPP);

function run(squad: Player[], importance = 3): { pts: number[]; gf: number; ga: number; xgf: number } {
  const pts: number[] = []; let gf = 0, ga = 0, xgf = 0;
  const perms = [
    { h: teamOf('home', squad, {}), a: teamOf('away', cleanOpp, {}), hHome: true },
    { h: teamOf('home', cleanOpp, {}), a: teamOf('away', squad, {}), hHome: false },
  ];
  for (let i = 0; i < N; i++) {
    const p = perms[i % 2]!;
    const r = simulateMatch(setup(`trait-${i}`, p.h, p.a, { importance, isDerby: importance >= 4 }));
    const f = p.hHome ? r.homeScore : r.awayScore, a = p.hHome ? r.awayScore : r.homeScore;
    gf += f; ga += a; xgf += p.hHome ? r.homeStats.xg : r.awayStats.xg;
    pts.push(f > a ? 3 : f === a ? 1 : 0);
  }
  return { pts, gf: gf / N, ga: ga / N, xgf: xgf / N };
}
const mean = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
function paired(x: number[], y: number[]) {
  const n = x.length; let s = 0;
  for (let i = 0; i < n; i++) s += x[i]! - y[i]!;
  const m = s / n; let v = 0;
  for (let i = 0; i < n; i++) v += ((x[i]! - y[i]!) - m) ** 2;
  return { d: m, se: Math.sqrt(v / (n - 1) / n) };
}

for (const importance of [3, 5]) {
  const base = run(clean, importance);
  console.log(`\n=== importance ${importance}${importance >= 4 ? ' (BIG_MATCH + DERBY conditions active)' : ''}, ${N} matches/cell ===`);
  console.log(`  ${'trait'.padEnd(20)} ${'ppg'.padStart(6)} ${'Δppg'.padStart(7)} ${'SE'.padStart(6)} ${'z'.padStart(6)} ${'ΔGF'.padStart(6)} ${'ΔGA'.padStart(6)} ${'ΔxG'.padStart(6)}`);
  console.log(`  ${'(no traits)'.padEnd(20)} ${mean(base.pts).toFixed(3).padStart(6)}`);
  for (const t of TRAITS) {
    const r = run(withTrait(clean, t.id), importance);
    const st = paired(r.pts, base.pts);
    const flag = Math.abs(st.d / (st.se || 1)) < 2 ? '   <- no measurable effect' : '';
    console.log(`  ${t.id.padEnd(20)} ${mean(r.pts).toFixed(3).padStart(6)} ${(st.d >= 0 ? '+' : '') + st.d.toFixed(3)} ${st.se.toFixed(3).padStart(6)} ${(st.d / (st.se || 1)).toFixed(2).padStart(6)} ${(r.gf - base.gf >= 0 ? '+' : '') + (r.gf - base.gf).toFixed(2)} ${(r.ga - base.ga >= 0 ? '+' : '') + (r.ga - base.ga).toFixed(2)} ${(r.xgf - base.xgf >= 0 ? '+' : '') + (r.xgf - base.xgf).toFixed(2)}${flag}`);
  }
}
