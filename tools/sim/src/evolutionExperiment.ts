/**
 * How often should a club change its shape?
 *
 * Formation is chosen when the world is made and was then frozen for the life
 * of the save, while the squad underneath it moved: 11-23% turnover a year,
 * retirements, academy graduates, recruitment biased toward a profile's
 * favoured positions. Measured over six seasons, the shape a club was given
 * falls 1.7% behind the shape it should now play in season one and 3.2% by
 * season six, and by then 83% of clubs would be better off somewhere else.
 *
 * That is an argument for reassessing, not for reassessing greedily. Picking
 * the best shape every summer would move most of the league every year, which
 * is a club with no memory rather than a club that has evolved. This harness
 * measures where the line sits, over whole careers, changing only the threshold
 * a club's current shape must fall behind before it is replaced.
 *
 * Everything drives the real `reviewFormation` through the engine's own
 * `formationEvolution` option, which defaults to the production rule.
 *
 * Usage: tsx src/evolutionExperiment.ts [worlds] [seasons] [outDir]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  Ledger, advanceCycle, autoLineup, familiarity, formationById, formationsFor,
  formationSuitability, selectMatchdayBench, shapeAffinity, squadOf,
  type ClubId, type CreatorSeasonConfigDef, type Formation, type FormationReviewOptions,
  type GameState, type MatchResult, type Player,
} from '@cf/engine';
import { EPOCH, CYCLE_MS, registry, startGame, progress } from './harness';
import { heading, note, table } from './report';

interface Candidate {
  readonly key: string;
  readonly label: string;
  readonly evolution: FormationReviewOptions & { enabled?: boolean };
}

/**
 * The control is the world as it shipped. B is the diagnostic: reassess with no
 * stability preference at all, which is expected to churn and is measured so
 * the churn is a number rather than an assumption. C, D and E bracket the
 * candidate threshold; C sits exactly on the selector's own suitability band,
 * which is the smallest value the rule can coherently take.
 */
const CANDIDATES: readonly Candidate[] = [
  { key: 'A_frozen', label: 'A frozen (shipped)', evolution: { enabled: false } },
  { key: 'B_greedy', label: 'B greedy (no guard)', evolution: { changeThreshold: 0, band: 0 } },
  { key: 'C_band', label: 'C threshold 0.06', evolution: { changeThreshold: 0.06 } },
  { key: 'D_moderate', label: 'D threshold 0.08', evolution: { changeThreshold: 0.08 } },
  { key: 'E_patient', label: 'E threshold 0.12', evolution: { changeThreshold: 0.12 } },
];

const WORLDS = Number(process.argv[2] ?? 12);
const SEASONS = Number(process.argv[3] ?? 6);
const OUT_DIR = process.argv[4] ?? 'docs/experiments/formation-evolution';
const SEEDS = Array.from({ length: WORLDS }, (_, i) => `evolution-exp-${String(i).padStart(3, '0')}`);

const sum = (v: readonly number[]): number => v.reduce((a, b) => a + b, 0);
const mean = (v: readonly number[]): number => (v.length ? sum(v) / v.length : 0);
const sd = (v: readonly number[]): number => {
  if (v.length < 2) return 0;
  const m = mean(v);
  return Math.sqrt(sum(v.map((x) => (x - m) ** 2)) / (v.length - 1));
};
const round = (x: number, dp = 3): number => Number(x.toFixed(dp));
const share = (n: number, total: number): number => (total ? n / total : 0);
const hash = (v: unknown): string => createHash('sha256').update(JSON.stringify(v)).digest('hex').slice(0, 16);
const entropy = (counts: Readonly<Record<string, number>>): number => {
  const total = sum(Object.values(counts));
  if (total === 0) return 0;
  let h = 0;
  for (const c of Object.values(counts)) { if (c > 0) { const p = c / total; h -= p * Math.log2(p); } }
  return h;
};

const LINES = ['DEF', 'MID', 'ATT'] as const;

