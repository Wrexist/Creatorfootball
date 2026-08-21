import type { ClubId, EventId, PlayerId } from '../core/brand';
import type { AnyDomainEvent } from '../core/events';
import type { GameState, SocialPost } from '../game/state';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { creatorReach } from '../creators/creator';
import type { ContentRegistryPort } from '../simulation/ports';
import { clubToken, personToken } from '../simulation/ports';
import { seedFrom } from '../simulation/templating';
import { rivalriesOf, rivalOpponent } from '../rivalries/rivalries';
import { OUTLETS } from '../media/balance';
import { FAN_PERSONAS, SOCIAL_ACTION_BALANCE as A, SOCIAL_BALANCE as S } from './balance';
import { applySocialEffect, describeEffect, importanceScale, type EffectLine, type SocialEffect } from './effects';
import { hookFromMoment, momentById, type SocialMoment } from './moments';
import { appendPosts, postRenderContext, renderPost, type PostAuthor, type PostRenderContext } from './postFactory';
import { socialStanding } from './standing';
import {
  socialWorld, withSocialWorld,
  type PlayerAction, type PostTone, type PostVoice, type SocialStake,
} from './worldState';

/**
 * Composing.
 *
 * The single change that turns the feed from a thing the player watches into a
 * thing the player plays. You pick something that happened, you pick who says
 * it and how, and the world answers.
 *
 * Three rules hold the design together.
 *
 * **You can only talk about something real.** A post is always attached to a
 * `SocialMoment`, which is a domain event from the journal expanded through the
 * cascade. There is no free-text box, because a free-text box would be the one
 * thing in the feed with no event behind it.
 *
 * **Every tone buys something and costs something.** The tone table in
 * `balance.ts` is the design document: hype spends credibility, class spends
 * reach, provocation spends the room, comedy spends being taken seriously,
 * defiance spends everyone outside your own dressing room. None of them is the
 * right answer twice in a row.
 *
 * **Talking before it happens is a bet.** A forward-looking moment opens a
 * stake, settled by the social tick when the fixture has been played. Winning
 * after you called it is worth far more than winning quietly; losing after you
 * called it is worth far less. Saying nothing is therefore a real move, and the
 * screen says so.
 */

export interface ToneInfo {
  readonly tone: PostTone;
  readonly label: string;
  readonly blurb: string;
  /** What this tone is for, in one line the player can act on. */
  readonly use: string;
}

export const TONE_INFO: Readonly<Record<PostTone, ToneInfo>> = {
  HYPE: {
    tone: 'HYPE',
    label: 'Hype',
    blurb: 'All caps energy. The ground shakes and nobody checks the details.',
    use: 'Best after something genuinely good. Embarrassing after anything else.',
  },
  CLASSY: {
    tone: 'CLASSY',
    label: 'Classy',
    blurb: 'Short, warm, no adjectives. The kind of line that gets read out on the radio.',
    use: 'Quiet and safe. Buys goodwill with the press, wins you nothing loud.',
  },
  PROVOCATIVE: {
    tone: 'PROVOCATIVE',
    label: 'Provocative',
    blurb: 'A shot across the bow. It will be screenshotted within the minute.',
    use: 'The furthest travelling tone, and the only one that can lose you the room.',
  },
  FUNNY: {
    tone: 'FUNNY',
    label: 'Funny',
    blurb: 'A bit. It converts strangers into followers and pundits into critics.',
    use: 'Great for growth. Nobody quotes a joke when they want your opinion.',
  },
  DEFIANT: {
    tone: 'DEFIANT',
    label: 'Defiant',
    blurb: 'Us against the lot of you. The dressing room reads this one first.',
    use: 'Lifts the squad when things are bad. Everyone outside finds it tiresome.',
  },
};

