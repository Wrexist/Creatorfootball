/**
 * Does giving AI clubs their own shape make a better league, or only a noisier one?
 *
 * Every club in a generated league used to walk out in 2-3-1: `newGame` wrote
 * `DEFAULT_FORMATION_ID` into all twelve and nothing reconsidered. That is the
 * whole cause — not squad composition, not scoring, not a shortage of shapes.
 * This harness proves that, then measures what changes when the shape follows
 * the squad and the club's own tactics instead.
 *
 * Candidates are configured through the real `selectFormation`, so the
 * experiment drives production code rather than a copy of it. The control
 * reproduces the old behaviour exactly by handing the selector a single
 * candidate.
 *
 * Usage: tsx src/formationExperiment.ts [worlds] [outDir]
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { execSync } from 'node:child_process';
import {
  Ledger, advanceCycle, autoLineup, createNewGame, formationById, formationsFor,
  formationSuitability, selectFormation, selectMatchdayBench, shapeAffinity, squadOf,
  type ClubId, type CreatorSeasonConfigDef, type Formation, type GameState,
  type MatchResult, type Player, type TacticSetup,
} from '@cf/engine';
import { EPOCH, CYCLE_MS, registry, progress } from './harness';
import { heading, note, table } from './report';

interface Candidate {
  readonly key: string;
  readonly label: string;
  /** Null means "leave the club on the shape the world generated". */
  readonly choose: ((squad: readonly Player[], tactics: TacticSetup, shapes: readonly Formation[]) => Formation) | null;
}

/**
 * Four candidates. The control is the old world; A is squad suitability with no
 * identity at all; B is the shipped hierarchy; C turns identity up far enough
 * to fight squad suitability, which is the failure mode worth measuring rather
 * than assuming.
 */
const CANDIDATES: readonly Candidate[] = [
  { key: 'control', label: 'control (every club 2-3-1)', choose: null },
  {
    key: 'A_squad_only', label: 'A squad suitability only',
    choose: (squad, _t, shapes) => selectFormation(squad, NEUTRAL, shapes, { band: 0, identityWeight: 0 }),
  },
  {
    key: 'B_identity', label: 'B squad + identity (0.06 / 0.04)',
    choose: (squad, tactics, shapes) => selectFormation(squad, tactics, shapes, { band: 0.06, identityWeight: 0.04 }),
  },
  {
    key: 'C_identity_led', label: 'C identity-led (0.20 / 0.20)',
    choose: (squad, tactics, shapes) => selectFormation(squad, tactics, shapes, { band: 0.2, identityWeight: 0.2 }),
  },
];

/** A club with no lean at all, for the suitability-only candidate. */
const NEUTRAL = {
  press: 'BALANCED', line: 'NORMAL', risk: 'MEASURED', tempo: 'BALANCED',
  width: 'BALANCED', focus: 'BALANCED', passing: 'MIXED', counter: 'WHEN_ON', buildUp: 'BALANCED',
} as const;

const WORLDS = Number(process.argv[2] ?? 24);
const OUT_DIR = process.argv[3] ?? 'docs/experiments/formation-identity';
const SEEDS = Array.from({ length: WORLDS }, (_, i) => `formation-exp-${String(i).padStart(3, '0')}`);

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

/** Shannon entropy over a distribution, in bits: 0 = one shape, log2(n) = even. */
function entropy(counts: Readonly<Record<string, number>>): number {
  const total = sum(Object.values(counts));
  if (total === 0) return 0;
  let h = 0;
  for (const c of Object.values(counts)) {
    if (c <= 0) continue;
    const p = c / total;
    h -= p * Math.log2(p);
  }
  return h;
}

const startWorld = (seed: string): GameState => createNewGame({
  registry: registry(), seed, now: EPOCH,
  manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
  club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
});

