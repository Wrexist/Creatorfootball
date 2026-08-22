import type { PlayerId } from '../core/brand';
import type { AnyDomainEvent } from '../core/events';
import type { GameState, SocialPost } from '../game/state';
import type { Player } from '../players/player';
import { Rng } from '../core/rng';
import { clamp } from '../core/math';
import { clubToken, personToken, type ContentRegistryPort } from '../simulation/ports';
import { seedFrom } from '../simulation/templating';
import { injuredPlayers, recentForm, squadOf } from '../game/selectors';
import { FAN_PERSONAS, SOCIAL_ACTION_BALANCE as A, SOCIAL_BALANCE as S, SUPPORTER_GROUPS } from './balance';
import { applySocialEffect, describeEffect, type EffectLine, type SocialEffect } from './effects';
import { socialMoments, type SocialMoment } from './moments';
import { appendPosts, postRenderContext, renderPost, type PostRenderContext } from './postFactory';
import {
  socialWorld, withSocialWorld,
  type FanCampaign, type FanCampaignKind, type FanOfTheWeek, type FanPoll, type PollOption,
} from './worldState';

/**
 * The supporters, as a party to the relationship rather than a number.
 *
 * Three surfaces, and the design rule underneath all of them is that *asking is
 * a commitment*. A poll the club runs and then overrules is far worse than a
 * poll it never ran — which is exactly how it works in a real supporters'
 * meeting, and it is what makes running one a decision rather than free
 * goodwill.
 *
 * Campaigns are the mirror image: the supporters start those, the club did not
 * ask, and the only available moves are to meet them, refuse them, or let them
 * sit there costing a little every week.
 */

/* --- polls --------------------------------------------------------------- */

interface PollDef {
  readonly id: string;
  readonly topic: string;
  readonly weight: number;
  readonly applies: (c: PollContext) => boolean;
  readonly build: (c: PollContext) => { question: string; options: readonly PollOption[] } | null;
}

interface PollContext {
  readonly state: GameState;
  readonly moment: SocialMoment;
  readonly squad: readonly Player[];
  readonly form: readonly ('W' | 'D' | 'L')[];
  readonly sentiment: number;
  readonly trust: number;
  readonly group: string;
}

