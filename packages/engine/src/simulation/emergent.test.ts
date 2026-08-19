import { describe, expect, it } from 'vitest';
import type { ClubId, MatchId, PlayerId } from '../core/brand';
import type { GameState } from '../game/state';
import { detectEmergentStories, emergentHooks } from './emergent';
import { buildTestWorld, makeTestEvent, withEvents, withFixture } from './fixtures';

const goal = (matchId: string, scorerId: string, id: string) => makeTestEvent('GOAL_SCORED', {
  matchId: matchId as MatchId, clubId: 'club_0' as ClubId, scorerId: scorerId as PlayerId,
  minute: 30, homeScore: 1, awayScore: 0,
}, { id });

const result = (id: string, type: 'MATCH_WON' | 'MATCH_LOST') => makeTestEvent(type, {
  matchId: 'mx' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_3' as ClubId,
  homeScore: type === 'MATCH_WON' ? 1 : 0, awayScore: type === 'MATCH_WON' ? 0 : 1, margin: 1,
}, { id });

const kinds = (state: GameState): string[] => detectEmergentStories(state).map((s) => s.kind);

describe('derby king', () => {
  const derbies = (scorers: readonly (string | null)[]): GameState => {
    const { state } = buildTestWorld();
    let next = state;
    const events = [];
    for (let i = 0; i < scorers.length; i++) {
      next = withFixture(next, {
        id: `f_d${i}`, week: 2 + i * 3, home: 'club_0' as ClubId, away: 'club_1' as ClubId,
        homeScore: 2, awayScore: 1, isDerby: true,
      });
      const scorer = scorers[i];
      if (scorer) events.push(goal(`match_f_d${i}`, scorer, `ev_d${i}`));
    }
    return withEvents(next, events);
  };

  it('fires when a player scores in three consecutive derbies', () => {
    const state = derbies(['p_0_10', 'p_0_10', 'p_0_10']);
    const stories = detectEmergentStories(state);
    const story = stories.find((s) => s.kind === 'DERBY_KING');
    expect(story).toBeDefined();
    expect(story?.playerId).toBe('p_0_10');
    expect(story?.anchorEventId).toBe('ev_d2');
    expect(story?.evidence.length).toBe(3);
  });

  it('does not fire when the run is broken', () => {
    expect(kinds(derbies(['p_0_10', 'p_0_9', 'p_0_10']))).not.toContain('DERBY_KING');
  });

  it('does not fire on only two derbies', () => {
    expect(kinds(derbies(['p_0_10', 'p_0_10']))).not.toContain('DERBY_KING');
  });
});

describe('clean sheet run', () => {
  const run = (conceded: readonly number[]): GameState => {
    const { state } = buildTestWorld();
    let next = state;
    for (let i = 0; i < conceded.length; i++) {
      next = withFixture(next, {
        id: `f_c${i}`, week: 1 + i, home: 'club_0' as ClubId, away: 'club_3' as ClubId,
        homeScore: 2, awayScore: conceded[i] ?? 0,
      });
    }
    return withEvents(next, [result('ev_res', 'MATCH_WON')]);
  };

  it('fires for a keeper who has not been beaten in three', () => {
    const stories = detectEmergentStories(run([0, 0, 0]));
    const story = stories.find((s) => s.kind === 'CLEAN_SHEET_RUN');
    expect(story).toBeDefined();
    expect(story?.playerId).toBe('p_0_0');
    expect(story?.facts.count).toBe(3);
  });

  it('does not fire when the run was broken last week', () => {
    expect(kinds(run([0, 0, 1]))).not.toContain('CLEAN_SHEET_RUN');
  });
});

describe('flop signing', () => {
  const signing = (over: { appearances: number; goals: number; ratings: number[] }): GameState => {
    const { state } = buildTestWorld();
    const player = state.players['p_0_10'];
    if (!player) throw new Error('fixture player missing');
    const withStats: GameState = {
      ...state,
      players: {
        ...state.players,
        [player.id]: {
          ...player,
          form: { ...player.form, appearances: over.appearances, goals: over.goals, recentRatings: over.ratings },
        },
      },
    };
    return withEvents(withStats, [makeTestEvent('PLAYER_SIGNED', {
      playerId: 'p_0_10' as PlayerId, clubId: 'club_0' as ClubId, fee: 22_000_000, wage: 90_000,
    }, { id: 'ev_signing', cycle: 2 })]);
  };

  it('fires for an expensive signing who is not delivering', () => {
    const stories = detectEmergentStories(signing({ appearances: 9, goals: 0, ratings: [5.8, 6.0, 5.9] }));
    const story = stories.find((s) => s.kind === 'FLOP_SIGNING');
    expect(story).toBeDefined();
    expect(story?.anchorEventId).toBe('ev_signing');
  });

  it('does not fire when the signing is delivering', () => {
    expect(kinds(signing({ appearances: 9, goals: 7, ratings: [7.4, 7.8, 7.1] }))).not.toContain('FLOP_SIGNING');
  });

  it('does not fire before there is enough evidence', () => {
    expect(kinds(signing({ appearances: 2, goals: 0, ratings: [5.5, 5.6] }))).not.toContain('FLOP_SIGNING');
  });
});

