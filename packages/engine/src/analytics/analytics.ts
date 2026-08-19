import type { AnyDomainEvent } from '../core/events';

/**
 * Analytics.
 *
 * The engine never talks to a network. This module is a pluggable pipe: the
 * app installs a sink, the engine calls `trackEvent`, and everything before the
 * sink is pure and synchronous. Events fired before a sink exists are buffered
 * and replayed, so instrumentation on the cold-start path is not silently lost.
 *
 * There is no clock here either — a timestamp is a property the caller passes.
 */

export const ANALYTICS_EVENTS = [
  // lifecycle
  'session_start', 'session_end',
  'onboarding_start', 'onboarding_step', 'onboarding_complete',
  'club_created', 'manager_created',
  // core loop
  'first_match', 'match_started', 'match_completed', 'live_decision', 'goal',
  'cycle_advanced', 'season_completed',
  // squad and market
  'transfer_viewed', 'transfer_started', 'transfer_completed', 'transfer_failed',
  'scout_assigned', 'training_changed', 'facility_upgraded',
  // world
  'social_story_opened', 'social_post_opened', 'media_story_opened',
  'rivalry_viewed', 'legacy_viewed',
  // progression
  'objective_viewed', 'objective_completed', 'objective_claimed',
  // commerce
  'store_opened', 'offer_viewed', 'purchase_started', 'purchase_completed', 'purchase_failed',
  // churn indicators
  'session_abandoned', 'onboarding_dropped', 'match_abandoned',
  'inactivity_detected', 'churn_risk_flagged', 'return_after_absence',
] as const;

export type AnalyticsEventName = (typeof ANALYTICS_EVENTS)[number];

export type AnalyticsSink = (name: string, props: Record<string, unknown>) => void;

const VALID = new Set<string>(ANALYTICS_EVENTS);

interface BufferedEvent { readonly name: string; readonly props: Record<string, unknown> }

/** Bounded so a sinkless session cannot grow without limit. */
const MAX_BUFFER = 500;

let sink: AnalyticsSink | null = null;
let buffer: BufferedEvent[] = [];
let rejected: string[] = [];

/**
 * Install the sink. Anything already buffered is flushed immediately in the
 * order it happened.
 */
export function setAnalyticsSink(next: AnalyticsSink | null): void {
  sink = next;
  if (!sink) return;
  const pending = buffer;
  buffer = [];
  for (const event of pending) sink(event.name, event.props);
}

/**
 * Record an event. Unknown names are rejected rather than forwarded: a typo
 * that silently creates a new metric is worse than no metric.
 */
export function trackEvent(name: string, props: Record<string, unknown> = {}): void {
  if (!VALID.has(name)) {
    if (rejected.length < MAX_BUFFER) rejected.push(name);
    return;
  }
  if (sink) { sink(name, props); return; }
  if (buffer.length >= MAX_BUFFER) buffer.shift();
  buffer.push({ name, props });
}

/** Events dropped because the name is not in the schema. Test/debug aid. */
export const rejectedEventNames = (): readonly string[] => rejected;

/** Events waiting for a sink. */
export const bufferedEvents = (): readonly BufferedEvent[] => buffer;

/** Clear all module state. Tests must call this to stay isolated. */
export function resetAnalytics(): void {
  sink = null;
  buffer = [];
  rejected = [];
}

/**
 * Map a domain event to its analytics counterpart, if it has one. Keeping this
 * mapping in one place stops instrumentation drifting away from simulation.
 */
export function analyticsForDomainEvent(
  event: AnyDomainEvent,
): { name: AnalyticsEventName; props: Record<string, unknown> } | null {
  switch (event.type) {
    case 'CLUB_CREATED':
      return { name: 'club_created', props: { clubId: event.payload.clubId, name: event.payload.name } };
    case 'MATCH_STARTED':
      return { name: 'match_started', props: { matchId: event.payload.matchId, home: event.payload.homeClubId, away: event.payload.awayClubId } };
    case 'GOAL_SCORED':
      return { name: 'goal', props: { matchId: event.payload.matchId, clubId: event.payload.clubId, minute: event.payload.minute } };
    case 'LIVE_DECISION_MADE':
      return { name: 'live_decision', props: { matchId: event.payload.matchId, promptId: event.payload.promptId, optionId: event.payload.optionId } };
    case 'MATCH_WON':
    case 'MATCH_LOST':
    case 'MATCH_DRAWN':
      return { name: 'match_completed', props: { matchId: event.payload.matchId, clubId: event.payload.clubId, result: event.type } };
    case 'TRANSFER_COMPLETED':
      return { name: 'transfer_completed', props: { playerId: event.payload.playerId, fee: event.payload.fee, toClubId: event.payload.toClubId } };
    case 'TRANSFER_BID_REJECTED':
      return { name: 'transfer_failed', props: { playerId: event.payload.playerId, reason: event.payload.reason } };
    case 'FACILITY_UPGRADED':
      return { name: 'facility_upgraded', props: { clubId: event.payload.clubId, facilityId: event.payload.facilityId, level: event.payload.level } };
    case 'OBJECTIVE_COMPLETED':
      return { name: 'objective_completed', props: { objectiveId: event.payload.objectiveId, title: event.payload.title } };
    case 'REWARD_CLAIMED':
      return { name: 'objective_claimed', props: { rewardId: event.payload.rewardId, kind: event.payload.kind, amount: event.payload.amount } };
    case 'SEASON_COMPLETED':
      return { name: 'season_completed', props: { season: event.payload.season, position: event.payload.playerPosition } };
    case 'CYCLE_ADVANCED':
      return { name: 'cycle_advanced', props: { from: event.payload.from, to: event.payload.to } };
    case 'STORY_PUBLISHED':
      return { name: 'media_story_opened', props: { storyId: event.payload.storyId, importance: event.payload.importance } };
    default:
      return null;
  }
}

/** Convenience for the orchestration layer: pipe a batch of domain events. */
export function trackDomainEvents(events: readonly AnyDomainEvent[]): void {
  for (const event of events) {
    const mapped = analyticsForDomainEvent(event);
    if (mapped) trackEvent(mapped.name, mapped.props);
  }
}

/**
 * Churn heuristics. The engine cannot see wall-clock gaps, so the caller passes
 * the observations; we own the thresholds and the naming.
 */
export const CHURN_BALANCE = {
  /** Cycles of no progress that counts as stalling. */
  stalledCycles: 3,
  /** Consecutive defeats that historically precede a lapse. */
  losingStreak: 4,
  /** Onboarding steps completed below which a drop is "early". */
  earlyOnboardingStep: 3,
} as const;

export interface ChurnSignals {
  readonly cyclesSinceProgress: number;
  readonly consecutiveDefeats: number;
  readonly fanSentiment: number;
  readonly sessionSeconds: number;
}

/** Emits `churn_risk_flagged` with the reasons that fired, if any. */
export function evaluateChurnRisk(signals: ChurnSignals): string[] {
  const reasons: string[] = [];
  if (signals.cyclesSinceProgress >= CHURN_BALANCE.stalledCycles) reasons.push('stalled_progress');
  if (signals.consecutiveDefeats >= CHURN_BALANCE.losingStreak) reasons.push('losing_streak');
  if (signals.fanSentiment <= 25) reasons.push('fan_sentiment_collapse');
  if (reasons.length > 0) {
    trackEvent('churn_risk_flagged', { reasons, sessionSeconds: signals.sessionSeconds });
  }
  return reasons;
}
