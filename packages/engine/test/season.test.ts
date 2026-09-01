import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/game/newGame';
import { ContentRegistry } from '../src/content';
import { BASE_PACK } from '../src/content/packs/base';
import { advanceCycle } from '../src/game/cycle';
import { validateState } from '../src/persistence/save';
import { computeStandings } from '../src/league/standings';
import { Ledger } from '../src/economy/ledger';
import { auditEconomy } from '../src/economy/audit';
import type { GameState } from '../src/game/state';
import type { ClubId } from '../src/core/brand';

/** The base universe, loaded once and validated, handed to every world built here. */
const registry = (() => {
  const r = new ContentRegistry();
  r.load(BASE_PACK);
  return r;
})();

const START = 1_700_000_000_000;
const CYCLE_MS = 604_800_000;

const newGame = (seed: string): GameState =>
  createNewGame({
    registry,
    seed,
    now: START,
    manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
    club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
  });

/**
 * Let the event loop turn between cycles.
 *
 * A season is twenty-odd full cycles of synchronous simulation, and the
 * multi-season test below runs sixty-six. Run back to back with no yield, that
 * holds the worker's event loop for tens of seconds, during which it cannot
 * answer Vitest's reporter RPC — and on a loaded machine that surfaces as
 * `Timeout calling "onTaskUpdate"` with every assertion green. The balance
 * suite already yields for exactly this reason (see `breathe` there); this is
 * the same remedy applied to the one heavy suite that lacked it. Nothing about
 * the simulation changes: the same cycles run in the same order with the same
 * seeds.
 */
const breathe = (): Promise<void> => new Promise((resolve) => { setTimeout(resolve, 0); });

async function playSeason(seed: string, weeks = 22) {
  let state = newGame(seed);
  const summaries = [];
  for (let i = 0; i < weeks; i++) {
    const result = advanceCycle(state, { registry, now: START + i * CYCLE_MS });
    state = result.state;
    summaries.push(result.summary);
    if (i % 4 === 3) await breathe();
  }
  return { state, summaries };
}