const POLL_DEFS: readonly PollDef[] = [
  {
    id: 'poll_captain',
    topic: 'The armband',
    weight: 3,
    applies: (c) => c.squad.length >= 6,
    build: (c) => {
      const contenders = c.squad.slice().sort((a, b) => b.mental.leadership - a.mental.leadership).slice(0, 3);
      if (contenders.length < 3) return null;
      return {
        question: 'Who should be wearing the armband for the rest of this season?',
        options: contenders.map((p) => ({
          id: `opt_${p.id}`,
          label: p.displayName,
          commitment: `${p.displayName} captains the side. Whoever loses it will notice.`,
        })),
      };
    },
  },
  {
    id: 'poll_ticket_freeze',
    topic: 'Ticket prices',
    weight: 4,
    applies: (c) => c.sentiment < 55,
    build: () => ({
      question: 'Should we freeze ticket prices for next season?',
      options: [
        { id: 'opt_freeze', label: 'Freeze them', commitment: 'Matchday income stays flat while costs do not.' },
        { id: 'opt_raise', label: 'Raise them, and say why', commitment: 'More income, and an argument on the concourse.' },
        { id: 'opt_split', label: 'Freeze the away end only', commitment: 'A compromise nobody asked for and most people accept.' },
      ],
    }),
  },
  {
    id: 'poll_kit',
    topic: 'The kit',
    weight: 3,
    applies: () => true,
    build: () => ({
      question: 'Next season\'s home shirt. You decide.',
      options: [
        { id: 'opt_classic', label: 'The 1974 collar, back again', commitment: 'The older support will love it. Nobody under thirty will buy it.' },
        { id: 'opt_modern', label: 'Something nobody has done before', commitment: 'It will either sell out in a day or be a punchline.' },
        { id: 'opt_plain', label: 'Plain, and get it right', commitment: 'Safe. Sells steadily. Wins no arguments.' },
      ],
    }),
  },
  {
    id: 'poll_anthem',
    topic: 'Walk-out music',
    weight: 2,
    applies: () => true,
    build: () => ({
      question: 'What do we walk out to?',
      options: [
        { id: 'opt_old', label: 'The one we have always used', commitment: 'Nothing changes. Nobody complains.' },
        { id: 'opt_new', label: 'Something the concourse chose', commitment: 'A fortnight of arguing, and then it sticks.' },
        { id: 'opt_silence', label: 'Nothing. Just noise.', commitment: 'The away end will call it pretentious. The home end will love it.' },
      ],
    }),
  },
  {
    id: 'poll_number',
    topic: 'The number nine',
    weight: 3,
    applies: (c) => c.squad.some((p) => p.position === 'ST'),
    build: (c) => {
      const strikers = c.squad.filter((p) => p.position === 'ST').slice(0, 3);
      if (strikers.length < 2) return null;
      return {
        question: 'Who gets the nine?',
        options: strikers.map((p) => ({
          id: `opt_${p.id}`,
          label: p.displayName,
          commitment: `${p.displayName} takes the shirt, and the expectation that comes with it.`,
        })),
      };
    },
  },
  {
    id: 'poll_derby_xi',
    topic: 'The derby',
    weight: 5,
    applies: (c) => c.moment.facts.derby === true || c.moment.forward,
    build: () => ({
      question: 'How do we set up for this one?',
      options: [
        { id: 'opt_front', label: 'Go at them from the first whistle', commitment: 'A front-foot side. Thrilling, and occasionally a bloodbath.' },
        { id: 'opt_solid', label: 'Make it horrible for them', commitment: 'Nobody enjoys watching it. Everybody enjoys the result.' },
        { id: 'opt_kids', label: 'Trust the young ones', commitment: 'The academy gets a derby. It either makes them or it does not.' },
      ],
    }),
  },
  {
    id: 'poll_protest',
    topic: 'The board',
    weight: 4,
    applies: (c) => c.sentiment < A.campaign.unrestSentiment + 6,
    build: (c) => ({
      question: `${c.group} have asked the club a direct question. What is the answer?`,
      options: [
        { id: 'opt_open', label: 'Open the books', commitment: 'Everything published. Some of it will not read well.' },
        { id: 'opt_meet', label: 'Meet them, privately', commitment: 'A room, an hour, and no press release.' },
        { id: 'opt_stand', label: 'Stand your ground', commitment: 'The club says no. Publicly. It will be remembered.' },
      ],
    }),
  },
  {
    id: 'poll_fan_of_week',
    topic: 'Fan of the week',
    weight: 2,
    applies: () => true,
    build: () => ({
      question: 'Who gets the shirt this week?',
      options: [
        { id: 'opt_travel', label: 'The one who did 400 miles on a Tuesday', commitment: 'A shirt, a photo, and a small amount of everybody feeling better.' },
        { id: 'opt_young', label: 'The kid at their first away game', commitment: 'A shirt, a photo, and a story they tell for thirty years.' },
        { id: 'opt_steward', label: 'The steward who has done it for 30 years', commitment: 'A shirt, a photo, and a genuinely emotional concourse.' },
      ],
    }),
  },
  {
    id: 'poll_creator',
    topic: 'The content',
    weight: 3,
    applies: (c) => Object.keys(c.state.creators).length > 0,
    build: () => ({
      question: 'What should we be making more of?',
      options: [
        { id: 'opt_access', label: 'Access. Show us the boring bits.', commitment: 'More cameras inside the building than the staff will like.' },
        { id: 'opt_funny', label: 'Make us laugh', commitment: 'Reach goes up. Being taken seriously goes down.' },
        { id: 'opt_football', label: 'Just the football', commitment: 'Smaller audience, and a support that trusts you.' },
      ],
    }),
  },
  {
    id: 'poll_away_travel',
    topic: 'Away days',
    weight: 3,
    applies: (c) => c.trust < 65,
    build: () => ({
      question: 'The away allocation for the long ones. What do we do?',
      options: [
        { id: 'opt_subsidise', label: 'Subsidise the coaches', commitment: 'It costs money. The away end will be full and loud.' },
        { id: 'opt_ballot', label: 'Ballot it fairly', commitment: 'Nobody is angry. Nobody is delighted either.' },
        { id: 'opt_loyalty', label: 'Loyalty points only', commitment: 'The regulars are rewarded. Everybody else is told no.' },
      ],
    }),
  },
  {
    id: 'poll_badge',
    topic: 'The badge',
    weight: 2,
    applies: () => true,
    build: () => ({
      question: 'There is a proposal to modernise the badge. Do we?',
      options: [
        { id: 'opt_keep', label: 'Leave it alone', commitment: 'The badge stays. So does everything about how the club looks.' },
        { id: 'opt_tidy', label: 'Tidy it, do not change it', commitment: 'Nobody notices, which is the highest praise a badge redesign gets.' },
        { id: 'opt_new', label: 'Do something new', commitment: 'A week of fury, then a decade of it being simply the badge.' },
      ],
    }),
  },
  {
    id: 'poll_youth',
    topic: 'The academy',
    weight: 3,
    applies: (c) => c.squad.some((p) => p.age <= 20),
    build: (c) => {
      const kids = c.squad.filter((p) => p.age <= 20).sort((a, b) => b.potential - a.potential).slice(0, 3);
      if (kids.length < 2) return null;
      return {
        question: 'Which one of these do we build around?',
        options: kids.map((p) => ({
          id: `opt_${p.id}`,
          label: `${p.displayName}, ${p.age}`,
          commitment: `${p.displayName} gets minutes whether or not the results say he should.`,
        })),
      };
    },
  },
  {
    id: 'poll_charity',
    topic: 'The community',
    weight: 2,
    applies: () => true,
    build: () => ({
      question: 'Where does this season\'s community fund go?',
      options: [
        { id: 'opt_food', label: 'The food bank two streets away', commitment: 'Local, unglamorous, and the right answer.' },
        { id: 'opt_pitches', label: 'Rebuild the council pitches', commitment: 'Six hundred kids get somewhere flat to play.' },
        { id: 'opt_travel2', label: 'Free travel for under-16s', commitment: 'A generation of them get the habit.' },
      ],
    }),
  },
  {
    id: 'poll_stayorgo',
    topic: 'The wantaway',
    weight: 4,
    applies: (c) => c.squad.some((p) => p.mental.morale < 35),
    build: (c) => {
      const unhappy = c.squad.filter((p) => p.mental.morale < 35)
        .sort((a, b) => a.mental.morale - b.mental.morale)[0];
      if (!unhappy) return null;
      return {
        question: `${unhappy.displayName} wants away. Do we let him go?`,
        options: [
          { id: 'opt_sell', label: 'Take the money', commitment: 'He goes. The dressing room settles. The stands do not.' },
          { id: 'opt_keep2', label: 'Make him see it out', commitment: 'He stays, sulking, and plays anyway.' },
          { id: 'opt_talk', label: 'Sit him down first', commitment: 'One more conversation before anybody does anything final.' },
        ],
      };
    },
  },
];

