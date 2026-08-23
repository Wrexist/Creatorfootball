import type { ClubId, EventId } from '../core/brand';
import type { AnyDomainEvent } from '../core/events';
import type { GameState, SocialPost } from '../game/state';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { clubToken, personToken, type ContentRegistryPort } from '../simulation/ports';
import { seedFrom } from '../simulation/templating';
import { creatorReach } from '../creators/creator';
import { rivalriesOf, rivalOpponent } from '../rivalries/rivalries';
import { advanceCampaigns, advanceCreatorRelations, advanceFeuds, generateCampaignOffers } from '../creators/campaigns';
import { FAN_PERSONAS, SOCIAL_ACTION_BALANCE as A, SOCIAL_BALANCE as S } from './balance';
import { applySocialEffect, type SocialEffect } from './effects';
import {
  chooseFanOfTheWeek, generateFanCampaign, generatePollOffer,
} from './community';
import { awardMilestones, type MilestoneAward } from './milestones';
import { appendPosts, postRenderContext, renderPost, type PostRenderContext } from './postFactory';
import { advancePundit, buildWeeklyShow, generateRumour, resolveRumours, viralRoll } from './trending';
import {
  socialWorld, withSocialWorld,
  type FanCampaign, type FanPoll, type PlayerAction, type SocialStake, type ViralMoment,
} from './worldState';

/**
 * The social world's own cycle.
 *
 * Everything the player set in motion is settled here: promises are checked
 * against results, polls close, campaigns fade, creators deliver or walk, the
 * pundit is either vindicated or made to look silly, and a post occasionally
 * escapes into the wider internet.
 *
 * Two properties make it safe to call from anywhere:
 *
 * **Idempotent.** The tick records the cycle it last ran for and refuses to run
 * twice, so the surface that triggers it can do so on every render without
 * consequence.
 *
 * **Deterministic.** Every random decision comes from a stream seeded on the
 * save seed and the cycle number, so two players on the same seed who tap the
 * same buttons see the same world — and no wall clock is read anywhere.
 */

export interface SocialTickOptions {
  /** Wall clock, supplied by the caller. */
  readonly at: number;
  readonly registry?: ContentRegistryPort | null;
}

export interface SocialTickResult {
  readonly state: GameState;
  readonly ran: boolean;
  readonly posts: readonly SocialPost[];
  readonly events: readonly AnyDomainEvent[];
  readonly notes: readonly string[];
  readonly settled: readonly SettledStake[];
  readonly milestones: readonly MilestoneAward[];
  readonly viral: readonly ViralMoment[];
}

export interface SettledStake {
  readonly stake: SocialStake;
  readonly outcome: 'VINDICATED' | 'EMBARRASSED' | 'INCONCLUSIVE';
  readonly headline: string;
}

/** Whether the tick has anything to do for the current cycle. */
export const socialTickDue = (state: GameState): boolean =>
  socialWorld(state).tickedCycle !== state.clock.cycle;

/**
 * Advance the social world to the current cycle.
 *
 * Order matters. Stakes settle first, because the settlement can move fan mood
 * and that mood is what the fan campaigns and the weekly show then read.
 */
