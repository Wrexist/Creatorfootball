import type { AnyDomainEvent } from '../core/events';
import type { EventId, PlayerId } from '../core/brand';
import type { GameState, SocialPost } from '../game/state';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import type { ContentRegistryPort } from '../simulation/ports';
import { clubToken, personToken } from '../simulation/ports';
import { seedFrom } from '../simulation/templating';
import { SOCIAL_ACTION_BALANCE as A } from './balance';
import { applySocialEffect, describeEffect, importanceScale, type EffectLine, type SocialEffect } from './effects';
import { hookFromMoment, momentById, socialMoments, type SocialMoment } from './moments';
import { appendPosts, postRenderContext, renderPost, type PostAuthor } from './postFactory';
import { socialStanding } from './standing';
import { socialWorld, withSocialWorld, type PlayerAction } from './worldState';

/**
 * Answering, and not answering.
 *
 * A rival's dig sitting in your feed is a question addressed to you, and the
 * interesting design property is that *silence is one of the answers*. Both
 * paths change something, so scrolling past is a decision the player makes on
 * purpose rather than an absence of one.
 *
 * Everything here still traces to a real event: a reaction inherits the source
 * event of the post it reacts to, which the world engine set from the domain
 * event that caused the post in the first place.
 */

export const REACTIONS = ['LIKE', 'REPOST', 'QUOTE', 'SILENCE'] as const;
export type ReactionKind = (typeof REACTIONS)[number];

export interface ReactionInfo {
  readonly kind: ReactionKind;
  readonly label: string;
  readonly blurb: string;
}

export const REACTION_INFO: Readonly<Record<ReactionKind, ReactionInfo>> = {
  LIKE: {
    kind: 'LIKE',
    label: 'Like it',
    blurb: 'Small, visible, and noticed by exactly the people who were looking.',
  },
  REPOST: {
    kind: 'REPOST',
    label: 'Share it',
    blurb: 'You put your own audience behind somebody else’s words.',
  },
  QUOTE: {
    kind: 'QUOTE',
    label: 'Quote it',
    blurb: 'You answer in public, on top of what they said. It travels twice as far and cuts both ways.',
  },
  SILENCE: {
    kind: 'SILENCE',
    label: 'Say nothing',
    blurb: 'Deliberate silence. The press read it as composure; your dressing room may not.',
  },
};

/**
 * A post that is waiting for an answer.
 *
 * Not everything hostile qualifies. It has to be about your club, recent
 * enough that answering is not weird, loud enough to matter, and not already
 * dealt with — because a feed that keeps asking you about a week-old dig is
 * a chore rather than a conversation.
 */
export interface Provocation {
  readonly post: SocialPost;
  readonly momentId: string | null;
  readonly heat: number;
  readonly from: 'RIVAL' | 'CREATOR' | 'MEDIA' | 'LEAK' | 'FAN' | 'PLAYER';
  readonly prompt: string;
}

export function provocations(state: GameState): Provocation[] {
  const world = socialWorld(state);
  const handled = new Set(world.handled);
  const floor = state.clock.cycle - A.reaction.windowCycles;
  const clubId = state.playerClubId;
  const moments = socialMoments(state, { windowCycles: A.reaction.windowCycles + 1, limit: 64 });
  const momentByEvent = new Map(moments.map((m) => [String(m.eventId), m] as const));

  const out: Provocation[] = [];
  for (const post of state.social.posts) {
    if (post.cycle < floor) continue;
    if (handled.has(post.id)) continue;
    if (post.tags.includes('authored') || post.tags.includes('reply-to-club')) continue;
    if (post.sentiment > A.reaction.provokeThreshold) continue;
    const aboutUs = post.entities.some((e) => e.kind === 'club' && e.id === clubId)
      || post.kind === 'RIVAL';
    if (!aboutUs) continue;
    const kind = post.kind === 'RIVAL' || post.kind === 'CREATOR' || post.kind === 'MEDIA'
      || post.kind === 'LEAK' || post.kind === 'PLAYER' ? post.kind : 'FAN';
    out.push({
      post,
      momentId: post.relatedEventId
        ? momentByEvent.get(String(post.relatedEventId))?.id ?? null
        : null,
      heat: Math.round((-post.sentiment) * 50 + Math.log10(post.likes + 10) * 12),
      from: kind,
      prompt: promptFor(kind, post),
    });
  }
  return out.sort((a, b) => b.heat - a.heat || (a.post.id < b.post.id ? -1 : 1));
}

