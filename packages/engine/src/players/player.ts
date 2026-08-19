import type { ClubId, ContractId, PlayerId } from '../core/brand';
import type { Attributes } from './attributes';
import type { MentalProfile } from './mental';
import type { Position } from './positions';
import type { IdentityKind } from '../licensing/identity';

export type InjurySeverity = 'KNOCK' | 'MINOR' | 'MODERATE' | 'SERIOUS' | 'SEASON';

export interface InjuryState {
  readonly severity: InjurySeverity;
  readonly weeksRemaining: number;
  readonly description: string;
  readonly sustainedCycle: number;
}

/** Progressive-disclosure scouting. The player sees a range until they invest. */
export interface ScoutingKnowledge {
  /** 0 = unscouted (broad range shown), 1 = fully known (exact values shown). */
  readonly confidence: number;
  readonly reportCycle?: number;
  /** Attribute keys revealed exactly, for partial reports. */
  readonly revealed: readonly string[];
}

export interface PlayerForm {
  /** -1 .. +1 rolling form. Drives commentary, selection advice and value drift. */
  readonly rating: number;
  /** Ratings from recent appearances, newest last. */
  readonly recentRatings: readonly number[];
  readonly appearances: number;
  readonly goals: number;
  readonly assists: number;
  readonly cleanSheets: number;
  readonly yellowCards: number;
  readonly redCards: number;
  readonly minutes: number;
}

export interface SeasonStats extends PlayerForm {
  readonly season: number;
  readonly clubId: ClubId | null;
  readonly averageRating: number;
  readonly motm: number;
}

export interface Player {
  readonly id: PlayerId;
  readonly identityKind: IdentityKind;
  /** Present only for entities sourced from a content pack. */
  readonly sourcePackId?: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly displayName: string;
  readonly shirtNumber: number | null;
  readonly age: number;
  readonly nationality: string;
  readonly position: Position;
  readonly secondaryPositions: readonly Position[];
  readonly footedness: 'left' | 'right' | 'both';
  readonly height: number;

  readonly attributes: Attributes;
  readonly mental: MentalProfile;
  readonly traitIds: readonly string[];

  /** Current position-weighted overall. Recomputed whenever attributes change. */
  readonly overall: number;
  /** Ceiling this player can reach. Hidden behind scouting confidence in the UI. */
  readonly potential: number;

  readonly clubId: ClubId | null;
  readonly contractId: ContractId | null;

  /** 0-100. Distinct from stamina: this is match-to-match freshness. */
  readonly fitness: number;
  readonly injury: InjuryState | null;
  readonly suspensionMatches: number;

  readonly form: PlayerForm;
  readonly history: readonly SeasonStats[];

  /** Cached valuation, refreshed by the transfer market each cycle. */
  readonly marketValue: number;
  readonly reputation: number;

  readonly scouting: ScoutingKnowledge;
  /** Set when this player is also a creator entity. */
  readonly creatorId?: string;
  readonly portraitSeed: string;
}

export const isAvailable = (p: Player): boolean =>
  p.injury === null && p.suspensionMatches === 0;

export const fullName = (p: Player): string => `${p.firstName} ${p.lastName}`;

export const emptyForm = (): PlayerForm => ({
  rating: 0, recentRatings: [], appearances: 0, goals: 0, assists: 0,
  cleanSheets: 0, yellowCards: 0, redCards: 0, minutes: 0,
});