export function tickSocialWorld(state: GameState, opts: SocialTickOptions): SocialTickResult {
  const cycle = state.clock.cycle;
  if (socialWorld(state).tickedCycle === cycle) {
    return { state, ran: false, posts: [], events: [], notes: [], settled: [], milestones: [], viral: [] };
  }

  const rng = new Rng(`${state.seed}:socialworld:${cycle}`);
  let next = state;
  const posts: SocialPost[] = [];
  const events: AnyDomainEvent[] = [];
  const notes: string[] = [];
  let ctx = postRenderContext(next, opts.registry ?? null, cycle);

  // --- 1. promises meet results -----------------------------------------
  const settlement = settleStakes(next, ctx, rng.fork('stakes'), opts.at);
  next = settlement.state;
  posts.push(...settlement.posts);
  events.push(...settlement.events);
  notes.push(...settlement.notes);

  // --- 2. creators ------------------------------------------------------
  ctx = postRenderContext(next, opts.registry ?? null, cycle);
  const delivery = advanceCampaigns(next, rng.fork('campaigns'), ctx, opts.at);
  next = delivery.state;
  posts.push(...delivery.posts);
  events.push(...delivery.events);
  notes.push(...delivery.notes);

  const relations = advanceCreatorRelations(next, rng.fork('relations'), opts.at);
  next = relations.state;
  notes.push(...relations.notes);

  const feuds = advanceFeuds(next, rng.fork('feuds'));
  next = feuds.state;
  notes.push(...feuds.notes);

  const offers = generateCampaignOffers(next, rng.fork('offers'), cycle);
  if (offers.length > 0) {
    next = withSocialWorld(next, (w) => ({
      creatorCampaigns: [...w.creatorCampaigns, ...offers].slice(-S.historyCap.creatorCampaigns),
    }));
  }

  // --- 3. the supporters -------------------------------------------------
  next = closePolls(next, rng.fork('polls'), cycle);
  const pollOffer = generatePollOffer(next, rng.fork('polloffer'), cycle);
  if (pollOffer) {
    next = withSocialWorld(next, (w) => ({ polls: [...w.polls, pollOffer].slice(-S.historyCap.pollOffers) }));
  }
  next = fadeCampaigns(next, cycle, opts.at).state;
  const campaign = generateFanCampaign(next, rng.fork('fancampaign'), cycle);
  if (campaign) {
    next = withSocialWorld(next, (w) => ({ campaigns: [...w.campaigns, campaign].slice(-S.historyCap.fanCampaigns) }));
    notes.push(`${campaign.title} — the supporters have started something.`);
  }
  const fan = chooseFanOfTheWeek(next, rng.fork('fanofweek'), cycle);
  if (fan) {
    next = withSocialWorld(next, (w) => ({ fanOfTheWeek: [...w.fanOfTheWeek, fan].slice(-S.historyCap.fanOfTheWeek) }));
  }

  // --- 4. the commentary -------------------------------------------------
  const pundit = advancePundit(next, rng.fork('pundit'), cycle);
  const show = buildWeeklyShow(next, rng.fork('show'), cycle);
  const rumour = generateRumour(next, rng.fork('rumour'), cycle);
  const rumours = resolveRumours(next, cycle);
  next = withSocialWorld(next, {
    ...(pundit ? { pundit } : {}),
    ...(show ? { show } : {}),
    rumours: rumour ? [...rumours, rumour].slice(-A.rumour.retention) : rumours,
  });

  // --- 5. virality -------------------------------------------------------
  ctx = postRenderContext(next, opts.registry ?? null, cycle);
  const viralResult = applyVirality(next, rng.fork('viral'), opts.at);
  next = viralResult.state;
  events.push(...viralResult.events);
  notes.push(...viralResult.notes);

  // --- 6. milestones -----------------------------------------------------
  const anchor = latestClubEvent(next);
  const milestoneResult = awardMilestones(next, opts.at, anchor);
  next = milestoneResult.state;
  events.push(...milestoneResult.events);
  notes.push(...milestoneResult.notes);

  // --- 7. drift ----------------------------------------------------------
  next = drift(next);

  next = withSocialWorld(next, { tickedCycle: cycle });
  if (posts.length > 0) next = appendPosts(next, posts);

  return {
    state: next,
    ran: true,
    posts,
    events,
    notes,
    settled: settlement.settled,
    milestones: milestoneResult.awarded,
    viral: viralResult.viral,
  };
}

/* --- stakes -------------------------------------------------------------- */