/** Re-shape a generated world under a candidate, changing nothing else. */
function applyCandidate(state: GameState, candidate: Candidate, shapes: readonly Formation[]): GameState {
  if (!candidate.choose) {
    const clubs: Record<string, GameState['clubs'][string]> = {};
    for (const [id, club] of Object.entries(state.clubs)) {
      clubs[id] = { ...club, tactics: { ...club.tactics, formationId: '2-3-1' } };
    }
    return { ...state, clubs };
  }
  const clubs: Record<string, GameState['clubs'][string]> = {};
  for (const [id, club] of Object.entries(state.clubs)) {
    const squad = squadOf(state, id as ClubId);
    const chosen = candidate.choose(squad, club.tactics, shapes);
    clubs[id] = { ...club, tactics: { ...club.tactics, formationId: chosen.id } };
  }
  return { ...state, clubs };
}

interface Totals {
  formations: Record<string, number>;
  shapeClasses: Record<string, number>;
  formationByTier: Record<string, Record<string, number>>;
  identityMatched: number; clubsMeasured: number;
  byPhilosophy: Record<string, Record<string, number>>;
  suitabilityLoss: number[];
  outOfPositionStarters: number[];
  benchSeats: number[]; benchNoKeeper: number; benchesMeasured: number;
  benchLineGaps: number; benchLinesRequired: number;
  goals: number[]; margins: number[]; draws: number; matches: number;
  pointsSd: number[]; championPoints: number[];
  ppgByTier: Record<string, number[]>;
  subs: number[];
  resultLines: string[];
  attackShare: number[]; defenceShare: number[];
}

const emptyTotals = (): Totals => ({
  formations: {}, shapeClasses: {}, formationByTier: { strong: {}, middle: {}, weak: {} },
  identityMatched: 0, clubsMeasured: 0, byPhilosophy: {}, suitabilityLoss: [], outOfPositionStarters: [],
  benchSeats: [], benchNoKeeper: 0, benchesMeasured: 0, benchLineGaps: 0, benchLinesRequired: 0,
  goals: [], margins: [], draws: 0, matches: 0, pointsSd: [], championPoints: [],
  ppgByTier: { strong: [], middle: [], weak: [] }, subs: [], resultLines: [],
  attackShare: [], defenceShare: [],
});

