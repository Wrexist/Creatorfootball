import { describe, expect, it } from 'vitest';
import { asId } from '../core/brand';
import type { ClubId, CompetitionId, FixtureId, MatchId, SeasonId } from '../core/brand';
import type { Fixture } from '../league/types';
import type { GameState } from '../game/state';
import type { TacticSetup } from '../tactics/tactics';
import { BASE_PACK, ContentRegistry, type CreatorSeasonConfigDef } from '../content';
import { DEFAULT_TACTICS } from '../tactics/tactics';
import { buildTestWorld } from '../simulation/fixtures';
import { buildMatchSetup } from './matchSetup';

const configOf = (): CreatorSeasonConfigDef => {
  const registry = new ContentRegistry();
  registry.load(BASE_PACK);
  return registry.seasonConfig() as CreatorSeasonConfigDef;
};

const fixtureBetween = (home: ClubId, away: ClubId): Fixture => ({
  id: asId<FixtureId>(`fx_${home}_${away}`),
  competitionId: asId<CompetitionId>('comp_1'),
  seasonId: asId<SeasonId>('season_1'),
  week: 5,
  phase: 'MID_SEASON_PUSH',
  homeClubId: home,
  awayClubId: away,
  status: 'SCHEDULED',
  matchId: asId<MatchId>(`match_fx_${home}_${away}`),
  homeScore: null,
  awayScore: null,
  importance: 3,
  isDerby: false,
  enabledSpecialRules: [],
});

const withPlayerTactics = (state: GameState, over: Partial<TacticSetup>): GameState => {
  const club = state.clubs[state.playerClubId];
  if (!club) throw new Error('fixture club missing');
  return {
    ...state,
    clubs: {
      ...state.clubs,
      [state.playerClubId]: {
        ...club,
        tactics: { ...club.tactics, ...over },
      },
    },
  };
};

const sideFor = (setup: { home: { clubId: ClubId }; away: { clubId: ClubId } }, clubId: ClubId) =>
  setup.home.clubId === clubId ? setup.home : setup.away;

describe('buildMatchSetup counter-lean wiring', () => {
  it('starts AI sides on a lean that attacks the player\u2019s parked bus', () => {
    const world = buildTestWorld({ clubCount: 4 });
    const parked = withPlayerTactics(world.state, {
      press: 'LOW_BLOCK', line: 'DEEP', counter: 'ALWAYS', risk: 'CAUTIOUS',
    });
    // The AI side visits the player's ground.
    const fixture = fixtureBetween('club_1' as ClubId, world.state.playerClubId);
    const setup = buildMatchSetup(parked, fixture, configOf());

    const aiSide = sideFor(setup, 'club_1' as ClubId);
    expect(aiSide.tactics.press).toBe('HIGH_PRESS');
    expect(aiSide.tactics.line).toBe('HIGH');
  });

  it('leaves the PLAYER\u2019S own tactics untouched', () => {
    const world = buildTestWorld({ clubCount: 4 });
    const parked = withPlayerTactics(world.state, { press: 'LOW_BLOCK', counter: 'ALWAYS' });
    const fixture = fixtureBetween(world.state.playerClubId, 'club_1' as ClubId);
    const setup = buildMatchSetup(parked, fixture, configOf());

    const ours = sideFor(setup, world.state.playerClubId);
    expect(ours.tactics.press).toBe('LOW_BLOCK');
    expect(ours.tactics.counter).toBe('ALWAYS');
  });

  it('changes nothing when the shape is balanced or the player is not involved', () => {
    const world = buildTestWorld({ clubCount: 4 });
    const config = configOf();

    // Balanced player: the AI keeps its own identity.
    const involved = buildMatchSetup(
      world.state,
      fixtureBetween('club_2' as ClubId, world.state.playerClubId),
      config,
    );
    const aiInInvolved = sideFor(involved, 'club_2' as ClubId);
    expect(aiInInvolved.tactics.press).toBe(DEFAULT_TACTICS.press);

    // Player not involved: pure AI-vs-AI keeps its own identity too.
    const uninvolved = buildMatchSetup(
      world.state,
      fixtureBetween('club_1' as ClubId, 'club_2' as ClubId),
      config,
    );
    for (const team of [uninvolved.home, uninvolved.away]) {
      expect(team.isPlayerControlled).toBe(false);
      expect(team.tactics.press).toBe(DEFAULT_TACTICS.press);
    }
  });
});
