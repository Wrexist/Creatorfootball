import type { ClubId, CreatorId, EventId, FixtureId, PlayerId } from '../core/brand';
import type { GameState } from '../game/state';

/**
 * The social layer's own persisted state.
 *
 * Everything the *player* does in the social layer lives here: what they said,
 * who they answered, what they promised, which creators are making something,
 * which polls are open, and what the world thinks of them for all of it.
 *
 * It is attached to `GameState` by declaration merging rather than by editing
 * `game/state.ts`, for two reasons. The field is optional, so every existing
 * constructor of a `GameState` still compiles and an old save loads with an
 * empty social world rather than a migration. And it hangs off the *root*
 * rather than off `SocialState`, because the world tick rebuilds `state.social`
 * from three named fields every cycle and anything nested inside it would be
 * silently discarded on the next matchweek.
 *
 * The invariant the rest of this module is built to protect: none of this
 * state ever *invents* an event. Every entry below carries the id of the domain
 * event it hangs off, because the player can only ever react to, promise about
 * or argue over something that actually happened.
 */
declare module '../game/state' {
  interface GameState {
    /** Absent on a save written before the social layer shipped. */
    readonly socialWorld?: SocialWorldState;
  }
}

/* --- the player's voice ------------------------------------------------- */

/** The five registers the club or the manager can speak in. */
export const POST_TONES = ['HYPE', 'CLASSY', 'PROVOCATIVE', 'FUNNY', 'DEFIANT'] as const;
export type PostTone = (typeof POST_TONES)[number];

/** Who is talking. The club account and the manager carry different risk. */
export const POST_VOICES = ['CLUB', 'MANAGER'] as const;
export type PostVoice = (typeof POST_VOICES)[number];

export const PLAYER_ACTION_KINDS = [
  'POST', 'QUOTE', 'REPLY', 'LIKE', 'REPOST', 'SILENCE',
  'PRESS_ANSWER', 'POLL_RUN', 'POLL_HONOUR', 'POLL_IGNORE',
  'CAMPAIGN_GREENLIT', 'CAMPAIGN_DECLINED', 'CREATOR_BACKED', 'CREATOR_DROPPED',
] as const;
export type PlayerActionKind = (typeof PLAYER_ACTION_KINDS)[number];

/**
 * One thing the player did, and what it says about them.
 *
 * `warmth` and `credibility` are the two axes standing is built from, recorded
 * at the moment of the act rather than recomputed later — so a promise that
 * looked generous when it was made still reads as generous after it went wrong,
 * which is how reputations actually work.
 */
export interface PlayerAction {
  readonly id: string;
  readonly kind: PlayerActionKind;
  readonly cycle: number;
  /** The real domain event this act was about. Never synthesised. */
  readonly eventId: EventId;
  readonly tone?: PostTone;
  readonly voice?: PostVoice;
  /** 0..1 — how loudly this was said. A like is quiet, a quote-dunk is not. */
  readonly volume: number;
  /** -1 (cruel) .. +1 (generous). */
  readonly warmth: number;
  /** -1 (talked nonsense) .. +1 (said the true thing). */
  readonly credibility: number;
  /** Player-facing one-liner for the history surface. */
  readonly summary: string;
  readonly postId?: string;
}

/**
 * A promise with a result attached.
 *
 * This is the mechanism that makes talking before a derby a real decision:
 * the words are cheap on the day and expensive on Saturday. A stake is opened
 * when the player says something the world can later check, and settled by the
 * social tick once the fixture it was about has been played.
 */
export const STAKE_KINDS = [
  'PRE_MATCH_TALK', 'PUBLIC_BACKING', 'CALL_OUT', 'GUARANTEE', 'POLL_PROMISE',
] as const;
export type StakeKind = (typeof STAKE_KINDS)[number];

export interface SocialStake {
  readonly id: string;
  readonly kind: StakeKind;
  readonly eventId: EventId;
  readonly openedCycle: number;
  /** Settles once this cycle has been played out. */
  readonly settleAfterCycle: number;
  readonly tone: PostTone;
  /** 0..1 — how much was riding on it. Drives both the reward and the cost. */
  readonly stake: number;
  readonly claim: string;
  readonly fixtureId?: FixtureId;
  readonly opponentClubId?: ClubId;
  readonly playerId?: PlayerId;
  readonly creatorId?: CreatorId;
}

/* --- fans --------------------------------------------------------------- */

export interface PollOption {
  readonly id: string;
  readonly label: string;
  /** What honouring this option actually commits the club to. */
  readonly commitment: string;
}

