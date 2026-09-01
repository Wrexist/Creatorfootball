import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { MatchSimulator, simulateMatch } from './simulator';
import type { MatchResult } from './result';
import { makeTestSetup, makeTestTeam } from './testSupport';

/**
 * The balance suite.
 *
 * This is the file that decides whether the engine ships. It simulates 500
 * matches across varied squad qualities and asserts the output lands inside the
 * bands in `docs/SIMULATION_REFERENCE_DATA.md`, then measures the favourite /
 * underdog curve and the audience modifier separately. If a change to the model
 * moves any of those numbers out of band this fails loudly and prints the whole
 * table, so the cause is visible without instrumenting anything.
 *
 * The loops are synchronous and long, so they hand the event loop back
 * periodically; a worker that never yields cannot answer its own runner.
 */

const LONG = 240_000;

/** Let the runner breathe between batches of a long synchronous simulation. */
const breathe = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

interface Agg {
  goals: number[];
  teamGoals: number[];
  shots: number[];
  sot: number[];
  xg: number[];
  normalGoals: number[];
  normalMinutes: number[];
  windowGoals: number[];
  windowMinutes: number[];
  yellows: number[];
  reds: number[];
  injuries: number[];
  possession: number[];
  ballInPlay: number[];
  duration: number[];
  scoringEvents: number[];
  draws: number;
}

function accumulate(sim: MatchSimulator, r: MatchResult, agg: Agg): void {
  agg.goals.push(r.homeScore + r.awayScore);
  agg.teamGoals.push(r.homeScore, r.awayScore);
  agg.shots.push(r.homeStats.shots + r.awayStats.shots);
  agg.sot.push(r.homeStats.shotsOnTarget + r.awayStats.shotsOnTarget);
  agg.xg.push(r.homeStats.xg + r.awayStats.xg);
  agg.yellows.push(r.homeStats.yellowCards + r.awayStats.yellowCards);
  agg.reds.push(r.homeStats.redCards + r.awayStats.redCards);
  agg.injuries.push(r.injuries.length);
  agg.possession.push(r.homeStats.possession, r.awayStats.possession);
  agg.ballInPlay.push(sim.ballInPlayShare());
  agg.duration.push(r.durationMinutes);
  if (r.homeScore === r.awayScore) agg.draws += 1;

  let windowGoals = 0;
  let total = 0;
  for (const e of r.events) {
    if (e.type !== 'GOAL' && e.type !== 'PENALTY_SCORED') continue;
    const mult = Number(e.detail?.['multiplier'] ?? 1);
    total += mult;
    if (e.detail?.['window'] === true) windowGoals += mult;
  }
  let windowMinutes = 0;
  let openedAt: number | null = null;
  for (const e of r.events) {
    if (e.type === 'SPECIAL_RULE_START') openedAt = e.minute;
    else if (e.type === 'SPECIAL_RULE_END' && openedAt !== null) {
      windowMinutes += e.minute - openedAt;
      openedAt = null;
    }
  }
  if (openedAt !== null) windowMinutes += r.durationMinutes - openedAt;
  agg.scoringEvents.push(r.events.filter((e) => e.type === 'GOAL' || e.type === 'PENALTY_SCORED').length);
  agg.windowGoals.push(windowGoals);
  agg.windowMinutes.push(Math.max(0.1, windowMinutes));
  agg.normalGoals.push(total - windowGoals);
  agg.normalMinutes.push(Math.max(1, r.durationMinutes - windowMinutes));
}

const mean = (xs: readonly number[]): number => xs.reduce((a, b) => a + b, 0) / Math.max(1, xs.length);
const variance = (xs: readonly number[]): number => {
  const m = mean(xs);
  return mean(xs.map((x) => (x - m) ** 2));
};
const pct = (v: number): string => `${(v * 100).toFixed(1)}%`;