function pollContext(state: GameState, moment: SocialMoment): PollContext {
  const world = socialWorld(state);
  const club = state.clubs[state.playerClubId];
  return {
    state,
    moment,
    squad: squadOf(state, state.playerClubId),
    form: recentForm(state, state.playerClubId, 5),
    sentiment: club?.fans.sentiment ?? 50,
    trust: world.supportersTrust,
    group: SUPPORTER_GROUPS[Math.abs(hash(state.seed)) % SUPPORTER_GROUPS.length] ?? SUPPORTER_GROUPS[0]!,
  };
}

const hash = (s: string): number => {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (Math.imul(h, 31) + s.charCodeAt(i)) | 0;
  return h;
};

/** Offer a poll the supporters would actually turn up for. */
export function generatePollOffer(state: GameState, rng: Rng, cycle: number): FanPoll | null {
  const world = socialWorld(state);
  const open = world.polls.filter(
    (p) => (p.status === 'OFFERED' && p.closesCycle > cycle) || p.status === 'OPEN',
  );
  if (open.length > 0) return null;
  const recentTopics = new Set(
    world.polls.filter((p) => p.offeredCycle >= cycle - 8).map((p) => p.topic),
  );

  const moments = socialMoments(state, { windowCycles: 2, limit: 8 });
  if (moments.length === 0) return null;
  const moment = rng.fork('moment').weighted(moments, (m) => m.importance);
  const ctx = pollContext(state, moment);

  const eligible = POLL_DEFS.filter((d) => d.applies(ctx) && !recentTopics.has(d.topic));
  if (eligible.length === 0) return null;
  const def = rng.fork('def').weighted(eligible, (d) => d.weight);
  const built = def.build(ctx);
  if (!built) return null;

  return {
    id: `poll_${def.id}_${cycle}`,
    topic: def.topic,
    question: built.question,
    eventId: moment.eventId,
    options: built.options,
    offeredCycle: cycle,
    closesCycle: cycle + A.poll.offerWindow,
    status: 'OFFERED',
  };
}

export const offeredPolls = (state: GameState): FanPoll[] =>
  socialWorld(state).polls.filter((p) => p.status === 'OFFERED' && p.closesCycle > state.clock.cycle);

export const openPolls = (state: GameState): FanPoll[] =>
  socialWorld(state).polls.filter((p) => p.status === 'OPEN');

export const closedPolls = (state: GameState): FanPoll[] =>
  socialWorld(state).polls
    .filter((p) => p.status === 'CLOSED')
    .sort((a, b) => b.closesCycle - a.closesCycle);