/** Where each tone sits on the -1..1 mood line, for judging whether it fits. */
const TONE_VALENCE: Readonly<Record<PostTone, number>> = {
  HYPE: 1, CLASSY: 0.2, PROVOCATIVE: 0.3, FUNNY: 0.4, DEFIANT: -0.2,
};

export interface VoiceInfo {
  readonly voice: PostVoice;
  readonly label: string;
  readonly blurb: string;
}

export const VOICE_INFO: Readonly<Record<PostVoice, VoiceInfo>> = {
  CLUB: {
    voice: 'CLUB',
    label: 'The club account',
    blurb: 'Speaks to everyone who already follows you. Institutional, and hard to walk back.',
  },
  MANAGER: {
    voice: 'MANAGER',
    label: 'You, personally',
    blurb: 'A smaller room, but the press quote a person far more readily than a badge.',
  },
};

/**
 * How well a tone fits the moment.
 *
 * Gains are multiplied by the fit and costs are multiplied by its inverse, so
 * a badly judged post does not merely fail to work — it actively costs more
 * than a well judged one. That asymmetry is what makes reading the room a skill
 * rather than a preference.
 */
export const toneFit = (moment: SocialMoment, tone: PostTone): number =>
  clamp(1.25 - Math.abs(moment.sentiment - TONE_VALENCE[tone]) * 0.55, 0.2, 1.25);

/** Posts the club has already published this cycle. */
export function postsThisCycle(state: GameState): number {
  const cycle = state.clock.cycle;
  return socialWorld(state).actions.filter(
    (a) => a.cycle === cycle && (a.kind === 'POST' || a.kind === 'QUOTE'),
  ).length;
}

export interface ComposeAvailability {
  readonly allowed: boolean;
  readonly used: number;
  readonly cap: number;
  /** Reach multiplier the next post would carry. */
  readonly fatigue: number;
  readonly reason: string;
}

/**
 * Whether the club still has anything worth saying this week.
 *
 * This is not a currency and it is not a timer — it is the observation that an
 * account which posts nine times about one result is an account people mute.
 * Reach falls off sharply for the second and third post of a matchweek, and
 * past the third the club is talking to itself.
 */
export function composeAvailability(state: GameState): ComposeAvailability {
  const used = postsThisCycle(state);
  const cap = A.postsPerCycle;
  const fatigue = A.postFatigue[Math.min(used, A.postFatigue.length - 1)] ?? 0;
  if (used >= cap) {
    return {
      allowed: false, used, cap, fatigue: 0,
      reason: 'You have said enough this week. Another post now reaches almost nobody and starts to grate.',
    };
  }
  return {
    allowed: true, used, cap, fatigue,
    reason: used === 0
      ? 'Nothing published yet this week.'
      : `${used} of ${cap} published. The next one reaches about ${Math.round(fatigue * 100)}% as far.`,
  };
}

export interface ComposeOption {
  readonly tone: PostTone;
  readonly voice: PostVoice;
  readonly info: ToneInfo;
  readonly fit: number;
  /** The predicted world effect, exactly as it will be applied. */
  readonly effect: SocialEffect;
  readonly lines: readonly EffectLine[];
  readonly reach: number;
  /** Set when publishing this would put something on the line. */
  readonly stake: { readonly claim: string; readonly weight: number } | null;
  /** Stated plainly when the tone is a poor read of the room. */
  readonly warning: string | null;
}

const playerClubOf = (state: GameState) => state.clubs[state.playerClubId];

/** The club's own audience, which is what a club post actually reaches. */
function voiceReach(state: GameState, voice: PostVoice): number {
  const club = playerClubOf(state);
  const followers = club?.fans.onlineFollowers ?? state.social.clubFollowers;
  const manager = state.managers[state.playerManagerId];
  const linked = manager?.creatorId ? state.creators[manager.creatorId] : undefined;
  if (voice === 'MANAGER') {
    const personal = linked ? creatorReach(linked) : followers * A.managerPostReachShare;
    return Math.max(500, Math.round(personal * A.managerQuoteBonus));
  }
  return Math.max(800, Math.round(followers * A.clubPostReachShare));
}

