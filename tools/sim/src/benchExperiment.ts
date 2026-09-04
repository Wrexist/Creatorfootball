/**
 * Does the matchday bench system make a better league, or only a different one?
 *
 * `COVER_THRESHOLD` and `TACTICAL_LEAN` inside `selectMatchdayBench` are
 * implementation choices. They were picked from the position table's own tiers,
 * not measured against play, and the previous phase closed by saying so. This
 * harness answers the question the only way it can be answered: run the same
 * league, from the same seeds, with the same clubs, squads, fixtures and match
 * configuration, and change exactly one thing — the selector's constants.
 *
 * Everything here drives the *real* selector through the engine's own
 * `benchTuning` option, which defaults to the production constants. There is no
 * second implementation to drift from the first, and `benchTuning.test.ts`
 * pins that the default path is byte-identical to production.
 *
 * Usage: tsx src/benchExperiment.ts [worlds] [outDir]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  Ledger, MatchSimulator, advanceCycle, autoLineup, buildMatchSetup, familiarity,
  formationById, formationsFor, isAvailable, positionGroup, selectMatchdayBench, squadOf,
  type BenchTuning, type ClubId, type CreatorSeasonConfigDef, type Fixture,
  type GameState, type MatchResult, type Player, type PlayerId,
} from '@cf/engine';
import { EPOCH, CYCLE_MS, registry, startGame, progress } from './harness';
import { heading, note, table } from './report';

// ---------------------------------------------------------------- configuration

interface Configuration {
  readonly key: string;
  readonly label: string;
  readonly tuning: BenchTuning;
}

/**
 * Five configurations, not a parameter sweep. The control, one step either side
 * of the cover threshold, and the tactical lean switched off and doubled. If a
 * parameter turns out to be sensitive, that earns a focused second experiment;
 * a hundred configurations up front would only be a slower way of guessing.
 */
const CONFIGURATIONS: readonly Configuration[] = [
  { key: 'A_current', label: 'A current (0.70 / 0.12)', tuning: { coverThreshold: 0.7, tacticalLean: 0.12 } },
  { key: 'B_low_cover', label: 'B low cover (0.60 / 0.12)', tuning: { coverThreshold: 0.6, tacticalLean: 0.12 } },
  { key: 'C_high_cover', label: 'C high cover (0.80 / 0.12)', tuning: { coverThreshold: 0.8, tacticalLean: 0.12 } },
  { key: 'D_no_lean', label: 'D no lean (0.70 / 0.00)', tuning: { coverThreshold: 0.7, tacticalLean: 0 } },
  { key: 'E_strong_lean', label: 'E strong lean (0.70 / 0.20)', tuning: { coverThreshold: 0.7, tacticalLean: 0.2 } },
];

const WORLDS = Number(process.argv[2] ?? 40);
const OUT_DIR = process.argv[3] ?? 'docs/experiments/bench-tuning';
const SEEDS = Array.from({ length: WORLDS }, (_, i) => `bench-exp-${String(i).padStart(3, '0')}`);

// ---------------------------------------------------------------------- maths

const sum = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0);
const mean = (v: readonly number[]): number => (v.length ? sum(v) / v.length : 0);
const sorted = (v: readonly number[]): number[] => [...v].sort((a, b) => a - b);
const quantile = (v: readonly number[], q: number): number => {
  if (v.length === 0) return 0;
  const s = sorted(v);
  const i = (s.length - 1) * q;
  const lo = Math.floor(i);
  const hi = Math.ceil(i);
  return (s[lo] as number) + ((s[hi] as number) - (s[lo] as number)) * (i - lo);
};
const sd = (v: readonly number[]): number => {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(sum(v.map((x) => (x - m) ** 2)) / (v.length - 1));
};
/** Pearson correlation. Reported with its n so a weak r is readable as weak. */
const correlation = (xs: readonly number[], ys: readonly number[]): number => {
  const n = Math.min(xs.length, ys.length);
  if (n < 3) return 0;
  const mx = mean(xs.slice(0, n));
  const my = mean(ys.slice(0, n));
  let num = 0; let dx = 0; let dy = 0;
  for (let i = 0; i < n; i++) {
    const a = (xs[i] as number) - mx;
    const b = (ys[i] as number) - my;
    num += a * b; dx += a * a; dy += b * b;
  }
  return dx > 0 && dy > 0 ? num / Math.sqrt(dx * dy) : 0;
};
const spread = (v: readonly number[]) => ({
  mean: mean(v), sd: sd(v), min: v.length ? Math.min(...v) : 0, max: v.length ? Math.max(...v) : 0,
  p10: quantile(v, 0.1), median: quantile(v, 0.5), p90: quantile(v, 0.9),
});
const share = (n: number, total: number): number => (total ? n / total : 0);
const round = (x: number, dp = 3): number => Number(x.toFixed(dp));

// ------------------------------------------------------------- club profiling

const LINES = ['DEF', 'MID', 'ATT'] as const;