describe('aggregate realism over 500 matches', () => {
  it('lands inside the reference bands', async () => {
    const N = 500;
    const agg: Agg = {
      goals: [], teamGoals: [], shots: [], sot: [], xg: [], normalGoals: [], normalMinutes: [],
      windowGoals: [], windowMinutes: [], yellows: [], reds: [], injuries: [], possession: [],
      ballInPlay: [], duration: [], scoringEvents: [], draws: 0,
    };

    for (let i = 0; i < N; i++) {
      const rng = new Rng(`agg:${i}`);
      // Spread quality so the sample covers the whole league, not one pairing.
      const base = 48 + (i % 8) * 4;
      const setup = makeTestSetup({
        seed: `agg:${i}`,
        home: makeTestTeam(rng, { prefix: `ah${i}`, name: 'Northside', target: base + rng.normal(0, 4), creatorPresence: 0.3 }),
        away: makeTestTeam(rng, { prefix: `aa${i}`, name: 'Southgate', target: base + rng.normal(0, 4), creatorPresence: 0.3 }),
        rivalryIntensity: (i % 5) * 20,
        importance: 1 + (i % 5),
      });
      const sim = new MatchSimulator(setup);
      const r = sim.finish();
      accumulate(sim, r, agg);
      if (i % 25 === 24) await breathe();
    }

    const goals = mean(agg.goals);
    const duration = mean(agg.duration);
    const shots = mean(agg.shots);
    const conversion = goals / shots;
    const normalRate = mean(agg.normalGoals) / mean(agg.normalMinutes);
    const windowRate = mean(agg.windowGoals) / mean(agg.windowMinutes);
    const dispersion = variance(agg.teamGoals) / mean(agg.teamGoals);

    const rows: [string, string, string][] = [
      ['goals per match', goals.toFixed(2), '6.0 - 9.0'],
      ['goals per minute', (goals / duration).toFixed(3), '0.20 - 0.30'],
      ['normal-play goals/min', normalRate.toFixed(3), '0.14 - 0.20'],
      ['rule-window goals/min', windowRate.toFixed(3), 'x2 - x4 of normal'],
      ['window multiple', (windowRate / normalRate).toFixed(2), '2.0 - 4.5'],
      ['shots per match', shots.toFixed(1), '30 - 38'],
      ['shots per team', (shots / 2).toFixed(1), '15 - 19'],
      ['shots on target share', pct(mean(agg.sot) / shots), '40 - 65%'],
      ['conversion (scoreboard)', pct(conversion), '18 - 28%'],
      ['conversion (scoring events)', pct(mean(agg.scoringEvents) / shots), '14 - 22%'],
      ['xG per match', mean(agg.xg).toFixed(2), '-'],
      ['xG per shot', (mean(agg.xg) / shots).toFixed(3), '-'],
      ['yellow cards per match', mean(agg.yellows).toFixed(2), '0.5 - 2.0'],
      ['red cards per match', mean(agg.reds).toFixed(3), '0.01 - 0.06'],
      ['injuries per team per match', (mean(agg.injuries) / 2).toFixed(3), '0.08 - 0.14'],
      ['possession min / max', `${Math.min(...agg.possession).toFixed(1)} / ${Math.max(...agg.possession).toFixed(1)}`, '35 - 65%'],
      ['ball in play', pct(mean(agg.ballInPlay)), '86 - 94%'],
      ['match duration', duration.toFixed(1), '30 - 34'],
      ['team-goal variance / mean', dispersion.toFixed(2), '> 1 (overdispersed)'],
      ['draw rate', pct(agg.draws / N), '< 24.5%'],
    ];

    const width = Math.max(...rows.map((r) => r[0].length));
    const lines = [
      '',
      `MATCH ENGINE AGGREGATE — ${N} matches, 30-minute short format`,
      '-'.repeat(width + 30),
      ...rows.map(([k, v, band]) => `${k.padEnd(width)}  ${v.padStart(9)}   ${band}`),
      '-'.repeat(width + 30),
      '',
    ];
     
    console.log(lines.join('\n'));

    expect(goals).toBeGreaterThanOrEqual(6.0);
    expect(goals).toBeLessThanOrEqual(9.0);
    expect(goals / duration).toBeGreaterThanOrEqual(0.2);
    expect(goals / duration).toBeLessThanOrEqual(0.3);

    // The two scoring regimes are validated separately, because a blended
    // number can hide a badly tuned rule window entirely.
    expect(normalRate).toBeGreaterThanOrEqual(0.14);
    expect(normalRate).toBeLessThanOrEqual(0.2);
    expect(windowRate / normalRate).toBeGreaterThanOrEqual(2.0);
    expect(windowRate / normalRate).toBeLessThanOrEqual(4.5);

    // Shots are the derived quantity: the goal rate is the measured one, so the
    // shot band is whatever that goal rate implies at an honest conversion.
    expect(shots).toBeGreaterThanOrEqual(30);
    expect(shots).toBeLessThanOrEqual(38);
    expect(shots / 2).toBeGreaterThanOrEqual(15);
    expect(shots / 2).toBeLessThanOrEqual(19);
    expect(conversion).toBeGreaterThanOrEqual(0.18);
    expect(conversion).toBeLessThanOrEqual(0.28);
    // Before the rule windows' scoring multipliers are applied.
    const rawConversion = mean(agg.scoringEvents) / shots;
    expect(rawConversion).toBeGreaterThanOrEqual(0.14);
    expect(rawConversion).toBeLessThanOrEqual(0.22);

    expect(mean(agg.yellows)).toBeGreaterThanOrEqual(0.5);
    expect(mean(agg.yellows)).toBeLessThanOrEqual(2.0);
    expect(mean(agg.reds)).toBeGreaterThanOrEqual(0.01);
    expect(mean(agg.reds)).toBeLessThanOrEqual(0.06);
    expect(mean(agg.injuries) / 2).toBeGreaterThanOrEqual(0.08);
    expect(mean(agg.injuries) / 2).toBeLessThanOrEqual(0.14);

    expect(Math.min(...agg.possession)).toBeGreaterThanOrEqual(35);
    expect(Math.max(...agg.possession)).toBeLessThanOrEqual(65);
    expect(mean(agg.ballInPlay)).toBeGreaterThanOrEqual(0.86);
    expect(mean(agg.ballInPlay)).toBeLessThanOrEqual(0.94);

    // Negative-binomial shape: real leagues are overdispersed, Poisson is not.
    expect(dispersion).toBeGreaterThan(1);
    // High lambda thins draws out relative to eleven-a-side's 24.5%.
    expect(agg.draws / N).toBeLessThan(0.245);
  }, LONG);
});