interface StakeSettlement {
  readonly state: GameState;
  readonly posts: readonly SocialPost[];
  readonly events: readonly AnyDomainEvent[];
  readonly notes: readonly string[];
  readonly settled: readonly SettledStake[];
}

/**
 * Check what was said against what happened.
 *
 * This is the mechanism that makes silence a strategy. A club that said nothing
 * before a defeat pays the ordinary price of a defeat; a club that called it
 * pays that price and then this one on top, and it is a bigger bill than the
 * reward for having been right.
 */
function settleStakes(
  state: GameState,
  ctx: PostRenderContext,
  rng: Rng,
  at: number,
): StakeSettlement {
  const world = socialWorld(state);
  const cycle = state.clock.cycle;
  if (world.stakes.length === 0) {
    return { state, posts: [], events: [], notes: [], settled: [] };
  }

  let next = state;
  const posts: SocialPost[] = [];
  const events: AnyDomainEvent[] = [];
  const notes: string[] = [];
  const settled: SettledStake[] = [];
  const remaining: SocialStake[] = [];

  for (const stake of world.stakes) {
    if (cycle <= stake.settleAfterCycle) { remaining.push(stake); continue; }

    const result = resultAfter(state, stake.openedCycle);
    if (!result && cycle - stake.openedCycle <= A.stake.expiryCycles) {
      remaining.push(stake);
      continue;
    }

    const outcome = judge(state, stake, result);
    if (outcome === 'INCONCLUSIVE') {
      settled.push({ stake, outcome, headline: 'Nothing happened to settle it either way.' });
      continue;
    }

    const won = outcome === 'VINDICATED';
    const share = result === 'D' ? A.stake.drawShare : 1;
    const magnitude = stake.stake * share;
    const effect: SocialEffect = {
      fanSentiment: (won ? A.stake.fanSentimentWin : A.stake.fanSentimentLoss) * magnitude,
      squadMorale: (won ? A.stake.squadMoraleWin : A.stake.squadMoraleLoss) * magnitude,
      fanExcitement: won ? 3 * magnitude : -2 * magnitude,
      supportersTrust: won ? 3 * magnitude : -3.5 * magnitude,
      ...(stake.opponentClubId
        ? {
          rivalryHeat: {
            opponentClubId: stake.opponentClubId,
            delta: (won ? A.stake.rivalryOnWin : A.stake.rivalryOnLoss) * magnitude,
          },
        }
        : {}),
    };

    const applied = applySocialEffect(next, effect, {
      anchorEventId: stake.eventId,
      suffix: `stake${stake.id}`,
      reason: won ? 'Called it, and it happened' : 'Said it, and then did not do it',
      cycle,
      season: state.clock.season,
      week: state.clock.week,
      at,
      clubId: state.playerClubId,
    });
    next = applied.state;
    events.push(...applied.events);

    const action: PlayerAction = {
      id: `pa_settle_${stake.id}`,
      kind: 'POST',
      cycle,
      eventId: stake.eventId,
      volume: stake.stake,
      warmth: won ? 0.1 : -0.15,
      credibility: (won ? A.stake.credibilityWin : A.stake.credibilityLoss) * stake.stake,
      summary: won ? `Backed it up: ${stake.claim}` : `Did not back it up: ${stake.claim}`,
    };
    next = withSocialWorld(next, (w) => ({ actions: [...w.actions, action].slice(-S.historyCap.actions) }));

    const post = stakePost(next, ctx, rng.forkSequential('stake', settled.length), stake, won);
    if (post) posts.push(post);

    settled.push({
      stake,
      outcome,
      headline: won
        ? 'You said it would happen and it happened. Nobody forgets that either.'
        : 'It was said out loud, and then it did not happen. That is the bill.',
    });
    notes.push(won ? `Vindicated: ${stake.claim}` : `That came back on you: ${stake.claim}`);
  }

  next = withSocialWorld(next, { stakes: remaining });
  return { state: next, posts, events, notes, settled };
}