/** A club as it stands before a ball is kicked: how good, and how deep. */
interface ClubProfile {
  readonly clubId: string;
  /** Mean overall of the side the engine would pick. */
  readonly startingStrength: number;
  /** Mean overall of everyone else fit. */
  readonly reserveStrength: number;
  /** Reserves as a fraction of the starters: depth, independent of quality. */
  readonly depthRatio: number;
  /** Reserves who can genuinely play two or more outfield lines of the shape. */
  readonly utilityReserves: number;
  readonly spareKeepers: number;
  readonly squadSize: number;
}

function profileClub(state: GameState, clubId: ClubId): ClubProfile {
  const squad = squadOf(state, clubId);
  const club = state.clubs[clubId];
  const formation = formationById(club?.tactics.formationId ?? '2-3-1');
  const auto = autoLineup(squad, formation);
  const startedIds = new Set(Object.values(auto.lineup).filter(Boolean) as string[]);
  const starters = squad.filter((p) => startedIds.has(p.id as string));
  const reserves = squad.filter((p) => !startedIds.has(p.id as string) && isAvailable(p));

  const coversLine = (p: Player, line: (typeof LINES)[number]): boolean =>
    formation.slots.filter((s) => s.role === line).some((s) => Math.min(1,
      familiarity(p.position, s.position) + (p.secondaryPositions.includes(s.position) ? 0.12 : 0)) >= 0.7);

  const startingStrength = mean(starters.map((p) => p.overall));
  const reserveStrength = mean(reserves.map((p) => p.overall));
  return {
    clubId: clubId as string,
    startingStrength,
    reserveStrength,
    depthRatio: startingStrength > 0 ? reserveStrength / startingStrength : 0,
    utilityReserves: reserves.filter((p) => LINES.filter((l) => coversLine(p, l)).length >= 2).length,
    spareKeepers: reserves.filter((p) => p.position === 'GK').length,
    squadSize: squad.length,
  };
}

// ------------------------------------------------------------------ collection

interface BenchRecord {
  readonly seats: number;
  readonly roles: Record<string, number>;
  readonly naturalGroups: Record<string, number>;
  readonly lineCover: Record<string, number>;
  readonly utilitySeats: number;
  readonly keepers: number;
  /** Ids in bench order, and the position group of each, for utilisation. */
  readonly ids: readonly string[];
  readonly groups: Readonly<Record<string, string>>;
  /** The highest-rated man sitting down: is he ever used? */
  readonly bestId: string | null;
}

interface Totals {
  matches: number;
  roleCounts: Record<string, number>;
  goals: number[];
  margins: number[];
  homeWins: number; draws: number; awayWins: number;
  bigMargins: number; goalless: number;
  subs: number[];
  subMinutes: number[];
  subGroups: Record<string, number>;
  keeperSubs: number;
  lateSubs: number;
  injuries: number;
  reds: number;
  lateGoals: number;
  totalGoals: number;
  comebacks: number;
  halfTimeLeads: number;
  benches: BenchRecord[];
  benchSeatsUsed: number;
  benchSeatsTotal: number;
  bestBenchUnused: number;
  benchesMeasured: number;
  /** clubId -> season points, and the profile it started from. */
  clubPoints: { profile: ClubProfile; points: number; gf: number; ga: number; played: number }[];
  seasonPointSpread: number[];
  championPoints: number[];
  resultLines: string[];
}

const emptyTotals = (): Totals => ({
  matches: 0, roleCounts: {}, goals: [], margins: [], homeWins: 0, draws: 0, awayWins: 0,
  bigMargins: 0, goalless: 0, subs: [], subMinutes: [], subGroups: { GK: 0, DEF: 0, MID: 0, ATT: 0 },
  keeperSubs: 0, lateSubs: 0, injuries: 0, reds: 0, lateGoals: 0, totalGoals: 0,
  comebacks: 0, halfTimeLeads: 0, benches: [], benchSeatsUsed: 0, benchSeatsTotal: 0,
  bestBenchUnused: 0, benchesMeasured: 0, clubPoints: [], seasonPointSpread: [], championPoints: [],
  resultLines: [],
});

/**
 * The bench a fixture will be played with, read from the simulator itself.
 *
 * The ids are the simulator's own answer — the only version that is true. The
 * seat *reasons* are not exposed on the match, so they are recovered by calling
 * the selector again with the same inputs, and the two are asserted to agree.
 * If they ever diverge the experiment stops rather than reporting a number
 * about a bench nobody played with.
 */