const promptFor = (kind: Provocation['from'], post: SocialPost): string => {
  switch (kind) {
    case 'RIVAL': return 'A rival has come for you in public.';
    case 'CREATOR': return 'A creator has written you off to their whole audience.';
    case 'MEDIA': return 'The press have printed it, so it is now the story.';
    case 'LEAK': return 'Somebody is briefing against you.';
    case 'PLAYER': return 'One of your own has said it out loud.';
    default: return post.sentiment < -0.6 ? 'Your own support has turned on this.' : 'This is being repeated.';
  }
};

export interface ReactionOption {
  readonly kind: ReactionKind;
  readonly info: ReactionInfo;
  readonly effect: SocialEffect;
  readonly lines: readonly EffectLine[];
  readonly reach: number;
}

/**
 * Price all four responses to one post.
 *
 * Quote-dunking rides on the other account's reach, which is why answering a
 * huge account is both the loudest option and the one that hands them the
 * argument if it goes badly.
 */
export function reactionOptions(state: GameState, post: SocialPost): ReactionOption[] {
  const club = state.clubs[state.playerClubId];
  const followers = club?.fans.onlineFollowers ?? state.social.clubFollowers;
  const standing = socialStanding(state);
  const parentReach = post.likes * 8 + post.reposts * 30;
  const importance = post.weight >= 60 ? 4 : post.weight >= 40 ? 3 : 2;
  const scale = importanceScale(importance) * A.baseDelta;
  const rivalId = post.entities.find((e) => e.kind === 'club' && e.id !== state.playerClubId)?.id;

  const build = (kind: ReactionKind): ReactionOption => {
    const r = A.reaction;
    switch (kind) {
      case 'LIKE': {
        const effect: SocialEffect = {
          fanSentiment: r.like.fanSentiment * scale,
          supportersTrust: r.like.trust * scale,
        };
        return {
          kind, info: REACTION_INFO[kind], effect, lines: describeEffect(effect, state),
          reach: Math.round(followers * r.like.reach),
        };
      }
      case 'REPOST': {
        const effect: SocialEffect = {
          fanSentiment: r.repost.fanSentiment * scale,
          supportersTrust: r.repost.trust * scale,
          fanExcitement: r.repost.reach * scale,
        };
        return {
          kind, info: REACTION_INFO[kind], effect, lines: describeEffect(effect, state),
          reach: Math.round(followers * r.repost.reach * standing.reachMultiplier),
        };
      }
      case 'QUOTE': {
        const effect: SocialEffect = {
          fanExcitement: r.quote.fanExcitement * scale,
          mediaGoodwill: r.quote.mediaGoodwill * scale,
          fanSentiment: scale * 0.4,
          ...(rivalId ? { rivalryHeat: { opponentClubId: rivalId as never, delta: r.quote.rivalryHeat * scale } } : {}),
        };
        return {
          kind, info: REACTION_INFO[kind], effect, lines: describeEffect(effect, state),
          reach: Math.round((followers * 0.3 + parentReach * r.reachTransferShare) * standing.reachMultiplier),
        };
      }
      default: {
        const aboutPlayer = post.entities.some((e) => e.kind === 'player');
        const effect: SocialEffect = {
          mediaGoodwill: r.silence.mediaGoodwill * scale,
          ...(aboutPlayer ? { squadMorale: r.silence.squadMorale * scale } : {}),
          ...(rivalId ? { rivalryHeat: { opponentClubId: rivalId as never, delta: r.silence.rivalryHeat * scale } } : {}),
        };
        return {
          kind, info: REACTION_INFO[kind], effect, lines: describeEffect(effect, state), reach: 0,
        };
      }
    }
  };

  return REACTIONS.map(build);
}

