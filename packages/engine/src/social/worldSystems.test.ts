import { describe, expect, it } from 'vitest';
import type { ClubId, MatchId, PlayerId } from '../core/brand';
import { ContentRegistry, BASE_PACK } from '../content';
import { buildTestWorld, makeTestEvent, withEvents } from '../simulation/fixtures';
import { Ledger } from '../economy/ledger';
import {
  answerPressConference, pressConference, skipPressConference, PRESS_ANSWER_COUNT, PRESS_QUESTION_IDS,
} from './pressConference';
import {
  campaignOptions, declinePoll, liveCampaigns, offeredPolls, respondToCampaign, runPoll, settlePoll,
  trustSummary, POLL_TEMPLATE_COUNT, CAMPAIGN_TEMPLATE_COUNT,
} from './community';
import { socialTickDue, tickSocialWorld } from './socialTick';
import { trendingTopics, punditSummary } from './trending';
import { milestones, nextMilestone, awardMilestones } from './milestones';
import { socialWorld, withSocialWorld } from './worldState';
import {
  campaignOffers, creatorInterest, declineCampaign, greenlightCampaign, runningCampaigns, signCreator,
} from '../creators/campaigns';
import { publishClubPost } from './compose';
import { socialMoments } from './moments';

const registry = (() => {
  const r = new ContentRegistry();
  r.load(BASE_PACK);
  return r;
})();

const AT = 1_700_000_000_000;

function busyWorld() {
  const { state } = buildTestWorld();
  return withEvents(state, [
    makeTestEvent('MATCH_LOST', {
      matchId: 'm1' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_1' as ClubId,
      homeScore: 0, awayScore: 3, margin: 3,
    }, {
      id: 'ev_loss', importance: 4, cycle: 10,
      entities: [{ kind: 'club', id: 'club_0', name: 'Club 0' }, { kind: 'club', id: 'club_1', name: 'Club 1' }],
    }),
    makeTestEvent('MATCH_SCHEDULED', {
      matchId: 'm2' as MatchId, homeClubId: 'club_0' as ClubId, awayClubId: 'club_1' as ClubId, week: 11,
    }, {
      id: 'ev_next', importance: 3, cycle: 10,
      entities: [{ kind: 'club', id: 'club_0', name: 'Club 0' }, { kind: 'club', id: 'club_1', name: 'Club 1' }],
    }),
    makeTestEvent('PLAYER_SIGNED', {
      playerId: 'p_0_5' as PlayerId, clubId: 'club_0' as ClubId, fee: 4_000_000, wage: 40_000,
    }, {
      id: 'ev_signing', importance: 3, cycle: 10,
      entities: [{ kind: 'player', id: 'p_0_5', name: 'T. p_0_5' }, { kind: 'club', id: 'club_0', name: 'Club 0' }],
    }),
  ]);
}

