import type { CreatorTier } from './creator';
import type { CampaignFormat } from '../social/worldState';

/**
 * Creator-economy tuning.
 *
 * The research this game is built on says one thing more loudly than anything
 * else: **reach is not fandom, and fandom is not revenue.** Wrexham turned a
 * documentary into a commercial proposition, not into ticket money. Hashtag
 * United reached two million people and averaged 216 through the gate, and
 * asked to be relegated. So the conversion chain here is deliberately lossy at
 * every step — impressions become followers slowly, followers become supporters
 * slowly, and supporters are the only ones who ever spend anything.
 *
 * A creator economy that only ever grows would be a lie. Every number below has
 * a matching decay: audiences shrink when nothing is made, sentiment cools when
 * the club ignores its own creators, and a creator who has stopped believing in
 * you eventually leaves and takes their audience with them.
 */
export const CREATOR_BALANCE = {
  /* --- campaigns -------------------------------------------------------- */

  campaign: {
    /** Offers on the table at once. More than this is a spreadsheet. */
    maxOffers: 4,
    /** Live productions at once. A club cannot film everything. */
    maxRunning: 3,
    /** Cycles an offer stays on the table. */
    offerWindow: 3,
    /** Chance per cycle that a creator brings a brief at all. */
    offerChance: 0.55,
    /** Extra chance per point of club reputation above 50. */
    offerChancePerReputation: 0.004,

    /**
     * Projected reach as a share of the creator's own reach. A creator's
     * audience does not all turn up for a video about your club.
     */
    reachShare: [0.25, 0.8] as const,
    /** How far the delivered reach may miss the projection, either way. */
    deliveryBand: [0.55, 1.45] as const,
    /** Below this share of the projection, the drop is a flop. */
    flopThreshold: 0.68,

    /**
     * Impressions to followers. This is the lossiest step in the game and it
     * is meant to be: a million views is a few thousand people who care.
     */
    followerConversion: 0.0022,
    /** Multiplier on conversion from the creator's fanConversion attribute. */
    conversionPerAttribute: 0.014,

    /** Production cost as a multiple of the projected reach. */
    costPerReach: 0.021,
    /** Floor and ceiling on what a drop can cost. */
    costRange: [1_500, 420_000] as const,

    /** Fan sentiment and excitement a delivered drop is worth, per tier step. */
    fanSentimentOnDelivery: 1.1,
    fanExcitementOnDelivery: 2.2,
    fanSentimentOnFlop: -1.4,
    /** A flop costs the creator's own belief in the project. */
    creatorSentimentOnFlop: -8,
    creatorSentimentOnHit: 6,
    /** Declining a brief is not free. It is not expensive either. */
    creatorSentimentOnDecline: -4,

    /** Sponsored drops pay on delivery and cost double on a flop. */
    sponsorFeeOnFlopShare: 0.35,
  },

  /**
   * What each format is for.
   *
   * `reach` scales the projection, `cost` scales production, `risk` is the
   * stated chance it lands badly, and `cycles` is how long it takes. The shape
   * of the table is the design: a fan cam is cheap, fast and small; a
   * documentary is expensive, slow, risky and the only thing that can change
   * how the sport sees your club.
   */
  formats: {
    MATCHDAY_VLOG: { reach: 0.9, cost: 0.7, risk: 0.12, cycles: 1, reputation: 0.2, label: 'Matchday vlog' },
    FAN_CAM: { reach: 0.55, cost: 0.35, risk: 0.08, cycles: 1, reputation: 0.1, label: 'Fan cam' },
    TACTICS_BREAKDOWN: { reach: 0.7, cost: 0.6, risk: 0.14, cycles: 1, reputation: 0.5, label: 'Tactics breakdown' },
    TRAINING_DAY: { reach: 0.85, cost: 0.9, risk: 0.18, cycles: 2, reputation: 0.4, label: 'Behind the scenes' },
    MIC_UP: { reach: 1.15, cost: 1, risk: 0.3, cycles: 1, reputation: 0.3, label: 'Mic-up' },
    COLLAB: { reach: 1.5, cost: 1.3, risk: 0.22, cycles: 2, reputation: 0.6, label: 'Creator collab' },
    SPONSORED_DROP: { reach: 1, cost: 0.5, risk: 0.28, cycles: 1, reputation: -0.2, label: 'Sponsored drop' },
    DOCUMENTARY: { reach: 2.4, cost: 2.6, risk: 0.34, cycles: 4, reputation: 1.6, label: 'Documentary' },
    TRANSFER_REACTION: { reach: 1.1, cost: 0.4, risk: 0.16, cycles: 1, reputation: 0.1, label: 'Transfer reaction' },
    STADIUM_TOUR: { reach: 0.6, cost: 0.55, risk: 0.1, cycles: 1, reputation: 0.3, label: 'Ground tour' },
    CHARITY_STREAM: { reach: 1.2, cost: 0.8, risk: 0.12, cycles: 2, reputation: 1.1, label: 'Charity stream' },
    DERBY_BUILD_UP: { reach: 1.6, cost: 1.1, risk: 0.4, cycles: 1, reputation: 0.2, label: 'Derby build-up' },
  } as Readonly<Record<CampaignFormat, {
    reach: number; cost: number; risk: number; cycles: number; reputation: number; label: string;
  }>>,

  /* --- the roster ------------------------------------------------------- */

  roster: {
    /**
     * Followers the club needs before a creator of each tier will take the
     * call. This is what makes a follower milestone a door rather than a badge.
     */
    requiredFollowers: {
      LOCAL: 0, RISING: 15_000, ESTABLISHED: 90_000, MAJOR: 600_000, GLOBAL: 3_000_000,
    } as Readonly<Record<CreatorTier, number>>,
    /** Signing fee as a multiple of the creator's market value. */
    signingMultiple: 0.35,
    /** Weekly retainer as a share of the signing fee. */
    retainerShare: 0.06,
    /** Deal length offered, in cycles. */
    dealCycles: 22,
    /** Sentiment a creator starts a new deal on. */
    joiningSentiment: 35,
    /** Sentiment at or below which a creator starts looking for the exit. */
    unhappyAt: -35,
    /** Cycles a creator stays unhappy before they actually walk. */
    patienceCycles: 4,
    /** Sentiment a departure leaves behind on the rest of the roster. */
    departureContagion: -6,
  },

  /* --- how a creator's own audience moves ------------------------------- */

  audience: {
    /** Baseline drift per cycle when the creator makes nothing about you. */
    idleDecay: -0.004,
    /** Growth per cycle from a delivered campaign, as a share of followers. */
    deliveryGrowth: 0.035,
    /** Growth from the club doing well without them, they ride the wave. */
    clubFormShare: 0.006,
    /** A flop costs a creator part of their own audience. */
    flopLoss: -0.02,
    /** Feuding is good for reach and bad for everything else. */
    feudGrowth: 0.012,
    /** Ceiling on a single cycle's movement, as a share. */
    maxSwing: 0.09,
    /** Tier is re-derived from followers, so growth is legible on the card. */
    tierFloors: { LOCAL: 0, RISING: 50_000, ESTABLISHED: 400_000, MAJOR: 2_000_000, GLOBAL: 10_000_000 } as Readonly<Record<CreatorTier, number>>,
  },

  /* --- sentiment -------------------------------------------------------- */

  sentiment: {
    /** Movement per cycle toward how the club is actually doing. */
    formPull: 0.12,
    /** Being given work is the single biggest thing a creator wants. */
    perDelivery: 7,
    /** Being ignored for this many cycles starts costing sentiment. */
    neglectAfter: 5,
    perNeglectCycle: -2.4,
    /** A club that keeps winning carries even a sceptical creator. */
    perWin: 1.6,
    perLoss: -1.4,
    /** Backing a creator in public, or dropping one. */
    onBacked: 12,
    onDropped: -30,
  },

  /* --- feuds ------------------------------------------------------------ */

  feud: {
    /** Sentiment gap between two creators about the same event that starts one. */
    gap: 90,
    /** Controversy attribute needed on at least one side. */
    controversy: 58,
    /** Chance per cycle that an eligible pair actually fall out. */
    chance: 0.2,
    /** Heat a fresh feud starts on, and per flare-up. */
    startHeat: 40,
    flareHeat: 12,
    /** Heat lost per quiet cycle. */
    cooling: -7,
    /** Below this the feud is over. */
    settleBelow: 12,
    /** Live feuds at once. Two is a storyline; five is noise. */
    maxLive: 2,
    /** A feud involving a club creator costs the club a little goodwill. */
    clubGoodwill: -1.2,
    /** And is worth a lot of reach. */
    reachBonus: 1.6,
  },
} as const;

/** Every campaign format id, derived from the table so the two cannot drift. */
export const CAMPAIGN_FORMAT_IDS = Object.keys(CREATOR_BALANCE.formats) as readonly CampaignFormat[];