export interface ReactionInput {
  readonly postId: string;
  readonly kind: ReactionKind;
  readonly at: number;
  readonly registry?: ContentRegistryPort | null;
}

export interface ReactionResult {
  readonly state: GameState;
  readonly ok: boolean;
  readonly reason?: string;
  readonly post?: SocialPost;
  readonly effect?: SocialEffect;
  readonly events: readonly AnyDomainEvent[];
}

/** Act on somebody else's post. */
export function reactToPost(state: GameState, input: ReactionInput): ReactionResult {
  const target = state.social.posts.find((p) => p.id === input.postId);
  if (!target) return { state, ok: false, reason: 'That post has scrolled away.', events: [] };
  const world = socialWorld(state);
  if (world.handled.includes(target.id)) {
    return { state, ok: false, reason: 'You have already dealt with that one.', events: [] };
  }

  const option = reactionOptions(state, target).find((o) => o.kind === input.kind);
  if (!option) return { state, ok: false, reason: 'Unknown reaction.', events: [] };

  const cycle = state.clock.cycle;
  const anchor = (target.relatedEventId ?? `sp_${target.id}`) as EventId;
  const applied = applySocialEffect(state, option.effect, {
    anchorEventId: anchor,
    suffix: `react${input.kind.toLowerCase()}`,
    reason: `Club ${input.kind.toLowerCase()} on a post`,
    cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    clubId: state.playerClubId,
  });

  let next = applied.state;
  let published: SocialPost | undefined;

  if (input.kind === 'QUOTE') {
    const availability = A.postsPerCycle;
    const used = world.actions.filter((a) => a.cycle === cycle && (a.kind === 'POST' || a.kind === 'QUOTE')).length;
    if (used >= availability) {
      return {
        state, ok: false, events: [],
        reason: 'You have used your voice enough this week. A fourth post is noise.',
      };
    }
    const rng = new Rng(`${state.seed}:quote:${target.id}`);
    const ctx = postRenderContext(next, input.registry ?? null, cycle);
    const club = state.clubs[state.playerClubId];
    const moment = target.relatedEventId ? momentById(state, `mo_${String(target.relatedEventId).toLowerCase()}`) : null;
    const tokens = {
      ...(moment?.tokens ?? {}),
      ...(club ? { club: clubToken(club.name) } : {}),
      ...(state.managers[state.playerManagerId]
        ? { manager: personToken(state.managers[state.playerManagerId]?.name ?? '') } : {}),
      critic: target.authorName,
    };
    const hook = moment
      ? hookFromMoment(moment, { tokens, tags: [...moment.tags, 'authored'] })
      : {
        trigger: 'QUOTE_DUNK',
        sourceEventId: anchor,
        rootEventId: anchor,
        depth: 0,
        importance: 3 as const,
        sentiment: -0.4,
        tokens,
        facts: { authored: true },
        entities: target.entities.map((e) => ({ kind: e.kind as never, id: e.id, name: e.name })),
        clubId: state.playerClubId,
        audiences: ['FAN' as const],
        tags: ['authored'],
        cycle,
      };
    const author: PostAuthor = club
      ? {
        kind: 'CLUB', name: club.name, handle: `@${club.abbreviation.toLowerCase()}official`,
        avatarSeed: seedFrom('club', club.abbreviation), verified: true,
        reach: Math.max(1_000, option.reach),
      }
      : { kind: 'CLUB', name: 'The club', handle: '@club', avatarSeed: 'club', verified: true, reach: option.reach };

    published = renderPost(ctx, rng, {
      id: `sp_quote_${target.id}`.toLowerCase(),
      author,
      hook,
      facts: { authored: true, reaction: 'QUOTE', criticKind: target.kind },
      sentiment: -0.5,
      trigger: 'QUOTE_DUNK',
      fallbackTriggers: [hook.trigger, 'CLUB_STATEMENT'],
      quoted: { authorName: target.authorName, text: target.text },
      extraTags: ['authored', 'quote-dunk'],
      weightBonus: 10,
    }) ?? undefined;

    if (published) next = appendPosts(next, [published]);
  }

  if (input.kind === 'REPOST' || input.kind === 'LIKE') {
    // Boosting somebody visibly changes their numbers. The feed shows it.
    const boost = input.kind === 'REPOST' ? 1.45 : 1.12;
    next = {
      ...next,
      social: {
        ...next.social,
        posts: next.social.posts.map((p) => (p.id === target.id
          ? {
            ...p,
            likes: Math.round(p.likes * boost),
            reposts: Math.round(p.reposts * boost) + (input.kind === 'REPOST' ? 1 : 0),
            tags: [...p.tags, `club-${input.kind.toLowerCase()}`],
          }
          : p)),
      },
    };
  }

  const profile = {
    LIKE: { volume: A.reaction.like.volume, warmth: A.reaction.like.warmth, credibility: 0.1 },
    REPOST: { volume: A.reaction.repost.volume, warmth: A.reaction.repost.warmth, credibility: 0.15 },
    QUOTE: { volume: A.reaction.quote.volume, warmth: A.reaction.quote.warmth, credibility: -0.05 },
    SILENCE: { volume: A.reaction.silence.volume, warmth: A.reaction.silence.warmth, credibility: A.reaction.silence.credibility },
  }[input.kind];

  const action: PlayerAction = {
    id: `pa_react_${target.id}_${input.kind.toLowerCase()}`,
    kind: input.kind === 'SILENCE' ? 'SILENCE' : input.kind === 'QUOTE' ? 'QUOTE' : input.kind,
    cycle,
    eventId: anchor,
    volume: profile.volume,
    warmth: profile.warmth,
    credibility: profile.credibility,
    summary: `${REACTION_INFO[input.kind].label}: ${target.authorName}`,
    ...(published ? { postId: published.id } : {}),
  };

  next = withSocialWorld(next, (w) => ({
    handled: [...w.handled, target.id].slice(-160),
    actions: [...w.actions, action].slice(-240),
  }));

  return {
    state: next,
    ok: true,
    ...(published ? { post: published } : {}),
    effect: option.effect,
    events: applied.events,
  };
}