/** The first result the club got after a stake was opened. */
function resultAfter(state: GameState, cycle: number): 'W' | 'D' | 'L' | null {
  const clubId: ClubId = state.playerClubId;
  for (const event of state.eventLog) {
    if (event.cycle <= cycle) continue;
    if (event.type === 'MATCH_WON' && event.payload.clubId === clubId) return 'W';
    if (event.type === 'MATCH_LOST' && event.payload.clubId === clubId) return 'L';
    if (event.type === 'MATCH_DRAWN' && event.payload.clubId === clubId) return 'D';
  }
  return null;
}

function judge(
  state: GameState,
  stake: SocialStake,
  result: 'W' | 'D' | 'L' | null,
): SettledStake['outcome'] {
  if (stake.kind === 'PUBLIC_BACKING' && stake.playerId) {
    const player = state.players[stake.playerId];
    if (!player) return 'INCONCLUSIVE';
    // Backing a player is judged on the player, not on the table.
    if (player.mental.morale >= 55 || player.form.goals > 0 || player.form.assists > 0) return 'VINDICATED';
    if (player.mental.morale <= 35) return 'EMBARRASSED';
    return result === 'W' ? 'VINDICATED' : result === 'L' ? 'EMBARRASSED' : 'INCONCLUSIVE';
  }
  if (!result) return 'INCONCLUSIVE';
  if (result === 'W') return 'VINDICATED';
  if (result === 'L') return 'EMBARRASSED';
  return 'INCONCLUSIVE';
}

function stakePost(
  state: GameState,
  ctx: PostRenderContext,
  rng: Rng,
  stake: SocialStake,
  won: boolean,
): SocialPost | null {
  const club = state.clubs[state.playerClubId];
  if (!club) return null;
  const opponentId = stake.opponentClubId
    ?? (rivalriesOf(state, club.id)[0] ? rivalOpponent(rivalriesOf(state, club.id)[0]!, club.id) : undefined);
  const opponent = opponentId ? state.clubs[opponentId] : undefined;
  const manager = state.managers[state.playerManagerId];

  // A stake that went wrong is a rival's content; one that came off is a fan's.
  const authorClub = won ? club : opponent ?? club;
  const persona = rng.fork('persona').pick(won ? FAN_PERSONAS : FAN_PERSONAS.slice().reverse());

  return renderPost(ctx, rng.fork('post'), {
    id: `sp_stake_${stake.id}_${won ? 'win' : 'loss'}`.toLowerCase(),
    author: {
      kind: won ? 'FAN' : 'RIVAL',
      name: persona,
      handle: `@${persona.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${authorClub.abbreviation.toLowerCase()}`,
      avatarSeed: seedFrom('fan', persona, authorClub.abbreviation),
      verified: false,
      reach: Math.round(
        clamp(authorClub.fans.onlineFollowers * S.fanReachFromFollowers, S.fanReachFloor, S.fanReachCeiling) * 2.4,
      ),
    },
    hook: {
      trigger: won ? 'STAKE_VINDICATED' : 'STAKE_EMBARRASSED',
      sourceEventId: stake.eventId,
      rootEventId: stake.eventId,
      depth: 0,
      importance: 4,
      sentiment: won ? 0.8 : -0.85,
      tokens: {
        club: clubToken(club.name),
        ...(opponent ? { opponent: clubToken(opponent.name), rival: clubToken(opponent.name) } : {}),
        ...(manager ? { manager: personToken(manager.name) } : {}),
      },
      facts: { tone: stake.tone, kind: stake.kind, won },
      entities: [
        { kind: 'club', id: club.id, name: club.name },
        ...(opponent ? [{ kind: 'club' as const, id: opponent.id, name: opponent.name }] : []),
      ],
      clubId: club.id,
      ...(opponentId ? { opponentClubId: opponentId } : {}),
      audiences: [won ? 'FAN' : 'RIVAL'],
      tags: ['stake', won ? 'vindicated' : 'embarrassed'],
      cycle: state.clock.cycle,
    },
    facts: { tone: stake.tone, won },
    sentiment: won ? 0.8 : -0.85,
    trigger: won ? 'STAKE_VINDICATED' : 'STAKE_EMBARRASSED',
    fallbackTriggers: ['CLUB_STATEMENT'],
    extraTags: ['stake-settled'],
    weightBonus: 12,
  });
}