export interface FanPoll {
  readonly id: string;
  readonly topic: string;
  readonly question: string;
  readonly eventId: EventId;
  readonly options: readonly PollOption[];
  readonly offeredCycle: number;
  readonly closesCycle: number;
  readonly status: 'OFFERED' | 'OPEN' | 'CLOSED' | 'DECLINED' | 'HONOURED' | 'OVERRULED';
  /** Share of the vote per option, in the same order. Set on close. */
  readonly shares?: readonly number[];
  readonly winnerId?: string;
  readonly turnout?: number;
}

export const FAN_CAMPAIGN_KINDS = [
  'BANNER', 'CHANT', 'PROTEST', 'TIFO', 'BOYCOTT_THREAT', 'TRUST_BALLOT',
  'AWAY_END_PUSH', 'FUNDRAISER', 'PLAYER_SONG',
] as const;
export type FanCampaignKind = (typeof FAN_CAMPAIGN_KINDS)[number];

/**
 * Something the supporters started on their own.
 *
 * Campaigns are *not* offered by the club — they emerge from fan sentiment and
 * from what happened — and the player's only move is whether to meet them.
 * Backing a protest costs face and buys trust; ignoring a tifo costs nothing
 * today and a little goodwill every week it stays ignored.
 */
export interface FanCampaign {
  readonly id: string;
  readonly kind: FanCampaignKind;
  readonly eventId: EventId;
  readonly title: string;
  readonly demand: string;
  readonly startedCycle: number;
  readonly expiresCycle: number;
  readonly support: number;
  readonly status: 'LIVE' | 'BACKED' | 'REFUSED' | 'IGNORED' | 'FADED';
  readonly playerId?: PlayerId;
}

/** A supporter the club singled out. Small, cheap, and disproportionately liked. */
export interface FanOfTheWeek {
  readonly cycle: number;
  readonly name: string;
  readonly handle: string;
  readonly reason: string;
  readonly eventId: EventId;
  readonly avatarSeed: string;
}

/* --- creators ----------------------------------------------------------- */

export const CAMPAIGN_FORMATS = [
  'MATCHDAY_VLOG', 'FAN_CAM', 'TACTICS_BREAKDOWN', 'TRAINING_DAY', 'MIC_UP',
  'COLLAB', 'SPONSORED_DROP', 'DOCUMENTARY', 'TRANSFER_REACTION', 'STADIUM_TOUR',
  'CHARITY_STREAM', 'DERBY_BUILD_UP',
] as const;
export type CampaignFormat = (typeof CAMPAIGN_FORMATS)[number];

/**
 * A piece of content a creator wants to make about your club.
 *
 * Every offer is briefed against a real event — a creator does not turn up
 * wanting to make "a video", they want to make the video about the 4-0. Cost
 * moves through the ledger; reach converts to followers on delivery; a drop
 * can flop, and a sponsored drop that flops costs you the sponsor's goodwill
 * as well as the money.
 */
export interface CreatorCampaign {
  readonly id: string;
  readonly creatorId: CreatorId;
  readonly format: CampaignFormat;
  readonly title: string;
  readonly brief: string;
  readonly eventId: EventId;
  readonly cost: number;
  /** Paid *to* the club by a brand, for sponsored formats. */
  readonly sponsorFee: number;
  readonly sponsorName?: string;
  readonly offeredCycle: number;
  readonly expiresCycle: number;
  readonly totalCycles: number;
  readonly cyclesRemaining: number;
  readonly projectedReach: number;
  /** 0..1 — how likely this is to land badly. Stated up front, never hidden. */
  readonly risk: number;
  readonly status: 'OFFERED' | 'RUNNING' | 'DELIVERED' | 'FLOPPED' | 'DECLINED' | 'EXPIRED';
  readonly deliveredReach?: number;
  readonly deliveredCycle?: number;
  readonly followerGain?: number;
}

/** Two creators who cannot let it go. Recurring content, and a hazard. */
export interface CreatorFeud {
  readonly id: string;
  readonly aId: CreatorId;
  readonly bId: CreatorId;
  readonly eventId: EventId;
  readonly cause: string;
  readonly heat: number;
  readonly startedCycle: number;
  readonly lastFlareCycle: number;
  readonly status: 'LIVE' | 'COOLED' | 'SETTLED';
}

export interface CreatorDeparture {
  readonly creatorId: CreatorId;
  readonly cycle: number;
  readonly reason: string;
  readonly eventId: EventId;
}

/* --- the world's commentary --------------------------------------------- */

