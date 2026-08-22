import type { ClubId, CreatorId, PlayerId } from '../core/brand';
import type { IdentityKind } from '../licensing/identity';

/**
 * Creators are first-class entities, not a cosmetic layer on players.
 *
 * A creator can hold several roles at once (a player who is also the club's
 * biggest media asset), and their attributes feed a completely different set of
 * systems from footballing ability: fans, sponsorship, media, social reach.
 */
export const CREATOR_ROLES = [
  'PLAYER', 'MANAGER', 'INFLUENCER', 'CLUB_PERSONALITY', 'PUNDIT', 'OWNER',
] as const;
export type CreatorRole = (typeof CREATOR_ROLES)[number];

export const CREATOR_ATTRIBUTE_KEYS = [
  'audience',        // fans: baseline reach, drives social impressions
  'engagement',      // social: reply/like rate -> conversion to club followers
  'charisma',        // negotiation, media handling, squad morale
  'controversy',     // media: story volatility; high = more reach, more risk
  'brandValue',      // economy: sponsor tier unlocked
  'loyalty',         // world: resistance to poaching by rival clubs
  'leadership',      // squad: morale spread when embedded in a team
  'entertainment',   // fans: matchday sentiment gain from creator moments
  'mediaAbility',    // media: how well press conferences land
  'fanConversion',   // fans: % of audience that becomes actual club support
  'commercialAppeal',// economy: merch multiplier
] as const;
export type CreatorAttributeKey = (typeof CREATOR_ATTRIBUTE_KEYS)[number];
export type CreatorAttributes = Record<CreatorAttributeKey, number>;

export const CREATOR_ATTRIBUTE_LABELS: Record<CreatorAttributeKey, string> = {
  audience: 'Audience', engagement: 'Engagement', charisma: 'Charisma',
  controversy: 'Controversy', brandValue: 'Brand Value', loyalty: 'Loyalty',
  leadership: 'Leadership', entertainment: 'Entertainment', mediaAbility: 'Media Ability',
  fanConversion: 'Fan Conversion', commercialAppeal: 'Commercial Appeal',
};

export const CREATOR_TIERS = ['LOCAL', 'RISING', 'ESTABLISHED', 'MAJOR', 'GLOBAL'] as const;
export type CreatorTier = (typeof CREATOR_TIERS)[number];

/** Follower bands per tier, used for display and for sponsor eligibility. */
export const TIER_REACH: Record<CreatorTier, readonly [number, number]> = {
  LOCAL: [5_000, 50_000],
  RISING: [50_000, 400_000],
  ESTABLISHED: [400_000, 2_000_000],
  MAJOR: [2_000_000, 10_000_000],
  GLOBAL: [10_000_000, 60_000_000],
};

export interface CreatorContentStyle {
  /** Drives the tone of generated posts. */
  readonly tone: 'HYPE' | 'ANALYTICAL' | 'COMEDIC' | 'PROVOCATIVE' | 'WHOLESOME' | 'DRAMATIC';
  readonly platforms: readonly ('SHORTFORM' | 'LONGFORM' | 'STREAM' | 'PODCAST' | 'TEXT')[];
  readonly postingFrequency: number;
}

export interface Creator {
  readonly id: CreatorId;
  readonly identityKind: IdentityKind;
  readonly sourcePackId?: string;
  readonly handle: string;
  readonly displayName: string;
  readonly roles: readonly CreatorRole[];
  readonly tier: CreatorTier;
  readonly followers: number;
  readonly attributes: CreatorAttributes;
  readonly style: CreatorContentStyle;
  readonly clubId: ClubId | null;
  /** Set when this creator also exists as a squad member. */
  readonly playerId: PlayerId | null;
  /** -100..100 opinion of the player's club; drives whether they hype or dunk. */
  readonly clubSentiment: number;
  readonly marketValue: number;
  /** Cycles remaining on their association with the club, if any. */
  readonly dealWeeksRemaining: number | null;
  /**
   * Season this creator entered the world, set only on life-cycle spawns.
   * Authored roster members carry no stamp and are never aged out.
   */
  readonly spawnedSeason?: number;
  readonly avatarSeed: string;
  readonly bio: string;
}

export const creatorReach = (c: Creator): number =>
  Math.round(c.followers * (0.4 + (c.attributes.engagement / 100) * 1.2));

export const emptyCreatorAttributes = (fill = 50): CreatorAttributes =>
  Object.fromEntries(CREATOR_ATTRIBUTE_KEYS.map((k) => [k, fill])) as CreatorAttributes;


/* --- creator operations --------------------------------------------------- */

/**
 * Re-exported from the creator entity module so the whole creator surface —
 * the roster, briefs, feuds, departures and the balance table behind them — is
 * reachable wherever `Creator` itself is.
 */
export * from './balance';
export * from './campaigns';
