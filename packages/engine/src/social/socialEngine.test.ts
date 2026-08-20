import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ClubId, MatchId, PlayerId } from '../core/brand';
import { expandCascade } from '../simulation/cascade';
import { clubToken } from '../simulation/ports';
import { buildTestWorld, makeTestEvent, withEvents } from '../simulation/fixtures';
import { generatePosts, socialReach } from './socialEngine';

const world = () => buildTestWorld();

const batch = () => [
  makeTestEvent('MATCH_WON', {
    matchId: 'm1' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_1' as ClubId,
    homeScore: 4, awayScore: 0, margin: 4,
  }, { id: 'ev_win', importance: 4 }),
  makeTestEvent('GOAL_SCORED', {
    matchId: 'm1' as MatchId, clubId: 'club_0' as ClubId, scorerId: 'p_0_10' as PlayerId,
    minute: 12, homeScore: 1, awayScore: 0,
  }, { id: 'ev_goal', importance: 2 }),
  makeTestEvent('RED_CARD', {
    playerId: 'p_1_4' as PlayerId, clubId: 'club_1' as ClubId, matchId: 'm1' as MatchId, minute: 30,
  }, { id: 'ev_red', importance: 4 }),
];

describe('social posts trace to real events', () => {
  it('never publishes a post without a source event that exists', () => {
    const { state } = world();
    const events = batch();
    const cascade = expandCascade(events, state);
    const posts = generatePosts(events, state, new Rng('s1'), null, { cascade });
    const known = new Set<string>([
      ...events.map((e) => e.id),
      ...cascade.derivedEvents.map((e) => e.id),
      ...state.eventLog.map((e) => e.id),
    ]);
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) {
      expect(post.relatedEventId).toBeDefined();
      expect(known.has(post.relatedEventId as string)).toBe(true);
    }
  });

  it('produces nothing at all when nothing happened', () => {
    const { state } = world();
    expect(generatePosts([], state, new Rng('s2'), null)).toEqual([]);
  });

  it('is deterministic for a fixed seed', () => {
    const { state } = world();
    const events = batch();
    const a = generatePosts(events, state, new Rng('same'), null);
    const b = generatePosts(events, state, new Rng('same'), null);
    expect(JSON.stringify(a)).toBe(JSON.stringify(b));
  });
});

describe('voices', () => {
  const { state } = world();
  const events = batch();
  const posts = generatePosts(events, state, new Rng('voices'), null, { maxPosts: 60 });

  it('gives every reaction a distinct author kind mix', () => {
    const kinds = new Set(posts.map((p) => p.kind));
    expect(kinds.size).toBeGreaterThanOrEqual(3);
  });

  it('keeps rivals hostile whatever the result', () => {
    const rivals = posts.filter((p) => p.kind === 'RIVAL');
    expect(rivals.length).toBeGreaterThan(0);
    for (const post of rivals) expect(post.sentiment).toBeLessThan(0);
  });

  it('keeps fans partisan', () => {
    const winFans = posts.filter(
      (p) => p.kind === 'FAN' && (p.tags.includes('trigger:DERBY_WIN') || p.tags.includes('trigger:STATEMENT_WIN')),
    );
    expect(winFans.length).toBeGreaterThan(0);
    for (const post of winFans) expect(post.sentiment).toBeGreaterThan(0);
  });

  it('never repeats the same text twice in a cycle', () => {
    const texts = posts.map((p) => p.text);
    expect(new Set(texts).size).toBe(texts.length);
  });
});

