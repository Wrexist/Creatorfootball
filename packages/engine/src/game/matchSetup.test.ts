import { describe, expect, it } from 'vitest';
import { asId } from '../core/brand';
import type { ClubId, CompetitionId, FixtureId, MatchId, SeasonId } from '../core/brand';
import type { Fixture } from '../league/types';
import type { GameState } from '../game/state';
import type { MatchSetup, MatchTeam } from '../matches/simulator';
import type { TacticSetup } from '../tactics/tactics';
import { ContentRegistry, type CreatorSeasonConfigDef } from '../content';
import { BASE_PACK } from '../content/packs/base';
import { DEFAULT_TACTICS } from '../tactics/tactics';
import { buildTestWorld } from '../simulation/fixtures';
import { arenaSupportShare } from './selectors';
import { buildMatchSetup } from './matchSetup';
import { observeTactics } from '../simulation/opponentModel';

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

const sideFor = (setup: Pick<MatchSetup, 'home' | 'away'>, clubId: ClubId): MatchTeam =>
  setup.home.clubId === clubId ? setup.home : setup.away;

/** Play the given shape `times` matches, so the league has actually seen it. */
const havingPlayed = (state: GameState, over: Partial<TacticSetup>, times: number): GameState => {
  const played = withPlayerTactics(state, over);
  let model = played.opponentModel;
  const club = played.clubs[played.playerClubId];
  if (!club) throw new Error('fixture club missing');
  for (let i = 0; i < times; i++) model = observeTactics(model, club.tactics, i + 1);
  return { ...played, opponentModel: model };
};

describe('buildMatchSetup counter-lean wiring', () => {
  const BUS: Partial<TacticSetup> = { press: 'LOW_BLOCK', line: 'DEEP', counter: 'ALWAYS', risk: 'CAUTIOUS' };

  /**
   * The counter has to be *earned*. Setting a shape in the tactics screen is
   * not something any opponent can see; playing it repeatedly is.
   */
  it('does not counter a shape the player has never actually played', () => {
    const world = buildTestWorld({ clubCount: 4 });
    const parked = withPlayerTactics(world.state, BUS);
    const fixture = fixtureBetween('club_1' as ClubId, world.state.playerClubId);
    const setup = buildMatchSetup(parked, fixture, configOf());

    const aiSide = sideFor(setup, 'club_1' as ClubId);
    expect(aiSide.tactics.press).toBe(DEFAULT_TACTICS.press);
  });

  it('starts AI sides on a lean that attacks a bus the player keeps parking', () => {
    const world = buildTestWorld({ clubCount: 4 });
    const seen = havingPlayed(world.state, BUS, 4);
    // The AI side visits the player's ground.
    const fixture = fixtureBetween('club_1' as ClubId, world.state.playerClubId);
    const setup = buildMatchSetup(seen, fixture, configOf());

    const aiSide = sideFor(setup, 'club_1' as ClubId);
    expect(aiSide.tactics.press).toBe('HIGH_PRESS');
    expect(aiSide.tactics.line).toBe('HIGH');
  });

  it('leaves the PLAYER\u2019S own tactics untouched', () => {
    const world = buildTestWorld({ clubCount: 4 });
    const parked = havingPlayed(world.state, { press: 'LOW_BLOCK', counter: 'ALWAYS' }, 4);
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

describe('buildMatchSetup arena support', () => {
  it('carries the real arena share instead of a placeholder half', () => {
    const world = buildTestWorld({ clubCount: 4 });
    const home = 'club_1' as ClubId;
    const away = 'club_2' as ClubId;
    const setup = buildMatchSetup(world.state, fixtureBetween(home, away), configOf());
    expect(setup.homeAdvantage).toBeCloseTo(arenaSupportShare(world.state, home, away), 6);
  });

  it('still arrives at the same share when the away club holds the bigger audience', () => {
    let { state } = buildTestWorld({ clubCount: 4 });
    const club = state.clubs['club_2' as ClubId];
    if (!club) throw new Error('fixture club missing');
    state = {
      ...state,
      clubs: { ...state.clubs, ['club_2' as ClubId]: { ...club, fans: { ...club.fans, onlineFollowers: 5_000_000 } } },
    };
    const setup = buildMatchSetup(state, fixtureBetween('club_1' as ClubId, 'club_2' as ClubId), configOf());
    expect(setup.homeAdvantage).toBeLessThan(0.5);
  });
});