/* --- talking to your own people ----------------------------------------- */

export const REPLY_STANCES = ['BACK_HIM', 'PRIVATE_WORD', 'CALL_HIM_OUT'] as const;
export type ReplyStance = (typeof REPLY_STANCES)[number];

export interface ReplyStanceInfo {
  readonly stance: ReplyStance;
  readonly label: string;
  readonly blurb: string;
}

export const REPLY_INFO: Readonly<Record<ReplyStance, ReplyStanceInfo>> = {
  BACK_HIM: {
    stance: 'BACK_HIM',
    label: 'Back him in public',
    blurb: 'You put your own credit behind him. He will not forget it; the press will call it weak.',
  },
  PRIVATE_WORD: {
    stance: 'PRIVATE_WORD',
    label: 'Deal with it inside',
    blurb: 'Nothing said outside the building. Safe, quiet, and only half as effective.',
  },
  CALL_HIM_OUT: {
    stance: 'CALL_HIM_OUT',
    label: 'Call him out',
    blurb: 'You side with the supporters against one of your own. It works exactly once.',
  },
};

/** A player who has said something in public and is waiting on an answer. */
export interface UnhappyVoice {
  readonly post: SocialPost;
  readonly playerId: PlayerId;
  readonly name: string;
  readonly morale: number;
  readonly momentId: string | null;
  readonly summary: string;
}