export interface CommunityResult {
  readonly state: GameState;
  readonly ok: boolean;
  readonly reason?: string;
  readonly effect?: SocialEffect;
  readonly posts: readonly SocialPost[];
  readonly events: readonly AnyDomainEvent[];
}

/** Put the question to the support. Asking is worth something on its own. */
export function runPoll(state: GameState, input: { pollId: string; at: number }): CommunityResult {
  const poll = socialWorld(state).polls.find((p) => p.id === input.pollId);
  if (!poll || poll.status !== 'OFFERED') {
    return { state, ok: false, reason: 'That question is no longer live.', posts: [], events: [] };
  }
  const effect: SocialEffect = { supportersTrust: A.poll.trustForRunning, fanTrust: A.poll.trustForRunning * 0.4 };
  const applied = applySocialEffect(state, effect, {
    anchorEventId: poll.eventId,
    suffix: `pollrun${poll.id}`,
    reason: 'Put a question to the supporters',
    cycle: state.clock.cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    clubId: state.playerClubId,
  });
  const next = withSocialWorld(applied.state, (w) => ({
    polls: w.polls.map((p) => (p.id === poll.id
      ? { ...p, status: 'OPEN' as const, closesCycle: state.clock.cycle + A.poll.runsFor }
      : p)),
    actions: [...w.actions, {
      id: `pa_pollrun_${poll.id}`,
      kind: 'POLL_RUN' as const,
      cycle: state.clock.cycle,
      eventId: poll.eventId,
      volume: 0.4,
      warmth: 0.6,
      credibility: 0.3,
      summary: `Asked the supporters about ${poll.topic.toLowerCase()}`,
    }].slice(-S.historyCap.actions),
  }));
  return { state: next, ok: true, effect, posts: [], events: applied.events };
}

/** Decline to ask. Costs a little, and only a little. */
export function declinePoll(state: GameState, input: { pollId: string; at: number }): CommunityResult {
  const poll = socialWorld(state).polls.find((p) => p.id === input.pollId);
  if (!poll || poll.status !== 'OFFERED') {
    return { state, ok: false, reason: 'Nothing to decline.', posts: [], events: [] };
  }
  const effect: SocialEffect = { supportersTrust: A.poll.trustForDeclining };
  const applied = applySocialEffect(state, effect, {
    anchorEventId: poll.eventId,
    suffix: `polldecline${poll.id}`,
    reason: 'Declined to put it to the supporters',
    cycle: state.clock.cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    clubId: state.playerClubId,
  });
  const next = withSocialWorld(applied.state, (w) => ({
    polls: w.polls.map((p) => (p.id === poll.id ? { ...p, status: 'DECLINED' as const } : p)),
  }));
  return { state: next, ok: true, effect, posts: [], events: applied.events };
}

/** Do what the vote said — or say plainly that you will not. */
export function settlePoll(
  state: GameState,
  input: { pollId: string; honour: boolean; at: number; registry?: ContentRegistryPort | null },
): CommunityResult {
  const poll = socialWorld(state).polls.find((p) => p.id === input.pollId);
  if (!poll || poll.status !== 'CLOSED') {
    return { state, ok: false, reason: 'That vote is not waiting on you.', posts: [], events: [] };
  }
  const effect: SocialEffect = input.honour
    ? { supportersTrust: A.poll.trustForHonouring, fanSentiment: 2.4, fanTrust: 3 }
    : { supportersTrust: A.poll.trustForOverruling, fanSentiment: -3.2, fanTrust: -4, mediaGoodwill: 1.2 };

  const applied = applySocialEffect(state, effect, {
    anchorEventId: poll.eventId,
    suffix: `poll${input.honour ? 'honour' : 'overrule'}${poll.id}`,
    reason: input.honour ? 'Honoured the supporters’ vote' : 'Overruled the supporters’ vote',
    cycle: state.clock.cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    clubId: state.playerClubId,
  });

  let next = withSocialWorld(applied.state, (w) => ({
    polls: w.polls.map((p) => (p.id === poll.id
      ? { ...p, status: (input.honour ? 'HONOURED' : 'OVERRULED') as FanPoll['status'] }
      : p)),
    actions: [...w.actions, {
      id: `pa_poll_${poll.id}_${input.honour ? 'honour' : 'overrule'}`,
      kind: (input.honour ? 'POLL_HONOUR' : 'POLL_IGNORE') as 'POLL_HONOUR' | 'POLL_IGNORE',
      cycle: state.clock.cycle,
      eventId: poll.eventId,
      volume: 0.5,
      warmth: input.honour ? 0.8 : -0.7,
      credibility: input.honour ? 0.7 : -0.5,
      summary: input.honour
        ? `Did what the vote said about ${poll.topic.toLowerCase()}`
        : `Overruled the vote about ${poll.topic.toLowerCase()}`,
    }].slice(-S.historyCap.actions),
  }));

  const ctx = postRenderContext(next, input.registry ?? null, state.clock.cycle);
  const posts = pollReactionPosts(
    next, ctx, new Rng(`${state.seed}:pollsettle:${poll.id}`), poll, input.honour,
  );
  next = appendPosts(next, posts);

  return { state: next, ok: true, effect, posts, events: applied.events };
}

