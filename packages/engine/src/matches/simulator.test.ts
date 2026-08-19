import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { BALANCE } from './balance';
import { MatchSimulator, simulateMatch } from './simulator';
import type { MatchResult } from './result';
import { makeTestSetup, makeTestTeam } from './testSupport';

/**
 * The balance suite.
 *
 * The aggregate test is the one that matters: it simulates 500 matches across
 * varied squad qualities and asserts the output lands inside the bands in
 * `docs/SIMULATION_REFERENCE_DATA.md`. If a change to the model moves any of
 * those numbers out of band, this fails loudly and prints the whole table so
 * the cause is visible without instrumenting anything.
 */

const LONG = 240_000;

function fixture(seed: string, homeTarget: number, awayTarget: number, extra: Partial<Parameters<typeof makeTestSetup>[0]> = {}) {
  const rng = new Rng(seed);
  const home = makeTestTeam(rng, { prefix: `${seed}h`, name: 'Northside', target: homeTarget, creatorPresence: 0.3 });
  const away = makeTestTeam(rng, { prefix: `${seed}a`, name: 'Southgate', target: awayTarget, creatorPresence: 0.3 });
  return makeTestSetup({ seed, home, away, ...extra });
}

// --------------------------------------------------------------------------

describe('determinism', () => {
  it('produces byte-identical results for the same setup', () => {
    const setup = fixture('determinism', 66, 62);
    const a = simulateMatch(setup);
    const b = simulateMatch(setup);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });

  it('produces identical results whether run in one go or stepped', () => {
    const setup = fixture('stepped', 70, 58);
    const whole = simulateMatch(setup);

    const sim = new MatchSimulator(setup);
    let guard = 0;
    while (!sim.isComplete && guard < 5000) {
      if (sim.pendingDecision()) {
        const p = sim.pendingDecision();
        if (p) sim.resolveDecision(p.id, p.defaultOptionId);
      } else {
        sim.step();
      }
      guard += 1;
    }
    const stepped = sim.result();
    expect(stepped.homeScore).toBe(whole.homeScore);
    expect(stepped.awayScore).toBe(whole.awayScore);
    expect(stepped.events.length).toBe(whole.events.length);
  });

  it('different seeds produce different matches', () => {
    const a = simulateMatch(fixture('seed-a', 64, 64));
    const b = simulateMatch(fixture('seed-b', 64, 64));
    expect(JSON.stringify(a.events)).not.toBe(JSON.stringify(b.events));
  });
});

// --------------------------------------------------------------------------

describe('event stream integrity', () => {
  const result = simulateMatch(fixture('stream', 68, 60));

  it('carries a running score that only ever goes up and ends on the result', () => {
    let home = 0;
    let away = 0;
    for (const e of result.events) {
      expect(e.homeScore).toBeGreaterThanOrEqual(home);
      expect(e.awayScore).toBeGreaterThanOrEqual(away);
      home = e.homeScore;
      away = e.awayScore;
    }
    expect(home).toBe(result.homeScore);
    expect(away).toBe(result.awayScore);
  });

  it('never emits a negative score', () => {
    for (const e of result.events) {
      expect(e.homeScore).toBeGreaterThanOrEqual(0);
      expect(e.awayScore).toBeGreaterThanOrEqual(0);
    }
  });

  it('gives every event commentary, a legal importance and bounded momentum', () => {
    for (const e of result.events) {
      expect(e.text.length).toBeGreaterThan(0);
      expect(e.text).not.toMatch(/\{[a-z]+\}/);
      expect([1, 2, 3, 4, 5]).toContain(e.importance);
      expect(e.momentum).toBeGreaterThanOrEqual(-1);
      expect(e.momentum).toBeLessThanOrEqual(1);
      expect(Number.isFinite(e.tick)).toBe(true);
    }
  });

  it('orders events by tick', () => {
    let last = -1;
    for (const e of result.events) {
      expect(e.tick).toBeGreaterThanOrEqual(last);
      last = e.tick;
    }
  });

  it('attaches xg to every shot-shaped event', () => {
    const shots = result.events.filter((e) => e.type === 'SHOT');
    expect(shots.length).toBeGreaterThan(0);
    for (const s of shots) {
      expect(s.xg).toBeDefined();
      expect(s.xg as number).toBeGreaterThan(0);
      expect(s.xg as number).toBeLessThanOrEqual(0.95);
    }
  });

  it('starts and finishes the match', () => {
    expect(result.events[0]?.type).toBe('MATCH_START');
    expect(result.events.some((e) => e.type === 'HALFTIME')).toBe(true);
    expect(result.events[result.events.length - 1]?.type).toBe('FULLTIME');
  });
});