export function unhappyVoices(state: GameState): UnhappyVoice[] {
  const world = socialWorld(state);
  const handled = new Set(world.handled);
  const floor = state.clock.cycle - A.reaction.windowCycles;
  const club = state.clubs[state.playerClubId];
  if (!club) return [];
  const squad = new Set<string>(club.squad);
  const moments = socialMoments(state, { windowCycles: A.reaction.windowCycles + 1, limit: 64 });
  const byEvent = new Map(moments.map((m) => [String(m.eventId), m] as const));

  const out: UnhappyVoice[] = [];
  for (const post of state.social.posts) {
    if (post.cycle < floor || handled.has(post.id)) continue;
    if (!post.tags.includes('dressing-room') && post.sentiment > -0.25) continue;
    const ref = post.entities.find((e) => e.kind === 'player' && squad.has(e.id));
    if (!ref) continue;
    const player = state.players[ref.id];
    if (!player) continue;
    out.push({
      post,
      playerId: player.id,
      name: player.displayName,
      morale: Math.round(player.mental.morale),
      momentId: post.relatedEventId ? byEvent.get(String(post.relatedEventId))?.id ?? null : null,
      summary: player.mental.morale < A.reply.lowMoraleThreshold
        ? `${player.displayName} is on the floor and it is now public.`
        : `${player.displayName} has aired it outside the building.`,
    });
  }
  return out.sort((a, b) => a.morale - b.morale || (a.post.id < b.post.id ? -1 : 1));
}

export interface ReplyOption {
  readonly stance: ReplyStance;
  readonly info: ReplyStanceInfo;
  readonly effect: SocialEffect;
  readonly lines: readonly EffectLine[];
}

export function replyOptions(state: GameState, voice: UnhappyVoice): ReplyOption[] {
  const player = state.players[voice.playerId];
  const fragile = (player?.mental.morale ?? 50) < A.reply.lowMoraleThreshold;
  const build = (stance: ReplyStance): ReplyOption => {
    const table = stance === 'BACK_HIM' ? A.reply.backing
      : stance === 'PRIVATE_WORD' ? A.reply.privateWord
        : A.reply.callOut;
    const harshness = stance === 'CALL_HIM_OUT' && fragile ? A.reply.lowMoraleMultiplier : 1;
    const effect: SocialEffect = {
      playerMorale: { playerId: voice.playerId, delta: table.playerMorale * harshness },
      squadMorale: table.squadMorale,
      mediaGoodwill: table.mediaGoodwill,
      fanSentiment: table.fanSentiment,
    };
    return { stance, info: REPLY_INFO[stance], effect, lines: describeEffect(effect, state) };
  };
  return REPLY_STANCES.map(build);
}

export interface ReplyInput {
  readonly postId: string;
  readonly stance: ReplyStance;
  readonly at: number;
  readonly registry?: ContentRegistryPort | null;
}

