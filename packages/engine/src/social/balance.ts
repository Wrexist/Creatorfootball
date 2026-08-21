/**
 * Social feed tuning.
 *
 * The feed's job is to make the player feel watched. Engagement numbers are
 * therefore *derived* — from the author's real reach and the event's real
 * stakes — with only a narrow random band on top. A feed where a nobody's post
 * about a 0-0 draw gets 400k likes destroys the illusion immediately.
 */
export const SOCIAL_BALANCE = {
  /** Posts generated per cycle before weighting trims the tail. */
  maxPostsPerCycle: 18,
  /** Hooks considered per cycle, highest importance first. */
  maxHooksPerCycle: 18,
  /**
   * Hooks per *trigger* per cycle. A matchweek produces the same trigger six
   * times over (six defeats, six wins); without a cap they spend the entire
   * hook budget and the feed only ever speaks about results.
   */
  maxHooksPerTrigger: 3,
  /**
   * Posts per trigger in the final feed. The hook budget can be spent evenly
   * and still end up concentrated, because the last step trims by weight and
   * weight tracks importance; this keeps the trim honest.
   */
  maxPostsPerTrigger: 4,
  antiRepeatCycles: 2,
  /**
   * Hard anti-repetition window, in cycles. Inside it a template — and the text
   * it rendered — is not a candidate while any alternative exists. This is the
   * rule that stops a five-line pool reading like one line.
   */
  hardRepeatCycles: 7,

  /** Authors per hook, by importance (index 0 unused). */
  fanCountByImportance: [0, 1, 1, 2, 3, 4] as const,
  creatorCountByImportance: [0, 0, 1, 1, 2, 3] as const,
  rivalCountByImportance: [0, 0, 0, 1, 1, 2] as const,
  /**
   * Importance at or above which each voice weighs in.
   *
   * These were the quietest reason a third of the authored library was
   * unreachable: most of the world's news is importance 2, and a gate at 3
   * meant every `@MEDIA` and `@PLAYER` line written for an ordinary week could
   * never be selected. Importance 1 — a single attribute ticking up — is still
   * below all of them, which is the distinction that was actually wanted.
   */
  sponsorImportance: 3,
  clubImportance: 2,
  playerImportance: 2,
  mediaImportance: 2,

  /** Base like rate against author reach. */
  baseEngagementRate: 0.011,
  /** Importance multiplier: 1 + (importance - 2) * this. */
  importanceEngagement: 0.5,
  /** Strong feelings travel further. */
  sentimentEngagement: 0.45,
  /** Random band on engagement — texture only, never the main signal. */
  jitter: [0.9, 1.12] as const,
  repostRatio: 0.21,
  replyRatio: 0.11,
  /** Negative posts attract arguments. */
  negativeReplyBoost: 1.3,

  /** Reach by author kind, before club/creator specifics. */
  fanReachFromFollowers: 0.0009,
  fanReachFloor: 140,
  fanReachCeiling: 24_000,
  sponsorReach: 260_000,
  playerReachPerReputation: 7_400,

  /**
   * Feed weight: importance is dominant, engagement is the tiebreak. Tuned so
   * that a big moment from a huge account lands near 90 rather than saturating
   * at 100 — the UI needs the top of the range to stay distinguishable.
   */
  weightPerImportance: 12,
  weightPerEngagementDecade: 4.5,
  kindWeightBonus: { CLUB: 6, MEDIA: 4, PLAYER: 6, CREATOR: 3, RIVAL: 2, FAN: 0, SPONSOR: -2, LEAK: 4 } as const,

  /** Sentiment gap between two creators that starts an argument. */
  debateSentimentGap: 0.75,
  maxDebatesPerCycle: 2,
  /** A quote-post rides on the original's reach. */
  quoteReachShare: 0.55,

  /** Leaks are semi-reliable by design; this is the credibility band. */
  leakCredibility: [0.45, 0.85] as const,

  /** Impressions modelling for reach reporting. */
  impressionsPerLike: 26,
  impressionsPerRepost: 90,
  /** Follower conversion from positive and negative impressions. */
  followerGainPerImpression: 0.00035,
  followerLossPerImpression: 0.00014,

  /** See the media engine: authored content leads, built-ins fill the gaps. */
  builtInWeightWithPack: 0.25,

  retention: 180,
} as const;

