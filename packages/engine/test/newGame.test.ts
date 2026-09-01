import { describe, expect, it } from 'vitest';
import { createNewGame } from '../src/game/newGame';
import { ContentRegistry } from '../src/content';
import { BASE_PACK } from '../src/content/packs/base';
import { validateState } from '../src/persistence/save';
import { computeStandings } from '../src/league/standings';
import { squadStrength, squadWageBill, playerClub, nextFixture } from '../src/game/selectors';
import { verifyFixtures } from '../src/league/fixtures';
import type { ClubId } from '../src/core/brand';

/** The base universe, loaded once and validated, handed to every world built here. */
const registry = (() => {
  const r = new ContentRegistry();
  r.load(BASE_PACK);
  return r;
})();

const newGame = (seed = 'smoke') =>
  createNewGame({
    registry,
    seed,
    now: 1_700_000_000_000,
    manager: { kind: 'PREMADE', templateId: 'manager_vera_lindqvist' },
    club: { kind: 'TEMPLATE', templateId: 'club_cinderwick_town' },
  });

describe('new game creation', () => {
  it('builds a complete, valid world', () => {
    const state = newGame();
    expect(validateState(state)).toEqual([]);

    const clubs = Object.values(state.clubs);
    expect(clubs).toHaveLength(12);
    expect(clubs.filter((c) => c.isPlayerClub)).toHaveLength(1);

    // Every club has a full squad and a manager.
    for (const club of clubs) {
      expect(club.squad.length).toBeGreaterThanOrEqual(16);
      expect(club.managerId).not.toBeNull();
      expect(club.tactics.formationId).toBe('2-3-1');
    }

    // Every player is owned by exactly one club and has a contract.
    for (const player of Object.values(state.players)) {
      expect(player.clubId).not.toBeNull();
      expect(player.contractId).not.toBeNull();
      expect(state.contracts[player.contractId as string]).toBeDefined();
    }
  });

  it('is fully deterministic for a given seed', () => {
    expect(JSON.stringify(newGame('abc'))).toEqual(JSON.stringify(newGame('abc')));
  });

  it('produces a different world for a different seed', () => {
    expect(JSON.stringify(newGame('abc'))).not.toEqual(JSON.stringify(newGame('xyz')));
  });

  it('schedules a complete, balanced double round robin', () => {
    const state = newGame();
    const fixtures = Object.values(state.fixtures);
    const clubIds = Object.keys(state.clubs) as ClubId[];
    expect(fixtures).toHaveLength((12 * 11 / 2) * 2);
    expect(verifyFixtures(fixtures, clubIds, 2)).toEqual([]);
    expect(nextFixture(state)).not.toBeNull();
  });

  it('spreads squad strength so the league has a favourite and strugglers', () => {
    const state = newGame();
    const strengths = Object.keys(state.clubs)
      .map((id) => squadStrength(state, id as ClubId))
      .sort((a, b) => b - a);
    const best = strengths[0] as number;
    const worst = strengths[strengths.length - 1] as number;
    expect(best - worst).toBeGreaterThanOrEqual(10);
    expect(best - worst).toBeLessThanOrEqual(40);
  });

  it('starts every club solvent, with a wage bill it can carry', () => {
    const state = newGame();
    for (const clubId of Object.keys(state.clubs) as ClubId[]) {
      const bill = squadWageBill(state, clubId);
      expect(bill).toBeGreaterThan(0);
      // A club that begins the game already unable to pay is a broken start,
      // not a difficulty setting.
      expect(bill).toBeLessThan((state.clubs[clubId]?.finance.wageBudgetPerCycle ?? 0) * 1.6);
    }
  });

  it('hides other clubs behind a scouting fog but not the player squad', () => {
    const state = newGame();
    const own = playerClub(state);
    for (const playerId of own.squad) {
      expect(state.players[playerId]?.scouting.confidence).toBe(1);
    }
    const otherClub = Object.values(state.clubs).find((c) => !c.isPlayerClub);
    for (const playerId of otherClub?.squad ?? []) {
      expect(state.players[playerId]?.scouting.confidence).toBe(0);
    }
  });

  it('starts with an empty table that every club appears in', () => {
    const state = newGame();
    const table = computeStandings(
      Object.keys(state.clubs) as ClubId[],
      Object.values(state.fixtures),
      { playoffSpots: 4, relegationSpots: 2 },
    );
    expect(table).toHaveLength(12);
    expect(table.every((r) => r.played === 0)).toBe(true);
  });

  it('seeds rivalry-derived derbies into the fixture list', () => {
    const state = newGame();
    const derbies = Object.values(state.fixtures).filter((f) => f.isDerby);
    expect(derbies.length).toBeGreaterThan(0);
    expect(derbies.every((f) => f.importance >= 4)).toBe(true);
  });

  it('attaches creators to their clubs', () => {
    const state = newGame();
    const attached = Object.values(state.creators).filter((c) => c.clubId !== null);
    expect(attached.length).toBeGreaterThanOrEqual(10);
    for (const creator of attached) {
      expect(state.clubs[creator.clubId as string]?.creatorIds).toContain(creator.id);
    }
  });
});