interface Totals {
  /** One entry per club per world: the shape it played in each season. */
  histories: string[][];
  finalShapes: Record<string, number>;
  finalClasses: Record<string, number>;
  shortfallBySeason: number[][];
  identityMatched: number; clubsMeasured: number;
  outOfPosition: number[];
  benchLineGaps: number; benchLinesRequired: number; benchNoKeeper: number; benchesMeasured: number;
  goals: number[]; matches: number; draws: number;
  pointsSd: number[]; ppgByTier: Record<string, number[]>;
  rolloverMs: number; rollovers: number;
  resultLines: string[];
}

const emptyTotals = (): Totals => ({
  histories: [], finalShapes: {}, finalClasses: {}, shortfallBySeason: [],
  identityMatched: 0, clubsMeasured: 0, outOfPosition: [],
  benchLineGaps: 0, benchLinesRequired: 0, benchNoKeeper: 0, benchesMeasured: 0,
  goals: [], matches: 0, draws: 0, pointsSd: [], ppgByTier: { strong: [], middle: [], weak: [] },
  rolloverMs: 0, rollovers: 0, resultLines: [],
});

const coversLine = (p: Player, formation: Formation, line: (typeof LINES)[number]): boolean =>
  formation.slots.filter((sl) => sl.role === line).some((sl) => Math.min(1,
    familiarity(p.position, sl.position) + (p.secondaryPositions.includes(sl.position) ? 0.12 : 0)) >= 0.7);

/** Measure a world at the end of a season: shapes, fit, benches. */
function measureState(state: GameState, t: Totals, shapes: readonly Formation[], config: CreatorSeasonConfigDef, season: number, final: boolean): void {
  for (const id of Object.keys(state.clubs)) {
    const club = state.clubs[id as ClubId];
    if (!club) continue;
    const squad = squadOf(state, id as ClubId);
    const formation = formationById(club.tactics.formationId);
    const best = Math.max(...shapes.map((f) => formationSuitability(squad, f)));
    const here = formationSuitability(squad, formation);
    (t.shortfallBySeason[season] ??= []).push(best > 0 ? (best - here) / best : 0);
    if (!final) continue;

    t.finalShapes[formation.id] = (t.finalShapes[formation.id] ?? 0) + 1;
    t.finalClasses[formation.shape] = (t.finalClasses[formation.shape] ?? 0) + 1;
    t.clubsMeasured += 1;
    const affinity = shapeAffinity(club.tactics);
    const wanted = (Object.entries(affinity).sort((a, b) => b[1] - a[1])[0] ?? ['BALANCED'])[0];
    if (formation.shape === wanted) t.identityMatched += 1;

    const auto = autoLineup(squad, formation);
    const byId = new Map(squad.map((p) => [p.id as string, p]));
    let out = 0;
    const starters: { slot: (typeof formation.slots)[number]; player: Player }[] = [];
    for (const slot of formation.slots) {
      const pid = auto.lineup[slot.id];
      const player = pid ? byId.get(pid as string) : undefined;
      if (!player) continue;
      starters.push({ slot, player });
      if (player.position !== slot.position && !player.secondaryPositions.includes(slot.position)) out += 1;
    }
    t.outOfPosition.push(out);

    const bench = selectMatchdayBench(squad, starters, formation, { size: config.benchSize, risk: club.tactics.risk });
    t.benchesMeasured += 1;
    if (!bench.some((seat) => seat.player.position === 'GK')) t.benchNoKeeper += 1;
    const covered = new Set(bench.map((seat) => seat.role));
    const ROLE_FOR = { DEF: 'DEFENSIVE_COVER', MID: 'MIDFIELD_COVER', ATT: 'ATTACKING_COVER' } as const;
    for (const line of LINES) {
      if (!formation.slots.some((sl) => sl.role === line)) continue;
      t.benchLinesRequired += 1;
      if (!covered.has(ROLE_FOR[line])) t.benchLineGaps += 1;
    }
    void coversLine;
  }
}