function readBench(
  state: GameState, fixture: Fixture, config: CreatorSeasonConfigDef, tuning: BenchTuning,
): { home: BenchRecord; away: BenchRecord } {
  const setup = buildMatchSetup(state, fixture, config, { benchTuning: tuning });
  const sim = new MatchSimulator(setup);
  const read = (side: 'home' | 'away'): BenchRecord => {
    const team = side === 'home' ? setup.home : setup.away;
    const byId = new Map(team.players.map((p) => [p.id as string, p]));
    const formation = formationById(team.tactics.formationId);
    const ids = sim.substitutionStatus(side).bench.map((s) => s.playerId as string);
    const players = ids.map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));

    // The same starters the simulator built its bench from.
    const auto = autoLineup(team.players, formation);
    const lineup = { ...auto.lineup, ...team.tactics.lineup };
    const starters = formation.slots
      .map((slot) => {
        const id = lineup[slot.id];
        const player = id ? byId.get(id as string) : undefined;
        return player ? { slot, player } : null;
      })
      .filter((s): s is { slot: (typeof formation.slots)[number]; player: Player } => s !== null);
    const seats = team.tactics.bench.length > 0
      ? []
      : selectMatchdayBench(team.players, starters, formation, {
        size: config.benchSize, risk: team.tactics.risk, tuning,
      });
    if (seats.length > 0) {
      const rebuilt = seats.map((seat) => seat.player.id as string);
      if (rebuilt.join(',') !== ids.join(',')) {
        throw new Error(`bench rebuild disagreed with the simulator for ${fixture.id} ${side}`);
      }
    }

    const coversLine = (p: Player, line: (typeof LINES)[number]): boolean =>
      formation.slots.filter((s) => s.role === line).some((s) => Math.min(1,
        familiarity(p.position, s.position) + (p.secondaryPositions.includes(s.position) ? 0.12 : 0)) >= 0.7);

    const roles: Record<string, number> = {};
    for (const seat of seats) roles[seat.role] = (roles[seat.role] ?? 0) + 1;
    const naturalGroups: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    const lineCover: Record<string, number> = { GK: 0, DEF: 0, MID: 0, ATT: 0 };
    const groups: Record<string, string> = {};
    let utilitySeats = 0;
    for (const p of players) {
      const group = positionGroup(p.position);
      groups[p.id as string] = group;
      naturalGroups[group] = (naturalGroups[group] ?? 0) + 1;
      if (p.position === 'GK') lineCover.GK = (lineCover.GK ?? 0) + 1;
      const covered = LINES.filter((l) => coversLine(p, l));
      for (const l of covered) lineCover[l] = (lineCover[l] ?? 0) + 1;
      if (covered.length >= 2) utilitySeats += 1;
    }
    const best = players.length
      ? players.reduce((a, b) => (b.overall > a.overall ? b : a)).id as string
      : null;
    return {
      seats: players.length, roles, naturalGroups, lineCover, utilitySeats,
      keepers: players.filter((p) => p.position === 'GK').length,
      ids, groups, bestId: best,
    };
  };
  return { home: read('home'), away: read('away') };
}

function collectMatch(t: Totals, result: MatchResult, benches: { home: BenchRecord; away: BenchRecord }): void {
  const total = result.homeScore + result.awayScore;
  t.matches += 1;
  t.goals.push(total);
  t.totalGoals += total;
  t.margins.push(Math.abs(result.homeScore - result.awayScore));
  if (result.winner === 'home') t.homeWins += 1;
  else if (result.winner === 'away') t.awayWins += 1;
  else t.draws += 1;
  if (Math.abs(result.homeScore - result.awayScore) >= 4) t.bigMargins += 1;
  if (total === 0) t.goalless += 1;
  t.injuries += result.injuries.length;
  t.reds += result.homeStats.redCards + result.awayStats.redCards;

  const full = result.durationMinutes || 30;
  const lateFrom = full * 2 / 3;
  let halfTime: { home: number; away: number } | null = null;
  const camePlayers = new Set<string>();
  let homeSubs = 0; let awaySubs = 0;

  for (const event of result.events) {
    if (event.type === 'HALFTIME') halfTime = { home: event.homeScore, away: event.awayScore };
    if (event.type === 'GOAL' && event.minute >= lateFrom) t.lateGoals += 1;
    if (event.type !== 'SUBSTITUTION') continue;
    const onId = event.secondaryPlayerId as PlayerId | undefined;
    if (onId) camePlayers.add(onId as string);
    if (event.side === 'home') homeSubs += 1; else awaySubs += 1;
    t.subMinutes.push(event.minute);
    if (event.minute >= lateFrom) t.lateSubs += 1;
    const bench = event.side === 'home' ? benches.home : benches.away;
    const group = onId ? bench.groups[onId as string] : undefined;
    if (group) t.subGroups[group] = (t.subGroups[group] ?? 0) + 1;
    if (group === 'GK') t.keeperSubs += 1;
  }
  t.subs.push(homeSubs, awaySubs);

  // A comeback: behind at the break, not behind at the end.
  if (halfTime) {
    if (halfTime.home !== halfTime.away) {
      t.halfTimeLeads += 1;
      const leaderWasHome = halfTime.home > halfTime.away;
      const finalHome = result.homeScore > result.awayScore;
      const finalLevel = result.homeScore === result.awayScore;
      if (!finalLevel && finalHome !== leaderWasHome) t.comebacks += 1;
    }
  }

  for (const bench of [benches.home, benches.away]) {
    t.benches.push(bench);
    for (const [role, count] of Object.entries(bench.roles)) {
      t.roleCounts[role] = (t.roleCounts[role] ?? 0) + count;
    }
    t.benchesMeasured += 1;
    t.benchSeatsTotal += bench.seats;
    t.benchSeatsUsed += bench.ids.filter((id) => camePlayers.has(id)).length;
    if (bench.bestId && !camePlayers.has(bench.bestId)) t.bestBenchUnused += 1;
  }
}