/* --- polls and campaigns -------------------------------------------------- */

/**
 * Close any poll that has run its course.
 *
 * The result is a weighted draw over the options, biased by what the supporters
 * would actually want given the club's mood — a support that is angry votes for
 * the confrontational option far more often than a happy one does.
 */
function closePolls(state: GameState, rng: Rng, cycle: number): GameState {
  const world = socialWorld(state);
  if (!world.polls.some((p) => p.status === 'OPEN' && p.closesCycle <= cycle)) return state;
  const club = state.clubs[state.playerClubId];
  const followers = club?.fans.onlineFollowers ?? state.social.clubFollowers;

  const polls: FanPoll[] = world.polls.map((poll) => {
    if (poll.status !== 'OPEN' || poll.closesCycle > cycle) return poll;
    const local = rng.fork(`close:${poll.id}`);
    const lead = local.fork('lead').float(A.poll.leadBand[0], A.poll.leadBand[1]);
    const winnerIndex = local.fork('winner').int(0, poll.options.length - 1);
    const rest = (1 - lead) / Math.max(1, poll.options.length - 1);
    const shares = poll.options.map((_, i) => (i === winnerIndex ? lead : rest));
    const turnout = Math.round(followers * local.fork('turnout').float(A.poll.turnout[0], A.poll.turnout[1]));
    return {
      ...poll,
      status: 'CLOSED' as const,
      shares,
      winnerId: poll.options[winnerIndex]?.id ?? poll.options[0]?.id,
      turnout,
    };
  });
  return withSocialWorld(state, { polls });
}

/** A campaign nobody answered fades, and costs a little on the way out. */
function fadeCampaigns(state: GameState, cycle: number, at: number): { state: GameState } {
  const world = socialWorld(state);
  const expiring = world.campaigns.filter((c) => c.status === 'LIVE' && c.expiresCycle <= cycle);
  if (expiring.length === 0) return { state };

  let next = state;
  for (const campaign of expiring) {
    const applied = applySocialEffect(next, {
      supportersTrust: A.campaign.trustForIgnoring,
      fanSentiment: -0.8,
    }, {
      anchorEventId: campaign.eventId,
      suffix: `campaignfade${campaign.kind.toLowerCase()}`,
      reason: `${campaign.title} was never answered`,
      cycle,
      season: state.clock.season,
      week: state.clock.week,
      at,
      clubId: state.playerClubId,
    });
    next = applied.state;
  }
  const campaigns: FanCampaign[] = socialWorld(next).campaigns.map(
    (c) => (c.status === 'LIVE' && c.expiresCycle <= cycle ? { ...c, status: 'IGNORED' as const } : c),
  );
  return { state: withSocialWorld(next, { campaigns }) };
}

/* --- virality ------------------------------------------------------------- */

/**
 * One post a week can escape.
 *
 * The candidate is the heaviest post of the cycle rather than a random one, so
 * virality amplifies something the world already decided mattered. The
 * multiplier is applied to the post's own numbers — the feed visibly shows it —
 * and the follower conversion is credited to the club, because a moment that
 * travelled is worth something after it stops travelling.
 */