function playCareer(seed: string, candidate: Candidate, t: Totals, shapes: readonly Formation[], config: CreatorSeasonConfigDef): void {
  const reg = registry();
  let state: GameState = startGame(seed);
  const ids = Object.keys(state.clubs);
  const strength = new Map(ids.map((id) => [id, mean(squadOf(state, id as ClubId).map((p) => p.overall))]));
  const byStrength = [...ids].sort((a, b) => (strength.get(a) ?? 0) - (strength.get(b) ?? 0));
  const third = Math.floor(byStrength.length / 3);
  const tierOf = (id: string): 'weak' | 'middle' | 'strong' => {
    const i = byStrength.indexOf(id);
    return i < third ? 'weak' : i >= byStrength.length - third ? 'strong' : 'middle';
  };

  const history = new Map<string, string[]>(ids.map((id) => [id, [state.clubs[id as ClubId]!.tactics.formationId]]));
  // Points are tallied per season and reset, so the spread reported is a
  // league table's spread rather than a career's.
  let points = new Map<string, number>(ids.map((id) => [id, 0]));
  let played = new Map<string, number>(ids.map((id) => [id, 0]));
  let cycle = 0;

  for (let season = 0; season < SEASONS; season++) {
    const weeks = state.seasons[state.currentSeasonId]?.totalWeeks ?? 22;
    for (let w = 0; w < weeks; w++) {
      const rollingOver = w === weeks - 1;
      const t0 = rollingOver ? Date.now() : 0;
      const outcome = advanceCycle(state, {
        now: EPOCH + cycle * CYCLE_MS, registry: reg, ledger: Ledger.restore(state.ledger),
        formationEvolution: candidate.evolution,
      });
      if (rollingOver) { t.rolloverMs += Date.now() - t0; t.rollovers += 1; }
      state = outcome.state;
      cycle += 1;
      for (const r of outcome.results as readonly MatchResult[]) {
        t.matches += 1;
        t.goals.push(r.homeScore + r.awayScore);
        if (r.homeScore === r.awayScore) t.draws += 1;
        t.resultLines.push(`${r.matchId} ${r.homeScore}-${r.awayScore}`);
        const h = r.homeClubId as string; const a = r.awayClubId as string;
        played.set(h, (played.get(h) ?? 0) + 1); played.set(a, (played.get(a) ?? 0) + 1);
        if (r.homeScore > r.awayScore) points.set(h, (points.get(h) ?? 0) + 3);
        else if (r.awayScore > r.homeScore) points.set(a, (points.get(a) ?? 0) + 3);
        else { points.set(h, (points.get(h) ?? 0) + 1); points.set(a, (points.get(a) ?? 0) + 1); }
      }
    }
    for (const id of ids) history.get(id)?.push(state.clubs[id as ClubId]?.tactics.formationId ?? '?');
    measureState(state, t, shapes, config, season, season === SEASONS - 1);

    const seasonPoints: number[] = [];
    for (const id of ids) {
      const g = played.get(id) ?? 0;
      if (g === 0) continue;
      seasonPoints.push(points.get(id) ?? 0);
      t.ppgByTier[tierOf(id)]!.push((points.get(id) ?? 0) / g);
    }
    t.pointsSd.push(sd(seasonPoints));
    points = new Map<string, number>(ids.map((id) => [id, 0]));
    played = new Map<string, number>(ids.map((id) => [id, 0]));
  }

  for (const line of history.values()) t.histories.push(line);
}

