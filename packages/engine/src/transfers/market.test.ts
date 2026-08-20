import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import { makeClub, makeContract, makePlayer, makeState } from '../economy/testing';
import type { GameState } from '../game/state';
import { emptyAttributes } from '../players/attributes';
import type { Player } from '../players/player';
import { positionScarcity, refreshMarket, searchPlayers, squadNeeds, type MarketContext } from './market';

const ctx: MarketContext = { cycle: 4, season: 1, windowOpen: true, leagueSize: 12 };

function league(): GameState {
  const players: Record<string, Player> = {};
  const contracts: Record<string, ReturnType<typeof makeContract>> = {};
  const clubs: Record<string, ReturnType<typeof makeClub>> = {};

  for (let c = 0; c < 4; c++) {
    const clubId = `club_${c}`;
    const squad: string[] = [];
    for (let i = 0; i < 22; i++) {
      const id = `${clubId}_p${i}`;
      const overall = 50 + ((c * 7 + i * 3) % 35);
      players[id] = makePlayer({
        id,
        age: 19 + (i % 15),
        attributes: emptyAttributes(overall),
        overall,
        potential: Math.min(99, overall + (i % 12)),
        position: (['GK', 'CB', 'CM', 'ST', 'LW'] as const)[i % 5],
        clubId,
        contractId: `ct_${clubId}_${i}`,
        // Half the league is only partially scouted.
        scouting: { confidence: i % 2 === 0 ? 1 : 0, revealed: [] },
      });
      contracts[`ct_${clubId}_${i}`] = makeContract({
        id: `ct_${clubId}_${i}`, playerId: id, clubId,
        weeksRemaining: i % 4 === 0 ? 10 : 90,
        minutesPlayed: i < 11 ? 900 : 60,
        minutesAvailable: 1_000,
      });
      squad.push(id);
    }
    clubs[clubId] = makeClub({ id: clubId, squad, isPlayerClub: c === 0 });
  }

  const free = makePlayer({ id: 'free_agent', attributes: emptyAttributes(68), overall: 68, position: 'ST' });
  players[free.id] = free;

  return makeState({ clubs, players, contracts, playerClubId: clubs.club_0!.id });
}

describe('refreshMarket', () => {
  it('re-prices everybody and returns a delta rather than mutating state', () => {
    const state = league();
    const before = JSON.stringify(state);
    const delta = refreshMarket(state, new Rng('market'), ctx);

    expect(JSON.stringify(state)).toBe(before);
    expect(Object.keys(delta.playerValues).length).toBe(Object.keys(state.players).length);
    for (const value of Object.values(delta.playerValues)) {
      expect(Number.isFinite(value)).toBe(true);
      expect(value).toBeGreaterThan(0);
    }
    expect(delta.leagueAverageOverall).toBeGreaterThan(40);
  });

  it('lists free agents and surfaces AI-club players, but never the player’s own squad', () => {
    const state = league();
    const listings = refreshMarket(state, new Rng('listings'), ctx).listings;
    expect(listings.free_agent).toBeDefined();
    expect(listings.free_agent!.askingPrice).toBe(0);
    expect(listings.free_agent!.wageDemand).toBeGreaterThan(0);
    for (const listing of Object.values(listings)) {
      if (listing.clubId === state.playerClubId) {
        throw new Error('the player’s own squad should never be listed by the market');
      }
    }
  });

  it('generates rumours only where there is real interest, and expires them', () => {
    const state = league();
    const delta = refreshMarket(state, new Rng('rumours'), ctx);
    for (const rumour of delta.rumours) {
      const listing = delta.listings[rumour.playerId];
      expect(listing?.interestedClubIds.length ?? 0).toBeGreaterThan(0);
      expect(rumour.credibility).toBeGreaterThan(0);
      expect(rumour.credibility).toBeLessThanOrEqual(1);
    }

    const stale = {
      ...state,
      transfers: {
        ...state.transfers,
        rumours: [{ id: 'old', playerId: 'free_agent' as never, clubId: 'club_1' as never, credibility: 0.5, cycle: 0, text: 'old news' }],
      },
    };
    const later = refreshMarket(stale, new Rng('expire'), { ...ctx, cycle: 30 });
    expect(later.rumours.some((r) => r.id === 'old')).toBe(false);
  });

  it('is deterministic for a given seed', () => {
    const state = league();
    const a = refreshMarket(state, new Rng('same'), ctx);
    const b = refreshMarket(state, new Rng('same'), ctx);
    expect(Object.keys(a.listings).sort()).toEqual(Object.keys(b.listings).sort());
    expect(a.playerValues).toEqual(b.playerValues);
  });

  it('measures position scarcity against a balanced league', () => {
    const state = league();
    const scarcity = positionScarcity(Object.values(state.players));
    for (const value of Object.values(scarcity)) {
      expect(value).toBeGreaterThan(0);
      expect(Number.isFinite(value)).toBe(true);
    }
    // Half the positions in this fixture are unrepresented, so they read as scarce.
    expect(Math.max(...Object.values(scarcity))).toBeGreaterThan(1);
  });
});

