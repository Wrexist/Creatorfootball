import type { ClubId, EventId, MatchId, PlayerId } from '../core/brand';
import type { AnyDomainEvent, EntityRef, EventImportance } from '../core/events';
import type { MediaTemplate, ObjectiveTemplate, SocialTemplate } from '../content/schema';
import type { Club } from '../clubs/club';
import type { Creator } from '../creators/creator';
import type { Player } from '../players/player';
import type { SocialPost } from '../game/state';

/**
 * Ports the living-world modules depend on.
 *
 * Workstream B owns the real `ContentRegistry`; we deliberately depend on a
 * structural *subset* of it so that this workstream compiles, tests and ships
 * before the content pack lands. The concrete registry class is assignable to
 * this port without knowing it exists.
 */
export interface ContentRegistryPort {
  socialTemplates(): readonly SocialTemplate[];
  mediaTemplates(): readonly MediaTemplate[];
  objectives(): readonly ObjectiveTemplate[];
}

export type SocialPostKind = SocialPost['kind'];

/**
 * Facts describing a single reaction opportunity.
 *
 * Template `conditions` are matched against this map, so it doubles as the
 * public vocabulary content authors may key on. Supported keys today:
 *   trigger, importance, sentiment, derby, margin, fee, minute, count,
 *   goals, weeksOut, intensity, position, reputation, tone, tier, streak,
 *   isPlayerClub, homeAdvantage, record, rating, age, overall, value.
 */
export type HookFacts = Readonly<Record<string, string | number | boolean>>;

/** Values substituted into `{token}` slots in a template. */
export type TokenMap = Readonly<Record<string, string | number>>;

/**
 * A reaction opportunity produced by the cascade. Media and social both consume
 * these; neither is allowed to invent one out of thin air, which is what keeps
 * every published line traceable to something that actually happened.
 */
export interface ContentHook {
  readonly trigger: string;
  /** The event that directly produced this hook. */
  readonly sourceEventId: EventId;
  /** The event at the head of the cascade chain. */
  readonly rootEventId: EventId;
  /** 0 for a direct reaction, higher for knock-on reactions. */
  readonly depth: number;
  readonly importance: EventImportance;
  /** -1 (hostile) .. +1 (celebratory), before manager damping. */
  readonly sentiment: number;
  readonly tokens: TokenMap;
  readonly facts: HookFacts;
  readonly entities: readonly EntityRef[];
  /** The club the hook is *about*; drives which fans and rivals react. */
  readonly clubId?: ClubId;
  readonly opponentClubId?: ClubId;
  readonly playerId?: PlayerId;
  readonly matchId?: MatchId;
  /** Author kinds that make sense for this hook, in preference order. */
  readonly audiences: readonly SocialPostKind[];
  readonly tags: readonly string[];
  /** Cycle the hook should surface on; the cascade can schedule follow-ups. */
  readonly cycle: number;
}

export const clubRef = (c: Club): EntityRef => ({ kind: 'club', id: c.id, name: c.name });
export const playerRef = (p: Player): EntityRef => ({ kind: 'player', id: p.id, name: p.displayName });
export const creatorRef = (c: Creator): EntityRef => ({ kind: 'creator', id: c.id, name: c.displayName });

/** Lookup helpers that tolerate a missing entity rather than throwing mid-tick. */
export const clubOf = (clubs: Readonly<Record<string, Club>>, id: string | undefined): Club | null =>
  (id ? clubs[id] ?? null : null);
export const playerOf = (players: Readonly<Record<string, Player>>, id: string | undefined): Player | null =>
  (id ? players[id] ?? null : null);

/** Narrow an unknown event to a specific type without a cast at every call site. */
export const isEvent = <T extends AnyDomainEvent['type']>(
  e: AnyDomainEvent,
  type: T,
): e is Extract<AnyDomainEvent, { type: T }> => e.type === type;
