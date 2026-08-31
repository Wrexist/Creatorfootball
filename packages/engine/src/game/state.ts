import type {
  ClubId, CreatorId, ManagerId, PlayerId, ContractId, SeasonId, CompetitionId,
} from '../core/brand';
import type { GameClock } from '../core/clock';
import type { AnyDomainEvent } from '../core/events';
import type { LedgerSnapshot } from '../economy/ledger';
import type { Player } from '../players/player';
import type { Creator } from '../creators/creator';
import type { Manager } from '../creators/manager';
import type { Club } from '../clubs/club';
import type { Contract } from '../contracts/contract';
import type { Competition, Fixture, Season } from '../league/types';
import type { RuleCard } from '../matches/specialRules';
import type { DecisionTrigger } from '../matches/decisions';
import type { OpponentModel } from '../simulation/opponentModel';

/**
 * The complete serialisable game state.
 *
 * Entities live in flat, id-keyed records — never nested inside one another —
 * so that a change to one player does not force a re-render of a club, and so
 * that save size stays predictable. Cross-references are always by id.
 */
export interface GameState {
  readonly version: number;
  readonly saveId: string;
  readonly seed: string;
  readonly createdAt: number;
  readonly clock: GameClock;

  readonly playerClubId: ClubId;
  readonly playerManagerId: ManagerId;

  readonly players: Readonly<Record<string, Player>>;
  readonly creators: Readonly<Record<string, Creator>>;
  readonly managers: Readonly<Record<string, Manager>>;
  readonly clubs: Readonly<Record<string, Club>>;
  readonly contracts: Readonly<Record<string, Contract>>;

  readonly competitions: Readonly<Record<string, Competition>>;
  readonly fixtures: Readonly<Record<string, Fixture>>;
  readonly seasons: Readonly<Record<string, Season>>;
  readonly currentSeasonId: SeasonId;
  readonly currentCompetitionId: CompetitionId;

  readonly ledger: LedgerSnapshot;

  readonly transfers: TransferState;
  readonly scouting: ScoutingState;
  readonly training: TrainingState;
  readonly sponsors: SponsorState;
  readonly media: MediaState;
  readonly social: SocialState;
  readonly rivalries: Readonly<Record<string, Rivalry>>;
  readonly objectives: ObjectiveState;
  /**
   * What the league has observed the player actually do. The AI counters this
   * rather than reading the player's current tactics sheet, which it has no
   * business seeing. See simulation/opponentModel.ts.
   */
  readonly opponentModel: OpponentModel;
  readonly boardPressure: BoardPressure;
  readonly decisionMemory: DecisionMemory;
  readonly decisionRecord: DecisionRecord;
  readonly legacy: LegacyState;
  readonly inventory: InventoryState;
  readonly settings: GameSettings;

  /** Bounded tail of the domain event journal, retained for the UI and history. */
  readonly eventLog: readonly AnyDomainEvent[];
  readonly idCounters: Readonly<Record<string, number>>;
  readonly analytics: AnalyticsState;
}

export interface TransferState {
  readonly listings: Readonly<Record<string, TransferListing>>;
  readonly negotiations: Readonly<Record<string, Negotiation>>;
  readonly completed: readonly CompletedTransfer[];
  readonly windowOpen: boolean;
  readonly rumours: readonly TransferRumour[];
}

export interface TransferListing {
  readonly playerId: PlayerId;
  readonly clubId: ClubId | null;
  readonly askingPrice: number;
  readonly wageDemand: number;
  readonly availability: 'AVAILABLE' | 'WANTED_BY_OTHERS' | 'RELUCTANT' | 'UNAVAILABLE';
  readonly interestedClubIds: readonly ClubId[];
  readonly listedCycle: number;
}

export type NegotiationStage =
  | 'OPENING' | 'CLUB_TALKS' | 'PLAYER_TALKS' | 'AGENT_TALKS' | 'AGREED' | 'FAILED' | 'HIJACKED';

export interface NegotiationTerms {
  readonly fee: number;
  readonly wage: number;
  readonly years: number;
  readonly role: string;
  readonly signingBonus: number;
  readonly releaseClause: number | null;
  readonly goalBonus: number;
  readonly appearanceBonus: number;
}

export interface Negotiation {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly fromClubId: ClubId | null;
  readonly toClubId: ClubId;
  readonly stage: NegotiationStage;
  readonly ourOffer: NegotiationTerms | null;
  readonly theirDemand: NegotiationTerms;
  readonly clubPatience: number;
  readonly playerPatience: number;
  readonly agentFeeDemand: number;
  readonly rivalBidders: readonly { clubId: ClubId; bid: number }[];
  readonly history: readonly { cycle: number; actor: string; text: string }[];
  readonly deadlineCycle: number;
  readonly startedCycle: number;
}