// ------------------------------------------------------------------- the run

/**
 * One world, one season, under one configuration.
 *
 * The world is generated from the seed alone and is therefore identical across
 * configurations — `benchTuning.test.ts` proves generation cannot see the
 * tuning. Benches are read at the start of each matchweek: within a week every
 * club plays exactly once, so nothing a fixture does can change the squad or
 * tactics another fixture in the same week will be built from, and the read is
 * exact rather than approximate. The rebuild assertion in `readBench` is the
 * belt to that braces.
 */
function playWorld(seed: string, tuning: BenchTuning, t: Totals): void {
  const reg = registry();
  const config = reg.seasonConfig() as CreatorSeasonConfigDef;
  let state: GameState = startGame(seed);

  const profiles = new Map<string, ClubProfile>();
  for (const clubId of Object.keys(state.clubs)) {
    profiles.set(clubId, profileClub(state, clubId as ClubId));
  }
  const points = new Map<string, { points: number; gf: number; ga: number; played: number }>();
  for (const clubId of Object.keys(state.clubs)) points.set(clubId, { points: 0, gf: 0, ga: 0, played: 0 });

  const season = state.seasons[state.currentSeasonId];
  const weeks = season?.totalWeeks ?? 22;

  for (let w = 0; w < weeks; w++) {
    const week = state.clock.week + 1;
    const due = Object.values(state.fixtures)
      .filter((f): f is Fixture => f.week === week && f.status === 'SCHEDULED')
      .sort((a, b) => (a.id < b.id ? -1 : 1));
    const benchByFixture = new Map<string, { home: BenchRecord; away: BenchRecord }>();
    for (const fixture of due) {
      benchByFixture.set(fixture.id as string, readBench(state, fixture, config, tuning));
    }

    const outcome = advanceCycle(state, {
      now: EPOCH + w * CYCLE_MS,
      registry: reg,
      ledger: Ledger.restore(state.ledger),
      benchTuning: tuning,
    });
    state = outcome.state;

    for (const result of outcome.results) {
      const benches = benchByFixture.get(String(result.matchId).replace(/^match_/, ''));
      if (!benches) continue;
      collectMatch(t, result, benches);
      t.resultLines.push(`${result.matchId} ${result.homeScore}-${result.awayScore}`);
      const home = points.get(result.homeClubId as string);
      const away = points.get(result.awayClubId as string);
      if (home && away) {
        home.gf += result.homeScore; home.ga += result.awayScore; home.played += 1;
        away.gf += result.awayScore; away.ga += result.homeScore; away.played += 1;
        if (result.homeScore > result.awayScore) home.points += 3;
        else if (result.awayScore > result.homeScore) away.points += 3;
        else { home.points += 1; away.points += 1; }
      }
    }
  }

  const seasonPoints: number[] = [];
  for (const [clubId, tally] of points) {
    const profile = profiles.get(clubId);
    if (!profile || tally.played === 0) continue;
    t.clubPoints.push({ profile, ...tally });
    seasonPoints.push(tally.points);
  }
  t.seasonPointSpread.push(sd(seasonPoints));
  t.championPoints.push(seasonPoints.length ? Math.max(...seasonPoints) : 0);
}

// ------------------------------------------------------------------ analysis

/** Split a list into thirds by a key, so "strong / middle / weak" is defined. */
function terciles<T>(items: readonly T[], key: (item: T) => number): [T[], T[], T[]] {
  const s = [...items].sort((a, b) => key(a) - key(b));
  const third = Math.floor(s.length / 3);
  return [s.slice(0, third), s.slice(third, s.length - third), s.slice(s.length - third)];
}

