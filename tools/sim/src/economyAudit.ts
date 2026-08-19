import { formatMoney, auditEconomy, type GameState } from '@cf/engine';
import { heading, note, evaluate, printChecks, summarise, stats, table, warn, fail, pass } from './report';
import { playSeason, playWeeks, ledgerOf, progress, startGame } from './harness';

/**
 * Economy audit.
 *
 * Plays many full seasons headless and checks the things that quietly ruin a
 * management game months after launch: runaway inflation, wealth concentrating
 * in one club, wages outrunning income, transfer fees spiralling, and rewards
 * being claimable twice. The brief asks for a hundred seasons; that is the
 * default here and it is configurable so CI can run a cheaper sweep.
 */

const SEASONS = Number(globalThis.process?.env?.['ECON_SEASONS'] ?? 100);
const MULTI_SEASON_DEPTH = Number(globalThis.process?.env?.['ECON_DEPTH'] ?? 5);

interface SeasonSnapshot {
  readonly seed: string;
  readonly totalCash: number;
  readonly richest: number;
  readonly poorest: number;
  readonly meanWage: number;
  readonly meanValue: number;
  readonly insolvent: number;
  readonly violations: readonly string[];
}

function snapshot(state: GameState, seed: string): SeasonSnapshot {
  const ledger = ledgerOf(state);
  const balances = Object.values(state.clubs).map((c) => ledger.cashOf(c.id));
  const wages = Object.values(state.contracts).map((c) => c.wage);
  const values = Object.values(state.players).map((p) => p.marketValue);

  return {
    seed,
    totalCash: balances.reduce((a, b) => a + b, 0),
    richest: Math.max(...balances),
    poorest: Math.min(...balances),
    meanWage: stats(wages).mean,
    meanValue: stats(values).mean,
    insolvent: balances.filter((b) => b < 0).length,
    violations: [...ledger.verify(), ...auditEconomy(state, ledger).map((v) => v.code)],
  };
}

function run(): boolean {
  heading('ECONOMY AUDIT');
  note(`  ${SEASONS} independent seasons, plus a ${MULTI_SEASON_DEPTH}-season continuous run.`);

  const snapshots: SeasonSnapshot[] = [];
  const allViolations = new Map<string, number>();

  for (let i = 0; i < SEASONS; i++) {
    const seed = `econ-${i}`;
    const { state } = playSeason(seed);
    const snap = snapshot(state, seed);
    snapshots.push(snap);
    for (const v of snap.violations) allViolations.set(v, (allViolations.get(v) ?? 0) + 1);
    if (i % 5 === 0) progress('seasons', i, SEASONS);
  }
  progress('seasons', SEASONS, SEASONS);

  // --- integrity --------------------------------------------------------
  heading('Ledger integrity');
  // Distress is a legitimate game state and must not fail the audit. Corruption
  // is never legitimate — these four codes mean the ledger no longer describes
  // reality, and any single occurrence is a defect.
  const CORRUPTION = ['DOUBLE_CLAIMED', 'WAGE_MISMATCH', 'DUPLICATE_OWNERSHIP', 'NON_FINITE', 'NEGATIVE_AMOUNT'];
  let integrityOk = true;
  for (const code of CORRUPTION) {
    const count = allViolations.get(code) ?? 0;
    if (count > 0) { fail(`${code} occurred in ${count} of ${SEASONS} seasons`); integrityOk = false; }
    else pass(`${code} never occurred`);
  }
  for (const [code, count] of allViolations) {
    if (!CORRUPTION.includes(code)) note(`  (informational) ${code} in ${count}/${SEASONS} seasons`);
  }

  // --- distribution -----------------------------------------------------
  const totals = snapshots.map((s) => s.totalCash);
  const richest = snapshots.map((s) => s.richest);
  const wages = snapshots.map((s) => s.meanWage);
  const values = snapshots.map((s) => s.meanValue);

  heading('League-wide position after one season');
  table([
    { metric: 'total cash', mean: formatMoney(stats(totals).mean), p05: formatMoney(stats(totals).p05), p95: formatMoney(stats(totals).p95) },
    { metric: 'richest club', mean: formatMoney(stats(richest).mean), p05: formatMoney(stats(richest).p05), p95: formatMoney(stats(richest).p95) },
    { metric: 'mean wage', mean: formatMoney(stats(wages).mean), p05: formatMoney(stats(wages).p05), p95: formatMoney(stats(wages).p95) },
    { metric: 'mean value', mean: formatMoney(stats(values).mean), p05: formatMoney(stats(values).p05), p95: formatMoney(stats(values).p95) },
  ]);

  // --- multi-season drift ----------------------------------------------
  heading(`Inflation across ${MULTI_SEASON_DEPTH} continuous seasons`);
  let state = startGame('econ-long');
  const perSeason: Record<string, string | number>[] = [];
  const wageTrack: number[] = [];
  const valueTrack: number[] = [];

  for (let season = 1; season <= MULTI_SEASON_DEPTH; season++) {
    const totalWeeks = state.seasons[state.currentSeasonId]?.totalWeeks ?? 22;
    state = playWeeks(state, totalWeeks, (season - 1) * totalWeeks).state;
    const snap = snapshot(state, `long-s${season}`);
    wageTrack.push(snap.meanWage);
    valueTrack.push(snap.meanValue);
    perSeason.push({
      season,
      'total cash': formatMoney(snap.totalCash),
      'mean wage': formatMoney(snap.meanWage),
      'mean value': formatMoney(snap.meanValue),
      insolvent: snap.insolvent,
    });
    progress('long run', season, MULTI_SEASON_DEPTH);
  }
  table(perSeason);

  const wageGrowth = wageTrack.length > 1 && (wageTrack[0] as number) > 0
    ? (wageTrack.at(-1) as number) / (wageTrack[0] as number)
    : 1;
  const valueGrowth = valueTrack.length > 1 && (valueTrack[0] as number) > 0
    ? (valueTrack.at(-1) as number) / (valueTrack[0] as number)
    : 1;

  heading('Brakes on runaway progression');
  const brakesOk = printChecks(evaluate([
    // Some growth is correct — clubs get richer and better. Compounding growth
    // is not: it is how a management economy becomes meaningless by season ten.
    { label: `wage growth over ${MULTI_SEASON_DEPTH} seasons`, value: wageGrowth, min: 0.6, max: 2.5, unit: 'x' },
    { label: `value growth over ${MULTI_SEASON_DEPTH} seasons`, value: valueGrowth, min: 0.6, max: 2.5, unit: 'x' },
    { label: 'seasons with an insolvent club', value: snapshots.filter((s) => s.insolvent > 0).length / SEASONS * 100, max: 40, unit: '%' },
  ]));

  // A single club hoovering up every pound is the classic failure mode.
  const concentration = stats(snapshots.map((s) => (s.richest > 0 ? s.richest / Math.max(1, s.totalCash) : 0))).mean * 100;
  const concentrationOk = concentration < 55;
  if (concentrationOk) pass(`richest club holds ${concentration.toFixed(1)}% of league cash`);
  else warn(`richest club holds ${concentration.toFixed(1)}% of league cash — wealth is concentrating`);

  const passed = integrityOk && brakesOk && concentrationOk;
  summarise('Economy audit', passed);
  return passed;
}

const passed = run();
if (!passed) globalThis.process?.exit(1);
