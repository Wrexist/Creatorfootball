import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/game/newGame';
import { advanceCycle } from '../src/game/cycle';
import { validateState } from '../src/persistence/save';
import { computeStandings } from '../src/league/standings';
import { Ledger } from '../src/economy/ledger';
import { auditEconomy } from '../src/economy/audit';
import type { GameState } from '../src/game/state';
import type { ClubId } from '../src/core/brand';

const START = 1_700_000_000_000;
const CYCLE_MS = 604_800_000;

const newGame = (seed: string): GameState =>
  createNewGame({
    seed,
    now: START,
    manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
    club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
  });

function playSeason(seed: string, weeks = 22) {
  let state = newGame(seed);
  const summaries = [];
  for (let i = 0; i < weeks; i++) {
    const result = advanceCycle(state, { now: START + i * CYCLE_MS });
    state = result.state;
    summaries.push(result.summary);
  }
  return { state, summaries };
}

describe('a full season', () => {
  it('plays every fixture and leaves a coherent, valid world', () => {
    const { state } = playSeason('season-a');

    expect(validateState(state)).toEqual([]);

    const fixtures = Object.values(state.fixtures);
    expect(fixtures.every((f) => f.status === 'COMPLETED')).toBe(true);
    expect(state.clock.week).toBe(22);

    // Every club played every fixture exactly once.
    for (const club of Object.values(state.clubs)) {
      expect(club.seasonRecord.played).toBe(22);
      expect(club.seasonRecord.won + club.seasonRecord.drawn + club.seasonRecord.lost).toBe(22);
    }
  });

  it('produces a table where points reconcile with results', () => {
    const { state } = playSeason('season-b');
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

  it('scores at the rate the format calls for', () => {
    const { state } = playSeason('season-c');
    const played = Object.values(state.fixtures).filter((f) => f.homeScore !== null);
    const goals = played.reduce((n, f) => n + (f.homeScore ?? 0) + (f.awayScore ?? 0), 0);
    const perMatch = goals / played.length;
    expect(perMatch).toBeGreaterThan(5.5);
    expect(perMatch).toBeLessThan(9.5);
  });

  it('is fully deterministic across an entire season', () => {
    const a = playSeason('repeat', 8);
    const b = playSeason('repeat', 8);
    expect(JSON.stringify(a.state)).toEqual(JSON.stringify(b.state));
  });

  it('keeps the economy auditable the whole way through', () => {
    const { state } = playSeason('season-d');
    const ledger = Ledger.restore(state.ledger);
    expect(ledger.verify()).toEqual([]);
    // The audit may legitimately flag distress; it must never flag corruption.
    const violations = auditEconomy(state, ledger).map((v) => v.code);
    expect(violations).not.toContain('DOUBLE_CLAIMED');
    expect(violations).not.toContain('WAGE_MISMATCH');
    expect(violations).not.toContain('DUPLICATE_OWNERSHIP');
    expect(violations).not.toContain('NON_FINITE');
  });

  it('lets the world react: stories, posts and events accumulate from real matches', () => {
    let state = newGame('season-e');
    let stories = 0;
    let posts = 0;
    for (let i = 0; i < 6; i++) {
      const result = advanceCycle(state, { now: START + i * CYCLE_MS });
      state = result.state;
      stories += result.stories.length;
      posts += result.posts.length;
    }
    expect(stories).toBeGreaterThan(0);
    expect(posts).toBeGreaterThan(0);
    expect(state.eventLog.length).toBeGreaterThan(0);
  });

  it('develops and wears down squads rather than freezing them', () => {
    const before = newGame('season-f');
    const { state: after } = playSeason('season-f', 12);

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

  it('never leaves a player owned by two clubs', () => {
    const { state } = playSeason('season-g', 14);
    const owners = new Map<string, string>();
    for (const club of Object.values(state.clubs)) {
      for (const playerId of [...club.squad, ...club.youthSquad]) {
        expect(owners.has(playerId)).toBe(false);
        owners.set(playerId, club.id);
      }
    }
  });

  it('never lets a suspension or injury run negative', () => {
    const { state } = playSeason('season-h', 14);
    for (const player of Object.values(state.players)) {
      expect(player.suspensionMatches).toBeGreaterThanOrEqual(0);
      expect(player.fitness).toBeGreaterThanOrEqual(0);
      expect(player.fitness).toBeLessThanOrEqual(100);
      if (player.injury) expect(player.injury.weeksRemaining).toBeGreaterThan(0);
    }
  });

  it('advances the narrative calendar rather than counting anonymous weeks', () => {
    const { state, summaries } = playSeason('season-i');
    expect(summaries).toHaveLength(22);
    expect(state.clock.phase).toBe('PLAYOFFS');
    expect(summaries.at(-1)?.seasonComplete).toBe(true);
  });
});
