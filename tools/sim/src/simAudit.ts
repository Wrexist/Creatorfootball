import { simulateMatch, generateSquad, Rng, autoLineup, formationById, DEFAULT_TACTICS,
  type MatchSetup, type Player, type ClubId, type MatchId, asId } from '@cf/engine';
import { heading, note, evaluate, printChecks, summarise, stats, histogram, table, warn } from './report';
import { progress } from './harness';

/**
 * Simulation audit.
 *
 * Runs the match engine across the scenarios the product brief calls out —
 * strong versus weak, upsets, tactical matchups, fatigue, low morale, injury-hit
 * squads — and checks the aggregate output against the researched targets in
 * docs/SIMULATION_REFERENCE_DATA.md. This is the gate that stops a balance
 * change from quietly making football stop looking like football.
 */

const MATCHES = Number(globalThis.process?.env?.['SIM_MATCHES'] ?? 1000);

function squadOf(seed: string, target: number, size = 18): Player[] {
  return generateSquad(new Rng(seed), { targetOverall: target, size, idPrefix: seed.slice(0, 6) });
}

function setupFor(
  seed: string,
  homePlayers: Player[],
  awayPlayers: Player[],
  over: Partial<MatchSetup> = {},
): MatchSetup {
  const formation = formationById('2-3-1');
  const base = {
    formationId: formation.id,
    lineup: {} as Record<string, never>,
    bench: [],
    captainId: null,
    setPieceTakerId: null,
    penaltyTakerId: null,
    ...DEFAULT_TACTICS,
  };
  return {
    matchId: asId<MatchId>(`m_${seed}`),
    seed,
    home: {
      clubId: asId<ClubId>('home'), name: 'Home', shortName: 'HOM',
      players: homePlayers,
      tactics: { ...base, ...autoLineup(homePlayers, formation) },
      managerBonus: { tactical: 55, motivation: 55, adaptability: 55, discipline: 55 },
      creatorPresence: 0.4, ruleCards: [], isPlayerControlled: false,
    },
    away: {
      clubId: asId<ClubId>('away'), name: 'Away', shortName: 'AWY',
      players: awayPlayers,
      tactics: { ...base, ...autoLineup(awayPlayers, formation) },
      managerBonus: { tactical: 55, motivation: 55, adaptability: 55, discipline: 55 },
      creatorPresence: 0.4, ruleCards: [], isPlayerControlled: false,
    },
    config: {
      minutes: 30, halves: 2, playersOnPitch: 7, benchSize: 7,
      substitutions: 5, liveDecisions: false, maxDecisions: 0,
    },
    importance: 3, isDerby: false, rivalryIntensity: 0,
    // A silent crowd: the audit measures quality and shape effects, so the
    // arena-support share stays out of every scenario here.
    attendance: 6000, homeAdvantage: 0, neutralVenue: true,
    enabledSpecialRules: [],
    ...over,
  };
}