// --------------------------------------------------------------------------

async function winRate(seedPrefix: string, edge: number, n: number): Promise<{ win: number; draw: number; loss: number }> {
  let w = 0, d = 0, l = 0;
  for (let i = 0; i < n; i++) {
    if (i % 25 === 24) await breathe();
    const rng = new Rng(`${seedPrefix}:${i}`);
    const setup = makeTestSetup({
      seed: `${seedPrefix}:${i}`,
      home: makeTestTeam(rng, { prefix: `fh${i}`, name: 'Favourite', target: 65 + edge / 2 }),
      away: makeTestTeam(rng, { prefix: `fa${i}`, name: 'Underdog', target: 65 - edge / 2 }),
    });
    const r = simulateMatch(setup);
    if (r.homeScore > r.awayScore) w += 1;
    else if (r.homeScore === r.awayScore) d += 1;
    else l += 1;
  }
  return { win: w / n, draw: d / n, loss: l / n };
}

describe('favourite versus underdog', () => {
  it('gives a fifteen-point edge roughly 60-70% of wins, and still allows upsets', async () => {
    const r = await winRate('edge15', 15, 400);
     
    console.log(`\n15-point edge: W ${pct(r.win)}  D ${pct(r.draw)}  L ${pct(r.loss)}\n`);
    expect(r.win).toBeGreaterThanOrEqual(0.6);
    expect(r.win).toBeLessThanOrEqual(0.7);
    expect(r.loss).toBeGreaterThan(0.1);
  }, LONG);

  it('keeps a heavy mismatch inside 75-85% and never above 90%', async () => {
    const r = await winRate('edge25', 25, 400);
     
    console.log(`25-point edge: W ${pct(r.win)}  D ${pct(r.draw)}  L ${pct(r.loss)}\n`);
    expect(r.win).toBeGreaterThanOrEqual(0.75);
    expect(r.win).toBeLessThanOrEqual(0.85);
    expect(r.win).toBeLessThan(0.9);
  }, LONG);

  // The sample is deliberately large. At n=400 the standard error on the
  // win-minus-loss gap is about 4.4 points, so a 9-point threshold sat inside
  // two sigma of the null and the assertion passed or failed on sampling luck
  // rather than on engine behaviour. At n=1200 the same threshold is a real
  // statement. (Measured directly at n=3000: gap 1.4 points, z = 0.8.)
  it('is even when the squads are even', async () => {
    const r = await winRate('edge0', 0, 1200);
    expect(Math.abs(r.win - r.loss)).toBeLessThan(0.09);
  }, LONG);
});