function applyVirality(
  state: GameState,
  rng: Rng,
  at: number,
): { state: GameState; events: readonly AnyDomainEvent[]; notes: readonly string[]; viral: readonly ViralMoment[] } {
  const cycle = state.clock.cycle;
  const world = socialWorld(state);
  if (world.viral.some((v) => v.cycle === cycle)) {
    return { state, events: [], notes: [], viral: [] };
  }

  const candidates = state.social.posts.filter(
    (p) => p.cycle === cycle && p.relatedEventId && Math.abs(p.sentiment) > 0.3,
  );
  if (candidates.length === 0) return { state, events: [], notes: [], viral: [] };
  const candidate = candidates.reduce(
    (best, p) => (p.weight > best.weight || (p.weight === best.weight && p.id < best.id) ? p : best),
    candidates[0] as SocialPost,
  );

  const importance = candidate.weight >= 60 ? 5 : candidate.weight >= 46 ? 4 : 3;
  const roll = viralRoll(candidate, importance, rng.fork(`roll:${candidate.id}`));
  if (!roll.viral) return { state, events: [], notes: [], viral: [] };

  const extraImpressions = Math.round(
    (candidate.likes * S.impressionsPerLike + candidate.reposts * S.impressionsPerRepost) * (roll.multiplier - 1),
  );
  const followerGain = Math.round(extraImpressions * A.viral.followerConversion);

  const moment: ViralMoment = {
    postId: candidate.id,
    eventId: candidate.relatedEventId as EventId,
    cycle,
    multiplier: Math.round(roll.multiplier * 10) / 10,
    reach: extraImpressions,
    sentiment: candidate.sentiment,
    label: candidate.sentiment >= 0
      ? 'This one got out of the football internet entirely.'
      : 'This one got out, and it is not the version of you anybody would have chosen.',
  };

  const applied = applySocialEffect(state, {
    followers: candidate.sentiment >= 0 ? followerGain : Math.round(followerGain * 0.65),
    fanExcitement: candidate.sentiment >= 0 ? 3 : -1,
    fanSentiment: candidate.sentiment >= 0 ? 1.6 : -1.8,
    reputation: candidate.sentiment >= 0 ? 0.8 : -0.4,
  }, {
    anchorEventId: moment.eventId,
    suffix: `viral${cycle}`,
    reason: 'A post went a very long way',
    cycle,
    season: state.clock.season,
    week: state.clock.week,
    at,
    clubId: state.playerClubId,
  });

  const boosted: GameState = {
    ...applied.state,
    social: {
      ...applied.state.social,
      posts: applied.state.social.posts.map((p) => (p.id === candidate.id
        ? {
          ...p,
          likes: Math.round(p.likes * roll.multiplier),
          reposts: Math.round(p.reposts * roll.multiplier),
          replies: Math.round(p.replies * roll.multiplier * 0.8),
          weight: clamp(p.weight + 14, 1, 100),
          tags: [...p.tags, 'viral'],
        }
        : p)),
    },
  };

  const next = withSocialWorld(boosted, (w) => ({
    viral: [...w.viral, moment].slice(-S.historyCap.viralMoments),
  }));

  return {
    state: next,
    events: applied.events,
    notes: [`A post reached ${extraImpressions.toLocaleString('en-GB')} extra people and brought ${followerGain.toLocaleString('en-GB')} followers.`],
    viral: [moment],
  };
}

/* --- drift ---------------------------------------------------------------- */

/** Trust and goodwill both decay toward neutral when nothing is happening. */
function drift(state: GameState): GameState {
  const world = socialWorld(state);
  const trust = world.supportersTrust
    + (A.trustResting - world.supportersTrust) * A.trustDriftRate;
  const goodwill = world.mediaGoodwill
    + (A.goodwillResting - world.mediaGoodwill) * A.goodwillDriftRate;
  return withSocialWorld(state, {
    supportersTrust: clamp(Math.round(trust * 10) / 10, 0, 100),
    mediaGoodwill: clamp(Math.round(goodwill * 10) / 10, 0, 100),
  });
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

/** Creator reach, re-exported so the app can size a campaign card. */
export { creatorReach };