function summarise(t: Totals) {
  const changesPerClub = t.histories.map((line) => {
    let c = 0;
    for (let i = 1; i < line.length; i++) if (line[i] !== line[i - 1]) c += 1;
    return c;
  });
  // A -> B -> A inside three consecutive seasons: the churn signature.
  const reversals = t.histories.map((line) => {
    let r = 0;
    for (let i = 2; i < line.length; i++) if (line[i] === line[i - 2] && line[i] !== line[i - 1]) r += 1;
    return r;
  });
  const clubs = Math.max(1, t.histories.length);
  const seasonsWithRollover = Math.max(1, (t.histories[0]?.length ?? 1) - 1);
  const finalShortfall = t.shortfallBySeason[t.shortfallBySeason.length - 1] ?? [];
  const firstShortfall = t.shortfallBySeason[0] ?? [];
  const q90 = (v: readonly number[]) => {
    const s = [...v].sort((a, b) => a - b);
    return s[Math.min(s.length - 1, Math.floor(s.length * 0.9))] ?? 0;
  };
  return {
    stability: {
      changesPerClub: round(mean(changesPerClub), 3),
      changesPerClubPerSeason: round(mean(changesPerClub) / seasonsWithRollover, 4),
      neverChanged: round(share(changesPerClub.filter((c) => c === 0).length, clubs)),
      changedOnce: round(share(changesPerClub.filter((c) => c === 1).length, clubs)),
      changedTwicePlus: round(share(changesPerClub.filter((c) => c >= 2).length, clubs)),
      reversalsPerClub: round(mean(reversals), 4),
      clubsWithAnyReversal: round(share(reversals.filter((r) => r > 0).length, clubs)),
      clubsMeasured: clubs,
    },
    fit: {
      shortfallSeason1: round(mean(firstShortfall), 4),
      shortfallFinal: round(mean(finalShortfall), 4),
      shortfallFinalP90: round(q90(finalShortfall), 4),
      shortfallFinalMax: round(Math.max(0, ...finalShortfall), 4),
      outOfPositionStarters: round(mean(t.outOfPosition), 3),
    },
    identity: { shapeMatchesIdentity: round(share(t.identityMatched, t.clubsMeasured)) },
    diversity: {
      shapesUsed: Object.keys(t.finalShapes).length,
      dominantShare: round(share(Math.max(0, ...Object.values(t.finalShapes)), t.clubsMeasured)),
      entropyBits: round(entropy(t.finalShapes), 3),
      distribution: Object.fromEntries(Object.entries(t.finalShapes).sort((a, b) => b[1] - a[1])),
      classes: t.finalClasses,
    },
    bench: {
      lineCoverGapShare: round(share(t.benchLineGaps, t.benchLinesRequired), 4),
      noKeeperShare: round(share(t.benchNoKeeper, t.benchesMeasured), 4),
    },
    league: {
      matches: t.matches,
      goalsPerMatch: round(mean(t.goals), 3),
      drawShare: round(share(t.draws, t.matches)),
      seasonPointsSd: round(mean(t.pointsSd), 3),
      strongPpg: round(mean(t.ppgByTier.strong ?? []), 3),
      middlePpg: round(mean(t.ppgByTier.middle ?? []), 3),
      weakPpg: round(mean(t.ppgByTier.weak ?? []), 3),
      strongWeakGap: round(mean(t.ppgByTier.strong ?? []) - mean(t.ppgByTier.weak ?? []), 3),
    },
    performance: { rolloverMsMean: round(t.rolloverMs / Math.max(1, t.rollovers), 2), rollovers: t.rollovers },
    resultsHash: hash(t.resultLines),
  };
}

heading('CREATOR FOOTBALL — SEASONAL FORMATION EVOLUTION EXPERIMENT');
note(`  ${CANDIDATES.length} candidates x ${WORLDS} worlds x ${SEASONS} seasons.`);
note('  Same seeds and same worlds throughout; only the threshold a shape must fall behind moves.\n');

const commit = (() => { try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); } catch { return 'unknown'; } })();
const dirtyTree = (() => { try { return execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0; } catch { return true; } })();

const config = registry().seasonConfig() as CreatorSeasonConfigDef;
const shapes = formationsFor(config.playersOnPitch);
const started = Date.now();
const summaries: Record<string, ReturnType<typeof summarise>> = {};

for (const candidate of CANDIDATES) {
  const totals = emptyTotals();
  for (let i = 0; i < SEEDS.length; i++) {
    playCareer(SEEDS[i] as string, candidate, totals, shapes, config);
    progress(candidate.key, i + 1, SEEDS.length);
  }
  summaries[candidate.key] = summarise(totals);
  const s = summaries[candidate.key] as ReturnType<typeof summarise>;
  note(`  ${candidate.label}: ${s.stability.changesPerClub} changes/club, `
    + `${s.stability.reversalsPerClub} reversals/club, shortfall ${s.fit.shortfallFinal}, hash ${s.resultsHash}`);
}