describe('press conferences', () => {
  it('ships a question bank with real depth', () => {
    expect(PRESS_QUESTION_IDS.length).toBeGreaterThanOrEqual(18);
    expect(PRESS_ANSWER_COUNT).toBeGreaterThanOrEqual(55);
    expect(new Set(PRESS_QUESTION_IDS).size).toBe(PRESS_QUESTION_IDS.length);
  });

  it('offers a conference anchored to a real event', () => {
    const state = busyWorld();
    const conference = pressConference(state);
    expect(conference).not.toBeNull();
    expect(state.eventLog.some((e) => e.id === conference!.anchorEventId)).toBe(true);
    expect(conference!.questions.length).toBeGreaterThan(0);
  });

  it('never asks three questions about the same subject', () => {
    const conference = pressConference(busyWorld())!;
    const topics = conference.questions.map((q) => q.topic);
    expect(new Set(topics).size).toBe(topics.length);
  });

  it('states every consequence before the answer is given', () => {
    const conference = pressConference(busyWorld())!;
    for (const question of conference.questions) {
      expect(question.answers.length).toBeGreaterThanOrEqual(3);
      for (const answer of question.answers) {
        expect(answer.line.length).toBeGreaterThan(20);
        expect(answer.lines.length).toBeGreaterThan(0);
      }
    }
  });

  it('applies exactly the effects it advertised', () => {
    const state = busyWorld();
    const conference = pressConference(state)!;
    const answers = conference.questions.map((q) => ({ questionId: q.id, answerId: q.answers[0]!.id }));
    const before = socialWorld(state).mediaGoodwill;
    const result = answerPressConference(state, { conferenceId: conference.id, answers, at: AT, registry });
    expect(result.ok).toBe(true);
    const expected = conference.questions.reduce(
      (sum, q) => sum + (q.answers[0]!.effect.mediaGoodwill ?? 0), 0,
    );
    expect(socialWorld(result.state).mediaGoodwill).toBeCloseTo(before + expected, 4);
    // And it cannot be answered twice.
    expect(pressConference(result.state)?.id).not.toBe(conference.id);
  });

  it('produces press reaction that cites the anchor event', () => {
    const state = busyWorld();
    const conference = pressConference(state)!;
    const answers = conference.questions.map((q) => ({ questionId: q.id, answerId: q.answers[0]!.id }));
    const result = answerPressConference(state, { conferenceId: conference.id, answers, at: AT, registry });
    for (const post of result.posts) {
      expect(post.relatedEventId).toBe(conference.anchorEventId);
    }
  });

  it('charges for walking past the room, and more each time', () => {
    const state = busyWorld();
    const first = skipPressConference(state, { at: AT });
    expect(first.ok).toBe(true);
    const drop = socialWorld(state).mediaGoodwill - socialWorld(first.state).mediaGoodwill;
    expect(drop).toBeGreaterThan(0);
    const second = skipPressConference(first.state, { at: AT });
    if (second.ok) {
      const secondDrop = socialWorld(first.state).mediaGoodwill - socialWorld(second.state).mediaGoodwill;
      expect(secondDrop).toBeGreaterThan(drop);
    }
  });

  it('refuses a half-answered conference', () => {
    const state = busyWorld();
    const conference = pressConference(state)!;
    const result = answerPressConference(state, {
      conferenceId: conference.id,
      answers: [{ questionId: conference.questions[0]!.id, answerId: conference.questions[0]!.answers[0]!.id }],
      at: AT,
      registry,
    });
    expect(result.ok).toBe(conference.questions.length === 1);
  });
});

describe('the supporters', () => {
  it('ships a poll and campaign bank with real depth', () => {
    expect(POLL_TEMPLATE_COUNT).toBeGreaterThanOrEqual(12);
    expect(CAMPAIGN_TEMPLATE_COUNT).toBeGreaterThanOrEqual(10);
  });

  it('makes overruling a vote worse than never running one', () => {
    const state = busyWorld();
    const ticked = tickSocialWorld(state, { at: AT, registry }).state;
    const offered = offeredPolls(ticked);
    if (offered.length === 0) return;
    const poll = offered[0]!;

    const declined = declinePoll(ticked, { pollId: poll.id, at: AT });
    const declineCost = socialWorld(ticked).supportersTrust - socialWorld(declined.state).supportersTrust;

    const opened = runPoll(ticked, { pollId: poll.id, at: AT }).state;
    const closed = withSocialWorld(opened, (w) => ({
      polls: w.polls.map((p) => (p.id === poll.id
        ? { ...p, status: 'CLOSED' as const, shares: [0.6, 0.4], winnerId: p.options[0]?.id, turnout: 4000 }
        : p)),
    }));
    const overruled = settlePoll(closed, { pollId: poll.id, honour: false, at: AT, registry });
    const overruleCost = socialWorld(closed).supportersTrust - socialWorld(overruled.state).supportersTrust;

    expect(overruleCost).toBeGreaterThan(declineCost);
  });

  it('pays for honouring a vote', () => {
    const state = busyWorld();
    const ticked = tickSocialWorld(state, { at: AT, registry }).state;
    const poll = offeredPolls(ticked)[0];
    if (!poll) return;
    const opened = runPoll(ticked, { pollId: poll.id, at: AT }).state;
    const closed = withSocialWorld(opened, (w) => ({
      polls: w.polls.map((p) => (p.id === poll.id
        ? { ...p, status: 'CLOSED' as const, shares: [0.7, 0.3], winnerId: p.options[0]?.id, turnout: 5000 }
        : p)),
    }));
    const honoured = settlePoll(closed, { pollId: poll.id, honour: true, at: AT, registry });
    expect(socialWorld(honoured.state).supportersTrust).toBeGreaterThan(socialWorld(closed).supportersTrust);
  });

  it('makes a fan campaign a real choice', () => {
    const state = busyWorld();
    let ticked = tickSocialWorld(state, { at: AT, registry }).state;
    for (let i = 0; i < 3 && liveCampaigns(ticked).length === 0; i++) {
      ticked = tickSocialWorld(
        { ...ticked, clock: { ...ticked.clock, cycle: ticked.clock.cycle + 1 } },
        { at: AT, registry },
      ).state;
    }
    const campaign = liveCampaigns(ticked)[0];
    if (!campaign) return;
    const options = campaignOptions(ticked, campaign);
    expect(options).toHaveLength(2);
    const backed = respondToCampaign(ticked, { campaignId: campaign.id, response: 'BACK', at: AT, registry });
    expect(backed.ok).toBe(true);
    expect(socialWorld(backed.state).supportersTrust).toBeGreaterThan(socialWorld(ticked).supportersTrust);
  });

  it('describes trust in the player’s language', () => {
    const state = busyWorld();
    expect(trustSummary(state).label.length).toBeGreaterThan(2);
  });
});

