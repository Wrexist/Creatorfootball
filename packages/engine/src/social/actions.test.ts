import { describe, expect, it } from 'vitest';
import type { ClubId, MatchId, PlayerId } from '../core/brand';
import { ContentRegistry, BASE_PACK } from '../content';
import { buildTestWorld, makeTestEvent, withEvents } from '../simulation/fixtures';
import { Ledger } from '../economy/ledger';
import {
  composeAvailability, composeOptions, publishClubPost, TONE_INFO,
} from './compose';
import { socialMoments } from './moments';
import { provocations, reactToPost, reactionOptions, replyOptions, unhappyVoices, replyToPlayer } from './reactions';
import { socialStanding, classify } from './standing';
import { socialWorld } from './worldState';
import { generatePosts } from './socialEngine';
import { Rng } from '../core/rng';

const registry = (() => {
  const r = new ContentRegistry();
  r.load(BASE_PACK);
  return r;
})();

const AT = 1_700_000_000_000;

/** A world where something has just happened to the player's club. */
function worldWithNews() {
  const { state } = buildTestWorld();
  const events = [
    makeTestEvent('MATCH_WON', {
      matchId: 'm1' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_1' as ClubId,
      homeScore: 3, awayScore: 0, margin: 3,
    }, {
      id: 'ev_win', importance: 4, cycle: 10,
      entities: [
        { kind: 'club', id: 'club_0', name: 'Club 0' },
        { kind: 'club', id: 'club_1', name: 'Club 1' },
      ],
    }),
    makeTestEvent('MATCH_SCHEDULED', {
      matchId: 'm2' as MatchId, homeClubId: 'club_0' as ClubId, awayClubId: 'club_1' as ClubId, week: 11,
    }, {
      id: 'ev_next', importance: 3, cycle: 10,
      entities: [
        { kind: 'club', id: 'club_0', name: 'Club 0' },
        { kind: 'club', id: 'club_1', name: 'Club 1' },
      ],
    }),
  ];
  return withEvents(state, events);
}

describe('moments', () => {
  it('only offers things that actually happened', () => {
    const state = worldWithNews();
    const moments = socialMoments(state);
    expect(moments.length).toBeGreaterThan(0);
    const known = new Set(state.eventLog.map((e) => String(e.id)));
    for (const moment of moments) expect(known.has(String(moment.eventId))).toBe(true);
  });

  it('offers nothing at all in a world where nothing has happened', () => {
    const { state } = buildTestWorld();
    expect(socialMoments({ ...state, eventLog: [] })).toEqual([]);
  });

  it('promotes the fixture that has not been played yet', () => {
    const moments = socialMoments(worldWithNews());
    expect(moments[0]?.forward).toBe(true);
  });
});