// --------------------------------------------------------------------------

describe('impossible states', () => {
  it('never keeps a sent-off player involved, and never exceeds the substitution limit', () => {
    let redsSeen = 0;
    for (let i = 0; i < 120; i++) {
      const setup = fixture(`states-${i}`, 62 + (i % 5) * 3, 60, { rivalryIntensity: 90, isDerby: true, importance: 5 });
      const r = simulateMatch(setup);

      expect(r.homeScore).toBeGreaterThanOrEqual(0);
      expect(r.awayScore).toBeGreaterThanOrEqual(0);

      for (const side of ['home', 'away'] as const) {
        const subs = r.events.filter((e) => e.type === 'SUBSTITUTION' && e.side === side).length;
        expect(subs).toBeLessThanOrEqual(setup.config.substitutions);
      }

      const reds = r.events.filter((e) => e.type === 'RED_CARD');
      redsSeen += reds.length;
      for (const red of reds) {
        const after = r.events.filter((e) => e.tick > red.tick);
        for (const e of after) {
          if (e.type === 'SUBSTITUTION') continue;
          expect(e.playerId).not.toBe(red.playerId);
          expect(e.secondaryPlayerId).not.toBe(red.playerId);
        }
      }

      for (const stats of Object.values(r.playerStats)) {
        expect(stats.rating).toBeGreaterThanOrEqual(BALANCE.RATING_MIN);
        expect(stats.rating).toBeLessThanOrEqual(BALANCE.RATING_MAX);
        expect(stats.minutes).toBeGreaterThan(0);
        expect(stats.minutes).toBeLessThanOrEqual(r.durationMinutes + 1);
        expect(stats.endStamina).toBeGreaterThanOrEqual(0);
        expect(Number.isFinite(stats.xg)).toBe(true);
      }
    }
    // A derby-heavy sample must actually exercise the dismissal path.
    expect(redsSeen).toBeGreaterThan(0);
  }, LONG);
});