/** Answer one of your own, in public or otherwise. */
export function replyToPlayer(state: GameState, input: ReplyInput): ReactionResult {
  const voice = unhappyVoices(state).find((v) => v.post.id === input.postId);
  if (!voice) return { state, ok: false, reason: 'Nobody is waiting on that.', events: [] };
  const option = replyOptions(state, voice).find((o) => o.stance === input.stance);
  if (!option) return { state, ok: false, reason: 'Unknown stance.', events: [] };

  const cycle = state.clock.cycle;
  const anchor = (voice.post.relatedEventId ?? `sp_${voice.post.id}`) as EventId;
  const applied = applySocialEffect(state, option.effect, {
    anchorEventId: anchor,
    suffix: `reply${input.stance.toLowerCase()}`,
    reason: REPLY_INFO[input.stance].label,
    cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    clubId: state.playerClubId,
  });

  let next = applied.state;
  let published: SocialPost | undefined;

  if (input.stance !== 'PRIVATE_WORD') {
    const rng = new Rng(`${state.seed}:reply:${voice.post.id}:${input.stance}`);
    const ctx = postRenderContext(next, input.registry ?? null, cycle);
    const club = state.clubs[state.playerClubId];
    const manager = state.managers[state.playerManagerId];
    const moment: SocialMoment | null = voice.momentId ? momentById(state, voice.momentId) : null;
    const tokens = {
      ...(moment?.tokens ?? {}),
      player: personToken(voice.name),
      ...(club ? { club: clubToken(club.name) } : {}),
      ...(manager ? { manager: personToken(manager.name) } : {}),
    };
    const hook = moment
      ? hookFromMoment(moment, { tokens, tags: [...moment.tags, 'authored', 'dressing-room'] })
      : {
        trigger: 'MANAGER_REPLY',
        sourceEventId: anchor, rootEventId: anchor, depth: 0,
        importance: 3 as const,
        sentiment: input.stance === 'BACK_HIM' ? 0.5 : -0.5,
        tokens,
        facts: {},
        entities: voice.post.entities.map((e) => ({ kind: e.kind as never, id: e.id, name: e.name })),
        clubId: state.playerClubId,
        playerId: voice.playerId,
        audiences: ['MEDIA' as const],
        tags: ['authored', 'dressing-room'],
        cycle,
      };

    published = renderPost(ctx, rng, {
      id: `sp_mgrreply_${voice.post.id}_${input.stance.toLowerCase()}`.toLowerCase(),
      author: {
        kind: 'CLUB',
        name: manager?.name ?? club?.name ?? 'The manager',
        handle: `@${(manager?.name ?? 'manager').toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14)}`,
        avatarSeed: seedFrom('manager', manager?.id ?? 'mgr'),
        verified: true,
        reach: Math.max(2_000, Math.round((club?.fans.onlineFollowers ?? 10_000) * A.managerPostReachShare)),
      },
      hook,
      facts: { authored: true, stance: input.stance, morale: voice.morale },
      sentiment: input.stance === 'BACK_HIM' ? 0.55 : -0.55,
      trigger: 'MANAGER_REPLY',
      fallbackTriggers: [hook.trigger, 'CLUB_STATEMENT'],
      quoted: { authorName: voice.post.authorName, text: voice.post.text },
      extraTags: ['authored', `stance:${input.stance.toLowerCase()}`],
      weightBonus: 9,
    }) ?? undefined;
    if (published) next = appendPosts(next, [published]);
  }

  const table = input.stance === 'BACK_HIM' ? A.reply.backing
    : input.stance === 'PRIVATE_WORD' ? A.reply.privateWord
      : A.reply.callOut;

  const action: PlayerAction = {
    id: `pa_reply_${voice.post.id}_${input.stance.toLowerCase()}`,
    kind: 'REPLY',
    cycle,
    eventId: anchor,
    volume: input.stance === 'PRIVATE_WORD' ? 0.15 : 0.8,
    warmth: table.warmth,
    credibility: table.credibility,
    summary: `${REPLY_INFO[input.stance].label} — ${voice.name}`,
    ...(published ? { postId: published.id } : {}),
  };

  // Backing a player publicly is a promise, and the results will check it.
  const stake = input.stance === 'BACK_HIM'
    ? {
      id: `stk_back_${voice.playerId}_${cycle}`,
      kind: 'PUBLIC_BACKING' as const,
      eventId: anchor,
      openedCycle: cycle,
      settleAfterCycle: cycle + 1,
      tone: 'DEFIANT' as const,
      stake: clamp(0.4 + (60 - voice.morale) / 120, 0.25, 0.9),
      claim: `You backed ${voice.name} in public. His next month is now your judgement on trial.`,
      playerId: voice.playerId,
    }
    : null;

  next = withSocialWorld(next, (w) => ({
    handled: [...w.handled, voice.post.id].slice(-160),
    actions: [...w.actions, action].slice(-240),
    ...(stake ? { stakes: [...w.stakes, stake] } : {}),
  }));

  return {
    state: next,
    ok: true,
    ...(published ? { post: published } : {}),
    effect: option.effect,
    events: applied.events,
  };
}
