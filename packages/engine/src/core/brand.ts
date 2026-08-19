/**
 * Branded primitive types. These exist purely at the type level: they cost
 * nothing at runtime but make it impossible to pass a ClubId where a PlayerId
 * is expected — the single most common class of bug in a system with this many
 * cross-referencing entities.
 */
declare const brand: unique symbol;
export type Brand<T, B extends string> = T & { readonly [brand]: B };

export type PlayerId = Brand<string, 'PlayerId'>;
export type CreatorId = Brand<string, 'CreatorId'>;
export type ClubId = Brand<string, 'ClubId'>;
export type ManagerId = Brand<string, 'ManagerId'>;
export type MatchId = Brand<string, 'MatchId'>;
export type FixtureId = Brand<string, 'FixtureId'>;
export type SeasonId = Brand<string, 'SeasonId'>;
export type ContractId = Brand<string, 'ContractId'>;
export type TransferId = Brand<string, 'TransferId'>;
export type NegotiationId = Brand<string, 'NegotiationId'>;
export type SponsorId = Brand<string, 'SponsorId'>;
export type SponsorDealId = Brand<string, 'SponsorDealId'>;
export type FacilityId = Brand<string, 'FacilityId'>;
export type RivalryId = Brand<string, 'RivalryId'>;
export type StoryId = Brand<string, 'StoryId'>;
export type PostId = Brand<string, 'PostId'>;
export type ObjectiveId = Brand<string, 'ObjectiveId'>;
export type RewardId = Brand<string, 'RewardId'>;
export type TransactionId = Brand<string, 'TransactionId'>;
export type OfferId = Brand<string, 'OfferId'>;
export type EventId = Brand<string, 'EventId'>;
export type ContentPackId = Brand<string, 'ContentPackId'>;
export type LicenseId = Brand<string, 'LicenseId'>;
export type TraitId = Brand<string, 'TraitId'>;
export type CompetitionId = Brand<string, 'CompetitionId'>;
export type SaveId = Brand<string, 'SaveId'>;

/** Escape hatch used only by id factories and deserialisers. */
export const asId = <T extends string>(raw: string): T => raw as T;