describe('the social tick', () => {
  it('runs once per cycle and is idempotent', () => {
    const state = busyWorld();
    expect(socialTickDue(state)).toBe(true);
    const first = tickSocialWorld(state, { at: AT, registry });
    expect(first.ran).toBe(true);
    expect(socialTickDue(first.state)).toBe(false);
    const second = tickSocialWorld(first.state, { at: AT, registry });
    expect(second.ran).toBe(false);
    expect(second.state).toBe(first.state);
  });

  it('is deterministic for a fixed seed', () => {
    const state = busyWorld();
    const a = tickSocialWorld(state, { at: AT, registry });
    const b = tickSocialWorld(state, { at: AT, registry });
    expect(JSON.stringify(a.state.socialWorld)).toBe(JSON.stringify(b.state.socialWorld));
    expect(JSON.stringify(a.posts)).toBe(JSON.stringify(b.posts));
  });

  it('never publishes a post without an event behind it', () => {
    let state = busyWorld();
    const known = new Set(state.eventLog.map((e) => String(e.id)));
    for (let i = 0; i < 6; i++) {
      const result = tickSocialWorld(state, { at: AT, registry });
      for (const post of result.posts) {
        expect(post.relatedEventId).toBeDefined();
        expect(known.has(String(post.relatedEventId))).toBe(true);
      }
      for (const event of result.events) known.add(String(event.id));
      state = { ...result.state, clock: { ...result.state.clock, cycle: result.state.clock.cycle + 1 } };
    }
  });

  it('settles a promise against the result that followed it', () => {
    const state = busyWorld();
    const forward = socialMoments(state).find((m) => m.forward)!;
    const posted = publishClubPost(state, {
      momentId: forward.id, tone: 'PROVOCATIVE', voice: 'CLUB', at: AT, registry,
    });
    expect(posted.stake).toBeDefined();

    // The match is played, and lost.
    const afterMatch = withEvents(
      { ...posted.state, clock: { ...posted.state.clock, cycle: 11, week: 11 } },
      [makeTestEvent('MATCH_LOST', {
        matchId: 'm2' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_1' as ClubId,
        homeScore: 0, awayScore: 2, margin: 2,
      }, { id: 'ev_derbyloss', importance: 4, cycle: 11 })],
    );

    const sentimentBefore = afterMatch.clubs.club_0!.fans.sentiment;
    const ticked = tickSocialWorld(afterMatch, { at: AT, registry });
    const settled = ticked.settled.find((s) => s.stake.id === posted.stake!.id);
    expect(settled?.outcome).toBe('EMBARRASSED');
    expect(ticked.state.clubs.club_0!.fans.sentiment).toBeLessThan(sentimentBefore);
    expect(socialWorld(ticked.state).stakes.some((s) => s.id === posted.stake!.id)).toBe(false);
  });

  it('rewards a promise the result backed up', () => {
    const state = busyWorld();
    const forward = socialMoments(state).find((m) => m.forward)!;
    const posted = publishClubPost(state, {
      momentId: forward.id, tone: 'HYPE', voice: 'CLUB', at: AT, registry,
    });
    if (!posted.stake) return;
    const afterMatch = withEvents(
      { ...posted.state, clock: { ...posted.state.clock, cycle: 11, week: 11 } },
      [makeTestEvent('MATCH_WON', {
        matchId: 'm2' as MatchId, clubId: 'club_0' as ClubId, opponentId: 'club_1' as ClubId,
        homeScore: 2, awayScore: 0, margin: 2,
      }, { id: 'ev_derbywin', importance: 4, cycle: 11 })],
    );
    const ticked = tickSocialWorld(afterMatch, { at: AT, registry });
    const settled = ticked.settled.find((s) => s.stake.id === posted.stake!.id);
    expect(settled?.outcome).toBe('VINDICATED');
    expect(ticked.state.clubs.club_0!.fans.sentiment)
      .toBeGreaterThan(afterMatch.clubs.club_0!.fans.sentiment);
  });

  it('gives the world something to talk about', () => {
    const state = busyWorld();
    const ticked = tickSocialWorld(state, { at: AT, registry }).state;
    const world = socialWorld(ticked);
    expect(world.pundit).not.toBeNull();
    expect(punditSummary(world.pundit).length).toBeGreaterThan(10);
  });
});