/** Fictional supporter personas; combined with a club tag to form a handle. */
export const FAN_PERSONAS: readonly string[] = [
  'Terrace Tam', 'BackPostBecca', 'Half & Half Harry', 'Ultra Nine', 'ConcourseKid',
  'Sensible Steve', 'Doom Merchant', 'Second Yellow Sam', 'The Optimist', 'Row Z Rita',
  'Pie & Bovril', 'Away End Ade', 'Season Ticket Sol', 'Offside Trap Ola', 'Nervy Nadia',
  'Tifo Tom', 'Corner Flag Cal', 'Matchgoing Mo', 'Stand H Sian', 'Turnstile Tariq',
  'Late Winner Lou', 'Old Main Stand', 'Bobble Hat Bo', 'Full Time Whistle',
];

/** Placeholder sponsor accounts used when no deal-specific brand is supplied. */
export const SPONSOR_ACCOUNTS: readonly { name: string; handle: string }[] = [
  { name: 'Voltbrew', handle: '@voltbrew' },
  { name: 'Northpath Athletic', handle: '@northpath' },
  { name: 'Ninety Minute Bank', handle: '@ninetyminute' },
  { name: 'Kitform', handle: '@kitform' },
];

/**
 * Player agency tuning.
 *
 * The feed stopped being something the player watches and became something
 * they do, which introduces a whole class of failure the read-only feed could
 * not have: a set of choices where one is simply better. Every number below
 * exists to keep the five tones genuinely different rather than ranked — each
 * buys something and costs something, and the size of both is set here.
 */