function pollReactionPosts(
  state: GameState,
  ctx: PostRenderContext,
  rng: Rng,
  poll: FanPoll,
  honoured: boolean,
): SocialPost[] {
  const club = state.clubs[state.playerClubId];
  if (!club) return [];
  const winner = poll.options.find((o) => o.id === poll.winnerId) ?? poll.options[0];
  const hook = {
    trigger: honoured ? 'POLL_HONOURED' : 'POLL_OVERRULED',
    sourceEventId: poll.eventId,
    rootEventId: poll.eventId,
    depth: 0,
    importance: 3 as const,
    sentiment: honoured ? 0.5 : -0.6,
    tokens: {
      club: clubToken(club.name),
      topic: poll.topic.toLowerCase(),
      choice: winner?.label ?? 'the vote',
      share: poll.shares && poll.winnerId
        ? `${Math.round((poll.shares[poll.options.findIndex((o) => o.id === poll.winnerId)] ?? 0) * 100)}%`
        : '',
      turnout: poll.turnout ? poll.turnout.toLocaleString('en-GB') : '',
    },
    facts: { honoured, topic: poll.topic },
    entities: [{ kind: 'club' as const, id: club.id, name: club.name }],
    clubId: club.id,
    audiences: ['FAN' as const],
    tags: ['fans', 'poll'],
    cycle: state.clock.cycle,
  };

  const out: SocialPost[] = [];
  const personas = rng.fork('persona').sample(FAN_PERSONAS, 2);
  personas.forEach((persona, index) => {
    const post = renderPost(ctx, rng.forkSequential('pollreact', index), {
      id: `sp_poll_${poll.id}_${index}`.toLowerCase(),
      author: {
        kind: 'FAN',
        name: persona,
        handle: `@${persona.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${club.abbreviation.toLowerCase()}`,
        avatarSeed: seedFrom('fan', persona, club.abbreviation),
        verified: false,
        reach: Math.round(clamp(club.fans.onlineFollowers * S.fanReachFromFollowers, S.fanReachFloor, S.fanReachCeiling) * 1.4),
      },
      hook,
      facts: { honoured },
      sentiment: honoured ? 0.6 : -0.7,
      extraTags: ['poll-reaction'],
    });
    if (post) out.push(post);
  });
  return out;
}

/* --- campaigns ----------------------------------------------------------- */

interface CampaignDef {
  readonly kind: FanCampaignKind;
  readonly weight: number;
  readonly applies: (c: PollContext) => boolean;
  readonly title: string;
  readonly demand: (c: PollContext) => string;
  readonly subject?: (c: PollContext) => PlayerId | undefined;
}