// --------------------------------------------------------------------------

describe('side symmetry', () => {
  it('gives neither end of the pitch an advantage when the squads are identical', async () => {
    // Same reasoning as the even-squads case above: 600 matches put the
    // six-point threshold under two standard errors, which made a correct
    // assertion flaky. 2000 makes it a three-and-a-half sigma statement.
    const N = 2000;
    let home = 0;
    let away = 0;
    for (let i = 0; i < N; i++) {
      const rng = new Rng(`mirror:${i}`);
      const squad = makeTestTeam(rng, { prefix: `m${i}`, name: 'Northside', target: 65 });
      const r = simulateMatch(makeTestSetup({
        seed: `mirror:${i}`,
        home: squad,
        away: { ...squad, name: 'Southgate', shortName: 'Southgate' },
        config: { maxDecisions: 0 },
      }));
      if (r.homeScore > r.awayScore) home += 1;
      else if (r.awayScore > r.homeScore) away += 1;
      if (i % 25 === 24) await breathe();
    }
    // Same players at both ends: any consistent gap would be an engine bias.
    expect(Math.abs(home - away) / N).toBeLessThan(0.06);
  }, LONG);
});

describe('home advantage and support', () => {
  it('is exactly zero by default, because the competition uses one neutral venue', () => {
    const rng = new Rng('neutral');
    const setup = makeTestSetup({
      seed: 'neutral',
      home: makeTestTeam(rng, { prefix: 'nh', name: 'Northside', target: 64 }),
      away: makeTestTeam(rng, { prefix: 'na', name: 'Southgate', target: 64 }),
    });
    expect(setup.homeAdvantage).toBe(0);
    expect(setup.neutralVenue).toBe(true);
  });

  it('keeps the audience modifier under a six-point swing at full support', async () => {
    // Same seeds either side so the only difference is the support term itself.
    const supported = await winRateWithSupport('support', 1);
    const neutral = await winRateWithSupport('support', 0);
    const swing = Math.abs(supported - neutral);
     
    console.log(`support swing: ${pct(swing)} (cap 6 points)\n`);
    expect(swing).toBeLessThanOrEqual(0.06);
  }, LONG);
});

async function winRateWithSupport(seedPrefix: string, support: number): Promise<number> {
  let w = 0;
  const n = 400;
  for (let i = 0; i < n; i++) {
    if (i % 25 === 24) await breathe();
    const rng = new Rng(`${seedPrefix}:${i}`);
    const setup = makeTestSetup({
      seed: `${seedPrefix}:${i}`,
      home: makeTestTeam(rng, { prefix: `sh${i}`, name: 'Northside', target: 65 }),
      away: makeTestTeam(rng, { prefix: `sa${i}`, name: 'Southgate', target: 65 }),
      homeAdvantage: support,
      attendance: 20000,
      neutralVenue: false,
    });
    const r = simulateMatch(setup);
    if (r.homeScore > r.awayScore) w += 1;
    else if (r.homeScore === r.awayScore) w += 0.5;
  }
  return w / n;
}

// --------------------------------------------------------------------------