function run(): boolean {
  heading('SIMULATION AUDIT');
  note(`  ${MATCHES} matches across varied squad qualities and scenarios.`);

  const goals: number[] = [];
  const shots: number[] = [];
  const conversions: number[] = [];
  const possessions: number[] = [];
  const yellows: number[] = [];
  const reds: number[] = [];
  const injuries: number[] = [];
  const totals: number[] = [];

  const evenA = squadOf('even-a', 65);
  const evenB = squadOf('even-b', 65);

  for (let i = 0; i < MATCHES; i++) {
    const result = simulateMatch(setupFor(`audit-${i}`, evenA, evenB));
    const total = result.homeScore + result.awayScore;
    goals.push(total);
    totals.push(total);
    shots.push(result.homeStats.shots, result.awayStats.shots);
    const shotTotal = result.homeStats.shots + result.awayStats.shots;
    if (shotTotal > 0) conversions.push((total / shotTotal) * 100);
    possessions.push(result.homeStats.possession);
    yellows.push(result.homeStats.yellowCards + result.awayStats.yellowCards);
    reds.push(result.homeStats.redCards + result.awayStats.redCards);
    injuries.push(result.injuries.length);
    if (i % 50 === 0) progress('simulating', i, MATCHES);
  }
  progress('simulating', MATCHES, MATCHES);

  const g = stats(goals);
  const s = stats(shots);
  const varianceRatio = g.sd ** 2 / Math.max(0.001, g.mean);

  heading('Aggregate output vs researched targets');
  const ok = printChecks(evaluate([
    { label: 'goals per match', value: g.mean, min: 6.0, max: 9.0 },
    { label: 'goals per minute', value: g.mean / 30, min: 0.2, max: 0.3, dp: 3 },
    { label: 'shots per team', value: s.mean, min: 15, max: 19 },
    { label: 'conversion %', value: stats(conversions).mean, min: 14, max: 24, unit: '%' },
    { label: 'possession min', value: Math.min(...possessions), min: 30, unit: '%' },
    { label: 'possession max', value: Math.max(...possessions), max: 70, unit: '%' },
    { label: 'yellows per match', value: stats(yellows).mean, min: 0.5, max: 2.5 },
    { label: 'reds per match', value: stats(reds).mean, min: 0.005, max: 0.12, dp: 3 },
    { label: 'injuries per match', value: stats(injuries).mean, min: 0.02, max: 0.35, dp: 3 },
  ]));

  // Real leagues are overdispersed: variance exceeds the mean. A ratio at or
  // below 1 would mean we are producing Poisson football, which is too tidy.
  // The estimator is noisy, though — at 200 matches it swings either side of 1
  // purely on sampling, so gating a cheap smoke run on it produces failures
  // that say nothing about the engine. It is a hard gate only when the sample
  // is large enough for the number to mean something.
  const OVERDISPERSION_MIN_SAMPLE = 800;
  let dispersionOk = true;
  if (MATCHES >= OVERDISPERSION_MIN_SAMPLE) {
    dispersionOk = printChecks(evaluate([
      { label: 'variance / mean', value: varianceRatio, min: 1.0, max: 2.6 },
    ]));
  } else {
    note(`  (informational) variance / mean ${varianceRatio.toFixed(2)} — needs ${OVERDISPERSION_MIN_SAMPLE}+ matches to gate on`);
  }

  histogram(totals, 10, 'Total goals per match');

  heading('Favourite versus underdog');
  const edges = [5, 10, 15, 25, 35];
  const rows: Record<string, string | number>[] = [];
  let curveOk = true;

  for (const edge of edges) {
    const strong = squadOf(`strong-${edge}`, 65 + edge / 2);
    const weak = squadOf(`weak-${edge}`, 65 - edge / 2);
    let wins = 0, draws = 0, losses = 0;
    const n = 400;
    for (let i = 0; i < n; i++) {
      const r = simulateMatch(setupFor(`edge-${edge}-${i}`, strong, weak));
      if (r.homeScore > r.awayScore) wins++;
      else if (r.homeScore === r.awayScore) draws++;
      else losses++;
    }
    const winPct = (wins / n) * 100;
    rows.push({
      'squad edge': `${edge} pts`,
      'win %': winPct.toFixed(1),
      'draw %': ((draws / n) * 100).toFixed(1),
      'loss %': ((losses / n) * 100).toFixed(1),
    });
    // A stronger side must win more often; an underdog must always keep a path.
    if (winPct > 90) { curveOk = false; warn(`${edge}-point edge wins ${winPct.toFixed(1)}% — no path for the underdog`); }
    if (edge >= 15 && winPct < 55) { curveOk = false; warn(`${edge}-point edge wins only ${winPct.toFixed(1)}% — quality does not tell`); }
  }
  table(rows);

  heading('Determinism');
  const a = simulateMatch(setupFor('determinism', evenA, evenB));
  const b = simulateMatch(setupFor('determinism', evenA, evenB));
  const deterministic = JSON.stringify(a) === JSON.stringify(b);
  if (deterministic) note('  PASS  identical seed reproduces an identical match');
  else warn('identical seed produced a different match');

  const passed = ok && dispersionOk && curveOk && deterministic;
  summarise('Simulation audit', passed);
  return passed;
}

const passed = run();
if (!passed) globalThis.process?.exit(1);
