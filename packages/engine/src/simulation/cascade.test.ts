import { describe, expect, it } from 'vitest';
import { Rng } from '../core/rng';
import type { ClubId, MatchId, PlayerId } from '../core/brand';
import { generateStories } from '../media/mediaEngine';
import { generatePosts } from '../social/socialEngine';
import { expandCascade } from './cascade';
import { buildTestWorld, makeTestEvent, withEvents } from './fixtures';

const redCardEvent = (playerId: string, clubId: string, id = 'ev_red') =>
  makeTestEvent('RED_CARD', {
    playerId: playerId as PlayerId,
    clubId: clubId as ClubId,
    matchId: 'match_1' as MatchId,
    minute: 24,
  }, { id, importance: 4 });

describe('the red-card cascade', () => {
  const { state } = buildTestWorld();
  const playerId = 'p_0_5';
  const event = redCardEvent(playerId, 'club_0');
  const cascade = expandCascade([event], state);

  it('suspends the player', () => {
    const suspension = cascade.deltas.find((d) => d.kind === 'PLAYER_SUSPENSION');
    expect(suspension).toBeDefined();
    expect(suspension && suspension.kind === 'PLAYER_SUSPENSION' && suspension.matches).toBeGreaterThanOrEqual(1);
  });

  it('knocks the player and squad morale', () => {
    expect(cascade.deltas.some((d) => d.kind === 'PLAYER_MORALE' && d.delta < 0)).toBe(true);
    expect(cascade.deltas.some((d) => d.kind === 'SQUAD_MORALE' && d.delta < 0)).toBe(true);
  });

  it('angers the fans', () => {
    expect(cascade.deltas.some((d) => d.kind === 'FAN_SENTIMENT' && d.delta < 0)).toBe(true);
    expect(cascade.derivedEvents.some((e) => e.type === 'FAN_SENTIMENT_CHANGED')).toBe(true);
  });

  it('raises the rivalry temperature', () => {
    expect(cascade.derivedEvents.some((e) => e.type === 'RIVALRY_INTENSIFIED')).toBe(true);
    expect(cascade.deltas.some((d) => d.kind === 'RIVALRY_INTENSITY' && d.delta > 0)).toBe(true);
  });

  it('produces a media story and hostile chatter', () => {
    expect(cascade.mediaHooks.some((h) => h.trigger === 'RED_CARD')).toBe(true);
    const social = cascade.socialHooks.find((h) => h.trigger === 'RED_CARD');
    expect(social).toBeDefined();
    expect(social?.audiences).toContain('RIVAL');
  });

  it('records the whole chain against the root event', () => {
    const chain = cascade.chains[event.id];
    expect(chain).toBeDefined();
    expect((chain ?? []).length).toBeGreaterThan(4);
    expect((chain ?? []).some((n) => n.depth > 0)).toBe(true);
    for (const node of chain ?? []) expect(node.rootEventId).toBe(event.id);
  });

  it('renders into a real story and real posts', () => {
    const stories = generateStories([event], state, new Rng('media-seed'), null, { cascade });
    const posts = generatePosts([event], state, new Rng('social-seed'), null, { cascade });
    expect(stories.length).toBeGreaterThan(0);
    const story = stories.find((s) => s.tags.includes('trigger:RED_CARD'));
    expect(story).toBeDefined();
    expect(story?.importance).toBeGreaterThanOrEqual(4);
    expect(story?.headline).not.toContain('{');

    expect(posts.some((p) => p.kind === 'FAN' && p.sentiment < 0)).toBe(true);
    expect(posts.some((p) => p.kind === 'RIVAL')).toBe(true);
    for (const post of posts) expect(post.text).not.toContain('{');
  });

  it('produces a different, follow-up story the next cycle', () => {
    const past = redCardEvent(playerId, 'club_0', 'ev_red_prev');
    const withHistory = withEvents(
      { ...state, clock: { ...state.clock, cycle: 11 } },
      [{ ...past, cycle: 10 }],
    );
    const next = expandCascade([], withHistory, { cycle: 11 });
    const followUp = next.mediaHooks.find((h) => h.trigger === 'SUSPENSION_AFTERMATH');
    expect(followUp).toBeDefined();
    expect(followUp?.sourceEventId).toBe('ev_red_prev');
    const stories = generateStories([], withHistory, new Rng('media-seed'), null, { cascade: next, cycle: 11 });
    expect(stories.some((s) => s.tags.includes('trigger:SUSPENSION_AFTERMATH'))).toBe(true);
  });
});