describe('trending', () => {
  it('counts the real feed rather than inventing topics', () => {
    const state = busyWorld();
    expect(trendingTopics({ ...state, social: { ...state.social, posts: [] } })).toEqual([]);
  });
});

describe('milestones', () => {
  it('pays once and only once', () => {
    const state = busyWorld();
    const anchor = state.eventLog[0]!.id;
    const before = Ledger.restore(state.ledger).cashOf(state.playerClubId);
    const first = awardMilestones(state, AT, anchor);
    expect(first.awarded.length).toBeGreaterThan(0);
    const after = Ledger.restore(first.state.ledger).cashOf(state.playerClubId);
    expect(after).toBeGreaterThan(before);

    const second = awardMilestones(first.state, AT, anchor);
    expect(second.awarded).toEqual([]);
    expect(Ledger.restore(second.state.ledger).cashOf(state.playerClubId)).toBe(after);
  });

  it('describes the next door', () => {
    const state = busyWorld();
    const next = nextMilestone(state);
    if (next) {
      expect(next.remaining).toBeGreaterThan(0);
      expect(next.progress).toBeGreaterThanOrEqual(0);
      expect(next.progress).toBeLessThanOrEqual(1);
    }
    expect(milestones(state).length).toBeGreaterThan(5);
  });
});

describe('creators', () => {
  it('only briefs content about something that happened', () => {
    const state = busyWorld();
    const ticked = tickSocialWorld(state, { at: AT, registry }).state;
    const known = new Set(ticked.eventLog.map((e) => String(e.id)));
    for (const offer of campaignOffers(ticked)) {
      expect(known.has(String(offer.eventId))).toBe(true);
      expect(offer.brief.length).toBeGreaterThan(20);
      expect(offer.projectedReach).toBeGreaterThan(0);
    }
  });

  it('moves production money through the ledger, once', () => {
    const state = busyWorld();
    let ticked = tickSocialWorld(state, { at: AT, registry }).state;
    for (let i = 0; i < 4 && campaignOffers(ticked).length === 0; i++) {
      ticked = tickSocialWorld(
        { ...ticked, clock: { ...ticked.clock, cycle: ticked.clock.cycle + 1 } },
        { at: AT, registry },
      ).state;
    }
    const offer = campaignOffers(ticked)[0];
    if (!offer) return;
    const before = Ledger.restore(ticked.ledger).cashOf(ticked.playerClubId);
    const green = greenlightCampaign(ticked, { campaignId: offer.id, at: AT });
    expect(green.ok).toBe(true);
    const after = Ledger.restore(green.state.ledger).cashOf(ticked.playerClubId);
    expect(before - after).toBe(offer.cost);
    expect(runningCampaigns(green.state)).toHaveLength(1);
    // A second attempt is refused rather than charged again.
    expect(greenlightCampaign(green.state, { campaignId: offer.id, at: AT }).ok).toBe(false);
  });

  it('turns a delivered drop into followers, slowly', () => {
    const state = busyWorld();
    let ticked = tickSocialWorld(state, { at: AT, registry }).state;
    for (let i = 0; i < 4 && campaignOffers(ticked).length === 0; i++) {
      ticked = tickSocialWorld(
        { ...ticked, clock: { ...ticked.clock, cycle: ticked.clock.cycle + 1 } },
        { at: AT, registry },
      ).state;
    }
    const offer = campaignOffers(ticked)[0];
    if (!offer) return;
    let next = greenlightCampaign(ticked, { campaignId: offer.id, at: AT }).state;
    const followersBefore = next.clubs.club_0!.fans.onlineFollowers;
    for (let i = 0; i <= offer.totalCycles; i++) {
      next = { ...next, clock: { ...next.clock, cycle: next.clock.cycle + 1 } };
      next = tickSocialWorld(next, { at: AT, registry }).state;
    }
    const settled = socialWorld(next).creatorCampaigns.find((c) => c.id === offer.id);
    expect(['DELIVERED', 'FLOPPED']).toContain(settled?.status);
    expect(settled?.deliveredReach).toBeGreaterThan(0);
    // Conversion is deliberately lossy: never more than a few percent.
    const gained = next.clubs.club_0!.fans.onlineFollowers - followersBefore;
    expect(gained).toBeLessThan((settled?.deliveredReach ?? 0) * 0.05);
  });

  it('declining a brief costs the creator’s goodwill but no money', () => {
    const state = busyWorld();
    let ticked = tickSocialWorld(state, { at: AT, registry }).state;
    for (let i = 0; i < 4 && campaignOffers(ticked).length === 0; i++) {
      ticked = tickSocialWorld(
        { ...ticked, clock: { ...ticked.clock, cycle: ticked.clock.cycle + 1 } },
        { at: AT, registry },
      ).state;
    }
    const offer = campaignOffers(ticked)[0];
    if (!offer) return;
    const before = ticked.creators[offer.creatorId]!.clubSentiment;
    const cash = Ledger.restore(ticked.ledger).cashOf(ticked.playerClubId);
    const declined = declineCampaign(ticked, { campaignId: offer.id });
    expect(declined.ok).toBe(true);
    expect(declined.state.creators[offer.creatorId]!.clubSentiment).toBeLessThan(before);
    expect(Ledger.restore(declined.state.ledger).cashOf(ticked.playerClubId)).toBe(cash);
  });

  it('gates the biggest creators behind the club’s own audience', () => {
    const state = busyWorld();
    const interest = creatorInterest(state);
    expect(interest.length).toBeGreaterThan(0);
    for (const row of interest) {
      expect(row.reason.length).toBeGreaterThan(10);
      if (!row.available) {
        expect(signCreator(state, { creatorId: row.creator.id, at: AT }).ok).toBe(false);
      }
    }
  });
});

