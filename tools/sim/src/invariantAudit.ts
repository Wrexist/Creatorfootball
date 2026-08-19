import {
  validateState, saveGame, loadGame, MemoryStorage, checksum, SAVE_KEY,
  computeStandings, verifyFixtures, auditEconomy, advanceCycle, Ledger,
  setForkCollisionMode, drainForkCollisions,
  type GameState,
} from '@cf/engine';
import { heading, note, summarise, pass, fail, table } from './report';
import { playSeason, playWeeks, startGame, ledgerOf, progress, registry, EPOCH, CYCLE_MS } from './harness';

/**
 * Invariant audit.
 *
 * Checks the properties that must hold no matter what the simulation does. Each
 * one below corresponds to a way a management game can silently corrupt itself:
 * a player owned twice duplicates value, a reward claimed twice prints money, a
 * table that disagrees with its own results destroys trust in everything else.
 *
 * These are asserted against real played seasons rather than constructed
 * fixtures, because the failures worth catching are the ones that only emerge
 * after a few hundred simulated matches.
 */

const RUNS = Number(globalThis.process?.env?.['INV_RUNS'] ?? 12);

interface Check {
  readonly name: string;
  readonly check: (state: GameState) => string[];
}

const CHECKS: readonly Check[] = [
  {
    name: 'no player is owned by two clubs',
    check: (state) => {
      const owners = new Map<string, string>();
      const problems: string[] = [];
      for (const club of Object.values(state.clubs)) {
        for (const playerId of [...club.squad, ...club.youthSquad]) {
          const existing = owners.get(playerId);
          if (existing) problems.push(`${playerId} in both ${existing} and ${club.id}`);
          owners.set(playerId, club.id);
        }
      }
      return problems;
    },
  },
  {
    name: 'every squad member exists and points back at his club',
    check: (state) => {
      const problems: string[] = [];
      for (const club of Object.values(state.clubs)) {
        for (const playerId of club.squad) {
          const player = state.players[playerId];
          if (!player) { problems.push(`${club.id} references unknown player ${playerId}`); continue; }
          if (player.clubId !== club.id) problems.push(`${playerId} is in ${club.id}'s squad but points at ${player.clubId}`);
        }
      }
      return problems;
    },
  },
  {
    name: 'every contract is valid and consistent',
    check: (state) => {
      const problems: string[] = [];
      const byPlayer = new Map<string, string>();
      for (const contract of Object.values(state.contracts)) {
        if (contract.wage < 0) problems.push(`${contract.id} has a negative wage`);
        if (!Number.isFinite(contract.wage)) problems.push(`${contract.id} has a non-finite wage`);
        if (contract.weeksRemaining < 0) problems.push(`${contract.id} has negative weeks remaining`);
        const existing = byPlayer.get(contract.playerId);
        if (existing) problems.push(`${contract.playerId} holds two contracts`);
        byPlayer.set(contract.playerId, contract.id);
        const player = state.players[contract.playerId];
        if (player && player.contractId !== contract.id && player.clubId === contract.clubId) {
          problems.push(`${contract.playerId} points at a different contract`);
        }
      }
      return problems;
    },
  },
  {
    name: 'no fixture is duplicated or scheduled against itself',
    check: (state) => {
      const problems: string[] = [];
      const seen = new Set<string>();
      for (const fixture of Object.values(state.fixtures)) {
        if (fixture.homeClubId === fixture.awayClubId) problems.push(`${fixture.id} is a club against itself`);
        const key = `${fixture.week}:${fixture.homeClubId}:${fixture.awayClubId}`;
        if (seen.has(key)) problems.push(`duplicate fixture ${key}`);
        seen.add(key);
      }
      const competition = state.competitions[state.currentCompetitionId];
      if (competition) {
        problems.push(...verifyFixtures(
          Object.values(state.fixtures).filter((f) => f.competitionId === competition.id),
          competition.clubIds,
          competition.rounds,
        ));
      }
      return problems;
    },
  },
  {
    name: 'the table reconciles with the results that produced it',
    check: (state) => {
      const competition = state.competitions[state.currentCompetitionId];
      if (!competition) return ['no current competition'];
      const fixtures = Object.values(state.fixtures).filter((f) => f.competitionId === competition.id);
      const rows = computeStandings(competition.clubIds, fixtures, {
        playoffSpots: competition.playoffSpots,
        relegationSpots: competition.relegationSpots,
      });
      const problems: string[] = [];
      const scored = rows.reduce((n, r) => n + r.goalsFor, 0);
      const conceded = rows.reduce((n, r) => n + r.goalsAgainst, 0);
      if (scored !== conceded) problems.push(`league goals for (${scored}) != goals against (${conceded})`);
      for (const row of rows) {
        if (row.points !== row.won * 3 + row.drawn) problems.push(`${row.clubId} points do not follow from results`);
        if (row.won + row.drawn + row.lost !== row.played) problems.push(`${row.clubId} result counts do not sum to played`);
      }
      return problems;
    },
  },
  {
    name: 'no balance is negative or non-finite, and no reward paid twice',
    check: (state) => {
      const ledger = ledgerOf(state);
      const problems = [...ledger.verify()];
      const codes = auditEconomy(state, ledger)
        .filter((v) => ['DOUBLE_CLAIMED', 'NON_FINITE', 'NEGATIVE_AMOUNT', 'WAGE_MISMATCH'].includes(v.code));
      problems.push(...codes.map((v) => `${v.code}: ${v.message}`));
      return problems;
    },
  },
  {
    name: 'no player is in an impossible physical state',
    check: (state) => {
      const problems: string[] = [];
      for (const player of Object.values(state.players)) {
        if (player.fitness < 0 || player.fitness > 100) problems.push(`${player.id} fitness ${player.fitness}`);
        if (player.suspensionMatches < 0) problems.push(`${player.id} negative suspension`);
        if (player.injury && player.injury.weeksRemaining <= 0) problems.push(`${player.id} carries a healed injury`);
        if (!Number.isFinite(player.marketValue) || player.marketValue < 0) problems.push(`${player.id} value ${player.marketValue}`);
        if (player.overall < 1 || player.overall > 99) problems.push(`${player.id} overall ${player.overall}`);
      }
      return problems;
    },
  },
  {
    name: 'every club can field a team',
    check: (state) => {
      const config = 7;
      const problems: string[] = [];
      for (const club of Object.values(state.clubs)) {
        const available = club.squad
          .map((id) => state.players[id])
          .filter((p) => p && p.injury === null && p.suspensionMatches === 0);
        if (available.length < config) {
          problems.push(`${club.name} has only ${available.length} available players`);
        }
      }
      return problems;
    },
  },
  {
    name: 'the state passes its own save validator',
    check: (state) => validateState(state),
  },
];