function measureWorld(state: GameState, t: Totals, shapes: readonly Formation[]): void {
  const reg = registry();
  const config = reg.seasonConfig() as CreatorSeasonConfigDef;
  const ids = Object.keys(state.clubs);
  const strength = new Map<string, number>();
  for (const id of ids) {
    strength.set(id, mean(squadOf(state, id as ClubId).map((p) => p.overall)));
  }
  const byStrength = [...ids].sort((a, b) => (strength.get(a) ?? 0) - (strength.get(b) ?? 0));
  const third = Math.floor(byStrength.length / 3);
  const tierOf = (id: string): 'weak' | 'middle' | 'strong' => {
    const i = byStrength.indexOf(id);
    return i < third ? 'weak' : i >= byStrength.length - third ? 'strong' : 'middle';
  };

  for (const id of ids) {
    const club = state.clubs[id as ClubId];
    if (!club) continue;
    const squad = squadOf(state, id as ClubId);
    const formation = formationById(club.tactics.formationId);
    t.formations[formation.id] = (t.formations[formation.id] ?? 0) + 1;
    t.shapeClasses[formation.shape] = (t.shapeClasses[formation.shape] ?? 0) + 1;
    const tier = tierOf(id);
    t.formationByTier[tier]![formation.id] = (t.formationByTier[tier]![formation.id] ?? 0) + 1;
    t.clubsMeasured += 1;

    // Does the shape actually match what the club's tactics want?
    const affinity = shapeAffinity(club.tactics);
    const bestClass = (Object.entries(affinity).sort((a, b) => b[1] - a[1])[0] ?? ['BALANCED'])[0];
    if (formation.shape === bestClass) t.identityMatched += 1;
    const perPhilosophy = (t.byPhilosophy[club.philosophy] ??= {});
    perPhilosophy[formation.shape] = (perPhilosophy[formation.shape] ?? 0) + 1;

    // What did playing this shape cost, against the shape the squad suits best?
    const best = Math.max(...shapes.map((f) => formationSuitability(squad, f)));
    const here = formationSuitability(squad, formation);
    t.suitabilityLoss.push(best > 0 ? (best - here) / best : 0);

    // Starters asked to play somewhere they are not at home.
    const auto = autoLineup(squad, formation);
    const byId = new Map(squad.map((p) => [p.id as string, p]));
    let outOfPosition = 0;
    const starters: { slot: (typeof formation.slots)[number]; player: Player }[] = [];
    for (const slot of formation.slots) {
      const pid = auto.lineup[slot.id];
      const player = pid ? byId.get(pid as string) : undefined;
      if (!player) continue;
      starters.push({ slot, player });
      if (player.position !== slot.position && !player.secondaryPositions.includes(slot.position)) {
        outOfPosition += 1;
      }
    }
    t.outOfPositionStarters.push(outOfPosition);

    // The real bench selector, on the shape actually chosen.
    const bench = selectMatchdayBench(squad, starters, formation, { size: config.benchSize, risk: club.tactics.risk });
    t.benchesMeasured += 1;
    t.benchSeats.push(bench.length);
    if (!bench.some((seat) => seat.player.position === 'GK')) t.benchNoKeeper += 1;
    // A gap only counts for a line the shape actually fields: 2-4 has no
    // attacking slot, so "no attacking cover" there is arithmetic, not a hole.
    const covered = new Set(bench.map((seat) => seat.role));
    const ROLE_FOR = { DEF: 'DEFENSIVE_COVER', MID: 'MIDFIELD_COVER', ATT: 'ATTACKING_COVER' } as const;
    for (const line of ['DEF', 'MID', 'ATT'] as const) {
      if (!formation.slots.some((sl) => sl.role === line)) continue;
      t.benchLinesRequired += 1;
      if (!covered.has(ROLE_FOR[line])) t.benchLineGaps += 1;
    }

    // Shape of the side itself, as the match model reads it.
    const outfield = formation.slots.filter((s) => s.role !== 'GK').length;
    t.attackShare.push(formation.slots.filter((s) => s.role === 'ATT').length / outfield);
    t.defenceShare.push(formation.slots.filter((s) => s.role === 'DEF').length / outfield);
  }

  // A full season, so the shapes have to survive real football.
  let current = state;
  const points = new Map<string, number>();
  const played = new Map<string, number>();
  for (const id of ids) { points.set(id, 0); played.set(id, 0); }
  const weeks = state.seasons[state.currentSeasonId]?.totalWeeks ?? 22;
  for (let w = 0; w < weeks; w++) {
    const outcome = advanceCycle(current, {
      now: EPOCH + w * CYCLE_MS, registry: reg, ledger: Ledger.restore(current.ledger),
    });
    current = outcome.state;
    for (const r of outcome.results as readonly MatchResult[]) {
      t.matches += 1;
      t.goals.push(r.homeScore + r.awayScore);
      t.margins.push(Math.abs(r.homeScore - r.awayScore));
      if (r.homeScore === r.awayScore) t.draws += 1;
      t.subs.push(r.events.filter((e) => e.type === 'SUBSTITUTION').length);
      t.resultLines.push(`${r.matchId} ${r.homeScore}-${r.awayScore}`);
      const h = r.homeClubId as string; const a = r.awayClubId as string;
      played.set(h, (played.get(h) ?? 0) + 1);
      played.set(a, (played.get(a) ?? 0) + 1);
      if (r.homeScore > r.awayScore) points.set(h, (points.get(h) ?? 0) + 3);
      else if (r.awayScore > r.homeScore) points.set(a, (points.get(a) ?? 0) + 3);
      else { points.set(h, (points.get(h) ?? 0) + 1); points.set(a, (points.get(a) ?? 0) + 1); }
    }
  }
  const seasonPoints: number[] = [];
  for (const id of ids) {
    const p = points.get(id) ?? 0;
    const g = played.get(id) ?? 0;
    if (g === 0) continue;
    seasonPoints.push(p);
    t.ppgByTier[tierOf(id)]!.push(p / g);
  }
  t.pointsSd.push(sd(seasonPoints));
  t.championPoints.push(seasonPoints.length ? Math.max(...seasonPoints) : 0);
}

