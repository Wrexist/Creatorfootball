import { describe, expect, it } from 'vitest';
import { asId } from '../core/brand';
import type { ClubId, FixtureId, MatchId } from '../core/brand';
import { GameEventFactory } from './eventFactory';
import type { Fixture } from '../league/types';
import type { GameState } from './state';
import { buildTestWorld } from '../simulation/fixtures';
import type { DecisionOutcome, DecisionTrigger } from '../matches/decisions';
import type { MatchResult } from '../matches/result';
import { BALANCE } from '../matches/balance';
import { applyMatchResult } from './applyResult';

const fixtureFor = (state: GameState, home: ClubId, away: ClubId): Fixture => ({
  id: asId<FixtureId>(`fx_${home}_${away}`),
  competitionId: state.currentCompetitionId,
  seasonId: state.currentSeasonId,
  week: state.clock.week + 1,
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

const outcome = (trigger: string): DecisionOutcome =>
  ({ promptId: `p_${trigger}`, optionId: 'o1', minute: 12, trigger }) as DecisionOutcome;

const resultFor = (state: GameState, decisions: readonly DecisionOutcome[]): MatchResult => ({
  matchId: asId<MatchId>('m_test'),
  seed: 'test',
  homeClubId: state.playerClubId,
  awayClubId: 'club_1' as ClubId,
  homeScore: 2,
  awayScore: 1,
  winner: 'home',
  events: [],
  homeStats: {
    clubId: state.playerClubId, goals: 2, possession: 55, shots: 10, shotsOnTarget: 5,
    xg: 2.1, passes: 100, passAccuracy: 80, tackles: 5, interceptions: 4, corners: 2,
    fouls: 3, offsides: 1, yellowCards: 0, redCards: 0, bigChances: 2, bigChancesMissed: 1,
  },
  awayStats: {
    clubId: 'club_1' as ClubId, goals: 1, possession: 45, shots: 8, shotsOnTarget: 3,
    xg: 1.2, passes: 90, passAccuracy: 78, tackles: 6, interceptions: 3, corners: 1,
    fouls: 4, offsides: 0, yellowCards: 1, redCards: 0, bigChances: 1, bigChancesMissed: 0,
  },
  playerStats: {},
  motmPlayerId: null,
  momentumTimeline: [],
  specialRules: [],
  decisions,
  attendance: 8000,
  importance: 3,
  keyMomentEventId: null,
  injuries: [],
  ruleCardsPlayed: [],
  durationMinutes: 30,
});

const emptyMemory = (state: GameState): GameState => ({
  ...state,
  decisionMemory: { recentTriggers: [] },
});

describe('decision memory folding', () => {
  it('remembers the triggers the player was asked about', () => {
    const { state } = buildTestWorld({ clubCount: 4 });
    const fixture = fixtureFor(state, state.playerClubId, 'club_1' as ClubId);
    const result = resultFor(emptyMemory(state), [outcome('HALFTIME_TALK'), outcome('UNDER_PRESSURE'), outcome('HALFTIME_TALK')]);

    const applied = applyMatchResult(emptyMemory(state), fixture, result, new GameEventFactory(state, 0));
    // Repeats within one match are folded out.
    expect(applied.state.decisionMemory.recentTriggers).toEqual(['HALFTIME_TALK', 'UNDER_PRESSURE']);
  });

  it('ignores matches the player played no part in', () => {
    const { state } = buildTestWorld({ clubCount: 4 });
    const fixture = fixtureFor(state, 'club_1' as ClubId, 'club_2' as ClubId);
    const result: MatchResult = {
      ...resultFor(state, [outcome('HALFTIME_TALK')]),
      homeClubId: 'club_1' as ClubId,
      awayClubId: 'club_2' as ClubId,
      winner: 'draw',
      homeScore: 1,
      awayScore: 1,
    };

    const applied = applyMatchResult(emptyMemory(state), fixture, result, new GameEventFactory(state, 0));
    expect(applied.state.decisionMemory.recentTriggers).toEqual([]);
  });

  it('keeps only the most recent tail of served triggers', () => {
    const { state } = buildTestWorld({ clubCount: 4 });
    const depth = BALANCE.DECISION_MEMORY_DEPTH;
    const old: DecisionTrigger[] = Array.from(
      { length: depth },
      (_, i) => `TRIGGER_${i}` as DecisionTrigger,
    );
    let seeded: GameState = { ...emptyMemory(state), decisionMemory: { recentTriggers: old } };
    const fixture = fixtureFor(seeded, seeded.playerClubId, 'club_1' as ClubId);
    const result = resultFor(seeded, [outcome('NEW_ONE'), outcome('ANOTHER')]);

    seeded = applyMatchResult(seeded, fixture, result, new GameEventFactory(seeded, 0)).state;

    expect(seeded.decisionMemory.recentTriggers.length).toBe(depth);
    expect(seeded.decisionMemory.recentTriggers.slice(-2)).toEqual(['NEW_ONE', 'ANOTHER']);
    // The oldest entry fell off the front.
    expect(seeded.decisionMemory.recentTriggers).not.toContain(`TRIGGER_0`);
  });
});
