import type {
  ClubId, PlayerId, CreatorId, MatchId, SeasonId, TransferId, SponsorId,
  RivalryId, ObjectiveId, StoryId, EventId, FacilityId, ContractId,
} from './brand';

/**
 * Typed domain events.
 *
 * These are the spine of the product. A single event is consumed by the UI, the
 * media engine, the social feed, analytics, the history/legacy record and the
 * reward system — which is what makes the world feel like it *remembers* things.
 * Nothing may react to a state mutation it did not learn about through an event.
 */

export type EventImportance = 1 | 2 | 3 | 4 | 5;

export interface EntityRef {
  readonly kind: 'club' | 'player' | 'creator' | 'manager' | 'match' | 'rivalry' | 'sponsor' | 'competition';
  readonly id: string;
  /** Denormalised for rendering without a store lookup. */
  readonly name: string;
}

export interface DomainEventPayloads {
  // --- lifecycle ---
  GAME_STARTED: { saveId: string; clubId: ClubId; managerName: string };
  SEASON_STARTED: { seasonId: SeasonId; season: number };
  SEASON_COMPLETED: { seasonId: SeasonId; season: number; championClubId: ClubId; playerPosition: number };
  CYCLE_ADVANCED: { from: number; to: number };

  // --- match ---
  MATCH_SCHEDULED: { matchId: MatchId; homeClubId: ClubId; awayClubId: ClubId; week: number };
  MATCH_STARTED: { matchId: MatchId; homeClubId: ClubId; awayClubId: ClubId };
  GOAL_SCORED: { matchId: MatchId; clubId: ClubId; scorerId: PlayerId; assistId?: PlayerId; minute: number; homeScore: number; awayScore: number; special?: string };
  MATCH_WON: { matchId: MatchId; clubId: ClubId; opponentId: ClubId; homeScore: number; awayScore: number; margin: number };
  MATCH_LOST: { matchId: MatchId; clubId: ClubId; opponentId: ClubId; homeScore: number; awayScore: number; margin: number };
  MATCH_DRAWN: { matchId: MatchId; clubId: ClubId; opponentId: ClubId; score: number };
  PLAYER_INJURED: { playerId: PlayerId; clubId: ClubId; weeksOut: number; severity: string; matchId?: MatchId };
  PLAYER_RECOVERED: { playerId: PlayerId; clubId: ClubId };
  RED_CARD: { playerId: PlayerId; clubId: ClubId; matchId: MatchId; minute: number };
  MOTM_AWARDED: { playerId: PlayerId; clubId: ClubId; matchId: MatchId; rating: number };
  SPECIAL_RULE_TRIGGERED: { matchId: MatchId; rule: string; clubId?: ClubId; minute: number };
  LIVE_DECISION_MADE: { matchId: MatchId; promptId: string; optionId: string; minute: number };

  // --- squad ---
  PLAYER_SIGNED: { playerId: PlayerId; clubId: ClubId; fromClubId?: ClubId; fee: number; wage: number; transferId?: TransferId };
  PLAYER_SOLD: { playerId: PlayerId; fromClubId: ClubId; toClubId: ClubId; fee: number };
  PLAYER_RELEASED: { playerId: PlayerId; clubId: ClubId };
  CONTRACT_SIGNED: { contractId: ContractId; playerId: PlayerId; clubId: ClubId; years: number; wage: number };
  CONTRACT_EXPIRING: { playerId: PlayerId; clubId: ClubId; weeksLeft: number };
  PLAYER_DEVELOPED: { playerId: PlayerId; clubId: ClubId; attribute: string; from: number; to: number };
  PLAYER_BREAKOUT: { playerId: PlayerId; clubId: ClubId; overall: number };
  YOUTH_PROSPECT_PROMOTED: { playerId: PlayerId; clubId: ClubId };
  PLAYER_MORALE_CHANGED: { playerId: PlayerId; clubId: ClubId; from: number; to: number; reason: string };

  // --- transfers ---
  TRANSFER_BID_MADE: { transferId: TransferId; playerId: PlayerId; fromClubId: ClubId; toClubId: ClubId; amount: number };
  TRANSFER_BID_REJECTED: { transferId: TransferId; playerId: PlayerId; reason: string };
  TRANSFER_COMPLETED: { transferId: TransferId; playerId: PlayerId; fromClubId: ClubId; toClubId: ClubId; fee: number };
  TRANSFER_HIJACKED: { playerId: PlayerId; byClubId: ClubId; fromClubId: ClubId };
  SCOUT_REPORT_READY: { playerId: PlayerId; clubId: ClubId; confidence: number };