/** Tokens rewritten from the player's point of view rather than the fixture's. */
function voiceTokens(state: GameState, moment: SocialMoment) {
  const club = playerClubOf(state);
  const manager = state.managers[state.playerManagerId];
  const opponentId = moment.opponentClubId
    ?? (moment.clubId && moment.clubId !== state.playerClubId ? moment.clubId : undefined);
  const opponent = opponentId ? state.clubs[opponentId] : undefined;
  return {
    ...moment.tokens,
    ...(club ? { club: clubToken(club.name), clubShort: club.shortName } : {}),
    ...(opponent ? { opponent: clubToken(opponent.name), rival: clubToken(opponent.name) } : {}),
    ...(manager ? { manager: personToken(manager.name) } : {}),
  };
}

function opponentFor(state: GameState, moment: SocialMoment): ClubId | undefined {
  if (moment.opponentClubId && moment.opponentClubId !== state.playerClubId) return moment.opponentClubId;
  if (moment.clubId && moment.clubId !== state.playerClubId) return moment.clubId;
  const top = rivalriesOf(state, state.playerClubId)[0];
  return top ? rivalOpponent(top, state.playerClubId) : undefined;
}

/**
 * Predict what a tone would do, without doing it.
 *
 * The apply path calls this same function, so the numbers on the button are
 * the numbers that land. There is no hidden roll between the two.
 */
export function composeEffect(
  state: GameState,
  moment: SocialMoment,
  tone: PostTone,
  voice: PostVoice,
): SocialEffect {
  const t = A.tone[tone];
  const fit = toneFit(moment, tone);
  const scale = importanceScale(moment.importance) * A.baseDelta;
  const gain = scale * fit;
  const cost = scale * (2 - fit);
  // The manager's word carries further inside the building and less outside it.
  const inside = voice === 'MANAGER' ? 1.25 : 0.85;
  const outside = voice === 'MANAGER' ? 0.85 : 1.15;
  const opponentId = opponentFor(state, moment);

  return {
    fanSentiment: t.fanSentiment * gain * outside,
    fanExcitement: t.fanExcitement * gain * outside,
    fanTrust: t.trust * gain,
    squadMorale: t.squadMorale * gain * inside,
    mediaGoodwill: t.mediaGoodwill >= 0 ? t.mediaGoodwill * gain : t.mediaGoodwill * cost,
    supportersTrust: t.trust * gain,
    ...(opponentId && t.rivalryHeat !== 0
      ? { rivalryHeat: { opponentClubId: opponentId, delta: t.rivalryHeat * (t.rivalryHeat > 0 ? cost : gain) } }
      : {}),
  };
}

const WARNINGS: Readonly<Record<PostTone, string>> = {
  HYPE: 'Celebrating this reads as delusional to everybody who watched it.',
  CLASSY: 'A measured line here will be taken as a shrug.',
  PROVOCATIVE: 'You have not earned this yet. It will be replayed at you.',
  FUNNY: 'Nobody wants the joke this week.',
  DEFIANT: 'There is nothing to be defiant about. It reads as picking a fight with your own supporters.',
};

/** Every way the player could speak about one moment, priced. */
export function composeOptions(
  state: GameState,
  moment: SocialMoment,
  voice: PostVoice = 'CLUB',
): ComposeOption[] {
  const availability = composeAvailability(state);
  const baseReach = voiceReach(state, voice) * availability.fatigue * socialStanding(state).reachMultiplier;

  return Object.values(TONE_INFO).map((info) => {
    const fit = toneFit(moment, info.tone);
    const effect = composeEffect(state, moment, info.tone, voice);
    const weight = A.tone[info.tone].stake;
    const opensStake = moment.forward && weight >= A.stake.minimumWeight;
    return {
      tone: info.tone,
      voice,
      info,
      fit: Math.round(fit * 100) / 100,
      effect,
      lines: describeEffect(effect, state),
      reach: Math.round(baseReach * A.tone[info.tone].reach),
      stake: opensStake
        ? { claim: stakeClaim(state, moment, info.tone), weight: Math.round(weight * 100) / 100 }
        : null,
      warning: fit < 0.55 ? WARNINGS[info.tone] : null,
    };
  });
}

