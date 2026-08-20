import { describe, expect, it } from 'vitest';
import type { ClubId, MatchId, PlayerId, SeasonId } from '../core/brand';
import type { GameState } from '../game/state';
import { buildTestWorld, makeTestEvent, withEvents } from '../simulation/fixtures';
import { detectRecords, summariseSeason, updateLegacy } from './legacy';

describe('updateLegacy', () => {
  const { state } = buildTestWorld();

  it('records trophies and marks a milestone', () => {
    const legacy = updateLegacy(state, [makeTestEvent('TROPHY_WON', {
      clubId: 'club_0' as ClubId, competition: 'Test League', season: 1,
    }, { id: 'ev_trophy', importance: 5 })]);
    expect(legacy.trophies).toHaveLength(1);
    expect(legacy.trophies[0]?.competition).toBe('Test League');
    expect(legacy.milestones.some((m) => m.text.includes('Test League'))).toBe(true);
  });

  it('ignores trophies won by other clubs', () => {
    const legacy = updateLegacy(state, [makeTestEvent('TROPHY_WON', {
      clubId: 'club_3' as ClubId, competition: 'Test League', season: 1,
    }, { id: 'ev_trophy_other', importance: 5 })]);
    expect(legacy.trophies).toHaveLength(0);
  });

  it('stores broken records with their holder', () => {
    const legacy = updateLegacy(state, [makeTestEvent('RECORD_BROKEN', {
      clubId: 'club_0' as ClubId, record: 'PLAYER_SEASON_GOALS', value: 24, holderId: 'p_0_10' as PlayerId,
    }, { id: 'ev_rec', importance: 5 })]);
    expect(legacy.records['PLAYER_SEASON_GOALS']?.value).toBe(24);
    expect(legacy.records['PLAYER_SEASON_GOALS']?.holderId).toBe('p_0_10');
    expect(legacy.records['PLAYER_SEASON_GOALS']?.holderName).toBeTruthy();
  });

  it('appends a season summary when the season completes', () => {
    const legacy = updateLegacy(state, [makeTestEvent('SEASON_COMPLETED', {
      seasonId: 'season_1' as SeasonId, season: 1, championClubId: 'club_0' as ClubId, playerPosition: 1,
    }, { id: 'ev_season', importance: 5 })]);
    expect(legacy.seasonSummaries).toHaveLength(1);
    expect(legacy.seasonSummaries[0]?.season).toBe(1);
  });

  it('promotes long-serving players to legends', () => {
    const player = state.players['p_0_10'];
    if (!player) throw new Error('fixture player missing');
    const served: GameState = {
      ...state,
      players: {
        ...state.players,
        [player.id]: {
          ...player,
          form: { ...player.form, appearances: 80, goals: 30, assists: 20 },
        },
      },
    };
    const legacy = updateLegacy(served, []);
    expect(legacy.legends.some((l) => l.playerId === player.id)).toBe(true);
    // Idempotent: a second pass does not duplicate them.
    const again = updateLegacy({ ...served, legacy }, []);
    expect(again.legends.filter((l) => l.playerId === player.id)).toHaveLength(1);
  });
});

describe('detectRecords', () => {
  it('finds a new club goalscoring record and its holder', () => {
    const { state } = buildTestWorld();
    const player = state.players['p_0_10'];
    if (!player) throw new Error('fixture player missing');
    const scoring: GameState = {
      ...state,
      players: { ...state.players, [player.id]: { ...player, form: { ...player.form, goals: 12 } } },
    };
    const records = detectRecords(scoring, { seasonAggregates: true });
    const goals = records.find((r) => r.key === 'PLAYER_SEASON_GOALS');
    expect(goals?.value).toBe(12);
    expect(goals?.holderId).toBe(player.id);
  });

  // Season aggregates only grow, so comparing them to the record book every
  // cycle broke the same record every week and made a quarter of the season's
  // press one headline. They are edge-triggered at the end of the season now.
  it('does not evaluate season aggregates mid-season', () => {
    const { state } = buildTestWorld();
    const player = state.players['p_0_10'];
    if (!player) throw new Error('fixture player missing');
    const scoring: GameState = {
      ...state,
      players: { ...state.players, [player.id]: { ...player, form: { ...player.form, goals: 12 } } },
    };
    expect(detectRecords(scoring).some((r) => r.key === 'PLAYER_SEASON_GOALS')).toBe(false);
  });

  it('does not re-announce a record that already stands higher', () => {
    const { state } = buildTestWorld();
    const player = state.players['p_0_10'];
    if (!player) throw new Error('fixture player missing');
    const scoring: GameState = {
      ...state,
      legacy: { ...state.legacy, records: { PLAYER_SEASON_GOALS: { value: 20, season: 1 } } },
      players: { ...state.players, [player.id]: { ...player, form: { ...player.form, goals: 12 } } },
    };
    expect(
      detectRecords(scoring, { seasonAggregates: true }).some((r) => r.key === 'PLAYER_SEASON_GOALS'),
    ).toBe(false);
  });

  it('finds the biggest win and the record signing from the journal', () => {
    const { state } = buildTestWorld();
    const withHistory = withEvents(state, [
      makeTestEvent('MATCH_WON', {
        matchId: 'm1' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_1' as ClubId,
        homeScore: 6, awayScore: 0, margin: 6,
      }, { id: 'ev_big' }),
      makeTestEvent('PLAYER_SIGNED', {
        playerId: 'p_0_3' as PlayerId, clubId: 'club_0' as ClubId, fee: 31_000_000, wage: 100_000,
      }, { id: 'ev_fee' }),
    ]);
    const records = detectRecords(withHistory);
    expect(records.find((r) => r.key === 'BIGGEST_WIN')?.value).toBe(6);
    expect(records.find((r) => r.key === 'RECORD_SIGNING')?.value).toBe(31_000_000);
  });
});

describe('summariseSeason', () => {
  it('summarises the player club season with position and top scorer', () => {
    const { state } = buildTestWorld();
    const club = state.clubs[state.playerClubId];
    const player = state.players['p_0_10'];
    if (!club || !player) throw new Error('fixture missing');
    const played: GameState = {
      ...state,
      clubs: {
        ...state.clubs,
        [club.id]: { ...club, seasonRecord: { played: 20, won: 14, drawn: 3, lost: 3, goalsFor: 44, goalsAgainst: 18 } },
      },
      players: { ...state.players, [player.id]: { ...player, form: { ...player.form, goals: 17 } } },
    };
    const summary = summariseSeason(played);
    expect(summary.position).toBe(1);
    expect(summary.won).toBe(14);
    expect(summary.topScorerId).toBe(player.id);
    expect(summary.topScorerGoals).toBe(17);
    expect(summary.endFanSentiment).toBe(club.fans.sentiment);
  });
});
