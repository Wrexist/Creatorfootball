import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ClubId, MatchId, PlayerId } from '../core/brand';
import type { MediaTemplate } from '../content/schema';
import type { GameState } from '../game/state';
import type { Manager } from '../creators/manager';
import { buildTestWorld, makeTestEvent } from '../simulation/fixtures';
import { generateStories, mediaVolumeFor, storyReach } from './mediaEngine';

const won = (id: string, margin: number, opponent: string) => makeTestEvent('MATCH_WON', {
  matchId: `m_${id}` as MatchId, clubId: 'club_0' as ClubId, opponentId: opponent as ClubId,
  homeScore: margin, awayScore: 0, margin,
}, { id, importance: 3 });

const redCard = (id: string) => makeTestEvent('RED_CARD', {
  playerId: 'p_0_5' as PlayerId, clubId: 'club_0' as ClubId, matchId: 'm_r' as MatchId, minute: 40,
}, { id, importance: 4 });

const withManager = (state: GameState, over: Partial<Manager>): GameState => {
  const manager = state.managers[state.playerManagerId];
  if (!manager) return state;
  return { ...state, managers: { ...state.managers, [manager.id]: { ...manager, ...over } } };
};

describe('story importance reflects the stakes', () => {
  const { state } = buildTestWorld();

  it('sizes a derby rout above a routine win', () => {
    const rout = generateStories([won('ev_rout', 6, 'club_1')], state, new Rng('m1'), null);
    const routine = generateStories([won('ev_routine', 1, 'club_4')], state, new Rng('m1'), null);
    const routImportance = Math.max(...rout.map((s) => s.importance));
    const routineImportance = Math.max(...routine.map((s) => s.importance));
    expect(routImportance).toBeGreaterThan(routineImportance);
  });

  it('never publishes an unresolved token', () => {
    const stories = generateStories(
      [won('ev_a', 3, 'club_1'), redCard('ev_b')],
      state, new Rng('m2'), null,
    );
    expect(stories.length).toBeGreaterThan(0);
    for (const story of stories) {
      expect(story.headline).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(story.body).not.toMatch(/\{[a-zA-Z]+\}/);
      expect(story.entities.length).toBeGreaterThan(0);
      expect(story.imageSeed).toBeTruthy();
      expect(story.outlet).toBeTruthy();
    }
  });

  it('is deterministic for a fixed seed', () => {
    const events = [won('ev_c', 2, 'club_2')];
    const a = generateStories(events, state, new Rng('same'), null);
    const b = generateStories(events, state, new Rng('same'), null);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('anti-repetition', () => {
  it('does not run the same headline in consecutive cycles', () => {
    const { state } = buildTestWorld();
    const first = generateStories([redCard('ev_r1')], state, new Rng('rep'), null);
    const headline = first[0]?.headline;
    expect(headline).toBeTruthy();
    const next: GameState = {
      ...state,
      clock: { ...state.clock, cycle: 11 },
      media: { stories: first },
    };
    const second = generateStories([redCard('ev_r2')], next, new Rng('rep'), null, { cycle: 11 });
    expect(second.length).toBeGreaterThan(0);
    for (const story of second) expect(story.headline).not.toBe(headline);
  });
});

describe('the manager shapes their own coverage', () => {
  it('damps negative coverage for a strong communicator', () => {
    const { state } = buildTestWorld();
    const poor = withManager(state, {
      attributes: { ...state.managers[state.playerManagerId]!.attributes, mediaHandling: 5 },
      mediaStyle: 'COMBATIVE',
    });
    const strong = withManager(state, {
      attributes: { ...state.managers[state.playerManagerId]!.attributes, mediaHandling: 95 },
      mediaStyle: 'CHARMING',
    });
    const event = redCard('ev_damp');
    const poorStories = generateStories([event], poor, new Rng('damp'), null);
    const strongStories = generateStories([event], strong, new Rng('damp'), null);
    const worst = (stories: readonly { sentiment: number }[]): number => Math.min(...stories.map((s) => s.sentiment));
    expect(worst(strongStories)).toBeGreaterThan(worst(poorStories));
  });

  it('leaves other clubs alone', () => {
    const { state } = buildTestWorld();
    const rivalRed = makeTestEvent('RED_CARD', {
      playerId: 'p_2_5' as PlayerId, clubId: 'club_2' as ClubId, matchId: 'm_x' as MatchId, minute: 12,
    }, { id: 'ev_other', importance: 4 });
    const calm = withManager(state, {
      attributes: { ...state.managers[state.playerManagerId]!.attributes, mediaHandling: 99 },
    });
    const stories = generateStories([rivalRed], calm, new Rng('other'), null);
    expect(stories.some((s) => s.sentiment < -0.3)).toBe(true);
  });
});

describe('content pack integration', () => {
  it('prefers pack templates and degrades to the built-in set', () => {
    const { state } = buildTestWorld();
    const packTemplate: MediaTemplate = {
      id: 'pack_red', trigger: 'RED_CARD',
      headline: 'PACK: {player} dismissed', body: '{club} are down to ten.',
      outlets: ['Counter Press'], importance: 4, sentiment: -0.5, weight: 10_000,
    };
    const registry = {
      mediaTemplates: () => [packTemplate],
      socialTemplates: () => [],
      objectives: () => [],
    };
    const stories = generateStories([redCard('ev_pack')], state, new Rng('pack'), registry);
    expect(stories.some((s) => s.headline.startsWith('PACK:'))).toBe(true);

    const fallback = generateStories([redCard('ev_fallback')], state, new Rng('pack'), null);
    expect(fallback.length).toBeGreaterThan(0);
  });
});

describe('reach helpers', () => {
  it('scales reach with importance and counts media volume per club', () => {
    const { state } = buildTestWorld();
    const stories = generateStories([won('ev_reach', 5, 'club_1')], state, new Rng('reach'), null);
    const story = stories[0];
    expect(story).toBeDefined();
    if (!story) return;
    expect(storyReach(story)).toBeGreaterThan(0);
    expect(mediaVolumeFor(stories, 'club_0')).toBeGreaterThan(0);
  });
});