/** What the player is committing to, said back to them before they commit. */
function stakeClaim(state: GameState, moment: SocialMoment, tone: PostTone): string {
  const opponentId = opponentFor(state, moment);
  const opponent = opponentId ? state.clubs[opponentId]?.shortName ?? 'them' : 'them';
  switch (tone) {
    case 'PROVOCATIVE': return `You went at ${opponent} before a ball was kicked. Win and it is legend; lose and it is a poster in their away end.`;
    case 'HYPE': return `You told everybody this was happening. ${opponent} have read it.`;
    case 'DEFIANT': return `You drew a line before the match. The squad will be measured against it.`;
    case 'FUNNY': return `You made a joke at ${opponent}'s expense. Jokes age badly at full time.`;
    default: return `You spoke before the match. The result will be read as an answer.`;
  }
}

export interface ComposeInput {
  readonly momentId: string;
  readonly tone: PostTone;
  readonly voice: PostVoice;
  /** Wall clock, supplied by the caller. The engine never reads one. */
  readonly at: number;
  readonly registry?: ContentRegistryPort | null;
}

export interface ComposeResult {
  readonly state: GameState;
  readonly ok: boolean;
  readonly reason?: string;
  readonly post?: SocialPost;
  readonly reactions: readonly SocialPost[];
  readonly effect?: SocialEffect;
  readonly events: readonly AnyDomainEvent[];
  readonly stake?: SocialStake;
}

/**
 * Publish.
 *
 * Ordering matters: the post is rendered first, and if no authored line can
 * carry this tone about this moment the action is refused outright rather than
 * applied with a placeholder. Nothing in the world moves for a post that was
 * never written.
 */
