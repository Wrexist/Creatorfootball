import type { EventId } from '../core/brand';
import { asId } from '../core/brand';
import { makeEvent, type DomainEventPayloads, type DomainEventType, type EntityRef, type EventContext, type EventImportance, type AnyDomainEvent } from '../core/events';
import type { GameState } from './state';

/**
 * Event construction bound to game state.
 *
 * Event ids are derived from a save-scoped counter rather than a timestamp or a
 * random value, so replaying a seed produces byte-identical events — which is
 * what lets the balance harness diff two runs meaningfully.
 */
export class GameEventFactory implements EventContext {
  private counter: number;

  constructor(
    private state: GameState,
    private now: number,
  ) {
    this.counter = state.idCounters['event'] ?? 0;
  }

  get cycle(): number { return this.state.clock.cycle; }
  get season(): number { return this.state.clock.season; }
  get week(): number { return this.state.clock.week; }
  get at(): number { return this.now; }

  nextEventId = (): EventId => asId<EventId>(`ev_${(++this.counter).toString(36)}`);

  sync(state: GameState, now: number): void {
    this.state = state;
    this.now = now;
  }

  /** Fold the counter back into state so it survives a save/load round trip. */
  commit(state: GameState): GameState {
    return { ...state, idCounters: { ...state.idCounters, event: this.counter } };
  }

  make<T extends DomainEventType>(
    type: T,
    payload: DomainEventPayloads[T],
    opts: { importance?: EventImportance; entities?: readonly EntityRef[] } = {},
  ): AnyDomainEvent {
    return makeEvent(this, type, payload, opts) as AnyDomainEvent;
  }

  /** Denormalised entity references so the feed can render without a store lookup. */
  clubRef(clubId: string): EntityRef {
    return { kind: 'club', id: clubId, name: this.state.clubs[clubId]?.name ?? 'Unknown Club' };
  }

  playerRef(playerId: string): EntityRef {
    return { kind: 'player', id: playerId, name: this.state.players[playerId]?.displayName ?? 'Unknown Player' };
  }

  creatorRef(creatorId: string): EntityRef {
    return { kind: 'creator', id: creatorId, name: this.state.creators[creatorId]?.displayName ?? 'Unknown Creator' };
  }
}