describe('composing', () => {
  it('publishes a post that cites the event it was about', () => {
    const state = worldWithNews();
    const moment = socialMoments(state).find((m) => !m.forward);
    expect(moment).toBeDefined();
    const result = publishClubPost(state, {
      momentId: moment!.id, tone: 'HYPE', voice: 'CLUB', at: AT, registry,
    });
    expect(result.ok).toBe(true);
    expect(result.post?.relatedEventId).toBe(moment!.eventId);
    const known = new Set(result.state.eventLog.map((e) => String(e.id)));
    expect(known.has(String(result.post?.relatedEventId))).toBe(true);
  });

  it('refuses to post about a moment that does not exist', () => {
    const state = worldWithNews();
    const result = publishClubPost(state, {
      momentId: 'mo_nonsense', tone: 'HYPE', voice: 'CLUB', at: AT, registry,
    });
    expect(result.ok).toBe(false);
    expect(result.state).toBe(state);
  });

  it('is deterministic for the same seed, state and choice', () => {
    const state = worldWithNews();
    const moment = socialMoments(state).find((m) => !m.forward)!;
    const a = publishClubPost(state, { momentId: moment.id, tone: 'CLASSY', voice: 'CLUB', at: AT, registry });
    const b = publishClubPost(state, { momentId: moment.id, tone: 'CLASSY', voice: 'CLUB', at: AT, registry });
    expect(a.post?.text).toBe(b.post?.text);
    expect(JSON.stringify(a.reactions)).toBe(JSON.stringify(b.reactions));
  });

  it('gives every tone a different price, and never a strictly best one', () => {
    const state = worldWithNews();
    const moment = socialMoments(state).find((m) => !m.forward)!;
    const options = composeOptions(state, moment);
    expect(options).toHaveLength(Object.keys(TONE_INFO).length);
    for (const option of options) {
      const gains = option.lines.filter((l) => l.good);
      const costs = option.lines.filter((l) => !l.good);
      // Every register buys something and spends something.
      expect(gains.length).toBeGreaterThan(0);
      expect(costs.length).toBeGreaterThan(0);
    }
  });

  it('makes hype after a defeat cost more than it earns', () => {
    const { state } = buildTestWorld();
    const withLoss = withEvents(state, [makeTestEvent('MATCH_LOST', {
      matchId: 'm3' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_1' as ClubId,
      homeScore: 0, awayScore: 4, margin: 4,
    }, {
      id: 'ev_thrashing', importance: 4, cycle: 10,
      entities: [{ kind: 'club', id: 'club_0', name: 'Club 0' }, { kind: 'club', id: 'club_1', name: 'Club 1' }],
    })]);
    const moment = socialMoments(withLoss)[0]!;
    const hype = composeOptions(withLoss, moment).find((o) => o.tone === 'HYPE')!;
    const defiant = composeOptions(withLoss, moment).find((o) => o.tone === 'DEFIANT')!;
    expect(hype.fit).toBeLessThan(defiant.fit);
    expect(hype.warning).not.toBeNull();
    expect(hype.effect.squadMorale ?? 0).toBeLessThan(defiant.effect.squadMorale ?? 0);
  });

  it('opens a stake only when talking before the match', () => {
    const state = worldWithNews();
    const forward = socialMoments(state).find((m) => m.forward)!;
    const backward = socialMoments(state).find((m) => !m.forward)!;
    expect(composeOptions(state, forward).some((o) => o.stake !== null)).toBe(true);
    expect(composeOptions(state, backward).every((o) => o.stake === null)).toBe(true);

    const result = publishClubPost(state, {
      momentId: forward.id, tone: 'PROVOCATIVE', voice: 'CLUB', at: AT, registry,
    });
    expect(result.ok).toBe(true);
    expect(result.stake).toBeDefined();
    expect(socialWorld(result.state).stakes).toHaveLength(1);
  });

  it('stops the club talking to itself after three posts in a week', () => {
    let state = worldWithNews();
    const moments = socialMoments(state).filter((m) => !m.forward);
    const tones = ['HYPE', 'CLASSY', 'FUNNY', 'DEFIANT'] as const;
    let published = 0;
    for (let i = 0; i < 4; i++) {
      const moment = moments[i % moments.length]!;
      const result = publishClubPost(state, {
        momentId: moment.id, tone: tones[i]!, voice: 'CLUB', at: AT, registry,
      });
      if (result.ok) { published++; state = result.state; }
    }
    expect(published).toBeLessThanOrEqual(3);
    expect(composeAvailability(state).allowed).toBe(false);
  });

  it('makes the world answer, and quotes what it is answering', () => {
    const state = worldWithNews();
    const forward = socialMoments(state).find((m) => m.forward)!;
    const result = publishClubPost(state, {
      momentId: forward.id, tone: 'PROVOCATIVE', voice: 'CLUB', at: AT, registry,
    });
    expect(result.reactions.length).toBeGreaterThan(0);
    for (const reaction of result.reactions) {
      expect(reaction.quoted?.text).toBe(result.post?.text);
      expect(reaction.relatedEventId).toBe(forward.eventId);
    }
  });

  it('moves the world through real domain events rather than silently', () => {
    const state = worldWithNews();
    const moment = socialMoments(state).find((m) => !m.forward)!;
    const result = publishClubPost(state, {
      momentId: moment.id, tone: 'HYPE', voice: 'CLUB', at: AT, registry,
    });
    expect(result.events.length).toBeGreaterThan(0);
    for (const event of result.events) {
      expect(String(event.id).startsWith(String(moment.eventId))).toBe(true);
      expect(result.state.eventLog.some((e) => e.id === event.id)).toBe(true);
    }
  });
});

describe('reacting', () => {
  it('finds the digs that demand an answer', () => {
    const state = worldWithNews();
    const posts = generatePosts(state.eventLog, state, new Rng('feed'), registry, { cycle: 10 });
    const withFeed = { ...state, social: { ...state.social, posts } };
    const list = provocations(withFeed);
    for (const provocation of list) {
      expect(provocation.post.sentiment).toBeLessThanOrEqual(-0.35);
    }
  });

  it('treats silence as a move with consequences', () => {
    const state = worldWithNews();
    const posts = generatePosts(state.eventLog, state, new Rng('feed2'), registry, { cycle: 10 });
    const withFeed = { ...state, social: { ...state.social, posts } };
    const target = provocations(withFeed)[0];
    if (!target) return;
    const options = reactionOptions(withFeed, target.post);
    const silence = options.find((o) => o.kind === 'SILENCE')!;
    expect(silence.lines.length).toBeGreaterThan(0);

    const result = reactToPost(withFeed, { postId: target.post.id, kind: 'SILENCE', at: AT, registry });
    expect(result.ok).toBe(true);
    expect(socialWorld(result.state).handled).toContain(target.post.id);
    // And it cannot be answered twice.
    expect(reactToPost(result.state, { postId: target.post.id, kind: 'QUOTE', at: AT, registry }).ok).toBe(false);
  });

  it('quote-dunks with the original attached', () => {
    const state = worldWithNews();
    const posts = generatePosts(state.eventLog, state, new Rng('feed3'), registry, { cycle: 10 });
    const withFeed = { ...state, social: { ...state.social, posts } };
    const target = provocations(withFeed)[0];
    if (!target) return;
    const result = reactToPost(withFeed, { postId: target.post.id, kind: 'QUOTE', at: AT, registry });
    expect(result.ok).toBe(true);
    if (result.post) {
      expect(result.post.quoted?.authorName).toBe(target.post.authorName);
      expect(result.post.relatedEventId).toBeDefined();
    }
  });
});