export const SOCIAL_ACTION_BALANCE = {
  /**
   * Posts the club may publish in a matchweek before the audience tunes out.
   * Not a lock and not a currency: reach falls off per extra post inside the
   * same cycle, and past the cap the club is simply talking to itself.
   */
  postsPerCycle: 3,
  /** Reach multiplier for the 1st, 2nd and 3rd post of a cycle. */
  postFatigue: [1, 0.62, 0.34] as const,

  /**
   * Base reach of a club post, as a share of the club's own following. A club
   * account does not reach everyone who follows it, and never has.
   */
  clubPostReachShare: 0.42,
  /** The manager speaks to a smaller room but is quoted more often. */
  managerPostReachShare: 0.26,
  managerQuoteBonus: 1.35,

  /**
   * Per-tone effects, applied to a base magnitude scaled by the moment's
   * importance. Read this table as the design: HYPE buys excitement and spends
   * credibility, CLASSY is quiet and safe, PROVOCATIVE is the loudest and the
   * only one that can lose you the room, FUNNY converts followers but is
   * dismissed by the press, DEFIANT rallies the dressing room and annoys
   * everyone outside it.
   */
  tone: {
    HYPE: {
      reach: 1.15, fanSentiment: 1.6, fanExcitement: 2.6, squadMorale: 1.1,
      rivalryHeat: 0.6, mediaGoodwill: -0.6, trust: 0.2,
      warmth: 0.5, credibility: -0.25, volume: 0.7, stake: 0.5,
    },
    CLASSY: {
      // Deliberately deflationary. A measured line lowers the temperature in the
      // ground as well as in the press room — that is what it costs, and without
      // a cost the safe option would simply be the correct one every week.
      reach: 0.82, fanSentiment: 0.9, fanExcitement: -0.95, squadMorale: 0.9,
      rivalryHeat: -0.4, mediaGoodwill: 2.2, trust: 1.4,
      warmth: 0.6, credibility: 0.6, volume: 0.3, stake: 0.15,
    },
    PROVOCATIVE: {
      reach: 1.75, fanSentiment: 1.1, fanExcitement: 2.2, squadMorale: 0.6,
      rivalryHeat: 5.5, mediaGoodwill: -2.6, trust: -0.4,
      warmth: -0.7, credibility: -0.1, volume: 1, stake: 1,
    },
    FUNNY: {
      reach: 1.45, fanSentiment: 1.3, fanExcitement: 1.4, squadMorale: 0.7,
      rivalryHeat: 1.8, mediaGoodwill: -1, trust: 0.7,
      warmth: 0.15, credibility: -0.45, volume: 0.75, stake: 0.4,
    },
    DEFIANT: {
      reach: 1.2, fanSentiment: 0.7, fanExcitement: 1.2, squadMorale: 2.4,
      rivalryHeat: 2.6, mediaGoodwill: -1.5, trust: 0.9,
      warmth: -0.15, credibility: 0.3, volume: 0.85, stake: 0.8,
    },
  } as const,

  /** Base world-delta magnitude before the tone table and importance scale it. */
  baseDelta: 1.15,
  /** Importance 1-5 becomes this multiplier band on every delta a post causes. */
  importanceScale: [0, 0.5, 0.8, 1.1, 1.5, 2] as const,

  /**
   * Talking before a match opens a stake. This is the whole reason silence is
   * a move: the reward for calling it and winning is real, and so is the bill
   * for calling it and losing.
   */
  stake: {
    /** Tones at or above this stake weight open a pre-match stake at all. */
    minimumWeight: 0.45,
    /** Fan sentiment swing on settlement, scaled by the stake weight. */
    fanSentimentWin: 7,
    fanSentimentLoss: -9,
    /** Losing after talking is worse than losing quietly. That gap is this. */
    squadMoraleLoss: -5,
    squadMoraleWin: 4,
    rivalryOnLoss: 5,
    rivalryOnWin: 3,
    /** Standing movement recorded against the settled stake. */
    credibilityWin: 0.8,
    credibilityLoss: -0.9,
    /** A drawn match settles a stake at a fraction of either outcome. */
    drawShare: 0.35,
    /** Cycles a stake waits for its fixture before it is written off. */
    expiryCycles: 4,
  },

  /* --- reactions ------------------------------------------------------- */

  /**
   * A rival dig, a pundit's write-off or an unhappy player is a *question*.
   * Answering and not answering are both answers, so both move something.
   */
  reaction: {
    /** Sentiment below which a post about your club demands a response. */
    provokeThreshold: -0.35,
    /** Cycles a provocation stays answerable. After that it is old news. */
    windowCycles: 2,
    like: { reach: 0.05, warmth: 0.35, volume: 0.1, fanSentiment: 0.3, trust: 0.25 },
    repost: { reach: 0.35, warmth: 0.4, volume: 0.35, fanSentiment: 0.8, trust: 0.5 },
    quote: { reach: 1.5, warmth: -0.65, volume: 0.95, fanExcitement: 2, rivalryHeat: 4.5, mediaGoodwill: -1.8 },
    /**
     * Saying nothing. Costs the dressing room a little when the thing said was
     * about a player, and buys goodwill with a press that reads it as calm.
     */
    silence: { warmth: 0.1, credibility: 0.2, volume: 0, mediaGoodwill: 1.2, squadMorale: -0.8, rivalryHeat: -1.5 },
    /** Quote-dunking a *bigger* account carries further, and cuts deeper. */
    reachTransferShare: 0.55,
  },

  /* --- replies to your own people -------------------------------------- */

  reply: {
    backing: { playerMorale: 9, squadMorale: 1.6, mediaGoodwill: -2, fanSentiment: -0.6, warmth: 0.85, credibility: 0.1 },
    privateWord: { playerMorale: 5, squadMorale: 0.6, mediaGoodwill: 0.8, fanSentiment: 0, warmth: 0.35, credibility: 0.4 },
    callOut: { playerMorale: -12, squadMorale: -2.2, mediaGoodwill: 2.4, fanSentiment: 1.4, warmth: -0.85, credibility: 0.25 },
    /** A player already on the floor takes public criticism far worse. */
    lowMoraleThreshold: 35,
    lowMoraleMultiplier: 1.6,
  },

  /* --- standing --------------------------------------------------------- */

  standing: {
    /** Actions inside this window shape how the world currently talks to you. */
    windowCycles: 26,
    /** Weight decay per cycle of age, so last season is not this season. */
    decayPerCycle: 0.965,
    /** Axis value needed to be read as a definite character rather than a blank. */
    definiteAt: 0.28,
    /** Volume needed before the world considers you to have a public voice. */
    knownVolume: 3.5,
    /** Reach multiplier at the extremes of each standing. */
    reachBonus: {
      UNKNOWN: 1, BELOVED: 1.18, RESPECTED: 1.1, FEARED: 1.22, DIVISIVE: 1.3, CLOWN: 1.35,
    } as const,
    /** How much each standing damps or amplifies hostile coverage. */
    hostility: {
      UNKNOWN: 1, BELOVED: 0.78, RESPECTED: 0.85, FEARED: 1.05, DIVISIVE: 1.2, CLOWN: 1.4,
    } as const,
  },

  /* --- viral ------------------------------------------------------------ */

  /**
   * Going viral is a real mechanic, not a flourish: a post crosses out of its
   * own audience and the club keeps the followers afterwards. It is earned by
   * stakes and feeling, never rolled from nothing.
   */
  viral: {
    /** Minimum importance of the underlying event before virality is possible. */
    minImportance: 3,
    /** Base chance at importance 3 with full sentiment; scaled from there. */
    baseChance: 0.16,
    perImportance: 0.07,
    /** Strength of feeling contributes; a lukewarm post never travels. */
    sentimentWeight: 0.55,
    multiplier: [3.5, 9] as const,
    /** Follower conversion from a viral moment's extra impressions. */
    followerConversion: 0.0009,
    /** Cycles a viral moment keeps paying a smaller dividend. */
    tailCycles: 3,
    tailShare: 0.3,
  },

  /* --- milestones ------------------------------------------------------- */

  /**
   * Follower thresholds. Each one is a door, not a trophy: a bigger sponsor
   * tier, a creator who will now take your call, a better class of offer.
   */
  milestones: [
    10_000, 25_000, 50_000, 100_000, 250_000, 500_000,
    1_000_000, 2_500_000, 5_000_000, 10_000_000,
  ] as const,
  /** Cash paid on reaching a milestone, as a multiple of the threshold. */
  milestoneCashPerFollower: 0.55,
  /** Reputation granted at each milestone. */
  milestoneReputation: 1.5,

  /* --- fan community ---------------------------------------------------- */

  poll: {
    /** Cycles a poll runs for once the club opens it. */
    runsFor: 1,
    /** Cycles an offered poll stays on the table. */
    offerWindow: 2,
    /** Trust gained for running a poll at all — asking is worth something. */
    trustForRunning: 2.5,
    /** Trust gained for doing what the vote said. */
    trustForHonouring: 6,
    /** Trust lost for asking and then ignoring the answer. Worse than not asking. */
    trustForOverruling: -9,
    /** Trust lost for letting an offered poll lapse without a word. */
    trustForDeclining: -1.5,
    /** Turnout band, as a share of online followers. */
    turnout: [0.03, 0.11] as const,
    /** How lopsided a poll can get. Real polls are rarely 50/50. */
    leadBand: [0.34, 0.72] as const,
  },

  campaign: {
    /** Fan sentiment below which the support starts organising against you. */
    unrestSentiment: 38,
    /** Fan sentiment above which they organise *for* you. */
    celebrationSentiment: 72,
    /** Cycles a campaign stays live before it fades. */
    lifespan: 4,
    /** Trust for meeting a campaign; scaled by how much support it had. */
    trustForBacking: 7,
    trustForRefusing: -4,
    trustForIgnoring: -2.5,
    /** Backing a protest costs the board's patience, expressed as reputation. */
    reputationForBacking: -0.8,
    /** Maximum campaigns live at once, so the screen is never a to-do list. */
    maxLive: 3,
  },

  /** Supporters' trust drifts back toward this when nothing is happening. */
  trustResting: 55,
  trustDriftRate: 0.06,
  /** Media goodwill drifts back to neutral at this rate per cycle. */
  goodwillResting: 50,
  goodwillDriftRate: 0.09,

  /* --- press ------------------------------------------------------------ */

  press: {
    /** Questions in a conference. Three is a beat; five is a form. */
    questions: 3,
    /** Cycles a conference stays answerable before the moment passes. */
    windowCycles: 1,
    /** Skipping a conference entirely. Cheap once, expensive as a habit. */
    skipGoodwill: -6,
    skipTrust: -1.5,
    /** Manager mediaHandling 0-100 scaled by this softens every downside. */
    handlingSoftening: 0.45,
    /** Manager mediaAbility raises the upside of a well-judged answer. */
    handlingUpside: 0.35,
    /** Goodwill above/below neutral shifts published media sentiment by up to this. */
    goodwillSentimentSwing: 0.3,
  },

  /* --- trends and the weekly show --------------------------------------- */

  trending: {
    /** Topics surfaced per cycle. */
    slots: 6,
    /** Cycles a topic can draw on. */
    windowCycles: 2,
    /** Weight a topic gets per unit of post engagement, log-scaled. */
    engagementWeight: 1.4,
    importanceWeight: 2.6,
    /** A topic needs this much score before it is worth naming. */
    floor: 3,
  },

  show: {
    /** Segments in the weekly round-up. */
    segments: 4,
    /** Rating floor and ceiling. */
    ratingRange: [1, 10] as const,
  },

  pundit: {
    /** Cycles a thesis stands before he is made to pick a new one. */
    thesisLife: 8,
    /** Stance movement when a result backs him or embarrasses him. */
    provenSwing: 9,
    disprovenSwing: -12,
    /** Stance drifts toward the club's actual form at this rate. */
    formPull: 0.18,
  },

  rumour: {
    /** Rumours retained. */
    retention: 14,
    credibility: [0.28, 0.86] as const,
    /** Cycles before a rumour is judged true or false by what happened. */
    resolveAfter: 3,
  },
} as const;