export interface CompletedTransfer {
  readonly playerId: PlayerId;
  readonly fromClubId: ClubId | null;
  readonly toClubId: ClubId;
  readonly fee: number;
  readonly cycle: number;
  readonly season: number;
}

export interface TransferRumour {
  readonly id: string;
  readonly playerId: PlayerId;
  readonly clubId: ClubId;
  readonly credibility: number;
  readonly cycle: number;
  readonly text: string;
}

export interface ScoutingState {
  readonly assignments: readonly ScoutAssignment[];
  readonly shortlist: readonly PlayerId[];
  readonly weeklyCapacity: number;
  readonly network: number;
}

export interface ScoutAssignment {
  readonly playerId: PlayerId;
  readonly cyclesRemaining: number;
  readonly depth: 'BASIC' | 'DETAILED' | 'DEEP';
  readonly startedCycle: number;
}

export interface TrainingState {
  readonly programId: string;
  readonly intensity: 'LIGHT' | 'NORMAL' | 'HARD';
  readonly individualFocus: Readonly<Record<string, string>>;
  readonly lastResults: readonly TrainingResult[];
}

export interface TrainingResult {
  readonly playerId: PlayerId;
  readonly cycle: number;
  readonly attribute: string;
  readonly delta: number;
  readonly note: string;
}

export interface SponsorState {
  readonly available: readonly SponsorOffer[];
  readonly active: readonly SponsorDeal[];
}

export interface SponsorOffer {
  readonly id: string;
  readonly sponsorId: string;
  readonly name: string;
  /** Business sector of the brand, so world copy can speak in its voice. */
  readonly sector?: string;
  readonly slot: 'SHIRT' | 'SLEEVE' | 'STADIUM' | 'TRAINING' | 'CREATOR';
  readonly valuePerCycle: number;
  readonly signingFee: number;
  readonly weeks: number;
  readonly requirements: readonly string[];
  readonly bonusCondition?: { readonly kind: string; readonly target: number; readonly reward: number };
  readonly expiresCycle: number;
  readonly accent: string;
}

export interface SponsorDeal {
  readonly id: string;
  readonly sponsorId: string;
  readonly name: string;
  /** Business sector of the brand, so world copy can speak in its voice. */
  readonly sector?: string;
  readonly slot: SponsorOffer['slot'];
  readonly valuePerCycle: number;
  readonly weeksRemaining: number;
  readonly satisfaction: number;
  readonly bonusCondition?: { readonly kind: string; readonly target: number; readonly reward: number; readonly progress: number };
}

export interface MediaState {
  readonly stories: readonly NewsStory[];
}

export interface NewsStory {
  readonly id: string;
  readonly headline: string;
  readonly body: string;
  readonly outlet: string;
  readonly cycle: number;
  readonly importance: 1 | 2 | 3 | 4 | 5;
  readonly sentiment: number;
  readonly entities: readonly { kind: string; id: string; name: string }[];
  readonly tags: readonly string[];
  readonly imageSeed?: string;
  readonly read: boolean;
}

export interface SocialState {
  readonly posts: readonly SocialPost[];
  readonly clubFollowers: number;
  readonly weeklyImpressions: number;
}

export interface SocialPost {
  readonly id: string;
  readonly kind: 'FAN' | 'CREATOR' | 'MEDIA' | 'CLUB' | 'PLAYER' | 'RIVAL' | 'SPONSOR' | 'LEAK';
  readonly authorName: string;
  readonly authorHandle: string;
  readonly avatarSeed: string;
  readonly verified: boolean;
  readonly text: string;
  readonly cycle: number;
  readonly likes: number;
  readonly reposts: number;
  readonly replies: number;
  readonly sentiment: number;
  /** Higher = rendered larger in the feed. */
  readonly weight: number;
  readonly relatedEventId?: string;
  readonly entities: readonly { kind: string; id: string; name: string }[];
  readonly quoted?: { readonly authorName: string; readonly text: string };
  readonly tags: readonly string[];
}

export interface Rivalry {
  readonly id: string;
  readonly clubAId: ClubId;
  readonly clubBId: ClubId;
  /** 0-100. Feeds atmosphere, pressure, media volume and fan reaction. */
  readonly intensity: number;
  readonly origin: string;
  readonly meetings: number;
  readonly aWins: number;
  readonly bWins: number;
  readonly draws: number;
  readonly incidents: readonly { readonly cycle: number; readonly text: string; readonly severity: number }[];
  readonly lastMeetingCycle: number | null;
}

