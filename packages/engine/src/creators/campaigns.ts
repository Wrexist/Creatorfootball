import type { ClubId, CreatorId, EventId } from '../core/brand';
import type { AnyDomainEvent, EntityRef } from '../core/events';
import type { GameState, SocialPost } from '../game/state';
import type { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { Ledger, clubAccount, formatMoney, worldAccount } from '../economy/ledger';
import { patchClub, patchCreator, appendEvents } from '../game/mutations';
import { clubToken, personToken } from '../simulation/ports';
import { recentForm } from '../game/selectors';
import { CREATOR_BALANCE as CB } from './balance';
import { creatorReach, type Creator, type CreatorTier } from './creator';
import { BRAND_PARTNERS } from '../social/balance';
import {
  socialWorld, withSocialWorld,
  type CampaignFormat, type CreatorCampaign, type CreatorDeparture, type CreatorFeud,
} from '../social/worldState';
import { appendPosts, renderPost, type PostRenderContext } from '../social/postFactory';
import { applySocialEffect, type SocialEffect } from '../social/effects';
import { socialMoments, type SocialMoment } from '../social/moments';

/**
 * Creator operations.
 *
 * This is the part of the game that is actually about a creator-owned club
 * rather than about football with a feed bolted on. A creator is not a
 * multiplier: they are a person with an audience, an opinion of you, a rival
 * they cannot stand, and the ability to walk.
 *
 * The loop the research points at, in order and with a loss at every step:
 *
 *   a real event happens
 *     -> a creator wants to make something about it (never about nothing)
 *       -> the club pays for it, through the ledger
 *         -> it lands, or it flops, and the difference is stated in advance
 *           -> impressions become followers, slowly
 *             -> followers unlock sponsor tiers and better creators
 *               -> which produce reach, which is not the same as fandom
 *
 * And the counter-loop, which matters just as much: a club that never gives
 * its creators work loses them, and a creator who leaves takes their audience,
 * some of the roster's goodwill and a fortnight of hostile content with them.
 */

/* --- offers -------------------------------------------------------------- */

const formatFor = (f: CampaignFormat) => CB.formats[f];

/** Formats a given moment can plausibly produce. Never a generic brief. */
function formatsForMoment(moment: SocialMoment, creator: Creator): CampaignFormat[] {
  const out: CampaignFormat[] = [];
  const tags = new Set(moment.tags);
  if (tags.has('result') || tags.has('match')) out.push('MATCHDAY_VLOG', 'FAN_CAM');
  if (tags.has('transfer')) out.push('TRANSFER_REACTION');
  if (tags.has('rivalry') || moment.facts.derby === true) out.push('DERBY_BUILD_UP');
  if (tags.has('youth') || tags.has('development') || tags.has('breakout')) out.push('TRAINING_DAY');
  if (tags.has('facility')) out.push('STADIUM_TOUR');
  if (tags.has('trophy') || tags.has('record') || tags.has('history')) out.push('DOCUMENTARY');
  if (tags.has('fans')) out.push('FAN_CAM', 'CHARITY_STREAM');
  if (creator.style.tone === 'ANALYTICAL') out.push('TACTICS_BREAKDOWN');
  if (creator.style.tone === 'COMEDIC' || creator.style.tone === 'PROVOCATIVE') out.push('MIC_UP');
  if (creator.attributes.commercialAppeal >= 60) out.push('SPONSORED_DROP');
  if (creator.attributes.charisma >= 62) out.push('COLLAB');
  out.push('MATCHDAY_VLOG');
  return [...new Set(out)];
}

/**
 * Brief and title copy pools.
 *
 * One line per format meant every matchday vlog carried the same title for a
 * whole save, which reads as a template within three offers. Each format now
 * holds several variants; the pick happens once per offer at generation time
 * through the offer's own rng stream, so the save stays deterministic while
 * consecutive weeks stop reading like reprints. The first entry of every pool
 * is the original line — the voices that tested well stay in rotation.
 */
export const TITLES: Readonly<Record<CampaignFormat, readonly string[]>> = {
  MATCHDAY_VLOG: [
    'Matchday, all of it',
    'The whole day, uncut',
    'From breakfast to full time',
    'The matchday you did not see',
  ],
  FAN_CAM: [
    'The concourse',
    'Voices from the concourse',
    'What the away end actually said',
    'One camera, all of you',
  ],
  TACTICS_BREAKDOWN: [
    'How it actually happened',
    'Frame by frame',
    'The shape behind the result',
    'Pause it right there',
  ],
  TRAINING_DAY: [
    'Inside the week',
    'The week nobody films',
    'Boots, cones and opinions',
    'Where the work actually happens',
  ],
  MIC_UP: ['Wired up', 'Mic up and pray', 'Everything he said, unedited', 'Ninety minutes of sound'],
  COLLAB: ['Two audiences, one take', 'Invite the rival fan', 'Two creators, one argument', 'The crossover episode'],
  SPONSORED_DROP: ['Presented by somebody', 'The paid-for drop', 'Money in, content out', 'The ad read, kept tasteful'],
  DOCUMENTARY: ['The long version', 'Four weeks in forty minutes', 'The club, examined', 'Bigger than a highlight'],
  TRANSFER_REACTION: ['First reaction', 'Filmed before the calm', 'Straight after the news', 'Hot take, cold studio'],
  STADIUM_TOUR: ['A walk round the ground', 'The seats nobody wants', 'Behind the turnstiles', 'Slow laps of home'],
  CHARITY_STREAM: ['The long stream', 'Twelve hours for a cause', 'Playing for something real', 'Targets on screen'],
  DERBY_BUILD_UP: ['Derby week', 'Six days to kick-off', 'The city picks a side', 'Counting down to the derby'],
};

export const BRIEFS: Readonly<
  Record<CampaignFormat, readonly ((m: SocialMoment, c: Creator) => string)[]>
> = {
  MATCHDAY_VLOG: [
    (m) => `A full day with the club around it. "${m.headline}" is the spine of the edit.`,
    (m) => `Wake-up to final whistle in one continuous edit. "${m.headline}" lands somewhere near the middle, where it belongs.`,
    (m) => `Travel, team sheet, touchline. The day is the story and "${m.headline}" is just where it peaks.`,
    (m) => `No script and no second takes — just the club on a matchday with "${m.headline}" hanging over everything.`,
  ],
  FAN_CAM: [
    (m) => `Cameras in the concourse and nothing else. Whatever the supporters say about "${m.headline}" is the video.`,
    (m) => `Handheld, unhyped. One hour of supporters working out what "${m.headline}" means to them.`,
    (m) => `Point the lens at the stands and let them argue about "${m.headline}". Nobody gets a script.`,
  ],
  TACTICS_BREAKDOWN: [
    (m) => `Twenty minutes of pause-and-rewind explaining exactly how "${m.headline}" happened.`,
    (m) => `A whiteboard, a cursor and no mercy. "${m.headline}" gets taken apart phase by phase.`,
    (m) => `The whole move rebuilt from nothing until "${m.headline}" finally makes sense on the third watch.`,
  ],
  TRAINING_DAY: [
    () => 'A week inside the training ground. No press officer, no second takes.',
    () => 'Seven days with the squad while they prepare. What gets said at the cones stays at the cones — mostly.',
    () => 'Drills, diet and dressing-room chatter, exactly as the week went.',
  ],
  MIC_UP: [
    () => 'One player wired for sound for ninety minutes. Nobody knows what comes back.',
    () => 'A microphone on the loudest player in the squad. Legal will review it. Eventually.',
    () => 'Wire him up, roll tape, apologise later.',
  ],
  COLLAB: [
    (m, c) => `${c.displayName} brings another creator in. Two audiences, one argument about "${m.headline}".`,
    (m, c) => `${c.displayName} and a rival channel in the same room, both reacting to "${m.headline}" live.`,
    (m, c) => `A crossover episode: ${c.displayName} hands the camera to somebody who disagrees about "${m.headline}".`,
  ],
  SPONSORED_DROP: [
    (m) => `A brand wants their name on the reaction to "${m.headline}". They are paying for the privilege.`,
    (m) => `"${m.headline}" with a sponsor's name on the intro. The deal pays for the edit, not the opinion.`,
    (m) => `The money is real and the brief is loose: make "${m.headline}" sellable without making it hollow.`,
  ],
  DOCUMENTARY: [
    (m) => `A long-form piece built around "${m.headline}". Four weeks of work and it changes how the sport talks about this club — or it does not.`,
    (m) => `Archive, interviews and access. "${m.headline}" is the hook; the club is the subject.`,
    (m) => `The kind of film that gets entered into festivals or quietly buried. It starts with "${m.headline}".`,
  ],
  TRANSFER_REACTION: [
    (m) => `A same-day reaction to "${m.headline}", filmed before anybody has calmed down.`,
    (m, c) => `News breaks, camera rolls. "${m.headline}" gets the fastest turnaround ${c.displayName} has ever attempted.`,
    (m) => `Signings, leaks and denials, all filtered through "${m.headline}" within hours of the story landing.`,
  ],
  STADIUM_TOUR: [
    () => 'A walk round the ground with somebody who has been coming since before the roof.',
    () => 'Every stand, every story, one tour guide who refuses to hurry.',
    () => 'The parts of the ground nobody photographs, shown slowly.',
  ],
  CHARITY_STREAM: [
    () => 'A long stream for a cause the supporters chose themselves.',
    () => 'Hours on air, targets on screen, and every penny going where the fans voted.',
    () => 'The squad turns up, the chat keeps count, the cause gets the money.',
  ],
  DERBY_BUILD_UP: [
    (m) => `Build-up for the derby, framed entirely around "${m.headline}". It will be replayed at you either way.`,
    (m) => `Six days of countdown content, and "${m.headline}" is the spark everyone keeps returning to.`,
    (m, c) => `The city splits in half by Sunday. ${c.displayName} spends the week filming both sides of it.`,
  ],
};

/**
 * New briefs from the creators who are willing to work with you.
 *
 * Every brief is attached to a moment, so the offer list is a reading of what
 * has actually been happening at the club. A quiet fortnight produces a quiet
 * offer list, which is correct.
 */
export function generateCampaignOffers(
  state: GameState,
  rng: Rng,
  cycle: number,
): CreatorCampaign[] {
  const world = socialWorld(state);
  const club = state.clubs[state.playerClubId];
  if (!club) return [];

  const live = world.creatorCampaigns.filter(
    (c) => c.status === 'OFFERED' && c.expiresCycle > cycle,
  );
  if (live.length >= CB.campaign.maxOffers) return [];

  const chance = clamp(
    CB.campaign.offerChance + (club.reputation - 50) * CB.campaign.offerChancePerReputation,
    0.05, 0.95,
  );
  if (!rng.fork('offer:chance').chance(chance)) return [];

  const moments = socialMoments(state, { windowCycles: 2, limit: 10 })
    .filter((m) => !m.forward);
  if (moments.length === 0) return [];

  const pool = Object.values(state.creators)
    .filter((c) => c.clubSentiment > -50 && c.style.postingFrequency > 0)
    .sort((a, b) => (a.id < b.id ? -1 : 1));
  if (pool.length === 0) return [];

  const wanted = Math.min(CB.campaign.maxOffers - live.length, rng.fork('offer:count').int(1, 2));
  const out: CreatorCampaign[] = [];
  const usedCreators = new Set(live.map((c) => c.creatorId));

  for (let i = 0; i < wanted; i++) {
    const local = rng.forkSequential('offer', i);
    const candidates = pool.filter((c) => !usedCreators.has(c.id));
    if (candidates.length === 0) break;
    const creator = local.weighted(candidates, (c) => {
      const attached = c.clubId === state.playerClubId ? 4 : 1;
      const warmth = 1 + Math.max(0, c.clubSentiment) / 100;
      return attached * warmth * (0.5 + c.style.postingFrequency);
    });
    usedCreators.add(creator.id);

    const moment = local.fork('moment').weighted(moments, (m) => m.importance ** 2);
    const format = local.fork('format').pick(formatsForMoment(moment, creator));
    const def = formatFor(format);

    const reachShare = local.fork('reach').float(CB.campaign.reachShare[0], CB.campaign.reachShare[1]);
    const projectedReach = Math.round(creatorReach(creator) * reachShare * def.reach * (0.7 + moment.importance * 0.12));
    const cost = Math.round(clamp(
      projectedReach * CB.campaign.costPerReach * def.cost,
      CB.campaign.costRange[0], CB.campaign.costRange[1],
    ));
    const brand = format === 'SPONSORED_DROP'
      ? local.fork('brand').pick(BRAND_PARTNERS)
      : null;

    out.push({
      id: `cc_${creator.id}_${moment.eventId}_${format}`.toLowerCase(),
      creatorId: creator.id,
      format,
      // Title and brief variant come from the offer's own stream: deterministic
      // for a given seed, varied across the weeks of a save.
      title: local.fork('title').pick(TITLES[format]),
      brief: local.fork('brief').pick(BRIEFS[format])(moment, creator),
      eventId: moment.eventId,
      cost: brand ? Math.round(cost * 0.4) : cost,
      sponsorFee: brand ? Math.round(brand.fee * (0.6 + creator.attributes.commercialAppeal / 140)) : 0,
      ...(brand ? { sponsorName: brand.name } : {}),
      offeredCycle: cycle,
      expiresCycle: cycle + CB.campaign.offerWindow,
      totalCycles: def.cycles,
      cyclesRemaining: def.cycles,
      projectedReach,
      risk: clamp(def.risk + (creator.attributes.controversy - 50) / 300, 0.04, 0.6),
      status: 'OFFERED',
    });
  }
  return out;
}

/** Briefs currently on the table. */
export const campaignOffers = (state: GameState): CreatorCampaign[] =>
  socialWorld(state).creatorCampaigns.filter(
    (c) => c.status === 'OFFERED' && c.expiresCycle > state.clock.cycle,
  );

export const runningCampaigns = (state: GameState): CreatorCampaign[] =>
  socialWorld(state).creatorCampaigns.filter((c) => c.status === 'RUNNING');

export const deliveredCampaigns = (state: GameState): CreatorCampaign[] =>
  socialWorld(state).creatorCampaigns
    .filter((c) => c.status === 'DELIVERED' || c.status === 'FLOPPED')
    .sort((a, b) => (b.deliveredCycle ?? 0) - (a.deliveredCycle ?? 0));

export interface CampaignActionResult {
  readonly state: GameState;
  readonly ok: boolean;
  readonly reason?: string;
  readonly campaign?: CreatorCampaign;
}

/**
 * Commission a drop.
 *
 * The money moves through the ledger with an idempotency key derived from the
 * campaign id, so a double-tap on the button cannot pay for the same video
 * twice — the second post is rejected as a duplicate rather than silently
 * doubling the bill.
 */
export function greenlightCampaign(
  state: GameState,
  input: { campaignId: string; at: number },
): CampaignActionResult {
  const world = socialWorld(state);
  const campaign = world.creatorCampaigns.find((c) => c.id === input.campaignId);
  if (!campaign || campaign.status !== 'OFFERED') {
    return { state, ok: false, reason: 'That brief is no longer on the table.' };
  }
  if (runningCampaigns(state).length >= CB.campaign.maxRunning) {
    return { state, ok: false, reason: 'You already have as much in production as this club can carry.' };
  }

  const ledger = Ledger.restore(state.ledger);
  if (campaign.cost > 0 && !ledger.canAfford(state.playerClubId, campaign.cost)) {
    return {
      state, ok: false,
      reason: `You cannot cover ${formatMoney(campaign.cost)} for this right now.`,
    };
  }

  if (campaign.cost > 0) {
    const posted = ledger.post({
      kind: 'ADJUSTMENT',
      amount: campaign.cost,
      from: clubAccount(state.playerClubId),
      to: worldAccount('content-production'),
      memo: `Content production: ${campaign.title}`,
      metadata: { campaignId: campaign.id, format: campaign.format },
      idempotencyKey: `campaign:${campaign.id}`,
    }, { cycle: state.clock.cycle, season: state.clock.season, at: input.at });
    if (!posted.ok) {
      return {
        state, ok: false,
        reason: posted.error.code === 'DUPLICATE'
          ? 'That has already been commissioned.'
          : 'The money is not there for this.',
      };
    }
  }

  const updated: CreatorCampaign = { ...campaign, status: 'RUNNING' };
  let next = withSocialWorld({ ...state, ledger: ledger.snapshot() }, (w) => ({
    creatorCampaigns: w.creatorCampaigns.map((c) => (c.id === campaign.id ? updated : c)),
    actions: [...w.actions, {
      id: `pa_green_${campaign.id}`,
      kind: 'CAMPAIGN_GREENLIT' as const,
      cycle: state.clock.cycle,
      eventId: campaign.eventId,
      volume: 0.35,
      warmth: 0.5,
      credibility: 0.2,
      summary: `Commissioned ${campaign.title}`,
    }].slice(-240),
  }));

  // Being given work is the single thing every creator in this game wants.
  const creator = next.creators[campaign.creatorId];
  if (creator) {
    next = patchCreator(next, creator.id, {
      clubSentiment: clamp(creator.clubSentiment + CB.sentiment.perDelivery, -100, 100),
    });
  }
  return { state: next, ok: true, campaign: updated };
}

/** Pass on a brief. Cheap, and remembered. */
export function declineCampaign(
  state: GameState,
  input: { campaignId: string },
): CampaignActionResult {
  const world = socialWorld(state);
  const campaign = world.creatorCampaigns.find((c) => c.id === input.campaignId);
  if (!campaign || campaign.status !== 'OFFERED') {
    return { state, ok: false, reason: 'That brief is no longer on the table.' };
  }
  const updated: CreatorCampaign = { ...campaign, status: 'DECLINED' };
  let next = withSocialWorld(state, (w) => ({
    creatorCampaigns: w.creatorCampaigns.map((c) => (c.id === campaign.id ? updated : c)),
    actions: [...w.actions, {
      id: `pa_decline_${campaign.id}`,
      kind: 'CAMPAIGN_DECLINED' as const,
      cycle: state.clock.cycle,
      eventId: campaign.eventId,
      volume: 0.15,
      warmth: -0.3,
      credibility: 0.1,
      summary: `Passed on ${campaign.title}`,
    }].slice(-240),
  }));
  const creator = next.creators[campaign.creatorId];
  if (creator) {
    next = patchCreator(next, creator.id, {
      clubSentiment: clamp(creator.clubSentiment + CB.campaign.creatorSentimentOnDecline, -100, 100),
    });
  }
  return { state: next, ok: true, campaign: updated };
}

/* --- delivery ------------------------------------------------------------ */

export interface CreatorTickResult {
  readonly state: GameState;
  readonly posts: readonly SocialPost[];
  readonly events: readonly AnyDomainEvent[];
  readonly notes: readonly string[];
}

/**
 * Move every production on by a cycle, and settle the ones that are finished.
 *
 * Delivery is where reach becomes followers, and the conversion is deliberately
 * brutal: a drop that reaches a million people converts a couple of thousand,
 * and only if the creator is any good at converting. That is the whole lesson
 * of the clubs this game is modelled on.
 */
export function advanceCampaigns(
  state: GameState,
  rng: Rng,
  ctx: PostRenderContext,
  at: number,
): CreatorTickResult {
  const world = socialWorld(state);
  const cycle = state.clock.cycle;
  const posts: SocialPost[] = [];
  const events: AnyDomainEvent[] = [];
  const notes: string[] = [];
  let next = state;
  const updates: CreatorCampaign[] = [];
  const ledger = Ledger.restore(state.ledger);
  let ledgerTouched = false;

  for (const campaign of world.creatorCampaigns) {
    if (campaign.status === 'OFFERED' && campaign.expiresCycle <= cycle) {
      updates.push({ ...campaign, status: 'EXPIRED' });
      continue;
    }
    if (campaign.status !== 'RUNNING') { updates.push(campaign); continue; }

    const remaining = campaign.cyclesRemaining - 1;
    if (remaining > 0) {
      updates.push({ ...campaign, cyclesRemaining: remaining });
      continue;
    }

    const local = rng.forkSequential('deliver', updates.length);
    const creator = next.creators[campaign.creatorId];
    const band = local.fork('band').float(CB.campaign.deliveryBand[0], CB.campaign.deliveryBand[1]);
    const badLuck = local.fork('risk').chance(campaign.risk);
    const performance = badLuck ? band * 0.55 : band;
    const deliveredReach = Math.max(0, Math.round(campaign.projectedReach * performance));
    const flopped = performance < CB.campaign.flopThreshold;

    const conversion = CB.campaign.followerConversion
      * (1 + ((creator?.attributes.fanConversion ?? 50) - 50) * CB.campaign.conversionPerAttribute);
    const followerGain = flopped
      ? Math.round(deliveredReach * conversion * 0.25)
      : Math.round(deliveredReach * conversion);

    const def = formatFor(campaign.format);
    const settled: CreatorCampaign = {
      ...campaign,
      status: flopped ? 'FLOPPED' : 'DELIVERED',
      cyclesRemaining: 0,
      deliveredReach,
      deliveredCycle: cycle,
      followerGain,
    };
    updates.push(settled);

    const effect: SocialEffect = {
      followers: followerGain,
      fanSentiment: flopped ? CB.campaign.fanSentimentOnFlop : CB.campaign.fanSentimentOnDelivery,
      fanExcitement: flopped ? -1 : CB.campaign.fanExcitementOnDelivery,
      reputation: flopped ? -def.reputation * 0.5 : def.reputation,
    };
    const applied = applySocialEffect(next, effect, {
      anchorEventId: campaign.eventId,
      suffix: `drop${campaign.format.toLowerCase()}`,
      reason: flopped ? `${campaign.title} landed badly` : `${campaign.title} landed`,
      cycle,
      season: state.clock.season,
      week: state.clock.week,
      at,
      clubId: state.playerClubId,
    });
    next = applied.state;
    events.push(...applied.events);

    // A brand pays on delivery, and pays a fraction of it on a flop.
    if (campaign.sponsorFee > 0) {
      const paid = flopped
        ? Math.round(campaign.sponsorFee * CB.campaign.sponsorFeeOnFlopShare)
        : campaign.sponsorFee;
      if (paid > 0) {
        const posted = ledger.post({
          kind: 'SPONSOR_REVENUE',
          amount: paid,
          from: worldAccount('brand-partner'),
          to: clubAccount(state.playerClubId),
          memo: `${campaign.sponsorName ?? 'Brand partner'} — ${campaign.title}`,
          metadata: { campaignId: campaign.id, flopped },
          idempotencyKey: `campaign-fee:${campaign.id}`,
        }, { cycle, season: state.clock.season, at });
        if (posted.ok) ledgerTouched = true;
      }
    }

    if (creator) {
      const sentimentDelta = flopped
        ? CB.campaign.creatorSentimentOnFlop
        : CB.campaign.creatorSentimentOnHit;
      const audienceDelta = flopped ? CB.audience.flopLoss : CB.audience.deliveryGrowth;
      next = patchCreator(next, creator.id, {
        clubSentiment: clamp(creator.clubSentiment + sentimentDelta, -100, 100),
        followers: Math.max(1_000, Math.round(creator.followers * (1 + audienceDelta))),
      });
      next = retier(next, creator.id);

      const emitted = creatorMomentEvent(next, campaign, deliveredReach, at);
      if (emitted) { events.push(emitted); next = appendEvents(next, [emitted]); }

      const post = renderCampaignPost(next, ctx, local.fork('post'), campaign, settled, flopped);
      if (post) { posts.push(post); next = appendPosts(next, [post]); }
    }

    notes.push(
      flopped
        ? `${campaign.title} did not land. ${followerGain.toLocaleString('en-GB')} followers from ${deliveredReach.toLocaleString('en-GB')} impressions.`
        : `${campaign.title} reached ${deliveredReach.toLocaleString('en-GB')} and brought ${followerGain.toLocaleString('en-GB')} followers.`,
    );
  }

  next = withSocialWorld(next, { creatorCampaigns: updates.slice(-60) });
  if (ledgerTouched) next = { ...next, ledger: ledger.snapshot() };
  return { state: next, posts, events, notes };
}

/** A delivered drop is a real `CREATOR_MOMENT`, so the world can react to it. */
function creatorMomentEvent(
  state: GameState,
  campaign: CreatorCampaign,
  reach: number,
  at: number,
): AnyDomainEvent | null {
  const creator = state.creators[campaign.creatorId];
  if (!creator) return null;
  const club = state.clubs[state.playerClubId];
  const entities: EntityRef[] = [
    { kind: 'creator', id: creator.id, name: creator.displayName },
    ...(club ? [{ kind: 'club' as const, id: club.id, name: club.name }] : []),
  ];
  return {
    id: `${campaign.eventId}~drop${campaign.format.toLowerCase()}` as EventId,
    type: 'CREATOR_MOMENT',
    payload: {
      creatorId: creator.id,
      clubId: state.playerClubId,
      kind: campaign.format.toLowerCase().replace(/_/g, ' '),
      reach,
    },
    cycle: state.clock.cycle,
    season: state.clock.season,
    week: state.clock.week,
    at,
    importance: reach > 1_000_000 ? 4 : 3,
    entities,
  } as unknown as AnyDomainEvent;
}

function renderCampaignPost(
  state: GameState,
  ctx: PostRenderContext,
  rng: Rng,
  campaign: CreatorCampaign,
  settled: CreatorCampaign,
  flopped: boolean,
): SocialPost | null {
  const creator = state.creators[campaign.creatorId];
  const club = state.clubs[state.playerClubId];
  if (!creator || !club) return null;
  return renderPost(ctx, rng, {
    id: `sp_drop_${campaign.id}`.toLowerCase(),
    author: {
      kind: 'CREATOR',
      name: creator.displayName,
      handle: creator.handle.startsWith('@') ? creator.handle : `@${creator.handle}`,
      avatarSeed: creator.avatarSeed,
      verified: creator.tier === 'MAJOR' || creator.tier === 'GLOBAL',
      reach: Math.max(1_000, settled.deliveredReach ?? campaign.projectedReach),
    },
    hook: {
      trigger: 'CONTENT_DROP',
      sourceEventId: campaign.eventId,
      rootEventId: campaign.eventId,
      depth: 0,
      importance: flopped ? 2 : 3,
      sentiment: flopped ? -0.3 : 0.6,
      tokens: {
        creator: personToken(creator.displayName),
        club: clubToken(club.name),
        title: campaign.title,
        reach: compact(settled.deliveredReach ?? 0),
        ...(campaign.sponsorName ? { sponsor: campaign.sponsorName } : {}),
      },
      facts: {
        format: campaign.format,
        flopped,
        sponsored: campaign.sponsorFee > 0,
        tone: creator.style.tone,
        tier: creator.tier,
      },
      entities: [
        { kind: 'creator', id: creator.id, name: creator.displayName },
        { kind: 'club', id: club.id, name: club.name },
      ],
      clubId: club.id,
      audiences: ['CREATOR'],
      tags: ['creator', 'content-drop'],
      cycle: state.clock.cycle,
    },
    facts: { format: campaign.format, flopped, sponsored: campaign.sponsorFee > 0 },
    sentiment: flopped ? -0.35 : 0.65,
    trigger: 'CONTENT_DROP',
    fallbackTriggers: ['CREATOR_MOMENT'],
    extraTags: ['creator-voice', 'content-drop'],
    weightBonus: flopped ? 0 : 6,
  });
}

const compact = (n: number): string => (
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)}M`
    : n >= 1_000 ? `${Math.round(n / 1_000)}K`
      : String(Math.round(n))
);

/* --- the roster ---------------------------------------------------------- */

export interface CreatorInterest {
  readonly creator: Creator;
  readonly available: boolean;
  readonly reason: string;
  readonly signingFee: number;
  readonly retainerPerCycle: number;
  readonly requiredFollowers: number;
}

/**
 * Who would work with this club, and who would not take the call.
 *
 * Tier gating is the mechanism that makes a follower milestone matter: a global
 * creator does not care how nice you are until enough people are watching.
 */
export function creatorInterest(state: GameState): CreatorInterest[] {
  const club = state.clubs[state.playerClubId];
  const followers = club?.fans.onlineFollowers ?? state.social.clubFollowers;
  return Object.values(state.creators)
    .filter((c) => c.clubId !== state.playerClubId)
    .sort((a, b) => b.followers - a.followers || (a.id < b.id ? -1 : 1))
    .map((creator) => {
      const required = CB.roster.requiredFollowers[creator.tier];
      const fee = Math.round(creator.marketValue * CB.roster.signingMultiple);
      const tooSmall = followers < required;
      const hostile = creator.clubSentiment <= CB.roster.unhappyAt;
      const contracted = creator.clubId !== null;
      return {
        creator,
        available: !tooSmall && !hostile,
        reason: tooSmall
          ? `Needs a club with at least ${required.toLocaleString('en-GB')} followers. You have ${followers.toLocaleString('en-GB')}.`
          : hostile
            ? 'Has said in public what they think of this club. That is not a phone call you win today.'
            : contracted
              ? 'Already attached elsewhere, but would listen to the right approach.'
              : 'Unattached, and interested.',
        signingFee: fee,
        retainerPerCycle: Math.round(fee * CB.roster.retainerShare),
        requiredFollowers: required,
      };
    });
}

export interface RosterResult {
  readonly state: GameState;
  readonly ok: boolean;
  readonly reason?: string;
  readonly events: readonly AnyDomainEvent[];
}

/** Bring a creator onto the books. Fee and retainer both move through the ledger. */
export function signCreator(
  state: GameState,
  input: { creatorId: CreatorId; at: number },
): RosterResult {
  const interest = creatorInterest(state).find((i) => i.creator.id === input.creatorId);
  if (!interest) return { state, ok: false, reason: 'Not available.', events: [] };
  if (!interest.available) return { state, ok: false, reason: interest.reason, events: [] };

  const ledger = Ledger.restore(state.ledger);
  if (interest.signingFee > 0) {
    const posted = ledger.post({
      kind: 'SIGNING_BONUS',
      amount: interest.signingFee,
      from: clubAccount(state.playerClubId),
      to: worldAccount('creator-signing'),
      memo: `Creator signing: ${interest.creator.displayName}`,
      metadata: { creatorId: interest.creator.id },
      idempotencyKey: `creator-sign:${interest.creator.id}:${state.clock.cycle}`,
    }, { cycle: state.clock.cycle, season: state.clock.season, at: input.at });
    if (!posted.ok) {
      return {
        state, ok: false, events: [],
        reason: posted.error.code === 'INSUFFICIENT_FUNDS'
          ? `You cannot cover ${formatMoney(interest.signingFee)} today.`
          : 'That signing has already gone through.',
      };
    }
  }

  const club = state.clubs[state.playerClubId];
  let next: GameState = { ...state, ledger: ledger.snapshot() };
  next = patchCreator(next, interest.creator.id, {
    clubId: state.playerClubId,
    clubSentiment: Math.max(interest.creator.clubSentiment, CB.roster.joiningSentiment),
    dealWeeksRemaining: CB.roster.dealCycles,
  });
  if (club && !club.creatorIds.includes(interest.creator.id)) {
    next = patchClub(next, club.id, (c) => ({ creatorIds: [...c.creatorIds, interest.creator.id] }));
  }

  const anchor = latestClubEvent(state) ?? (`ev_creator_${interest.creator.id}` as EventId);
  const event = {
    id: `${anchor}~creatorjoin${interest.creator.id}` as EventId,
    type: 'CREATOR_JOINED',
    payload: { creatorId: interest.creator.id, clubId: state.playerClubId, role: 'CLUB_PERSONALITY' },
    cycle: state.clock.cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    importance: interest.creator.tier === 'MAJOR' || interest.creator.tier === 'GLOBAL' ? 4 : 3,
    entities: [
      { kind: 'creator', id: interest.creator.id, name: interest.creator.displayName },
      ...(club ? [{ kind: 'club' as const, id: club.id, name: club.name }] : []),
    ],
  } as unknown as AnyDomainEvent;

  next = appendEvents(next, [event]);
  return { state: next, ok: true, events: [event] };
}

/** Let a creator go. Nobody in the ecosystem misses this. */
export function releaseCreator(
  state: GameState,
  input: { creatorId: CreatorId; at: number },
): RosterResult {
  const creator = state.creators[input.creatorId];
  if (!creator || creator.clubId !== state.playerClubId) {
    return { state, ok: false, reason: 'Not one of yours.', events: [] };
  }
  let next = patchCreator(state, creator.id, {
    clubId: null,
    dealWeeksRemaining: null,
    clubSentiment: clamp(creator.clubSentiment + CB.sentiment.onDropped, -100, 100),
  });
  next = patchClub(next, state.playerClubId, (c) => ({
    creatorIds: c.creatorIds.filter((id) => id !== creator.id),
  }));
  // Everybody else on the roster hears about it.
  for (const other of Object.values(next.creators)) {
    if (other.id === creator.id || other.clubId !== state.playerClubId) continue;
    next = patchCreator(next, other.id, {
      clubSentiment: clamp(other.clubSentiment + CB.roster.departureContagion, -100, 100),
    });
  }
  next = withSocialWorld(next, (w) => ({
    departures: [...w.departures, {
      creatorId: creator.id,
      cycle: state.clock.cycle,
      reason: 'Released by the club.',
      eventId: latestClubEvent(state) ?? (`ev_creator_${creator.id}` as EventId),
    }].slice(-20),
    actions: [...w.actions, {
      id: `pa_drop_${creator.id}_${state.clock.cycle}`,
      kind: 'CREATOR_DROPPED' as const,
      cycle: state.clock.cycle,
      eventId: latestClubEvent(state) ?? (`ev_creator_${creator.id}` as EventId),
      volume: 0.6,
      warmth: -0.7,
      credibility: 0.2,
      summary: `Released ${creator.displayName}`,
    }].slice(-240),
  }));
  return { state: next, ok: true, events: [] };
}

const latestClubEvent = (state: GameState): EventId | null => {
  const clubId: ClubId = state.playerClubId;
  for (let i = state.eventLog.length - 1; i >= 0; i--) {
    const event = state.eventLog[i];
    if (!event) continue;
    if (event.entities.some((e) => e.kind === 'club' && e.id === clubId)) return event.id;
  }
  return state.eventLog[state.eventLog.length - 1]?.id ?? null;
};

/** Re-derive a creator's tier from their actual following. */
function retier(state: GameState, creatorId: CreatorId): GameState {
  const creator = state.creators[creatorId];
  if (!creator) return state;
  const floors = CB.audience.tierFloors;
  const order: CreatorTier[] = ['GLOBAL', 'MAJOR', 'ESTABLISHED', 'RISING', 'LOCAL'];
  const tier = order.find((t) => creator.followers >= floors[t]) ?? 'LOCAL';
  if (tier === creator.tier) return state;
  return patchCreator(state, creatorId, { tier });
}

/* --- sentiment, audiences and departures --------------------------------- */

/**
 * How every creator in the world feels about your club this week.
 *
 * Three inputs, all of them things the player did or failed to do: results,
 * whether they have been given work, and how long it has been since anybody
 * spoke to them. Neglect is modelled explicitly because it is the failure mode
 * a creator-club actually has.
 */
export function advanceCreatorRelations(
  state: GameState,
  rng: Rng,
  at: number,
): CreatorTickResult {
  const world = socialWorld(state);
  const cycle = state.clock.cycle;
  const club = state.clubs[state.playerClubId];
  if (!club) return { state, posts: [], events: [], notes: [] };

  const form = recentForm(state, club.id, 4);
  const wins = form.filter((r) => r === 'W').length;
  const losses = form.filter((r) => r === 'L').length;
  const formPull = wins * CB.sentiment.perWin + losses * CB.sentiment.perLoss;

  const lastWorkedCycle = new Map<string, number>();
  for (const campaign of world.creatorCampaigns) {
    if (campaign.status !== 'DELIVERED' && campaign.status !== 'RUNNING') continue;
    const at2 = campaign.deliveredCycle ?? campaign.offeredCycle;
    const held = lastWorkedCycle.get(campaign.creatorId) ?? -999;
    if (at2 > held) lastWorkedCycle.set(campaign.creatorId, at2);
  }

  let next = state;
  const notes: string[] = [];
  const departures: CreatorDeparture[] = [];

  for (const creator of Object.values(state.creators).sort((a, b) => (a.id < b.id ? -1 : 1))) {
    const ours = creator.clubId === club.id;
    let sentiment = creator.clubSentiment;

    if (ours) {
      sentiment += formPull;
      const since = cycle - (lastWorkedCycle.get(creator.id) ?? -CB.sentiment.neglectAfter);
      if (since > CB.sentiment.neglectAfter) sentiment += CB.sentiment.perNeglectCycle;
      // Loyalty resists the drift both ways.
      const loyalty = (creator.attributes.loyalty - 50) / 100;
      sentiment = creator.clubSentiment + (sentiment - creator.clubSentiment) * (1 - loyalty * 0.5);
    } else {
      // Unattached creators drift toward the club's actual standing in the world.
      const target = (club.reputation - 50) * 0.8;
      sentiment += (target - sentiment) * CB.sentiment.formPull * 0.4;
    }

    // Audiences move whether or not the club is involved.
    const local = rng.forkSequential('audience', Object.keys(state.creators).indexOf(creator.id));
    let growth: number = CB.audience.idleDecay;
    if (ours) growth += wins * CB.audience.clubFormShare;
    if (world.feuds.some((f) => f.status === 'LIVE' && (f.aId === creator.id || f.bId === creator.id))) {
      growth += CB.audience.feudGrowth;
    }
    growth += local.float(-0.006, 0.008);
    growth = clamp(growth, -CB.audience.maxSwing, CB.audience.maxSwing);

    next = patchCreator(next, creator.id, {
      clubSentiment: clamp(sentiment, -100, 100),
      followers: Math.max(500, Math.round(creator.followers * (1 + growth))),
      ...(ours && creator.dealWeeksRemaining !== null
        ? { dealWeeksRemaining: Math.max(0, creator.dealWeeksRemaining - 1) }
        : {}),
    });
    next = retier(next, creator.id);

    // A creator who has been unhappy for long enough actually leaves.
    if (ours && sentiment <= CB.roster.unhappyAt) {
      const patience = countUnhappyCycles(world, creator.id, cycle);
      if (patience >= CB.roster.patienceCycles) {
        const anchor = latestClubEvent(state) ?? (`ev_creator_${creator.id}` as EventId);
        next = patchCreator(next, creator.id, { clubId: null, dealWeeksRemaining: null });
        next = patchClub(next, club.id, (c) => ({
          creatorIds: c.creatorIds.filter((id) => id !== creator.id),
        }));
        departures.push({
          creatorId: creator.id,
          cycle,
          reason: 'Walked away. Nothing was made, nothing was said, and they had had enough.',
          eventId: anchor,
        });
        notes.push(`${creator.displayName} has left the club.`);
      }
    }
  }

  if (departures.length > 0) {
    next = withSocialWorld(next, (w) => ({
      departures: [...w.departures, ...departures].slice(-20),
    }));
    // Everybody left behind takes it personally.
    for (const other of Object.values(next.creators)) {
      if (other.clubId !== club.id) continue;
      next = patchCreator(next, other.id, {
        clubSentiment: clamp(other.clubSentiment + CB.roster.departureContagion, -100, 100),
      });
    }
    const effect: SocialEffect = { fanSentiment: -1.6 * departures.length, fanExcitement: -2 * departures.length };
    const applied = applySocialEffect(next, effect, {
      anchorEventId: departures[0]?.eventId ?? (`ev_departure_${cycle}` as EventId),
      suffix: `creatorexit${cycle}`,
      reason: 'A creator left the club',
      cycle,
      season: state.clock.season,
      week: state.clock.week,
      at,
      clubId: club.id,
    });
    next = applied.state;
  }

  return { state: next, posts: [], events: [], notes };
}

/**
 * How long a creator has been below the walking-out line.
 *
 * Read from the campaign record rather than stored: a creator with no work and
 * a hostile opinion has been unhappy for as long as both have been true, and
 * both are already on the state.
 */
function countUnhappyCycles(
  world: ReturnType<typeof socialWorld>,
  creatorId: CreatorId,
  cycle: number,
): number {
  const lastWork = world.creatorCampaigns
    .filter((c) => c.creatorId === creatorId && (c.status === 'DELIVERED' || c.status === 'RUNNING'))
    .reduce((best, c) => Math.max(best, c.deliveredCycle ?? c.offeredCycle), -999);
  return lastWork < -900 ? CB.roster.patienceCycles : cycle - lastWork;
}

/* --- feuds --------------------------------------------------------------- */

/**
 * Two creators falling out.
 *
 * Feuds are not scripted. They start when two creators have landed on opposite
 * sides of the same real event and at least one of them is the kind of person
 * who cannot let that go. They are excellent for reach, corrosive for
 * everything else, and they end either in a settlement or in somebody leaving.
 */
export function advanceFeuds(
  state: GameState,
  rng: Rng,
): { state: GameState; notes: readonly string[] } {
  const world = socialWorld(state);
  const cycle = state.clock.cycle;
  const notes: string[] = [];
  const feuds: CreatorFeud[] = [];

  for (const feud of world.feuds) {
    if (feud.status !== 'LIVE') { feuds.push(feud); continue; }
    const flare = rng.fork(`flare:${feud.id}`).chance(0.35);
    const heat = clamp(feud.heat + (flare ? CB.feud.flareHeat : CB.feud.cooling), 0, 100);
    if (heat <= CB.feud.settleBelow) {
      feuds.push({ ...feud, heat, status: 'SETTLED', lastFlareCycle: cycle });
      notes.push('A creator feud has burned itself out.');
    } else {
      feuds.push({ ...feud, heat, ...(flare ? { lastFlareCycle: cycle } : {}) });
    }
  }

  const live = feuds.filter((f) => f.status === 'LIVE');
  if (live.length < CB.feud.maxLive && rng.fork('newfeud').chance(CB.feud.chance)) {
    const pair = findFeudPair(state, rng.fork('pair'));
    if (pair) {
      feuds.push({
        id: `fd_${pair.a.id}_${pair.b.id}_${cycle}`,
        aId: pair.a.id,
        bId: pair.b.id,
        eventId: pair.eventId,
        cause: pair.cause,
        heat: CB.feud.startHeat,
        startedCycle: cycle,
        lastFlareCycle: cycle,
        status: 'LIVE',
      });
      notes.push(`${pair.a.displayName} and ${pair.b.displayName} have fallen out in public.`);
    }
  }

  return { state: withSocialWorld(state, { feuds: feuds.slice(-12) }), notes };
}

function findFeudPair(
  state: GameState,
  rng: Rng,
): { a: Creator; b: Creator; eventId: EventId; cause: string } | null {
  const world = socialWorld(state);
  const existing = new Set(world.feuds.filter((f) => f.status === 'LIVE').flatMap((f) => [f.aId, f.bId]));
  const byEvent = new Map<string, { creator: Creator; sentiment: number }[]>();

  for (const post of state.social.posts) {
    if (post.cycle < state.clock.cycle - 2) continue;
    if (!post.tags.includes('creator-voice')) continue;
    if (!post.relatedEventId) continue;
    const creator = Object.values(state.creators).find(
      (c) => `@${c.handle.replace(/^@/, '')}` === post.authorHandle,
    );
    if (!creator || existing.has(creator.id)) continue;
    const list = byEvent.get(post.relatedEventId) ?? [];
    list.push({ creator, sentiment: post.sentiment });
    byEvent.set(post.relatedEventId, list);
  }

  const candidates: { a: Creator; b: Creator; eventId: EventId; cause: string }[] = [];
  for (const [eventId, entries] of [...byEvent.entries()].sort((x, y) => (x[0] < y[0] ? -1 : 1))) {
    if (entries.length < 2) continue;
    const sorted = entries.slice().sort((x, y) => y.sentiment - x.sentiment);
    const top = sorted[0];
    const bottom = sorted[sorted.length - 1];
    if (!top || !bottom || top.creator.id === bottom.creator.id) continue;
    const gap = (top.sentiment - bottom.sentiment) * 100;
    if (gap < CB.feud.gap) continue;
    const spicy = Math.max(top.creator.attributes.controversy, bottom.creator.attributes.controversy);
    if (spicy < CB.feud.controversy) continue;
    candidates.push({
      a: bottom.creator,
      b: top.creator,
      eventId: eventId as EventId,
      cause: 'They watched the same thing and could not have disagreed more loudly.',
    });
  }
  if (candidates.length === 0) return null;
  return rng.pick(candidates);
}

export const liveFeuds = (state: GameState): CreatorFeud[] =>
  socialWorld(state).feuds.filter((f) => f.status === 'LIVE');