const CAMPAIGN_DEFS: readonly CampaignDef[] = [
  {
    kind: 'PROTEST', weight: 5,
    applies: (c) => c.sentiment < A.campaign.unrestSentiment,
    title: 'Ten minutes of silence',
    demand: (c) => `${c.group} are asking the ground to stay silent for the first ten minutes. They want somebody from the club to say something first.`,
  },
  {
    kind: 'BANNER', weight: 4,
    applies: (c) => c.sentiment < 45,
    title: 'A banner they will not take down',
    demand: () => 'A banner has gone up on the away end. Stewards want it removed and the people who paid for it want it left exactly where it is.',
  },
  {
    kind: 'TIFO', weight: 4,
    applies: (c) => c.sentiment >= A.campaign.celebrationSentiment || c.moment.facts.derby === true,
    title: 'A tifo for the derby',
    demand: (c) => `${c.group} are building something enormous and they need the club to pay for the fabric and hold the gates open the night before.`,
  },
  {
    kind: 'CHANT', weight: 3,
    applies: () => true,
    title: 'A song nobody taught them',
    demand: () => 'A song has appeared out of the back of the lower tier and it has already spread. They want it played over the tannoy at full time.',
  },
  {
    kind: 'PLAYER_SONG', weight: 3,
    applies: (c) => c.squad.some((p) => p.form.goals >= 3),
    title: 'They have written him a song',
    demand: (c) => {
      const scorer = c.squad.slice().sort((a, b) => b.form.goals - a.form.goals)[0];
      return `The whole away end has a song for ${scorer?.displayName ?? 'him'} now. They want him to acknowledge it.`;
    },
    subject: (c) => c.squad.slice().sort((a, b) => b.form.goals - a.form.goals)[0]?.id,
  },
  {
    kind: 'TRUST_BALLOT', weight: 4,
    applies: (c) => c.trust < 40,
    title: 'A ballot on the board',
    demand: (c) => `${c.group} are running a formal confidence ballot. Refusing to acknowledge it is itself an answer.`,
  },
  {
    kind: 'BOYCOTT_THREAT', weight: 3,
    applies: (c) => c.sentiment < 30,
    title: 'They are talking about not going',
    demand: () => 'There is serious talk of an organised absence for the next home game. It would be visible from space and from every camera in the ground.',
  },
  {
    kind: 'AWAY_END_PUSH', weight: 3,
    applies: (c) => c.form.filter((r) => r === 'W').length >= 2,
    title: 'Fill the away end',
    demand: () => 'They want to take three thousand to a ground that has allocated eight hundred. They want the club to push for more.',
  },
  {
    kind: 'FUNDRAISER', weight: 3,
    applies: () => true,
    title: 'They are raising it themselves',
    demand: () => 'The supporters have started raising money for something the club should probably have paid for. They would like it acknowledged rather than quietly accepted.',
  },
  {
    kind: 'PROTEST', weight: 4,
    applies: (c) => injuredPlayers(c.state, c.state.playerClubId).length >= 3,
    title: 'Questions about the medical room',
    demand: () => 'Somebody has counted the injuries and posted the graph. It has been shared eleven thousand times and it is not wrong.',
  },
  {
    kind: 'BANNER', weight: 3,
    applies: (c) => c.form.filter((r) => r === 'L').length >= 3,
    title: '"Not fit to wear the shirt"',
    demand: () => 'Four words on a bedsheet, hung where every camera in the ground can find it.',
  },
  {
    kind: 'CHANT', weight: 3,
    applies: (c) => c.sentiment >= A.campaign.celebrationSentiment,
    title: 'They have not stopped singing',
    demand: () => 'The whole ground stayed behind for twenty minutes after full time. They would like somebody to come back out.',
  },
];

/** Something the supporters have started, whether or not the club wanted it. */
export function generateFanCampaign(state: GameState, rng: Rng, cycle: number): FanCampaign | null {
  const world = socialWorld(state);
  const live = world.campaigns.filter((c) => c.status === 'LIVE' && c.expiresCycle > cycle);
  if (live.length >= A.campaign.maxLive) return null;

  const moments = socialMoments(state, { windowCycles: 2, limit: 8 });
  if (moments.length === 0) return null;
  const moment = rng.fork('moment').weighted(moments, (m) => m.importance);
  const ctx = pollContext(state, moment);

  const liveKinds = new Set(live.map((c) => c.kind));
  const eligible = CAMPAIGN_DEFS.filter((d) => d.applies(ctx) && !liveKinds.has(d.kind));
  if (eligible.length === 0) return null;
  if (!rng.fork('chance').chance(0.5)) return null;

  const def = rng.fork('def').weighted(eligible, (d) => d.weight);
  const subject = def.subject?.(ctx);
  const club = state.clubs[state.playerClubId];
  return {
    id: `fc_${def.kind}_${cycle}`.toLowerCase(),
    kind: def.kind,
    eventId: moment.eventId,
    title: def.title,
    demand: def.demand(ctx),
    startedCycle: cycle,
    expiresCycle: cycle + A.campaign.lifespan,
    support: Math.round(clamp(
      (100 - (club?.fans.sentiment ?? 50)) * 0.6 + rng.fork('support').int(15, 45), 5, 100,
    )),
    status: 'LIVE',
    ...(subject ? { playerId: subject } : {}),
  };
}

export const liveCampaigns = (state: GameState): FanCampaign[] =>
  socialWorld(state).campaigns
    .filter((c) => c.status === 'LIVE' && c.expiresCycle > state.clock.cycle)
    .sort((a, b) => b.support - a.support);

export interface CampaignResponseOption {
  readonly response: 'BACK' | 'REFUSE';
  readonly label: string;
  readonly blurb: string;
  readonly effect: SocialEffect;
  readonly lines: readonly EffectLine[];
}

