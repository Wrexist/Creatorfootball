import { computeStandings, formatMoney } from '@cf/engine';
import { playSeason, ledgerOf } from '../harness';

const SEEDS = Number(globalThis.process?.env?.['SEEDS'] ?? 20);
const finishes = new Map<string, number[]>();
const champions = new Map<string, number>();
let playerPos: number[] = [];
const cash: number[] = [];
const meanOvr: number[] = [];

for (let i = 0; i < SEEDS; i++) {
  const { state } = playSeason(`league-${i}`);
  const comp = state.competitions[state.currentCompetitionId]!;
  const table = computeStandings(comp.clubIds, Object.values(state.fixtures),
    { playoffSpots: comp.playoffSpots, relegationSpots: comp.relegationSpots });
  table.forEach((r, idx) => {
    const name = state.clubs[r.clubId]?.name ?? String(r.clubId);
    if (!finishes.has(name)) finishes.set(name, []);
    finishes.get(name)!.push(idx + 1);
    if (idx === 0) champions.set(name, (champions.get(name) ?? 0) + 1);
    if (r.clubId === state.playerClubId) playerPos.push(idx + 1);
  });
  cash.push(ledgerOf(state).cashOf(state.playerClubId));
  const ps = Object.values(state.players).filter((p) => p.clubId);
  meanOvr.push(ps.reduce((a, p) => a + p.overall, 0) / ps.length);
}

console.log(`${SEEDS} independent seasons (same starting universe, different seeds).\n`);
console.log('club                     mean finish   best  worst  titles');
const rows = [...finishes.entries()].sort((a, b) =>
  a[1].reduce((x, y) => x + y) / a[1].length - b[1].reduce((x, y) => x + y) / b[1].length);
for (const [name, ps] of rows) {
  const mean = ps.reduce((a, b) => a + b) / ps.length;
  console.log(`  ${name.padEnd(24)} ${mean.toFixed(2).padStart(5)}      ${Math.min(...ps)}     ${Math.max(...ps)}     ${champions.get(name) ?? 0}`);
}
const m = (x: number[]) => x.reduce((a, b) => a + b, 0) / x.length;
console.log(`\nplayer club finish: mean ${m(playerPos).toFixed(2)}, range ${Math.min(...playerPos)}-${Math.max(...playerPos)}`);
console.log(`player cash at season end: mean ${formatMoney(m(cash))}, min ${formatMoney(Math.min(...cash))}, max ${formatMoney(Math.max(...cash))}`);
console.log(`league mean player overall at season end: ${m(meanOvr).toFixed(2)}`);