const runtimeMs = Date.now() - started;
const report = {
  experiment: 'seasonal-formation-evolution',
  commit, dirtyTree,
  generatedFrom: { worlds: WORLDS, seasons: SEASONS, seeds: SEEDS },
  candidates: CANDIDATES.map((c) => ({ key: c.key, label: c.label, evolution: c.evolution })),
  runtimeMs,
  summaries,
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/results.json`, `${JSON.stringify(report, null, 2)}\n`);

const row = (label: string, get: (s: ReturnType<typeof summarise>) => string | number) => {
  const out: Record<string, string | number> = { metric: label };
  for (const c of CANDIDATES) out[c.key.slice(0, 1)] = get(summaries[c.key] as ReturnType<typeof summarise>);
  return out;
};
const rows = [
  row('changes/club', (s) => s.stability.changesPerClub),
  row('changes/club/season', (s) => s.stability.changesPerClubPerSeason),
  row('never changed', (s) => s.stability.neverChanged),
  row('changed once', (s) => s.stability.changedOnce),
  row('changed 2+', (s) => s.stability.changedTwicePlus),
  row('reversals/club', (s) => s.stability.reversalsPerClub),
  row('clubs w/ reversal', (s) => s.stability.clubsWithAnyReversal),
  row('shortfall final', (s) => s.fit.shortfallFinal),
  row('shortfall p90', (s) => s.fit.shortfallFinalP90),
  row('out-of-position XI', (s) => s.fit.outOfPositionStarters),
  row('fits identity', (s) => s.identity.shapeMatchesIdentity),
  row('shapes used', (s) => s.diversity.shapesUsed),
  row('dominant share', (s) => s.diversity.dominantShare),
  row('entropy (bits)', (s) => s.diversity.entropyBits),
  row('bench line gaps', (s) => s.bench.lineCoverGapShare),
  row('season points sd', (s) => s.league.seasonPointsSd),
  row('weak ppg', (s) => s.league.weakPpg),
  row('strong-weak gap', (s) => s.league.strongWeakGap),
  row('rollover ms', (s) => s.performance.rolloverMsMean),
];
table(rows);

const md = [
  '# Seasonal formation evolution experiment',
  '',
  `Commit \`${commit}\`${dirtyTree ? ' (working tree had uncommitted changes)' : ''}`
  + ` · ${WORLDS} worlds × ${SEASONS} seasons × ${CANDIDATES.length} candidates`
  + ` · ${(summaries[CANDIDATES[0]!.key] as ReturnType<typeof summarise>).league.matches} matches each`
  + ` · runtime ${(runtimeMs / 1000).toFixed(0)} s.`,
  '',
  'The same seeds generate the same worlds in every candidate; only the threshold',
  "a club's current shape must fall behind before it is replaced differs.",
  'Raw numbers are in `results.json`.',
  '',
  '| Metric | ' + CANDIDATES.map((c) => c.label).join(' | ') + ' |',
  '|---|' + CANDIDATES.map(() => '---').join('|') + '|',
  ...rows.map((r) => `| ${r.metric} | ${CANDIDATES.map((c) => r[c.key.slice(0, 1)]).join(' | ')} |`),
  '',
  '## Final-season shape distribution',
  '',
  ...CANDIDATES.map((c) => {
    const d = (summaries[c.key] as ReturnType<typeof summarise>).diversity.distribution;
    return `- **${c.label}**: ${Object.entries(d).map(([k, v]) => `${k} ${v}`).join(', ')}`;
  }),
  '',
].join('\n');
writeFileSync(`${OUT_DIR}/summary.md`, md);
note(`\n  wrote ${OUT_DIR}/results.json and ${OUT_DIR}/summary.md in ${(runtimeMs / 1000).toFixed(0)} s`);
