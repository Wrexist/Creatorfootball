import { describe, expect, it } from 'vitest';
import type { ClubId, MatchId, PlayerId, SeasonId } from '../core/brand';
import type { AnyDomainEvent } from '../core/events';
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

  /**
   * The default milestone branch used to render raw event-type slugs —
   * "player morale changed", "objective completed" — straight onto the history
   * screen. Every event type the engine can emit must land as prose instead.
   */
  it('writes prose for every known event type; no slug fallback anywhere', () => {
    const payloads: readonly (readonly [string, Record<string, unknown>])[] = [
      ['GAME_STARTED', { saveId: 's1', clubId: 'club_0', managerName: 'A. Manager' }],
      ['SEASON_STARTED', { seasonId: 'season_1', season: 1 }],
      ['SEASON_COMPLETED', { seasonId: 'season_1', season: 1, championClubId: 'club_0', playerPosition: 1 }],
      ['CYCLE_ADVANCED', { from: 1, to: 2 }],
      ['MATCH_SCHEDULED', { matchId: 'm1', homeClubId: 'club_0', awayClubId: 'club_1', week: 11 }],
      ['MATCH_STARTED', { matchId: 'm1', homeClubId: 'club_0', awayClubId: 'club_1' }],
      ['GOAL_SCORED', { matchId: 'm1', clubId: 'club_0', scorerId: 'p_0_10', minute: 12, homeScore: 1, awayScore: 0 }],
      ['MATCH_WON', { matchId: 'm1', clubId: 'club_0', opponentId: 'club_1', homeScore: 2, awayScore: 0, margin: 2 }],
      ['MATCH_LOST', { matchId: 'm1', clubId: 'club_0', opponentId: 'club_1', homeScore: 0, awayScore: 2, margin: 2 }],
      ['MATCH_DRAWN', { matchId: 'm1', clubId: 'club_0', opponentId: 'club_1', score: 1 }],
      ['PLAYER_INJURED', { playerId: 'p_0_10', clubId: 'club_0', weeksOut: 3, severity: 'Knock' }],
      ['PLAYER_RECOVERED', { playerId: 'p_0_10', clubId: 'club_0' }],
      ['RED_CARD', { playerId: 'p_0_10', clubId: 'club_0', matchId: 'm1', minute: 33 }],
      ['MOTM_AWARDED', { playerId: 'p_0_10', clubId: 'club_0', matchId: 'm1', rating: 8.4 }],
      ['SPECIAL_RULE_TRIGGERED', { matchId: 'm1', rule: 'golden_goal', clubId: 'club_0', minute: 25 }],
      ['LIVE_DECISION_MADE', { matchId: 'm1', promptId: 'p1', optionId: 'o1', minute: 20 }],
      ['PLAYER_SIGNED', { playerId: 'p_0_10', clubId: 'club_0', fee: 5_000_000, wage: 40_000 }],
      ['PLAYER_SOLD', { playerId: 'p_0_10', fromClubId: 'club_0', toClubId: 'club_1', fee: 6_000_000 }],
      ['PLAYER_RELEASED', { playerId: 'p_0_10', clubId: 'club_0' }],
      ['CONTRACT_SIGNED', { contractId: 'ct_1', playerId: 'p_0_10', clubId: 'club_0', years: 3, wage: 42_000 }],
      ['CONTRACT_EXPIRING', { playerId: 'p_0_10', clubId: 'club_0', weeksLeft: 8 }],
      ['PLAYER_DEVELOPED', { playerId: 'p_0_10', clubId: 'club_0', attribute: 'passing', from: 60, to: 65 }],
      ['PLAYER_BREAKOUT', { playerId: 'p_0_10', clubId: 'club_0', overall: 72 }],
      ['YOUTH_PROSPECT_PROMOTED', { playerId: 'p_0_10', clubId: 'club_0' }],
      ['PLAYER_MORALE_CHANGED', { playerId: 'p_0_10', clubId: 'club_0', from: 70, to: 30, reason: 'benched twice' }],
      ['TRANSFER_BID_MADE', { transferId: 'tr_1', playerId: 'p_0_10', fromClubId: 'club_1', toClubId: 'club_0', amount: 7_000_000 }],
      ['TRANSFER_BID_REJECTED', { transferId: 'tr_1', playerId: 'p_0_10', reason: 'too low' }],
      ['TRANSFER_COMPLETED', { transferId: 'tr_1', playerId: 'p_0_10', fromClubId: 'club_1', toClubId: 'club_0', fee: 7_000_000 }],
      ['TRANSFER_HIJACKED', { playerId: 'p_0_10', byClubId: 'club_2', fromClubId: 'club_0' }],
      ['SCOUT_REPORT_READY', { playerId: 'p_0_10', clubId: 'club_0', confidence: 0.9 }],
      ['CLUB_CREATED', { clubId: 'club_0', name: 'Club 0' }],
      ['FACILITY_UPGRADED', { clubId: 'club_0', facilityId: 'fac_gym', level: 3 }],
      ['SPONSOR_SIGNED', { clubId: 'club_0', sponsorId: 'spn_x', value: 90_000 }],
      ['SPONSOR_LOST', { clubId: 'club_0', sponsorId: 'spn_x', reason: 'a poor run' }],
      ['FAN_SENTIMENT_CHANGED', { clubId: 'club_0', from: 60, to: 45, reason: 'three defeats' }],
      ['ATTENDANCE_RECORDED', { clubId: 'club_0', matchId: 'm1', attendance: 8_000, capacity: 10_000 }],
      ['REPUTATION_CHANGED', { clubId: 'club_0', from: 50, to: 58, reason: 'strong results' }],
      ['MANAGER_SACKED', { clubId: 'club_0', managerName: 'A. Manager' }],
      ['RIVALRY_INTENSIFIED', { rivalryId: 'rv_1', clubA: 'club_0', clubB: 'club_1', intensity: 80, reason: 'a spiky derby' }],
      ['RIVALRY_CREATED', { rivalryId: 'rv_1', clubA: 'club_0', clubB: 'club_1' }],
      ['RECORD_BROKEN', { clubId: 'club_0', record: 'Most goals in a season', value: 24, holderId: 'p_0_10' }],
      ['STORY_PUBLISHED', { storyId: 'st_1', headline: 'The headline of the day', importance: 5 }],
      ['CREATOR_MOMENT', { creatorId: 'creator_x', clubId: 'club_0', kind: 'matchday vlog', reach: 900_000 }],
      ['CREATOR_JOINED', { creatorId: 'creator_x', clubId: 'club_0', role: 'CLUB_PERSONALITY' }],
      ['OBJECTIVE_COMPLETED', { objectiveId: 'obj_1', title: 'Win the league', rewardSummary: 'Cash and reputation' }],
      ['OBJECTIVE_FAILED', { objectiveId: 'obj_1', title: 'Win the league' }],
      ['REWARD_CLAIMED', { rewardId: 'rw_1', kind: 'COSMETIC', amount: 1 }],
      ['TROPHY_WON', { clubId: 'club_0', competition: 'Test League', season: 1 }],
      ['PROMOTED', { clubId: 'club_0', toTier: 1 }],
      ['RELEGATED', { clubId: 'club_0', toTier: 2 }],
      ['BALANCE_LOW', { clubId: 'club_0', balance: -100 }],
    ];

    const bigEvent = ([type, payload]: readonly [string, Record<string, unknown>], index: number): AnyDomainEvent =>
      makeTestEvent(type as never, payload as never, {
        id: `ev_probe_${index}`,
        importance: 5,
        entities: [{ kind: 'club', id: 'club_0', name: 'Club 0' }],
      });

    const legacy = updateLegacy(state, payloads.map(bigEvent));
    const written = new Set(legacy.milestones.filter((m) => m.cycle === 10).map((m) => m.text));

    for (const [type] of payloads) {
      const slug = type.replace(/_/g, ' ').toLowerCase();
      const matching = [...written].filter((text) => text.includes(slug));
      // A slug may appear inside real prose ("...the golden goal card...") but
      // a milestone whose entire text IS the slug means the fallback fired.
      expect(matching, `${type} rendered as a raw slug`).not.toContain(slug);
    }
    // Every probe produced exactly one milestone for its cycle.
    expect(written.size).toBe(payloads.length);
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