export function campaignOptions(state: GameState, campaign: FanCampaign): CampaignResponseOption[] {
  const scale = campaign.support / 60;
  const back: SocialEffect = {
    supportersTrust: A.campaign.trustForBacking * scale,
    fanSentiment: 3 * scale,
    fanTrust: 3.4 * scale,
    reputation: A.campaign.reputationForBacking,
    ...(campaign.playerId ? { playerMorale: { playerId: campaign.playerId, delta: 7 } } : {}),
  };
  const refuse: SocialEffect = {
    supportersTrust: A.campaign.trustForRefusing * scale,
    fanSentiment: -2.4 * scale,
    mediaGoodwill: 1.6,
    reputation: 0.5,
  };
  return [
    {
      response: 'BACK',
      label: 'Get behind it',
      blurb: 'The club puts its name to something the supporters started.',
      effect: back,
      lines: describeEffect(back, state),
    },
    {
      response: 'REFUSE',
      label: 'Say no, and say why',
      blurb: 'Clear, unpopular, and at least honest. The board will prefer it.',
      effect: refuse,
      lines: describeEffect(refuse, state),
    },
  ];
}

export function respondToCampaign(
  state: GameState,
  input: { campaignId: string; response: 'BACK' | 'REFUSE'; at: number; registry?: ContentRegistryPort | null },
): CommunityResult {
  const campaign = socialWorld(state).campaigns.find((c) => c.id === input.campaignId);
  if (!campaign || campaign.status !== 'LIVE') {
    return { state, ok: false, reason: 'That has already run its course.', posts: [], events: [] };
  }
  const option = campaignOptions(state, campaign).find((o) => o.response === input.response);
  if (!option) return { state, ok: false, reason: 'Unknown response.', posts: [], events: [] };

  const applied = applySocialEffect(state, option.effect, {
    anchorEventId: campaign.eventId,
    suffix: `campaign${input.response.toLowerCase()}${campaign.kind.toLowerCase()}`,
    reason: `${option.label} — ${campaign.title}`,
    cycle: state.clock.cycle,
    season: state.clock.season,
    week: state.clock.week,
    at: input.at,
    clubId: state.playerClubId,
  });

  let next = withSocialWorld(applied.state, (w) => ({
    campaigns: w.campaigns.map((c) => (c.id === campaign.id
      ? { ...c, status: (input.response === 'BACK' ? 'BACKED' : 'REFUSED') as FanCampaign['status'] }
      : c)),
    actions: [...w.actions, {
      id: `pa_campaign_${campaign.id}`,
      kind: 'POLL_HONOUR' as const,
      cycle: state.clock.cycle,
      eventId: campaign.eventId,
      volume: 0.45,
      warmth: input.response === 'BACK' ? 0.8 : -0.4,
      credibility: input.response === 'BACK' ? 0.3 : 0.6,
      summary: `${option.label}: ${campaign.title}`,
    }].slice(-S.historyCap.actions),
  }));

  const ctx = postRenderContext(next, input.registry ?? null, state.clock.cycle);
  const rng = new Rng(`${state.seed}:campaign:${campaign.id}:${input.response}`);
  const club = next.clubs[state.playerClubId];
  const posts: SocialPost[] = [];
  if (club) {
    const hook = {
      trigger: input.response === 'BACK' ? 'CAMPAIGN_BACKED' : 'CAMPAIGN_REFUSED',
      sourceEventId: campaign.eventId,
      rootEventId: campaign.eventId,
      depth: 0,
      importance: 3 as const,
      sentiment: input.response === 'BACK' ? 0.6 : -0.5,
      tokens: {
        club: clubToken(club.name),
        campaign: campaign.title,
        group: SUPPORTER_GROUPS[Math.abs(hash(state.seed)) % SUPPORTER_GROUPS.length] ?? SUPPORTER_GROUPS[0]!,
        ...(campaign.playerId && next.players[campaign.playerId]
          ? { player: personToken(next.players[campaign.playerId]?.displayName ?? '') } : {}),
      },
      facts: { kind: campaign.kind, support: campaign.support, backed: input.response === 'BACK' },
      entities: [{ kind: 'club' as const, id: club.id, name: club.name }],
      clubId: club.id,
      audiences: ['FAN' as const],
      tags: ['fans', 'campaign'],
      cycle: state.clock.cycle,
    };
    const personas = rng.fork('persona').sample(FAN_PERSONAS, 2);
    personas.forEach((persona, index) => {
      const post = renderPost(ctx, rng.forkSequential('camp', index), {
        id: `sp_camp_${campaign.id}_${index}`.toLowerCase(),
        author: {
          kind: 'FAN',
          name: persona,
          handle: `@${persona.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${club.abbreviation.toLowerCase()}`,
          avatarSeed: seedFrom('fan', persona, club.abbreviation),
          verified: false,
          reach: Math.round(clamp(club.fans.onlineFollowers * S.fanReachFromFollowers, S.fanReachFloor, S.fanReachCeiling) * 1.5),
        },
        hook,
        facts: { backed: input.response === 'BACK', kind: campaign.kind },
        sentiment: input.response === 'BACK' ? 0.7 : -0.6,
        extraTags: ['campaign-reaction'],
      });
      if (post) posts.push(post);
    });
    next = appendPosts(next, posts);
  }

  return { state: next, ok: true, effect: option.effect, posts, events: applied.events };
}