function summarise(t: Totals) {
  const clubs = t.clubPoints;
  const ppg = (list: typeof clubs) => mean(list.map((c) => c.points / Math.max(1, c.played)));
  const [weak, middle, strong] = terciles(clubs, (c) => c.profile.startingStrength);

  // Depth, held against strength. Comparing deep squads to shallow ones across
  // the whole league would only rediscover that good clubs have good reserves;
  // the question is whether depth pays *on top of* the eleven, so the split is
  // made inside each strength tercile and then pooled.
  let deepPpg: number[] = []; let shallowPpg: number[] = [];
  for (const band of [weak, middle, strong]) {
    const byDepth = [...band].sort((a, b) => a.profile.depthRatio - b.profile.depthRatio);
    const half = Math.floor(byDepth.length / 2);
    shallowPpg = shallowPpg.concat(byDepth.slice(0, half).map((c) => c.points / Math.max(1, c.played)));
    deepPpg = deepPpg.concat(byDepth.slice(byDepth.length - half).map((c) => c.points / Math.max(1, c.played)));
  }

  const benchCount = Math.max(1, t.benchesMeasured);
  const avgLine = (line: string) => mean(t.benches.map((b) => b.lineCover[line] ?? 0));
  const missingLine = (line: string) => t.benches.filter((b) => (b.lineCover[line] ?? 0) === 0).length;
  const goalHistogram: Record<string, number> = {};
  for (const g of t.goals) {
    const bucket = g >= 10 ? '10+' : String(g);
    goalHistogram[bucket] = (goalHistogram[bucket] ?? 0) + 1;
  }
  const marginHistogram: Record<string, number> = {};
  for (const m of t.margins) {
    const bucket = m >= 5 ? '5+' : String(m);
    marginHistogram[bucket] = (marginHistogram[bucket] ?? 0) + 1;
  }

  return {
    matches: t.matches,
    results: {
      goalsPerMatch: round(mean(t.goals)),
      goals: Object.fromEntries(Object.entries(spread(t.goals)).map(([k, v]) => [k, round(v, 2)])),
      goalHistogram,
      marginHistogram,
      margin: round(mean(t.margins), 3),
      homeWinShare: round(share(t.homeWins, t.matches)),
      drawShare: round(share(t.draws, t.matches)),
      awayWinShare: round(share(t.awayWins, t.matches)),
      bigMarginShare: round(share(t.bigMargins, t.matches)),
      goallessShare: round(share(t.goalless, t.matches)),
    },
    competitiveness: {
      seasonPointsSd: round(mean(t.seasonPointSpread), 3),
      championPoints: round(mean(t.championPoints), 2),
      strongPpg: round(ppg(strong), 3),
      middlePpg: round(ppg(middle), 3),
      weakPpg: round(ppg(weak), 3),
      strengthGapPpg: round(ppg(strong) - ppg(weak), 3),
      strengthPointsCorrelation: round(correlation(
        clubs.map((c) => c.profile.startingStrength), clubs.map((c) => c.points)), 3),
    },
    depth: {
      deepPpg: round(mean(deepPpg), 3),
      shallowPpg: round(mean(shallowPpg), 3),
      depthGapPpg: round(mean(deepPpg) - mean(shallowPpg), 3),
      depthPointsCorrelation: round(correlation(
        clubs.map((c) => c.profile.depthRatio), clubs.map((c) => c.points)), 3),
      utilityPointsCorrelation: round(correlation(
        clubs.map((c) => c.profile.utilityReserves), clubs.map((c) => c.points)), 3),
      // Nearly every reserve in this content covers two lines, so the utility
      // count barely varies between clubs. Its spread is reported alongside the
      // correlation, because a correlation over a near-constant is not evidence.
      utilityReservesMean: round(mean(clubs.map((c) => c.profile.utilityReserves)), 2),
      utilityReservesSd: round(sd(clubs.map((c) => c.profile.utilityReserves)), 3),
      clubsMeasured: clubs.length,
    },
    substitutions: {
      perTeamPerMatch: round(mean(t.subs), 3),
      perMatch: round(mean(t.subs) * 2, 3),
      meanMinute: round(mean(t.subMinutes), 2),
      medianMinute: round(quantile(t.subMinutes, 0.5), 2),
      lateShare: round(share(t.lateSubs, Math.max(1, t.subMinutes.length))),
      keeperSubs: t.keeperSubs,
      byGroup: Object.fromEntries(Object.entries(t.subGroups)
        .map(([k, v]) => [k, round(share(v, Math.max(1, t.subMinutes.length)))])),
    },
    bench: {
      seatsPerBench: round(t.benchSeatsTotal / benchCount, 3),
      utilisation: round(share(t.benchSeatsUsed, Math.max(1, t.benchSeatsTotal))),
      bestBenchUnusedShare: round(share(t.bestBenchUnused, benchCount)),
      roleShare: Object.fromEntries(Object.entries(t.roleCounts)
        .map(([k, v]) => [k, round(share(v, Math.max(1, t.benchSeatsTotal)))])),
      lineCover: {
        GK: round(avgLine('GK'), 3), DEF: round(avgLine('DEF'), 3),
        MID: round(avgLine('MID'), 3), ATT: round(avgLine('ATT'), 3),
      },
      benchesMissingLine: {
        GK: round(share(missingLine('GK'), benchCount)),
        DEF: round(share(missingLine('DEF'), benchCount)),
        MID: round(share(missingLine('MID'), benchCount)),
        ATT: round(share(missingLine('ATT'), benchCount)),
      },
      naturalPositions: {
        GK: round(mean(t.benches.map((b) => b.naturalGroups.GK ?? 0)), 3),
        DEF: round(mean(t.benches.map((b) => b.naturalGroups.DEF ?? 0)), 3),
        MID: round(mean(t.benches.map((b) => b.naturalGroups.MID ?? 0)), 3),
        ATT: round(mean(t.benches.map((b) => b.naturalGroups.ATT ?? 0)), 3),
      },
      utilitySeatsPerBench: round(mean(t.benches.map((b) => b.utilitySeats)), 3),
      twoKeeperShare: round(share(t.benches.filter((b) => b.keepers >= 2).length, benchCount)),
      noKeeperShare: round(share(t.benches.filter((b) => b.keepers === 0).length, benchCount)),
    },
    resilience: {
      injuriesPerMatch: round(t.injuries / Math.max(1, t.matches), 4),
      redCardsPerMatch: round(t.reds / Math.max(1, t.matches), 4),
    },
    lateMatch: {
      lateGoalShare: round(share(t.lateGoals, Math.max(1, t.totalGoals))),
      comebackShare: round(share(t.comebacks, Math.max(1, t.halfTimeLeads))),
      halfTimeLeads: t.halfTimeLeads,
    },
    resultsHash: createHash('sha256').update(t.resultLines.join('|')).digest('hex').slice(0, 16),
  };
}

