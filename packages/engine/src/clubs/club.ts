import type { ClubId, CreatorId, ManagerId, PlayerId, RivalryId, SponsorDealId } from '../core/brand';
import type { TacticSetup } from '../tactics/tactics';

export type ClubIdentityStyle = 'CLASSIC' | 'MODERN' | 'STREET' | 'RETRO' | 'MINIMAL' | 'BOLD';
export type BadgeShape = 'SHIELD' | 'CIRCLE' | 'CREST' | 'HEX' | 'DIAMOND';
export type BadgeMotif = 'PHOENIX' | 'WOLF' | 'ANCHOR' | 'CROWN' | 'BOLT' | 'STAR' | 'LION' | 'TOWER' | 'SERPENT' | 'FLAME' | 'COMPASS' | 'HAMMER';

export interface ClubVisualIdentity {
  readonly primary: string;
  readonly secondary: string;
  readonly accent: string;
  readonly badgeShape: BadgeShape;
  readonly badgeMotif: BadgeMotif;
  readonly style: ClubIdentityStyle;
  readonly kitPattern: 'SOLID' | 'STRIPES' | 'HOOPS' | 'SASH' | 'HALVES' | 'GRADIENT';
}

/** Philosophies create genuine trade-offs; they are not cosmetic labels. */
export const CLUB_PHILOSOPHIES = [
  'YOUTH_ACADEMY', 'BIG_SPENDERS', 'DATA_DRIVEN', 'CREATOR_FIRST',
  'DEFENSIVE_ROCK', 'LOCAL_ROOTS', 'ENTERTAINERS', 'VETERAN_CORE',
] as const;
export type ClubPhilosophy = (typeof CLUB_PHILOSOPHIES)[number];

export type FanCulture = 'ULTRAS' | 'FAMILY' | 'ONLINE_NATIVE' | 'TRADITIONAL' | 'BANDWAGON' | 'DIEHARD';

export interface Stadium {
  readonly name: string;
  readonly capacity: number;
  readonly quality: number;
  readonly atmosphere: number;
  readonly pitchQuality: number;
}

export interface FanState {
  /** 0-100. The single number the player watches most closely. */
  readonly sentiment: number;
  readonly trust: number;
  readonly excitement: number;
  readonly loyalty: number;
  /** Absolute supporter count; grows and shrinks with results and creator reach. */
  readonly base: number;
  /** 0-100. Gap between what fans expect and what they are getting. */
  readonly expectation: number;
  readonly lastAttendance: number;
  readonly seasonTicketHolders: number;
  readonly onlineFollowers: number;
}

export interface ClubFinance {
  readonly wageBudgetPerCycle: number;
  readonly transferBudget: number;
  readonly ticketPrice: number;
  readonly merchPrice: number;
  /** Rolling snapshot for the finance screen; the ledger remains the source of truth. */
  readonly lastCycleIncome: number;
  readonly lastCycleExpenditure: number;
  readonly debt: number;
}

export interface ClubRecord {
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
}

export interface Club {
  readonly id: ClubId;
  readonly name: string;
  readonly shortName: string;
  readonly abbreviation: string;
  readonly city: string;
  readonly founded: number;
  readonly isPlayerClub: boolean;
  readonly visual: ClubVisualIdentity;
  readonly philosophy: ClubPhilosophy;
  readonly fanCulture: FanCulture;
  /** 0-100. Gates player interest, sponsor tier and media attention. */
  readonly reputation: number;
  readonly stadium: Stadium;
  readonly fans: FanState;
  readonly finance: ClubFinance;
  readonly managerId: ManagerId | null;
  readonly squad: readonly PlayerId[];
  readonly youthSquad: readonly PlayerId[];
  readonly creatorIds: readonly CreatorId[];
  readonly tactics: TacticSetup;
  readonly facilityLevels: Readonly<Record<string, number>>;
  readonly sponsorDealIds: readonly SponsorDealId[];
  readonly rivalryIds: readonly RivalryId[];
  /** Set for AI clubs; drives their transfer and tactical behaviour. */
  readonly aiProfileId: string | null;
  readonly seasonRecord: ClubRecord;
  readonly allTimeRecord: ClubRecord;
  readonly motto: string;
}

export const emptyRecord = (): ClubRecord => ({
  played: 0, won: 0, drawn: 0, lost: 0, goalsFor: 0, goalsAgainst: 0,
});

export const goalDifference = (r: ClubRecord): number => r.goalsFor - r.goalsAgainst;
export const points = (r: ClubRecord): number => r.won * 3 + r.drawn;

export const PHILOSOPHY_LABELS: Record<ClubPhilosophy, string> = {
  YOUTH_ACADEMY: 'Youth Academy', BIG_SPENDERS: 'Big Spenders', DATA_DRIVEN: 'Data Driven',
  CREATOR_FIRST: 'Creator First', DEFENSIVE_ROCK: 'Defensive Rock', LOCAL_ROOTS: 'Local Roots',
  ENTERTAINERS: 'Entertainers', VETERAN_CORE: 'Veteran Core',
};