/**
 * Social provenance.
 *
 * The invariant is that no post exists without an event behind it. That cannot
 * be checked from a finished save, because the event log is deliberately
 * bounded and old events age out while their posts remain — every apparent
 * violation would be a false positive. So we instrument a live run instead,
 * accumulating every event id the engine emits and checking each cycle's posts
 * against the full history as it happens.
 */
function auditSocialProvenance(seed: string, weeks: number): string[] {
  const problems: string[] = [];
  const emitted = new Set<string>();
  let state = startGame(seed);
  const reg = registry();

  for (let i = 0; i < weeks; i++) {
    const result = advanceCycle(state, {
      now: EPOCH + i * CYCLE_MS,
      registry: reg,
      ledger: Ledger.restore(state.ledger),
    });
    for (const event of result.events) emitted.add(String(event.id));
    for (const post of result.posts) {
      if (!post.relatedEventId) continue;
      if (!emitted.has(post.relatedEventId)) {
        problems.push(`post ${post.id} cites ${post.relatedEventId}, which was never emitted`);
      }
    }
    state = result.state;
  }
  return problems;
}

async function saveRoundTrip(state: GameState): Promise<string[]> {
  const storage = new MemoryStorage();
  const problems: string[] = [];

  const saved = await saveGame(storage, state, 1);
  if (!saved.ok) return [`refused to save a valid state: ${saved.error}`];

  const loaded = await loadGame(storage);
  if (!loaded.ok) return [`could not reload a state it just wrote: ${loaded.error.code}`];
  if (JSON.stringify(loaded.value.state) !== JSON.stringify(state)) {
    problems.push('a save/load round trip did not preserve state exactly');
  }

  // A tampered save must be rejected, not loaded.
  const raw = await storage.get(SAVE_KEY);
  const envelope = JSON.parse(raw as string);
  envelope.state.clubs[state.playerClubId].finance.transferBudget = 999_999_999;
  envelope.checksum = checksum(JSON.stringify(envelope.state)).slice(0, 4);
  await storage.set(SAVE_KEY, JSON.stringify(envelope));
  const tampered = await loadGame(storage);
  // The backup should rescue it; what must never happen is the tampered payload loading.
  if (tampered.ok && tampered.value.state.clubs[state.playerClubId]?.finance.transferBudget === 999_999_999) {
    problems.push('a tampered save was accepted');
  }
  return problems;
}

