import { computeStandings, formatMoney, type GameState } from '@cf/engine';
import { startGame, playWeeks, registry, ledgerOf, CYCLE_MS, EPOCH } from '../harness';
import { advanceCycle, Ledger } from '@cf/engine';

const WEEKS = Number(globalThis.process?.env?.['WEEKS'] ?? 220);
let state = startGame('long-1');
const season = state.seasons[state.currentSeasonId]!;
console.log(`season totalWeeks=${season.totalWeeks}, clubs=${Object.keys(state.clubs).length}, fixtures=${Object.keys(state.fixtures).length}`);

const reg = registry();
const rows: string[] = [];
for (let i = 0; i < WEEKS; i++) {
  const r = advanceCycle(state, { now: EPOCH + i * CYCLE_MS, registry: reg, ledger: Ledger.restore(state.ledger) });
  state = r.state;
  if (i < 3 || i === 20 || i === 21 || i === 22 || i === 23 || i === 24 || i === 40 || i === 100 || i === 219) {
    rows.push(`week ${String(r.summary.week).padStart(3)} season ${r.summary.season} matches ${r.summary.matchesPlayed} `
      + `stories ${r.summary.storiesPublished} posts ${r.summary.postsPublished} complete=${r.summary.seasonComplete} `
      + `phase=${state.clock.phase}`);
  }
}
console.log(rows.join('\n'));

const comp = state.competitions[state.currentCompetitionId]!;
const table = computeStandings(comp.clubIds, Object.values(state.fixtures),
  { playoffSpots: comp.playoffSpots, relegationSpots: comp.relegationSpots });
console.log('\nFinal table after ' + WEEKS + ' cycles:');
for (const r of table) console.log(`  ${String(r.played).padStart(3)}p ${String(r.points).padStart(3)}pt  ${state.clubs[r.clubId]?.name}`);
const fx = Object.values(state.fixtures);
console.log(`\nfixtures: ${fx.length} total, ${fx.filter(f => f.status === 'SCHEDULED').length} still scheduled, ` +
  `${fx.filter(f => f.status === 'PLAYED').length} played`);
console.log(`clock: season ${state.clock.season} week ${state.clock.week} cycle ${state.clock.cycle}`);
console.log(`cash: ${formatMoney(ledgerOf(state).cashOf(state.playerClubId))}`);
console.log(`objectives active: ${state.objectives.active.length}, completed: ${state.objectives.completed?.length ?? 'n/a'}`);