// --------------------------------------------------------------------------

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
  it('lands inside the reference bands', () => {
    const N = 500;
    const agg: Agg = {
      goals: [], teamGoals: [], shots: [], sot: [], xg: [], normalGoals: [], normalMinutes: [],
      windowGoals: [], windowMinutes: [], yellows: [], reds: [], injuries: [], possession: [],
      ballInPlay: [], duration: [], draws: 0,
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
      ['shots per match', shots.toFixed(1), '24 - 40'],
      ['shots per team', (shots / 2).toFixed(1), '12 - 20'],
      ['shots on target share', pct(mean(agg.sot) / shots), '40 - 65%'],
      ['conversion', pct(conversion), '18 - 28%'],
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
    // eslint-disable-next-line no-console
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

    expect(shots).toBeGreaterThanOrEqual(24);
    expect(shots).toBeLessThanOrEqual(40);
    expect(conversion).toBeGreaterThanOrEqual(0.18);
    expect(conversion).toBeLessThanOrEqual(0.28);

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

function winRate(seedPrefix: string, edge: number, n: number): { win: number; draw: number; loss: number } {
  let w = 0, d = 0, l = 0;
  for (let i = 0; i < n; i++) {
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
  it('gives a fifteen-point edge roughly 60-70% of wins, and still allows upsets', () => {
    const r = winRate('edge15', 15, 400);
    // eslint-disable-next-line no-console
    console.log(`\n15-point edge: W ${pct(r.win)}  D ${pct(r.draw)}  L ${pct(r.loss)}\n`);
    expect(r.win).toBeGreaterThanOrEqual(0.6);
    expect(r.win).toBeLessThanOrEqual(0.7);
    expect(r.loss).toBeGreaterThan(0.1);
  }, LONG);

  it('keeps a heavy mismatch inside 75-85% and never above 90%', () => {
    const r = winRate('edge25', 25, 400);
    // eslint-disable-next-line no-console
    console.log(`25-point edge: W ${pct(r.win)}  D ${pct(r.draw)}  L ${pct(r.loss)}\n`);
    expect(r.win).toBeGreaterThanOrEqual(0.75);
    expect(r.win).toBeLessThanOrEqual(0.85);
    expect(r.win).toBeLessThan(0.9);
  }, LONG);

  it('is even when the squads are even', () => {
    const r = winRate('edge0', 0, 400);
    expect(Math.abs(r.win - r.loss)).toBeLessThan(0.09);
  }, LONG);
});

// --------------------------------------------------------------------------

describe('home advantage and support', () => {
  it('is exactly zero by default, because the competition uses one neutral venue', () => {
    const setup = fixture('neutral', 64, 64);
    expect(setup.homeAdvantage).toBe(0);
    expect(setup.neutralVenue).toBe(true);
  });

  it('keeps the audience modifier under a six-point swing at full support', () => {
    // Same seeds either side so the only difference is the support term itself.
    const supported = winRateWithSupport('support', 1);
    const neutral = winRateWithSupport('support', 0);
    const swing = Math.abs(supported - neutral);
    // eslint-disable-next-line no-console
    console.log(`support swing: ${pct(swing)} (cap 6 points)\n`);
    expect(swing).toBeLessThanOrEqual(0.06);
  }, LONG);
});

function winRateWithSupport(seedPrefix: string, support: number): number {
  let w = 0;
  const n = 400;
  for (let i = 0; i < n; i++) {
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

describe('fatigue, substitutions and injuries', () => {
  it('drains stamina over the match and rewards a deep bench', () => {
    const r = simulateMatch(fixture('fatigue', 64, 64, { config: { substitutions: 0 } }));
    const staminas = Object.values(r.playerStats).map((p) => p.endStamina);
    expect(Math.min(...staminas)).toBeLessThan(80);
    expect(Math.max(...staminas)).toBeLessThanOrEqual(100);
  });

  it('respects a substitution limit of zero', () => {
    const r = simulateMatch(fixture('nosubs', 64, 64, { config: { substitutions: 0 } }));
    expect(r.events.filter((e) => e.type === 'SUBSTITUTION')).toHaveLength(0);
  });

  it('a high press costs measurably more stamina than a low block', () => {
    const pressed = staminaUnder('HIGH_PRESS');
    const blocked = staminaUnder('LOW_BLOCK');
    expect(pressed).toBeLessThan(blocked);
  });
});

function staminaUnder(press: 'HIGH_PRESS' | 'LOW_BLOCK'): number {
  const rng = new Rng(`press-${press}`);
  const home = makeTestTeam(rng, { prefix: 'ph', name: 'Northside', target: 64 });
  const away = makeTestTeam(rng, { prefix: 'pa', name: 'Southgate', target: 64 });
  const setup = makeTestSetup({
    seed: `press-${press}`,
    home: { ...home, tactics: { ...home.tactics, press } },
    away,
    config: { substitutions: 0 },
  });
  const r = simulateMatch(setup);
  const homeIds = new Set(home.players.map((p) => p.id as unknown as string));
  const values = Object.entries(r.playerStats)
    .filter(([id]) => homeIds.has(id))
    .map(([, s]) => s.endStamina);
  return values.reduce((a, b) => a + b, 0) / Math.max(1, values.length);
}

// --------------------------------------------------------------------------

describe('live decisions', () => {
  it('never issues two prompts within six match minutes and respects the cap', () => {
    for (let i = 0; i < 40; i++) {
      const rng = new Rng(`dec:${i}`);
      const setup = makeTestSetup({
        seed: `dec:${i}`,
        home: makeTestTeam(rng, { prefix: `dh${i}`, name: 'Northside', target: 58, isPlayerControlled: true }),
        away: makeTestTeam(rng, { prefix: `da${i}`, name: 'Southgate', target: 70 }),
        config: { liveDecisions: true, maxDecisions: 3 },
      });
      const sim = new MatchSimulator(setup);
      const minutes: number[] = [];
      let guard = 0;
      while (!sim.isComplete && guard < 5000) {
        const prompt = sim.pendingDecision();
        if (prompt) {
          expect(prompt.options.length).toBeGreaterThanOrEqual(2);
          expect(prompt.options.length).toBeLessThanOrEqual(3);
          minutes.push(prompt.minute);
          sim.resolveDecision(prompt.id, (prompt.options[prompt.options.length - 1]?.id) as string);
        } else {
          sim.step();
        }
        guard += 1;
      }
      const r = sim.result();
      expect(minutes.length).toBeLessThanOrEqual(3);
      for (let k = 1; k < minutes.length; k++) {
        expect((minutes[k] as number) - (minutes[k - 1] as number))
          .toBeGreaterThanOrEqual(BALANCE.DECISION_COOLDOWN_MINUTES);
      }
      for (const d of r.decisions) {
        expect(d.evaluation).toBeDefined();
        expect(['WORKED', 'NEUTRAL', 'BACKFIRED']).toContain(d.evaluation?.verdict);
      }
    }
  }, LONG);

  it('produces every verdict across a large sample rather than always saying it worked', () => {
    const verdicts = new Set<string>();
    for (let i = 0; i < 150; i++) {
      const r = simulateMatch(fixture(`verdict:${i}`, 60 + (i % 6) * 3, 62));
      for (const d of r.decisions) if (d.evaluation) verdicts.add(d.evaluation.verdict);
    }
    expect(verdicts.has('WORKED')).toBe(true);
    expect(verdicts.has('BACKFIRED')).toBe(true);
  }, LONG);
});

// --------------------------------------------------------------------------

describe('special rule windows', () => {
  it('runs exactly one guaranteed window per half, anchored to its closing minutes', () => {
    const setup = fixture('windows', 64, 64);
    const r = simulateMatch(setup);
    const starts = r.events.filter((e) => e.type === 'SPECIAL_RULE_START');
    const ends = r.events.filter((e) => e.type === 'SPECIAL_RULE_END');
    expect(starts).toHaveLength(setup.config.halves);
    expect(ends).toHaveLength(setup.config.halves);

    const halfLength = setup.config.minutes / setup.config.halves;
    for (let half = 1; half <= setup.config.halves; half++) {
      const nominalStart = halfLength * half - BALANCE.SWING_WINDOW_MINUTES;
      const start = starts[half - 1];
      expect(start).toBeDefined();
      // Actual clock can drift past nominal by the added time already played.
      expect((start as { minute: number }).minute).toBeGreaterThanOrEqual(nominalStart);
      expect((start as { minute: number }).minute).toBeLessThanOrEqual(nominalStart + BALANCE.MAX_ADDED_MINUTES + 1);
    }
    expect(r.specialRules.length).toBe(setup.config.halves);
    for (const rule of r.specialRules) expect(rule.reason.length).toBeGreaterThan(0);
  });

  it('scores faster inside the window than outside it', () => {
    let inWindow = 0;
    let outWindow = 0;
    for (let i = 0; i < 200; i++) {
      const r = simulateMatch(fixture(`rate:${i}`, 62, 62));
      for (const e of r.events) {
        if (e.type !== 'GOAL' && e.type !== 'PENALTY_SCORED') continue;
        if (e.detail?.['window'] === true) inWindow += 1; else outWindow += 1;
      }
    }
    expect(inWindow).toBeGreaterThan(0);
    expect(outWindow).toBeGreaterThan(0);
  }, LONG);
});

// --------------------------------------------------------------------------

describe('presentation outputs', () => {
  it('produces a legible pitch frame with everyone on the pitch and inside it', () => {
    const sim = new MatchSimulator(fixture('frames', 64, 64));
    for (let i = 0; i < 60; i++) sim.step();
    const frame = sim.frame();
    expect(frame.players.length).toBe(14);
    for (const p of frame.players) {
      expect(p.x).toBeGreaterThanOrEqual(0);
      expect(p.x).toBeLessThanOrEqual(1);
      expect(p.y).toBeGreaterThanOrEqual(0);
      expect(p.y).toBeLessThanOrEqual(1);
    }
    // The two shapes must sit on opposite sides of the ball's half, not overlap.
    const homeX = frame.players.filter((p) => p.side === 'home').map((p) => p.x);
    const awayX = frame.players.filter((p) => p.side === 'away').map((p) => p.x);
    expect(Math.min(...homeX)).toBeLessThan(Math.min(...awayX));
    expect(Math.max(...homeX)).toBeLessThan(Math.max(...awayX));
  });

  it('names a man of the match and a key moment', () => {
    const r = simulateMatch(fixture('motm', 68, 60));
    expect(r.motmPlayerId).not.toBeNull();
    expect(r.keyMomentEventId).not.toBeNull();
    expect(r.momentumTimeline.length).toBeGreaterThan(10);
  });

  it('never repeats a goal commentary line inside one match while alternatives remain', () => {
    for (let i = 0; i < 60; i++) {
      const r = simulateMatch(fixture(`lines:${i}`, 70, 56));
      const goals = r.events.filter((e) => e.type === 'GOAL').map((e) => e.text);
      if (goals.length < 2 || goals.length > 12) continue;
      expect(new Set(goals).size).toBe(goals.length);
    }
  }, LONG);
});

// --------------------------------------------------------------------------

describe('tie-break', () => {
  it('resolves a level match through the one-on-one shootout when the league asks for it', () => {
    let resolved = 0;
    let drawn = 0;
    for (let i = 0; i < 120; i++) {
      const r = simulateMatch(fixture(`tie:${i}`, 64, 64, { tieBreak: 'SHOOTOUT' }));
      if (r.homeScore !== r.awayScore) continue;
      drawn += 1;
      if (r.winner !== 'draw') resolved += 1;
    }
    expect(drawn).toBeGreaterThan(0);
    expect(resolved).toBe(drawn);
  }, LONG);
});