// ------------------------------------------------- how the selector responds

/**
 * League outcomes only show what the *league* reaches. The clubs in this
 * content pack all play balanced seven-a-side shapes, so a constant that can
 * only bite in a lopsided one measures as inert there while being perfectly
 * live for a manager who picks that shape on the tactics screen. This section
 * asks the selector directly, over every real squad and every shape the game
 * offers, so "no effect" and "no effect here" do not get confused.
 */
function selectorResponse(seeds: readonly string[]) {
  const shapes = [...formationsFor(7), ...formationsFor(11)];
  type Shape = (typeof shapes)[number];
  const benchOf = (
    squad: readonly Player[], formation: Shape,
    risk: 'RECKLESS' | 'CAUTIOUS' | 'MEASURED', tuning: BenchTuning, drop?: string,
  ): string => {
    const pool = drop ? squad.filter((p) => (p.id as string) !== drop) : squad;
    const auto = autoLineup(pool, formation);
    const starters = formation.slots
      .map((slot) => {
        const id = auto.lineup[slot.id];
        const player = id ? pool.find((p) => p.id === id) : undefined;
        return player ? { slot, player } : null;
      })
      .filter((x): x is { slot: Shape['slots'][number]; player: Player } => x !== null);
    return selectMatchdayBench(pool, starters, formation, { size: 7, risk, tuning })
      .map((seat) => seat.player.id).join(',');
  };

  const T = (coverThreshold: number, tacticalLean: number): BenchTuning => ({ coverThreshold, tacticalLean });
  const counters = {
    cover06vs07: { changed: 0, total: 0 },
    cover07vs08: { changed: 0, total: 0 },
    lean0vs012: { changed: 0, total: 0 },
    lean012vs02: { changed: 0, total: 0 },
  };
  const leanByShape: Record<string, number> = {};
  const coverLowByShape: Record<string, number> = {};
  const coverHighByShape: Record<string, number> = {};
  const acrossShapes: number[] = [];
  const oneOut: number[] = [];
  let utilitySeats = 0; let seatsSeen = 0;
  /** What the bench is worth, against the seven best reserves by rating. */
  const benchQuality: number[] = []; const topSevenQuality: number[] = [];
  const LEAN_RISKS = ['RECKLESS', 'CAUTIOUS'] as const;

  const coversLine = (p: Player, formation: Shape, line: (typeof LINES)[number]): boolean =>
    formation.slots.filter((sl) => sl.role === line).some((sl) => Math.min(1,
      familiarity(p.position, sl.position)
      + (p.secondaryPositions.includes(sl.position) ? 0.12 : 0)) >= 0.7);

  for (const seed of seeds) {
    const state = startGame(seed);
    for (const clubId of Object.keys(state.clubs)) {
      const squad = squadOf(state, clubId as ClubId);
      const byId = new Map(squad.map((p) => [p.id as string, p]));
      const sevens: string[] = [];
      for (const formation of shapes) {
        for (const risk of LEAN_RISKS) {
          const base = benchOf(squad, formation, risk, T(0.7, 0.12));
          counters.cover06vs07.total += 1;
          if (benchOf(squad, formation, risk, T(0.6, 0.12)) !== base) {
            counters.cover06vs07.changed += 1;
            coverLowByShape[formation.id] = (coverLowByShape[formation.id] ?? 0) + 1;
          }
          counters.cover07vs08.total += 1;
          if (benchOf(squad, formation, risk, T(0.8, 0.12)) !== base) {
            counters.cover07vs08.changed += 1;
            coverHighByShape[formation.id] = (coverHighByShape[formation.id] ?? 0) + 1;
          }
          counters.lean0vs012.total += 1;
          if (benchOf(squad, formation, risk, T(0.7, 0)) !== base) {
            counters.lean0vs012.changed += 1;
            leanByShape[formation.id] = (leanByShape[formation.id] ?? 0) + 1;
          }
          counters.lean012vs02.total += 1;
          if (benchOf(squad, formation, risk, T(0.7, 0.2)) !== base) counters.lean012vs02.changed += 1;
        }
        if (formation.slots.length !== 7) continue;
        const bench = benchOf(squad, formation, 'MEASURED', T(0.7, 0.12));
        sevens.push(bench);
        const auto = autoLineup(squad, formation);
        const firstStarter = Object.values(auto.lineup).find(Boolean) as string | undefined;
        if (firstStarter) {
          const after = benchOf(squad, formation, 'MEASURED', T(0.7, 0.12), firstStarter);
          const before = new Set(bench.split(','));
          const seatsAfter = after.split(',');
          const kept = seatsAfter.filter((id) => before.has(id)).length;
          oneOut.push(1 - kept / Math.max(1, seatsAfter.length));
        }
        const seats = bench.split(',').map((id) => byId.get(id)).filter((p): p is Player => Boolean(p));
        seatsSeen += seats.length;
        utilitySeats += seats.filter((p) =>
          LINES.filter((line) => coversLine(p, formation, line)).length >= 2).length;
      }
      acrossShapes.push(new Set(sevens).size / Math.max(1, sevens.length));
      // Cover costs quality. How much? Against the seven best reserves by
      // rating alone — the bench a pure ranking would have named.
      const own = formationById(state.clubs[clubId as ClubId]?.tactics.formationId ?? '2-3-1');
      const ownBench = benchOf(squad, own, 'MEASURED', T(0.7, 0.12));
      const ownIds = ownBench.split(',');
      benchQuality.push(mean(ownIds.map((id) => byId.get(id)?.overall ?? 0)));
      const autoOwn = autoLineup(squad, own);
      const startedOwn = new Set(Object.values(autoOwn.lineup).filter(Boolean) as string[]);
      const spare = squad.filter((p) => !startedOwn.has(p.id as string) && isAvailable(p))
        .sort((a, b) => b.overall - a.overall).slice(0, ownIds.length);
      topSevenQuality.push(mean(spare.map((p) => p.overall)));
    }
  }

  const pct = (c: { changed: number; total: number }) => round(share(c.changed, c.total));
  return {
    coverThreshold: {
      changed06vs07: pct(counters.cover06vs07),
      changed07vs08: pct(counters.cover07vs08),
      shapesAffectedByLower: coverLowByShape,
      shapesAffectedByHigher: coverHighByShape,
      samples: counters.cover07vs08.total,
    },
    tacticalLean: {
      changed0vs012: pct(counters.lean0vs012),
      changed012vs02: pct(counters.lean012vs02),
      shapesAffected: leanByShape,
      samples: counters.lean0vs012.total,
    },
    startingElevenDependence: {
      distinctBenchesAcrossShapes: round(mean(acrossShapes)),
      benchTurnoverWhenOneStarterOut: round(mean(oneOut)),
    },
    utility: {
      utilitySeatShare: round(share(utilitySeats, Math.max(1, seatsSeen))),
      benchMeanOverall: round(mean(benchQuality), 2),
      bestSevenMeanOverall: round(mean(topSevenQuality), 2),
      qualityForgoneForCover: round(mean(topSevenQuality) - mean(benchQuality), 3),
      clubsMeasured: benchQuality.length,
    },
  };
}