describe('breakout arc', () => {
  const arc = (gains: readonly number[]): GameState => {
    const { state } = buildTestWorld();
    return withEvents(state, gains.map((gain, i) => makeTestEvent('PLAYER_DEVELOPED', {
      playerId: 'p_0_1' as PlayerId, clubId: 'club_0' as ClubId, attribute: 'passing',
      from: 60, to: 60 + gain,
    }, { id: `ev_dev${i}` })));
  };

  it('fires for a young player climbing fast', () => {
    const stories = detectEmergentStories(arc([2, 2, 2]));
    const story = stories.find((s) => s.kind === 'BREAKOUT_ARC');
    expect(story).toBeDefined();
    expect(story?.playerId).toBe('p_0_1');
  });

  it('does not fire on ordinary progress', () => {
    expect(kinds(arc([1, 1]))).not.toContain('BREAKOUT_ARC');
  });
});

describe('form runs', () => {
  const runs = (results: readonly ('W' | 'D' | 'L')[]): GameState => {
    const { state } = buildTestWorld();
    let next = state;
    results.forEach((r, i) => {
      next = withFixture(next, {
        id: `f_r${i}`, week: 1 + i, home: 'club_0' as ClubId, away: 'club_4' as ClubId,
        homeScore: r === 'W' ? 2 : 1, awayScore: r === 'W' ? 0 : r === 'D' ? 1 : 3,
      });
    });
    return withEvents(next, [result('ev_run', 'MATCH_WON')]);
  };

  it('fires an unbeaten run at five', () => {
    expect(kinds(runs(['W', 'W', 'D', 'W', 'W']))).toContain('UNBEATEN_RUN');
  });

  it('does not fire at four', () => {
    expect(kinds(runs(['W', 'W', 'D', 'W']))).not.toContain('UNBEATEN_RUN');
  });

  it('fires a winless run and not an unbeaten one', () => {
    const detected = kinds(runs(['D', 'D', 'L', 'D', 'D']));
    expect(detected).toContain('WINLESS_RUN');
    expect(detected).not.toContain('UNBEATEN_RUN');
  });
});

describe('rivalry and records', () => {
  it('fires when a rivalry boils over, with the escalation event as its anchor', () => {
    const { state } = buildTestWorld();
    const key = Object.keys(state.rivalries).find((k) => k.includes('club_0') && k.includes('club_1'));
    expect(key).toBeTruthy();
    const rivalry = state.rivalries[key as string];
    if (!rivalry || !key) return;
    const hot: GameState = withEvents({
      ...state,
      rivalries: {
        ...state.rivalries,
        [key]: {
          ...rivalry,
          intensity: 92,
          incidents: [
            { cycle: 8, text: 'Brawl at the final whistle', severity: 4 },
            { cycle: 9, text: 'Manager accused of disrespect', severity: 3 },
          ],
        },
      },
    }, [makeTestEvent('RIVALRY_INTENSIFIED', {
      rivalryId: key as never, clubA: rivalry.clubAId, clubB: rivalry.clubBId,
      intensity: 6, reason: 'Brawl at the final whistle',
    }, { id: 'ev_riv' })]);
    const story = detectEmergentStories(hot).find((s) => s.kind === 'RIVALRY_BOILING');
    expect(story).toBeDefined();
    expect(story?.anchorEventId).toBe('ev_riv');
  });

  it('fires a record chase when a player is one away', () => {
    const { state } = buildTestWorld();
    const player = state.players['p_0_10'];
    if (!player) throw new Error('fixture player missing');
    const chasing: GameState = withEvents({
      ...state,
      legacy: { ...state.legacy, records: { PLAYER_SEASON_GOALS: { value: 20, season: 1 } } },
      players: { ...state.players, [player.id]: { ...player, form: { ...player.form, goals: 19 } } },
    }, [goal('m_chase', 'p_0_10', 'ev_chase')]);
    const story = detectEmergentStories(chasing).find((s) => s.kind === 'RECORD_CHASE');
    expect(story).toBeDefined();
    expect(story?.anchorEventId).toBe('ev_chase');
  });
});

describe('a quiet world stays quiet', () => {
  it('detects nothing from an empty history', () => {
    const { state } = buildTestWorld();
    expect(detectEmergentStories(state)).toEqual([]);
  });

  it('promotes detected patterns into hooks that keep their anchor', () => {
    const { state } = buildTestWorld();
    let next = state;
    for (let i = 0; i < 5; i++) {
      next = withFixture(next, {
        id: `f_h${i}`, week: 1 + i, home: 'club_0' as ClubId, away: 'club_4' as ClubId,
        homeScore: 2, awayScore: 0,
      });
    }
    next = withEvents(next, [result('ev_hook', 'MATCH_WON')]);
    const stories = detectEmergentStories(next);
    const hooks = emergentHooks(stories, 10);
    expect(hooks.length).toBe(stories.length);
    for (const hook of hooks) {
      expect(hook.sourceEventId).toBeTruthy();
      expect(hook.trigger.startsWith('EMERGENT_')).toBe(true);
      expect(hook.cycle).toBe(10);
    }
  });
});