describe('a full season', () => {
  it('plays every fixture and rolls into the next season', async () => {
    const { state } = await playSeason('season-a');

    expect(validateState(state)).toEqual([]);

    // Completing the final matchweek rolls the world forward rather than
    // leaving the clock counting weeks that contain no football.
    expect(state.clock.season).toBe(2);
    expect(state.clock.week).toBe(0);
    expect(state.clock.phase).toBe('PRE_SEASON');

    const fixtures = Object.values(state.fixtures);
    const finished = fixtures.filter((f) => f.status === 'COMPLETED');
    const upcoming = fixtures.filter((f) => f.status === 'SCHEDULED');
    expect(finished).toHaveLength(132);
    expect(upcoming).toHaveLength(132);

    // Season records reset for the new campaign, and the old one is recorded.
    for (const club of Object.values(state.clubs)) {
      expect(club.seasonRecord.played).toBe(0);
    }
    expect(state.legacy.seasonSummaries).toHaveLength(1);
    expect(state.seasons[state.currentSeasonId]?.number).toBe(2);
  });

  it('crowns a champion and records the season that produced it', async () => {
    const { state } = await playSeason('season-champion');
    const closed = Object.values(state.seasons).find((s) => s.completed);
    expect(closed).toBeDefined();
    expect(closed?.championClubId).toBeTruthy();
    expect(closed?.playerFinalPosition).toBeGreaterThan(0);

    const summary = state.legacy.seasonSummaries[0];
    expect(summary?.played).toBe(22);
    expect(summary!.won + summary!.drawn + summary!.lost).toBe(22);
  });

  it('ages the squad, retires the finished and promotes from the academy', async () => {
    const before = newGame('season-ageing');
    const { state: after } = await playSeason('season-ageing');

    const stillHere = Object.keys(after.players).filter((id) => before.players[id]);
    // Everyone who survived is a year older.
    for (const id of stillHere.slice(0, 40)) {
      expect(after.players[id]!.age).toBe(before.players[id]!.age + 1);
    }
    // Nobody carries last season's bans into a new campaign, and everyone who
    // came through the old season starts it fresh.
    expect(Object.values(after.players).every((p) => p.suspensionMatches === 0)).toBe(true);
    for (const id of stillHere.slice(0, 40)) {
      expect(after.players[id]!.fitness).toBe(100);
      expect(after.players[id]!.form.appearances).toBe(0);
    }
    // The academy took on a new intake, so the league does not run dry.
    expect(Object.keys(after.players).length).toBeGreaterThan(Object.keys(before.players).length);
  });

  it('does not let a club decay to nothing across several seasons', async () => {
    // The failure this guards against is a death spiral: sponsorship lapses,
    // the wage budget shrinks with the income, the club cannot replace players
    // it loses, results collapse, and the decline compounds beyond recovery.
    let state = newGame('season-decay');
    for (let cycle = 0; cycle < 66; cycle++) {
      state = advanceCycle(state, { registry, now: START + cycle * CYCLE_MS }).state;
      if (cycle % 4 === 3) await breathe();
    }
    const club = state.clubs[state.playerClubId]!;
    expect(state.clock.season).toBe(4);
    expect(validateState(state)).toEqual([]);

    // Every club can still field a side with cover, league-wide.
    for (const c of Object.values(state.clubs)) {
      expect(c.squad.length).toBeGreaterThanOrEqual(9);
    }
    // The pool regenerates rather than draining: retirements are replaced by
    // an academy intake, which is what stops the league running out of players.
    expect(Object.keys(state.players).length).toBeGreaterThan(216);
    // Reputation has a floor, so a bad run cannot start an unrecoverable slide.
    expect(club.reputation).toBeGreaterThanOrEqual(20);
    // Commercial income never falls to nothing.
    expect(state.sponsors.active.length).toBeGreaterThan(0);
  });

  it('produces a table where points reconcile with results', async () => {
    const { state } = await playSeason('season-b');
    const table = computeStandings(
      Object.keys(state.clubs) as ClubId[],
      Object.values(state.fixtures),
      { playoffSpots: 4, relegationSpots: 2 },
    );

    expect(table).toHaveLength(12);
    for (const row of table) {
      expect(row.points).toBe(row.won * 3 + row.drawn);
      expect(row.played).toBe(22);
    }
    // Total goals for must equal total goals against across the league.
    const scored = table.reduce((n, r) => n + r.goalsFor, 0);
    const conceded = table.reduce((n, r) => n + r.goalsAgainst, 0);
    expect(scored).toBe(conceded);
  });

  it('scores at the rate the format calls for', async () => {
    const { state } = await playSeason('season-c');
    const played = Object.values(state.fixtures).filter((f) => f.homeScore !== null);
    const goals = played.reduce((n, f) => n + (f.homeScore ?? 0) + (f.awayScore ?? 0), 0);
    const perMatch = goals / played.length;
    expect(perMatch).toBeGreaterThan(5.5);
    expect(perMatch).toBeLessThan(9.5);
  });

  it('is fully deterministic across an entire season', async () => {
    const a = await playSeason('repeat', 8);
    const b = await playSeason('repeat', 8);
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
  });

  it('keeps the economy auditable the whole way through', async () => {
    const { state } = await playSeason('season-d');
    const ledger = Ledger.restore(state.ledger);
    expect(ledger.verify()).toEqual([]);
    // The audit may legitimately flag distress; it must never flag corruption.
    const violations = auditEconomy(state, ledger).map((v) => v.code);
    expect(violations).not.toContain('DOUBLE_CLAIMED');
    expect(violations).not.toContain('WAGE_MISMATCH');
    expect(violations).not.toContain('DUPLICATE_OWNERSHIP');
    expect(violations).not.toContain('NON_FINITE');
  });

  it('lets the world react: stories, posts and events accumulate from real matches', async () => {
    let state = newGame('season-e');
    let stories = 0;
    let posts = 0;
    for (let i = 0; i < 6; i++) {
      const result = advanceCycle(state, { registry, now: START + i * CYCLE_MS });
      state = result.state;
      stories += result.stories.length;
      posts += result.posts.length;
    }
    expect(stories).toBeGreaterThan(0);
    expect(posts).toBeGreaterThan(0);
    expect(state.eventLog.length).toBeGreaterThan(0);
  });

  it('develops and wears down squads rather than freezing them', async () => {
    const before = newGame('season-f');
    const { state: after } = await playSeason('season-f', 12);

    const beforeIds = Object.keys(before.players);
    const changed = beforeIds.filter((id) => {
      const a = before.players[id];
      const b = after.players[id];
      return a && b && (a.overall !== b.overall || a.form.appearances !== b.form.appearances);
    });
    // The overwhelming majority of the league should have played or moved.
    expect(changed.length).toBeGreaterThan(beforeIds.length * 0.6);

    // Someone, somewhere, got injured over twelve matchweeks.
    const injuries = Object.values(after.players).filter((p) => p.injury !== null);
    expect(injuries.length).toBeGreaterThan(0);
  });

  it('never leaves a player owned by two clubs', async () => {
    const { state } = await playSeason('season-g', 14);
    const owners = new Map<string, string>();
    for (const club of Object.values(state.clubs)) {
      for (const playerId of [...club.squad, ...club.youthSquad]) {
        expect(owners.has(playerId)).toBe(false);
        owners.set(playerId, club.id);
      }
    }
  });

  it('never lets a suspension or injury run negative', async () => {
    const { state } = await playSeason('season-h', 14);
    for (const player of Object.values(state.players)) {
      expect(player.suspensionMatches).toBeGreaterThanOrEqual(0);
      expect(player.fitness).toBeGreaterThanOrEqual(0);
      expect(player.fitness).toBeLessThanOrEqual(100);
      if (player.injury) expect(player.injury.weeksRemaining).toBeGreaterThan(0);
    }
  });

  it('advances the narrative calendar rather than counting anonymous weeks', async () => {
    let state = newGame('season-i');
    const phases: string[] = [];
    for (let i = 0; i < 22; i++) {
      const result = advanceCycle(state, { registry, now: START + i * CYCLE_MS });
      state = result.state;
      phases.push(state.clock.phase);
      if (i === 21) expect(result.summary.seasonComplete).toBe(true);
    }
    // The player moves through named beats, not anonymous week numbers.
    expect(new Set(phases).size).toBeGreaterThanOrEqual(6);
    expect(phases).toContain('OPENING_FIXTURES');
    expect(phases).toContain('TRANSFER_WINDOW');
    // And the final week hands over to the next campaign.
    expect(state.clock.phase).toBe('PRE_SEASON');
  });
});