// -------------------------------------------------------------------- driver

heading('CREATOR FOOTBALL — MATCHDAY BENCH BALANCE EXPERIMENT');
note(`  ${CONFIGURATIONS.length} configurations x ${WORLDS} worlds x 1 season.`);
note('  Same seeds, clubs, squads and fixtures throughout; only the selector constants move.\n');

const commit = (() => {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
})();
/** A result recorded against a commit it was not actually run from is a lie. */
const dirtyTree = (() => {
  try { return execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0; }
  catch { return true; }
})();

const started = Date.now();
const summaries: Record<string, ReturnType<typeof summarise>> = {};
/** Every fixture's scoreline per configuration, so "different" can be sized. */
const scorelines: Record<string, Map<string, string>> = {};
for (const configuration of CONFIGURATIONS) {
  const totals = emptyTotals();
  for (let i = 0; i < SEEDS.length; i++) {
    playWorld(SEEDS[i] as string, configuration.tuning, totals);
    progress(configuration.key, i + 1, SEEDS.length);
  }
  summaries[configuration.key] = summarise(totals);
  scorelines[configuration.key] = new Map(totals.resultLines.map((line) => {
    const cut = line.lastIndexOf(' ');
    return [line.slice(0, cut), line.slice(cut + 1)] as const;
  }));
  note(`  ${configuration.label}: ${totals.matches} matches, hash ${summaries[configuration.key]?.resultsHash}`);
}
const runtimeMs = Date.now() - started;

/**
 * A different hash is not a size. Against the control, how many fixtures
 * actually changed, and how many changed who won?
 */
const control = scorelines[CONFIGURATIONS[0]!.key] as Map<string, string>;
const outcome = (score: string): string => {
  const [h, a] = score.split('-').map(Number) as [number, number];
  return h > a ? 'H' : h < a ? 'A' : 'D';
};
const divergence: Record<string, { matchesChanged: number; share: number; winnerChanged: number; winnerShare: number; meanGoalShift: number }> = {};
for (const configuration of CONFIGURATIONS.slice(1)) {
  const other = scorelines[configuration.key] as Map<string, string>;
  let changed = 0; let winner = 0; let goalShift = 0; let total = 0;
  for (const [id, score] of control) {
    const alt = other.get(id);
    total += 1;
    if (alt === undefined || alt === score) continue;
    changed += 1;
    if (outcome(alt) !== outcome(score)) winner += 1;
    const [ah, aa] = score.split('-').map(Number) as [number, number];
    const [bh, ba] = alt.split('-').map(Number) as [number, number];
    goalShift += Math.abs(ah + aa - bh - ba);
  }
  divergence[configuration.key] = {
    matchesChanged: changed,
    share: round(share(changed, total), 4),
    winnerChanged: winner,
    winnerShare: round(share(winner, total), 4),
    meanGoalShift: round(goalShift / Math.max(1, changed), 2),
  };
}