  // --- club / world ---
  CLUB_CREATED: { clubId: ClubId; name: string };
  FACILITY_UPGRADED: { clubId: ClubId; facilityId: FacilityId; level: number };
  SPONSOR_SIGNED: { clubId: ClubId; sponsorId: SponsorId; value: number };
  SPONSOR_LOST: { clubId: ClubId; sponsorId: SponsorId; reason: string };
  FAN_SENTIMENT_CHANGED: { clubId: ClubId; from: number; to: number; reason: string };
  ATTENDANCE_RECORDED: { clubId: ClubId; matchId: MatchId; attendance: number; capacity: number };
  REPUTATION_CHANGED: { clubId: ClubId; from: number; to: number; reason: string };
  MANAGER_SACKED: { clubId: ClubId; managerName: string };

  // --- rivalry / story ---
  RIVALRY_INTENSIFIED: { rivalryId: RivalryId; clubA: ClubId; clubB: ClubId; intensity: number; reason: string };
  RIVALRY_CREATED: { rivalryId: RivalryId; clubA: ClubId; clubB: ClubId };
  RECORD_BROKEN: { clubId: ClubId; record: string; value: number; holderId?: PlayerId };
  STORY_PUBLISHED: { storyId: StoryId; headline: string; importance: EventImportance };
  CREATOR_MOMENT: { creatorId: CreatorId; clubId: ClubId; kind: string; reach: number };
  CREATOR_JOINED: { creatorId: CreatorId; clubId: ClubId; role: string };

  // --- progression / economy ---
  OBJECTIVE_COMPLETED: { objectiveId: ObjectiveId; title: string; rewardSummary: string };
  OBJECTIVE_FAILED: { objectiveId: ObjectiveId; title: string };
  REWARD_CLAIMED: { rewardId: string; kind: string; amount: number };
  TROPHY_WON: { clubId: ClubId; competition: string; season: number };
  PROMOTED: { clubId: ClubId; toTier: number };
  RELEGATED: { clubId: ClubId; toTier: number };
  BALANCE_LOW: { clubId: ClubId; balance: number };
}

export type DomainEventType = keyof DomainEventPayloads;

export interface DomainEvent<T extends DomainEventType = DomainEventType> {
  readonly id: EventId;
  readonly type: T;
  readonly payload: DomainEventPayloads[T];
  readonly cycle: number;
  readonly season: number;
  readonly week: number;
  /** Wall-clock ms, for display ordering only. Never simulate from this. */
  readonly at: number;
  readonly importance: EventImportance;
  readonly entities: readonly EntityRef[];
  /** Set when the event originated inside a match simulation. */
  readonly matchId?: MatchId;
}

export type AnyDomainEvent = { [K in DomainEventType]: DomainEvent<K> }[DomainEventType];

export type EventListener = (event: AnyDomainEvent) => void;

/**
 * Append-only journal + synchronous fan-out.
 *
 * Listeners must not mutate game state directly; they derive projections
 * (social feed, media, analytics, history). Keeping this synchronous makes the
 * whole world deterministic under a fixed seed.
 */
export class EventBus {
  private listeners = new Set<EventListener>();
  private typed = new Map<DomainEventType, Set<EventListener>>();
  private journal: AnyDomainEvent[] = [];
  private maxJournal: number;

  constructor(maxJournal = 5000) { this.maxJournal = maxJournal; }

  on(listener: EventListener): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }

  onType<T extends DomainEventType>(type: T, listener: (e: DomainEvent<T>) => void): () => void {
    let set = this.typed.get(type);
    if (!set) { set = new Set(); this.typed.set(type, set); }
    const wrapped = listener as EventListener;
    set.add(wrapped);
    return () => { set?.delete(wrapped); };
  }

  emit(event: AnyDomainEvent): void {
    this.journal.push(event);
    if (this.journal.length > this.maxJournal) {
      this.journal.splice(0, this.journal.length - this.maxJournal);
    }
    const typed = this.typed.get(event.type);
    if (typed) for (const l of typed) l(event);
    for (const l of this.listeners) l(event);
  }

  emitAll(events: readonly AnyDomainEvent[]): void {
    for (const e of events) this.emit(e);
  }

  history(): readonly AnyDomainEvent[] { return this.journal; }

  /** Replace the journal wholesale — used when loading a save. */
  hydrate(events: readonly AnyDomainEvent[]): void { this.journal = events.slice(); }

  clear(): void { this.journal = []; }
}

/** Monotonic per-save counter, seeded from the save so ids stay deterministic. */
export interface EventContext {
  readonly cycle: number;
  readonly season: number;
  readonly week: number;
  readonly at: number;
  nextEventId: () => EventId;
}

export function makeEvent<T extends DomainEventType>(
  ctx: EventContext,
  type: T,
  payload: DomainEventPayloads[T],
  opts: { importance?: EventImportance; entities?: readonly EntityRef[]; matchId?: MatchId } = {},
): DomainEvent<T> {
  return {
    id: ctx.nextEventId(),
    type,
    payload,
    cycle: ctx.cycle,
    season: ctx.season,
    week: ctx.week,
    at: ctx.at,
    importance: opts.importance ?? 2,
    entities: opts.entities ?? [],
    ...(opts.matchId ? { matchId: opts.matchId } : {}),
  };
}