export function publishClubPost(state: GameState, input: ComposeInput): ComposeResult {
  const availability = composeAvailability(state);
  if (!availability.allowed) {
    return { state, ok: false, reason: availability.reason, reactions: [], events: [] };
  }
  const moment = momentById(state, input.momentId);
  if (!moment) {
    return {
      state, ok: false, reactions: [], events: [],
      reason: 'That moment has passed. You can only post about something that just happened.',
    };
  }

  const club = playerClubOf(state);
  const manager = state.managers[state.playerManagerId];
  if (!club) return { state, ok: false, reason: 'No club.', reactions: [], events: [] };

  const cycle = state.clock.cycle;
  const rng = new Rng(`${state.seed}:compose:${moment.eventId}:${input.tone}:${input.voice}:${availability.used}`);
  const ctx = postRenderContext(state, input.registry ?? null, cycle);

  const tokens = voiceTokens(state, moment);
  const hook = hookFromMoment(moment, { tokens, tags: [...moment.tags, 'authored'] });
  const author: PostAuthor = input.voice === 'MANAGER'
    ? {
      kind: 'CLUB',
      name: manager?.name ?? club.name,
      handle: `@${(manager?.name ?? club.shortName).toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 14)}`,
      avatarSeed: seedFrom('manager', manager?.id ?? club.id),
      verified: true,
      reach: voiceReach(state, 'MANAGER'),
    }
    : {
      kind: 'CLUB',
      name: club.name,
      handle: `@${club.abbreviation.toLowerCase()}official`,
      avatarSeed: seedFrom('club', club.abbreviation),
      verified: true,
      reach: voiceReach(state, 'CLUB'),
    };

  const facts = {
    tone: input.tone,
    voice: input.voice,
    authored: true,
    fit: Math.round(toneFit(moment, input.tone) * 100),
    forward: moment.forward,
  };

  const post = renderPost(ctx, rng.fork('post'), {
    id: `sp_own_${moment.eventId}_${input.tone}_${availability.used}`.toLowerCase(),
    author,
    hook,
    facts,
    sentiment: TONE_VALENCE[input.tone] * 0.7,
    reachMultiplier: availability.fatigue * A.tone[input.tone].reach,
    extraTags: ['authored', `tone:${input.tone.toLowerCase()}`, `voice:${input.voice.toLowerCase()}`],
    weightBonus: 8,
    fallbackTriggers: ['CLUB_STATEMENT'],
  });

  if (!post) {
    return {
      state, ok: false, reactions: [], events: [],
      reason: 'Nothing you could say in that tone about this would land. Try another register.',
    };
  }

  const effect = composeEffect(state, moment, input.tone, input.voice);
  const applied = applySocialEffect(state, effect, {
    anchorEventId: moment.eventId,
    suffix: `own${input.tone.toLowerCase()}${availability.used}`,
    reason: `${input.voice === 'MANAGER' ? 'The manager' : 'The club'} posted`,
    cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    clubId: state.playerClubId,
  });

  let next = appendPosts(applied.state, [post]);
  const reactions = worldReplies(next, ctx, rng.fork('replies'), moment, input.tone, post);
  next = appendPosts(next, reactions);

  const t = A.tone[input.tone];
  const action: PlayerAction = {
    id: `pa_${post.id}`,
    kind: 'POST',
    cycle,
    eventId: moment.eventId,
    tone: input.tone,
    voice: input.voice,
    volume: t.volume,
    warmth: t.warmth,
    credibility: t.credibility,
    summary: `${TONE_INFO[input.tone].label} post: ${moment.headline}`,
    postId: post.id,
  };

  const stake: SocialStake | undefined = moment.forward && t.stake >= A.stake.minimumWeight
    ? {
      id: `stk_${post.id}`,
      kind: input.tone === 'PROVOCATIVE' ? 'CALL_OUT' : input.tone === 'HYPE' ? 'GUARANTEE' : 'PRE_MATCH_TALK',
      eventId: moment.eventId,
      openedCycle: cycle,
      settleAfterCycle: cycle,
      tone: input.tone,
      stake: t.stake,
      claim: stakeClaim(state, moment, input.tone),
      ...(moment.fixtureId ? { fixtureId: moment.fixtureId } : {}),
      ...(opponentFor(state, moment) ? { opponentClubId: opponentFor(state, moment) as ClubId } : {}),
    }
    : undefined;

  next = withSocialWorld(next, (w) => ({
    actions: [...w.actions, action].slice(-240),
    ...(stake ? { stakes: [...w.stakes, stake] } : {}),
  }));

  return {
    state: next,
    ok: true,
    post,
    reactions,
    effect,
    events: applied.events,
    ...(stake ? { stake } : {}),
  };
}

/**
 * The world answering back.
 *
 * A post that lands in silence is not a post, it is a press release. Rival
 * fans, the press and your own supporters all get a line keyed to the tone you
 * chose, so the same event posted two different ways produces two visibly
 * different arguments underneath it.
 */