describe('other cascades', () => {
  const { state } = buildTestWorld();

  it('cascades a marquee signing into hype, expectation and a debut follow-up', () => {
    const event = makeTestEvent('PLAYER_SIGNED', {
      playerId: 'p_1_3' as PlayerId, clubId: 'club_0' as ClubId, fee: 24_000_000, wage: 90_000,
    }, { id: 'ev_sign', importance: 4 });
    const cascade = expandCascade([event], state);
    expect(cascade.mediaHooks.some((h) => h.trigger === 'MARQUEE_SIGNING')).toBe(true);
    expect(cascade.deltas.some((d) => d.kind === 'FAN_EXPECTATION' && d.delta > 0)).toBe(true);
    expect(cascade.deltas.some((d) => d.kind === 'CLUB_REPUTATION' && d.delta > 0)).toBe(true);

    const later = expandCascade([], withEvents({ ...state, clock: { ...state.clock, cycle: 11 } }, [event]), { cycle: 11 });
    expect(later.mediaHooks.some((h) => h.trigger === 'DEBUT_WATCH')).toBe(true);
  });

  it('cascades a shock defeat into pressure, anger and fallout', () => {
    const event = makeTestEvent('MATCH_LOST', {
      matchId: 'match_2' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_4' as ClubId,
      homeScore: 0, awayScore: 4, margin: 4,
    }, { id: 'ev_loss', importance: 4 });
    const cascade = expandCascade([event], state);
    expect(cascade.mediaHooks.some((h) => h.trigger === 'SHOCK_DEFEAT')).toBe(true);
    expect(cascade.deltas.some((d) => d.kind === 'MANAGER_PRESSURE' && d.delta > 0)).toBe(true);
    expect(cascade.deltas.some((d) => d.kind === 'SQUAD_MORALE' && d.delta < 0)).toBe(true);
  });

  it('cascades a wonderkid breakout into interest the following cycle', () => {
    const event = makeTestEvent('PLAYER_BREAKOUT', {
      playerId: 'p_0_7' as PlayerId, clubId: 'club_0' as ClubId, overall: 74,
    }, { id: 'ev_breakout', importance: 4 });
    const cascade = expandCascade([event], state);
    expect(cascade.mediaHooks.some((h) => h.trigger === 'WONDERKID')).toBe(true);
    const later = expandCascade([], withEvents({ ...state, clock: { ...state.clock, cycle: 11 } }, [event]), { cycle: 11 });
    expect(later.socialHooks.some((h) => h.trigger === 'BREAKOUT_INTEREST')).toBe(true);
  });

  it('cascades a broken record into celebration and history', () => {
    const event = makeTestEvent('RECORD_BROKEN', {
      clubId: 'club_0' as ClubId, record: 'Most goals in a season', value: 28, holderId: 'p_0_10' as PlayerId,
    }, { id: 'ev_record', importance: 5 });
    const cascade = expandCascade([event], state);
    expect(cascade.mediaHooks.some((h) => h.trigger === 'RECORD_BROKEN')).toBe(true);
    expect(cascade.deltas.some((d) => d.kind === 'FAN_SENTIMENT' && d.delta > 0)).toBe(true);
  });

  it('reports a manager under pressure only when the results justify it', () => {
    const calm = expandCascade([], state);
    expect(calm.mediaHooks.some((h) => h.trigger.startsWith('MANAGER_'))).toBe(false);

    const defeats = Array.from({ length: 5 }, (_, i) => makeTestEvent('MATCH_LOST', {
      matchId: `match_p${i}` as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_2' as ClubId,
      homeScore: 0, awayScore: 3, margin: 3,
    }, { id: `ev_defeat_${i}`, cycle: 5 + i }));
    const struggling = withEvents(state, defeats);
    const hot = expandCascade([], struggling);
    expect(hot.mediaHooks.some((h) => h.trigger === 'MANAGER_PRESSURE' || h.trigger === 'MANAGER_CRISIS')).toBe(true);
    const anchor = hot.mediaHooks.find((h) => h.trigger.startsWith('MANAGER_'));
    expect(defeats.some((d) => d.id === anchor?.sourceEventId)).toBe(true);
  });

  it('is idempotent: expanding the same batch twice produces identical ids', () => {
    const event = redCardEvent('p_0_5', 'club_0');
    const a = expandCascade([event], state);
    const b = expandCascade([event], state);
    expect(a.derivedEvents.map((e) => e.id)).toEqual(b.derivedEvents.map((e) => e.id));
    expect(a.nodes.map((n) => n.id)).toEqual(b.nodes.map((n) => n.id));
  });
});
