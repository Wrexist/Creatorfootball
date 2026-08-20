import { useMemo } from 'react';
import type {
  AnyDomainEvent, GameState, NewsStory, SocialPost,
} from '@cf/engine';

/**
 * Feed reads.
 *
 * The feed is a projection of the event journal: the engine guarantees that
 * every post traces back to something that actually happened, and this file
 * exists to keep that promise visible at the surface — a post with a
 * `relatedEventId` can always be opened to see the event underneath it.
 */

/* --- weight tiers ------------------------------------------------------- */

export type Tier = 'LEAD' | 'STANDARD' | 'CHATTER';

/**
 * Visual hierarchy is driven entirely by `post.weight`, which the world engine
 * sets from how important the underlying event was. A rival creator dunking
 * after a derby defeat physically occupies more of the screen than a fan's
 * throwaway line, and that difference is the whole reason the number exists.
 */
export function tierFor(weight: number): Tier {
  if (weight >= 0.78) return 'LEAD';
  if (weight >= 0.42) return 'STANDARD';
  return 'CHATTER';
}

/** A post has to clear this before it can be a lead at all. */
const LEAD_FLOOR = 0.78;

/** How many full-size posts sit under the lead before the week turns to chatter. */
const RUNNERS_UP = 2;

/**
 * Editorial hierarchy, not just a size lookup.
 *
 * `tierFor` alone produced a feed of nothing but leads: a matchweek generates
 * several genuinely important posts, they all clear the weight threshold, and
 * three consecutive full-size cards is the same wall of sameness as three
 * identical rows. A front page does not work that way — one story is the story,
 * and everything else is arranged around it.
 *
 * So the lead is scarce *per matchweek*: the single heaviest post of a given
 * cycle runs large, its nearest rivals run at standard size, and the rest falls
 * to chatter. The weight the world engine assigned still decides everything —
 * it now decides rank rather than just crossing a line.
 */
export function assignTiers(posts: readonly SocialPost[]): Map<string, Tier> {
  const byCycle = new Map<number, SocialPost[]>();
  for (const post of posts) {
    const list = byCycle.get(post.cycle);
    if (list) list.push(post);
    else byCycle.set(post.cycle, [post]);
  }

  const tiers = new Map<string, Tier>();
  for (const [, group] of byCycle) {
    const ranked = group.slice().sort((a, b) => b.weight - a.weight);
    ranked.forEach((post, index) => {
      const base = tierFor(post.weight);
      if (index === 0 && post.weight >= LEAD_FLOOR) {
        tiers.set(post.id, 'LEAD');
        return;
      }
      // Rank, not just weight, decides the step down. A matchweek routinely
      // produces a dozen posts that all clear the "important" threshold; if
      // they all render at full size the feed is a wall again, which is the
      // problem the weights were supposed to solve. Two runners-up keep a full
      // card, everything after that is chatter — the shape of a front page.
      if (index <= RUNNERS_UP) {
        tiers.set(post.id, base === 'CHATTER' ? 'CHATTER' : 'STANDARD');
        return;
      }
      tiers.set(post.id, 'CHATTER');
    });
  }
  return tiers;
}

export const KIND_LABEL: Record<SocialPost['kind'], string> = {
  FAN: 'Supporter',
  CREATOR: 'Creator',
  MEDIA: 'Media',
  CLUB: 'Club',
  PLAYER: 'Player',
  RIVAL: 'Rival',
  SPONSOR: 'Sponsor',
  LEAK: 'Leak',
};

export const KIND_TONE: Record<SocialPost['kind'], 'neutral' | 'volt' | 'info' | 'positive' | 'danger' | 'warning' | 'special'> = {
  FAN: 'neutral',
  CREATOR: 'volt',
  MEDIA: 'info',
  CLUB: 'neutral',
  PLAYER: 'positive',
  RIVAL: 'danger',
  SPONSOR: 'warning',
  LEAK: 'special',
};

/** Accent rail colour per kind — the strip that makes a feed scannable by source. */
export const KIND_RAIL: Record<SocialPost['kind'], string> = {
  FAN: 'bg-white/20',
  CREATOR: 'bg-volt',
  MEDIA: 'bg-info',
  CLUB: 'bg-white/35',
  PLAYER: 'bg-positive',
  RIVAL: 'bg-danger',
  SPONSOR: 'bg-warning',
  LEAK: 'bg-special',
};

/* --- feed --------------------------------------------------------------- */

export type FeedFilter = 'ALL' | 'CREATOR' | 'RIVAL' | 'CLUB' | 'MEDIA';

const FILTER_KINDS: Record<FeedFilter, readonly SocialPost['kind'][]> = {
  ALL: [],
  CREATOR: ['CREATOR', 'PLAYER'],
  RIVAL: ['RIVAL', 'LEAK'],
  CLUB: ['CLUB', 'FAN', 'SPONSOR'],
  MEDIA: ['MEDIA'],
};

