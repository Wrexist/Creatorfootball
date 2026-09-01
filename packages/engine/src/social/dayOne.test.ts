import { describe, expect, it } from 'vitest';
import { ContentRegistry } from '../content';
import { BASE_PACK } from '../content/packs/base';
import { createNewGame } from '../game/newGame';
import {
  campaignOffers, creatorInterest, deliveredCampaigns, liveFeuds, runningCampaigns,
} from '../creators/campaigns';
import { composeAvailability, composeOptions, publishClubPost } from './compose';
import {
  closedPolls, liveCampaigns, offeredPolls, openPolls, trustSummary,
} from './community';
import { milestones, nextMilestone, unlockedCreatorTiers } from './milestones';
import { socialMoments } from './moments';
import { pressConference, skipPressConference } from './pressConference';
import { provocations, unhappyVoices } from './reactions';
import { socialStanding } from './standing';
import { socialTickDue, tickSocialWorld } from './socialTick';
import { punditSummary, rumourAccuracy, trendingTopics } from './trending';
import { socialWorld } from './worldState';

/**
 * Day one.
 *
 * Every read in this feature is called from a screen that a player can open
 * before anything has happened — a brand-new save has no posts, no results, an
 * almost empty journal and no social world at all. A single throw on any of
 * these paths is a blank screen on the first session, which is the worst
 * possible place for one, so the whole public surface is walked here against a
 * genuinely fresh game rather than against a fixture that was built to be
 * convenient.
 */

const registry = (() => {
  const r = new ContentRegistry();
  r.load(BASE_PACK);
  return r;
})();

const AT = 1_700_000_000_000;

const freshGame = () => createNewGame({
  registry,
  seed: 'day-one',
  now: AT,
  manager: {
    kind: 'CUSTOM',
    name: 'Alex Kerrin',
    archetypeId: 'tactician',
    mediaStyle: 'HONEST',
    socialPersonality: 'ACTIVE',
    appearance: {
      skinTone: 3, hairStyle: 'short', hairColor: 'black', facialHair: 'none',
      outfit: 'suit', accessory: 'none', accentColor: '#c8ff2e',
    },
  },
  club: {
    kind: 'CUSTOM',
    name: 'Day One FC',
    shortName: 'Day One',
    abbreviation: 'DAY',
    city: 'Vellmar',
    philosophy: 'CREATOR_FIRST',
    fanCulture: 'ONLINE_NATIVE',
    visual: {
      primary: '#c8ff2e', secondary: '#08090b', accent: '#ffffff',
      badgeShape: 'SHIELD', badgeMotif: 'BOLT', style: 'MODERN', kitPattern: 'SOLID',
    },
    motto: 'Built from nothing.',
  },
});

describe('a brand new save', () => {
  const state = freshGame();

  it('has no social world yet, and every read copes', () => {
    expect(state.socialWorld).toBeUndefined();
    const world = socialWorld(state);
    expect(world.tickedCycle).toBe(-1);
    expect(world.actions).toEqual([]);
  });

  it('never throws on any read the screens make', () => {
    expect(() => {
      socialMoments(state);
      socialStanding(state);
      composeAvailability(state);
      provocations(state);
      unhappyVoices(state);
      pressConference(state);
      offeredPolls(state);
      openPolls(state);
      closedPolls(state);
      liveCampaigns(state);
      trustSummary(state);
      campaignOffers(state);
      runningCampaigns(state);
      deliveredCampaigns(state);
      creatorInterest(state);
      liveFeuds(state);
      milestones(state);
      nextMilestone(state);
      unlockedCreatorTiers(state);
      trendingTopics(state);
      rumourAccuracy(state);
      punditSummary(socialWorld(state).pundit);
    }).not.toThrow();
  });

  it('ticks cleanly against an empty world', () => {
    expect(socialTickDue(state)).toBe(true);
    const result = tickSocialWorld(state, { at: AT, registry });
    expect(result.ran).toBe(true);
    expect(socialTickDue(result.state)).toBe(false);
    // Nothing has happened, so nothing is claimed to have happened.
    for (const post of result.posts) expect(post.relatedEventId).toBeDefined();
  });

  it('refuses to post about nothing rather than inventing something', () => {
    const moments = socialMoments(state);
    if (moments.length === 0) {
      const result = publishClubPost(state, {
        momentId: 'mo_anything', tone: 'HYPE', voice: 'CLUB', at: AT, registry,
      });
      expect(result.ok).toBe(false);
      expect(result.state).toBe(state);
    } else {
      // If the opening cycle did emit something, it must be a real event.
      const known = new Set(state.eventLog.map((e) => String(e.id)));
      for (const moment of moments) expect(known.has(String(moment.eventId))).toBe(true);
    }
  });

  it('prices every tone the moment there is anything to talk about', () => {
    const ticked = tickSocialWorld(state, { at: AT, registry }).state;
    const moment = socialMoments(ticked)[0];
    if (!moment) return;
    const options = composeOptions(ticked, moment);
    expect(options).toHaveLength(5);
    for (const option of options) expect(option.reach).toBeGreaterThan(0);
  });

  it('lets the press conference be skipped without a conference existing', () => {
    const outcome = skipPressConference(state, { at: AT });
    // Either there is one to skip, or the refusal is graceful.
    expect(typeof outcome.ok).toBe('boolean');
    expect(outcome.state).toBeDefined();
  });
});