/* --- fan of the week ------------------------------------------------------ */

const FAN_REASONS: readonly string[] = [
  'Four hundred miles on a Tuesday night for a goalless draw, and was singing at the end of it.',
  'Has not missed a home game since the ground had a terrace at one end.',
  'Took her grandson to his first away game and spent the whole ninety minutes explaining the offside rule.',
  'Ran the supporters’ coach for eleven years and has never once put his own name on the list.',
  'Held a hand-painted sign up for the entire second half. Nobody could read it. Everybody appreciated it.',
  'Drove three of the away support home after the last train went, and refused the petrol money.',
  'Has been posting the same optimistic prediction every week for six years and has been right twice.',
  'Learned every player’s name in a fortnight after moving to the city, which is more than some of the squad managed.',
  'Sat through the whole of that in the rain, and was first back through the turnstile the following week.',
  'Started the song that the entire lower tier is now singing without knowing where it came from.',
  'Brought a flask of tea for the steward who has stood on that gate for thirty years.',
  'Cycled from two towns over because the trains were off, and made kick-off with a minute to spare.',
];

/** Pick somebody out of the crowd. Cheap, kind, and disproportionately liked. */
export function chooseFanOfTheWeek(state: GameState, rng: Rng, cycle: number): FanOfTheWeek | null {
  const world = socialWorld(state);
  if (world.fanOfTheWeek.some((f) => f.cycle === cycle)) return null;
  const moments = socialMoments(state, { windowCycles: 1, limit: 6 });
  const moment = moments[0];
  if (!moment) return null;
  const recentNames = new Set(world.fanOfTheWeek.slice(-S.fanOfTheWeekRepeatWindow).map((f) => f.name));
  const recentReasons = new Set(world.fanOfTheWeek.slice(-S.fanOfTheWeekRepeatWindow).map((f) => f.reason));
  const namePool = FAN_PERSONAS.filter((n) => !recentNames.has(n));
  const reasonPool = FAN_REASONS.filter((r) => !recentReasons.has(r));
  const name = rng.fork('name').pick(namePool.length > 0 ? namePool : FAN_PERSONAS);
  const reason = rng.fork('reason').pick(reasonPool.length > 0 ? reasonPool : FAN_REASONS);
  const club = state.clubs[state.playerClubId];
  return {
    cycle,
    name,
    handle: `@${name.toLowerCase().replace(/[^a-z0-9]/g, '').slice(0, 12)}${club?.abbreviation.toLowerCase() ?? ''}`,
    reason,
    eventId: moment.eventId,
    avatarSeed: seedFrom('fanoftheweek', name, String(cycle)),
  };
}

/** How the supporters currently see the relationship, in one sentence. */
export function trustSummary(state: GameState): { value: number; label: string; blurb: string } {
  const trust = socialWorld(state).supportersTrust;
  if (trust >= 80) {
    return {
      value: Math.round(trust), label: 'Trusted',
      blurb: 'The organised support will give you the benefit of the doubt before they give it to anybody else.',
    };
  }
  if (trust >= 60) {
    return {
      value: Math.round(trust), label: 'Onside',
      blurb: 'They think you are straight with them. That survives about three bad weeks.',
    };
  }
  if (trust >= 40) {
    return {
      value: Math.round(trust), label: 'Watchful',
      blurb: 'Nothing has gone wrong and nothing has been earned. They are waiting.',
    };
  }
  if (trust >= 22) {
    return {
      value: Math.round(trust), label: 'Sceptical',
      blurb: 'They have stopped assuming the best. Anything you ask for now costs something.',
    };
  }
  return {
    value: Math.round(trust), label: 'Lost',
    blurb: 'They do not believe a word of it. Meetings are held without you and the banners are already painted.',
  };
}

export const POLL_TEMPLATE_COUNT = POLL_DEFS.length;
export const CAMPAIGN_TEMPLATE_COUNT = CAMPAIGN_DEFS.length;