function summarise(t: Totals) {
  const used = Object.keys(t.formations).length;
  const dominant = Math.max(0, ...Object.values(t.formations));
  return {
    formation: {
      distribution: Object.fromEntries(Object.entries(t.formations).sort((a, b) => b[1] - a[1])),
      shapeClasses: t.shapeClasses,
      formationsUsed: used,
      dominantShare: round(share(dominant, t.clubsMeasured)),
      entropyBits: round(entropy(t.formations), 3),
      byTier: t.formationByTier,
    },
    identity: {
      shapeMatchesIdentity: round(share(t.identityMatched, t.clubsMeasured)),
      shapeClassByPhilosophy: t.byPhilosophy,
      clubsMeasured: t.clubsMeasured,
    },
    squad: {
      meanSuitabilityLoss: round(mean(t.suitabilityLoss), 4),
      maxSuitabilityLoss: round(Math.max(0, ...t.suitabilityLoss), 4),
      outOfPositionStartersPerClub: round(mean(t.outOfPositionStarters), 3),
    },
    bench: {
      seatsPerBench: round(mean(t.benchSeats), 3),
      noKeeperShare: round(share(t.benchNoKeeper, t.benchesMeasured)),
      lineCoverGapShare: round(share(t.benchLineGaps, t.benchLinesRequired), 4),
    },
    league: {
      matches: t.matches,
      goalsPerMatch: round(mean(t.goals), 3),
      goalSd: round(sd(t.goals), 3),
      marginMean: round(mean(t.margins), 3),
      bigMarginShare: round(share(t.margins.filter((m) => m >= 4).length, t.margins.length)),
      drawShare: round(share(t.draws, t.matches)),
      seasonPointsSd: round(mean(t.pointsSd), 3),
      championPoints: round(mean(t.championPoints), 2),
      subsPerMatch: round(mean(t.subs), 3),
    },
    tiers: {
      strongPpg: round(mean(t.ppgByTier.strong ?? []), 3),
      middlePpg: round(mean(t.ppgByTier.middle ?? []), 3),
      weakPpg: round(mean(t.ppgByTier.weak ?? []), 3),
      strongWeakGap: round(mean(t.ppgByTier.strong ?? []) - mean(t.ppgByTier.weak ?? []), 3),
    },
    structure: {
      meanAttackShare: round(mean(t.attackShare), 3),
      meanDefenceShare: round(mean(t.defenceShare), 3),
      attackShareSd: round(sd(t.attackShare), 3),
      defenceShareSd: round(sd(t.defenceShare), 3),
    },
    resultsHash: hash(t.resultLines),
  };
}

heading('CREATOR FOOTBALL — AI FORMATION IDENTITY EXPERIMENT');
note(`  ${CANDIDATES.length} candidates x ${WORLDS} worlds x 1 season.`);
note('  Same seeds, clubs, squads and fixtures throughout; only the shape each club plays moves.\n');

const commit = (() => {
  try { return execSync('git rev-parse HEAD', { encoding: 'utf8' }).trim(); }
  catch { return 'unknown'; }
})();
const dirtyTree = (() => {
  try { return execSync('git status --porcelain', { encoding: 'utf8' }).trim().length > 0; }
  catch { return true; }
})();

const config = registry().seasonConfig() as CreatorSeasonConfigDef;
const shapes = formationsFor(config.playersOnPitch);
const started = Date.now();
const summaries: Record<string, ReturnType<typeof summarise>> = {};
let generationMs = 0;