describe('living alongside the rest of the engine', () => {
  it('survives a save and load round trip', async () => {
    const { MemoryStorage } = await import('../persistence/storage');
    const { saveGame, loadGame } = await import('../persistence/save');
    const state = busyWorld();
    const ticked = tickSocialWorld(state, { at: AT, registry }).state;
    const forward = socialMoments(ticked).find((m) => m.forward);
    const withStake = forward
      ? publishClubPost(ticked, { momentId: forward.id, tone: 'PROVOCATIVE', voice: 'CLUB', at: AT, registry }).state
      : ticked;

    const storage = new MemoryStorage();
    const saved = await saveGame(storage, withStake, AT);
    expect(saved.ok).toBe(true);
    const loaded = await loadGame(storage);
    expect(loaded.ok).toBe(true);
    if (!loaded.ok) return;
    expect(JSON.stringify(loaded.value.state.socialWorld)).toBe(JSON.stringify(withStake.socialWorld));
    // And the tick still refuses to run twice for the same cycle after a reload.
    expect(socialTickDue(loaded.value.state)).toBe(false);
  });

  it('is carried through a full cycle advance', async () => {
    const { advanceCycle } = await import('../game/cycle');
    const { Ledger } = await import('../economy/ledger');
    const state = busyWorld();
    const ticked = tickSocialWorld(state, { at: AT, registry }).state;
    const before = socialWorld(ticked);

    const advanced = advanceCycle(ticked, {
      now: AT,
      registry: registry as never,
      ledger: Ledger.restore(ticked.ledger),
    });
    const after = socialWorld(advanced.state);
    // The world tick rebuilds `state.social` wholesale; the social world hangs
    // off the root precisely so that it is not thrown away every matchweek.
    expect(after.mediaGoodwill).toBe(before.mediaGoodwill);
    expect(after.actions.length).toBe(before.actions.length);
    expect(socialTickDue(advanced.state)).toBe(true);
  });

  it('lets media goodwill change how the press write about you', async () => {
    const { generateStories } = await import('../media/mediaEngine');
    const { Rng } = await import('../core/rng');
    const state = busyWorld();
    const hostile = withSocialWorld(state, { mediaGoodwill: 5 });
    const friendly = withSocialWorld(state, { mediaGoodwill: 95 });
    const opts = { cycle: state.clock.cycle };
    const worst = generateStories(state.eventLog, hostile, new Rng('press'), registry, opts);
    const best = generateStories(state.eventLog, friendly, new Rng('press'), registry, opts);
    const negative = (rows: readonly { sentiment: number; id: string }[]) =>
      rows.filter((r) => r.sentiment < 0).reduce((sum, r) => sum + r.sentiment, 0);
    expect(negative(worst)).toBeLessThanOrEqual(negative(best));
  });
});
