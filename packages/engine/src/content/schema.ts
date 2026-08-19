import type { IdentityKind, RightsMetadata } from '../licensing/identity';

/**
 * Content pack schema.
 *
 * ALL game content — players, clubs, creators, sponsors, traits, facilities,
 * rules, objectives, offers — is data loaded through this one schema. The
 * fictional base pack, a future community pack and a future licensed pack are
 * the same shape; only their `kind` and rights metadata differ. This is what
 * makes licensing an additive load rather than a rewrite.
 */
export const CONTENT_PACK_VERSION = 1;

export type PackKind = 'BASE' | 'COMMUNITY' | 'LICENSED' | 'SEASONAL';

export interface ContentPackManifest {
  readonly id: string;
  readonly version: string;
  readonly schemaVersion: number;
  readonly kind: PackKind;
  readonly name: string;
  readonly description: string;
  readonly provider: string;
  readonly identityKind: IdentityKind;
  readonly rights?: RightsMetadata;
  /** Pack ids that must already be loaded. */
  readonly requires: readonly string[];
  /** Entities this pack replaces rather than adds. */
  readonly overrides: readonly string[];
  readonly regions: readonly string[];
  readonly createdAt: number;
}

export interface ContentPack {
  readonly manifest: ContentPackManifest;
  readonly data: ContentPackData;
}

export interface ContentPackData {
  readonly nameBanks?: NameBankDef;
  readonly clubs?: readonly ClubTemplate[];
  readonly players?: readonly PlayerTemplate[];
  readonly creators?: readonly CreatorTemplate[];
  readonly managers?: readonly ManagerTemplate[];
  readonly sponsors?: readonly SponsorTemplate[];
  readonly facilities?: readonly FacilityDef[];
  readonly objectives?: readonly ObjectiveTemplate[];
  readonly offers?: readonly StoreOfferDef[];
  readonly commentary?: readonly CommentaryLine[];
  readonly socialTemplates?: readonly SocialTemplate[];
  readonly mediaTemplates?: readonly MediaTemplate[];
  readonly formations?: readonly unknown[];
  readonly seasonConfig?: SeasonConfigDef;
}

export interface NameBankDef {
  readonly firstNames: readonly { value: string; weight?: number; region?: string }[];
  readonly lastNames: readonly { value: string; weight?: number; region?: string }[];
  readonly clubPrefixes: readonly string[];
  readonly clubSuffixes: readonly string[];
  readonly cities: readonly string[];
  readonly handles: readonly string[];
  readonly nationalities: readonly { code: string; name: string; weight: number }[];
}

export interface ClubTemplate {
  readonly id: string;
  readonly name: string;
  readonly shortName: string;
  readonly abbreviation: string;
  readonly city: string;
  readonly founded: number;
  readonly philosophy: string;
  readonly fanCulture: string;
  readonly reputation: number;
  readonly strength: number;
  readonly budget: number;
  readonly stadiumName: string;
  readonly stadiumCapacity: number;
  readonly visual: {
    readonly primary: string; readonly secondary: string; readonly accent: string;
    readonly badgeShape: string; readonly badgeMotif: string; readonly style: string;
    readonly kitPattern: string;
  };
  readonly aiProfileId: string;
  readonly motto: string;
  readonly rivalOf?: readonly string[];
}

export interface PlayerTemplate {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly age: number;
  readonly nationality: string;
  readonly position: string;
  readonly secondaryPositions?: readonly string[];
  readonly footedness?: 'left' | 'right' | 'both';
  readonly height?: number;
  readonly attributes: Readonly<Record<string, number>>;
  readonly mental?: Readonly<Record<string, number>>;
  readonly traitIds?: readonly string[];
  readonly potential: number;
  readonly clubTemplateId?: string;
  readonly creatorTemplateId?: string;
  readonly portraitSeed?: string;
}

export interface CreatorTemplate {
  readonly id: string;
  readonly handle: string;
  readonly displayName: string;
  readonly roles: readonly string[];
  readonly tier: string;
  readonly followers: number;
  readonly attributes: Readonly<Record<string, number>>;
  readonly style: { readonly tone: string; readonly platforms: readonly string[]; readonly postingFrequency: number };
  readonly clubTemplateId?: string;
  readonly playerTemplateId?: string;
  readonly bio: string;
  readonly avatarSeed?: string;
}