/**
 * Fictional creator-economy platforms.
 *
 * Every identity in this game is invented. These are the surfaces the world
 * posts on, named so the feed can say where something happened without ever
 * reaching for a real platform's name.
 */
export const PLATFORMS: readonly {
  readonly id: string;
  readonly name: string;
  readonly kind: 'SHORTFORM' | 'LONGFORM' | 'STREAM' | 'PODCAST' | 'TEXT';
  readonly blurb: string;
}[] = [
  { id: 'loop', name: 'Loop', kind: 'SHORTFORM', blurb: 'Vertical clips. Where a goal becomes a meme by Sunday.' },
  { id: 'reel', name: 'Reelhouse', kind: 'LONGFORM', blurb: 'Twenty-minute documentaries nobody was asked for.' },
  { id: 'stanza', name: 'Stanza', kind: 'TEXT', blurb: 'Short posts, long arguments.' },
  { id: 'floodlight', name: 'Floodlight', kind: 'STREAM', blurb: 'Live watch-alongs and post-match meltdowns.' },
  { id: 'backpage', name: 'Back Page', kind: 'PODCAST', blurb: 'Two hours a week, mostly about one refereeing decision.' },
  { id: 'terrace', name: 'Terrace', kind: 'TEXT', blurb: 'Supporter forums that predate all of this and outlive all of it.' },
];