export interface ObjectiveState {
  readonly active: readonly Objective[];
  readonly completed: readonly Objective[];
  readonly seasonTargets: readonly Objective[];
}

/**
 * The one piece of board state that cannot be honestly derived: when the last
 * ultimatum went out. Board mood itself is derived fresh every cycle by
 * progression/board.ts — storing it would let two sources of truth drift.
 */
export interface BoardPressure {
  /** Cycle the last board ultimatum was issued; null before any crisis. */
  readonly lastUltimatumCycle: number | null;
}

/**
 * Which live-decision recipes the player has answered lately. Nothing else in
 * the save records which prompts a match served — match results keep outcomes,
 * not triggers, and the event journal never sees them — so this cannot be
 * derived and must be carried forward. The decision engine uses it to stop
 * asking the same question week after week.
 */
export interface DecisionMemory {
  /** Served triggers, newest last. Bounded by `BALANCE.DECISION_MEMORY_DEPTH`. */
  readonly recentTriggers: readonly DecisionTrigger[];
}

/** The career tally of one family of the player's live calls. */
export interface DecisionTriggerTally {
  /** Graded calls served, whatever the outcome. */
  readonly served: number;
  /** Calls graded WORKED by the post-match xG evaluation. */
  readonly worked: number;
  /** Matches in which this trigger appeared at least once. */
  readonly matches: number;
}

/**
 * How every family of the player's live decisions has turned out, career to
 * date. Match results are not retained, so this cannot be derived after the
 * fact — it is folded in wherever a result is applied (see
 * `foldDecisionRecord`) and only graded calls count, because an ungraded call
 * has no honest outcome to report.
 */
export type DecisionRecord = Readonly<Partial<Record<DecisionTrigger, DecisionTriggerTally>>>;

export interface Objective {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly kind: string;
  readonly target: number;
  readonly progress: number;
  readonly rewards: readonly RewardGrant[];
  readonly expiresCycle: number | null;
  readonly status: 'ACTIVE' | 'COMPLETED' | 'FAILED' | 'CLAIMED';
  readonly source: 'SEASON' | 'DYNAMIC' | 'SPONSOR' | 'BOARD' | 'FANS';
  readonly importance: 1 | 2 | 3 | 4 | 5;
}

export interface RewardGrant {
  readonly kind: 'CASH' | 'PREMIUM' | 'RULE_CARD' | 'SCOUT_CREDIT' | 'COSMETIC' | 'FACILITY_CREDIT' | 'REPUTATION';
  readonly amount: number;
  readonly ref?: string;
  readonly label: string;
}

export interface LegacyState {
  readonly trophies: readonly { competition: string; season: number; clubId: ClubId }[];
  readonly records: Readonly<Record<string, { value: number; holderId?: string; holderName?: string; season: number }>>;
  readonly seasonSummaries: readonly SeasonSummary[];
  readonly legends: readonly { playerId: PlayerId; name: string; reason: string; season: number }[];
  readonly milestones: readonly { cycle: number; text: string; importance: number }[];
}

export interface SeasonSummary {
  readonly season: number;
  readonly position: number;
  readonly played: number;
  readonly won: number;
  readonly drawn: number;
  readonly lost: number;
  readonly goalsFor: number;
  readonly goalsAgainst: number;
  readonly topScorerId: PlayerId | null;
  readonly topScorerGoals: number;
  readonly trophies: readonly string[];
  readonly netSpend: number;
  readonly endReputation: number;
  readonly endFanSentiment: number;
}

export interface InventoryState {
  readonly ruleCards: readonly RuleCard[];
  readonly scoutCredits: number;
  readonly cosmeticIds: readonly string[];
  readonly facilityCredits: number;
}

export interface GameSettings {
  readonly reducedMotion: boolean;
  readonly haptics: boolean;
  /** Synthesised sound effects. See `apps/game/src/design/audio.ts`. */
  readonly sound: boolean;
  readonly matchSpeed: 'SLOW' | 'NORMAL' | 'FAST' | 'INSTANT';
  readonly presentation: 'PITCH' | 'BROADCAST';
  readonly commentary: boolean;
  readonly autoDecisionTimeout: boolean;
  readonly region: string;
  readonly enabledPackIds: readonly string[];
  readonly difficulty: 'CASUAL' | 'STANDARD' | 'DEMANDING';
}

export interface AnalyticsState {
  readonly sessionCount: number;
  readonly matchesPlayed: number;
  readonly decisionsMade: number;
  readonly lastSeenCycle: number;
}

/** Entities that can appear as a contract counterparty, for the negotiation UI. */
export type ContractRef = { readonly contractId: ContractId; readonly playerId: PlayerId };
export type CreatorRef = { readonly creatorId: CreatorId };