/**
 * A pundit with a running argument about your club.
 *
 * The thesis is stated, dated and then *checked*: every week the results either
 * back him or embarrass him, and his stance moves accordingly. That is what
 * makes him a character rather than a random sentiment generator.
 */
export interface PunditStance {
  readonly name: string;
  readonly handle: string;
  readonly avatarSeed: string;
  /** -100 (writing you off) .. +100 (all in on you). */
  readonly stance: number;
  readonly thesis: string;
  readonly thesisId: string;
  readonly thesisSetCycle: number;
  readonly thesisEventId: EventId;
  readonly proven: number;
  readonly disproven: number;
}

export interface ShowSegment {
  readonly id: string;
  readonly label: string;
  readonly line: string;
  readonly tone: 'GOOD' | 'BAD' | 'NEUTRAL';
  readonly eventId?: EventId;
}

/** The weekly round-up show. Rates your week and says why. */
export interface WeeklyShow {
  readonly cycle: number;
  readonly title: string;
  readonly verdict: string;
  /** 0-10, one decimal. Derived from results, reach and the room's mood. */
  readonly rating: number;
  readonly segments: readonly ShowSegment[];
  readonly guestCreatorId?: CreatorId;
}

/** A rumour with a stated confidence, so a guess never reads as a fact. */
export interface RumourItem {
  readonly id: string;
  readonly text: string;
  readonly credibility: number;
  readonly cycle: number;
  readonly eventId: EventId;
  readonly source: string;
  readonly resolved?: 'TRUE' | 'FALSE';
}

/** A post that escaped the usual audience. Reach multiplier, and a memory. */
export interface ViralMoment {
  readonly postId: string;
  readonly eventId: EventId;
  readonly cycle: number;
  readonly multiplier: number;
  readonly reach: number;
  readonly sentiment: number;
  readonly label: string;
}

export interface PressConferenceRecord {
  readonly id: string;
  readonly cycle: number;
  readonly slot: 'PRE' | 'POST';
  readonly eventId: EventId;
  readonly answers: readonly { readonly questionId: string; readonly answerId: string }[];
  readonly headline: string;
  readonly goodwillDelta: number;
}

/* --- the whole thing ---------------------------------------------------- */

export interface SocialWorldState {
  /** Cycle the social tick last ran for. Makes the tick idempotent. */
  readonly tickedCycle: number;
  readonly actions: readonly PlayerAction[];
  readonly stakes: readonly SocialStake[];
  /** Post ids the player has already answered or deliberately let go. */
  readonly handled: readonly string[];
  readonly polls: readonly FanPoll[];
  readonly campaigns: readonly FanCampaign[];
  readonly fanOfTheWeek: readonly FanOfTheWeek[];
  readonly creatorCampaigns: readonly CreatorCampaign[];
  readonly feuds: readonly CreatorFeud[];
  readonly departures: readonly CreatorDeparture[];
  readonly pundit: PunditStance | null;
  readonly show: WeeklyShow | null;
  readonly rumours: readonly RumourItem[];
  readonly viral: readonly ViralMoment[];
  readonly conferences: readonly PressConferenceRecord[];
  /** Follower thresholds already recognised, so a milestone fires once. */
  readonly milestones: readonly number[];
  /** 0-100. Spent in press conferences, earned by candour. Damps coverage. */
  readonly mediaGoodwill: number;
  /** 0-100. What the organised support thinks of how they are treated. */
  readonly supportersTrust: number;
}

export const emptySocialWorld = (): SocialWorldState => ({
  tickedCycle: -1,
  actions: [],
  stakes: [],
  handled: [],
  polls: [],
  campaigns: [],
  fanOfTheWeek: [],
  creatorCampaigns: [],
  feuds: [],
  departures: [],
  pundit: null,
  show: null,
  rumours: [],
  viral: [],
  conferences: [],
  milestones: [],
  mediaGoodwill: 50,
  supportersTrust: 55,
});

/** The social world on a state, defaulted for saves that predate it. */
export const socialWorld = (s: GameState): SocialWorldState => s.socialWorld ?? emptySocialWorld();

/** Copy-on-write update. The only sanctioned way to change the social world. */
export const withSocialWorld = (
  s: GameState,
  patch: Partial<SocialWorldState> | ((w: SocialWorldState) => Partial<SocialWorldState>),
): GameState => {
  const current = socialWorld(s);
  const delta = typeof patch === 'function' ? patch(current) : patch;
  return { ...s, socialWorld: { ...current, ...delta } };
};