/** Fictional supporter-group names for campaigns and the trust. */
export const SUPPORTER_GROUPS: readonly string[] = [
  'The Ninety-Fourth Minute', 'Block J', 'The Old Turnstile Union', 'Away Days Collective',
  'The Standing Section', 'Founders Trust', 'The Late Kick-Off Club', 'Concourse Committee',
];

/** Fictional pundits with running opinions about your club. */
export const PUNDITS: readonly { name: string; handle: string; blurb: string }[] = [
  { name: 'Roland Vex', handle: '@rolandvex', blurb: 'Played four hundred games and mentions it in all of them.' },
  { name: 'Della Marchbank', handle: '@dmarchbank', blurb: 'Reads the numbers, and reads them out slowly.' },
  { name: 'Cormac Teale', handle: '@cteale', blurb: 'Believes every club is one bad month from a crisis.' },
  { name: 'Ines Fallowfield', handle: '@inesfallow', blurb: 'The only pundit who watches the whole second half.' },
  { name: 'Bram Otway', handle: '@bramotway', blurb: 'Certain about everything, right about a third of it.' },
];

/** Fictional brands used for creator brand deals and sponsored drops. */
export const BRAND_PARTNERS: readonly { name: string; sector: string; fee: number }[] = [
  { name: 'Voltbrew', sector: 'Energy drink', fee: 34_000 },
  { name: 'Kitform', sector: 'Teamwear', fee: 41_000 },
  { name: 'Ninety Minute Bank', sector: 'Banking', fee: 78_000 },
  { name: 'Northpath Athletic', sector: 'Footwear', fee: 62_000 },
  { name: 'Halfpitch', sector: 'Streaming', fee: 55_000 },
  { name: 'Grainhouse Oats', sector: 'Breakfast', fee: 22_000 },
  { name: 'Ferrolane Motors', sector: 'Automotive', fee: 96_000 },
  { name: 'Sundry & Sons', sector: 'Barbers', fee: 12_000 },
];
