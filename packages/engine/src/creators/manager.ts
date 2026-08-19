import type { ClubId, ManagerId } from '../core/brand';
import type { IdentityKind } from '../licensing/identity';

export const MANAGER_ATTRIBUTE_KEYS = [
  'tacticalKnowledge',  // match sim: quality of tactical effect, AI decision quality
  'motivation',         // match sim: half-time swing, morale recovery
  'playerDevelopment',  // training: gain multiplier
  'mediaHandling',      // media: story sentiment damping
  'negotiation',        // transfers: fee and wage leverage
  'scouting',           // scouting: report confidence per cycle
  'discipline',         // squad: card rate and professionalism drift
  'riskTolerance',      // AI: how aggressive the auto-tactics get
  'adaptability',       // match sim: benefit from in-match tactical changes
  'brandBuilding',      // economy: sponsor and fan growth
] as const;
export type ManagerAttributeKey = (typeof MANAGER_ATTRIBUTE_KEYS)[number];
export type ManagerAttributes = Record<ManagerAttributeKey, number>;

export const MANAGER_ATTRIBUTE_LABELS: Record<ManagerAttributeKey, string> = {
  tacticalKnowledge: 'Tactical Knowledge', motivation: 'Motivation',
  playerDevelopment: 'Player Development', mediaHandling: 'Media Handling',
  negotiation: 'Negotiation', scouting: 'Scouting', discipline: 'Discipline',
  riskTolerance: 'Risk Tolerance', adaptability: 'Adaptability', brandBuilding: 'Brand Building',
};

/**
 * Archetypes are data. Each grants and costs something real — there is no
 * strictly-best pick, which is the point.
 */
export interface ManagerArchetype {
  readonly id: string;
  readonly name: string;
  readonly tagline: string;
  readonly description: string;
  /** Deltas applied to a 50-baseline attribute spread. */
  readonly modifiers: Partial<Record<ManagerAttributeKey, number>>;
  /** What this costs you, stated plainly in the UI. */
  readonly strength: string;
  readonly weakness: string;
  readonly accent: string;
}

export interface ManagerAppearance {
  readonly skinTone: number;
  readonly hairStyle: string;
  readonly hairColor: string;
  readonly facialHair: string;
  readonly outfit: string;
  readonly accessory: string;
  readonly accentColor: string;
}

export type MediaStyle = 'GUARDED' | 'HONEST' | 'COMBATIVE' | 'CHARMING' | 'ANALYTICAL';
export type SocialPersonality = 'QUIET' | 'ACTIVE' | 'VIRAL' | 'PROVOCATEUR';

export interface Manager {
  readonly id: ManagerId;
  readonly identityKind: IdentityKind;
  readonly name: string;
  readonly isPlayer: boolean;
  readonly archetypeId: string;
  readonly attributes: ManagerAttributes;
  readonly appearance: ManagerAppearance;
  readonly mediaStyle: MediaStyle;
  readonly socialPersonality: SocialPersonality;
  readonly clubId: ClubId | null;
  readonly reputation: number;
  readonly careerWins: number;
  readonly careerDraws: number;
  readonly careerLosses: number;
  readonly trophies: readonly { readonly competition: string; readonly season: number }[];
  readonly creatorId?: string;
  readonly bio: string;
}

export const emptyManagerAttributes = (fill = 50): ManagerAttributes =>
  Object.fromEntries(MANAGER_ATTRIBUTE_KEYS.map((k) => [k, fill])) as ManagerAttributes;