export interface ManagerTemplate {
  readonly id: string;
  readonly name: string;
  readonly archetypeId: string;
  readonly attributes?: Readonly<Record<string, number>>;
  readonly bio: string;
  readonly mediaStyle: string;
  readonly socialPersonality: string;
  readonly appearance?: Readonly<Record<string, string | number>>;
  readonly creatorTemplateId?: string;
  readonly selectable: boolean;
}

export interface SponsorTemplate {
  readonly id: string;
  readonly name: string;
  readonly sector: string;
  readonly tier: number;
  readonly slots: readonly string[];
  readonly baseValue: number;
  readonly accent: string;
  readonly requiresReputation: number;
  readonly requiresFollowers?: number;
  readonly blurb: string;
}

export interface FacilityDef {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly icon: string;
  readonly maxLevel: number;
  /** Cost of moving from level n to n+1, indexed from 0. */
  readonly upgradeCosts: readonly number[];
  readonly upgradeCycles: readonly number[];
  readonly upkeepPerCycle: readonly number[];
  /** What each level does, in one sentence each. */
  readonly levelEffects: readonly string[];
  /** Machine-readable effect: system key -> value per level. */
  readonly effects: Readonly<Record<string, readonly number[]>>;
  readonly category: 'PERFORMANCE' | 'DEVELOPMENT' | 'COMMERCIAL' | 'FAN';
}

export interface ObjectiveTemplate {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: string;
  readonly target: number | { readonly min: number; readonly max: number };
  readonly rewards: readonly { kind: string; amount: number; ref?: string; label: string }[];
  readonly durationCycles: number | null;
  readonly source: string;
  readonly importance: number;
  /** Conditions under which this objective may be offered. */
  readonly requires?: Readonly<Record<string, number | string>>;
  readonly weight: number;
}

export interface StoreOfferDef {
  readonly sku: string;
  readonly name: string;
  readonly description: string;
  readonly priceMinor: number;
  readonly currency: string;
  readonly contents: readonly { kind: string; amount: number; ref?: string; label: string }[];
  readonly startCycle: number | null;
  readonly endCycle: number | null;
  readonly purchaseLimit: number | null;
  readonly discountPercent: number;
  readonly eligibility?: Readonly<Record<string, number | string>>;
  readonly treatment: 'STANDARD' | 'FEATURED' | 'LIMITED';
  readonly accent: string;
  readonly rotationWeek?: number;
}

export interface CommentaryLine {
  readonly id: string;
  readonly eventType: string;
  /** Tokens: {player}, {club}, {opponent}, {minute}, {score}, {assist}, {creator}. */
  readonly text: string;
  readonly tone: 'NEUTRAL' | 'HYPE' | 'CRITICAL' | 'DRAMATIC' | 'WRY';
  readonly conditions?: Readonly<Record<string, number | string | boolean>>;
  readonly weight: number;
}

export interface SocialTemplate {
  readonly id: string;
  readonly trigger: string;
  readonly authorKind: string;
  readonly text: string;
  readonly sentiment: number;
  readonly weight: number;
  readonly conditions?: Readonly<Record<string, number | string | boolean>>;
  readonly tags?: readonly string[];
}

export interface MediaTemplate {
  readonly id: string;
  readonly trigger: string;
  readonly headline: string;
  readonly body: string;
  readonly outlets: readonly string[];
  readonly importance: number;
  readonly sentiment: number;
  readonly weight: number;
  readonly conditions?: Readonly<Record<string, number | string | boolean>>;
}

export interface SeasonConfigDef {
  readonly clubCount: number;
  readonly rounds: number;
  readonly matchMinutes: number;
  readonly halves: number;
  readonly squadSize: number;
  readonly playersOnPitch: number;
  readonly benchSize: number;
  readonly substitutions: number;
  readonly playoffSpots: number;
  readonly relegationSpots: number;
  readonly prizeMoney: readonly number[];
  readonly startingBudget: number;
  readonly startingWageBudget: number;
}

export type ValidationIssue = { readonly path: string; readonly message: string; readonly severity: 'error' | 'warning' };