for (const candidate of CANDIDATES) {
  const totals = emptyTotals();
  for (let i = 0; i < SEEDS.length; i++) {
    const t0 = Date.now();
    const base = startWorld(SEEDS[i] as string);
    generationMs += Date.now() - t0;
    measureWorld(applyCandidate(base, candidate, shapes), totals, shapes);
    progress(candidate.key, i + 1, SEEDS.length);
  }
  summaries[candidate.key] = summarise(totals);
  note(`  ${candidate.label}: ${summaries[candidate.key]?.formation.formationsUsed} shapes, `
    + `dominant ${summaries[candidate.key]?.formation.dominantShare}, hash ${summaries[candidate.key]?.resultsHash}`);
}

const runtimeMs = Date.now() - started;
const report = {
  experiment: 'ai-formation-identity',
  commit, dirtyTree,
  generatedFrom: { worlds: WORLDS, seasonsPerWorld: 1, seeds: SEEDS },
  candidates: CANDIDATES.map((c) => ({ key: c.key, label: c.label })),
  runtimeMs,
  worldGenerationMsPerWorld: round(generationMs / Math.max(1, WORLDS * CANDIDATES.length), 2),
  summaries,
};
mkdirSync(OUT_DIR, { recursive: true });
writeFileSync(`${OUT_DIR}/results.json`, `${JSON.stringify(report, null, 2)}\n`);

const row = (label: string, get: (s: ReturnType<typeof summarise>) => string | number) => {
  const out: Record<string, string | number> = { metric: label };
  for (const c of CANDIDATES) out[c.key] = get(summaries[c.key] as ReturnType<typeof summarise>);
  return out;
};
const rows = [
  row('shapes used', (s) => s.formation.formationsUsed),
  row('dominant share', (s) => s.formation.dominantShare),
  row('entropy (bits)', (s) => s.formation.entropyBits),
  row('shape fits identity', (s) => s.identity.shapeMatchesIdentity),
  row('suitability loss', (s) => s.squad.meanSuitabilityLoss),
  row('out-of-position XI', (s) => s.squad.outOfPositionStartersPerClub),
  row('bench line gaps', (s) => s.bench.lineCoverGapShare),
  row('bench no keeper', (s) => s.bench.noKeeperShare),
  row('goals/match', (s) => s.league.goalsPerMatch),
  row('draws', (s) => s.league.drawShare),
  row('season points sd', (s) => s.league.seasonPointsSd),
  row('strong ppg', (s) => s.tiers.strongPpg),
  row('middle ppg', (s) => s.tiers.middlePpg),
  row('weak ppg', (s) => s.tiers.weakPpg),
  row('strong-weak gap', (s) => s.tiers.strongWeakGap),
  row('attack share sd', (s) => s.structure.attackShareSd),
];
table(rows);

const md = [
  '# AI formation identity experiment',
  '',
  `Commit \`${commit}\`${dirtyTree ? ' (working tree had uncommitted changes)' : ''}`
  + ` · ${WORLDS} worlds × 1 season × ${CANDIDATES.length} candidates`
  + ` · ${(summaries[CANDIDATES[0]!.key] as ReturnType<typeof summarise>).league.matches} matches each`
  + ` · runtime ${(runtimeMs / 1000).toFixed(0)} s.`,
  '',
  'The same seeds generate the same clubs, squads, fixtures and tactics in every',
  'candidate; only the formation each club plays differs. Raw numbers are in',
  '`results.json`.',
  '',
  '| Metric | ' + CANDIDATES.map((c) => c.label).join(' | ') + ' |',
  '|---|' + CANDIDATES.map(() => '---').join('|') + '|',
  ...rows.map((r) => `| ${r.metric} | ${CANDIDATES.map((c) => r[c.key]).join(' | ')} |`),
  '',
  '## Shape distribution',
  '',
  ...CANDIDATES.map((c) => {
    const d = (summaries[c.key] as ReturnType<typeof summarise>).formation.distribution;
    return `- **${c.label}**: ${Object.entries(d).map(([k, v]) => `${k} ${v}`).join(', ')}`;
  }),
  '',
].join('\n');
writeFileSync(`${OUT_DIR}/summary.md`, md);
note(`\n  wrote ${OUT_DIR}/results.json and ${OUT_DIR}/summary.md in ${(runtimeMs / 1000).toFixed(0)} s`);