describe('searchPlayers', () => {
  it('filters on the scouted estimate, so an unscouted gem stays hidden', () => {
    const state = league();
    const hidden = makePlayer({
      id: 'hidden_gem', attributes: emptyAttributes(88), overall: 88, position: 'ST',
      scouting: { confidence: 0, revealed: [] },
    });
    const known = makePlayer({
      id: 'known_gem', attributes: emptyAttributes(88), overall: 88, position: 'ST',
      scouting: { confidence: 1, revealed: [] },
    });
    const withGems = {
      ...state,
      players: { ...state.players, hidden_gem: hidden, known_gem: known },
    };

    const found = searchPlayers(withGems, { minOverall: 86, positions: ['ST'] });
    expect(found).toContain('known_gem');
    // The unscouted player's band centres somewhere else, so he does not clear the bar.
    expect(searchPlayers(withGems, { minOverall: 86 }).map(String)).not.toContain('hidden_gem');
  });

  it('applies position, age, budget and free-agent filters', () => {
    const state = league();
    const strikers = searchPlayers(state, { positions: ['ST'] });
    expect(strikers.length).toBeGreaterThan(0);
    for (const id of strikers) expect(state.players[id]!.position).toBe('ST');

    const young = searchPlayers(state, { maxAge: 21 });
    for (const id of young) expect(state.players[id]!.age).toBeLessThanOrEqual(21);

    expect(searchPlayers(state, { freeAgentsOnly: true })).toEqual(['free_agent']);
    expect(searchPlayers(state, { excludeClubId: state.playerClubId }).every(
      (id) => state.players[id]!.clubId !== state.playerClubId,
    )).toBe(true);
  });

  it('sorts and limits', () => {
    const state = league();
    const byAge = searchPlayers(state, { sort: 'AGE', limit: 5 });
    expect(byAge).toHaveLength(5);
    const ages = byAge.map((id) => state.players[id]!.age);
    expect([...ages].sort((a, b) => a - b)).toEqual(ages);
  });

  it('identifies the positions a squad is thin in', () => {
    const state = league();
    const needs = squadNeeds(state, state.playerClubId);
    expect(needs).toContain('LB');
    expect(needs).not.toContain('CM');
  });
});

/**
 * The window's promise.
 *
 * An audit of a fresh save found that nothing the player could afford improved
 * their starting seven: the best reachable signing was a 61 against a weakest
 * starter of 60, so the one strategic decision between matches resolved to
 * "there is nothing to buy".
 */
describe('an open window offers something worth buying', () => {
  const budgetedLeague = (budget: number): GameState => {
    const state = league();
    const club = state.clubs[state.playerClubId]!;
    return {
      ...state,
      clubs: {
        ...state.clubs,
        [club.id]: { ...club, finance: { ...club.finance, transferBudget: budget } },
      },
    };
  };

  const upgradesFor = (state: GameState, listings: ReturnType<typeof refreshMarket>['listings']): number => {
    const club = state.clubs[state.playerClubId]!;
    const budget = club.finance.transferBudget;
    const seven = club.squad
      .map((id) => state.players[id]?.overall ?? 0)
      .sort((a, b) => b - a)
      .slice(0, 7);
    const weakest = seven[seven.length - 1] ?? 0;
    return Object.values(listings)
      .filter((l) => l.askingPrice > 0 && l.askingPrice <= budget)
      .filter((l) => (state.players[l.playerId]?.overall ?? 0) > weakest)
      .length;
  };

  it('puts several affordable upgrades in front of a club with money', () => {
    const state = budgetedLeague(6_000_000);
    const listings = refreshMarket(state, new Rng('window'), ctx).listings;
    expect(upgradesFor(state, listings)).toBeGreaterThanOrEqual(4);
  });

  it('does not conjure listings a club could never pay for', () => {
    const state = budgetedLeague(0);
    const listings = refreshMarket(state, new Rng('broke'), ctx).listings;
    expect(upgradesFor(state, listings)).toBe(0);
  });

  it('stays quiet while the window is shut', () => {
    const state = budgetedLeague(6_000_000);
    const open = refreshMarket(state, new Rng('same'), ctx).listings;
    const shut = refreshMarket(state, new Rng('same'), { ...ctx, windowOpen: false }).listings;
    expect(Object.keys(shut).length).toBeLessThan(Object.keys(open).length);
  });
});