note('\n  measuring how the selector itself responds, across every shape the game offers...');
const response = selectorResponse(SEEDS.slice(0, Math.min(12, SEEDS.length)));

const report = {
  experiment: 'matchday-bench-tuning',
  commit,
  dirtyTree,
  generatedFrom: { worlds: WORLDS, seasonsPerWorld: 1, seeds: SEEDS },
  configurations: CONFIGURATIONS,
  runtimeMs,
  summaries,
  divergenceFromControl: divergence,
  selectorResponse: response,
};

mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/results.json`, `${JSON.stringify(report, null, 2)}\n`);

const row = (label: string, get: (s: ReturnType<typeof summarise>) => string | number) => {
  const out: Record<string, string | number> = { metric: label };
  for (const c of CONFIGURATIONS) out[c.key.slice(0, 1)] = get(summaries[c.key] as ReturnType<typeof summarise>);
  return out;
};
const rows = [
  row('goals/match', (s) => s.results.goalsPerMatch),
  row('goal sd', (s) => s.results.goals.sd as number),
  row('margin >= 4', (s) => s.results.bigMarginShare),
  row('draws', (s) => s.results.drawShare),
  row('season points sd', (s) => s.competitiveness.seasonPointsSd),
  row('strong-weak ppg', (s) => s.competitiveness.strengthGapPpg),
  row('deep-shallow ppg', (s) => s.depth.depthGapPpg),
  row('subs/match', (s) => s.substitutions.perMatch),
  row('bench used', (s) => s.bench.utilisation),
  row('ATT cover/bench', (s) => s.bench.lineCover.ATT),
  row('DEF cover/bench', (s) => s.bench.lineCover.DEF),
  row('utility seats', (s) => s.bench.utilitySeatsPerBench),
  row('late goal share', (s) => s.lateMatch.lateGoalShare),
  row('matches changed vs A', (s) => {
    const key = Object.keys(summaries).find((k) => summaries[k] === s);
    return key && divergence[key] ? `${divergence[key].matchesChanged} (${(divergence[key].share * 100).toFixed(1)}%)` : '-';
  }),
  row('winner changed vs A', (s) => {
    const key = Object.keys(summaries).find((k) => summaries[k] === s);
    return key && divergence[key] ? `${divergence[key].winnerChanged} (${(divergence[key].winnerShare * 100).toFixed(1)}%)` : '-';
  }),
];
table(rows);

const md = [
  '# Matchday bench balance experiment',
  '',
  `Commit \`${commit}\`${dirtyTree ? ' (working tree had uncommitted changes)' : ''}`
  + ` · ${WORLDS} worlds × 1 season × ${CONFIGURATIONS.length} configurations`,
  `· ${(summaries[CONFIGURATIONS[0]!.key] as ReturnType<typeof summarise>).matches} matches per configuration`,
  `· runtime ${(runtimeMs / 1000).toFixed(0)} s.`,
  '',
  'Everything except the selector constants is held identical: the same seeds,',
  'clubs, squads, fixtures, match configuration, opponent adaptation, injuries',
  'and economy. Raw numbers are in `results.json`.',
  '',
  '| Metric | ' + CONFIGURATIONS.map((c) => c.label).join(' | ') + ' |',
  '|---|' + CONFIGURATIONS.map(() => '---').join('|') + '|',
  ...rows.map((r) => `| ${r.metric} | ${CONFIGURATIONS.map((c) => r[c.key.slice(0, 1)]).join(' | ')} |`),
  '',
  '## How the selector itself responds',
  '',
  'Every real squad against every shape the game offers, with no match played.',
  '',
  '| Question | Answer |',
  '|---|---|',
  `| benches changed by cover 0.60 vs 0.70 | ${response.coverThreshold.changed06vs07} |`,
  `| benches changed by cover 0.70 vs 0.80 | ${response.coverThreshold.changed07vs08} |`,
  `| benches changed by lean 0 vs 0.12 | ${response.tacticalLean.changed0vs012} |`,
  `| benches changed by lean 0.12 vs 0.20 | ${response.tacticalLean.changed012vs02} |`,
  `| shapes the lean can reach | ${Object.keys(response.tacticalLean.shapesAffected).join(', ') || 'none'} |`,
  `| distinct benches across the ten seven-a-side shapes | ${response.startingElevenDependence.distinctBenchesAcrossShapes} |`,
  `| bench turnover when one starter is unavailable | ${response.startingElevenDependence.benchTurnoverWhenOneStarterOut} |`,
  `| seats held by a two-line utility player | ${response.utility.utilitySeatShare} |`,
  `| bench mean overall vs best seven reserves | ${response.utility.benchMeanOverall} vs ${response.utility.bestSevenMeanOverall} |`,
  `| rating forgone to buy cover | ${response.utility.qualityForgoneForCover} |`,
  '',
].join('\n');
writeFileSync(`${OUT_DIR}/summary.md`, md);

note(`\n  wrote ${OUT_DIR}/results.json and ${OUT_DIR}/summary.md in ${(runtimeMs / 1000).toFixed(0)} s`);