describe('engagement', () => {
  it('scales with the author reach, not with the dice', () => {
    const { state } = world();
    const small = {
      ...state,
      creators: Object.fromEntries(Object.entries(state.creators).map(([id, c]) => [id, { ...c, followers: 20_000 }])),
    };
    const large = {
      ...state,
      creators: Object.fromEntries(Object.entries(state.creators).map(([id, c]) => [id, { ...c, followers: 8_000_000 }])),
    };
    const events = batch();
    const smallPosts = generatePosts(events, small, new Rng('eng'), null).filter((p) => p.kind === 'CREATOR');
    const largePosts = generatePosts(events, large, new Rng('eng'), null).filter((p) => p.kind === 'CREATOR');
    const total = (posts: readonly { likes: number }[]): number => posts.reduce((sum, p) => sum + p.likes, 0);
    expect(total(largePosts)).toBeGreaterThan(total(smallPosts) * 5);
  });

  it('weights big moments above chatter', () => {
    const { state } = world();
    const big = makeTestEvent('TROPHY_WON', { clubId: 'club_0' as ClubId, competition: 'Test League', season: 1 }, { id: 'ev_trophy', importance: 5 });
    const small = makeTestEvent('GOAL_SCORED', {
      matchId: 'm9' as MatchId, clubId: 'club_0' as ClubId, scorerId: 'p_0_10' as PlayerId,
      minute: 5, homeScore: 1, awayScore: 0,
    }, { id: 'ev_small', importance: 2 });
    const posts = generatePosts([big, small], state, new Rng('weight'), null, { maxPosts: 40 });
    const trophyWeight = Math.max(...posts.filter((p) => p.relatedEventId === 'ev_trophy').map((p) => p.weight));
    const goalWeight = Math.max(...posts.filter((p) => p.relatedEventId === 'ev_small').map((p) => p.weight));
    expect(trophyWeight).toBeGreaterThan(goalWeight);
  });
});

describe('arguments', () => {
  it('emerges as a quote-post when creators disagree', () => {
    const { state } = world();
    // A big-money signing is the kind of event creators genuinely split on.
    const polarising = makeTestEvent('PLAYER_SIGNED', {
      playerId: 'p_1_3' as PlayerId, clubId: 'club_0' as ClubId, fee: 30_000_000, wage: 120_000,
    }, { id: 'ev_polar', importance: 5 });
    // Assert the RATE, not "at least one of ten fixed seeds". Debates fire on
    // roughly 8-9% of polarising signings, so a ten-seed sweep had a 41% chance
    // of finding nothing — this test was passing by luck and broke the first
    // time the underlying random streams changed for an unrelated reason.
    let hits = 0;
    const samples = 300;
    for (let i = 0; i < samples; i++) {
      const posts = generatePosts([polarising], state, new Rng(`debate-${i}`), null, { maxPosts: 40 });
      if (posts.some((p) => p.quoted && p.tags.includes('debate'))) hits += 1;
    }
    const rate = hits / samples;
    // Wide band on purpose: this pins down "creators sometimes argue, but not
    // every time", which is the actual design intent, without freezing a
    // balance constant that designers should be free to tune.
    expect(rate).toBeGreaterThan(0.02);
    expect(rate).toBeLessThan(0.35);
  });
});

describe('socialReach', () => {
  it('converts positive reach into followers and hostile reach into losses', () => {
    const { state } = world();
    const events = batch();
    const posts = generatePosts(events, state, new Rng('reach'), null);
    const withPosts = { ...state, social: { ...state.social, posts } };
    const reach = socialReach(withPosts);
    expect(reach.impressions).toBeGreaterThan(0);

    const hostile = posts.map((p) => ({ ...p, sentiment: -0.9 }));
    const hostileReach = socialReach({ ...state, social: { ...state.social, posts: hostile } });
    expect(hostileReach.followerDelta).toBeLessThan(reach.followerDelta);
  });

  it('reports nothing for an empty feed', () => {
    const { state } = world();
    expect(socialReach(state)).toEqual({ impressions: 0, followerDelta: 0 });
  });
});

describe('emergent hooks reach the feed', () => {
  it('renders detected patterns as posts anchored to the triggering event', () => {
    const { state } = world();
    const goal = makeTestEvent('GOAL_SCORED', {
      matchId: 'm4' as MatchId, clubId: 'club_0' as ClubId, scorerId: 'p_0_10' as PlayerId,
      minute: 70, homeScore: 1, awayScore: 0,
    }, { id: 'ev_anchor' });
    const withLog = withEvents(state, [goal]);
    const posts = generatePosts([], withLog, new Rng('em'), null, {
      extraHooks: [{
        trigger: 'EMERGENT_UNBEATEN_RUN',
        sourceEventId: goal.id,
        rootEventId: goal.id,
        depth: 0,
        importance: 3,
        sentiment: 0.7,
        tokens: { club: clubToken('Club 0'), count: 6 },
        facts: { count: 6 },
        entities: [{ kind: 'club', id: 'club_0', name: 'Club 0' }],
        clubId: 'club_0' as ClubId,
        audiences: ['FAN', 'CREATOR'],
        tags: ['emergent'],
        cycle: state.clock.cycle,
      }],
    });
    expect(posts.length).toBeGreaterThan(0);
    for (const post of posts) expect(post.relatedEventId).toBe(goal.id);
  });
});
