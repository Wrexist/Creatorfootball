import { describe, expect, it } from 'vitest';
import { createNewGame } from './newGame';
import { advanceCycle } from './cycle';
import { buildMatchSetup } from './matchSetup';
import { simulateMatch } from '../matches/simulator';
import { BASE_PACK } from '../content';
import type { CreatorSeasonConfigDef } from '../content';

const career = () => createNewGame({ seed: 'availability-clock', now: 1000,
  manager: { kind: 'PREMADE', templateId: BASE_PACK.data.managers![0]!.id },
  club: { kind: 'TEMPLATE', templateId: BASE_PACK.data.clubs![0]!.id },
});

describe('availability through a full matchweek', () => {
  it('serves one missed match and heals one week; new match injuries and red cards keep their term', () => {
    let state = career();
    const club = state.clubs[state.playerClubId]!;
    const [injured, banned] = club.squad;
    state = { ...state, clubs: { ...state.clubs, [club.id]: { ...club, facilityLevels: { facility_medical: 2, facility_recovery: 2 } } }, players: {
      ...state.players,
      [injured!]: { ...state.players[injured!]!, injury: { severity: 'MODERATE', weeksRemaining: 3, sustainedCycle: -1, description: 'Earlier injury' } },
      [banned!]: { ...state.players[banned!]!, suspensionMatches: 2 },
    } };
    const fixture = Object.values(state.fixtures).find(f => f.week === 1 && (f.homeClubId === club.id || f.awayClubId === club.id))!;
    const result = simulateMatch(buildMatchSetup(state, fixture, BASE_PACK.data.seasonConfig as CreatorSeasonConfigDef));
    const participant = Object.keys(result.playerStats).find(id => state.players[id]?.clubId === club.id)!;
    const stats = result.playerStats[participant]!;
    const patched = { ...result, injuries: [{ playerId: stats.playerId, severity: 'MODERATE', weeksOut: 3 }],
      playerStats: { ...result.playerStats, [participant]: { ...stats, redCards: 1 } } };
    const next = advanceCycle(state, { now: 2000, playerResult: patched }).state;
    expect(next.players[injured!]!.injury?.weeksRemaining).toBe(2);
    expect(next.players[banned!]!.suspensionMatches).toBe(1);
    expect(next.players[participant]!.injury?.weeksRemaining).toBe(3);
    expect(next.players[participant]!.suspensionMatches).toBeGreaterThan(0);
    expect(state.players[injured!]!.injury?.weeksRemaining).toBe(3);
  });

  it('does not serve a suspension in a fixture-free week', () => {
    const state = career(), id = state.clubs[state.playerClubId]!.squad[0]!;
    const next = advanceCycle({ ...state, fixtures: {}, players: { ...state.players, [id]: { ...state.players[id]!, suspensionMatches: 2 } } }, { now: 2000 });
    expect(next.state.players[id]!.suspensionMatches).toBe(2);
  });
});