async function run(): Promise<boolean> {
  heading('INVARIANT AUDIT');
  note(`  ${RUNS} played seasons, plus a multi-season run and save round trips.`);

  const states: { label: string; state: GameState }[] = [];
  for (let i = 0; i < RUNS; i++) {
    states.push({ label: `season-${i}`, state: playSeason(`inv-${i}`).state });
    progress('seasons', i + 1, RUNS);
  }

  // A long continuous save is where drift accumulates.
  let long = startGame('inv-long');
  for (let season = 0; season < 3; season++) {
    long = playWeeks(long, 22, season * 22).state;
  }
  states.push({ label: 'three-season run', state: long });

  let allOk = true;
  const rows: Record<string, string | number>[] = [];

  for (const { name, check } of CHECKS) {
    const failures: string[] = [];
    for (const { label, state } of states) {
      for (const problem of check(state)) failures.push(`[${label}] ${problem}`);
    }
    rows.push({ invariant: name, result: failures.length === 0 ? 'PASS' : `FAIL (${failures.length})` });
    if (failures.length > 0) {
      allOk = false;
      fail(name);
      for (const problem of failures.slice(0, 5)) note(`        ${problem}`);
      if (failures.length > 5) note(`        ... and ${failures.length - 5} more`);
    }
  }

  heading('Results');
  table(rows);

  heading('Random stream hygiene');
  // Forking the same label twice from one stream hands both children identical
  // values. It is silent, it makes "independent" agents behave in lockstep, and
  // it is invisible in any single test — so it is checked over a whole season.
  setForkCollisionMode('report');
  drainForkCollisions();
  playSeason('inv-forks');
  const forkCollisions = drainForkCollisions();
  if (forkCollisions.length === 0) {
    pass('no subsystem accidentally shared a random stream');
  } else {
    allOk = false;
    const byLabel = new Map<string, number>();
    for (const c of forkCollisions) byLabel.set(c.label, (byLabel.get(c.label) ?? 0) + 1);
    fail(`${forkCollisions.length} duplicate stream forks`);
    for (const [label, count] of byLabel) note(`        ${count} x fork('${label}')`);
  }

  heading('Social provenance');
  const provenance = auditSocialProvenance('inv-social', 10);
  if (provenance.length === 0) {
    pass('every generated post traced back to an event the engine actually emitted');
  } else {
    allOk = false;
    fail(`${provenance.length} posts cited events that were never emitted`);
    for (const problem of provenance.slice(0, 5)) note(`        ${problem}`);
  }

  heading('Save integrity');
  const saveProblems = await saveRoundTrip(states[0]?.state as GameState);
  if (saveProblems.length === 0) pass('save, reload and tamper-rejection all behave');
  else { allOk = false; for (const p of saveProblems) fail(p); }

  summarise('Invariant audit', allOk);
  return allOk;
}

const ok = await run();
if (!ok) globalThis.process?.exit(1);