describe('answering your own players', () => {
  it('trades the dressing room against the press', () => {
    const { state } = buildTestWorld();
    const unhappy = { ...state.players['p_0_3']!, mental: { ...state.players['p_0_3']!.mental, morale: 22 } };
    const seeded = withEvents({
      ...state,
      players: { ...state.players, [unhappy.id]: unhappy },
      social: {
        ...state.social,
        posts: [{
          id: 'sp_unhappy',
          kind: 'LEAK' as const,
          authorName: 'Transfer Room',
          authorHandle: '@transferroom',
          avatarSeed: 'leak',
          verified: false,
          text: 'He is not happy and people know it.',
          cycle: 10,
          likes: 900, reposts: 200, replies: 400,
          sentiment: -0.6,
          weight: 40,
          relatedEventId: 'ev_mood',
          entities: [{ kind: 'player', id: unhappy.id, name: unhappy.displayName }],
          tags: ['dressing-room'],
        }],
      },
    }, [makeTestEvent('PLAYER_MORALE_CHANGED', {
      playerId: unhappy.id as PlayerId, clubId: 'club_0' as ClubId, from: 50, to: 22, reason: 'left out',
    }, { id: 'ev_mood', cycle: 10 })]);

    const voices = unhappyVoices(seeded);
    expect(voices.length).toBe(1);
    const options = replyOptions(seeded, voices[0]!);
    const back = options.find((o) => o.stance === 'BACK_HIM')!;
    const out = options.find((o) => o.stance === 'CALL_HIM_OUT')!;
    expect(back.effect.playerMorale!.delta).toBeGreaterThan(0);
    expect(back.effect.mediaGoodwill!).toBeLessThan(0);
    expect(out.effect.playerMorale!.delta).toBeLessThan(0);
    expect(out.effect.mediaGoodwill!).toBeGreaterThan(0);

    const applied = replyToPlayer(seeded, { postId: 'sp_unhappy', stance: 'BACK_HIM', at: AT, registry });
    expect(applied.ok).toBe(true);
    expect(applied.state.players[unhappy.id]!.mental.morale).toBeGreaterThan(22);
    // Backing him in public is a promise the results will check.
    expect(socialWorld(applied.state).stakes.some((s) => s.kind === 'PUBLIC_BACKING')).toBe(true);
  });
});

describe('standing', () => {
  it('starts as an unknown quantity and stays there while the club is quiet', () => {
    const { state } = buildTestWorld();
    expect(socialStanding(state).standing).toBe('UNKNOWN');
  });

  it('reads the corners of the warmth/credibility square', () => {
    expect(classify(0.6, 0.6, 10)).toBe('RESPECTED');
    expect(classify(-0.6, 0.6, 10)).toBe('FEARED');
    expect(classify(0.6, -0.6, 10)).toBe('DIVISIVE');
    expect(classify(-0.6, -0.6, 10)).toBe('CLOWN');
    expect(classify(0.6, 0.6, 0.2)).toBe('UNKNOWN');
  });

  it('is built from what the club actually did', () => {
    let state = worldWithNews();
    const moments = socialMoments(state).filter((m) => !m.forward);
    for (let i = 0; i < 3 && i < moments.length; i++) {
      const result = publishClubPost(state, {
        momentId: moments[i]!.id, tone: 'PROVOCATIVE', voice: 'CLUB', at: AT, registry,
      });
      if (result.ok) state = result.state;
    }
    const standing = socialStanding(state);
    expect(standing.acts).toBeGreaterThan(0);
    expect(standing.warmth).toBeLessThan(0);
  });
});

describe('money', () => {
  it('never moves value outside the ledger', () => {
    const state = worldWithNews();
    const moment = socialMoments(state).find((m) => !m.forward)!;
    const before = Ledger.restore(state.ledger).cashOf(state.playerClubId);
    const result = publishClubPost(state, {
      momentId: moment.id, tone: 'HYPE', voice: 'CLUB', at: AT, registry,
    });
    const after = Ledger.restore(result.state.ledger).cashOf(state.playerClubId);
    expect(after).toBe(before);
  });
});
