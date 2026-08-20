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
  /** Importance at or above which a sponsor and the club account weigh in. */
  sponsorImportance: 4,
  clubImportance: 2,
  playerImportance: 3,
  mediaImportance: 3,

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