function worldReplies(
  state: GameState,
  ctx: PostRenderContext,
  rng: Rng,
  moment: SocialMoment,
  tone: PostTone,
  parent: SocialPost,
): SocialPost[] {
  const out: SocialPost[] = [];
  const t = A.tone[tone];
  // A quiet, classy line does not start an argument; a provocative one always does.
  const wanted = t.volume >= 0.9 ? 3 : t.volume >= 0.6 ? 2 : 1;
  const opponentId = opponentFor(state, moment);
  const tokens = voiceTokens(state, moment);
  const hook = hookFromMoment(moment, { tokens });
  const facts = { tone, replyTo: 'CLUB', authored: true };
  const standing = socialStanding(state);

  const candidates: { author: PostAuthor; sentiment: number; tag: string }[] = [];

  const rivalClub = opponentId ? state.clubs[opponentId] : undefined;
  if (rivalClub) {
    const persona = rng.fork('rivalname').pick(FAN_PERSONAS);
    candidates.push({
      author: {
        kind: 'RIVAL',
        name: persona,
        handle: `@${persona.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${rivalClub.abbreviation.toLowerCase()}`,
        avatarSeed: seedFrom('fan', persona, rivalClub.abbreviation),
        verified: false,
        reach: Math.round(clamp(rivalClub.fans.onlineFollowers * S.fanReachFromFollowers, S.fanReachFloor, S.fanReachCeiling) * 2.2),
      },
      sentiment: -0.75 * standing.hostilityMultiplier,
      tag: 'rival-reply',
    });
  }

  const ourFan = rng.fork('fanname').pick(FAN_PERSONAS.slice().reverse());
  const club = playerClubOf(state);
  if (club) {
    candidates.push({
      author: {
        kind: 'FAN',
        name: ourFan,
        handle: `@${ourFan.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${club.abbreviation.toLowerCase()}`,
        avatarSeed: seedFrom('fan', ourFan, club.abbreviation),
        verified: false,
        reach: Math.round(clamp(club.fans.onlineFollowers * S.fanReachFromFollowers, S.fanReachFloor, S.fanReachCeiling) * 1.6),
      },
      sentiment: t.warmth * 0.8 + 0.15,
      tag: 'fan-reply',
    });
  }

  const outlet = rng.fork('outlet').weighted(OUTLETS, (o) => o.reach / 1_000_000);
  candidates.push({
    author: {
      kind: 'MEDIA', name: outlet.name, handle: outlet.handle,
      avatarSeed: seedFrom('outlet', outlet.name), verified: true, reach: outlet.reach,
    },
    sentiment: t.mediaGoodwill >= 0 ? 0.2 : -0.35,
    tag: 'press-reply',
  });

  const creators = Object.values(state.creators)
    .filter((c) => c.style.postingFrequency > 0)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (creators.length > 0) {
    const creator = rng.fork('creator').weighted(creators, (c) => (c.clubId === state.playerClubId ? 3 : 1));
    candidates.push({
      author: {
        kind: 'CREATOR',
        name: creator.displayName,
        handle: creator.handle.startsWith('@') ? creator.handle : `@${creator.handle}`,
        avatarSeed: creator.avatarSeed,
        verified: creator.tier === 'MAJOR' || creator.tier === 'GLOBAL',
        reach: creatorReach(creator),
      },
      sentiment: (creator.clubSentiment / 100) * 0.6 + t.warmth * 0.2,
      tag: 'creator-reply',
    });
  }

  for (let i = 0; i < candidates.length && out.length < wanted; i++) {
    const candidate = candidates[i];
    if (!candidate) continue;
    const post = renderPost(ctx, rng.forkSequential('reply', i), {
      id: `sp_reply_${parent.id}_${i}`.toLowerCase(),
      author: candidate.author,
      hook,
      facts,
      sentiment: candidate.sentiment,
      trigger: 'CLUB_POSTED',
      fallbackTriggers: [moment.trigger],
      extraTags: ['reply-to-club', candidate.tag],
      quoted: { authorName: parent.authorName, text: parent.text },
    });
    if (post) out.push(post);
  }
  return out;
}

/** Convenience for the UI: the moment list plus what could be said about each. */
export interface ComposerView {
  readonly moments: readonly SocialMoment[];
  readonly availability: ComposeAvailability;
}

export const composerView = (state: GameState, moments: readonly SocialMoment[]): ComposerView => ({
  moments,
  availability: composeAvailability(state),
});

export type { EventId, PlayerId };
