import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ClubId, MatchId } from '../core/brand';
import type { GameState, Objective } from '../game/state';
import { Ledger } from '../economy/ledger';
import { buildTestWorld, makeTestEvent } from '../simulation/fixtures';
import { applyObjectiveUpdates, claimObjective, rollObjectives, updateObjectiveProgress } from './objectives';

const won = (id: string) => makeTestEvent('MATCH_WON', {
  matchId: `m_${id}` as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_2' as ClubId,
  homeScore: 2, awayScore: 0, margin: 2,
}, { id });

const completedObjective = (over: Partial<Objective> = {}): Objective => ({
  id: 'obj_test#1',
  title: 'Win 3 matches',
  description: 'Test objective',
  kind: 'WIN_MATCHES',
  target: 3,
  progress: 3,
  rewards: [
    { kind: 'CASH', amount: 500_000, label: 'Bonus' },
    { kind: 'RULE_CARD', amount: 1, ref: 'POWER_PLAY', label: 'Power Play card' },
  ],
  expiresCycle: null,
  status: 'COMPLETED',
  source: 'DYNAMIC',
  importance: 3,
  ...over,
});

describe('rollObjectives', () => {
  const { state } = buildTestWorld();
  const objectives = rollObjectives(state, new Rng('roll'), null);

  it('produces a mixed, non-empty set', () => {
    expect(objectives.length).toBeGreaterThan(0);
    expect(objectives.every((o) => o.status === 'ACTIVE')).toBe(true);
    expect(objectives.every((o) => o.title.length > 0 && !o.title.includes('{'))).toBe(true);
  });

  it('never rolls a target of zero or below', () => {
    for (const objective of objectives) {
      if (objective.kind === 'AVOID_RED_CARDS') continue;
      expect(objective.target, objective.title).toBeGreaterThan(0);
    }
  });

  it('never asks for more wins than there are matches left', () => {
    const season = state.seasons[state.currentSeasonId];
    const remaining = (season?.totalWeeks ?? 0) - (season?.currentWeek ?? 0);
    for (const objective of objectives.filter((o) => o.kind === 'WIN_MATCHES')) {
      expect(objective.target).toBeLessThanOrEqual(remaining);
    }
  });

  it('never asks for a league position that does not exist', () => {
    const clubCount = Object.keys(state.clubs).length;
    for (const objective of objectives.filter((o) => o.kind === 'LEAGUE_POSITION')) {
      expect(objective.target).toBeGreaterThanOrEqual(1);
      expect(objective.target).toBeLessThanOrEqual(clubCount);
    }
  });

  it('never rolls a standing target that is already met', () => {
    const club = state.clubs[state.playerClubId];
    for (const objective of objectives) {
      if (objective.kind === 'FAN_SENTIMENT') expect(objective.target).toBeGreaterThan(club?.fans.sentiment ?? 0);
      if (objective.kind === 'GAIN_FOLLOWERS') expect(objective.target).toBeGreaterThan(club?.fans.onlineFollowers ?? 0);
    }
  });

  it('does not offer silverware to a club with no chance of it', () => {
    const bottom: GameState = {
      ...state,
      clubs: Object.fromEntries(Object.entries(state.clubs).map(([id, club]) => [
        id,
        id === state.playerClubId
          ? { ...club, reputation: 20, seasonRecord: { ...club.seasonRecord, played: 18, won: 1, drawn: 2, lost: 15 } }
          : { ...club, seasonRecord: { ...club.seasonRecord, played: 18, won: 12, drawn: 3, lost: 3 } },
      ])),
      seasons: {
        ...state.seasons,
        [state.currentSeasonId]: { ...state.seasons[state.currentSeasonId]!, currentWeek: 20 },
      },
    };
    const doomed = rollObjectives(bottom, new Rng('doomed'), null);
    expect(doomed.some((o) => o.kind === 'TROPHY')).toBe(false);
    for (const objective of doomed.filter((o) => o.kind === 'WIN_MATCHES')) {
      expect(objective.target).toBeLessThanOrEqual(2);
    }
  });

  it('is deterministic for a fixed seed', () => {
    const a = rollObjectives(state, new Rng('same'), null);
    const b = rollObjectives(state, new Rng('same'), null);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('updateObjectiveProgress', () => {
  const { state } = buildTestWorld();
  const withObjective = (objective: Objective): GameState =>
    ({ ...state, objectives: { ...state.objectives, active: [objective] } });

  it('advances from domain events only', () => {
    const objective = completedObjective({ progress: 0, status: 'ACTIVE' });
    const updates = updateObjectiveProgress(withObjective(objective), [won('a'), won('b')]);
    expect(updates[0]?.to).toBe(2);
    expect(updates[0]?.justCompleted).toBe(false);
  });

  it('marks completion when the target is reached', () => {
    const objective = completedObjective({ progress: 2, status: 'ACTIVE' });
    const updates = updateObjectiveProgress(withObjective(objective), [won('c')]);
    expect(updates[0]?.justCompleted).toBe(true);
    const applied = applyObjectiveUpdates(withObjective(objective), updates);
    expect(applied.active[0]?.status).toBe('COMPLETED');
  });

  it('fails an objective that expires unmet', () => {
    const objective = completedObjective({ progress: 0, status: 'ACTIVE', expiresCycle: 5 });
    const updates = updateObjectiveProgress(withObjective(objective), []);
    expect(updates[0]?.justFailed).toBe(true);
    const applied = applyObjectiveUpdates(withObjective(objective), updates);
    expect(applied.active).toHaveLength(0);
    expect(applied.completed[0]?.status).toBe('FAILED');
  });

  it('ignores events belonging to other clubs', () => {
    const objective = completedObjective({ progress: 0, status: 'ACTIVE' });
    const other = makeTestEvent('MATCH_WON', {
      matchId: 'm_o' as MatchId, clubId: 'club_3' as ClubId, opponentId: 'club_2' as ClubId,
      homeScore: 1, awayScore: 0, margin: 1,
    }, { id: 'ev_other' });
    const updates = updateObjectiveProgress(withObjective(objective), [other]);
    expect(updates[0]?.to).toBe(0);
  });
});

describe('claimObjective', () => {
  const setup = () => {
    const world = buildTestWorld();
    const ledger = Ledger.restore(world.state.ledger);
    const objective = completedObjective();
    const state: GameState = {
      ...world.state,
      objectives: { ...world.state.objectives, active: [objective] },
    };
    return { state, ledger, objective };
  };
  const ctx = { cycle: 10, season: 1, at: 0 };

  it('pays out through the ledger and returns non-cash grants', () => {
    const { state, ledger, objective } = setup();
    const before = ledger.cashOf(state.playerClubId);
    const result = claimObjective(state, ledger, objective.id, ctx);
    expect(result.ok).toBe(true);
    expect(ledger.cashOf(state.playerClubId)).toBe(before + 500_000);
    expect(result.transactions).toHaveLength(2);
    expect(result.grants.map((g) => g.kind)).toEqual(['RULE_CARD']);
    expect(result.state?.objectives.completed.some((o) => o.id === objective.id && o.status === 'CLAIMED')).toBe(true);
  });

  it('can never be claimed twice', () => {
    const { state, ledger, objective } = setup();
    const first = claimObjective(state, ledger, objective.id, ctx);
    expect(first.ok).toBe(true);
    const balanceAfterFirst = ledger.cashOf(state.playerClubId);

    const second = claimObjective(first.state as GameState, ledger, objective.id, ctx);
    expect(second.ok).toBe(false);
    expect(second.error).toBe('ALREADY_CLAIMED');
    expect(ledger.cashOf(state.playerClubId)).toBe(balanceAfterFirst);

    // Even replaying the *original* state cannot double-pay: the ledger holds
    // the idempotency key, not the objective record.
    const replay = claimObjective(state, ledger, objective.id, ctx);
    expect(replay.ok).toBe(false);
    expect(replay.error).toBe('ALREADY_CLAIMED');
    expect(ledger.cashOf(state.playerClubId)).toBe(balanceAfterFirst);
  });

  it('refuses an objective that is not complete', () => {
    const { state, ledger } = setup();
    const active: GameState = {
      ...state,
      objectives: { ...state.objectives, active: [completedObjective({ status: 'ACTIVE', progress: 1 })] },
    };
    const result = claimObjective(active, ledger, 'obj_test#1', ctx);
    expect(result.ok).toBe(false);
    expect(result.error).toBe('NOT_COMPLETE');
  });

  it('refuses an objective that does not exist', () => {
    const { state, ledger } = setup();
    expect(claimObjective(state, ledger, 'obj_missing', ctx).error).toBe('NOT_FOUND');
  });
});