export function useFeed(state: GameState, filter: FeedFilter, limit: number): SocialPost[] {
  return useMemo(() => {
    const kinds = FILTER_KINDS[filter];
    const rows = state.social.posts.filter((post) => kinds.length === 0 || kinds.includes(post.kind));
    // Newest first, and within a matchweek the loudest first — otherwise a
    // week's biggest story can end up below the chatter that reacted to it.
    return rows
      .slice()
      .sort((a, b) => b.cycle - a.cycle || b.weight - a.weight)
      .slice(0, limit);
  }, [state.social.posts, filter, limit]);
}

export function useStories(state: GameState, unreadOnly: boolean, limit: number): NewsStory[] {
  return useMemo(() => {
    const rows = unreadOnly ? state.media.stories.filter((s) => !s.read) : state.media.stories;
    return rows
      .slice()
      .sort((a, b) => b.cycle - a.cycle || b.importance - a.importance)
      .slice(0, limit);
  }, [state.media.stories, unreadOnly, limit]);
}

/* --- the event underneath ---------------------------------------------- */

export function useEventIndex(state: GameState): Map<string, AnyDomainEvent> {
  return useMemo(() => {
    const map = new Map<string, AnyDomainEvent>();
    for (const event of state.eventLog) map.set(event.id, event);
    return map;
  }, [state.eventLog]);
}

/**
 * A domain event, in a sentence.
 *
 * This is a formatter over an already-decided fact — the event has happened,
 * been journalled and been reacted to. Nothing here computes anything; it
 * translates a payload into English so "why am I reading this?" has an answer
 * one tap away.
 */
export function describeEvent(event: AnyDomainEvent): { title: string; detail: string } {
  const name = (kind: string): string =>
    event.entities.find((e) => e.kind === kind)?.name ?? '';

  switch (event.type) {
    case 'GOAL_SCORED':
      return {
        title: `Goal, minute ${event.payload.minute}`,
        detail: `${name('player') || 'A player'} scored to make it ${event.payload.homeScore}–${event.payload.awayScore}.`,
      };
    case 'MATCH_WON':
      return {
        title: 'Match won',
        detail: `${event.payload.homeScore}–${event.payload.awayScore} against ${name('club') || 'the opposition'}.`,
      };
    case 'MATCH_LOST':
      return {
        title: 'Match lost',
        detail: `${event.payload.homeScore}–${event.payload.awayScore}, a margin of ${event.payload.margin}.`,
      };
    case 'MATCH_DRAWN':
      return { title: 'Match drawn', detail: `It finished ${event.payload.score}–${event.payload.score}.` };
    case 'RED_CARD':
      return {
        title: 'Red card',
        detail: `${name('player') || 'A player'} was sent off in minute ${event.payload.minute}.`,
      };
    case 'PLAYER_INJURED':
      return {
        title: 'Injury',
        detail: `${name('player') || 'A player'} picked up a ${event.payload.severity.toLowerCase()} injury — ${event.payload.weeksOut} weeks out.`,
      };
    case 'PLAYER_SIGNED':
      return {
        title: 'Signing completed',
        detail: `${name('player') || 'A player'} signed for a fee of ${event.payload.fee.toLocaleString('en-GB')}.`,
      };
    case 'PLAYER_SOLD':
      return {
        title: 'Player sold',
        detail: `Sold for ${event.payload.fee.toLocaleString('en-GB')}.`,
      };
    case 'TRANSFER_HIJACKED':
      return { title: 'Deal hijacked', detail: 'A rival club went over the top of a deal in progress.' };
    case 'RIVALRY_INTENSIFIED':
      return {
        title: 'Rivalry intensified',
        detail: `${event.payload.reason} Intensity is now ${Math.round(event.payload.intensity)}.`,
      };
    case 'TROPHY_WON':
      return { title: 'Trophy won', detail: `${event.payload.competition}, season ${event.payload.season}.` };
    case 'OBJECTIVE_COMPLETED':
      return { title: 'Objective completed', detail: `${event.payload.title} — ${event.payload.rewardSummary}` };
    case 'RECORD_BROKEN':
      return { title: 'Record broken', detail: `${event.payload.record}: ${event.payload.value}` };
    case 'CREATOR_MOMENT':
      return {
        title: 'Creator moment',
        detail: `${name('creator') || 'A creator'} produced a ${event.payload.kind.toLowerCase()} moment reaching ${event.payload.reach.toLocaleString('en-GB')} people.`,
      };
    case 'FAN_SENTIMENT_CHANGED':
      return {
        title: 'Fan sentiment moved',
        detail: `${event.payload.reason} — now ${Math.round(event.payload.to)}.`,
      };
    case 'MANAGER_SACKED':
      return { title: 'Manager sacked', detail: `${event.payload.managerName} has lost his job.` };
    case 'MOTM_AWARDED':
      return {
        title: 'Man of the match',
        detail: `${name('player') || 'A player'} rated ${event.payload.rating.toFixed(1)}.`,
      };
    default:
      return {
        title: event.type.replace(/_/g, ' ').toLowerCase(),
        detail: event.entities.map((e) => e.name).join(', ') || 'Recorded in the world journal.',
      };
  }
}

/* --- creators ----------------------------------------------------------- */

export function useCreators(state: GameState) {
  return useMemo(() => Object.values(state.creators), [state.creators]);
}
